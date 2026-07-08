"""
Core generation engine for Pet Creations AI.

Public API:
    generate(style, image_bytes, mime="image/jpeg") -> PNG/JPEG bytes
    recolor(style, image_bytes, instruction, mime)  -> bytes   (retry / recolor / fix)

Routes each style to its best model (see styles.py). Zero external dependencies (urllib).
The FastAPI layer (app.py) will call these; kept separate so the engine is testable on its own.
"""

import base64
import json
import os
import urllib.request
import urllib.error

from styles import STYLES

HERE = os.path.dirname(os.path.abspath(__file__))
GEMINI_MODEL = "gemini-2.5-flash-image"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
OPENAI_URL = "https://api.openai.com/v1/images/edits"
OPENAI_MODEL = "gpt-image-1"
HERITAGE_REF = os.path.join(HERE, "assets", "heritage_reference.png")


class GenerationError(Exception):
    pass


def load_env():
    """Load API keys from .env / api.env.md into the environment (no-op if already set)."""
    for fn in (".env", "api.env.md"):
        p = os.path.join(HERE, fn)
        if os.path.isfile(p):
            for line in open(p):
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


# ---------------------------------------------------------------- Gemini (Nano Banana)
def _gemini(prompt, image_bytes, mime):
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise GenerationError("GEMINI_API_KEY not set")
    body = json.dumps({"contents": [{"role": "user", "parts": [
        {"text": prompt},
        {"inline_data": {"mime_type": mime, "data": base64.b64encode(image_bytes).decode()}},
    ]}]}).encode()
    req = urllib.request.Request(
        GEMINI_URL, data=body,
        headers={"Content-Type": "application/json", "x-goog-api-key": key})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise GenerationError(f"Gemini HTTP {e.code}: {e.read().decode(errors='replace')[:300]}")
    except urllib.error.URLError as e:
        raise GenerationError(f"Gemini network error: {e.reason}")
    for part in (data.get("candidates") or [{}])[0].get("content", {}).get("parts", []):
        blob = part.get("inlineData") or part.get("inline_data")
        if blob and blob.get("data"):
            return base64.b64decode(blob["data"])
    raise GenerationError(f"Gemini returned no image: {json.dumps(data)[:300]}")


# ---------------------------------------------------------------- OpenAI (gpt-image-1)
def _multipart(fields, images, image_field):
    boundary = "----pcadgbackendboundary9f2a4c"
    parts = []
    for name, val in fields.items():
        parts += [f"--{boundary}".encode(),
                  f'Content-Disposition: form-data; name="{name}"'.encode(), b"", str(val).encode()]
    for filename, content, ctype in images:
        parts += [f"--{boundary}".encode(),
                  f'Content-Disposition: form-data; name="{image_field}"; filename="{filename}"'.encode(),
                  f"Content-Type: {ctype}".encode(), b"", content]
    parts += [f"--{boundary}--".encode(), b""]
    return b"\r\n".join(parts), boundary


def _openai(prompt, image_bytes, mime, use_reference, size, quality="high", extra_images=None):
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise GenerationError("OPENAI_API_KEY not set")
    images = [("pet.png", image_bytes, mime)]
    for img in (extra_images or []):
        images.append(img)
    if use_reference and os.path.isfile(HERITAGE_REF):
        with open(HERITAGE_REF, "rb") as f:
            images.append(("reference.png", f.read(), "image/png"))
    field = "image[]" if len(images) > 1 else "image"
    body, boundary = _multipart(
        {"model": OPENAI_MODEL, "prompt": prompt, "size": size or "1024x1024", "quality": quality, "n": 1},
        images, field)
    req = urllib.request.Request(OPENAI_URL, data=body, headers={
        "Authorization": f"Bearer {key}",
        "Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise GenerationError(f"OpenAI HTTP {e.code}: {e.read().decode(errors='replace')[:300]}")
    except urllib.error.URLError as e:
        raise GenerationError(f"OpenAI network error: {e.reason}")
    return base64.b64decode(data["data"][0]["b64_json"])


# ---------------------------------------------------------------- Public API
def generate(style, image_bytes, mime="image/jpeg"):
    """Generate a portrait of the pet in the given style."""
    if style not in STYLES:
        raise GenerationError(f"Unknown style '{style}'. Options: {list(STYLES)}")
    cfg = STYLES[style]
    if cfg["provider"] == "gemini":
        return _gemini(cfg["prompt"], image_bytes, mime)
    return _openai(cfg["prompt"], image_bytes, mime, cfg.get("use_reference", False), cfg.get("size"))


def recolor(style, image_bytes, instruction, mime="image/png"):
    """Retry / recolor / fix: apply a follow-up edit instruction to an already-generated image."""
    cfg = STYLES.get(style, {})
    edit = (
        "Here is an existing pet portrait. Apply this change while keeping everything else identical, "
        "and keep the pet exactly the same: " + instruction.strip()
    )
    if cfg.get("provider") == "openai":
        # recolors don't need full fidelity — medium quality cuts Heritage retry cost ~4x
        return _openai(edit, image_bytes, mime, use_reference=False, size=cfg.get("size"), quality="medium")
    return _gemini(edit, image_bytes, mime)
