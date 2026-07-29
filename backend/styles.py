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

# --- Impasto oil (Game Day) -----------------------------------------------------------
# Reverse-engineered from frameandtail.com. Two things make it work and are easy to lose:
#   1. Describe the PHYSICS of thick paint (ridges standing proud, raking light, shadows in the
#      troughs) — saying "very thick impasto" only ever yields a flat painterly filter.
#   2. Scope the palette line to light/setting ONLY. Unscoped, it recolours props — an earlier
#      "fresh spring green" palette turned a soccer ball green.
# Deliberately calibrated: heavier strokes than this start smoothing flat-faced breeds, because
# big knife work fights the keep-the-face-readable instruction.
_IMPASTO = (
    "Render as a HEAVY IMPASTO OIL PAINTING — the defining feature is THICK, SCULPTURAL PAINT. "
    "Buttery oil colour is laid on in slabs with a palette knife and loaded brush, standing PROUD "
    "of the canvas surface in pronounced ridges, peaks and swirls. A raking side-light catches the "
    "top of every ridge and casts tiny real shadows in the troughs between strokes, so the surface "
    "is visibly THREE-DIMENSIONAL and you could feel it with your fingertips. Every stroke reads as "
    "a distinct, separate slab of pigment with crisp knife edges and trailing peaks where the knife "
    "lifted away. Thick textured paint everywhere — the coat, the clothing, the background, all of it. "
    "It must look like a REAL physical oil painting photographed in raking light: NOT photorealistic, "
    "NOT a smooth digital render, NOT airbrushed, NOT a cartoon, no clean outlines. "
    "Keep the eyes, nose and facial markings clearly readable even though the paint is thick. "
    "{SCENE} "
    "LIGHT AND MOOD (this describes the light and setting only — it must NOT recolour any clothing "
    "or props described above): {MOOD} "
    "Completely REPLACE the photo's background with the painted setting described, itself built "
    "from thick visible knife strokes. Fill the image edge to edge — no border, no frame, no vignette."
)

_PREPPY = ("high-key, light and preppy, bright airy daylight, cheerful and clean, built from soft "
           "powder blue, warm cream and chalky white.")


def _impasto(mood, scene=None):
    """Build an impasto prompt. Leave `scene` out for styles whose scene comes from a variant.

    Uses replace() rather than format() so the remaining {SCENE} placeholder survives for
    generation.style_prompt() to fill later.
    """
    p = _IMPASTO.replace("{MOOD}", mood)
    if scene is not None:
        p = p.replace("{SCENE}", scene)
    return _nano(p)

# Prop colours are stated emphatically here, not left to the palette — see note above.
SPORT_SCENES = {
    "tennis": {"label": "Tennis", "scene": (
        "Dress the pet in a crisp CREAM cable-knit tennis sweater with NAVY-and-RED striped V-neck trim "
        "over a WHITE collar, and give them a classic WARM-BROWN WOODEN tennis racket with natural cream "
        "strings. Behind them, a pale blue-grey court and a soft grey-green net.")},
    "pickleball": {"label": "Pickleball", "scene": (
        "Dress the pet in a soft SAGE-GREEN polo shirt with a WHITE collar, and give them a pickleball "
        "paddle with a NATURAL WOOD handle and a CREAM face, with a YELLOW pickleball beside them. "
        "Behind them, a pale sandy-blue court with soft white lines.")},
    "soccer": {"label": "Soccer", "scene": (
        "Dress the pet in a soft POWDER-BLUE soccer jersey with CREAM collar and trim, and place beside "
        "them a classic soccer ball that is WHITE with BLACK pentagon panels — the ball must be WHITE "
        "AND BLACK ONLY, never green or coloured. Behind them, a softly painted green grass pitch with "
        "a suggestion of white line markings.")},
    "baseball": {"label": "Baseball", "scene": (
        "Dress the pet in a CREAM baseball tee with soft NAVY raglan sleeves and a matching NAVY cap, "
        "with a WHITE baseball with RED stitching and a TAN leather glove beside them. Behind them, a "
        "softly painted sandy infield and pale green grass.")},
    "basketball": {"label": "Basketball", "scene": (
        "Dress the pet in a soft CORAL mesh basketball jersey with WHITE trim, and place beside them a "
        "classic ORANGE basketball with black seams. Behind them, a pale honey-toned wooden court with "
        "a hoop softly suggested in the distance.")},
    "football": {"label": "Football", "scene": (
        "Dress the pet in a soft BUTTER-CREAM football jersey with NAVY numerals and shoulder stripes, "
        "and place beside them a BROWN LEATHER football with WHITE laces. Behind them, a softly painted "
        "green field with pale white yard lines.")},
}

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
    "watercolor": {
        "label": "Watercolour",
        "provider": "gemini",
        "prompt": _nano(
            "Render as a delicate fine-art WATERCOLOUR portrait on bright white paper. Soft translucent "
            "washes with gentle wet-on-wet bleeds, visible pigment granulation and the faint blooms "
            "where wet colour meets wet colour. CRITICAL: the pet's face stays crisp and clearly "
            "readable — eyes, nose and markings sharply defined — while the body and outer edges soften "
            "and dissolve away into loose brushwork and generous CLEAN WHITE SPACE. Use a natural, "
            "true-to-life palette drawn from the pet's own colouring, with soft grey-blue shadows. "
            "Delicate, airy, refined and quiet. Completely REPLACE the photo's background with clean "
            "white paper and only the faintest suggestion of a wash beneath the pet. "
            "No hard outlines, no cartoon linework, no heavy black, no frame, no border. "
            "Unlike the other styles this one KEEPS its white paper — the white space is the point."
        ),
    },
    "sport": {
        "label": "Game Day",
        "provider": "gemini",
        "prompt": _impasto(_PREPPY),        # keeps {SCENE}; filled from the chosen sport
        "variants": SPORT_SCENES,
        "default_variant": "tennis",
    },
    "beach": {
        "label": "Beach Day",
        "provider": "gemini",
        "prompt": _impasto(
            "sun-bleached coastal daylight, breezy and bright, built from pale sky blue, sea-glass "
            "green, warm sand and chalky white, with the light coming low and golden off the water.",
            "Place the pet on a wide sandy beach at the water's edge, sitting or standing happily in "
            "the open, with gentle turquoise surf breaking behind them, damp sand catching the light, "
            "and a soft band of dune grass and open sky beyond. No people, no umbrellas, no clutter.",
        ),
    },
    "wildflower": {
        "label": "Wildflower",
        "provider": "gemini",
        "prompt": _impasto(
            "soft faded vintage light, gently sun-washed as though the paint has aged a little — "
            "dusty sage, muted ochre, faded rose and warm cream, low afternoon sun, nostalgic and quiet.",
            "Place the pet in a summer meadow of tall wildflowers up around them — loose dabbed heads "
            "of poppy, cornflower, daisy and grass seed suggested with quick knife strokes rather than "
            "drawn in detail — with a hazy treeline far behind and long grass catching the light.",
        ),
    },
    "fancy": {
        "label": "Fine Dining",
        "provider": "gemini",
        "prompt": _impasto(
            "warm candlelit restaurant glow against a soft dusky-rose wall, intimate and elegant, "
            "built from blush, warm cream, soft gold and deep wine red.",
            "Seat the pet upright at a small white-linen restaurant table as though dining, with a "
            "beautifully plated STEAK on a white plate before them and a glass of DEEP RED WINE beside "
            "it — the wine must be deep red and the steak rich brown. Add a small folded napkin and "
            "polished cutlery. The pet looks pleased with itself, entirely at home.",
        ),
    },
    "bright": {
        "label": "Bold Colour",
        "provider": "gemini",
        "prompt": _impasto(
            "bold, saturated and contemporary — strong colour against a dark ground, gallery lighting, "
            "confident and modern rather than soft or pretty.",
        ),                                   # keeps {SCENE}; filled from the chosen palette
        "variants": None,                    # set below (needs BRIGHT_PALETTES defined first)
        "default_variant": "sunset",
    },
}

# Bold Colour: the variant chooses the palette. Each scene repeats the treatment so a palette can be
# swapped without the abstract description drifting.
_BOLD_TREATMENT = (
    "Render the pet as a striking modern portrait: the face and eyes painted richly and accurately so "
    "the pet is unmistakable, while the coat, edges and background dissolve into sweeping knife strokes, "
    "drips, runs and splatters of intense colour that break away from the silhouette. "
)
BRIGHT_PALETTES = {
    "sunset":  {"label": "Sunset",  "scene": _BOLD_TREATMENT + "PALETTE: blazing tangerine, hot pink and deep plum against near-black."},
    "electric": {"label": "Electric", "scene": _BOLD_TREATMENT + "PALETTE: electric teal, cobalt blue and acid lime against near-black."},
    "magenta": {"label": "Magenta", "scene": _BOLD_TREATMENT + "PALETTE: vivid magenta, coral and warm gold against deep charcoal."},
    "citrus":  {"label": "Citrus",  "scene": _BOLD_TREATMENT + "PALETTE: bright lemon yellow, orange and turquoise against deep ink blue."},
    "jewel":   {"label": "Jewel",   "scene": _BOLD_TREATMENT + "PALETTE: emerald green, sapphire blue and rich amethyst against near-black."},
    "flame":   {"label": "Flame",   "scene": _BOLD_TREATMENT + "PALETTE: scarlet red, molten orange and gold against deep charcoal."},
}
STYLES["bright"]["variants"] = BRIGHT_PALETTES

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
