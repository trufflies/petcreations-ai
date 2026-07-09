"""
Pet Creations AI — generation backend (FastAPI).

Endpoints:
  GET  /health            -> service status + available styles
  POST /generate          -> multipart {file, style} -> {id, style, preview_url}
  POST /retry             -> form {id, instruction}  -> {id, style, preview_url}  (recolor / fix)
  GET  /generated/<file>  -> watermarked preview images
  GET  /app/              -> the standalone test page (static/index.html)

Notes:
- Endpoints are sync `def`, so FastAPI runs them in a threadpool — a slow 60-90s
  Heritage generation won't block other requests.
- Generation is synchronous per request for this demo. Production hardening (async job
  queue + polling, cloud storage, rate limiting) comes next; see TODO markers.
"""

import os
import re
import uuid

from fastapi import FastAPI, UploadFile, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

import generation as gen
from styles import STYLES, FRAMES
from watermark import add_watermark

gen.load_env()

HERE = os.path.dirname(os.path.abspath(__file__))
GEN_DIR = os.path.join(HERE, "generated")
STATIC_DIR = os.path.join(HERE, "static")
os.makedirs(GEN_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

app = FastAPI(title="Pet Creations AI")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


@app.middleware("http")
async def _no_cache_widget(request, call_next):
    # widget.js is the live storefront embed and changes on every deploy — force the browser
    # to revalidate it each load (ETag still gives cheap 304s) so updates always show.
    resp = await call_next(request)
    p = request.url.path
    if p == "/app/widget.js" or p.startswith("/app/examples/"):
        resp.headers["Cache-Control"] = "no-cache, must-revalidate"
    return resp

# In-memory job store (demo). TODO: replace with a DB + cloud storage for production.
JOBS = {}
MAX_FREE_RETRIES = 9999  # effectively unlimited for now (soft cap only to stop runaway abuse)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _save(art_bytes, style, email, retries):
    jid = uuid.uuid4().hex[:12]
    full_path = os.path.join(GEN_DIR, f"{jid}_full.png")
    prev_path = os.path.join(GEN_DIR, f"{jid}_preview.png")
    with open(full_path, "wb") as f:
        f.write(art_bytes)                       # clean full-res (delivered only after purchase)
    with open(prev_path, "wb") as f:
        f.write(add_watermark(art_bytes))        # watermarked preview (safe to show)
    JOBS[jid] = {"style": style, "full": full_path, "email": email, "retries": retries}
    return {"id": jid, "style": style, "preview_url": f"/generated/{jid}_preview.png",
            "retries_left": MAX_FREE_RETRIES - retries}


@app.get("/health")
def health():
    return {"ok": True,
            "styles": {k: v["label"] for k, v in STYLES.items()},
            "frames": {k: v["label"] for k, v in FRAMES.items()}}


@app.post("/generate")
def generate(file: UploadFile, style: str = Form(...), email: str = Form(...)):
    if style not in STYLES:
        raise HTTPException(400, f"unknown style '{style}'")
    if not EMAIL_RE.match((email or "").strip()):
        raise HTTPException(400, "please enter a valid email")
    data = file.file.read()
    if not data:
        raise HTTPException(400, "empty upload")
    # TODO: rate-limit per IP/session before spending on generation.
    try:
        art = gen.generate(style, data, file.content_type or "image/jpeg")
    except gen.GenerationError as e:
        raise HTTPException(502, str(e))
    return _save(art, style, email.strip(), 0)


@app.post("/retry")
def retry(id: str = Form(...), instruction: str = Form(...)):
    job = JOBS.get(id)
    if not job:
        raise HTTPException(404, "unknown id")
    if job["retries"] >= MAX_FREE_RETRIES:
        raise HTTPException(429, f"You've used all {MAX_FREE_RETRIES} free tweaks — "
                                 "place your order and our artist will perfect it for you.")
    with open(job["full"], "rb") as f:
        art = f.read()
    try:
        new = gen.recolor(job["style"], art, instruction, "image/png")
    except gen.GenerationError as e:
        raise HTTPException(502, str(e))
    return _save(new, job["style"], job["email"], job["retries"] + 1)


@app.post("/frame")
def apply_frame(id: str = Form(...), frame: str = Form(...)):
    job = JOBS.get(id)
    if not job:
        raise HTTPException(404, "unknown id")
    if frame not in FRAMES:
        raise HTTPException(400, f"unknown frame '{frame}'")
    with open(job["full"], "rb") as f:
        art = f.read()
    try:
        framed = gen.frame(art, frame, "image/png")
    except gen.GenerationError as e:
        raise HTTPException(502, str(e))
    saved = _save(framed, job["style"], job["email"], job["retries"])
    return {"framed_preview_url": saved["preview_url"], "frame": frame, "frame_label": FRAMES[frame]["label"]}


# Static mounts (after routes so /health etc. win)
app.mount("/generated", StaticFiles(directory=GEN_DIR), name="generated")
app.mount("/app", StaticFiles(directory=STATIC_DIR, html=True), name="app")
