/* Pet Creations AI — embeddable storefront widget (full product section).
 * <div id="pcai-root"></div>
 * <script src="https://YOUR-BACKEND/app/widget.js"></script>
 *
 * Renders a complete, native-looking product section (image gallery + buy box) so it can
 * REPLACE the theme's product configurator. Live variant pricing (pets x size x frame),
 * AI style preview, instant recolor, real-frame overlay, artist touch-up, add-to-cart.
 */
(function () {
  var script = document.currentScript;
  var API = new URL(script.src).origin;
  var root = document.getElementById("pcai-root");
  if (!root) { console.error("[pcai] #pcai-root not found"); return; }

  // ---- Product data (pulled from the live product feed) -------------------------------
  // key = pets + size(S/M/L) + frame(G=Antique Gold, R=Antique Silver, B=Baroque Gold Wide)
  // value = [variantId, priceCents, compareAtCents]
  var VAR = {"1SG":[48111346254042,15999,19999],"1SR":[48111363915994,15999,19999],"1SB":[48111363948762,20999,26299],"1MG":[48111346286810,19999,24999],"1MR":[48111363981530,19999,24999],"1MB":[48111364014298,25999,32499],"1LG":[48111346319578,26999,33799],"1LR":[48111364047066,26999,33799],"1LB":[48111364079834,33999,42499],"2SG":[48111346385114,18999,23799],"2SR":[48111364178138,18999,23799],"2SB":[48111364210906,23999,29999],"2MG":[48111346417882,22999,28799],"2MR":[48111364243674,22999,28799],"2MB":[48111364276442,28999,36299],"2LG":[48111346450650,25999,32499],"2LR":[48111364309210,25999,32499],"2LB":[48111364341978,36999,46299],"3SG":[48111346516186,21999,27499],"3SR":[48111364440282,21999,27499],"3SB":[48111364473050,26999,33799],"3MG":[48111346548954,25999,32499],"3MR":[48111364505818,25999,32499],"3MB":[48111364538586,31999,39999],"3LG":[48111346581722,32999,41299],"3LR":[48111364571354,32999,41299],"3LB":[48111364604122,39999,49999]};

  var STYLES = [
    { code: "watercolor", label: "Watercolor",   sub: "Soft & elegant" },
    { code: "oil",        label: "Oil Painting",  sub: "Museum oil" },
    { code: "heritage",   label: "Heritage",      sub: "Regal heirloom" }
  ];
  var PETS = [
    { code: "1", label: "1 pet" }, { code: "2", label: "2 pets" }, { code: "3", label: "3 pets" }
  ];
  var SIZES = [
    { code: "S", label: "24 × 18\"" }, { code: "M", label: "32 × 24\"" }, { code: "L", label: "40 × 30\"" }
  ];
  var FRAMES = [
    { code: "G", key: "antique_gold",   label: "Antique Gold",       l: 7.5, t: 8, w: 85, h: 84 },
    { code: "R", key: "antique_silver", label: "Antique Silver",     l: 8,   t: 8, w: 84, h: 84 },
    { code: "B", key: "baroque_gold",   label: "Baroque Gold (Wide)", l: 9.5, t: 9, w: 81, h: 82 }
  ];
  FRAMES.forEach(function (f) { f.img = API + "/app/frames/" + f.key + ".webp"; });

  var CDN = "https://cdn.shopify.com/s/files/1/0055/0957/8803/files/";
  var EXAMPLES = [
    CDN + "ChatGPTImageJun23_2026_09_21_46PM.png",
    CDN + "image0_9_dc9c6ca1-b37a-4302-b2b6-915e82b8439e.png",
    CDN + "ChatGPT_Image_Jun_23_2026_10_21_29_PM.png",
    CDN + "ChatGPT_Image_Jun_23_2026_10_23_53_PM.png",
    CDN + "ChatGPT_Image_Jun_24_2026_08_40_37_PM.png",
    CDN + "ChatGPT_Image_Jun_5_2026_07_05_06_PM.png"
  ];
  var LOADING = ["Studying your pet’s features…", "Preparing the canvas…", "Mixing the paints…", "Applying brushstrokes…", "Adding the finishing details…"];

  // ---- State --------------------------------------------------------------------------
  var sel = { style: null, pets: "1", size: "S", frame: "G" };
  var file = null, currentId = null, currentPreview = null, generatedStyle = null;
  var heroExample = EXAMPLES[0], cacheBust = 0, timer = null;

  // ---- Markup -------------------------------------------------------------------------
  root.innerHTML = "" +
    "<style>" +
    "#pcai-root{--pc-bg:#f3ecde;--pc-ink:#343434;--pc-mut:#8a7d68;--pc-line:#dfd2b8;--pc-card:#fffdf7;--pc-acc:#5e1622;--pc-gold:#b08d57;--pc-serif:'Playfair Display',Georgia,serif;background:var(--pc-bg);color:var(--pc-ink);font-family:inherit}" +
    "#pcai-root *{box-sizing:border-box}" +
    "#pcai{max-width:1180px;margin:0 auto;padding:34px 20px 6px}" +
    "#pcai .pc-wrap{display:grid;grid-template-columns:1fr;gap:28px}" +
    "@media(min-width:880px){#pcai .pc-wrap{grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:44px;align-items:start}#pcai .pc-media{position:sticky;top:20px}}" +
    // media
    "#pcai .pc-hero{background:var(--pc-card);border:1px solid var(--pc-line);border-radius:16px;padding:16px;display:flex;align-items:center;justify-content:center;min-height:340px}" +
    "#pcai .pc-hero>img{max-width:100%;max-height:540px;border-radius:8px;box-shadow:0 8px 26px rgba(0,0,0,.14);display:block}" +
    "#pcai .pc-framed{position:relative;display:inline-block;line-height:0;max-width:100%}" +
    "#pcai .pc-framed>.pc-fimg{display:block;max-width:100%;max-height:540px}" +
    "#pcai .pc-framed>.pc-fart{position:absolute;object-fit:cover}" +
    "#pcai .pc-thumbs{display:flex;gap:9px;margin-top:12px;flex-wrap:wrap}" +
    "#pcai .pc-thumb{width:70px;height:70px;border-radius:10px;overflow:hidden;border:2px solid transparent;cursor:pointer;background:var(--pc-card);padding:0;line-height:0}" +
    "#pcai .pc-thumb.sel{border-color:var(--pc-acc)}" +
    "#pcai .pc-thumb img{width:100%;height:100%;object-fit:cover}" +
    "#pcai .pc-thumb .pc-framed,#pcai .pc-thumb .pc-fimg{width:100%;height:100%}" +
    "#pcai .pc-thumb .pc-fimg{object-fit:cover}" +
    "#pcai .pc-heronote{font-size:12px;color:var(--pc-mut);text-align:center;margin-top:11px}" +
    "#pcai .pc-spin{width:40px;height:40px;border:4px solid var(--pc-line);border-top-color:var(--pc-acc);border-radius:50%;animation:pcspin 1s linear infinite;margin:0 auto 12px}" +
    "@keyframes pcspin{to{transform:rotate(360deg)}}" +
    // buy column
    "#pcai .pc-eyebrow{font-size:11px;letter-spacing:.18em;color:var(--pc-mut);text-transform:uppercase;font-weight:600}" +
    "#pcai .pc-title{font-family:var(--pc-serif);font-size:30px;line-height:1.12;font-weight:700;margin:6px 0 10px;color:var(--pc-ink)}" +
    "#pcai .pc-pricerow{display:flex;align-items:center;gap:10px;flex-wrap:wrap}" +
    "#pcai .pc-pricerow ins{font-size:26px;font-weight:700;text-decoration:none;font-family:var(--pc-serif)}" +
    "#pcai .pc-pricerow del{color:var(--pc-mut);font-size:16px}" +
    "#pcai .pc-save{background:var(--pc-gold);color:#181311;font-size:11px;font-weight:700;letter-spacing:.03em;padding:3px 9px;border-radius:100px}" +
    "#pcai .pc-gift{font-size:12.5px;color:var(--pc-acc);background:rgba(94,22,34,.06);border-radius:8px;padding:8px 11px;margin:12px 0 0}" +
    "#pcai .pc-badges{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0 4px}" +
    "#pcai .pc-badge{border:1px solid var(--pc-line);border-radius:12px;padding:10px 6px;text-align:center;background:var(--pc-card)}" +
    "#pcai .pc-badge span{font-size:18px;display:block;line-height:1}" +
    "#pcai .pc-badge b{display:block;font-size:12px;margin-top:4px}" +
    "#pcai .pc-badge small{font-size:10px;color:var(--pc-mut)}" +
    "#pcai .pc-opt{margin:18px 0 0}" +
    "#pcai .pc-label{font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:var(--pc-mut);margin:0 0 8px;display:flex;justify-content:space-between;align-items:center}" +
    "#pcai .pc-guidelink{font-size:11px;color:var(--pc-acc);cursor:pointer;text-transform:none;letter-spacing:0;text-decoration:underline}" +
    "#pcai .pc-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}" +
    "#pcai .pc-oc{border:1.5px solid var(--pc-line);background:var(--pc-card);border-radius:11px;padding:11px 8px;text-align:center;cursor:pointer;transition:.12s}" +
    "#pcai .pc-oc:hover{border-color:var(--pc-mut)}" +
    "#pcai .pc-oc.sel{border-color:var(--pc-acc);box-shadow:0 0 0 3px rgba(94,22,34,.13)}" +
    "#pcai .pc-oc b{display:block;font-size:14px}" +
    "#pcai .pc-oc b.pc-serifname{font-family:var(--pc-serif);font-size:16px}" +
    "#pcai .pc-oc small{display:block;font-size:11px;color:var(--pc-mut);margin-top:2px;min-height:14px}" +
    "#pcai .pc-oc small.pc-up{color:var(--pc-acc);font-weight:600}" +
    "#pcai .pc-frameopts .pc-oc{padding:7px 6px}" +
    "#pcai .pc-frameopts .pc-oc img{width:100%;height:50px;object-fit:contain;display:block;margin-bottom:4px}" +
    "#pcai .pc-drop{display:block;border:2px dashed var(--pc-line);border-radius:12px;padding:20px;text-align:center;cursor:pointer;background:var(--pc-card)}" +
    "#pcai .pc-drop:hover{border-color:var(--pc-acc)}" +
    "#pcai .pc-drop input{display:none}" +
    "#pcai .pc-drop img{max-height:160px;border-radius:9px}" +
    "#pcai .pc-dropicon{font-size:26px}" +
    "#pcai .pc-field{width:100%;padding:12px;border:1.5px solid var(--pc-line);border-radius:9px;font-size:14px;margin-top:10px;font-family:inherit;background:#fff;color:var(--pc-ink)}" +
    "#pcai textarea.pc-field{min-height:60px;resize:vertical}" +
    "#pcai .pc-btn{background:var(--pc-acc);color:#fff;border:0;border-radius:100px;padding:15px 26px;font-size:15px;font-weight:600;letter-spacing:.4px;cursor:pointer;font-family:inherit}" +
    "#pcai .pc-btn:hover{filter:brightness(1.08)}" +
    "#pcai .pc-btn[disabled]{opacity:.4;cursor:not-allowed;filter:none}" +
    "#pcai .pc-btn.pc-big{display:block;width:100%;margin-top:16px}" +
    "#pcai .pc-btn.ghost{background:transparent;color:var(--pc-acc);border:1.5px solid var(--pc-acc);padding:12px 18px;letter-spacing:.2px}" +
    "#pcai .pc-retry{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}" +
    "#pcai .pc-retry .pc-field{flex:1;min-width:180px;margin-top:0}" +
    "#pcai .pc-artist{display:flex;gap:9px;align-items:flex-start;font-size:13.5px;margin:14px 0 2px;cursor:pointer;line-height:1.45}" +
    "#pcai .pc-artist input{margin-top:3px}" +
    "#pcai .pc-ready{font-size:12px;color:var(--pc-mut);text-align:center;margin-top:16px;border-top:1px solid var(--pc-line);padding-top:13px}" +
    "#pcai .pc-tiny{font-size:12px;color:var(--pc-mut)}" +
    "#pcai .pc-center{text-align:center}" +
    "#pcai .pc-err{color:#a33;font-size:14px;text-align:center;margin-top:8px}" +
    // info accordion
    "#pcai-root .pc-info{max-width:1180px;margin:24px auto 0;padding:0 20px 34px}" +
    "#pcai-root .pc-info details{border-top:1px solid var(--pc-line)}" +
    "#pcai-root .pc-info summary{cursor:pointer;padding:15px 0;font-family:var(--pc-serif);font-size:17px;font-weight:600;list-style:none;color:var(--pc-ink)}" +
    "#pcai-root .pc-info summary::-webkit-details-marker{display:none}" +
    "#pcai-root .pc-info summary::after{content:'+';float:right;color:var(--pc-mut);font-size:20px;line-height:1}" +
    "#pcai-root .pc-info details[open] summary::after{content:'–'}" +
    "#pcai-root .pc-info p,#pcai-root .pc-info ul{font-size:14px;line-height:1.62;margin:0 0 12px;color:#4a4038}" +
    "#pcai-root .pc-info .pc-lead{font-family:var(--pc-serif);font-size:18px;color:var(--pc-ink);margin-bottom:8px}" +
    "#pcai-root .pc-info ul{padding-left:18px}#pcai-root .pc-info li{margin:4px 0}" +
    "#pcai-root .pc-sizeviz{display:flex;align-items:flex-end;gap:18px;margin:10px 0 8px;flex-wrap:wrap}" +
    "#pcai-root .pc-sizebox{border:2px solid var(--pc-acc);border-radius:4px;background:rgba(94,22,34,.05);display:flex;align-items:center;justify-content:center;text-align:center;font-size:11px;font-weight:600;color:var(--pc-ink)}" +
    "</style>" +

    "<div id='pcai'><div class='pc-wrap'>" +
      // ---- LEFT: media ----
      "<div class='pc-media'>" +
        "<div class='pc-hero' id='pc-hero'></div>" +
        "<div class='pc-thumbs' id='pc-thumbs'></div>" +
        "<div class='pc-heronote' id='pc-heronote'>✨ Upload your pet’s photo — your live preview appears here in ~60 seconds.</div>" +
      "</div>" +
      // ---- RIGHT: buy box ----
      "<div class='pc-buy'>" +
        "<div class='pc-eyebrow'>Heirloom Pet Art</div>" +
        "<h1 class='pc-title'>Custom Heritage Framed Pet Portrait</h1>" +
        "<div class='pc-pricerow' id='pc-pricerow'></div>" +
        "<div class='pc-gift'>🎁 Order today — your digital proof arrives within 2 business days.</div>" +
        "<div class='pc-badges'>" +
          "<div class='pc-badge'><span>🚚</span><b>Fast &amp; Free</b><small>shipping</small></div>" +
          "<div class='pc-badge'><span>⚡</span><b>60-Second</b><small>instant preview</small></div>" +
          "<div class='pc-badge'><span>💖</span><b>30-Day</b><small>happiness guarantee</small></div>" +
        "</div>" +

        "<div class='pc-opt'><div class='pc-label'>1 &middot; Choose your style</div><div class='pc-grid3' id='pc-styles'></div></div>" +
        "<div class='pc-opt'><div class='pc-label'>2 &middot; How many pets / people</div><div class='pc-grid3' id='pc-pets'></div></div>" +
        "<div class='pc-opt'><div class='pc-label'>3 &middot; Choose your size <span class='pc-guidelink' id='pc-guidelink'>📐 Size guide</span></div><div class='pc-grid3' id='pc-sizes'></div></div>" +
        "<div class='pc-opt'><div class='pc-label'>4 &middot; Choose your frame</div><div class='pc-grid3 pc-frameopts' id='pc-frames'></div></div>" +
        "<div class='pc-opt'><div class='pc-label'>5 &middot; Your pet’s photo</div>" +
          "<label class='pc-drop' id='pc-drop'><input type='file' id='pc-file' accept='image/*'>" +
          "<div id='pc-dropin'><div class='pc-dropicon'>🐾</div><div class='pc-tiny'>Click to upload a clear, well-lit photo</div></div></label>" +
          "<input class='pc-field' id='pc-email' type='email' placeholder='Your email (so we can send your previews)'>" +
        "</div>" +

        "<div id='pc-cta'>" +
          "<button class='pc-btn pc-big' id='pc-go' disabled>Create my portrait ✨</button>" +
          "<div class='pc-tiny pc-center' id='pc-gohint' style='margin-top:8px'>Add a photo, your email &amp; a style to preview</div>" +
        "</div>" +

        "<div id='pc-post' style='display:none'>" +
          "<div class='pc-retry'>" +
            "<input class='pc-field' id='pc-instruction' placeholder=\"Tweak it — e.g. 'warmer tones', 'remove the leash'\">" +
            "<button class='pc-btn ghost' id='pc-retry'>Recolor / fix</button>" +
          "</div>" +
          "<div class='pc-tiny pc-center' id='pc-left' style='margin-top:8px'></div>" +
          "<label class='pc-artist'><input type='checkbox' id='pc-artist-check'><span><b>Have a real artist perfect it</b> — free. We hand-refine your portrait before printing.</span></label>" +
          "<textarea class='pc-field' id='pc-artist-notes' placeholder='Optional: tell our artist what to adjust — e.g. brighten the eyes, warmer background' style='display:none'></textarea>" +
          "<button class='pc-btn pc-big' id='pc-add'>Add to cart →</button>" +
        "</div>" +
        "<div class='pc-err' id='pc-err'></div>" +
        "<div class='pc-ready'>⚡ Artwork ready in 2–3 days &middot; Approve a digital proof before we print</div>" +
      "</div>" +
    "</div>" +

    // ---- Info accordion (full width) ----
    "<div class='pc-info'>" +
      "<details open><summary>Description</summary>" +
        "<p class='pc-lead'>Your pet, immortalized as a masterpiece.</p>" +
        "<p>We reimagine your beloved pet in the style of an old-world oil painting — capturing their personality and expression in rich, timeless detail. Printed on gallery-grade canvas and framed in your choice of ornate gilt, it’s an heirloom piece made to be passed down for generations.</p>" +
        "<ul><li>Gallery-grade canvas, made &amp; framed in Florida</li><li>Approve a digital proof before anything is printed</li><li>Unlimited revisions until it’s exactly right</li><li>Free shipping on every order</li></ul>" +
      "</details>" +
      "<details id='pc-guide'><summary>Size guide</summary><div class='pc-sizeviz' id='pc-sizeviz'></div><p class='pc-tiny'>Measured in inches &middot; landscape 4:3 &middot; printed on gallery-grade canvas and framed.</p></details>" +
      "<details><summary>Guarantee</summary><p>Love it, or we’ll make it right. Approve a digital proof before anything prints, get unlimited revisions until it’s perfect, plus a 30-day happiness guarantee on every order. Trouble uploading a photo? Place your order and email it to support@petcreationsart.com.</p></details>" +
    "</div>" +
    "</div>";

  // ---- Helpers ------------------------------------------------------------------------
  var $ = function (id) { return document.getElementById(id); };
  function money(c) { return "$" + (c / 100).toFixed(2); }
  function curVar() { return VAR[sel.pets + sel.size + sel.frame]; }
  function priceOf(p, s, f) { return VAR[p + s + f][1]; }
  function petDelta(c) { return priceOf(c, sel.size, sel.frame) - priceOf("1", sel.size, sel.frame); }
  function sizeDelta(c) { return priceOf(sel.pets, c, sel.frame) - priceOf(sel.pets, "S", sel.frame); }
  function frameDelta(c) { return priceOf(sel.pets, sel.size, c) - priceOf(sel.pets, sel.size, "G"); }
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
  function renderStyles() {
    $("pc-styles").innerHTML = STYLES.map(function (s) {
      return "<div class='pc-oc" + (sel.style === s.code ? " sel" : "") + "' data-style='" + s.code + "'><b class='pc-serifname'>" + s.label + "</b><small>" + s.sub + "</small></div>";
    }).join("");
  }
  function renderPets() {
    $("pc-pets").innerHTML = PETS.map(function (p) {
      return "<div class='pc-oc" + (sel.pets === p.code ? " sel" : "") + "' data-pets='" + p.code + "'><b>" + p.label + "</b>" + up(petDelta(p.code)) + "</div>";
    }).join("");
  }
  function renderSizes() {
    $("pc-sizes").innerHTML = SIZES.map(function (s) {
      return "<div class='pc-oc" + (sel.size === s.code ? " sel" : "") + "' data-size='" + s.code + "'><b>" + s.label + "</b>" + up(sizeDelta(s.code), "Standard") + "</div>";
    }).join("");
  }
  function renderFrames() {
    $("pc-frames").innerHTML = FRAMES.map(function (f) {
      return "<div class='pc-oc" + (sel.frame === f.code ? " sel" : "") + "' data-frame='" + f.code + "'><img src='" + f.img + "' alt='" + f.label + "'><b style='font-size:12px'>" + f.label + "</b>" + up(frameDelta(f.code), "Included") + "</div>";
    }).join("");
  }
  function renderOptions() { renderPets(); renderSizes(); renderFrames(); renderPrice(); }

  function framedHTML(cls, wrapCls) {
    var f = frameByCode(sel.frame);
    return "<div class='pc-framed" + (wrapCls ? " " + wrapCls : "") + "'><img class='pc-fimg' src='" + f.img + "'>" +
      "<img class='" + cls + "' src='" + currentPreview + "?t=" + cacheBust + "' style='left:" + f.l + "%;top:" + f.t + "%;width:" + f.w + "%;height:" + f.h + "%'></div>";
  }
  function renderHero() {
    $("pc-hero").innerHTML = currentPreview ? framedHTML("pc-fart") : "<img src='" + heroExample + "'>";
  }
  function renderThumbs() {
    if (currentPreview) {
      $("pc-thumbs").innerHTML = FRAMES.map(function (f) {
        return "<button class='pc-thumb" + (sel.frame === f.code ? " sel" : "") + "' data-frame='" + f.code + "' title='" + f.label + "'>" +
          "<div class='pc-framed'><img class='pc-fimg' src='" + f.img + "'><img class='pc-fart' src='" + currentPreview + "?t=" + cacheBust + "' style='left:" + f.l + "%;top:" + f.t + "%;width:" + f.w + "%;height:" + f.h + "%'></div></button>";
      }).join("");
    } else {
      $("pc-thumbs").innerHTML = EXAMPLES.map(function (src) {
        return "<button class='pc-thumb" + (heroExample === src ? " sel" : "") + "' data-ex='" + src + "'><img src='" + src + "'></button>";
      }).join("");
    }
  }
  function renderSizeViz() {
    var sc = 3.4;
    $("pc-sizeviz").innerHTML = [[24, 18], [32, 24], [40, 30]].map(function (d) {
      return "<div class='pc-sizebox' style='width:" + (d[0] * sc) + "px;height:" + (d[1] * sc) + "px'>" + d[0] + "″ × " + d[1] + "″</div>";
    }).join("");
  }

  function updateGo() {
    var ok = file && sel.style && validEmail($("pc-email").value);
    $("pc-go").disabled = !ok;
    $("pc-gohint").style.display = ok ? "none" : "block";
  }
  function refreshPhase() {
    var fresh = currentPreview && generatedStyle === sel.style;
    $("pc-post").style.display = fresh ? "block" : "none";
    $("pc-cta").style.display = fresh ? "none" : "block";
    $("pc-go").textContent = currentPreview ? "Regenerate ✨" : "Create my portrait ✨";
    $("pc-heronote").textContent = currentPreview
      ? "Preview is watermarked — your final artwork is clean, full-resolution & hand-checked before printing."
      : "✨ Upload your pet’s photo — your live preview appears here in ~60 seconds.";
    updateGo();
  }
  function selectFrame(code) { sel.frame = code; renderOptions(); renderHero(); renderThumbs(); }

  // ---- Network ------------------------------------------------------------------------
  function post(path, form) {
    return fetch(API + path, { method: "POST", body: form }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return { detail: r.statusText }; }).then(function (j) { throw new Error(j.detail || "error"); });
      return r.json();
    });
  }
  function loading() {
    $("pc-err").textContent = "";
    $("pc-hero").innerHTML = "<div class='pc-center'><div class='pc-spin'></div><div class='pc-tiny' id='pc-loadmsg'></div></div>";
    var i = 0; function r() { var m = $("pc-loadmsg"); if (m) m.textContent = LOADING[i % LOADING.length]; i++; }
    r(); timer = setInterval(r, 3200);
    $("pc-hero").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function stop() { clearInterval(timer); }
  function show(d) {
    currentId = d.id; currentPreview = API + d.preview_url; cacheBust = Date.now();
    renderHero(); renderThumbs();
    var left = d.retries_left;
    if (left > 0) { $("pc-left").textContent = left + " free AI tweak" + (left === 1 ? "" : "s") + " left"; $("pc-retry").disabled = false; $("pc-instruction").disabled = false; }
    else { $("pc-left").textContent = "No free AI tweaks left — or let a real artist perfect it below."; $("pc-retry").disabled = true; $("pc-instruction").disabled = true; }
    refreshPhase();
    $("pc-post").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ---- Events -------------------------------------------------------------------------
  $("pc-styles").addEventListener("click", function (e) { var c = e.target.closest("[data-style]"); if (!c) return; sel.style = c.getAttribute("data-style"); renderStyles(); refreshPhase(); });
  $("pc-pets").addEventListener("click", function (e) { var c = e.target.closest("[data-pets]"); if (!c) return; sel.pets = c.getAttribute("data-pets"); renderOptions(); });
  $("pc-sizes").addEventListener("click", function (e) { var c = e.target.closest("[data-size]"); if (!c) return; sel.size = c.getAttribute("data-size"); renderOptions(); });
  $("pc-frames").addEventListener("click", function (e) { var c = e.target.closest("[data-frame]"); if (!c) return; selectFrame(c.getAttribute("data-frame")); });
  $("pc-thumbs").addEventListener("click", function (e) {
    var b = e.target.closest(".pc-thumb"); if (!b) return;
    if (b.getAttribute("data-frame")) selectFrame(b.getAttribute("data-frame"));
    else if (b.getAttribute("data-ex")) { heroExample = b.getAttribute("data-ex"); renderHero(); renderThumbs(); }
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
    loading();
    var fd = new FormData(); fd.append("file", file); fd.append("style", sel.style); fd.append("email", $("pc-email").value.trim());
    post("/generate", fd).then(function (d) { generatedStyle = sel.style; show(d); }).catch(function (e) { renderHero(); $("pc-err").textContent = e.message; }).then(stop, stop);
  });
  $("pc-retry").addEventListener("click", function () {
    var ins = $("pc-instruction").value.trim(); if (!ins || !currentId) return;
    loading();
    var fd = new FormData(); fd.append("id", currentId); fd.append("instruction", ins);
    post("/retry", fd).then(function (d) { show(d); $("pc-instruction").value = ""; }).catch(function (e) { renderHero(); $("pc-err").textContent = e.message; }).then(stop, stop);
  });
  $("pc-add").addEventListener("click", function () {
    var v = curVar();
    var props = {
      "Style": labelOf(STYLES, sel.style), "_ai_job_id": currentId || "", "_ai_preview": currentPreview || ""
    };
    if ($("pc-artist-check").checked) {
      props["Artist touch-up"] = "Yes — hand-refine before printing";
      var n = $("pc-artist-notes").value.trim(); if (n) props["Artist notes"] = n;
    }
    $("pc-add").disabled = true; $("pc-add").textContent = "Adding…";
    fetch("/cart/add.js", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v[0], quantity: 1, properties: props })
    }).then(function (r) { return r.json(); }).then(function () { window.location.href = "/cart"; })
      .catch(function () { $("pc-add").disabled = false; $("pc-add").textContent = "Add to cart →"; alert("Could not add to cart."); });
  });

  // ---- Init ---------------------------------------------------------------------------
  renderStyles(); renderOptions(); renderHero(); renderThumbs(); renderSizeViz(); refreshPhase();
})();
