"""
Typeset text onto generated artwork (memorial lines, definition prints).

Text is composited here with Pillow rather than asked of the image model. Models misspell
names constantly, and a misspelled dead pet's name is the worst failure this product has.
Doing it in code gives correct spelling, real typography and exact positioning, for free
and instantly — and lets the customer approve the wording before anything is rendered.

Public API:
    compose(art_bytes, layout, **fields) -> PNG bytes
      layout="memorial"    fields: name, dates (optional), heading (optional)
      layout="definition"  fields: name, phonetic, part_of_speech, body

Fonts are bundled in assets/fonts (SIL OFL, redistributable) — the server has no system
fonts worth relying on.
"""

import os
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(HERE, "assets", "fonts")
SERIF = os.path.join(FONT_DIR, "PlayfairDisplay[wght].ttf")
SANS = os.path.join(FONT_DIR, "Lato-Regular.ttf")

# Landscape 4:3, matching every canvas size sold (24x18, 32x24, 40x30).
CANVAS_W, CANVAS_H = 2400, 1800
PAPER = (253, 251, 247)      # warm white, so it doesn't glare against the art
INK = (43, 33, 28)
MUTED = (122, 110, 96)
RULE = (214, 202, 182)

_font_cache = {}


def _font(path, size, weight=None):
    key = (path, size, weight)
    if key not in _font_cache:
        f = ImageFont.truetype(path, size)
        if weight:
            try:
                f.set_variation_by_name(weight)
            except Exception:
                pass          # static font, or this axis isn't available
        _font_cache[key] = f
    return _font_cache[key]


def _width(draw, text, font, tracking=0):
    w = draw.textlength(text, font=font)
    return w + tracking * max(0, len(text) - 1)


def _draw_tracked(draw, x, y, text, font, fill, tracking=0, anchor_x="center"):
    """Draw text with letter spacing. Pillow has no tracking, so advance per character."""
    total = _width(draw, text, font, tracking)
    if anchor_x == "center":
        x -= total / 2
    elif anchor_x == "right":
        x -= total
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill, anchor="ls")
        x += draw.textlength(ch, font=font) + tracking
    return total


def _wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=font) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def _cover(im, box_w, box_h, top_bias=0.12):
    """Crop to fill the box, biased upward so faces survive a landscape crop."""
    src, box = im.width / im.height, box_w / box_h
    if src > box:
        nw = int(im.height * box)
        im = im.crop(((im.width - nw) // 2, 0, (im.width - nw) // 2 + nw, im.height))
    else:
        nh = int(im.width / box)
        top = int((im.height - nh) * top_bias)
        im = im.crop((0, top, im.width, top + nh))
    return im.resize((box_w, box_h), Image.LANCZOS)


def _open(art_bytes):
    return Image.open(BytesIO(art_bytes)).convert("RGB")


# ----------------------------------------------------------------- layouts
def _memorial(art, name, dates="", heading="IN LOVING MEMORY"):
    """Art above, a quiet typeset band beneath. Deliberately restrained."""
    canvas = Image.new("RGB", (CANVAS_W, CANVAS_H), PAPER)
    d = ImageDraw.Draw(canvas)
    art_h = int(CANVAS_H * 0.74)
    pad = int(CANVAS_W * 0.055)
    canvas.paste(_cover(art, CANVAS_W - pad * 2, art_h - pad), (pad, pad))

    cx = CANVAS_W // 2
    y = art_h + int(CANVAS_H * 0.055)
    if heading:
        f = _font(SANS, 40)
        _draw_tracked(d, cx, y, heading.upper(), f, MUTED, tracking=13)
        y += 58

    f = _font(SERIF, 130, "SemiBold")
    _draw_tracked(d, cx, y + 84, name.upper(), f, INK, tracking=8)
    y += 128

    if dates:
        w = int(CANVAS_W * 0.10)
        d.line([(cx - w, y + 46), (cx + w, y + 46)], fill=RULE, width=3)
        f = _font(SANS, 44)
        _draw_tracked(d, cx, y + 128, dates, f, MUTED, tracking=6)
    return canvas


def _definition(art, name, phonetic="", part_of_speech="noun", body=""):
    """Dictionary-entry print: art above, entry beneath."""
    canvas = Image.new("RGB", (CANVAS_W, CANVAS_H), PAPER)
    d = ImageDraw.Draw(canvas)
    # 0.58 left the art in a ~2:1 letterbox, which beheads a seated pet. 0.70 gives roughly 16:9
    # and still leaves room for the entry beneath.
    art_h = int(CANVAS_H * 0.70)
    pad = int(CANVAS_W * 0.055)
    canvas.paste(_cover(art, CANVAS_W - pad * 2, art_h - pad), (pad, pad))

    cx = CANVAS_W // 2
    y = art_h + int(CANVAS_H * 0.035)

    f = _font(SERIF, 118, "Bold")
    _draw_tracked(d, cx, y + 80, name.lower(), f, INK, tracking=4)
    y += 108

    bits = []
    if phonetic:
        bits.append("[ %s ]" % phonetic.strip("[]").strip())
    if part_of_speech:
        bits.append(part_of_speech)
    if bits:
        fi = _font(SERIF, 40, "Regular")
        _draw_tracked(d, cx, y + 54, "   ".join(bits), fi, MUTED, tracking=3)
        y += 50

    d.line([(cx - int(CANVAS_W * 0.06), y + 46), (cx + int(CANVAS_W * 0.06), y + 46)],
           fill=RULE, width=3)
    y += 30

    if body:
        fb = _font(SANS, 44)
        max_w = int(CANVAS_W * 0.70)
        lines = _wrap(d, body.strip(), fb, max_w)[:3]     # three lines keeps it a caption
        for ln in lines:
            y += 58
            _draw_tracked(d, cx, y, ln, fb, INK, tracking=0)
    return canvas


LAYOUTS = {"memorial": _memorial, "definition": _definition}


def compose(art_bytes, layout, **fields):
    fn = LAYOUTS.get(layout)
    if not fn:
        raise ValueError("unknown layout %r; options: %s" % (layout, list(LAYOUTS)))
    fields = {k: v for k, v in fields.items() if v is not None}
    out = BytesIO()
    fn(_open(art_bytes), **fields).save(out, format="PNG")
    return out.getvalue()
