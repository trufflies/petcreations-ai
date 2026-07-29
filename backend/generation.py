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
import time
import urllib.request
import urllib.error

from styles import STYLES, FRAMES

HERE = os.path.dirname(os.path.abspath(__file__))
GEMINI_MODEL = "gemini-2.5-flash-image"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
OPENAI_URL = "https://api.openai.com/v1/images/edits"
OPENAI_MODEL = "gpt-image-1"
# Every canvas sold is landscape 4:3 (24x18, 32x24, 40x30). Gemini otherwise mirrors the input
# photo's shape, so a portrait phone snap produced portrait art that got cropped on the canvas
# and in the room view. Asking for the ratio up front is the fix.
GEMINI_ASPECT = "4:3"
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
    # Normalise first: phones upload HEIC and huge CMYK/alpha files that Gemini rejects outright.
    image_bytes = _prep_image(image_bytes)
    body = json.dumps({
        "contents": [{"role": "user", "parts": [
            {"text": prompt},
            {"inline_data": {"mime_type": "image/png", "data": base64.b64encode(image_bytes).decode()}},
        ]}],
        "generationConfig": {"imageConfig": {"aspectRatio": GEMINI_ASPECT}},
    }).encode()
    # 429/500/503 from Gemini are transient and common under load — a couple of quick retries
    # turn most of them into a successful render instead of a dead end for the customer.
    data, last = None, None
    for attempt in range(3):
        req = urllib.request.Request(
            GEMINI_URL, data=body,
            headers={"Content-Type": "application/json", "x-goog-api-key": key})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.loads(r.read())
            break
        except urllib.error.HTTPError as e:
            last = (e.code, e.read().decode(errors="replace")[:300])
            if e.code in (429, 500, 502, 503) and attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            break
        except urllib.error.URLError as e:
            last = (0, str(e.reason))
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            break
    if data is None:
        code, detail = last or (0, "unknown")
        # Customers should never be shown raw upstream JSON. Keep the detail on the server.
        print("Gemini failure %s: %s" % (code, detail))
        if code in (429, 500, 502, 503) or code == 0:
            raise GenerationError("Our art service is busy right now — please try again in a moment.")
        raise GenerationError("That photo could not be processed — please try a different one.")
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


def _prep_image(image_bytes):
    """gpt-image-1's edit endpoint is strict about mode/size/format. Normalize any upload to a
    clean RGB PNG at a sane size so Heritage accepts whatever the other styles do (big phone
    photos, CMYK, alpha channels, odd formats)."""
    from io import BytesIO
    try:
        from PIL import Image
        im = Image.open(BytesIO(image_bytes))
        im = im.convert("RGB")
        maxdim = 2048
        if max(im.size) > maxdim:
            r = maxdim / float(max(im.size))
            im = im.resize((max(1, int(im.size[0] * r)), max(1, int(im.size[1] * r))))
        out = BytesIO()
        im.save(out, format="PNG")
        return out.getvalue()
    except Exception as e:
        raise GenerationError("Could not read that photo — please upload a JPG or PNG. (" + str(e)[:100] + ")")


def _openai(prompt, image_bytes, mime, use_reference, size, quality="high", extra_images=None):
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise GenerationError("OPENAI_API_KEY not set")
    images = [("pet.png", _prep_image(image_bytes), "image/png")]
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


def _tone_lift(image_bytes, gamma):
    """Raise midtones without clipping highlights.

    gpt-image-1 has a strong dark old-master prior for Heritage and prompt wording barely moves
    it — an explicit "never dark or murky" instruction changed mean luminance by less than the
    variance between two runs. A tone curve is deterministic, so the correction lives here
    rather than in the prompt. 0.82 lifts the subject clear of the shadows while keeping the
    aged-varnish depth; below ~0.75 the background starts to look hazy.
    """
    from io import BytesIO
    try:
        from PIL import Image
        im = Image.open(BytesIO(image_bytes)).convert("RGB")
        lut = [min(255, int(round(255.0 * ((i / 255.0) ** gamma)))) for i in range(256)]
        out = BytesIO()
        im.point(lut * 3).save(out, format="PNG")
        return out.getvalue()
    except Exception:
        return image_bytes          # a failed curve must never cost the render


# ---------------------------------------------------------------- Public API
def style_prompt(style, variant=None):
    """Prompt for a style, with the chosen variant's scene filled in if the style has variants."""
    cfg = STYLES[style]
    prompt = cfg["prompt"]
    variants = cfg.get("variants")
    if variants:
        key = variant if variant in variants else cfg.get("default_variant")
        prompt = prompt.format(SCENE=variants[key]["scene"])
    return prompt


def generate(style, image_bytes, mime="image/jpeg", variant=None):
    """Generate a portrait of the pet in the given style (and variant, where the style has them)."""
    if style not in STYLES:
        raise GenerationError(f"Unknown style '{style}'. Options: {list(STYLES)}")
    cfg = STYLES[style]
    prompt = style_prompt(style, variant)
    if cfg["provider"] == "gemini":
        art = _gemini(prompt, image_bytes, mime)
    else:
        art = _openai(prompt, image_bytes, mime, cfg.get("use_reference", False), cfg.get("size"))
    return _tone_lift(art, cfg["lift"]) if cfg.get("lift") else art


def frame(image_bytes, frame_key, mime="image/png"):
    """Mount an already-generated portrait inside the chosen physical frame as a wall mockup."""
    cfg = FRAMES.get(frame_key)
    if not cfg:
        raise GenerationError(f"Unknown frame '{frame_key}'. Options: {list(FRAMES)}")
    prompt = (
        "Take this exact pet portrait and mount it inside " + cfg["prompt"] + ", hanging on a softly "
        "lit, warm neutral wall, styled like a professional interior product photo. Do NOT alter the "
        "artwork inside the frame — keep the pet and the painting exactly the same."
    )
    return _gemini(prompt, image_bytes, mime)


def mockup(prompt, image_bytes, mime="image/jpeg", size="1536x1024", frame_ref=None, quality="medium"):
    """Place an uploaded artwork into a photorealistic room/detail mockup (Haus of Lumen).
    An optional frame_ref image nudges gpt-image-1 to match a specific frame profile/finish."""
    extra, full = [], prompt
    if frame_ref:
        extra.append(("frame_ref.png", _prep_image(frame_ref), "image/png"))
        full += " Match the exact frame profile and finish shown in the attached frame reference image."
    return _openai(full, image_bytes, mime, use_reference=False, size=size,
                   quality=quality, extra_images=extra)


def recolor(style, image_bytes, instruction, mime="image/png"):
    """Retry / recolor / fix: apply a follow-up edit instruction to an already-generated image."""
    cfg = STYLES.get(style, {})
    edit = (
        "Here is an existing pet portrait. Apply this change while keeping everything else identical, "
        "and keep the pet exactly the same: " + instruction.strip()
    )
    if cfg.get("provider") == "openai":
        # recolors don't need full fidelity — medium quality cuts Heritage retry cost ~4x
        art = _openai(edit, image_bytes, mime, use_reference=False, size=cfg.get("size"), quality="medium")
    else:
        art = _gemini(edit, image_bytes, mime)
    return _tone_lift(art, cfg["lift"]) if cfg.get("lift") else art
