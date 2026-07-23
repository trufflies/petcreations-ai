"""
Haus of Lumen mockup scenes for the Listing Studio.

Each scene is a gpt-image-1 (images.edit) prompt that places the uploaded artwork into a
photorealistic setting, in a slim OAK FLOATING frame. generation.mockup() runs them.
Order here is the order the studio page renders them.
"""

FRAME = ("a slim, modern OAK floating frame — a thin, flat, square-edged warm honey-oak wood border "
         "with shallow depth, sitting just outside the gallery-wrapped canvas with a small shadow gap "
         "so the canvas appears to float inside it; minimal and contemporary, NEVER ornate, carved, "
         "beveled, gilded, gold-leaf, or a traditional molding")

FAITHFUL = ("Reproduce the provided artwork EXACTLY — identical scene, composition, brushwork and "
            "colors; do not repaint, restyle, crop, or alter the art itself. ")

STYLE = ("Warm Studio McGee / Pottery Barn styling, moody vintage feel, soft natural daylight, "
         "editorial interior-photography quality with realistic shadows, correct scale and canvas texture.")

SCENES = {
    "dining": {"label": "Dining room", "size": "1536x1024", "prompt":
        FAITHFUL + "Present it as a large gallery-wrapped canvas in " + FRAME + ", centered on a warm "
        "white plaster wall in a dining room: rustic light-oak trestle table, black Windsor spindle "
        "chairs, an aged-brass candelabra chandelier hanging in front of the art, jute rug, linen drapes "
        "by a window, an arched niche with stoneware. Straight-on, eye level. " + STYLE},

    "living_front": {"label": "Living room (front)", "size": "1536x1024", "prompt":
        FAITHFUL + "Present it as a large gallery-wrapped canvas in " + FRAME + ", centered above a "
        "slipcovered cream linen sofa in a living room: neutral and olive throw pillows, an olive tree in "
        "a woven basket to one side, a ceramic table lamp, a reclaimed-wood coffee table with stacked "
        "design books and a wooden bowl. Straight-on, elevated and collected. " + STYLE},

    "living_angled": {"label": "Living room (angled)", "size": "1536x1024", "prompt":
        FAITHFUL + "Present it as a large gallery-wrapped canvas in " + FRAME + ", on a warm white wall "
        "above a cream linen sofa, shot from a 3/4 side angle so the frame's depth catches the light; an "
        "arched opening with styled wood shelving to one side, a ceramic lamp and soft greenery. " + STYLE},

    "corner": {"label": "Corner close-up", "size": "1536x1024", "prompt":
        FAITHFUL + "Extreme close-up of the bottom-right CORNER of the piece in " + FRAME + ", angled to "
        "reveal the oak wood grain and square profile, the small floating gap between canvas and frame, "
        "and the heavy oil-painting canvas texture of the art. Soft directional daylight, shallow depth "
        "of field, warm neutral wall behind. " + STYLE},

    "details": {"label": "Details graphic", "size": "1536x1024", "prompt":
        FAITHFUL + "Create a clean, elegant product DETAILS information graphic on a soft cream "
        "background. Left half: the artwork as a large gallery-wrapped canvas in " + FRAME + " leaning on "
        "a wood shelf with a ceramic vase. Right half: a neat 2x2 grid of tight close-up crops (the "
        "canvas weave, the oak frame corner, the gallery-wrapped edge, and a sky detail of the art). A "
        "slim serif heading reading 'DETAILS' at the top, with small tidy captions 'PREMIUM CANVAS "
        "PRINT', 'SOLID WOOD FRAME', 'GALLERY-WRAPPED CANVAS', and 'FADE-RESISTANT INKS'. Minimal, "
        "refined, neutral palette, plenty of whitespace. " + STYLE},
}

ORDER = ["dining", "living_front", "living_angled", "corner", "details"]
