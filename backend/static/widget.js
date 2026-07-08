/* Pet Creations AI — embeddable storefront widget.
 * <div id="pcai-root"></div>
 * <script src="https://YOUR-BACKEND/app/widget.js"></script>
 * Flow: upload + email -> style -> AI preview -> free AI tweaks -> choose a REAL frame
 *       (portrait overlaid into the actual frame, instant, no AI) -> free artist touch-up -> add to cart.
 */
(function () {
  var script = document.currentScript;
  var API = new URL(script.src).origin;
  var root = document.getElementById("pcai-root");
  if (!root) { console.error("[pcai] #pcai-root not found"); return; }
  function detectVariant() {
    var v = root.getAttribute("data-variant") || "";
    if (v && v.indexOf("{{") === -1) return v;
    try { var f = document.querySelector('form[action*="/cart/add"] [name="id"]'); if (f && f.value) return f.value; } catch (e) {}
    try { if (window.ShopifyAnalytics && ShopifyAnalytics.meta && ShopifyAnalytics.meta.product) return String(ShopifyAnalytics.meta.product.variants[0].id); } catch (e) {}
    try { if (window.meta && window.meta.product) return String(window.meta.product.variants[0].id); } catch (e) {}
    return "";
  }
  var variantId = detectVariant();

  // Real physical frames — portrait is overlaid into each frame's artwork window (inset % below).
  var FRAMES = [
    { key: "antique_gold",   label: "Antique Gold",        l: 7.5, t: 8, w: 85, h: 84 },
    { key: "antique_silver", label: "Antique Silver",      l: 8,   t: 8, w: 84, h: 84 },
    { key: "baroque_gold",   label: "Baroque Gold",        l: 9.5, t: 9, w: 81, h: 82 }
  ];
  FRAMES.forEach(function (f) { f.img = API + "/app/frames/" + f.key + ".webp"; });

  root.innerHTML = '' +
    '<style>' +
    '#pcai-root{--pc-ink:#2a2622;--pc-mut:#8a8178;--pc-line:#e7e1d8;--pc-acc:#7a5c3e}' +
    '#pcai-root *{box-sizing:border-box}' +
    '#pcai{max-width:720px;margin:24px auto;color:var(--pc-ink)}' +
    '#pcai .pc-card{border:1px solid var(--pc-line);border-radius:14px;padding:18px;margin:14px 0;background:#fff}' +
    '#pcai h3{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--pc-mut);margin:0 0 12px}' +
    '#pcai .pc-sub{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--pc-mut);text-align:center;margin:18px 0 8px}' +
    '#pcai .pc-drop{border:2px dashed var(--pc-line);border-radius:12px;padding:24px;text-align:center;cursor:pointer}' +
    '#pcai .pc-drop:hover{border-color:var(--pc-acc)}' +
    '#pcai .pc-drop input{display:none}' +
    '#pcai .pc-drop img{max-height:200px;border-radius:10px}' +
    '#pcai .pc-field{width:100%;padding:11px;border:1.5px solid var(--pc-line);border-radius:9px;font-size:14px;margin-top:12px;font-family:inherit}' +
    '#pcai textarea.pc-field{min-height:62px;resize:vertical}' +
    '#pcai .pc-styles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}' +
    '#pcai .pc-style{border:1.5px solid var(--pc-line);border-radius:10px;padding:14px;text-align:center;cursor:pointer}' +
    '#pcai .pc-style.sel{border-color:var(--pc-acc);box-shadow:0 0 0 3px rgba(122,92,62,.12)}' +
    '#pcai .pc-style b{display:block;font-size:15px}' +
    '#pcai .pc-style span{font-size:11px;color:var(--pc-mut)}' +
    '#pcai .pc-frames{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}' +
    '#pcai .pc-frame{border:2px solid transparent;border-radius:9px;padding:3px;cursor:pointer;text-align:center}' +
    '#pcai .pc-frame .pc-fimg{border-radius:5px}' +
    '#pcai .pc-frame span{font-size:11px;color:var(--pc-mut);display:block;margin-top:3px}' +
    '#pcai .pc-frame.sel{border-color:var(--pc-acc);box-shadow:0 0 0 3px rgba(122,92,62,.12)}' +
    '#pcai .pc-btn{background:var(--pc-acc);color:#fff;border:0;border-radius:9px;padding:12px 20px;font-size:15px;font-weight:600;cursor:pointer}' +
    '#pcai .pc-btn[disabled]{opacity:.45;cursor:not-allowed}' +
    '#pcai .pc-btn.ghost{background:#fff;color:var(--pc-acc);border:1.5px solid var(--pc-line)}' +
    '#pcai .pc-center{text-align:center}' +
    '#pcai .pc-stage{min-height:200px;display:flex;align-items:center;justify-content:center;text-align:center}' +
    '#pcai .pc-stage>img{max-width:100%;border-radius:12px;box-shadow:0 6px 22px rgba(0,0,0,.18)}' +
    '#pcai .pc-framed{position:relative;display:inline-block;max-width:100%;line-height:0}' +
    '#pcai .pc-framed .pc-fimg{display:block;width:100%}' +
    '#pcai .pc-framed .pc-fart{position:absolute;object-fit:cover}' +
    '#pcai .pc-spin{width:38px;height:38px;border:4px solid var(--pc-line);border-top-color:var(--pc-acc);border-radius:50%;animation:pcspin 1s linear infinite;margin:0 auto 12px}' +
    '@keyframes pcspin{to{transform:rotate(360deg)}}' +
    '#pcai .pc-retry{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:6px}' +
    '#pcai .pc-retry .pc-field{flex:1;min-width:200px;margin-top:0}' +
    '#pcai .pc-artist{display:flex;gap:9px;align-items:flex-start;font-size:14px;margin:16px 0 4px;cursor:pointer;line-height:1.45}' +
    '#pcai .pc-artist input{margin-top:3px}' +
    '#pcai .pc-note{font-size:12px;color:var(--pc-mut);text-align:center;margin-top:10px}' +
    '#pcai .pc-err{color:#a33;font-size:14px;text-align:center;margin-top:8px}' +
    '</style>' +
    '<div id="pcai">' +
      '<div class="pc-card"><h3>1 &middot; Your pet\'s photo</h3>' +
        '<label class="pc-drop" id="pc-drop"><input type="file" id="pc-file" accept="image/*">' +
        '<div id="pc-dropin"><div style="font-size:28px">🐾</div><div class="pc-note">Click to upload a clear photo of your pet</div></div></label>' +
        '<input class="pc-field" id="pc-email" type="email" placeholder="Your email (so we can send your previews)">' +
      '</div>' +
      '<div class="pc-card"><h3>2 &middot; Choose a style</h3><div class="pc-styles" id="pc-styles">' +
        '<div class="pc-style" data-s="watercolor"><b>Watercolor</b><span>Soft &amp; elegant</span></div>' +
        '<div class="pc-style" data-s="oil"><b>Oil Painting</b><span>Museum oil</span></div>' +
        '<div class="pc-style" data-s="heritage"><b>Heritage</b><span>Regal heirloom</span></div>' +
      '</div></div>' +
      '<div class="pc-center"><button class="pc-btn" id="pc-go" disabled>Create my portrait ✨</button></div>' +
      '<div class="pc-card" id="pc-result" style="display:none"><h3>Your preview</h3>' +
        '<div class="pc-stage" id="pc-stage"></div>' +
        '<div id="pc-actions" style="display:none">' +
          '<div class="pc-retry">' +
            '<input class="pc-field" id="pc-instruction" placeholder="Tweak it — e.g. \'warmer tones\'">' +
            '<button class="pc-btn ghost" id="pc-retry">Recolor / fix</button>' +
          '</div>' +
          '<div class="pc-note" id="pc-left"></div>' +
          '<div class="pc-sub">3 &middot; See it in your frame</div>' +
          '<div class="pc-frames" id="pc-frames"></div>' +
          '<label class="pc-artist"><input type="checkbox" id="pc-artist-check"><span><b>Have a real artist perfect it</b> &mdash; free. Our artist hand-refines your portrait before we print it.</span></label>' +
          '<textarea class="pc-field" id="pc-artist-notes" placeholder="Optional: tell our artist what to adjust — e.g. brighten the eyes, remove the leash, warmer background" style="display:none"></textarea>' +
          '<button class="pc-btn" id="pc-add" style="width:100%;justify-content:center;margin-top:14px">Add to cart →</button>' +
        '</div>' +
        '<div class="pc-err" id="pc-err"></div>' +
        '<div class="pc-note">Previews are watermarked. The clean, full-resolution art is produced for your order.</div>' +
      '</div>' +
    '</div>';

  var $ = function (id) { return document.getElementById(id); };
  var file = null, style = null, currentId = null, currentPreview = null, styleLabel = "";
  var selectedFrame = null, selectedFrameLabel = "";
  var LOADING = ["Studying your pet’s features…", "Preparing the canvas…", "Mixing the paints…", "Applying brushstrokes…", "Adding the finishing details…"];
  var timer = null;

  function validEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((v || "").trim()); }
  function refresh() { $("pc-go").disabled = !(file && style && validEmail($("pc-email").value)); }
  function clearFrames() {
    selectedFrame = null; selectedFrameLabel = "";
    Array.prototype.forEach.call(document.querySelectorAll("#pcai .pc-frame"), function (b) { b.classList.remove("sel"); });
  }

  $("pc-file").addEventListener("change", function (e) {
    file = e.target.files[0]; if (!file) return;
    $("pc-dropin").innerHTML = '<img src="' + URL.createObjectURL(file) + '"><div class="pc-note">' + file.name + " &middot; click to change</div>";
    refresh();
  });
  $("pc-email").addEventListener("input", refresh);
  $("pc-styles").addEventListener("click", function (e) {
    var c = e.target.closest(".pc-style"); if (!c) return;
    Array.prototype.forEach.call(document.querySelectorAll("#pc-styles .pc-style"), function (s) { s.classList.remove("sel"); });
    c.classList.add("sel"); style = c.getAttribute("data-s"); styleLabel = c.querySelector("b").textContent; refresh();
  });

  function loading() {
    $("pc-result").style.display = "block"; $("pc-actions").style.display = "none"; $("pc-err").textContent = ""; $("pc-left").textContent = "";
    var i = 0; function r() { $("pc-stage").innerHTML = '<div><div class="pc-spin"></div><div class="pc-note">' + LOADING[i % LOADING.length] + "</div></div>"; i++; }
    r(); timer = setInterval(r, 3500); $("pc-result").scrollIntoView({ behavior: "smooth" });
  }
  function stop() { clearInterval(timer); }

  function post(path, form) {
    return fetch(API + path, { method: "POST", body: form }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return { detail: r.statusText }; }).then(function (j) { throw new Error(j.detail || "error"); });
      return r.json();
    });
  }
  function showArt() { $("pc-stage").innerHTML = '<img src="' + currentPreview + "?t=" + Date.now() + '">'; }
  function renderFrameThumbs() {
    $("pc-frames").innerHTML = FRAMES.map(function (f) {
      return '<div class="pc-frame' + (selectedFrame === f.key ? ' sel' : '') + '" data-key="' + f.key + '">' +
        '<div class="pc-framed"><img class="pc-fimg" src="' + f.img + '"><img class="pc-fart" src="' + currentPreview + '" style="left:' + f.l + '%;top:' + f.t + '%;width:' + f.w + '%;height:' + f.h + '%"></div>' +
        '<span>' + f.label + '</span></div>';
    }).join('');
  }
  function show(d) {
    currentId = d.id; currentPreview = API + d.preview_url;
    clearFrames();
    showArt();
    renderFrameThumbs();
    $("pc-actions").style.display = "block";
    var left = d.retries_left;
    if (left > 0) { $("pc-left").textContent = left + " free AI tweak" + (left === 1 ? "" : "s") + " left"; $("pc-retry").disabled = false; }
    else { $("pc-left").textContent = "No free AI tweaks left — or let a real artist perfect it below."; $("pc-retry").disabled = true; }
  }

  $("pc-go").addEventListener("click", function () {
    loading();
    var fd = new FormData(); fd.append("file", file); fd.append("style", style); fd.append("email", $("pc-email").value.trim());
    post("/generate", fd).then(show).catch(function (e) { $("pc-stage").innerHTML = ""; $("pc-err").textContent = e.message; }).then(stop, stop);
  });
  $("pc-retry").addEventListener("click", function () {
    var ins = $("pc-instruction").value.trim(); if (!ins || !currentId) return;
    loading();
    var fd = new FormData(); fd.append("id", currentId); fd.append("instruction", ins);
    post("/retry", fd).then(function (d) { show(d); $("pc-instruction").value = ""; }).catch(function (e) { $("pc-stage").innerHTML = ""; $("pc-err").textContent = e.message; }).then(stop, stop);
  });

  // Choose a real frame — overlay the portrait into the actual frame window (instant, no AI).
  $("pc-frames").addEventListener("click", function (e) {
    var c = e.target.closest(".pc-frame"); if (!c || !currentPreview) return;
    var key = c.getAttribute("data-key");
    var f = FRAMES.filter(function (x) { return x.key === key; })[0];
    if (selectedFrame === key) { selectedFrame = null; selectedFrameLabel = ""; c.classList.remove("sel"); showArt(); return; }
    selectedFrame = f.key; selectedFrameLabel = f.label;
    $("pc-stage").innerHTML =
      '<div class="pc-framed"><img class="pc-fimg" src="' + f.img + '">' +
      '<img class="pc-fart" src="' + currentPreview + "?t=" + Date.now() + '" style="left:' + f.l + '%;top:' + f.t + '%;width:' + f.w + '%;height:' + f.h + '%"></div>';
    Array.prototype.forEach.call(document.querySelectorAll("#pcai .pc-frame"), function (b) { b.classList.remove("sel"); });
    c.classList.add("sel");
  });

  $("pc-artist-check").addEventListener("change", function () {
    $("pc-artist-notes").style.display = this.checked ? "block" : "none";
  });

  $("pc-add").addEventListener("click", function () {
    if (!variantId) { alert("This block isn’t on a product page yet (no variant). Add it to a product template."); return; }
    var props = { "Style": styleLabel, "_ai_job_id": currentId, "_ai_preview": currentPreview };
    if (selectedFrame) { props["Frame"] = selectedFrameLabel; }
    if ($("pc-artist-check").checked) {
      props["Artist touch-up"] = "Yes — hand-refine before printing";
      var notes = $("pc-artist-notes").value.trim();
      if (notes) props["Artist notes"] = notes;
    }
    $("pc-add").disabled = true; $("pc-add").textContent = "Adding...";
    fetch("/cart/add.js", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: variantId, quantity: 1, properties: props })
    }).then(function (r) { return r.json(); }).then(function () { window.location.href = "/cart"; })
      .catch(function () { $("pc-add").disabled = false; $("pc-add").textContent = "Add to cart →"; alert("Could not add to cart."); });
  });
})();
