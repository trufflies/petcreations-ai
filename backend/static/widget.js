/* Pet Creations — embeddable storefront widget (full product section).
 * <div id="pcai-root"></div>
 * <script src="https://YOUR-BACKEND/app/widget.js"></script>
 *
 * Renders a complete, native-looking product section (image gallery + buy box) so it can
 * REPLACE the theme's product configurator. Live variant pricing (size x frame),
 * style preview, instant recolor, real-frame overlay, artist refinement, add-to-cart.
 */
(function () {
  var script = document.currentScript;
  var API = new URL(script.src).origin;
  var root = document.getElementById("pcai-root");
  if (!root) { console.error("[pcai] #pcai-root not found"); return; }

  // Lock the widget to one style when the embed says so:  <div id="pcai-root" data-style="sport">
  // That's what lets each style live on its own Shopify product page (its own URL, ads, reviews)
  // while every page runs this same widget. No attribute = show the full style picker, which is
  // what the original combined product page does.
  // Accepts one style or a comma list — data-style="monet,watercolor" puts two related styles on
  // one page, which suits pairs a customer would naturally compare.
  var forcedStyles = (root.getAttribute("data-style") || "").split(",")
    .map(function (s) { return s.trim(); }).filter(Boolean);
  var forcedStyle = forcedStyles.length === 1 ? forcedStyles[0] : null;

  // Per-page copy, so each style product isn't headlined "Custom Heritage Pet Portrait".
  //   <div id="pcai-root" data-style="sport" data-title="Custom Game Day Pet Portrait">
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function attr(name, fallback) {
    var v = (root.getAttribute("data-" + name) || "").trim();
    return esc(v || fallback);
  }
  // Digital add-on. Variant and price are page-configurable so the offer can be repriced in
  // Shopify without a redeploy — but they must be changed together.
  var DIGITAL_ID = attr("digital-variant", "44746320642266");
  var DIGITAL_PRICE = attr("digital-price", "15");
  var ALSO_COLLECTION = attr("also-collection", "best-sellers-1");
  var pageTitle = attr("title", "Custom Heritage Pet Portrait");
  var pageEyebrow = attr("eyebrow", "Heirloom Pet Art");

  // ---- Product data --------------------------------------------------------------------
  // Baked-in FALLBACK only. At load we re-read the real variants from the Shopify product this
  // widget is embedded on (/products/<handle>.js), so a new style product needs no code change
  // and a price edit in Shopify doesn't need a redeploy.
  // key = size(S/M/L) + frame(U=Unframed, G=Antique Gold, R=Antique Silver, B=Baroque Gold Wide)
  // value = [variantId, priceCents, compareAtCents]
  var VAR = {"SU":[48277732983002,7999,9999],"SG":[48111346254042,15999,19999],"SR":[48111363915994,15999,19999],"SB":[48111363948762,20999,26299],"MU":[48277733015770,10999,13799],"MG":[48111346286810,19999,24999],"MR":[48111363981530,19999,24999],"MB":[48111364014298,25999,32499],"LU":[48277733048538,16999,21299],"LG":[48111346319578,26999,33799],"LR":[48111364047066,26999,33799],"LB":[48111364079834,33999,42499]};

  var STYLES = [
    { code: "monet",    label: "Monet",        sub: "Impressionist", ex: ["monet_1.jpg", "monet_2.jpg"] },
    { code: "oil",      label: "Oil Painting", sub: "Museum oil", ex: ["oil_1.jpg", "oil_2.jpg"] },
    { code: "heritage", label: "Heritage",     sub: "Regal heirloom" },
    // soloOnly: Watercolor has its own product page (it carries the memorial text option),
    // so the combined page offers Monet / Oil / Heritage only.
    { code: "watercolor", label: "Watercolor", sub: "Soft & delicate", soloOnly: true, memorial: true,
      ex: ["watercolor_1.jpg", "watercolor_2.jpg"] },
    { code: "definition", label: "Definition Print", sub: "Dictionary art", soloOnly: true,
      definition: true, ex: ["definition_1.jpg", "definition_2.jpg"],
      vlabel: "Choose your backdrop", variants: "backdrops" },
    // soloOnly: lives on its own product page only. Its sport picker needs the room a dedicated
    // page gives it, and offering it in the combined grid would silently default people to tennis.
    { code: "sport",      label: "Game Day",    sub: "Impasto oil",  variants: "sports",   soloOnly: true,
      ex: ["sport_tennis.jpg", "sport_soccer.jpg", "sport_basketball.jpg", "sport_pickleball.jpg"] },
    { code: "sitting",    label: "Sitting Pretty", sub: "Painterly oil", soloOnly: true,
      ex: ["sitting_1.jpg", "sitting_2.jpg"] },
    { code: "cartoon",    label: "Cartoon",     sub: "Bright & playful", soloOnly: true,
      ex: ["cartoon_1.jpg", "cartoon_2.jpg"] },
    { code: "beach",      label: "Beach Day",   sub: "Coastal impasto", soloOnly: true,
      ex: ["beach_1.jpg", "beach_2.jpg"] },
    { code: "wildflower", label: "Wildflower",  sub: "Vintage meadow",  soloOnly: true,
      ex: ["wildflower_1.jpg", "wildflower_2.jpg"] },
    { code: "fancy",      label: "Fine Dining", sub: "Steak & wine",    soloOnly: true,
      ex: ["fancy_1.jpg", "fancy_2.jpg"] },
    { code: "bright",     label: "Bold Color", sub: "Modern & vivid",  variants: "palettes", soloOnly: true,
      ex: ["bright_1.jpg", "bright_2.jpg"] }
  ];
  // Mirrors SPORT_SCENES in styles.py — keep the codes in step.
  var SPORTS = [
    { code: "tennis",     label: "Tennis" },
    { code: "pickleball", label: "Pickleball" },
    { code: "soccer",     label: "Soccer" },
    { code: "baseball",   label: "Baseball" },
    { code: "basketball", label: "Basketball" },
    { code: "football",   label: "Football" }
  ];
  SPORTS.forEach(function (v) {
    v.img = API + "/app/examples/sportopt_" + v.code + ".jpg";   // square, for the option card
    v.ex  = "sport_" + v.code + ".jpg";                          // full size, for the hero
  });
  // Mirrors BRIGHT_PALETTES in styles.py.
  var PALETTES = [
    { code: "sunset",   label: "Sunset",   sw: ["#ff7a2f", "#ff2e88", "#5b1a55"] },
    { code: "electric", label: "Electric", sw: ["#12d6c8", "#1f5fe0", "#c6ff2e"] },
    { code: "magenta",  label: "Magenta",  sw: ["#e6188c", "#ff6f5e", "#f0b429"] },
    { code: "citrus",   label: "Citrus",   sw: ["#ffd51e", "#ff8a1e", "#1fc6d6"] },
    { code: "jewel",    label: "Jewel",    sw: ["#0e8f5c", "#1a49c4", "#7a2bb8"] },
    { code: "flame",    label: "Flame",    sw: ["#e01f1f", "#ff7a12", "#f2c14a"] }
  ];
  // Backdrop colours for the Definition Print, shown as swatches like the palettes.
  var BACKDROPS = [
    { code: "sage",     label: "Sage",     sw: ["#a9b39a"] },
    { code: "blush",    label: "Blush",    sw: ["#e9c9c2"] },
    { code: "sky",      label: "Sky",      sw: ["#b9cfe0"] },
    { code: "cream",    label: "Cream",    sw: ["#efe6d3"] },
    { code: "clay",     label: "Clay",     sw: ["#c08a6a"] },
    { code: "charcoal", label: "Charcoal", sw: ["#5a5a5c"] }
  ];
  var VARIANT_SETS = { sports: SPORTS, palettes: PALETTES, backdrops: BACKDROPS };
  // `in` = canvas width in inches, used to size the art to scale in the room view
  var SIZES = [
    { code: "S", label: "24 × 18\"", in: 24 },
    { code: "M", label: "32 × 24\"", in: 32 },
    { code: "L", label: "40 × 30\"", in: 40 }
  ];
  // Room geometry, measured off the photo rather than guessed:
  //   the 60" loveseat spans 46% of the width  -> one inch ≈ 0.767% of width
  //   the top of its back sits at 56% height   -> art hangs 6" above that
  // A loveseat rather than a sofa on purpose: the same canvas reads far grander beside it.
  var WALL_PPI = 46 / 60;
  var ROOM_HW = 1024 / 1536;      // room photo aspect, for turning a width % into a height %
  var WALL_BASE = 49.1;           // bottom of the artwork, % of image height
  // `bare`  = gallery-wrapped canvas (no mockup image — drawn in CSS from the art itself)
  // l/t/w/h = art window inside the full wall-mockup, used for the hero
  // cut     = art window inside the *_cut crop (mockup trimmed to the moulding), used on the wall
  // mould   = moulding width per side in inches; baroque is 1" wider than the antiques
  // ar      = aspect (w/h) of the cropped frame image
  var FRAMES = [
    { code: "U", key: null,             label: "Unframed",            bare: true },
    { code: "G", key: "antique_gold",   label: "Antique Gold",        l: 7.5, t: 8, w: 85, h: 84,
      cut: { l: 3.9, t: 4.4, w: 90.6, h: 91.0 }, ar: 563 / 443, mould: 2 },
    { code: "R", key: "antique_silver", label: "Antique Silver",      l: 8,   t: 8, w: 84, h: 84,
      cut: { l: 4.3, t: 6.3, w: 90.3, h: 88.8 }, ar: 558 / 455, mould: 2 },
    { code: "B", key: "baroque_gold",   label: "Baroque Gold (Wide)", l: 9.5, t: 9, w: 81, h: 82,
      cut: { l: 3.8, t: 7.4, w: 88.8, h: 87.7 }, ar: 547 / 449, mould: 3 }
  ];
  FRAMES.forEach(function (f) {
    if (!f.key) return;
    f.img = API + "/app/frames/" + f.key + ".webp";
    f.cutImg = API + "/app/frames/" + f.key + "_cut.webp";
  });

  // Read the real variants off whichever Shopify product this widget is embedded on. Matching on
  // option VALUES (not option names or positions) keeps it working if a duplicated product has its
  // options named differently. Any failure leaves the baked-in map in place.
  // Match option values by their NUMBERS, not their exact text. Products duplicated over time
  // carry drift — "24x18 inches" vs "24x18" vs "24 x 18" — and an exact-string match silently
  // found zero variants, which tripped the safety guard and blocked checkout on live pages.
  var SIZE_BY_DIMS = { "24x18": "S", "32x24": "M", "40x30": "L" };
  var FRAME_BY_OPT = { "unframed": "U", "antique gold": "G", "antique silver": "R",
                       "baroque gold (wide)": "B" };
  function sizeCode(v) {
    var m = String(v).match(/(\d+)\s*[x\u00d7]\s*(\d+)/i);
    return m ? SIZE_BY_DIMS[m[1] + "x" + m[2]] : null;
  }
  function frameCode(v) {
    return FRAME_BY_OPT[String(v).trim().toLowerCase()] || null;
  }

  function loadLiveVariants() {
    var path = location.pathname.replace(/\/+$/, "");
    if (path.indexOf("/products/") === -1 || typeof fetch !== "function") return Promise.resolve();
    var handle = path.split("/products/")[1].split("/")[0];
    var ownPage = handle === FALLBACK_HANDLE;
    return fetch(path + ".js", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.variants) return;
        var m = {};
        d.variants.forEach(function (v) {
          var s = null, f = null;
          (v.options || []).forEach(function (o) {
            s = sizeCode(o) || s;
            f = frameCode(o) || f;
          });
          if (s && f) m[s + f] = [v.id, v.price, v.compare_at_price || v.price];
        });
        if (Object.keys(m).length >= 3) { VAR = m; variantsTrusted = true; }
        else if (!ownPage) variantsTrusted = false;   // wrong shape on someone else's product
      })
      .catch(function () { if (!ownPage) variantsTrusted = false; });
  }

  var CDN = "https://cdn.shopify.com/s/files/1/0055/0957/8803/files/";
  var EXAMPLES = [
    CDN + "ChatGPTImageJun23_2026_09_21_46PM.png",
    CDN + "image0_9_dc9c6ca1-b37a-4302-b2b6-915e82b8439e.png",
    CDN + "ChatGPT_Image_Jun_23_2026_10_21_29_PM.png",
    CDN + "cat_heritage_2.png?v=1784330546",
    CDN + "cat_heritage_1.png?v=1784330546",
    CDN + "ChatGPT_Image_Jun_23_2026_10_23_53_PM.png",
    CDN + "ChatGPT_Image_Jun_24_2026_08_40_37_PM.png",
    CDN + "ChatGPT_Image_Jun_5_2026_07_05_06_PM.png"
  ];
  var LOADING = ["Studying your pet’s features…", "Preparing the canvas…", "Mixing the paints…", "Applying brushstrokes…", "Adding the finishing details…"];
  // Rotated in the preview loader (Bondel-style social proof while they wait ~60s)
  var REVIEWS = [
    { n: "Rachel T. · Portland, OR", t: "Didn't expect much — then I unwrapped it. Every bit of Bella's fluff, those eyes. I gasped out loud." },
    { n: "Marcus D. · Austin, TX", t: "The oil painting of our lab looks like it belongs in a museum. The framing is stunning." },
    { n: "Priya S. · Chicago, IL", t: "Cried when it arrived — it's exactly our girl, captured her soul. Worth every penny." },
    { n: "Tom & Elena · Denver, CO", t: "Hung it over the mantel and everyone asks where we got it. Heirloom quality, truly." },
    { n: "Jasmine W. · Seattle, WA", t: "The preview alone sold me in 60 seconds. The final canvas blew it out of the water." },
    { n: "Diego M. · Miami, FL", t: "Our late boy, immortalized. I can't put into words what this means to our family. Thank you." }
  ];

  // ---- State --------------------------------------------------------------------------
  var sel = { style: forcedStyles[0] || null, variant: null, size: "S", frame: "U" };
  // Which styles this page offers: the ones named in data-style, else everything not soloOnly.
  function pageStyles() {
    if (!forcedStyles.length) return STYLES.filter(function (s) { return !s.soloOnly; });
    return STYLES.filter(function (s) { return forcedStyles.indexOf(s.code) !== -1; });
  }
  // A style page should open on its own work — a Game Day page led by a gilt-framed heritage
  // portrait promises the wrong product. Falls back to the shared set.
  function pageExamples() {
    var s = styleCfg();
    if (!s || !s.ex) return EXAMPLES;
    var files = s.ex.slice();
    // Lead with the chosen variant's own artwork. Without this, picking Basketball still showed
    // the tennis example as the hero, which reads as "it ignored my choice".
    var vs = variantsFor(), cur = vs && vs.filter(function (v) { return v.code === sel.variant; })[0];
    if (cur && cur.ex) {
      files = [cur.ex].concat(files.filter(function (f) { return f !== cur.ex; }));
    }
    return files.map(function (f) { return API + "/app/examples/" + f; });
  }
  function styleCfg(c) { return STYLES.filter(function (s) { return s.code === (c || sel.style); })[0] || null; }
  function variantsFor(c) { var s = styleCfg(c); return s && s.variants ? VARIANT_SETS[s.variants] : null; }
  // Cache/versions are keyed per style AND variant — tennis and soccer are different portraits.
  function resKey() { return sel.style + (sel.variant ? ":" + sel.variant : ""); }
  var file = null, timer = null, heroPick = null, view = "art", leadFired = false;   // view: "art" | "wall"
  // Per-style session cache so switching styles (and back) never re-generates.
  // Each style keeps EVERY render it produced — retries add a version rather than replacing one,
  // so nobody loses a portrait they liked by tweaking it. code -> {list:[{id,preview,full,...}], i}
  var results = {};
  function curSet() { return results[resKey()] || null; }
  function curRes() { var s = curSet(); return s ? s.list[s.i] : null; }
  function addRes(key, res) {
    var s = results[key] || (results[key] = { list: [], i: 0 });
    s.list.push(res); s.i = s.list.length - 1;
  }

  // ---- Markup -------------------------------------------------------------------------
  root.innerHTML = "" +
    "<style>" +
    "#pcai-root{--pc-bg:#ffffff;--pc-ink:#2c2c2c;--pc-mut:#6b6b6b;--pc-line:#e6e2da;--pc-card:#fbfaf8;--pc-acc:#5e1622;--pc-gold:#b08d57;--pc-serif:'Playfair Display',Georgia,serif;background:var(--pc-bg);color:var(--pc-ink);font-family:inherit;width:100%;overflow-x:clip}" +
    "#pcai-root *{box-sizing:border-box}" +
    "#pcai{max-width:100%;overflow-x:clip;width:94%;max-width:1280px;margin:0 auto;padding:34px 0 6px;text-align:left}" +
    // minmax(0,1fr), not 1fr. Plain 1fr means minmax(AUTO,1fr), and that auto floor refuses to
    // shrink below the widest child's min-content — the "you may also like" flex row is 1362px
    // unscrolled, so it blew the column out to 1362px inside a 571px page and everything in it
    // got clipped on the right. The desktop rule already used minmax(0,...); the base one did not.
    "#pcai .pc-wrap{display:grid;grid-template-columns:minmax(0,1fr);gap:28px}" +
    "#pcai .pc-media,#pcai .pc-buy{min-width:0}" +
    "@media(min-width:880px){#pcai .pc-wrap{grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:44px;align-items:start}#pcai .pc-media{position:sticky;top:20px}}" +
    // top CTA (mainly to jump mobile users straight to the upload)
    // mobile tightening
    "@media(max-width:640px){" +
      "#pcai{width:92%;padding-top:22px}" +
      "#pcai .pc-hero{min-height:230px;padding:12px}" +
      "#pcai .pc-hero>img,#pcai .pc-framed>.pc-fimg,#pcai .pc-canvas>img,#pcai .pc-wallbg{max-height:420px}" +
      "#pcai .pc-viewtabs button{padding:6px 13px;font-size:12px}" +
      "#pcai .pc-title{font-size:24px}" +
      "#pcai .pc-sw{display:flex;gap:4px;justify-content:center;margin-bottom:7px}" +
    "#pcai .pc-sw i{width:20px;height:20px;border-radius:50%;display:block}" +
    "#pcai .pc-varimg{width:100%;height:96px;object-fit:cover;object-position:center 22%;border-radius:8px;display:block;margin-bottom:6px}" +
    "@media(max-width:640px){#pcai .pc-varimg{height:78px}}" +
    "#pcai .pc-styleimg{height:100px}" +
      "#pcai .pc-oc{padding:8px 5px}" +
      "#pcai #pc-styles .pc-oc{padding:7px 5px 9px}" +
      "#pcai .pc-oc b{font-size:12.5px}#pcai .pc-oc b.pc-serifname{font-size:13.5px}#pcai .pc-oc small{font-size:10px}" +
      "#pcai .pc-frameopts .pc-oc img{height:44px}#pcai .pc-swatch{height:44px}" +
      "#pcai .pc-btn{padding:14px 18px;font-size:14.5px}" +
      "#pcai-root .pc-info svg{max-width:100%;height:auto}" +
      "#pcai-root .pc-info summary{font-size:16px}" +
    "}" +
    // media
    "#pcai .pc-hero{background:var(--pc-card);border:1px solid var(--pc-line);border-radius:16px;padding:16px;display:flex;align-items:center;justify-content:center;min-height:340px}" +
    "#pcai .pc-hero>img{max-width:100%;max-height:620px;border-radius:8px;box-shadow:0 8px 26px rgba(0,0,0,.14);display:block}" +
    "#pcai .pc-framed{position:relative;display:inline-block;line-height:0;max-width:100%}" +
    "#pcai .pc-framed>.pc-fimg{display:block;max-width:100%;max-height:620px}" +
    "#pcai .pc-framed>.pc-fart{position:absolute;object-fit:cover;object-position:center 22%}" +
    // unframed = gallery wrap: bare art, lifted off the wall, with the shaded 1.5" bottom edge
    "#pcai .pc-canvas{position:relative;display:inline-block;line-height:0;max-width:100%}" +
    "#pcai .pc-canvas>img{display:block;max-width:100%;max-height:620px;box-shadow:0 14px 32px rgba(0,0,0,.28),0 3px 8px rgba(0,0,0,.16)}" +
    "#pcai .pc-canvas:after{content:'';position:absolute;left:0;right:0;bottom:0;height:6px;background:linear-gradient(rgba(0,0,0,.32),rgba(0,0,0,.05));pointer-events:none}" +
    // room view — art composited onto a bare wall, scaled against the sofa
    "#pcai .pc-viewtabs{display:flex;gap:6px;margin-bottom:11px;justify-content:center}" +
    "#pcai .pc-viewtabs button{border:1px solid var(--pc-line);background:var(--pc-card);color:var(--pc-mut);font-family:inherit;font-size:12.5px;padding:7px 16px;border-radius:100px;cursor:pointer}" +
    "#pcai .pc-viewtabs button.sel{background:var(--pc-acc);border-color:var(--pc-acc);color:#fff}" +
    "#pcai .pc-wall{position:relative;display:inline-block;line-height:0;max-width:100%}" +
    "#pcai .pc-wallbg{display:block;max-width:100%;max-height:620px;border-radius:10px}" +
    "#pcai .pc-wallart{position:absolute;left:50%;transform:translateX(-50%);box-sizing:border-box;box-shadow:0 12px 24px rgba(0,0,0,.30),0 2px 6px rgba(0,0,0,.22)}" +
    "#pcai .pc-wallart.bare>img{width:100%;height:100%;object-fit:cover;object-position:center 22%;display:block}" +
    // real ornate frames: the mockup cropped to its moulding, customer art laid into the opening
    "#pcai .pc-wfimg{width:100%;height:100%;display:block}" +
    "#pcai .pc-wfart{position:absolute;object-fit:cover;object-position:center 22%}" +
    "#pcai .pc-wallcap{position:absolute;left:0;right:0;bottom:10px;text-align:center;line-height:1.4;pointer-events:none}" +
    "#pcai .pc-wallcap span{display:inline-block;background:rgba(255,253,247,.88);color:#4a4036;font-size:11px;padding:4px 12px;border-radius:100px}" +
    "#pcai .pc-heronote{font-size:12.5px;color:var(--pc-mut);text-align:center;margin-top:11px}" +
    "#pcai .pc-spin{width:40px;height:40px;border:4px solid var(--pc-line);border-top-color:var(--pc-acc);border-radius:50%;animation:pcspin 1s linear infinite;margin:0 auto 12px}" +
    "@keyframes pcspin{to{transform:rotate(360deg)}}" +
    "#pcai .pc-loading{max-width:360px;margin:0 auto}" +
    "#pcai .pc-loadrev{margin-top:18px;padding:13px 15px;border:1px solid var(--pc-line);border-radius:12px;background:#fff;text-align:left}" +
    "#pcai .pc-lr-stars{color:#e8a91d;font-size:13px;letter-spacing:1px}" +
    "#pcai .pc-lr-t{font-size:13px;line-height:1.5;color:var(--pc-ink);margin:5px 0 6px;font-style:italic}" +
    "#pcai .pc-lr-n{font-size:11px;color:var(--pc-mut);font-weight:600}" +
    "@keyframes pcfade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}" +
    // buy column
    "#pcai .pc-eyebrow{font-size:11.5px;letter-spacing:.18em;color:var(--pc-mut);text-transform:uppercase;font-weight:600}" +
    "#pcai .pc-title{font-family:var(--pc-serif);font-size:30px;line-height:1.12;font-weight:700;margin:6px 0 8px;color:var(--pc-ink)}" +
    "#pcai .pc-reviews{display:flex;align-items:center;gap:7px;font-size:13.5px;color:var(--pc-ink);margin:0 0 10px;flex-wrap:wrap}" +
    "#pcai .pc-reviews .pc-stars{color:#e8a91d;letter-spacing:1px;font-size:15px}" +
    "#pcai .pc-reviews b{font-weight:700}" +
    "#pcai .pc-pricerow{display:flex;align-items:center;gap:10px;flex-wrap:wrap}" +
    "#pcai .pc-pricerow ins{font-size:26px;font-weight:700;text-decoration:none;font-family:var(--pc-serif)}" +
    "#pcai .pc-pricerow del{color:var(--pc-mut);font-size:16px}" +
    "#pcai .pc-save{background:var(--pc-gold);color:#181311;font-size:11px;font-weight:700;letter-spacing:.03em;padding:3px 9px;border-radius:100px}" +
    "#pcai .pc-trust{display:flex;flex-wrap:wrap;gap:7px 20px;margin:16px 0 2px;font-size:13.5px;color:var(--pc-mut)}" +
    "#pcai .pc-trust span{position:relative;padding-left:15px}" +
    "#pcai .pc-trust span:before{content:'';position:absolute;left:0;top:50%;width:7px;height:7px;margin-top:-3.5px;border-radius:50%;border:1.5px solid var(--pc-gold)}" +
    "#pcai .pc-memfields{display:grid;grid-template-columns:1fr 1fr;gap:9px}" +
    "@media(max-width:640px){#pcai .pc-memfields{grid-template-columns:1fr}}" +
    "#pcai .pc-memfields .pc-field{margin-top:0}" +
    // On a phone the hero scrolls far above the size and frame pickers, so choosing a frame meant
    // scrolling back up past the style grid, email and upload to see what it did. This pins a small
    // live copy to the top of the buy column while those options are on screen. Desktop already has
    // a sticky media column, so it stays hidden there.
    // A FIXED floating card, NOT sticky. Sticky failed on iOS Safari — WebKit drops sticky for
    // descendants of an overflow:clip ancestor (#pcai has it), which is why it worked on desktop
    // and never on a phone. The node is also reparented to <body> on init so nothing can clip it.
    // Selectors are unscoped (not under #pcai) and use literal colours, since it lives at body level.
    // Full-width bar flush to the bottom, so the preview stays large and present as you scroll
      // the options (the mobile stand-in for the desktop sticky media column). safe-area padding
      // keeps it clear of the iPhone home indicator.
    "#pc-mini{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:none;"
      + "align-items:center;gap:14px;padding:11px 16px;"
      + "padding-bottom:calc(11px + env(safe-area-inset-bottom,0px));background:#fff;"
      + "border-top:1px solid #e6e2da;box-shadow:0 -6px 22px rgba(0,0,0,.13);font-family:inherit}" +
    "#pc-mini.on{display:flex}" +
    // Show the art INSIDE the selected frame, same as the desktop hero, so changing the frame
    // updates the picture and not just the label. Mirrors #pcai's framed/canvas rules but
    // scoped to #pc-mini since this lives at <body> level.
    "#pc-mini .pc-framed,#pc-mini .pc-canvas{position:relative;display:inline-block;line-height:0;flex:0 0 auto}" +
    "#pc-mini .pc-framed>.pc-fimg{display:block;height:88px;width:auto}" +
    "#pc-mini .pc-framed>.pc-fart{position:absolute;object-fit:cover;object-position:center 22%}" +
    "#pc-mini .pc-canvas>img{display:block;height:88px;width:auto;object-fit:cover;border-radius:5px}" +
    "#pc-mini .m{flex:1 1 auto;min-width:0}" +
    "#pc-mini-wall{flex:0 0 auto;margin-left:auto;max-width:104px;border:1px solid #5e1622;"
      + "background:#fff;color:#5e1622;font-family:inherit;font-size:12px;font-weight:600;"
      + "line-height:1.25;padding:9px 12px;border-radius:100px;cursor:pointer;white-space:normal}" +
    "#pc-mini b{display:block;font-size:15px;line-height:1.3;color:#2c2c2c}" +
    "#pc-mini span{display:block;font-size:13px;color:#6b6b6b;margin-top:3px}" +
    "@media(min-width:880px){#pc-mini.on{display:none}}" +
    "@media(max-width:879px){#pcai-root.pcmini-pad{padding-bottom:132px}}" +
    "#pcai .pc-digital{display:flex;gap:9px;align-items:flex-start;font-size:13px;margin:14px 0 2px;cursor:pointer;line-height:1.5}" +
    "#pcai .pc-digital>span{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}" +
    "#pcai .pc-also{margin:34px 0 0;min-width:0}" +
    "#pcai .pc-also-h{font-size:13px;letter-spacing:.09em;text-transform:uppercase;color:var(--pc-mut);margin-bottom:12px}" +
    "#pcai .pc-also-row{min-width:0;display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding-bottom:6px}" +
    "#pcai .pc-also-card{flex:0 0 158px;scroll-snap-align:start;text-decoration:none;color:inherit}" +
    "#pcai .pc-also-card img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:10px;display:block;background:var(--pc-card)}" +
    "#pcai .pc-also-t{font-size:13px;line-height:1.35;margin-top:7px}" +
    "#pcai .pc-also-p{font-size:13px;color:var(--pc-mut);margin-top:2px}" +
    "#pcai .pc-story{margin:26px 0 0;padding:18px 20px;background:var(--pc-card);border:1px solid var(--pc-line);border-radius:14px}" +
    "#pcai .pc-story h3{font-family:var(--pc-serif);font-size:17px;font-weight:600;margin:0 0 10px;color:var(--pc-ink)}" +
    "#pcai .pc-story ul{margin:0;padding-left:17px}" +
    "#pcai .pc-story li{font-size:13.5px;line-height:1.55;color:#4a4038;margin:0 0 7px}" +
    "#pcai .pc-story li:last-child{margin-bottom:0}" +
    "#pcai .pc-opt{margin:22px 0 0}" +
    "#pcai .pc-label{font-size:13px;letter-spacing:.05em;text-transform:uppercase;color:var(--pc-mut);margin:0 0 8px;display:flex;justify-content:space-between;align-items:center}" +
    "#pcai .pc-guidelink{font-size:11px;color:var(--pc-acc);cursor:pointer;text-transform:none;letter-spacing:0;text-decoration:underline}" +
    "#pcai .pc-optional{font-size:10px;font-weight:600;letter-spacing:.06em;color:var(--pc-mut);border:1px solid var(--pc-line);border-radius:100px;padding:2px 9px;background:var(--pc-card)}" +
    // version history — every render is kept so a tweak never destroys one they liked
    "#pcai .pc-versions{border:1px solid var(--pc-line);background:var(--pc-card);border-radius:12px;padding:12px 13px;margin-bottom:12px}" +
    "#pcai .pc-vhead{font-size:13px;font-weight:600}" +
    "#pcai .pc-vhead small{font-weight:400;color:var(--pc-mut);font-size:11.5px;margin-left:6px}" +
    "#pcai .pc-vstrip{display:flex;gap:8px;overflow-x:auto;margin-top:9px;padding-bottom:2px}" +
    "#pcai .pc-vthumb{flex:none;width:62px;border:2px solid transparent;border-radius:9px;background:none;padding:0;cursor:pointer;line-height:0}" +
    "#pcai .pc-vthumb.sel{border-color:var(--pc-acc)}" +
    "#pcai .pc-vthumb img{width:100%;height:52px;object-fit:cover;border-radius:7px;display:block}" +
    "#pcai .pc-vthumb b{display:block;font-size:10px;line-height:1.7;color:var(--pc-mut);font-weight:600}" +
    "#pcai .pc-vthumb.sel b{color:var(--pc-acc)}" +
    "#pcai .pc-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}" +
    // auto-fit so the same grid holds 3 styles, 4 styles or 6 sports without hand-tuning columns
    "#pcai .pc-gridN{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:9px}" +
    "@media(max-width:640px){#pcai .pc-gridN{grid-template-columns:repeat(2,1fr)}}" +
    "#pcai .pc-oc{position:relative;border:1.5px solid var(--pc-line);background:var(--pc-card);border-radius:11px;padding:11px 8px;text-align:center;cursor:pointer;transition:.12s}" +
    "#pcai .pc-oc:hover{border-color:var(--pc-mut)}" +
    "#pcai .pc-oc.sel{border-color:var(--pc-acc);box-shadow:0 0 0 3px rgba(94,22,34,.13)}" +
    "#pcai .pc-oc b{display:block;font-size:15px}" +
    "#pcai .pc-oc b.pc-serifname{font-family:var(--pc-serif);font-size:16px}" +
    "#pcai .pc-oc small{display:block;font-size:12px;color:var(--pc-mut);margin-top:2px;min-height:14px}" +
    "#pcai .pc-oc small.pc-up{color:var(--pc-acc);font-weight:600}" +
    "#pcai #pc-styles .pc-oc{padding:7px 7px 10px}" +
    "#pcai .pc-sw{display:flex;gap:4px;justify-content:center;margin-bottom:7px}" +
    "#pcai .pc-sw i{width:20px;height:20px;border-radius:50%;display:block}" +
    "#pcai .pc-varimg{width:100%;height:96px;object-fit:cover;object-position:center 22%;border-radius:8px;display:block;margin-bottom:6px}" +
    "@media(max-width:640px){#pcai .pc-varimg{height:78px}}" +
    "#pcai .pc-styleimg{width:100%;height:126px;object-fit:cover;object-position:center 22%;border-radius:8px;display:block;margin-bottom:7px}" +
    "#pcai .pc-pop{display:block;background:var(--pc-acc);color:#fff;font-size:9px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:2px 0;border-radius:6px;margin:-4px -3px 6px}" +
    "#pcai .pc-frameopts{grid-template-columns:repeat(4,1fr)}" +          // 4 options now (Unframed + 3 frames)
    "@media(max-width:640px){#pcai .pc-frameopts{grid-template-columns:repeat(2,1fr)}}" +
    "#pcai .pc-frameopts .pc-oc{padding:7px 6px}" +
    "#pcai .pc-frameopts .pc-oc img{width:100%;height:50px;object-fit:contain;display:block;margin-bottom:4px}" +
    "#pcai .pc-swatch{height:50px;display:flex;align-items:center;justify-content:center;margin-bottom:4px}" +
    "#pcai .pc-swatch>i{display:block;position:relative;width:56px;height:42px;background:#eadfc8 center 25%/cover no-repeat;box-shadow:0 4px 9px rgba(0,0,0,.30),0 1px 2px rgba(0,0,0,.2)}" +
    "#pcai .pc-swatch>i:after{content:'';position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(rgba(0,0,0,.34),rgba(0,0,0,.06))}" +
    "#pcai .pc-drop{display:block;border:2px dashed var(--pc-line);border-radius:12px;padding:20px;text-align:center;cursor:pointer;background:var(--pc-card)}" +
    "#pcai .pc-drop:hover{border-color:var(--pc-acc)}" +
    "#pcai .pc-drop input{display:none}" +
    "#pcai .pc-drop img{max-width:100%;max-height:230px;width:auto;height:auto;object-fit:contain;border-radius:9px;display:block;margin:0 auto}" +
    "#pcai .pc-dropicon{font-size:26px}" +
    "#pcai .pc-field{width:100%;padding:12px;border:1.5px solid var(--pc-line);border-radius:9px;font-size:14px;margin-top:10px;font-family:inherit;background:#fff;color:var(--pc-ink)}" +
    "#pcai textarea.pc-field{min-height:60px;resize:vertical}" +
    "#pcai .pc-btn{background:var(--pc-acc);color:#fff;border:0;border-radius:100px;padding:15px 26px;font-size:15px;font-weight:600;letter-spacing:.4px;cursor:pointer;font-family:inherit;text-align:center}" +
    "#pcai .pc-btn:hover{filter:brightness(1.08)}" +
    "#pcai .pc-btn[disabled]{opacity:.4;cursor:not-allowed;filter:none}" +
    "#pcai .pc-btn.pc-big{display:block;width:100%;margin-top:16px}" +
    "#pcai .pc-btn.ghost{background:transparent;color:var(--pc-acc);border:1.5px solid var(--pc-acc);padding:12px 18px;letter-spacing:.2px}" +
    "#pcai .pc-edit{margin-top:18px;border:1px solid var(--pc-line);border-radius:12px;padding:12px;background:var(--pc-card)}" +
    "#pcai .pc-edit-head{display:flex;align-items:center;justify-content:space-between;gap:8px}" +
    "#pcai .pc-edit-head b{font-size:14px}" +
    "#pcai .pc-tag{font-size:9.5px;font-weight:700;letter-spacing:.03em;padding:3px 8px;border-radius:100px;text-transform:uppercase;white-space:nowrap}" +
    "#pcai .pc-tag-inst{background:rgba(94,22,34,.1);color:var(--pc-acc)}" +
    "#pcai .pc-tag-free{background:#e7f2e7;color:#2e7d32}" +
    "#pcai .pc-retry{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}" +
    "#pcai .pc-retry .pc-field{flex:1;min-width:180px;margin-top:0}" +
    "#pcai .pc-artist{display:flex;gap:9px;align-items:flex-start;font-size:13px;margin:14px 0 2px;cursor:pointer;line-height:1.5}" +
    // The theme sets input[type=checkbox]{width:100%}. flex:0 0 auto resolves its basis from
    // that width, so the box ate the whole row and left the text 0px wide — it then ran off
    // the right edge, which is what was scrolling the whole page sideways on mobile. Pin the
    // box size explicitly; flex alone cannot win against a width it inherits.
    "#pcai .pc-artist input,#pcai .pc-digital input{flex:0 0 auto;width:16px;min-width:16px;height:16px;margin-top:3px}" +
    "#pcai .pc-artist>span{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}" +
    "#pcai .pc-tiny{font-size:13px;line-height:1.5;color:var(--pc-mut)}" +
    "#pcai .pc-center{text-align:center}" +
    "#pcai .pc-err{color:#a33;font-size:14px;text-align:center;margin-top:8px}" +
    // info accordion
    "#pcai-root .pc-info{width:94%;max-width:1700px;margin:24px auto 0;padding:0 0 34px}" +
    "#pcai-root .pc-info details{border-top:1px solid var(--pc-line)}" +
    "#pcai-root .pc-info summary{cursor:pointer;padding:15px 0;font-family:var(--pc-serif);font-size:17px;font-weight:600;list-style:none;color:var(--pc-ink)}" +
    "#pcai-root .pc-info summary::-webkit-details-marker{display:none}" +
    "#pcai-root .pc-info summary::after{content:'+';float:right;color:var(--pc-mut);font-size:20px;line-height:1}" +
    "#pcai-root .pc-info details[open] summary::after{content:'–'}" +
    "#pcai-root .pc-info p,#pcai-root .pc-info ul{font-size:15px;line-height:1.68;margin:0 0 12px;color:#4a4038;max-width:860px}" +
    "#pcai-root .pc-info .pc-lead{font-family:var(--pc-serif);font-size:18px;color:var(--pc-ink);margin-bottom:8px}" +
    "#pcai-root .pc-info ul{padding-left:18px}#pcai-root .pc-info li{margin:4px 0}" +
    "#pcai-root .pc-sizeviz{display:flex;align-items:flex-end;gap:18px;margin:10px 0 8px;flex-wrap:wrap}" +
    "#pcai-root .pc-sizebox{border:2px solid var(--pc-acc);border-radius:4px;background:rgba(94,22,34,.05);display:flex;align-items:center;justify-content:center;text-align:center;font-size:11px;font-weight:600;color:var(--pc-ink)}" +
    "</style>" +

    "<div id='pcai'>" +
      "<div class='pc-wrap'>" +
      // ---- LEFT: media ----
      "<div class='pc-media'>" +
        "<div class='pc-viewtabs' id='pc-viewtabs' style='display:none'>" +
          "<button data-view='art' class='sel'>Your artwork</button>" +
          "<button data-view='wall'>See it on the wall</button>" +
        "</div>" +
        "<div class='pc-hero' id='pc-hero'></div>" +
        "<div class='pc-heronote' id='pc-heronote'>Upload your pet’s photo — your live preview appears here in ~60 seconds.</div>" +
      "</div>" +
      // ---- RIGHT: buy box ----
      "<div class='pc-buy'>" +
        "<div class='pc-mini' id='pc-mini'></div>" +
        "<div class='pc-eyebrow'>" + pageEyebrow + "</div>" +
        "<h1 class='pc-title'>" + pageTitle + "</h1>" +
        "<div class='pc-reviews'><span class='pc-stars'>★★★★★</span> <b>4.9</b>/5 &middot; 14,668+ happy customers</div>" +
        "<div class='pc-pricerow' id='pc-pricerow'></div>" +
        "<div class='pc-trust'>" +
          "<span>Free preview in 60 seconds</span><span>Free shipping, 4&ndash;7 days</span>" +
          "<span>30-day happiness guarantee</span></div>" +

        "<div class='pc-opt'><div class='pc-label'>Your pet’s photo</div>" +
          "<label class='pc-drop' id='pc-drop'><input type='file' id='pc-file' accept='image/*'>" +
          "<div id='pc-dropin'><div class='pc-dropicon'>+</div><div class='pc-tiny'>Click to upload a clear, well-lit photo</div></div></label>" +
          "<input class='pc-field' id='pc-email' type='email' placeholder='Your email (so we can send your preview)'>" +
        "</div>" +
        "<div class='pc-opt' id='pc-styleopt'><div class='pc-label' id='pc-stylelabel'>Choose your style</div><div class='pc-gridN' id='pc-styles'></div></div>" +
        // Size and frame stay hidden until there's a portrait to apply them to — nobody should be
        // asked to pick a canvas size before they've seen anything.
        "<div class='pc-opt' id='pc-memopt' style='display:none'>" +
          "<div class='pc-label'>Add a memorial line <span class='pc-optional'>optional</span></div>" +
          "<div class='pc-memfields'>" +
            "<input class='pc-field' id='pc-mem-name' maxlength='24' placeholder=\"Your pet's name\">" +
            "<input class='pc-field' id='pc-mem-dates' maxlength='28' placeholder='2011 — 2024 (optional)'>" +
          "</div>" +
          "<div class='pc-tiny' style='margin-top:6px'>Printed beneath the artwork in fine type. Leave blank for no text.</div>" +
        "</div>" +
        "<div class='pc-opt' id='pc-defopt' style='display:none'>" +
          "<div class='pc-label'>Your pet's definition</div>" +
          "<div class='pc-tiny' style='margin:-4px 0 10px'>Answer two or three questions and we'll draft it — you can edit every word before it prints.</div>" +
          "<input class='pc-field' id='pc-def-name' maxlength='24' placeholder=\"Your pet's name\">" +
          "<input class='pc-field' id='pc-def-quirk' maxlength='200' placeholder='One thing they do that everyone jokes about'>" +
          "<input class='pc-field' id='pc-def-greet' maxlength='200' placeholder='What are they like when you get home? (optional)'>" +
          "<input class='pc-field' id='pc-def-obsess' maxlength='200' placeholder='Weirdly obsessed with… (optional)'>" +
          "<button class='pc-btn ghost' id='pc-def-go' style='width:100%;margin-top:10px'>Write my definition</button>" +
          "<div id='pc-def-out' style='display:none;margin-top:12px'>" +
            "<input class='pc-field' id='pc-def-phonetic' maxlength='32' placeholder='ol-uh-ver'>" +
            "<textarea class='pc-field' id='pc-def-body' maxlength='220' rows='3' placeholder='Your definition'></textarea>" +
            "<div class='pc-tiny' style='margin-top:6px'>Edit freely — this is exactly what gets printed.</div>" +
          "</div>" +
        "</div>" +
        "<div class='pc-opt' id='pc-sizeopt' style='display:none'><div class='pc-label'>Choose your size <span class='pc-guidelink' id='pc-guidelink'>Size guide</span></div><div class='pc-grid3' id='pc-sizes'></div></div>" +
        "<div class='pc-opt' id='pc-frameopt' style='display:none'><div class='pc-label'>Add a frame <span class='pc-optional'>optional</span></div><div class='pc-grid3 pc-frameopts' id='pc-frames'></div></div>" +

        "<div id='pc-cta'>" +
          "<button class='pc-btn pc-big' id='pc-go' disabled>Create my portrait</button>" +
          "<div class='pc-tiny pc-center' id='pc-gohint' style='margin-top:8px'>Add a photo, your email &amp; a style to preview</div>" +
        "</div>" +
        "<div id='pc-story' class='pc-story'>" +
          "<h3>How it works</h3>" +
          "<ul>" +
            "<li>Upload one clear photo &mdash; your painted preview appears in about a minute</li>" +
            "<li>Tweak it as many times as you like; nothing prints until you approve it</li>" +
            "<li>Printed on gallery-grade cotton canvas, hand-stretched over solid wood in Florida</li>" +
            "<li>Arrives ready to hang, with 1.5&quot; gallery-wrapped edges and hardware included</li>" +
          "</ul>" +
        "</div>" +

        "<div id='pc-post' style='display:none'>" +
          "<div class='pc-versions' id='pc-versions' style='display:none'>" +
            "<div class='pc-vhead'>Your versions <small>every tweak is kept — tap to compare</small></div>" +
            "<div class='pc-vstrip' id='pc-vstrip'></div>" +
          "</div>" +
          "<div class='pc-edit'>" +
            "<div class='pc-edit-head'><b>Change colors or fix something</b><span class='pc-tag pc-tag-inst'>Instant · ~30s</span></div>" +
            "<div class='pc-retry'>" +
              "<input class='pc-field' id='pc-instruction' placeholder=\"e.g. 'warmer tones', 'remove the leash', 'lighter background'\">" +
              "<button class='pc-btn ghost' id='pc-retry'>Apply change</button>" +
            "</div>" +
            "<div class='pc-tiny' style='margin-top:9px'>Want a completely different take? <span id='pc-regen' style='color:var(--pc-acc);cursor:pointer;text-decoration:underline'>Generate a new version</span></div>" +
          "</div>" +
          "<label class='pc-artist'><input type='checkbox' id='pc-artist-check'>" +
            "<span><b>Free artist refinement</b> <span class='pc-tag pc-tag-free'>Free · after you order</span><br>" +
            "Want bigger or very specific changes? A real artist refines your portrait after you order — unlimited revisions by email until you love it. Adds a little to the processing time.</span></label>" +
          "<textarea class='pc-field' id='pc-artist-notes' placeholder='Optional: what should the artist adjust? e.g. brighten the eyes, remove background objects, match the collar color' style='display:none'></textarea>" +
          "<button class='pc-btn pc-big' id='pc-add'>Add to cart →</button>" +
        "</div>" +
        "<label class='pc-digital' id='pc-digital' style='display:none'>" +
          "<input type='checkbox' id='pc-digital-check'>" +
          "<span><b>Add the digital file &mdash; $" + esc(DIGITAL_PRICE) + "</b><br>" +
          "Full-resolution download, sent when your proof is approved. Print more, or share it." +
          "</span></label>" +
        "<div class='pc-err' id='pc-err'></div>" +
        // After the decision, not during it — this is "browse something else", so it belongs
        // below Add to cart rather than between the frame picker and the buy button.
        "<div class='pc-also' id='pc-also' style='display:none'></div>" +
      "</div>" +
    "</div>" +

    // ---- Info accordion (full width) ----
    "<div class='pc-info'>" +
      "<details open><summary>Description</summary>" +
        "<p class='pc-lead'>Your pet, immortalized as a masterpiece.</p>" +
        "<p>We reimagine your beloved pet as an original work of art — capturing their personality and expression in rich detail. Printed on gallery-grade cotton canvas and hand-stretched over solid wood, it arrives ready to hang straight out of the box. Add an ornate gilt frame if you’d like the full heirloom treatment.</p>" +
        "<ul><li>Gallery-grade cotton canvas, made &amp; framed in Florida</li><li>Ready to hang — gallery-wrapped 1.5&quot; edges, hardware included</li><li>Approve your preview before anything is printed</li><li>Unlimited revisions until it’s exactly right</li><li>Free shipping on every order</li></ul>" +
      "</details>" +
      "<details id='pc-guide'><summary>Size guide</summary>" +
        "<svg viewBox='0 0 760 600' width='100%' style='max-width:560px;display:block;margin:8px auto 4px' xmlns='http://www.w3.org/2000/svg'>" +
          "<g fill='none' stroke='#b7986a' stroke-width='2'>" +
            "<rect x='220' y='40' width='320' height='240' rx='3'/><rect x='227' y='47' width='306' height='226' rx='2' stroke='#d8c39a'/>" +
            "<rect x='252' y='88' width='256' height='192' rx='3'/><rect x='259' y='95' width='242' height='178' rx='2' stroke='#d8c39a'/>" +
            "<rect x='284' y='136' width='192' height='144' rx='3'/><rect x='291' y='143' width='178' height='130' rx='2' stroke='#d8c39a'/>" +
          "</g>" +
          "<g fill='#3a2f28' font-family='Playfair Display,Georgia,serif' font-size='20' text-anchor='middle'>" +
            "<text x='380' y='71'>40 × 30</text><text x='380' y='119'>32 × 24</text><text x='380' y='214'>24 × 18</text>" +
          "</g>" +
          "<g fill='#c4ad84'>" +
            "<rect x='60' y='348' width='640' height='72' rx='24'/>" +
            "<rect x='44' y='372' width='90' height='120' rx='22'/><rect x='626' y='372' width='90' height='120' rx='22'/>" +
            "<rect x='110' y='406' width='540' height='80' rx='16'/>" +
            "<rect x='150' y='486' width='15' height='24' rx='3'/><rect x='330' y='486' width='15' height='24' rx='3'/><rect x='415' y='486' width='15' height='24' rx='3'/><rect x='595' y='486' width='15' height='24' rx='3'/>" +
          "</g>" +
          "<line x1='378' y1='406' x2='378' y2='486' stroke='#ac9569' stroke-width='2'/>" +
          "<line x1='40' y1='510' x2='720' y2='510' stroke='#dcccae' stroke-width='2'/>" +
          "<text x='380' y='550' fill='#8a7d68' font-family='Playfair Display,Georgia,serif' font-style='italic' font-size='15' text-anchor='middle'>All sizes in inches — shown to scale against a standard 84&quot; sofa</text>" +
        "</svg>" +
        "<p class='pc-tiny' style='text-align:center'>Measured in inches &middot; landscape 4:3 &middot; printed on gallery-grade canvas. Frame optional &mdash; sizes shown are the canvas; a frame adds about 1&ndash;2&quot; on each side.</p></details>" +
      "<details><summary>Guarantee</summary><p>Love it, or we’ll make it right. Approve your preview before anything prints, get unlimited revisions until it’s perfect, plus a 30-day happiness guarantee on every order. Trouble uploading a photo? Place your order and email it to support@petcreationsart.com.</p></details>" +
    "</div>" +
    "</div>";

  // ---- Helpers ------------------------------------------------------------------------
  var $ = function (id) { return document.getElementById(id); };
  function money(c) { return "$" + (c / 100).toFixed(2); }
  function curVar() { return VAR[sel.size + sel.frame]; }
  function priceOf(s, f) { return VAR[s + f][1]; }
  function sizeDelta(c) { return priceOf(c, sel.frame) - priceOf("S", sel.frame); }
  // A frame is only offered if its variant actually exists in the map, so a half-finished Shopify
  // rollout hides the option instead of white-screening on an undefined variant.
  function hasVar(c) { return SIZES.every(function (s) { return VAR[s.code + c]; }); }
  function liveFrames() { return FRAMES.filter(function (f) { return hasVar(f.code); }); }
  function baseFrame() { return hasVar("U") ? "U" : "G"; }
  function frameDelta(c) { return priceOf(sel.size, c) - priceOf(sel.size, baseFrame()); }
  function frameByCode(c) { return FRAMES.filter(function (f) { return f.code === c; })[0]; }
  function labelOf(arr, c) { var x = arr.filter(function (o) { return o.code === c; })[0]; return x ? x.label : c; }
  function validEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((v || "").trim()); }
  function up(cents, zero) { return cents > 0 ? "<small class='pc-up'>+$" + (cents / 100).toFixed(0) + "</small>" : "<small>" + (zero || "&nbsp;") + "</small>"; }

  // ---- Renderers ----------------------------------------------------------------------
  function renderPrice() {
    var v = curVar(), save = v[2] > v[1] ? Math.round((1 - v[1] / v[2]) * 100) : 0;
    $("pc-pricerow").innerHTML = "<ins>" + money(v[1]) + "</ins>" +
      (v[2] > v[1] ? "<del>" + money(v[2]) + "</del><span class='pc-save'>SAVE " + save + "%</span>" : "");
  }
  // Step 2 is whatever the page still needs choosing:
  //   combined page      -> the style grid
  //   locked page w/ opts -> that style's options (e.g. which sport)
  //   locked page, no opts -> nothing to choose, so the step disappears
  function renderStyles() {
    var box = $("pc-styleopt"), grid = $("pc-styles"), lab = $("pc-stylelabel");
    var list = pageStyles(), vs = variantsFor();
    // One style with options -> pick the option. One style without -> nothing to choose, hide the
    // step entirely. Two or more -> the style grid.
    if (list.length === 1 && !vs) { box.style.display = "none"; return; }
    box.style.display = "block";
    if (list.length === 1 && vs) {
      lab.innerHTML = (styleCfg() && styleCfg().vlabel) || "Choose your sport";
      grid.innerHTML = vs.map(function (v) {
        return "<div class='pc-oc" + (sel.variant === v.code ? " sel" : "") + "' data-variant='" + v.code + "'>" +
          (v.img ? "<img class='pc-varimg' src='" + v.img + "' alt='" + v.label + "'>" : "") +
          (v.sw ? "<div class='pc-sw'>" + v.sw.map(function (c) {
            return "<i style='background:" + c + "'></i>"; }).join("") + "</div>" : "") +
          "<b class='pc-serifname'>" + v.label + "</b></div>";
      }).join("");
      return;
    }
    lab.innerHTML = "Choose your style";
    grid.innerHTML = list.map(function (s) {
      return "<div class='pc-oc" + (sel.style === s.code ? " sel" : "") + "' data-style='" + s.code + "'>" +
        "<img class='pc-styleimg' src='" + API + "/app/examples/" + s.code + ".jpg' alt='" + s.label + "'>" +
        "<b class='pc-serifname'>" + s.label + "</b><small>" + s.sub + "</small></div>";
    }).join("");
  }
  // A style with options needs one chosen before it can generate.
  function normalizeSel() {
    var vs = variantsFor();
    if (!vs) { sel.variant = null; return; }
    if (!vs.filter(function (v) { return v.code === sel.variant; }).length) sel.variant = vs[0].code;
  }
  function renderSizes() {
    $("pc-sizes").innerHTML = SIZES.map(function (s) {
      var pop = s.code === "M" ? "<span class='pc-pop'>Most popular</span>" : "";
      return "<div class='pc-oc" + (sel.size === s.code ? " sel" : "") + "' data-size='" + s.code + "'>" + pop + "<b>" + s.label + "</b>" + up(sizeDelta(s.code), "Standard") + "</div>";
    }).join("");
  }
  function renderFrames() {
    // The unframed swatch shows the customer's own art once they have a preview (else a sample),
    // bare and edge-lit — so it reads as "same art, no frame" beside the three frame mockups.
    var r = curRes(), bareArt = r ? r.preview + "?t=" + r.bust : API + "/app/examples/oil.jpg";
    $("pc-frames").innerHTML = liveFrames().map(function (f) {
      var swatch = f.bare
        ? "<div class='pc-swatch'><i style=\"background-image:url('" + bareArt + "')\"></i></div>"
        : "<img src='" + f.img + "' alt='" + f.label + "'>";
      return "<div class='pc-oc" + (sel.frame === f.code ? " sel" : "") + "' data-frame='" + f.code + "'>" + swatch +
        "<b style='font-size:12px'>" + f.label + "</b>" + up(frameDelta(f.code), f.bare ? "Ready to hang" : "") + "</div>";
    }).join("");
  }
  function renderOptions() { renderSizes(); renderFrames(); renderPrice(); }

  // Unframed renders as a gallery wrap: the bare art with wrap-depth shading (no mockup image).
  function artIn(f, art, cls, wrapCls) {
    var w = wrapCls ? " " + wrapCls : "";
    if (f.bare) return "<div class='pc-canvas" + w + "'><img src='" + art + "'></div>";
    return "<div class='pc-framed" + w + "'><img class='pc-fimg' src='" + f.img + "'>" +
      "<img class='" + cls + "' src='" + art + "' style='left:" + f.l + "%;top:" + f.t + "%;width:" + f.w + "%;height:" + f.h + "%'></div>";
  }
  function framedHTML(cls, wrapCls) {
    var r = curRes();
    return artIn(frameByCode(sel.frame), r.preview + "?t=" + r.bust, cls, wrapCls);
  }
  // Room view: the piece sized against the room's 60" loveseat, so 24x18 vs 40x30 — and the
  // difference a wider moulding makes — is something you can see rather than read.
  function wallHTML() {
    var r = curRes(), f = frameByCode(sel.frame), art = r.preview + "?t=" + r.bust;
    var sz = SIZES.filter(function (s) { return s.code === sel.size; })[0] || SIZES[0];
    var w, h, inner;
    if (f.bare) {
      w = sz.in * WALL_PPI;                          // canvas only
      h = w * 1.125;                                 // 4:3 art inside a 3:2 room photo
      inner = "<img src='" + art + "'>";
    } else {
      w = (sz.in + 2 * f.mould) * WALL_PPI;          // canvas + moulding on both sides
      h = w / (f.ar * ROOM_HW);
      inner = "<img class='pc-wfimg' src='" + f.cutImg + "'>" +
        "<img class='pc-wfart' src='" + art + "' style='left:" + f.cut.l + "%;top:" + f.cut.t +
        "%;width:" + f.cut.w + "%;height:" + f.cut.h + "%'>";
    }
    return "<div class='pc-wall'><img class='pc-wallbg' src='" + API + "/app/wall/room.webp' alt='Room'>" +
      "<div class='pc-wallart" + (f.bare ? " bare" : "") + "' style='width:" + w.toFixed(1) +
        "%;height:" + h.toFixed(1) + "%;top:" + (WALL_BASE - h).toFixed(1) + "%'>" + inner + "</div>" +
      "<div class='pc-wallcap'><span>Shown to scale &middot; " + sz.label +
        (f.bare ? " gallery-wrapped canvas" : " in " + f.label) + "</span></div></div>";
  }
  function renderViewTabs() {
    var box = $("pc-viewtabs");
    box.style.display = curRes() ? "flex" : "none";
    [].forEach.call(box.querySelectorAll("[data-view]"), function (b) {
      b.className = b.getAttribute("data-view") === view ? "sel" : "";
    });
  }
  function renderHero() {
    if (heroPick) $("pc-hero").innerHTML = "<img src='" + heroPick + "'>";
    else if (curRes()) $("pc-hero").innerHTML = view === "wall" ? wallHTML() : framedHTML("pc-fart");
    else $("pc-hero").innerHTML = "<img src='" + pageExamples()[0] + "'>";
  }
  function updateGo() {
    var ok = file && sel.style && validEmail($("pc-email").value);
    $("pc-go").disabled = !ok;
    $("pc-gohint").style.display = ok ? "none" : "block";
  }
  // Only worth showing once there's something to compare against.
  function renderMini() {
    var box = $("pc-mini");
    if (!box) return;
    var r = curRes();
    if (!r) { box.classList.remove("on"); root.classList.remove("pcmini-pad"); box.innerHTML = ""; return; }
    var f = frameByCode(sel.frame), sz = SIZES.filter(function (x) { return x.code === sel.size; })[0];
    box.innerHTML = artIn(f, r.preview + "?t=" + r.bust, "pc-fart") +
      "<div class='m'><b>" + esc(sz ? sz.label : "") + "</b><span>" + esc(f.label) + "</span></div>" +
      "<button type='button' class='pc-mini-wall' id='pc-mini-wall'>See it on the wall</button>";
    box.classList.add("on");
  }

  function renderVersions() {
    var s = curSet(), box = $("pc-versions");
    if (!s || s.list.length < 2) { box.style.display = "none"; return; }
    box.style.display = "block";
    $("pc-vstrip").innerHTML = s.list.map(function (r, i) {
      return "<button class='pc-vthumb" + (i === s.i ? " sel" : "") + "' data-ver='" + i + "'>" +
        "<img src='" + r.preview + "?t=" + r.bust + "'><b>" + (i ? "v" + (i + 1) : "First") + "</b></button>";
    }).join("");
  }
  function selectVersion(i) {
    var s = curSet(); if (!s || !s.list[i]) return;
    s.i = i; heroPick = null;
    renderVersions(); renderFrames(); renderHero();
  }
  function refreshPhase() {
    renderVersions(); renderViewTabs(); renderMini();
    var cfg = styleCfg();
    $("pc-memopt").style.display = (cfg && cfg.memorial) ? "block" : "none";
    $("pc-defopt").style.display = (cfg && cfg.definition) ? "block" : "none";
    // Offer the file only once they've seen art. Before that it's an abstract upsell.
    $("pc-digital").style.display = (fresh && DIGITAL_ID) ? "flex" : "none";
    var fresh = !!curRes();
    // Progressive disclosure: before a preview exists the page asks for a photo and a style and
    // nothing else. Size, frame and the example strip only appear once there's art to apply them
    // to — the fewer decisions there are before someone sees their pet, the further they get.
    $("pc-sizeopt").style.display = fresh ? "block" : "none";
    $("pc-frameopt").style.display = fresh ? "block" : "none";
    $("pc-post").style.display = fresh ? "block" : "none";
    $("pc-cta").style.display = fresh ? "none" : "block";
    $("pc-story").style.display = fresh ? "none" : "block";
    $("pc-go").textContent = "Create my portrait";
    $("pc-heronote").textContent = fresh
      ? "Preview is watermarked — your final artwork is clean, full-resolution & hand-checked before printing."
      : "Upload your pet’s photo — your live preview appears here in ~60 seconds.";
    updateGo();
  }
  function selectFrame(code) { sel.frame = code; renderOptions(); renderHero(); renderMini(); }

  // ---- Network ------------------------------------------------------------------------
  function post(path, form) {
    return fetch(API + path, { method: "POST", body: form }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return { detail: r.statusText }; }).then(function (j) { throw new Error(j.detail || "error"); });
      return r.json();
    });
  }
  function loading() {
    $("pc-err").textContent = "";
    $("pc-hero").innerHTML = "<div class='pc-center pc-loading'><div class='pc-spin'></div><div class='pc-tiny' id='pc-loadmsg'></div><div class='pc-loadrev' id='pc-loadrev'></div></div>";
    var i = 0, j = 0;
    function tick() {
      var m = $("pc-loadmsg"); if (m) m.textContent = LOADING[i % LOADING.length];
      var rv = $("pc-loadrev");
      if (rv && i % 2 === 0) {
        var rev = REVIEWS[j % REVIEWS.length]; j++;
        rv.innerHTML = "<div class='pc-lr-stars'>★★★★★</div><div class='pc-lr-t'>“" + rev.t + "”</div><div class='pc-lr-n'>— " + rev.n + "</div>";
        rv.style.animation = "none"; void rv.offsetWidth; rv.style.animation = "pcfade .5s ease";
      }
      i++;
    }
    tick(); timer = setInterval(tick, 3000);
    $("pc-hero").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function stop() { clearInterval(timer); }
  function show(d, key) {
    addRes(key || resKey(), { id: d.id, preview: API + d.preview_url, full: API + d.full_url,
                              original: d.original_url ? API + d.original_url : "", bust: Date.now() });
    heroPick = null;
    renderFrames(); renderHero();   // renderFrames: swap the unframed swatch to their art
    $("pc-retry").disabled = false; $("pc-instruction").disabled = false;
    refreshPhase();
    // Land on the artwork, not the buy panel. #pc-post sits below the size and frame pickers,
    // so scrolling to it dumped people at the bottom of the page having never seen the preview
    // they just waited a minute for.
    $("pc-hero").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function doGenerate(style) {
    if (!file || !style) return;
    var key = resKey();                      // capture now — they may switch while it renders
    loading();
    var fd = new FormData();
    fd.append("file", file); fd.append("style", style); fd.append("email", $("pc-email").value.trim());
    if (sel.variant) fd.append("variant", sel.variant);
    var dcfg = styleCfg();
    if (dcfg && dcfg.definition) {
      var dn = $("pc-def-name").value.trim(), db = $("pc-def-body").value.trim();
      if (dn && db) {
        fd.append("text_layout", "definition");
        fd.append("text_name", dn);
        fd.append("text_phonetic", $("pc-def-phonetic").value.trim());
        fd.append("text_body", db);
      }
    }
    var mcfg = styleCfg(), mname = mcfg && mcfg.memorial ? $("pc-mem-name").value.trim() : "";
    if (mname) {
      fd.append("text_layout", "memorial");
      fd.append("text_name", mname);
      fd.append("text_dates", $("pc-mem-dates").value.trim());
    }
    post("/generate", fd).then(function (d) {
      show(d, key);
      // One Lead per session on the first preview — a real high-intent signal (photo + email +
      // engaged). Gives the ad pixel something to optimize on before purchases accumulate.
      if (!leadFired && window.fbq) {
        try { window.fbq("track", "Lead", { content_name: "Pet portrait preview", content_category: style }); } catch (e) {}
        leadFired = true;
      }
    }).catch(function (e) { renderHero(); $("pc-err").textContent = e.message; }).then(stop, stop);
  }

  // ---- Events -------------------------------------------------------------------------
  $("pc-styles").addEventListener("click", function (e) {
    // Scope to cards INSIDE this grid. On a locked page #pcai-root itself carries data-style,
    // so an unscoped closest("[data-style]") matches the root and swallows every variant click —
    // which silently pinned the sport picker to its default.
    var v = e.target.closest("#pc-styles [data-variant]");
    var s = v ? null : e.target.closest("#pc-styles [data-style]");
    if (s) sel.style = s.getAttribute("data-style");
    else if (v) sel.variant = v.getAttribute("data-variant");
    else return;
    normalizeSel(); heroPick = null;
    renderStyles(); renderFrames(); renderHero(); refreshPhase();
  });
  $("pc-sizes").addEventListener("click", function (e) { var c = e.target.closest("[data-size]"); if (!c) return; sel.size = c.getAttribute("data-size"); renderOptions(); renderMini(); if (view === "wall") renderHero(); });
  $("pc-frames").addEventListener("click", function (e) { var c = e.target.closest("[data-frame]"); if (!c) return; selectFrame(c.getAttribute("data-frame")); });
  $("pc-vstrip").addEventListener("click", function (e) { var b = e.target.closest("[data-ver]"); if (!b) return; selectVersion(+b.getAttribute("data-ver")); });
  $("pc-viewtabs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-view]"); if (!b) return;
    view = b.getAttribute("data-view"); heroPick = null; renderViewTabs(); renderHero();
  });
  // The mini's "See it on the wall" button: switch to the room view and scroll up to the big
  // preview. Delegated because the mini's innerHTML is rebuilt on every render; the element
  // itself is stable (only its contents change).
  $("pc-mini").addEventListener("click", function (e) {
    if (!e.target.closest("#pc-mini-wall")) return;
    view = "wall"; heroPick = null;
    renderViewTabs(); renderHero();
    $("pc-hero").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  $("pc-def-go").addEventListener("click", function () {
    var btn = this, name = $("pc-def-name").value.trim(), quirk = $("pc-def-quirk").value.trim();
    if (!name || !quirk) { $("pc-err").textContent = "Add your pet's name and one thing they do."; return; }
    btn.disabled = true; btn.textContent = "Writing…";
    var fd = new FormData();
    fd.append("name", name); fd.append("quirk", quirk);
    fd.append("greeting", $("pc-def-greet").value.trim());
    fd.append("obsession", $("pc-def-obsess").value.trim());
    fetch(API + "/definition-copy", { method: "POST", body: fd })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        btn.disabled = false; btn.textContent = "Write my definition";
        // A failure still opens the fields — they can write their own rather than lose the sale.
        $("pc-def-out").style.display = "block";
        if (d && d.ok) {
          $("pc-def-phonetic").value = d.phonetic || "";
          $("pc-def-body").value = d.body || "";
        } else {
          $("pc-err").textContent = "Couldn't draft it — write your own below and it'll print exactly as typed.";
        }
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = "Write my definition";
        $("pc-def-out").style.display = "block";
        $("pc-err").textContent = "Couldn't reach us — write your own below.";
      });
  });
  $("pc-guidelink").addEventListener("click", function () { var d = $("pc-guide"); d.open = true; d.scrollIntoView({ behavior: "smooth", block: "center" }); });
  $("pc-file").addEventListener("change", function (e) {
    file = e.target.files[0]; if (!file) return;
    $("pc-dropin").innerHTML = "<img src='" + URL.createObjectURL(file) + "'><div class='pc-tiny'>" + file.name + " &middot; click to change</div>";
    updateGo();
  });
  $("pc-email").addEventListener("input", updateGo);
  $("pc-artist-check").addEventListener("change", function () { $("pc-artist-notes").style.display = this.checked ? "block" : "none"; });

  $("pc-go").addEventListener("click", function () {
    if (!(file && sel.style && validEmail($("pc-email").value))) return;
    doGenerate(sel.style);
  });
  $("pc-regen").addEventListener("click", function () {
    if (!file || !sel.style) return;
    doGenerate(sel.style);
  });
  $("pc-retry").addEventListener("click", function () {
    var r = curRes(), ins = $("pc-instruction").value.trim(); if (!ins || !r) return;
    // File the recolored result under the SAME full key doGenerate used — style + variant.
    // This was sel.style (style only), so a retry on a variant style (Game Day, Definition, Bold
    // Color) stored the new image under "sport" while the hero read "sport:pickleball" — the change
    // landed on the server but the display kept showing the old image ("nothing happened").
    var genKey = resKey();
    loading();
    var fd = new FormData(); fd.append("id", r.id); fd.append("instruction", ins);
    post("/retry", fd).then(function (d) { show(d, genKey); $("pc-instruction").value = ""; })
      .catch(function (e) {
        renderHero();
        // Be explicit that it FAILED and the image is unchanged — a bare old image + tiny red text
        // reads as "nothing happened", so people don't know to try again.
        $("pc-err").textContent = "Couldn't apply that change — " + e.message + " Your image is unchanged; please try again.";
        $("pc-err").scrollIntoView({ behavior: "smooth", block: "center" });
      }).then(stop, stop);
  });
  $("pc-add").addEventListener("click", function () {
    if (!variantsTrusted) {
      $("pc-err").textContent = "This page isn't set up for checkout yet — please contact support@petcreationsart.com.";
      return;
    }
    var v = curVar(), r = curRes();
    var props = {
      "Style": labelOf(STYLES, sel.style) + (sel.variant ? " — " + labelOf(variantsFor() || [], sel.variant) : ""),
      "_job_id": r ? r.id : "",
      "_preview": r ? r.preview : "", "_fullres": r ? r.full : "", "_original": r ? r.original : ""
    };
    var mc = styleCfg(), mn = mc && mc.memorial ? $("pc-mem-name").value.trim() : "";
    if (mn) {
      props["Memorial name"] = mn;
      var md = $("pc-mem-dates").value.trim();
      if (md) props["Memorial dates"] = md;
    }
    var dc = styleCfg();
    if (dc && dc.definition && $("pc-def-name").value.trim()) {
      props["Definition name"] = $("pc-def-name").value.trim();
      var db2 = $("pc-def-body").value.trim();
      if (db2) props["Definition text"] = db2;
    }
    if ($("pc-artist-check").checked) {
      props["Artist refinement"] = "Yes — free, after order (unlimited revisions by email)";
      var n = $("pc-artist-notes").value.trim(); if (n) props["Artist notes"] = n;
    }
    $("pc-add").disabled = true; $("pc-add").textContent = "Adding…";
    var items = [{ id: v[0], quantity: 1, properties: props }];
    if (DIGITAL_ID && $("pc-digital-check").checked) {
      items.push({ id: parseInt(DIGITAL_ID, 10), quantity: 1,
                   properties: { "For artwork": props["_job_id"] || "see canvas line" } });
    }
    fetch("/cart/add.js", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items })
    }).then(function (r) { return r.json(); }).then(function () { window.location.href = "/cart"; })
      .catch(function () { $("pc-add").disabled = false; $("pc-add").textContent = "Add to cart →"; alert("Could not add to cart."); });
  });

  function renderAlsoLike() {
    var box = $("pc-also");
    if (!box || !ALSO_COLLECTION) return;
    var here = (location.pathname.match(/\/products\/([^\/?#]+)/) || [])[1] || "";
    fetch("/collections/" + ALSO_COLLECTION + "/products.json?limit=16")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var items = (d.products || []).filter(function (p) { return p.handle !== here; }).slice(0, 8);
        if (!items.length) return;
        box.innerHTML = "<div class='pc-also-h'>You may also like</div><div class='pc-also-row'>" +
          items.map(function (p) {
            var im = (p.images && p.images[0] && p.images[0].src) || "";
            if (im) im += (im.indexOf("?") > -1 ? "&" : "?") + "width=420";
            var pr = p.variants && p.variants[0] ? p.variants[0].price : "";
            return "<a class='pc-also-card' href='/products/" + esc(p.handle) + "'>" +
              "<img loading='lazy' src='" + esc(im) + "' alt='" + esc(p.title) + "'>" +
              "<div class='pc-also-t'>" + esc(p.title) + "</div>" +
              (pr ? "<div class='pc-also-p'>From $" + esc(pr) + "</div>" : "") + "</a>";
          }).join("") + "</div>";
        box.style.display = "block";
      })
      .catch(function () { });   // a missing collection shouldn't break the page
  }

  // ---- Init ---------------------------------------------------------------------------
  // The theme's "Embed code" block wraps us in a narrow (~800px), overflow:hidden container that
  // caps the width and clips both edges. Widen + unclip every ancestor up to the full-width section
  // so the generator can fill the real product-section width. Re-run on resize for safety.
  function unclip() {
    // Only widen on desktop. The narrow ~800px wrapper this works around is a desktop layout;
    // mobile containers are already full-bleed. Stripping overflow:hidden off every ancestor on
    // a phone removed guards the THEME relies on and let the whole page scroll sideways — that
    // is what was clipping the header and the artwork on the right.
    var wide = window.innerWidth >= 750;
    var p = root.parentElement;
    while (p && p !== document.body) {
      if (wide) {
        var cs = getComputedStyle(p);
        var mw = parseFloat(cs.maxWidth);
        if (!isNaN(mw) && mw < 1400) p.style.maxWidth = "none";
        if (cs.overflowX === "hidden") p.style.overflowX = "visible";
        if (cs.overflowY === "hidden") p.style.overflowY = "visible";
      } else if (p.style.maxWidth || p.style.overflowX || p.style.overflowY) {
        p.style.maxWidth = ""; p.style.overflowX = ""; p.style.overflowY = "";
      }
      p = p.parentElement;
    }
  }
  unclip();
  window.addEventListener("resize", unclip);
  // Move the fixed mini out to <body>: with no widget ancestors, nothing can clip it
  // and its containing block is unambiguously the viewport.
  if ($("pc-mini")) document.body.appendChild($("pc-mini"));
  renderAlsoLike();   // independent of the generator — safe to fire once, immediately

  // Render immediately from the baked-in map, then silently re-render once the page's real
  // Shopify variants land — so prices are never stale but the widget never waits on a fetch.
  var booted = false;
  function boot() {
    if (!booted) { sel.frame = baseFrame(); normalizeSel(); booted = true; }
    renderStyles(); renderOptions(); renderHero(); refreshPhase();
  }
  boot();
  loadLiveVariants().then(boot);
})();
