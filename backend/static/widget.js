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

  // ---- Product data (pulled from the live product feed) -------------------------------
  // key = size(S/M/L) + frame(U=Unframed, G=Antique Gold, R=Antique Silver, B=Baroque Gold Wide)
  // value = [variantId, priceCents, compareAtCents]
  var VAR = {"SU":[48277732983002,7999,9999],"SG":[48111346254042,15999,19999],"SR":[48111363915994,15999,19999],"SB":[48111363948762,20999,26299],"MU":[48277733015770,10999,13799],"MG":[48111346286810,19999,24999],"MR":[48111363981530,19999,24999],"MB":[48111364014298,25999,32499],"LU":[48277733048538,16999,21299],"LG":[48111346319578,26999,33799],"LR":[48111364047066,26999,33799],"LB":[48111364079834,33999,42499]};

  var STYLES = [
    { code: "monet",    label: "Monet",        sub: "Impressionist" },
    { code: "oil",      label: "Oil Painting", sub: "Museum oil" },
    { code: "heritage", label: "Heritage",     sub: "Regal heirloom" }
  ];
  var SIZES = [
    { code: "S", label: "24 × 18\"" }, { code: "M", label: "32 × 24\"" }, { code: "L", label: "40 × 30\"" }
  ];
  // `bare` = the gallery-wrapped canvas (no frame mockup image — drawn in CSS from the art itself)
  var FRAMES = [
    { code: "U", key: null,             label: "Unframed",            bare: true },
    { code: "G", key: "antique_gold",   label: "Antique Gold",       l: 7.5, t: 8, w: 85, h: 84 },
    { code: "R", key: "antique_silver", label: "Antique Silver",     l: 8,   t: 8, w: 84, h: 84 },
    { code: "B", key: "baroque_gold",   label: "Baroque Gold (Wide)", l: 9.5, t: 9, w: 81, h: 82 }
  ];
  FRAMES.forEach(function (f) { if (f.key) f.img = API + "/app/frames/" + f.key + ".webp"; });

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
  var sel = { style: null, size: "S", frame: "U" };
  var file = null, timer = null, heroPick = null;
  // Per-style session cache so switching styles (and back) never re-generates.
  // Each style keeps EVERY render it produced — retries add a version rather than replacing one,
  // so nobody loses a portrait they liked by tweaking it. code -> {list:[{id,preview,full,...}], i}
  var results = {};
  function curSet() { return results[sel.style] || null; }
  function curRes() { var s = curSet(); return s ? s.list[s.i] : null; }
  function addRes(style, res) {
    var s = results[style] || (results[style] = { list: [], i: 0 });
    s.list.push(res); s.i = s.list.length - 1;
  }

  // ---- Markup -------------------------------------------------------------------------
  root.innerHTML = "" +
    "<style>" +
    "#pcai-root{--pc-bg:#f3ecde;--pc-ink:#343434;--pc-mut:#8a7d68;--pc-line:#dfd2b8;--pc-card:#fffdf7;--pc-acc:#5e1622;--pc-gold:#b08d57;--pc-serif:'Playfair Display',Georgia,serif;background:var(--pc-bg);color:var(--pc-ink);font-family:inherit;width:100%;overflow-x:hidden}" +
    "#pcai-root *{box-sizing:border-box}" +
    "#pcai{width:94%;max-width:1700px;margin:0 auto;padding:34px 0 6px;text-align:left}" +
    "#pcai .pc-wrap{display:grid;grid-template-columns:1fr;gap:28px}" +
    "@media(min-width:880px){#pcai .pc-wrap{grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:44px;align-items:start}#pcai .pc-media{position:sticky;top:20px}}" +
    // top CTA (mainly to jump mobile users straight to the upload)
    "#pcai .pc-topcta{background:var(--pc-card);border:1px solid var(--pc-line);border-radius:14px;padding:15px 20px;margin-bottom:26px}" +
    "#pcai .pc-topcta-in{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap}" +
    "#pcai .pc-topcta-txt b{display:block;font-family:var(--pc-serif);font-size:19px;color:var(--pc-ink);line-height:1.15}" +
    "#pcai .pc-topcta-txt span{font-size:12.5px;color:var(--pc-mut)}" +
    "#pcai .pc-topcta .pc-btn{white-space:nowrap;flex:none}" +
    "@media(max-width:640px){#pcai .pc-topcta-in{flex-direction:column;align-items:stretch;text-align:center}#pcai .pc-topcta .pc-btn{width:100%;margin-top:2px}}" +
    // mobile tightening
    "@media(max-width:640px){" +
      "#pcai{width:92%;padding-top:22px}" +
      "#pcai .pc-hero{min-height:230px;padding:12px}" +
      "#pcai .pc-hero>img,#pcai .pc-framed>.pc-fimg,#pcai .pc-canvas>img{max-height:420px}" +
      "#pcai .pc-title{font-size:24px}" +
      "#pcai .pc-topcta-txt b{font-size:17px}" +
      "#pcai .pc-styleimg{height:100px}" +
      "#pcai .pc-oc{padding:8px 5px}" +
      "#pcai #pc-styles .pc-oc{padding:7px 5px 9px}" +
      "#pcai .pc-oc b{font-size:12.5px}#pcai .pc-oc b.pc-serifname{font-size:13.5px}#pcai .pc-oc small{font-size:10px}" +
      "#pcai .pc-badges{gap:6px}#pcai .pc-badge{padding:9px 3px}#pcai .pc-badge b{font-size:10.5px}#pcai .pc-badge small{font-size:9px}" +
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
    "#pcai .pc-framed>.pc-fart{position:absolute;object-fit:cover}" +
    // unframed = gallery wrap: bare art, lifted off the wall, with the shaded 1.5" bottom edge
    "#pcai .pc-canvas{position:relative;display:inline-block;line-height:0;max-width:100%}" +
    "#pcai .pc-canvas>img{display:block;max-width:100%;max-height:620px;box-shadow:0 14px 32px rgba(0,0,0,.28),0 3px 8px rgba(0,0,0,.16)}" +
    "#pcai .pc-canvas:after{content:'';position:absolute;left:0;right:0;bottom:0;height:6px;background:linear-gradient(rgba(0,0,0,.32),rgba(0,0,0,.05));pointer-events:none}" +
    "#pcai .pc-thumb .pc-canvas{width:100%;height:100%}" +
    "#pcai .pc-thumb .pc-canvas>img{width:100%;height:100%;object-fit:cover;box-shadow:none}" +
    "#pcai .pc-thumb .pc-canvas:after{height:3px}" +
    "#pcai .pc-thumbs{display:flex;gap:9px;margin-top:12px;flex-wrap:wrap}" +
    "#pcai .pc-thumb{width:70px;height:70px;border-radius:10px;overflow:hidden;border:2px solid transparent;cursor:pointer;background:var(--pc-card);padding:0;line-height:0}" +
    "#pcai .pc-thumb.sel{border-color:var(--pc-acc)}" +
    "#pcai .pc-thumb img{width:100%;height:100%;object-fit:cover}" +
    "#pcai .pc-thumb .pc-framed,#pcai .pc-thumb .pc-fimg{width:100%;height:100%}" +
    "#pcai .pc-thumb .pc-fimg{object-fit:cover}" +
    "#pcai .pc-heronote{font-size:12px;color:var(--pc-mut);text-align:center;margin-top:11px}" +
    "#pcai .pc-spin{width:40px;height:40px;border:4px solid var(--pc-line);border-top-color:var(--pc-acc);border-radius:50%;animation:pcspin 1s linear infinite;margin:0 auto 12px}" +
    "@keyframes pcspin{to{transform:rotate(360deg)}}" +
    "#pcai .pc-loading{max-width:360px;margin:0 auto}" +
    "#pcai .pc-loadrev{margin-top:18px;padding:13px 15px;border:1px solid var(--pc-line);border-radius:12px;background:#fff;text-align:left}" +
    "#pcai .pc-lr-stars{color:#e8a91d;font-size:13px;letter-spacing:1px}" +
    "#pcai .pc-lr-t{font-size:13px;line-height:1.5;color:var(--pc-ink);margin:5px 0 6px;font-style:italic}" +
    "#pcai .pc-lr-n{font-size:11px;color:var(--pc-mut);font-weight:600}" +
    "@keyframes pcfade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}" +
    // buy column
    "#pcai .pc-eyebrow{font-size:11px;letter-spacing:.18em;color:var(--pc-mut);text-transform:uppercase;font-weight:600}" +
    "#pcai .pc-title{font-family:var(--pc-serif);font-size:30px;line-height:1.12;font-weight:700;margin:6px 0 8px;color:var(--pc-ink)}" +
    "#pcai .pc-reviews{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--pc-ink);margin:0 0 10px;flex-wrap:wrap}" +
    "#pcai .pc-reviews .pc-stars{color:#e8a91d;letter-spacing:1px;font-size:15px}" +
    "#pcai .pc-reviews b{font-weight:700}" +
    "#pcai .pc-pricerow{display:flex;align-items:center;gap:10px;flex-wrap:wrap}" +
    "#pcai .pc-pricerow ins{font-size:26px;font-weight:700;text-decoration:none;font-family:var(--pc-serif)}" +
    "#pcai .pc-pricerow del{color:var(--pc-mut);font-size:16px}" +
    "#pcai .pc-save{background:var(--pc-gold);color:#181311;font-size:11px;font-weight:700;letter-spacing:.03em;padding:3px 9px;border-radius:100px}" +
    "#pcai .pc-gift{font-size:12.5px;color:var(--pc-acc);background:rgba(94,22,34,.06);border-radius:8px;padding:8px 11px;margin:12px 0 0}" +
    "#pcai .pc-badges{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0 4px}" +
    "#pcai .pc-badge{border:1px solid var(--pc-line);border-radius:12px;padding:10px 6px;text-align:center;background:var(--pc-card)}" +
    "#pcai .pc-badge svg{width:23px;height:23px;display:block;margin:0 auto 4px;stroke:var(--pc-acc);fill:none}" +
    "#pcai .pc-badge b{display:block;font-size:12px;margin-top:4px}" +
    "#pcai .pc-badge small{font-size:10px;color:var(--pc-mut)}" +
    "#pcai .pc-opt{margin:18px 0 0}" +
    "#pcai .pc-label{font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:var(--pc-mut);margin:0 0 8px;display:flex;justify-content:space-between;align-items:center}" +
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
    "#pcai .pc-oc{position:relative;border:1.5px solid var(--pc-line);background:var(--pc-card);border-radius:11px;padding:11px 8px;text-align:center;cursor:pointer;transition:.12s}" +
    "#pcai .pc-oc:hover{border-color:var(--pc-mut)}" +
    "#pcai .pc-oc.sel{border-color:var(--pc-acc);box-shadow:0 0 0 3px rgba(94,22,34,.13)}" +
    "#pcai .pc-oc b{display:block;font-size:14px}" +
    "#pcai .pc-oc b.pc-serifname{font-family:var(--pc-serif);font-size:16px}" +
    "#pcai .pc-oc small{display:block;font-size:11px;color:var(--pc-mut);margin-top:2px;min-height:14px}" +
    "#pcai .pc-oc small.pc-up{color:var(--pc-acc);font-weight:600}" +
    "#pcai #pc-styles .pc-oc{padding:7px 7px 10px}" +
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
    "#pcai .pc-artist input{margin-top:3px}" +
    "#pcai .pc-tiny{font-size:12px;color:var(--pc-mut)}" +
    "#pcai .pc-center{text-align:center}" +
    "#pcai .pc-err{color:#a33;font-size:14px;text-align:center;margin-top:8px}" +
    // info accordion
    "#pcai-root .pc-info{width:94%;max-width:1700px;margin:24px auto 0;padding:0 0 34px}" +
    "#pcai-root .pc-info details{border-top:1px solid var(--pc-line)}" +
    "#pcai-root .pc-info summary{cursor:pointer;padding:15px 0;font-family:var(--pc-serif);font-size:17px;font-weight:600;list-style:none;color:var(--pc-ink)}" +
    "#pcai-root .pc-info summary::-webkit-details-marker{display:none}" +
    "#pcai-root .pc-info summary::after{content:'+';float:right;color:var(--pc-mut);font-size:20px;line-height:1}" +
    "#pcai-root .pc-info details[open] summary::after{content:'–'}" +
    "#pcai-root .pc-info p,#pcai-root .pc-info ul{font-size:14px;line-height:1.62;margin:0 0 12px;color:#4a4038;max-width:860px}" +
    "#pcai-root .pc-info .pc-lead{font-family:var(--pc-serif);font-size:18px;color:var(--pc-ink);margin-bottom:8px}" +
    "#pcai-root .pc-info ul{padding-left:18px}#pcai-root .pc-info li{margin:4px 0}" +
    "#pcai-root .pc-sizeviz{display:flex;align-items:flex-end;gap:18px;margin:10px 0 8px;flex-wrap:wrap}" +
    "#pcai-root .pc-sizebox{border:2px solid var(--pc-acc);border-radius:4px;background:rgba(94,22,34,.05);display:flex;align-items:center;justify-content:center;text-align:center;font-size:11px;font-weight:600;color:var(--pc-ink)}" +
    "</style>" +

    "<div id='pcai'>" +
      "<div class='pc-topcta'><div class='pc-topcta-in'>" +
        "<div class='pc-topcta-txt'><b>See your pet reimagined as a masterpiece</b><span>Upload a photo — your free preview appears in ~60 seconds.</span></div>" +
        "<button class='pc-btn' id='pc-start'>Get my free preview →</button>" +
      "</div></div>" +
      "<div class='pc-wrap'>" +
      // ---- LEFT: media ----
      "<div class='pc-media'>" +
        "<div class='pc-hero' id='pc-hero'></div>" +
        "<div class='pc-thumbs' id='pc-thumbs'></div>" +
        "<div class='pc-heronote' id='pc-heronote'>✨ Upload your pet’s photo — your live preview appears here in ~60 seconds.</div>" +
      "</div>" +
      // ---- RIGHT: buy box ----
      "<div class='pc-buy'>" +
        "<div class='pc-eyebrow'>Heirloom Pet Art</div>" +
        "<h1 class='pc-title'>Custom Heritage Pet Portrait</h1>" +
        "<div class='pc-reviews'><span class='pc-stars'>★★★★★</span> <b>4.9</b>/5 &middot; 14,668+ happy customers</div>" +
        "<div class='pc-pricerow' id='pc-pricerow'></div>" +
        "<div class='pc-gift'>🎁 Free shipping — your masterpiece is delivered in 4–7 business days.</div>" +
        "<div class='pc-badges'>" +
          "<div class='pc-badge'><svg viewBox='0 0 24 24' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><path d='M3 7h10v8H3z'/><path d='M13 10h4l3 3v2h-7z'/><circle cx='7' cy='17.5' r='1.4'/><circle cx='17' cy='17.5' r='1.4'/></svg><b>Fast &amp; Free</b><small>shipping</small></div>" +
          "<div class='pc-badge'><svg viewBox='0 0 24 24' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='13.5' r='6.5'/><path d='M12 13.5V10'/><path d='M10 3.5h4'/><path d='M12 3.5v2'/></svg><b>60-Second</b><small>instant preview</small></div>" +
          "<div class='pc-badge'><svg viewBox='0 0 24 24' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><path d='M12 3l7 3v5c0 4.4-3 7.4-7 8.8-4-1.4-7-4.4-7-8.8V6z'/><path d='M9 12l2 2 4-4'/></svg><b>30-Day</b><small>happiness guarantee</small></div>" +
        "</div>" +

        "<div class='pc-opt'><div class='pc-label'>1 &middot; Your pet’s photo</div>" +
          "<label class='pc-drop' id='pc-drop'><input type='file' id='pc-file' accept='image/*'>" +
          "<div id='pc-dropin'><div class='pc-dropicon'>🐾</div><div class='pc-tiny'>Click to upload a clear, well-lit photo</div></div></label>" +
          "<input class='pc-field' id='pc-email' type='email' placeholder='Your email (so we can send your preview)'>" +
        "</div>" +
        "<div class='pc-opt'><div class='pc-label'>2 &middot; Choose your style</div><div class='pc-grid3' id='pc-styles'></div></div>" +
        "<div class='pc-opt'><div class='pc-label'>3 &middot; Choose your size <span class='pc-guidelink' id='pc-guidelink'>📐 Size guide</span></div><div class='pc-grid3' id='pc-sizes'></div></div>" +
        "<div class='pc-opt'><div class='pc-label'>4 &middot; Add a frame <span class='pc-optional'>optional</span></div><div class='pc-grid3 pc-frameopts' id='pc-frames'></div></div>" +

        "<div id='pc-cta'>" +
          "<button class='pc-btn pc-big' id='pc-go' disabled>Create my portrait ✨</button>" +
          "<div class='pc-tiny pc-center' id='pc-gohint' style='margin-top:8px'>Add a photo, your email &amp; a style to preview</div>" +
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
        "<div class='pc-err' id='pc-err'></div>" +
      "</div>" +
    "</div>" +

    // ---- Info accordion (full width) ----
    "<div class='pc-info'>" +
      "<details open><summary>Description</summary>" +
        "<p class='pc-lead'>Your pet, immortalized as a masterpiece.</p>" +
        "<p>We reimagine your beloved pet in the style of an old-world oil painting — capturing their personality and expression in rich, timeless detail. Printed on gallery-grade cotton canvas and hand-stretched over solid wood, it arrives ready to hang straight out of the box. Add an ornate gilt frame if you’d like the full heirloom treatment.</p>" +
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
        "<p class='pc-tiny' style='text-align:center'>Measured in inches &middot; landscape 4:3 &middot; printed on gallery-grade canvas. Frame optional &mdash; sizes shown are the canvas; a frame adds ~3&quot; on each side.</p></details>" +
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
  function renderStyles() {
    $("pc-styles").innerHTML = STYLES.map(function (s) {
      return "<div class='pc-oc" + (sel.style === s.code ? " sel" : "") + "' data-style='" + s.code + "'>" +
        "<img class='pc-styleimg' src='" + API + "/app/examples/" + s.code + ".jpg' alt='" + s.label + "'>" +
        "<b class='pc-serifname'>" + s.label + "</b><small>" + s.sub + "</small></div>";
    }).join("");
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
  function renderHero() {
    if (heroPick) $("pc-hero").innerHTML = "<img src='" + heroPick + "'>";
    else if (curRes()) $("pc-hero").innerHTML = framedHTML("pc-fart");
    else $("pc-hero").innerHTML = "<img src='" + EXAMPLES[0] + "'>";
  }
  function renderThumbs() {
    var r = curRes(), html = "";
    if (r) {  // customer's portrait in each frame
      html += liveFrames().map(function (f) {
        var s = (!heroPick && sel.frame === f.code) ? " sel" : "";
        return "<button class='pc-thumb" + s + "' data-frame='" + f.code + "' title='" + f.label + "'>" +
          artIn(f, r.preview + "?t=" + r.bust, "pc-fart") + "</button>";
      }).join("");
    }
    // example gallery — kept visible even after a preview (incl. the size-comparison shot)
    html += EXAMPLES.map(function (src) {
      var s = (heroPick === src || (!r && !heroPick && src === EXAMPLES[0])) ? " sel" : "";
      return "<button class='pc-thumb" + s + "' data-ex='" + src + "'><img src='" + src + "'></button>";
    }).join("");
    $("pc-thumbs").innerHTML = html;
  }
  function updateGo() {
    var ok = file && sel.style && validEmail($("pc-email").value);
    $("pc-go").disabled = !ok;
    $("pc-gohint").style.display = ok ? "none" : "block";
  }
  // Only worth showing once there's something to compare against.
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
    renderVersions(); renderFrames(); renderHero(); renderThumbs();
  }
  function refreshPhase() {
    renderVersions();
    var fresh = !!curRes();
    $("pc-post").style.display = fresh ? "block" : "none";
    $("pc-cta").style.display = fresh ? "none" : "block";
    $("pc-go").textContent = "Create my portrait ✨";
    $("pc-heronote").textContent = fresh
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
  function show(d, style) {
    addRes(style || sel.style, { id: d.id, preview: API + d.preview_url, full: API + d.full_url,
                                 original: d.original_url ? API + d.original_url : "", bust: Date.now() });
    heroPick = null;
    renderFrames(); renderHero(); renderThumbs();   // renderFrames: swap the unframed swatch to their art
    $("pc-retry").disabled = false; $("pc-instruction").disabled = false;
    refreshPhase();
    $("pc-post").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function doGenerate(style) {
    if (!file || !style) return;
    loading();
    var fd = new FormData(); fd.append("file", file); fd.append("style", style); fd.append("email", $("pc-email").value.trim());
    post("/generate", fd).then(function (d) { show(d, style); }).catch(function (e) { renderHero(); $("pc-err").textContent = e.message; }).then(stop, stop);
  }

  // ---- Events -------------------------------------------------------------------------
  $("pc-styles").addEventListener("click", function (e) { var c = e.target.closest("[data-style]"); if (!c) return; sel.style = c.getAttribute("data-style"); heroPick = null; renderStyles(); renderFrames(); renderHero(); renderThumbs(); refreshPhase(); });
  $("pc-sizes").addEventListener("click", function (e) { var c = e.target.closest("[data-size]"); if (!c) return; sel.size = c.getAttribute("data-size"); renderOptions(); });
  $("pc-frames").addEventListener("click", function (e) { var c = e.target.closest("[data-frame]"); if (!c) return; selectFrame(c.getAttribute("data-frame")); });
  $("pc-vstrip").addEventListener("click", function (e) { var b = e.target.closest("[data-ver]"); if (!b) return; selectVersion(+b.getAttribute("data-ver")); });
  $("pc-thumbs").addEventListener("click", function (e) {
    var b = e.target.closest(".pc-thumb"); if (!b) return;
    if (b.getAttribute("data-frame")) { heroPick = null; selectFrame(b.getAttribute("data-frame")); }
    else if (b.getAttribute("data-ex")) { heroPick = b.getAttribute("data-ex"); renderHero(); renderThumbs(); }
  });
  $("pc-guidelink").addEventListener("click", function () { var d = $("pc-guide"); d.open = true; d.scrollIntoView({ behavior: "smooth", block: "center" }); });
  $("pc-start").addEventListener("click", function () {
    var d = $("pc-drop"); if (!d) return;
    d.scrollIntoView({ behavior: "smooth", block: "center" });
    d.style.borderColor = "var(--pc-acc)"; setTimeout(function () { d.style.borderColor = ""; }, 1400);
  });
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
    var genStyle = sel.style;
    loading();
    var fd = new FormData(); fd.append("id", r.id); fd.append("instruction", ins);
    post("/retry", fd).then(function (d) { show(d, genStyle); $("pc-instruction").value = ""; }).catch(function (e) { renderHero(); $("pc-err").textContent = e.message; }).then(stop, stop);
  });
  $("pc-add").addEventListener("click", function () {
    var v = curVar(), r = curRes();
    var props = {
      "Style": labelOf(STYLES, sel.style), "_job_id": r ? r.id : "",
      "_preview": r ? r.preview : "", "_fullres": r ? r.full : "", "_original": r ? r.original : ""
    };
    if ($("pc-artist-check").checked) {
      props["Artist refinement"] = "Yes — free, after order (unlimited revisions by email)";
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
  // The theme's "Embed code" block wraps us in a narrow (~800px), overflow:hidden container that
  // caps the width and clips both edges. Widen + unclip every ancestor up to the full-width section
  // so the generator can fill the real product-section width. Re-run on resize for safety.
  function unclip() {
    var p = root.parentElement;
    while (p && p !== document.body) {
      var cs = getComputedStyle(p);
      var mw = parseFloat(cs.maxWidth);
      if (!isNaN(mw) && mw < 1400) p.style.maxWidth = "none";
      if (cs.overflowX === "hidden") p.style.overflowX = "visible";
      if (cs.overflowY === "hidden") p.style.overflowY = "visible";
      p = p.parentElement;
    }
  }
  unclip();
  window.addEventListener("resize", unclip);

  sel.frame = baseFrame();   // Unframed if its variants are live, else fall back to Antique Gold
  renderStyles(); renderOptions(); renderHero(); renderThumbs(); refreshPhase();
})();
