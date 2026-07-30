# Pet Creations AI — Handoff & Operating Guide

You are helping run the AI pet-portrait generator behind **petcreationsart.com**. This
document is everything you need to work on it. Read it fully before making changes. When in
doubt, **measure the live site rather than assume** — most of the hard bugs in this system's
history came from testing in an environment that didn't match production.

---

## 1. What this is

A customer uploads a photo of their pet on a Shopify product page, picks an art style, and
gets a painted preview in ~60 seconds. They can tweak it, pick a size and frame, and add it to
cart. Printing/fulfilment happens off-platform (hand-stretched canvas, Florida).

Two pieces:

1. **Backend** — a FastAPI app (Python, zero framework magic, `urllib` for HTTP) hosted on
   **Render** at `https://petcreations-ai.onrender.com`. It calls image models, watermarks
   previews, composes typeset text, and serves an embeddable widget.
2. **Widget** — a single self-contained vanilla-JS file, `backend/static/widget.js`, embedded
   into Shopify product pages via a `<script>` tag. No build step. It IS the storefront UI.

**Repo:** `https://github.com/trufflies/petcreations-ai.git` (branch `main`).
**Render auto-deploys** on push to `main` (~60–105s). There is a GitHub App installed on the
repo — that is what makes auto-deploy work; do not go looking in repo webhooks.

Image models:
- **Gemini 2.5 Flash Image** ("Nano Banana"), ~$0.04/render — runs **11 of 12 styles**.
- **OpenAI gpt-image-1** — runs **Heritage only** (uses a style reference image + is the one
  style that survived a Gemini outage because it's on a different provider).
- **Claude (Opus)** — writes the dictionary entry for the Definition Print (text only, not images).

---

## 2. The golden rules (read these first)

1. **Deploy = commit + push to `main`.** Then wait for Render and **verify the live commit**:
   ```bash
   curl -s https://petcreations-ai.onrender.com/health | python3 -c "import json,sys;print(json.load(sys.stdin)['commit'])"
   ```
   Compare to `git rev-parse --short HEAD`. Do not claim something is live until these match.

2. **Shopify edge-caches product HTML.** A `Cache-Control: no-cache` request header does NOT
   bust it. Only a unique query string does. **Always verify storefront changes with
   `?cb=$RANDOM`** and, on the widget file, `?cb=` too. Two reads seconds apart can otherwise
   disagree and send you chasing phantoms.

3. **The theme editor's preview pane does NOT re-render embed/HTML blocks.** After editing an
   embed it keeps showing the old content. Judge only by a cache-busted fetch of the live page,
   ideally in a private window.

4. **Never show customers raw upstream errors.** Model/billing errors get logged server-side
   and the customer sees a friendly message. Keep it that way.

5. **A cosmetic extra must never take down the generator.** Guard optional DOM against null;
   wrap post-generation processing so a failure returns a clear message, not a bare 500.

6. **Match the surrounding code style.** The widget is deliberately ES5 (no arrow functions, no
   template literals, no spread) so it runs everywhere. `styles.py`/`app.py` are plain,
   dependency-light Python. Don't introduce a framework or a build step.

---

## 3. Backend files (`backend/`)

| File | What it does |
|---|---|
| `app.py` | FastAPI app: all endpoints, `_save` (writes preview/full/original + composes text), lead logging, stats/gallery/leads HTML pages. |
| `generation.py` | The image engine. `generate(style, bytes, mime, variant)` routes to Gemini or OpenAI. Also `recolor` (retries/tweaks), `frame`, `mockup`, `_prep_image` (normalises uploads to clean RGB PNG), `_tone_lift` (Heritage brightening), Gemini retry/billing handling. |
| `styles.py` | `STYLES` dict (one entry per art style) and `FRAMES`. This is where art styles are defined. |
| `textart.py` | Typesets text onto art with Pillow — memorial line and dictionary-definition layouts. Fonts bundled under `assets/fonts` (SIL OFL). |
| `defcopy.py` | Calls Claude (Opus) to write the Definition Print's dictionary entry from questionnaire answers. The pet's **name never goes to the model** — it's typeset verbatim to avoid misspelling. |
| `email_send.py` | Sends the preview email via Resend. No-op until `RESEND_API_KEY` set; never raises into a request. |
| `omnisend_send.py` | Pushes the lead into Omnisend. No-op until `OMNISEND_API_KEY` set; never raises. **Currently the owner turned email automations off and is handing them to someone else — check before assuming emails send.** |
| `listing.py`, `mockups.py` | Support tools (SEO listing copy, room mockups) — used by the Haus of Lumen side / occasional utilities, not the core preview flow. |
| `watermark.py` | Adds the "PET CREATIONS · PREVIEW" watermark to preview images. Full-res is clean. |

`backend/static/widget.js` — the storefront widget (see §7).

---

## 4. Endpoints (all under `https://petcreations-ai.onrender.com`)

| Method / path | Purpose |
|---|---|
| `POST /generate` | Main: multipart `{file, style, email, variant?, text_*}` → `{id, preview_url, full_url, ...}` |
| `POST /retry` | Apply a tweak/recolor to an existing render (`{id, instruction}`) |
| `POST /frame` | Mount a render inside a physical frame mockup |
| `POST /definition-copy` | Draft the dictionary entry (`{name, quirk, greeting?, obsession?}`) — Claude |
| `GET /health` | Status + **live git commit** + styles/frames + disk usage. Your deploy-verify endpoint. |
| `GET /gallery` | **Owner view:** every watermarked preview, newest first (cap 400). Unlisted. |
| `GET /leads` | **Owner view:** each email + the previews they generated, newest person first. Unlisted, shows customer emails — treat as private. |
| `GET /stats` and `/stats.json` | **Owner view:** daily preview-session counts (US-Eastern buckets). |
| `POST /listing`, `/mockup`, `/bundle` | Utility endpoints (listing copy, mockups) — not part of the customer flow. |

---

## 5. Environment variables (set in Render → your service → Environment)

| Var | Needed for |
|---|---|
| `GEMINI_API_KEY` | **Critical** — 11 of 12 styles. Prepay credits; **stops dead at $0** (see §10). The key must belong to the *same Google AI Studio project* that has the credits. |
| `OPENAI_API_KEY` | Heritage style + any gpt-image-1 use. |
| `ANTHROPIC_API_KEY` | The Definition Print's written entry (Opus). ~half a cent each. |
| `GEN_DIR` | Path to the mounted Render disk (e.g. `/data`) so generated art survives restarts. `/health` shows `persistent_storage: true` when set. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Preview emails (currently being handed off — may be intentionally unset). |
| `OMNISEND_API_KEY`, `OMNISEND_TAG`, `OMNISEND_STATUS` | Lead capture into Omnisend. |
| `PRODUCT_URL` / `PUBLIC_BASE_URL` | Links in emails. |
| `LISTING_MODEL` | Model for the listing utility. |
| `RENDER_GIT_COMMIT` | Set automatically by Render — powers `/health`'s commit field. |

---

## 6. ⭐ Adding a new STYLE PRODUCT PAGE (the JSON / template / embed flow)

This is the most common task. Every art style is its **own Shopify product**, all running the
same widget, differentiated only by data attributes on the embed. Getting this wrong has cost
hours; follow it exactly.

**The mental model:** one Shopify product → one theme template (`product.<name>.json`) → one
"Embed code" block inside that template. The embed's `data-style` decides which art style the
widget locks to.

### The embed code

```html
<div id="pcai-root" data-style="STYLECODE"
     data-title="Custom XYZ Pet Portrait" data-eyebrow="Some Eyebrow Text"></div>
<script src="https://petcreations-ai.onrender.com/app/widget.js"></script>
```

- `data-style` — the style code (see §8 for the list). **Omit it** and you get the *combined*
  picker (that's the Heritage/original page). A comma list (`monet,watercolor`) shares a page.
- `data-title` / `data-eyebrow` — page heading text.
- Optional: `data-digital-variant="<shopify variant id>"`, `data-digital-price="15"` (the
  digital-download upsell — must change both together), `data-also-collection="best-sellers-1"`
  (the "you may also like" source collection).

### The exact steps (all five, or it silently fails)

1. **Duplicate an existing product** in Shopify admin (carries the 12 size×frame variants). Rename
   it and **clean the URL handle**.
2. **Online Store → Themes → (Heritage Draft, the active theme) → ⋯ → Edit code.**
3. **Templates → Add a new template →** type `product`, name it (e.g. `definition`). This
   creates `templates/product.<name>.json`.
4. Open an existing working template (e.g. `product.heritage.json` or `product.monet.json`),
   **copy its entire contents, paste over the new template**, Save. (Copying an existing one
   means you only change two attribute values, not rebuild the block.)
5. **Products → your product → Theme template (right sidebar) → pick the new template → Save the
   product.** ← easy to forget; without it the product uses the wrong template.
6. **Themes → Customize → (top-centre product picker) select your product → click the "Embed
   code" block → set `data-style`/`data-title`/`data-eyebrow` for this style → Save** (top-right,
   greys out when clean).

### The five gotchas (each cost real time)

1. **⚠️ TEMPLATES ARE SHARED.** One template assigned to 8 products = one embed = every page
   shows the same style. Every style page once served `bright` because they shared one template.
   **One template per product, always.**
2. **⚠️ CACHE.** Verify with `?cb=$RANDOM`, not the preview pane (see §2).
3. **Two separate Saves** — the theme-editor Save AND the product-page Save after changing the
   Theme template. Missing either looks identical to "it didn't work".
4. **Check the pairing, not just the file.** A page showing another style's title usually means
   the product is assigned to the wrong template, or the embed's `data-style` is wrong.
5. **Don't paste the comment lines.** When given an embed with a `<!-- while previewing … -->`
   label, paste only the `<div>` and `<script>` — a stray comment fragment at the top of the box
   breaks it.

### Verify a set of pages at once

```bash
r=$RANDOM; for h in custom-heritage-framed-pet-portrait-draft custom-game-day-pet-portrait \
  custom-museum-oil-painting-pet-portrait custom-monet-style-pet-portrait; do
  curl -sL "https://petcreationsart.com/products/$h?cb=$r" -o /tmp/p.html
  echo "$h $(grep -o 'data-style=\"[^\"]*\"' /tmp/p.html | head -1) roots=$(grep -c 'id=\"pcai-root\"' /tmp/p.html)"
done
```
`roots` must be exactly **1** — two `#pcai-root` divs and the widget mounts into the wrong one.
`data-style` and the visible product title must always agree.

---

## 7. How the widget works (`backend/static/widget.js`)

One IIFE, ES5, injects its own `<style>` and markup into `#pcai-root`. Reads config from
`data-*` attributes on that div.

Key internals (search these names in the file):
- `STYLES` — the array of style cards (code, label, sub, examples, `soloOnly`, `variants`,
  `memorial`/`definition` flags, `vlabel`). **Mirrors `styles.py` but is a separate list** — add
  a new style in BOTH places.
- `VARIANT_SETS = { sports, palettes, backdrops }` — a style's `variants` field is a **string
  key** into this, not an inline array. (Sport = sports, Bold Color = palettes, Definition =
  backdrops.)
- `VAR` map + `loadLiveVariants()` — variant→Shopify-variant-ID+price mapping. Loaded live from
  `/products/<handle>.js` at runtime with a safety guard: if it can't find ≥3 variants it refuses
  to add to cart rather than sell the wrong product.
- `SIZE_BY_DIMS` / `frameCode()` — variant matching is by **dimensions parsed from the option
  text** (`24x18`, `24x18 inches`, `40×30` all work), not exact string match — because product
  option text drifts between duplicated products.
- `FRAMES` — Unframed / Antique Gold / Antique Silver / Baroque Gold, each with `cut` geometry
  (where the art sits inside the frame image) so previews composite correctly.
- `renderMini()` — the mobile sticky preview (fixed full-width bar at the bottom; reparented to
  `<body>` so nothing clips it; shows the framed art and reacts to size/frame changes).
- `renderAlsoLike()` — the "you may also like" carousel (reads the best-sellers collection JSON).
- Memorial/Definition text: extra fields sent as `text_*` form params and as cart line-item
  properties.

**Frames/sizes are the same across all products** (12 variants: 3 sizes × 4 frames). Prices and
compare-at live in Shopify per product; keep every variant at a consistent SAVE% (they use 20%).

---

## 8. The 12 art styles (`styles.py` + widget `STYLES`)

| Code | Product / label | Provider | Variants | Notes |
|---|---|---|---|---|
| `heritage` | Custom Heritage | OpenAI | — | Uses `assets/heritage_reference.png`; `lift:0.82` (model runs dark). The combined-picker page omits `data-style`. |
| `oil` | Museum Oil | Gemini | — | |
| `monet` | Monet Style | Gemini | — | |
| `watercolor` | Watercolor | Gemini | — | Offers the **memorial** text line (`memorial:true`). |
| `sport` | Game Day | Gemini | `sports` (6) | tennis/pickleball/soccer/baseball/basketball/football. `soloOnly`. |
| `sitting` | Sitting Pretty | Gemini | — | |
| `cartoon` | Cartoon | Gemini | — | |
| `definition` | Definition Print | Gemini | `backdrops` (6) | sage/blush/sky/cream/clay/charcoal. `layout:definition` (typeset entry). `soloOnly`. |
| `beach` | Beach | Gemini | — | |
| `wildflower` | Wildflower | Gemini | — | Composition pulled back (pet within the meadow). |
| `fancy` | Fine Dining | Gemini | — | |
| `bright` | Bold Color | Gemini | `palettes` (6) | sunset/electric/magenta/citrus/jewel/flame. `soloOnly`. |

`soloOnly` = the style only appears on its own dedicated page, never in the combined grid.

### Adding a brand-new art style

1. **`styles.py`**: add a `STYLES["code"] = {label, provider, prompt, ...}`. For a Gemini style
   the prompt uses `_nano(...)`. If it has options, add `variants` (dict of `{key: {label, scene}}`)
   and `default_variant`; use `{SCENE}` in the prompt where the variant scene goes. Optional:
   `lift` (tone brighten, Heritage-style), `layout` ("memorial"/"definition" for typeset text),
   `use_reference`/`size` (OpenAI).
2. **`widget.js` `STYLES`**: add the matching card `{code, label, sub, ex:[...], soloOnly?,
   variants?, ...}`. If it has options, add a set to `VARIANT_SETS` and reference it by string key.
3. **Example images**: generate 2 and save to `backend/static/examples/<code>_1.jpg` /
   `_2.jpg`, plus a square `<code>.jpg` card thumbnail. Without these the style falls back to
   the shared heritage gallery and the page "looks like the heritage widget."
4. Commit, push, verify, then build the Shopify product page (§6).

---

## 9. Text features (memorial & definition)

Text is composited in `textart.py` with Pillow, **never asked of the image model** (models
misspell names; a misspelled dead pet's name is the worst failure this product has). The raw
untyped render is kept as `<id>_raw.png` so a retry recomposes cleanly instead of smearing type.

- **Memorial** (Watercolor): optional name + dates, typeset beneath the art.
- **Definition Print**: a 3–4 question mini-questionnaire → `/definition-copy` asks Claude for a
  dictionary entry → shown in editable fields → customer edits → typeset. The name is typeset
  verbatim; only the phonetic + body come from Claude.

---

## 10. Operations & things that break

**Gemini credits (has caused full outages).** Prepay, and it **stops at $0 with no warning** —
every Gemini style returns 429 `RESOURCE_EXHAUSTED`, i.e. 11 of 12 styles down, Heritage still
works. Fix: top up at ai.studio → project → Billing, and **make sure the funded project owns the
same API key that's in Render** (a top-up on a different project does nothing). Auto-reload is on.
`_gemini` fails fast on depleted-credit 429s with a support-address message; transient 429/5xx
retry up to 3×.

**Disk.** Generated files live on a Render disk (`GEN_DIR`). Each preview writes ~7MB (full +
watermarked preview + original). It filled once at 1GB (→ silent `OSError` on save, surfaced as
"Internal Server Error"). Now 10GB. **`/health` reports disk usage** — check it. **No auto-cleanup
is built yet** — this is an OPEN ITEM: pick a retention window (owner floated 2 weeks; 30 days
recommended so it comfortably exceeds fulfilment + support), then a nightly prune of files older
than that. `/leads` already hides previews whose files were pruned.

**No alerting.** Credit depletion and disk-full were both first noticed as customer-facing errors.
A `/health` check that pings Gemini + a balance alert would catch these earlier — worth building.

**Owner views:** `/gallery`, `/leads`, `/stats` (§4). All unlisted; `/leads` shows emails.

---

## 11. Testing & verifying (no Node on this Mac)

- **JS syntax check** (widget is ES5, no linter): via macOS JXA —
  ```bash
  osascript -l JavaScript -e 'ObjC.import("Foundation"); var s=$.NSString.stringWithContentsOfFileEncodingError("/ABS/PATH/widget.js",$.NSUTF8StringEncoding,null).js; try{ new Function(s); "SYNTAX OK" }catch(e){ "ERR "+e.message }'
  ```
- **Python:** `cd backend && ./venv/bin/python -c "import ast; ast.parse(open('app.py').read())"`
  and `import app` to catch import errors.
- **Local widget harness:** there is a `mktest.py` in the working scratchpad that builds a local
  copy of the widget with test pages. ⚠️ **It force-sets `sel.style="oil"`** to render the
  version strip — this makes locked-page variant tests lie (a Definition page will look like it
  has no picker). It also can't simulate real mobile Safari. **The live site is the real test.**
- **Live verification:** always cache-bust; compare `/health` commit to `HEAD`; for layout, the
  browser window here won't go below ~599px, and Shopify blocks iframing — so for true mobile
  behavior, test on an actual phone or accept you're verifying mechanism, not pixels.

---

## 12. Hard-won gotchas (the full list)

- **Shopify edge cache** — `?cb=$RANDOM`, never trust the preview pane. (§2)
- **Templates are shared** across products — one per product. (§6)
- **Two saves** (theme editor + product page). (§6)
- **Theme CSS must live inside a `<style>` block in `theme.liquid` before `</head>`.** Pasting it
  into Theme settings → "Custom CSS" did NOT stick for this theme; and pasting CSS *after* a
  `</style>` renders it as text on the page. The theme ("Heritage Draft", a custom v1.0 build — no
  Colors section) sets `body, main { background:#f3ecde !important }`, so overrides need higher
  specificity **and** `!important`: `html body, html header, html main { background:#fff !important }`.
- **`overflow-x: clip` on an ancestor breaks `position: sticky` on iOS Safari** (not desktop
  Chrome). The mobile preview had to become `position: fixed`, reparented to `<body>`. If you add
  sticky anything, test on a real iPhone.
- **CSS grid `1fr` = `minmax(auto,1fr)`** and the `auto` floor won't shrink below the widest
  child — a horizontally-scrolling carousel blew the whole column out to its unscrolled width and
  clipped everything. Use `minmax(0,1fr)` + `min-width:0`. This is why the page scrolled sideways.
- **Theme sets `input[type=checkbox]{width:100%}`** — flex alone can't beat an inherited width;
  pin `width/min-width/height` explicitly on widget checkboxes.
- **Variant matching by dimensions, not exact text** — product option text drifts between
  duplicated products (`24x18` vs `24x18 inches`); one typo (`32x2`) will legitimately fail to
  match, which is correct (don't guess).
- **Gemini mirrors the input photo's aspect** unless you pass
  `generationConfig.imageConfig.aspectRatio` — set to `4:3` so portrait phone photos don't come
  out portrait and get cropped on the landscape canvas.
- **Uploads must be normalised** (`_prep_image`) for BOTH providers — phones upload HEIC/CMYK/huge
  files Gemini rejects raw.
- **The click handler must scope to `#pc-styles`** — an unscoped `closest("[data-style]")` matches
  `#pcai-root` on a locked page and swallows every variant click (this caused "basketball gives me
  tennis").
- **A style with no example images** falls back to the shared heritage gallery and the page reads
  as "the heritage widget" even when the embed/routing are correct. Always ship `_1/_2/.jpg`
  examples for a new style.
- **Measure before theorising.** The disk-full and grid-blowout bugs were each found in ~2 minutes
  by inspecting the live DOM / `/health`, after being chased much longer as code bugs.

---

## 13. Open items (as of handoff)

1. **Disk auto-cleanup** — not built. Decide retention (recommend 30 days) and add a nightly prune.
2. **Theme CSS** — the white-background + grid-spacing block is ready to paste into `theme.liquid`
   (see §12 for the correct `html body … !important` form and placement).
3. **Monet's Shopify product image** — the bulldog shown there is the product photo, not the
   thumbnail; swap it in admin.
4. **Cartoon compare-at prices** — verify all 12 variants sit at a consistent SAVE% (had drift).
5. **Base template copy** — every style page may inherit hand-drawn-artist copy ("Sallie and
   Sophia", "we don't use any apps", "Hand-drawn by real artists") from the base product template.
   That's false on AI pages — audit and fix at the source.
6. **Alerting** — none on Gemini credits or disk. Worth adding.
7. **Optional thumbnails** — collection thumbnails are generated by a `gold_thumbs.py` script in
   the scratchpad (portrait 4:5, real Baroque Gold frame, no mat); regenerate if examples change.

---

*Written at handoff. The system is live and working: all 12 styles generate, the Definition Print
writer works, the mobile preview and pickers are fixed, and the three owner views are up. Treat the
live site as the source of truth, cache-bust everything, and verify the `/health` commit after every
deploy.*
