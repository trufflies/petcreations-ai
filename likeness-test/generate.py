#!/usr/bin/env python3
"""
Pet portrait likeness test — pure stdlib, no pip install needed.

What it does:
  - Reads every pet photo in ./input
  - For each photo, generates a portrait in each STYLE below using
    Gemini 2.5 Flash Image ("Nano Banana"), with prompts tuned to
    preserve the pet's identity
  - Saves results to ./output
  - Writes contact_sheet.html so you can eyeball likeness side-by-side

Setup (one time):
  1. Get a free API key at https://aistudio.google.com/apikey
  2. In Terminal:   export GEMINI_API_KEY="paste-your-key-here"
  3. Drop 3-5 pet photos into the ./input folder
  4. Run:           python3 generate.py
  5. Open:          open contact_sheet.html

Run a subset of styles:   python3 generate.py watercolor pop_art
"""

import base64
import json
import os
import sys
import time
import urllib.request
import urllib.error

MODEL = "gemini-2.5-flash-image"
ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
COST_PER_IMAGE = 0.039  # approx USD, for the running cost estimate only

HERE = os.path.dirname(os.path.abspath(__file__))
INPUT_DIR = os.path.join(HERE, "input")
OUTPUT_DIR = os.path.join(HERE, "output")

# ---------------------------------------------------------------------------
# The most important part: preserving the pet's identity across every style.
# Edit these freely — this is exactly the prompt-tuning step of the milestone.
# ---------------------------------------------------------------------------
IDENTITY_RULES = (
    "You are given a real photograph of one specific pet. "
    "Recreate THIS EXACT pet in the art style described below. "
    "Preserve the pet's identity precisely: the same species and breed, the exact "
    "coat/fur colors and patterns, the precise position and shape of every marking, "
    "the eye color, nose color, ear shape, and facial proportions. The owner must "
    "instantly recognize their own pet. Do not beautify or alter the animal's features. "
)

COMPOSITION = (
    " Centered, well composed, crisp and high detail, print quality. "
    "Keep the anatomy natural and coherent — never paste the head onto a mismatched body. "
    "Absolutely no text, no lettering, no artist signature, no watermark, no borders, "
    "and no human hands in the frame."
)

STYLES = {
    "watercolor": (
        "Render as a soft, elegant watercolor painting with gentle color washes, "
        "subtle paper texture, and delicate brush strokes. Light, airy background."
    ),
    "oil_painting": (
        "Render as a classical fine-art oil painting with rich visible brushwork and "
        "warm gallery lighting, on a dark neutral studio background, like a museum pet portrait."
    ),
    # Heirloom / heritage portrait, matched to the user's reference: a full old-master OIL SCENE —
    # the pet resting on an antique settee with a velvet drape, antique books and a floral urn, in a
    # warm aged palette. NO costume on the animal; identity is held by IDENTITY_RULES + the line below.
    "heritage": (
        "Transform this exact pet into a museum-quality antique oil portrait in the grand old-master "
        "tradition (18th-19th century). Use the warm, softly aged, varnished palette of a centuries-old "
        "painting: muted golds, deep umber shadows, soft sage-green tones. Pose the pet naturally and at "
        "ease, resting on an ornate carved antique settee with damask upholstery and a rich burgundy "
        "velvet drape. Dress the scene with tasteful classic props: a side table with a stack of old "
        "leather-bound books, and an ornate bronze urn holding a soft bouquet of roses and peonies in "
        "muted cream and dusty rose. Behind, a soft atmospheric landscape backdrop dissolving into "
        "shadow. Gentle, warm directional light glowing on the pet's face and coat. Refined, dignified "
        "and timeless — a treasured family heirloom. The pet wears no clothing or costume (only its own "
        "natural collar if it has one); render the pet seamlessly painted into the scene, sitting "
        "anatomically natural and fully part of the composition."
    ),
}

IMAGE_EXTS = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
EXT_FOR_MIME = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}


def load_dotenv():
    """Load KEY=VALUE lines from ./.env into the environment (if the file exists)."""
    path = os.path.join(HERE, ".env")
    if not os.path.isfile(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def die(msg):
    print("\n❌ " + msg + "\n")
    sys.exit(1)


def load_inputs():
    if not os.path.isdir(INPUT_DIR):
        die(f"No input folder at {INPUT_DIR}")
    files = []
    for name in sorted(os.listdir(INPUT_DIR)):
        ext = os.path.splitext(name)[1].lower()
        if ext in IMAGE_EXTS:
            files.append(os.path.join(INPUT_DIR, name))
    if not files:
        die("No pet photos found in ./input — drop a few .jpg/.png files in there first.")
    return files


def call_nano_banana(api_key, prompt, image_bytes, mime, max_retries=4):
    """POST one image + prompt, return (out_bytes, out_mime) or raise."""
    body = json.dumps({
        "contents": [{
            "role": "user",
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": mime, "data": base64.b64encode(image_bytes).decode()}},
            ],
        }]
    }).encode()

    for attempt in range(max_retries):
        req = urllib.request.Request(
            ENDPOINT, data=body,
            headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read())
            return extract_image(data)
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")
            if e.code == 429 and attempt < max_retries - 1:
                wait = 5 * (attempt + 1)
                print(f"    rate-limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            raise RuntimeError(f"HTTP {e.code}: {detail[:400]}")
        except urllib.error.URLError as e:
            raise RuntimeError(f"Network error: {e.reason}")
    raise RuntimeError("Gave up after retries")


def extract_image(data):
    candidates = data.get("candidates") or []
    if not candidates:
        fb = data.get("promptFeedback") or data.get("error") or data
        raise RuntimeError(f"No image returned. Response: {json.dumps(fb)[:400]}")
    parts = (candidates[0].get("content") or {}).get("parts") or []
    text_bits = []
    for part in parts:
        blob = part.get("inlineData") or part.get("inline_data")
        if blob and blob.get("data"):
            mime = blob.get("mimeType") or blob.get("mime_type") or "image/png"
            return base64.b64decode(blob["data"]), mime
        if part.get("text"):
            text_bits.append(part["text"])
    reason = candidates[0].get("finishReason", "")
    raise RuntimeError(f"No image part (finishReason={reason}). Model said: {' '.join(text_bits)[:300]}")


def build_contact_sheet(rows):
    """rows: list of (input_relpath, [(style, output_relpath_or_None), ...])"""
    cells = []
    for src, outs in rows:
        thumbs = [f'<figure><img src="{src}"><figcaption>original</figcaption></figure>']
        for style, out in outs:
            if out:
                thumbs.append(f'<figure><img src="{out}"><figcaption>{style}</figcaption></figure>')
            else:
                thumbs.append(f'<figure class="fail"><div>failed</div><figcaption>{style}</figcaption></figure>')
        cells.append(f'<section><div class="grid">{"".join(thumbs)}</div></section>')

    html = f"""<!doctype html><meta charset="utf-8"><title>Pet portrait likeness test</title>
<style>
  body{{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:24px;background:#faf9f7;color:#222}}
  h1{{font-size:20px}} p.hint{{color:#666}}
  section{{border-top:1px solid #e5e2dc;padding:16px 0}}
  .grid{{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}}
  figure{{margin:0;width:220px}}
  figure img{{width:220px;height:220px;object-fit:cover;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.12)}}
  figure:first-child img{{outline:3px solid #2b7;outline-offset:2px}}
  figcaption{{font-size:12px;text-align:center;color:#555;margin-top:6px}}
  figure.fail div{{width:220px;height:220px;border-radius:10px;background:#fee;color:#a00;
    display:flex;align-items:center;justify-content:center;font-size:13px}}
</style>
<h1>Pet portrait likeness test &mdash; {MODEL}</h1>
<p class="hint">Green outline = original photo. Judge each style on: is it obviously the SAME pet?</p>
{''.join(cells)}
"""
    path = os.path.join(HERE, "contact_sheet.html")
    with open(path, "w") as f:
        f.write(html)
    return path


def main():
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        die('GEMINI_API_KEY is not set. Get one at https://aistudio.google.com/apikey then run:\n'
            '   export GEMINI_API_KEY="your-key"')

    chosen = sys.argv[1:] or list(STYLES.keys())
    unknown = [s for s in chosen if s not in STYLES]
    if unknown:
        die(f"Unknown style(s): {unknown}. Available: {list(STYLES.keys())}")

    inputs = load_inputs()
    total = len(inputs) * len(chosen)
    print(f"\n{len(inputs)} photo(s) x {len(chosen)} style(s) = {total} generations "
          f"(~${total * COST_PER_IMAGE:.2f})\n")

    rows, done = [], 0
    for src in inputs:
        with open(src, "rb") as f:
            img_bytes = f.read()
        mime = IMAGE_EXTS[os.path.splitext(src)[1].lower()]
        stem = os.path.splitext(os.path.basename(src))[0]
        outs = []
        for style in chosen:
            done += 1
            prompt = IDENTITY_RULES + STYLES[style] + COMPOSITION
            print(f"[{done}/{total}] {stem} -> {style} ...", end=" ", flush=True)
            try:
                out_bytes, out_mime = call_nano_banana(api_key, prompt, img_bytes, mime)
                ext = EXT_FOR_MIME.get(out_mime, ".png")
                out_path = os.path.join(OUTPUT_DIR, f"{stem}__{style}{ext}")
                with open(out_path, "wb") as f:
                    f.write(out_bytes)
                outs.append((style, os.path.relpath(out_path, HERE)))
                print("ok")
            except Exception as e:
                outs.append((style, None))
                print(f"FAILED: {e}")
            time.sleep(1)  # be gentle on rate limits
        rows.append((os.path.relpath(src, HERE), outs))

    sheet = build_contact_sheet(rows)
    print(f"\n✅ Done. Open the contact sheet:\n   open {sheet}\n")


if __name__ == "__main__":
    main()
