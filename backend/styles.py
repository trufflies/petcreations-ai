"""
Style catalog for Pet Creations AI.

Each style declares which model powers it and the prompt to use.
Prompt-tuning lives here — edit freely; generation.py reads this.
"""

# --- Nano Banana (Gemini) shared identity + composition wrappers ---
_NANO_IDENTITY = (
    "You are given a real photograph of one specific pet. Recreate THIS EXACT pet in the art style "
    "described below. Preserve the pet's identity precisely: the same species and breed, the exact "
    "coat/fur colors and patterns, the precise position and shape of every marking, the eye color, "
    "nose color, ear shape, and facial proportions. The owner must instantly recognize their own "
    "pet. Do not beautify or alter the animal's features. "
)
_NANO_COMPOSITION = (
    " Centered, well composed, crisp and high detail, print quality. Keep the anatomy natural and "
    "coherent. Absolutely no text, no lettering, no artist signature, no watermark, no borders, and "
    "no human hands in the frame."
)


def _nano(style_desc):
    return _NANO_IDENTITY + style_desc + _NANO_COMPOSITION


# --- Heritage (gpt-image-1) regal old-world prompt; also fed the reference painting as a style guide ---
_HERITAGE = (
    "Create a museum-quality old-world heirloom portrait of the pet shown in the FIRST image, "
    "realistically regal and Renaissance-inspired, painted as a genuine antique oil-on-canvas by an "
    "old master. Seat the pet naturally in an opulent classical setting: an ornate carved antique "
    "settee or grand armchair with rich damask upholstery, a draped burgundy velvet, a side table "
    "with antique leather-bound books, and an ornate urn of roses, with a soft atmospheric landscape "
    "behind. Warm aged-varnish palette, deep chiaroscuro lighting, visible oil brushwork; dignified, "
    "sophisticated and timeless. Preserve the pet's exact breed, coat colours, markings and expression "
    "so it is unmistakably the same pet; keep only its own natural collar and put no clothing on it. "
    "The SECOND image is ONLY an artistic style-and-setting reference: match its old-master painterly "
    "quality, warm palette and antique staging, but do NOT depict or include the animal from that "
    "reference image."
)

STYLES = {
    "watercolor": {
        "label": "Watercolor",
        "provider": "gemini",
        "prompt": _nano(
            "Render as a soft, elegant watercolor painting with gentle color washes, subtle paper "
            "texture, and delicate brush strokes. Light, airy background."
        ),
    },
    "oil": {
        "label": "Oil Painting",
        "provider": "gemini",
        "prompt": _nano(
            "Render as a classical fine-art oil painting with rich visible brushwork and warm gallery "
            "lighting, on a dark neutral studio background, like a museum pet portrait."
        ),
    },
    "heritage": {
        "label": "Heritage — Regal Heirloom",
        "provider": "openai",
        "prompt": _HERITAGE,
        "use_reference": True,
        "size": "1536x1024",
    },
}
