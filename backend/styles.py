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
    "realistically regal and Renaissance-inspired, painted as a GENUINE ANTIQUE OIL-ON-CANVAS by an old "
    "master. It must look like a REAL, centuries-old fine-art oil painting — authentic visible "
    "brushstrokes and impasto texture, subtle canvas weave and fine craquelure, rich layered glazes and "
    "aged varnish. Absolutely NOT digital, NOT a smooth 3D render, NOT a cartoon, NOT an illustration. "
    "Seat the pet naturally in an opulent classical setting: an ornate carved antique "
    "settee or grand armchair with rich damask upholstery, a draped burgundy velvet, a side table "
    "with antique leather-bound books, and an ornate urn of roses, with a soft atmospheric landscape "
    "behind. Warm aged-varnish palette, deep chiaroscuro lighting, visible oil brushwork; dignified, "
    "sophisticated and timeless. Preserve the pet's exact breed, coat colours, markings and expression "
    "so it is unmistakably the same pet; keep only its own natural collar and put no clothing on it. "
    "CRITICAL: the painting must be FULL BLEED and fill the entire image right to all four edges. Do NOT "
    "paint, draw, or include ANY picture frame, gilt frame, gold frame, ornate border, mat, canvas edge, "
    "or moulding around the artwork — output only the painting itself with no frame or border of any kind "
    "(the physical frame is added separately afterward). "
    "The SECOND image is ONLY an artistic style-and-setting reference: match its old-master painterly "
    "quality, warm palette and antique staging, but do NOT depict or include the animal from that "
    "reference image."
)

STYLES = {
    "monet": {
        "label": "Monet",
        "provider": "gemini",
        "prompt": _nano(
            "Render as a romantic Impressionist oil painting in the style of Claude Monet's garden scenes "
            "(like 'A Corner of the Garden with Dahlias', 1873). Keep the pet as the clear FOREGROUND "
            "subject, painterly yet unmistakably recognizable, nestled in a lush romantic garden. Paint the "
            "flowers the way MONET does them — NOT detailed or defined blooms, but a haze of many SMALL, "
            "LOOSE, ABSTRACT dabs and flecks of colour (reds, corals, oranges, golds, creams, touches of "
            "pink) suggested with quick broken impressionist brushstrokes, scattered through soft green "
            "foliage and dissolving into a pale luminous cloudy sky with dappled light. Loose visible "
            "painterly brushwork everywhere, soft diffused light, an airy blended palette. Completely "
            "REPLACE the photo background (no lawn, floor, furniture or room). FILL THE ENTIRE IMAGE edge "
            "to edge (full bleed) — no border, no vignette, no picture frame."
        ),
    },
    "oil": {
        "label": "Oil Painting",
        "provider": "gemini",
        "prompt": _nano(
            "Render as a classical fine-art oil painting of the pet with rich visible brushwork and warm, "
            "focused gallery lighting. IMPORTANT: completely REPLACE the original photo's background — do "
            "NOT keep the real-world setting (no grass, floor, furniture, sofa, or room). Set the pet "
            "against a deep, dark, near-black abstract studio backdrop with a subtle soft gradient, like a "
            "museum portrait."
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

# Physical frame options (the differentiator). The finished portrait is AI-mounted into the
# chosen frame as a wall mockup — matching how the storefront's product photos already look.
FRAMES = {
    "antique_gold": {
        "label": "Antique Gold",
        "prompt": "an ornate ANTIQUE GOLD picture frame with classic carved corner detailing",
    },
    "antique_silver": {
        "label": "Antique Silver",
        "prompt": "an ornate ANTIQUE SILVER picture frame with elegant carved detailing and a soft patina",
    },
    "gold_baroque": {
        "label": "Gold Baroque (Wide)",
        "prompt": "a wide, elaborate GOLD BAROQUE picture frame with bold, deeply carved ornamentation",
    },
}
