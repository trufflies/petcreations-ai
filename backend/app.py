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

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

import generation as gen
import email_send
import listing
from styles import STYLES, FRAMES
from watermark import add_watermark

gen.load_env()

HERE = os.path.dirname(os.path.abspath(__file__))
# Persistent storage: set env GEN_DIR to a mounted Render disk (e.g. /data) so generated art +
# originals survive redeploys/restarts. Falls back to the local (ephemeral) folder for dev.
GEN_DIR = os.environ.get("GEN_DIR") or os.path.join(HERE, "generated")
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


def _save(art_bytes, style, email, retries, original=None, orig_ext=".jpg", original_url=None):
    jid = uuid.uuid4().hex[:12]
    full_path = os.path.join(GEN_DIR, f"{jid}_full.png")
    prev_path = os.path.join(GEN_DIR, f"{jid}_preview.png")
    with open(full_path, "wb") as f:
        f.write(art_bytes)                       # clean full-res (delivered only after purchase)
    with open(prev_path, "wb") as f:
        f.write(add_watermark(art_bytes))        # watermarked preview (safe to show)
    orig_url = original_url or ""
    if original:                                 # customer's uploaded photo (for the artist to work from)
        oname = f"{jid}_original{orig_ext}"
        with open(os.path.join(GEN_DIR, oname), "wb") as f:
            f.write(original)
        orig_url = f"/generated/{oname}"
    JOBS[jid] = {"style": style, "full": full_path, "email": email, "retries": retries, "original_url": orig_url}
    return {"id": jid, "style": style,
            "preview_url": f"/generated/{jid}_preview.png",
            "full_url": f"/generated/{jid}_full.png",
            "original_url": orig_url,
            "retries_left": MAX_FREE_RETRIES - retries}


@app.get("/health")
def health():
    return {"ok": True,
            "styles": {k: v["label"] for k, v in STYLES.items()},
            "frames": {k: v["label"] for k, v in FRAMES.items()},
            "email_configured": bool(os.environ.get("RESEND_API_KEY")),
            "persistent_storage": bool(os.environ.get("GEN_DIR"))}


def _compute_stats():
    """Preview-session analytics counted from files on the persistent disk.
    Each customer upload+generate saves one '<id>_original.<ext>', so those count the
    real preview sessions; '<id>_full.png' also counts retries/recolors."""
    import glob
    import time
    import datetime
    now = time.time()
    originals = glob.glob(os.path.join(GEN_DIR, "*_original*"))
    renders = glob.glob(os.path.join(GEN_DIR, "*_full.png"))

    def within(files, secs):
        n = 0
        for f in files:
            try:
                if now - os.path.getmtime(f) < secs:
                    n += 1
            except OSError:
                pass
        return n

    # Daily breakdown, bucketed by US Eastern date (UTC-4/EDT) so days line up with
    # the store owner's clock. Last 14 days, most recent first.
    counts = {}
    for f in originals:
        try:
            d = (datetime.datetime.utcfromtimestamp(os.path.getmtime(f))
                 - datetime.timedelta(hours=4)).strftime("%Y-%m-%d")
            counts[d] = counts.get(d, 0) + 1
        except OSError:
            pass
    today_et = (datetime.datetime.utcnow() - datetime.timedelta(hours=4)).date()
    by_day = []
    for i in range(14):
        d = (today_et - datetime.timedelta(days=i)).strftime("%Y-%m-%d")
        by_day.append({"date": d, "sessions": counts.get(d, 0)})

    return {"preview_sessions_total": len(originals),
            "preview_sessions_24h": within(originals, 86400),
            "preview_sessions_1h": within(originals, 3600),
            "total_renders_incl_retries": len(renders),
            "by_day_eastern": by_day}


@app.get("/stats.json")
def stats_json():
    """Raw analytics as JSON (for anything programmatic)."""
    return _compute_stats()


# Human-friendly stats page. __STATS__/__DAYS__ are token-replaced (not %-format /
# .format) so the literal { } in the CSS below don't need escaping.
STATS_PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="120">
<title>Pet Creations &mdash; Preview Stats</title>
<style>
  :root{--burg:#5E1622;--parch:#F3ECDE;--ink:#2b1a12;--line:#e3d8c5;--mut:#7a6a5c;}
  *{box-sizing:border-box;}
  body{margin:0;background:var(--parch);color:var(--ink);
       font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
       -webkit-font-smoothing:antialiased;}
  .wrap{max-width:560px;margin:0 auto;padding:34px 20px 60px;}
  h1{font-family:Georgia,"Times New Roman",serif;color:var(--burg);
     font-size:27px;margin:0 0 3px;letter-spacing:.2px;}
  .sub{color:var(--mut);font-size:13px;margin:0 0 26px;}
  .stat{display:flex;justify-content:space-between;align-items:baseline;
        padding:13px 0;border-bottom:1px solid var(--line);}
  .stat .label{color:#5f5045;}
  .stat .value{font-family:Georgia,serif;color:var(--burg);font-size:25px;font-weight:700;
               font-variant-numeric:tabular-nums;}
  h2{font-family:Georgia,serif;color:var(--burg);font-size:17px;margin:32px 0 12px;}
  .day{display:flex;align-items:center;gap:11px;padding:5px 0;font-size:14px;}
  .day .d{width:52px;color:var(--mut);font-variant-numeric:tabular-nums;flex:none;}
  .day .track{flex:1;display:flex;align-items:center;}
  .day .bar{height:15px;background:var(--burg);border-radius:3px;}
  .day .n{width:30px;text-align:right;color:var(--burg);font-weight:600;
          font-variant-numeric:tabular-nums;flex:none;}
  .day.today .d{color:var(--burg);font-weight:700;}
  .day.today .d::after{content:" \\2022";color:var(--burg);}
  .foot{margin-top:30px;color:#a2917f;font-size:12px;}
  .foot a{color:#a2917f;}
</style>
</head>
<body>
  <div class="wrap">
    <h1>Preview Stats</h1>
    <p class="sub">petcreationsart.com &middot; instant-preview sessions</p>
    __STATS__
    <h2>Last 14 days</h2>
    __DAYS__
    <p class="foot">Auto-refreshes every 2 min &middot; <a href="/stats.json">raw JSON</a></p>
  </div>
</body>
</html>"""


@app.get("/stats", response_class=HTMLResponse)
def stats_page():
    """Human-friendly analytics page (bookmark this one). Raw JSON at /stats.json."""
    import datetime
    s = _compute_stats()
    rows = [("All-time previews", s["preview_sessions_total"]),
            ("Last 24 hours", s["preview_sessions_24h"]),
            ("Last hour", s["preview_sessions_1h"]),
            ("Total renders (incl. retries)", s["total_renders_incl_retries"])]
    stat_html = "".join(
        "<div class='stat'><span class='label'>{}</span>"
        "<span class='value'>{}</span></div>".format(label, val)
        for label, val in rows)

    days = s["by_day_eastern"]
    peak = max((d["sessions"] for d in days), default=0) or 1
    today = days[0]["date"] if days else ""
    day_html = ""
    for d in days:
        dt = datetime.datetime.strptime(d["date"], "%Y-%m-%d")
        label = dt.strftime("%b") + " " + str(dt.day)
        width = max(int(round(d["sessions"] / peak * 210)), 3) if d["sessions"] else 0
        bar = "<span class='bar' style='width:{}px'></span>".format(width) if width else ""
        cls = "day today" if d["date"] == today else "day"
        day_html += ("<div class='{}'><span class='d'>{}</span>"
                     "<span class='track'>{}</span>"
                     "<span class='n'>{}</span></div>").format(cls, label, bar, d["sessions"])

    return STATS_PAGE.replace("__STATS__", stat_html).replace("__DAYS__", day_html)


@app.post("/generate")
def generate(file: UploadFile, background: BackgroundTasks,
             style: str = Form(...), email: str = Form(...)):
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
    ct = (file.content_type or "").lower()
    ext = ".png" if "png" in ct else (".webp" if "webp" in ct else ".jpg")
    saved = _save(art, style, email.strip(), 0, original=data, orig_ext=ext)
    # Email the customer their preview once the response is on its way out.
    # Runs after the response, is a no-op until RESEND_API_KEY is set, and can
    # never raise into the request (send_preview_email swallows its own errors).
    background.add_task(email_send.send_preview_email, email.strip(),
                        saved["preview_url"], STYLES[style]["label"])
    return saved


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
    return _save(new, job["style"], job["email"], job["retries"] + 1, original_url=job.get("original_url"))


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


@app.post("/listing")
def make_listing(image: UploadFile,
                 keywords: UploadFile = File(default=None),
                 template: str = Form(default=""),
                 notes: str = Form(default="")):
    """Etsy listing generator for Haus of Lumen: artwork (+ optional keyword-research screenshot
    and sample description) -> {title, tags, description}. Uses gpt-4o-mini via OPENAI_API_KEY."""
    try:
        img = image.file.read()
        if not img:
            raise HTTPException(status_code=400, detail="No artwork image received.")
        kb, kmime = None, "image/png"
        if keywords is not None:
            kb = keywords.file.read() or None
            kmime = keywords.content_type or "image/png"
        return listing.generate_listing(
            img, image.content_type or "image/jpeg", kb, kmime, template, notes)
    except listing.ListingError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail="Listing failed: " + str(e)[:200])


# Static mounts (after routes so /health etc. win)
app.mount("/generated", StaticFiles(directory=GEN_DIR), name="generated")
app.mount("/app", StaticFiles(directory=STATIC_DIR, html=True), name="app")
