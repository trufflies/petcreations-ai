# Pet portrait likeness test

Goal of this step: prove that AI can turn a real pet photo into art that
**still obviously looks like that pet** — before we build any storefront around it.

## Quick start

1. **Get a free API key:** https://aistudio.google.com/apikey → "Create API key" → copy it.
2. **Open Terminal** and paste (once per terminal window):
   ```bash
   export GEMINI_API_KEY="paste-your-key-here"
   ```
3. **Add photos:** drop 3–5 pet photos into the `input/` folder. Use a realistic mix —
   different breeds, coat colors, and lighting, like real customer uploads.
4. **Run it:**
   ```bash
   cd ~/petcreations-ai/likeness-test
   python3 generate.py
   ```
5. **Look:** `open contact_sheet.html` — each row shows the original photo (green outline)
   next to every style. Ask one question per image: *is it obviously the same pet?*

Run just some styles:
```bash
python3 generate.py watercolor pop_art
```

## Styles included
`watercolor`, `oil_painting`, `heritage`  (heirloom old-master portrait)

## What to tune
All the prompt wording lives at the top of `generate.py` (`IDENTITY_RULES`, `STYLES`,
`COMPOSITION`). If a style drifts from the real pet, tighten the wording there and re-run.

## Cost
Each generation is roughly $0.04. A 5-photo × 5-style run ≈ $1.
