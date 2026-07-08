"""Preview watermarking — tiled diagonal text so pre-purchase previews can't be lifted."""

from io import BytesIO
from PIL import Image, ImageDraw, ImageFont

_FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
]


def _font(size):
    for path in _FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size=size)
        except Exception:
            continue
    return ImageFont.load_default()


def add_watermark(image_bytes, text="PET CREATIONS  •  PREVIEW"):
    base = Image.open(BytesIO(image_bytes)).convert("RGBA")
    w, h = base.size
    diag = int((w ** 2 + h ** 2) ** 0.5)

    layer = Image.new("RGBA", (diag, diag), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    font = _font(max(16, w // 30))
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    step_x, step_y = tw + 70, th + 130

    for y in range(0, diag, step_y):
        for x in range(0, diag, step_x):
            draw.text((x, y), text, font=font, fill=(255, 255, 255, 70))

    layer = layer.rotate(30, expand=False)
    left, top = (diag - w) // 2, (diag - h) // 2
    layer = layer.crop((left, top, left + w, top + h))

    out = Image.alpha_composite(base, layer).convert("RGB")
    buf = BytesIO()
    out.save(buf, format="PNG")
    return buf.getvalue()
