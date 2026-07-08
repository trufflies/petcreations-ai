#!/usr/bin/env python3
"""
Heritage via gpt-image-1 — regal/Renaissance old-world heirloom portrait, using the user's
reference painting as a STYLE + SETTING guide (not as the subject).

Two images go to gpt-image-1's edit endpoint:
  1. the pet photo (./input)      -> the dog to paint
  2. the reference (./reference)  -> style / setting / palette guide ONLY

Run all:     python3 heritage_openai.py
Run subset:  python3 heritage_openai.py dog3 dog4
Open result: open compare.html
"""

import base64
import json
import os
import sys
import urllib.request
import urllib.error

MODEL = "gpt-image-1"
URL = "https://api.openai.com/v1/images/edits"
SIZE = "1536x1024"     # landscape, to fit the full antique scene (like the reference)
QUALITY = "high"       # high ≈ $0.25/img at this size; medium ≈ $0.06

HERE = os.path.dirname(os.path.abspath(__file__))
INPUT_DIR = os.path.join(HERE, "input")
REF_DIR = os.path.join(HERE, "reference")
OUT_DIR = os.path.join(HERE, "output_openai")
NANO_DIR = os.path.join(HERE, "output")

IMAGE_EXTS = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}

PROMPT = (
    "Create a museum-quality old-world heirloom portrait of the dog shown in the FIRST image, "
    "realistically regal and Renaissance-inspired, painted as a genuine antique oil-on-canvas by an "
    "old master. Seat the dog naturally in an opulent classical setting: an ornate carved antique "
    "settee or grand armchair with rich damask upholstery, a draped burgundy velvet, a side table "
    "with antique leather-bound books, and an ornate urn of roses, with a soft atmospheric landscape "
    "behind. Warm aged-varnish palette, deep chiaroscuro lighting, visible oil brushwork; dignified, "
    "sophisticated and timeless. Preserve the dog's exact breed, coat colours, markings and expression "
    "so it is unmistakably the same dog; keep only the dog's own natural collar and put no clothing on "
    "it. The SECOND image is ONLY an artistic style-and-setting reference: match its old-master "
    "painterly quality, warm palette and antique staging, but do NOT depict or include the dog from "
    "that reference image."
)


def die(m):
    print("\n❌ " + m + "\n")
    sys.exit(1)


def load_env():
    for fn in (".env", "api.env.md"):
        p = os.path.join(HERE, fn)
        if os.path.isfile(p):
            for line in open(p):
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def find_reference():
    if not os.path.isdir(REF_DIR):
        return None
    for name in sorted(os.listdir(REF_DIR)):
        if os.path.splitext(name)[1].lower() in IMAGE_EXTS:
            return os.path.join(REF_DIR, name)
    return None


def read_image(path):
    with open(path, "rb") as f:
        return (os.path.basename(path), f.read(), IMAGE_EXTS[os.path.splitext(path)[1].lower()])


def multipart(fields, images, image_field):
    boundary = "----petcreationsheritageboundary7f3a2b"
    parts = []
    for name, val in fields.items():
        parts += [f"--{boundary}".encode(),
                  f'Content-Disposition: form-data; name="{name}"'.encode(), b"", str(val).encode()]
    for (filename, content, ctype) in images:
        parts += [f"--{boundary}".encode(),
                  f'Content-Disposition: form-data; name="{image_field}"; filename="{filename}"'.encode(),
                  f"Content-Type: {ctype}".encode(), b"", content]
    parts += [f"--{boundary}--".encode(), b""]
    return b"\r\n".join(parts), boundary


def call_openai(api_key, images):
    image_field = "image[]" if len(images) > 1 else "image"
    fields = {"model": MODEL, "prompt": PROMPT, "size": SIZE, "quality": QUALITY, "n": 1}
    body, boundary = multipart(fields, images, image_field)
    req = urllib.request.Request(URL, data=body, headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    })
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode(errors='replace')[:400]}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Network error: {e.reason}")
    return base64.b64decode(data["data"][0]["b64_json"])


def build_compare(rows):
    cells = []
    for stem, src, nano, oai in rows:
        def fig(path, label, cls=""):
            if path and os.path.isfile(os.path.join(HERE, path)):
                return f'<figure class="{cls}"><img src="{path}"><figcaption>{label}</figcaption></figure>'
            return f'<figure class="{cls} fail"><div>missing</div><figcaption>{label}</figcaption></figure>'
        cells.append(
            f'<section><h3>{stem}</h3><div class="grid">'
            + fig(src, "original", "orig")
            + fig(nano, "Nano Banana")
            + fig(oai, "gpt-image-1 (regal v2)")
            + "</div></section>"
        )
    html = f"""<!doctype html><meta charset="utf-8"><title>Heritage A/B</title>
<style>
 body{{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:24px;background:#faf9f7;color:#222}}
 h1{{font-size:20px}} h3{{margin:0 0 8px;color:#666;font-size:13px}}
 section{{border-top:1px solid #e5e2dc;padding:16px 0}}
 .grid{{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}}
 figure{{margin:0;width:340px}}
 figure img{{width:340px;height:255px;object-fit:cover;border-radius:10px;box-shadow:0 1px 5px rgba(0,0,0,.14)}}
 figure.orig img{{outline:3px solid #2b7;outline-offset:2px}}
 figcaption{{font-size:12px;text-align:center;color:#555;margin-top:6px}}
 figure.fail div{{width:340px;height:255px;border-radius:10px;background:#fee;color:#a00;
   display:flex;align-items:center;justify-content:center}}
</style>
<h1>Heritage style &mdash; regal old-world (gpt-image-1) vs Nano Banana</h1>
<p>Green = original. Right column is the new regal/Renaissance scene guided by your reference painting.</p>
{''.join(cells)}
"""
    path = os.path.join(HERE, "compare.html")
    with open(path, "w") as f:
        f.write(html)
    return path


def main():
    load_env()
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        die("OPENAI_API_KEY not set (add it to api.env.md).")

    ref = find_reference()
    print("style reference:", os.path.basename(ref) if ref else "(none — text-only prompt)")
    ref_img = read_image(ref) if ref else None

    wanted = set(sys.argv[1:])
    inputs = [f for f in sorted(os.listdir(INPUT_DIR))
              if os.path.splitext(f)[1].lower() in IMAGE_EXTS
              and (not wanted or os.path.splitext(f)[0] in wanted)]
    if not inputs:
        die("No matching photos in ./input")

    os.makedirs(OUT_DIR, exist_ok=True)
    per = 0.25 if QUALITY == "high" else 0.06
    print(f"\n{len(inputs)} image(s) via {MODEL} ({QUALITY} {SIZE}) ~${len(inputs) * per:.2f}\n")

    rows = []
    for i, name in enumerate(inputs, 1):
        stem = os.path.splitext(name)[0]
        print(f"[{i}/{len(inputs)}] {stem} -> heritage regal v2 ...", end=" ", flush=True)
        oai_rel = None
        try:
            pet = read_image(os.path.join(INPUT_DIR, name))
            imgs = [pet] + ([ref_img] if ref_img else [])
            out = call_openai(key, imgs)
            op = os.path.join(OUT_DIR, f"{stem}__heritage.png")
            with open(op, "wb") as f:
                f.write(out)
            oai_rel = os.path.relpath(op, HERE)
            print("ok")
        except Exception as e:
            print(f"FAILED: {e}")
        nano_rel = os.path.relpath(os.path.join(NANO_DIR, f"{stem}__heritage.png"), HERE)
        rows.append((stem, os.path.relpath(os.path.join(INPUT_DIR, name), HERE), nano_rel, oai_rel))

    page = build_compare(rows)
    print(f"\n✅ Done. Compare:\n   open {page}\n")


if __name__ == "__main__":
    main()
