// ===== Config + State =====
const DEFAULT_CONFIG = {
  apiUrl: "",
  whatsappNumber: "50431517755",
  tiendaNombre: "SDComayagua",
};

const state = {
  view: "catalog",          // catalog | offers
  products: [],
  envios: [],
  taxonomy: [],
  selectedCat: "all",
  selectedSub: "all",
  selectedBrand: "all",
  search: "",
  stockFilter: "all",       // all | inStock | outStock
  sort: "relev",
  activeProduct: null,
  selectedOfferQty: null,
  page: 1,
  pageSize: 24,
};

const el = (id) => document.getElementById(id);
let CONFIG = { ...DEFAULT_CONFIG };

// ===== Utilities =====
const safeText = (s) => (s == null ? "" : String(s));
const moneyL = (n) => `L ${Number(n || 0).toFixed(0)}`;
const uniq = (arr) => Array.from(new Set(arr));
function debounce(fn, ms=200){ let t=null; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); }; }
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function safeParam_(v){ return (v==null) ? "" : String(v); }

function setUrlState_(mode="replace"){
  const params = new URLSearchParams();
  params.set("view", state.view || "catalog");
  if (state.selectedCat && state.selectedCat !== "all") params.set("cat", state.selectedCat);
  if (state.selectedSub && state.selectedSub !== "all") params.set("sub", state.selectedSub);
  if (state.selectedBrand && state.selectedBrand !== "all") params.set("brand", state.selectedBrand);
  if (state.search) params.set("q", state.search);
  if (state.stockFilter && state.stockFilter !== "all") params.set("stock", state.stockFilter);
  if (state.sort && state.sort !== "relev") params.set("sort", state.sort);
  if (state.activeProduct && state.activeProduct.id) params.set("p", state.activeProduct.id);
  const newHash = "#/?" + params.toString();
  if (mode === "push") history.pushState(null, "", newHash);
  else history.replaceState(null, "", newHash);
}

function readUrlState_(){
  const h = location.hash || "#/";
  const qpos = h.indexOf("?");
  const params = new URLSearchParams(qpos>=0 ? h.slice(qpos+1) : "");
  return {
    view: params.get("view") || "catalog",
    cat: params.get("cat") || "all",
    sub: params.get("sub") || "all",
    brand: params.get("brand") || "all",
    q: params.get("q") || "",
    stock: params.get("stock") || "all",
    sort: params.get("sort") || "relev",
    p: params.get("p") || ""
  };
}

function categoryLink_(cat){
  const params = new URLSearchParams();
  params.set("view", "catalog");
  if (cat && cat !== "all") params.set("cat", cat);
  return "#/?" + params.toString();
}
function subcategoryLink_(cat, sub){
  const params = new URLSearchParams();
  params.set("view", "catalog");
  if (cat && cat !== "all") params.set("cat", cat);
  if (sub && sub !== "all") params.set("sub", sub);
  return "#/?" + params.toString();
}
function productLink_(p){
  const params = new URLSearchParams();
  params.set("view", "catalog");
  if (p && p.categoria) params.set("cat", p.categoria);
  if (p && p.subcategoria) params.set("sub", p.subcategoria);
  if (p && p.id) params.set("p", p.id);
  return "#/?" + params.toString();
}

function copyText_(txt){
  const t = safeParam_(txt);
  if (!t) return Promise.resolve(false);
  if (navigator.clipboard && navigator.clipboard.writeText){
    return navigator.clipboard.writeText(t).then(()=>true).catch(()=>false);
  }
  const ta = document.createElement("textarea");
  ta.value = t;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  let ok=false;
  try{ ok = document.execCommand("copy"); }catch(_){}
  ta.remove();
  return Promise.resolve(ok);
}

// ===== Theme =====
function getSavedTheme_(){ try{ return localStorage.getItem("tienda_theme") || "dark"; }catch(_){ return "dark"; } }
function setTheme_(theme){
  const t = (theme === "light") ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  try{ localStorage.setItem("tienda_theme", t); }catch(_){}
}
function toggleTheme_(){
  const cur = document.documentElement.getAttribute("data-theme") || "dark";
  setTheme_(cur === "dark" ? "light" : "dark");
}

// ===== Setup (sin tocar código) =====
function getSavedConfig_(){
  try{ return JSON.parse(localStorage.getItem("tienda_config_v4")||"{}"); }catch(_){ return {}; }
}
function saveConfig_(cfg){
  try{ localStorage.setItem("tienda_config_v4", JSON.stringify(cfg)); }catch(_){}
}
function showSetupModal(){
  const backdrop = document.createElement("div");
  backdrop.style.position = "fixed";
  backdrop.style.inset = "0";
  backdrop.style.background = "rgba(0,0,0,.68)";
  backdrop.style.display = "grid";
  backdrop.style.placeItems = "center";
  backdrop.style.padding = "16px";
  backdrop.style.zIndex = "9999";

  const card = document.createElement("div");
  card.style.width = "min(720px,100%)";
  card.style.border = "1px solid rgba(255,255,255,.14)";
  card.style.borderRadius = "20px";
  card.style.background = "rgba(16,24,38,.98)";
  card.style.boxShadow = "0 14px 40px rgba(0,0,0,.35)";
  card.style.color = "#e9eef7";
  card.style.fontFamily = "Inter,system-ui,Arial";
  card.style.padding = "14px";

  card.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid rgba(255,255,255,.10);padding-bottom:10px;margin-bottom:12px;">
      <div style="font-weight:900;font-size:16px;">Configurar tienda</div>
      <button id="setupClose" style="border:none;background:rgba(255,255,255,.08);color:#e9eef7;width:38px;height:38px;border-radius:12px;cursor:pointer;">✕</button>
    </div>

    <div style="color:#9fb0c6;font-size:13px;margin-bottom:10px;">
      Pegá la URL de tu Apps Script (termina en <b>/exec</b>). Se guarda en tu navegador.
    </div>

    <label style="display:block;color:#9fb0c6;font-weight:800;font-size:12px;margin-bottom:6px;">URL de la API (Apps Script /exec)</label>
    <input id="setupApi" placeholder="https://script.google.com/macros/s/XXXX/exec"
      style="width:100%;padding:12px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(15,22,34,.75);color:#e9eef7;outline:none;" />

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
      <div>
        <label style="display:block;color:#9fb0c6;font-weight:800;font-size:12px;margin-bottom:6px;">WhatsApp (solo dígitos)</label>
        <input id="setupWa" placeholder="50431517755"
          style="width:100%;padding:12px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(15,22,34,.75);color:#e9eef7;outline:none;" />
      </div>
      <div>
        <label style="display:block;color:#9fb0c6;font-weight:800;font-size:12px;margin-bottom:6px;">Nombre</label>
        <input id="setupName" placeholder="SDComayagua"
          style="width:100%;padding:12px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(15,22,34,.75);color:#e9eef7;outline:none;" />
      </div>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
      <button id="setupSave" style="flex:1;min-width:220px;padding:12px 14px;border-radius:14px;border:1px solid rgba(79,209,197,.28);background:rgba(79,209,197,.10);color:#e9eef7;font-weight:900;cursor:pointer;">Guardar</button>
      <button id="setupHelp" style="flex:1;min-width:220px;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(15,22,34,.70);color:#e9eef7;font-weight:900;cursor:pointer;">¿Dónde saco la URL?</button>
    </div>

    <div id="setupMsg" style="color:#9fb0c6;font-size:12px;margin-top:10px;white-space:pre-wrap;"></div>
  `;

  backdrop.appendChild(card);
  document.body.appendChild(backdrop);
  document.body.style.overflow = "hidden";

  const saved = getSavedConfig_();
  const api = document.getElementById("setupApi");
  const wa = document.getElementById("setupWa");
  const nm = document.getElementById("setupName");
  api.value = saved.apiUrl || CONFIG.apiUrl || "";
  wa.value = saved.whatsappNumber || CONFIG.whatsappNumber || "";
  nm.value = saved.tiendaNombre || CONFIG.tiendaNombre || "";

  const close = ()=>{ document.body.style.overflow = ""; backdrop.remove(); };
  document.getElementById("setupClose").onclick = close;

  document.getElementById("setupHelp").onclick = ()=>{
    document.getElementById("setupMsg").textContent =
`En tu Google Sheet:
1) Extensiones → Apps Script
2) Implementar → Nueva implementación → Aplicación web
3) Copiá la URL que termina en /exec`;
  };

  document.getElementById("setupSave").onclick = ()=>{
    const apiUrl = api.value.trim();
    const whatsappNumber = wa.value.trim().replace(/\D/g,"");
    const tiendaNombre = nm.value.trim() || "SDComayagua";
    if (!apiUrl.includes("/exec")){
      document.getElementById("setupMsg").textContent = "Pegá una URL válida que termine en /exec.";
      return;
    }
    saveConfig_({ apiUrl, whatsappNumber, tiendaNombre });
    close();
    location.reload();
  };
}

// ===== JSONP =====
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cbName = "cb_" + Math.random().toString(36).slice(2);
    const sep = url.includes("?") ? "&" : "?";
    const full = url + sep + "callback=" + cbName;

    window[cbName] = (data) => {
      delete window[cbName];
      script.remove();
      resolve(data);
    };

    const script = document.createElement("script");
    script.src = full;
    script.onerror = () => {
      delete window[cbName];
      script.remove();
      reject(new Error("No se pudo cargar la API (JSONP)."));
    };
    document.head.appendChild(script);
  });
}

async function loadConfig() {
  const saved = getSavedConfig_();
  try {
    const res = await fetch("config.json", { cache: "no-store" });
    const cfg = await res.json();
    CONFIG = { ...DEFAULT_CONFIG, ...cfg, ...saved };
  } catch (_) {
    CONFIG = { ...DEFAULT_CONFIG, ...saved };
  }

  document.title = `${CONFIG.tiendaNombre} – Catálogo`;
  el("btnWhatsApp").href = `https://wa.me/${CONFIG.whatsappNumber}`;
  setTheme_(getSavedTheme_());
}

async function loadData() {
  if (!CONFIG.apiUrl) {
    el("status").textContent = "Falta configurar la API.";
    showSetupModal();
    return;
  }

  try {
    el("status").textContent = "Cargando productos…";
    const p = await jsonp(CONFIG.apiUrl + "?only=productos");
    state.products = Array.isArray(p.productos) ? p.productos : [];

    const s = await jsonp(CONFIG.apiUrl + "?only=envios");
    state.envios = Array.isArray(s.envios) ? s.envios : [];

    const t = await jsonp(CONFIG.apiUrl + "?only=taxonomia");
    state.taxonomy = Array.isArray(t.taxonomia) ? t.taxonomia : [];

    el("status").textContent = "Listo.";
    initHomeStats_();
    // La UI se pinta según el estado del URL (deep links)
  } catch (err) {
    console.error(err);
    el("status").textContent = "No pude cargar datos. Revisá tu /exec.";
  }
}

// ===== Taxonomy + UI =====
function buildTaxonomy_(products){
  const map = {};
  for (const p of products){
    const c = safeText(p.categoria).trim() || "Sin categoría";
    if (!map[c]) map[c] = new Set();
    const s = safeText(p.subcategoria).trim();
    if (s) map[c].add(s);
  }
  return Object.keys(map).map(c => ({categoria:c, subcategorias:Array.from(map[c])}));
}

function buildCategoryUI_(){
  const base = state.view === "offers"
    ? state.products.filter(p => Array.isArray(p.ofertas) && p.ofertas.length>0)
    : state.products;

  const tax = state.taxonomy.length ? state.taxonomy : buildTaxonomy_(base);
  const cats = tax.map(x=>x.categoria).filter(Boolean).sort((a,b)=>a.localeCompare(b,"es"));

  // Quick pills (top 8)
  const quick = el("quickCats");
  quick.innerHTML = "";
  const topCats = cats.slice(0, 8);
  for (const c of topCats){
    const b = document.createElement("button");
    b.className = "quick__btn" + (state.selectedCat===c ? " quick__btn--active" : "");
    b.textContent = c;
    b.onclick = ()=>{
      state.selectedCat = (state.selectedCat === c) ? "all" : c;
      state.selectedSub = "all";
      state.page = 1;
      syncFilters_();
      renderAll_(true);
    };
    quick.appendChild(b);
  }

  // Tiles (top 6 with counts)
  const tileWrap = el("catTiles");
  tileWrap.innerHTML = "";
  const counts = {};
  for (const p of base){
    counts[p.categoria] = (counts[p.categoria]||0)+1;
  }
  const tileCats = cats.slice(0, 6);
  for (const c of tileCats){
    const t = document.createElement("div");
    t.className = "tile";
    t.innerHTML = `<div class="tile__t">${escapeHtml_(c)}</div><div class="tile__s">${counts[c]||0} productos</div>`;
    t.onclick = ()=>{
      state.selectedCat = c;
      state.selectedSub = "all";
      state.page = 1;
      syncFilters_();
      scrollToList_();
      renderAll_(true);
    };
    tileWrap.appendChild(t);
  }

  // Category select
  const selCat = el("selCat");
  selCat.innerHTML = [`<option value="all">Todas</option>`]
    .concat(cats.map(c=>`<option value="${escapeHtml_(c)}">${escapeHtml_(c)}</option>`))
    .join("");

  if (!["all", ...cats].includes(state.selectedCat)) state.selectedCat = "all";
  selCat.value = state.selectedCat;

  // Sub select
  syncSubSelector_();

  // Active quick highlight
  [...quick.querySelectorAll(".quick__btn")].forEach(btn=>{
    btn.classList.toggle("quick__btn--active", btn.textContent === state.selectedCat);
  });
}

// ===== Drawer + URL State =====
function openDrawer_(){
  const d = el("drawer");
  const b = el("drawerBackdrop");
  if (!d || !b) return;
  b.hidden = false;
  d.hidden = false;
  requestAnimationFrame(()=> d.classList.add("drawer--open"));
  const input = document.getElementById("drawerSearch");
  if (input){
    input.value = state.search || "";
    setTimeout(()=> input.focus(), 80);
  }
  syncDrawerActive_();
}

function closeDrawer_(){
  const d = el("drawer");
  const b = el("drawerBackdrop");
  if (!d || !b) return;
  d.classList.remove("drawer--open");
  // esperar transición
  setTimeout(()=>{
    d.hidden = true;
    b.hidden = true;
  }, 220);
}

function applyAndRender_(scroll=true){
  state.page = 1;
  syncFilters_();
  renderAll_(true);
  if (scroll) scrollToList_();
  setUrlState_("replace");
  syncDrawerActive_();
}

function buildDrawerUI_(){
  const catsBox = el("drawerCats");
  const brandsBox = el("drawerBrands");
  if (!catsBox || !brandsBox) return;

  // Categorías / subcategorías
  const tax = (state.taxonomy && state.taxonomy.length) ? state.taxonomy : buildTaxonomy_(state.products);
  const sortedTax = [...tax].sort((a,b)=>String(a.categoria).localeCompare(String(b.categoria),"es"));
  catsBox.innerHTML = "";

  for (const t of sortedTax){
    const cat = safeText(t.categoria).trim();
    if (!cat) continue;

    const wrap = document.createElement("div");
    wrap.className = "drawer__cat";
    wrap.dataset.cat = cat;

    const btn = document.createElement("button");
    btn.className = "drawer__catBtn";
    btn.innerHTML = `<span>${escapeHtml_(cat)}</span><span class="muted">›</span>`;
    btn.addEventListener("click", ()=>{
      // Selecciona categoría y abre
      if (state.selectedCat !== cat){
        state.selectedCat = cat;
        state.selectedSub = "all";
        state.selectedBrand = "all";
        applyAndRender_(true);
      }
      wrap.classList.toggle("drawer__cat--open", true);
      // cerrar otras
      [...catsBox.children].forEach(x=>{ if (x!==wrap) x.classList.remove("drawer__cat--open"); });
    });

    const subs = document.createElement("div");
    subs.className = "drawer__subs";

    const subList = Array.isArray(t.subcategorias) ? t.subcategorias : [];
    const sortedSubs = [...subList].filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b),"es"));

    if (sortedSubs.length){
      for (const s of sortedSubs){
        const sb = document.createElement("button");
        sb.className = "drawer__subBtn";
        sb.textContent = s;
        sb.addEventListener("click", ()=>{
          state.selectedCat = cat;
          state.selectedSub = s;
          state.selectedBrand = "all";
          closeDrawer_();
          applyAndRender_(true);
        });
        subs.appendChild(sb);
      }
    } else {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.style.padding = "8px 10px";
      empty.textContent = "Sin subcategorías";
      subs.appendChild(empty);
    }

    wrap.appendChild(btn);
    wrap.appendChild(subs);
    catsBox.appendChild(wrap);
  }

  // Marcas
  const brands = Array.from(new Set(state.products.map(p=>safeText(p.marca).trim()).filter(Boolean)))
    .sort((a,b)=>a.localeCompare(b,"es"));
  brandsBox.innerHTML = "";
  for (const b of brands){
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = b;
    chip.dataset.brand = b;
    chip.addEventListener("click", ()=>{
      state.selectedBrand = (state.selectedBrand === b) ? "all" : b;
      closeDrawer_();
      applyAndRender_(true);
    });
    brandsBox.appendChild(chip);
  }

  syncDrawerActive_();
}

function syncDrawerActive_(){
  const catsBox = el("drawerCats");
  const brandsBox = el("drawerBrands");
  if (!catsBox || !brandsBox) return;

  [...catsBox.children].forEach(w=>{
    const cat = w.dataset.cat;
    w.classList.toggle("drawer__cat--open", cat === state.selectedCat);
  });

  [...brandsBox.querySelectorAll(".chip")].forEach(ch=>{
    ch.classList.toggle("chip--active", ch.dataset.brand === state.selectedBrand);
  });
}

function applyUrlStateFromLocation_(){
  const u = readUrlState_();

  // view UI
  state.view = (u.view === "offers") ? "offers" : "catalog";
  document.getElementById("tabCatalog").classList.toggle("pill--active", state.view==="catalog");
  document.getElementById("tabOffers").classList.toggle("pill--active", state.view==="offers");
  document.getElementById("brandSub").textContent = state.view==="offers" ? "Ofertas" : "Catálogo";

  state.selectedCat = u.cat || "all";
  state.selectedSub = u.sub || "all";
  state.selectedBrand = u.brand || "all";
  state.search = u.q || "";
  state.stockFilter = u.stock || "all";
  state.sort = u.sort || "relev";
  state.page = 1;

  // sync UI controls
  const search = document.getElementById("search");
  if (search) search.value = state.search;
  const dsearch = document.getElementById("drawerSearch");
  if (dsearch) dsearch.value = state.search;

  syncFilters_();
  buildCategoryUI_();
  renderFeatured_();
  renderAll_(true);

  if (u.p){
    const found = state.products.find(x => safeText(x.id) === safeText(u.p));
    if (found){
      openProduct(found, "replace");
    }
  } else {
    closeProduct(false);
  }

  syncDrawerActive_();
}


function syncSubSelector_(){
  const base = state.view === "offers"
    ? state.products.filter(p => Array.isArray(p.ofertas) && p.ofertas.length>0)
    : state.products;

  const cat = state.selectedCat;
  const subs = uniq(base
      .filter(p => cat==="all" ? true : p.categoria===cat)
      .map(p => safeText(p.subcategoria).trim())
      .filter(Boolean))
    .sort((a,b)=>a.localeCompare(b,"es"));

  const selSub = el("selSub");
  const opts = ["all", ...subs];
  selSub.innerHTML = opts.map(s=>`<option value="${escapeHtml_(s)}">${s==="all" ? "Todas" : escapeHtml_(s)}</option>`).join("");

  if (!opts.includes(state.selectedSub)) state.selectedSub = "all";
  selSub.value = state.selectedSub;
}

function syncFilters_(){
  el("selCat").value = state.selectedCat;
  syncSubSelector_();
  el("selSub").value = state.selectedSub;
  el("selSort").value = state.sort;

  [...el("stockChips").querySelectorAll(".chip")].forEach(x=>{
    x.classList.toggle("chip--active", x.dataset.filter === state.stockFilter);
  });
  // drawer
  const dsearch = document.getElementById("drawerSearch");
  if (dsearch) dsearch.value = state.search || "";
  syncDrawerActive_();
}

function initHomeStats_(){
  el("statProducts").textContent = String(state.products.length || 0);
  const tax = state.taxonomy.length ? state.taxonomy : buildTaxonomy_(state.products);
  el("statCats").textContent = String(tax.length || 0);
}

function scrollToList_(){
  const y = document.getElementById("featuredSection").getBoundingClientRect().top + window.scrollY - 90;
  window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
}

// ===== Filtering / Sorting / Paging =====
function getFilteredProducts_(){
  const term = state.search.trim().toLowerCase();
  let list = [...state.products];

  if (state.view === "offers") {
    list = list.filter(p => Array.isArray(p.ofertas) && p.ofertas.length > 0);
  }

  if (state.selectedCat !== "all") list = list.filter(p => p.categoria === state.selectedCat);
  if (state.selectedSub !== "all") list = list.filter(p => p.subcategoria === state.selectedSub);
  if (state.selectedBrand !== "all") list = list.filter(p => safeText(p.marca).trim() === state.selectedBrand);

  if (state.stockFilter === "inStock") list = list.filter(p => !p.agotado);
  if (state.stockFilter === "outStock") list = list.filter(p => p.agotado);

  if (term){
    list = list.filter(p => {
      const hay = [p.nombre,p.marca,p.categoria,p.subcategoria,p.descripcion]
        .map(x=>safeText(x).toLowerCase()).join(" ");
      return hay.includes(term);
    });
  }

  // Sort
  const s = state.sort;
  if (s === "price_asc") list.sort((a,b)=>Number(a.precio||0)-Number(b.precio||0));
  else if (s === "price_desc") list.sort((a,b)=>Number(b.precio||0)-Number(a.precio||0));
  else if (s === "name_asc") list.sort((a,b)=>safeText(a.nombre).localeCompare(safeText(b.nombre),"es"));
  else {
    // relev: in-stock first, promos next, then name
    list.sort((a,b)=>{
      if (a.agotado !== b.agotado) return a.agotado ? 1 : -1;
      const ap = (Array.isArray(a.ofertas) && a.ofertas.length>0) ? 0 : 1;
      const bp = (Array.isArray(b.ofertas) && b.ofertas.length>0) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return safeText(a.nombre).localeCompare(safeText(b.nombre),"es");
    });
  }

  return list;
}

function paginate_(list){
  const end = state.page * state.pageSize;
  return list.slice(0, end);
}

function renderAll_(reset){
  if (reset) state.page = 1;

  // header meta
  const list = getFilteredProducts_();
  el("pillCount").textContent = `${list.length} productos`;
  el("empty").hidden = list.length !== 0;

  // title
  const title = document.getElementById("listTitle");
  if (state.view === "offers") title.textContent = "Productos en oferta";
  else if (state.selectedCat !== "all") title.textContent = state.selectedCat;
  else title.textContent = "Productos";

  // quick highlight
  buildCategoryUI_();

  // render grid
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  const shown = paginate_(list);
  for (const p of shown){
    grid.appendChild(productCard_(p));
  }

  // more button
  const more = document.getElementById("btnMore");
  more.style.display = (shown.length < list.length) ? "inline-flex" : "none";
}

function renderFeatured_(){
  const list = [...state.products];
  // pick up to 8: promos first, then high stock
  list.sort((a,b)=>{
    const ap = (Array.isArray(a.ofertas)&&a.ofertas.length>0) ? 0 : 1;
    const bp = (Array.isArray(b.ofertas)&&b.ofertas.length>0) ? 0 : 1;
    if (ap!==bp) return ap-bp;
    return Number(b.stock||0)-Number(a.stock||0);
  });
  const picks = list.slice(0, 8);
  const wrap = document.getElementById("featured");
  wrap.innerHTML = "";
  for (const p of picks){
    wrap.appendChild(productCard_(p, true));
  }
}

function placeholderImg_(name){
  const text = encodeURIComponent((name||"Producto").slice(0,22));
  return `data:image/svg+xml;charset=utf-8,` + encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='1200' height='900'>
      <defs>
        <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0' stop-color='#1b2636'/>
          <stop offset='1' stop-color='#101826'/>
        </linearGradient>
      </defs>
      <rect width='100%' height='100%' fill='url(#g)'/>
      <text x='50%' y='50%' fill='#9fb0c6' font-family='Inter,Arial' font-size='44' text-anchor='middle' dominant-baseline='middle'>${text}</text>
    </svg>
  `);
}

function escapeHtml_(s){
  return safeText(s)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function productCard_(p, compact=false){
  const card = document.createElement("article");
  card.className = "card";
  card.onclick = ()=> openProduct(p);

  const imgwrap = document.createElement("div");
  imgwrap.className = "card__imgwrap";

  const img = document.createElement("img");
  img.className = "card__img";
  img.loading = "lazy";
  img.src = p.img || placeholderImg_(p.nombre);
  img.alt = p.nombre || "Producto";
  imgwrap.appendChild(img);

  // ribbon
  const hasPromo = Array.isArray(p.ofertas) && p.ofertas.length>0;
  if (p.agotado || hasPromo){
    const rib = document.createElement("div");
    rib.className = "ribbon " + (hasPromo ? "ribbon--promo" : "ribbon--out");
    rib.textContent = p.agotado ? "Agotado" : "Promo";
    imgwrap.appendChild(rib);
  }

  card.appendChild(imgwrap);

  const body = document.createElement("div");
  body.className = "card__body";

  const title = document.createElement("a");
  title.className = "card__title link";
  title.href = productLink_(p);
  title.textContent = p.nombre || "Producto";
  title.addEventListener("click", (e)=>{ e.preventDefault(); openProduct(p); });
  body.appendChild(title);

  const tags = document.createElement("div");
  tags.className = "card__tags";
  if (compact){
    tags.appendChild(tag_(p.categoria || "—"));
  } else {
    tags.appendChild(tag_(p.categoria || "—"));
    if (p.subcategoria) tags.appendChild(tag_(p.subcategoria));
  }
  body.appendChild(tags);

  const row = document.createElement("div");
  row.className = "row";

  const price = document.createElement("div");
  price.className = "price";
  price.textContent = moneyL(p.precio);
  row.appendChild(price);

  const badge = document.createElement("div");
  badge.className = "badge " + (p.agotado ? "badge--bad" : "badge--good");
  badge.textContent = p.agotado ? "Agotado" : `Stock: ${Number(p.stock||0)}`;
  row.appendChild(badge);

  body.appendChild(row);
  card.appendChild(body);
  return card;
}

function tag_(txt){
  const t = document.createElement("div");
  t.className = "tag";
  t.textContent = txt || "—";
  return t;
}

// ===== Product Modal =====
function openProduct(p, urlMode="push"){

  state.activeProduct = p;
  state.selectedOfferQty = null;
  setUrlState_(urlMode);

  el("modalTitle").textContent = p.nombre || "Producto";
  el("modalPrice").textContent = moneyL(p.precio);
  const catLink = el("modalCatLink");
  const subLink = el("modalSubLink");
  const cat = p.categoria || "all";
  const sub = p.subcategoria || "all";

  catLink.textContent = (cat === "all") ? "—" : cat;
  catLink.href = categoryLink_(cat);
  subLink.textContent = (sub === "all") ? "—" : sub;
  subLink.href = subcategoryLink_(cat, sub);

  catLink.onclick = (e)=>{ e.preventDefault(); closeProduct(false); state.view="catalog"; state.selectedCat = cat; state.selectedSub = "all"; state.page=1; syncFilters_(); renderAll_(true); scrollToList_(); closeDrawer_(); setUrlState_("replace"); };
  subLink.onclick = (e)=>{ e.preventDefault(); closeProduct(false); state.view="catalog"; state.selectedCat = cat; state.selectedSub = sub; state.page=1; syncFilters_(); renderAll_(true); scrollToList_(); closeDrawer_(); setUrlState_("replace"); };
  el("modalDesc").textContent = p.descripcion || "Sin descripción por ahora.";

  const badge = el("modalBadge");
  if (p.agotado){
    badge.className = "badge badge--bad";
    badge.textContent = "Agotado";
    el("btnOrder").disabled = true;
    el("btnAsk").disabled = false;
  } else {
    badge.className = "badge badge--good";
    badge.textContent = `Stock: ${Number(p.stock||0)}`;
    el("btnOrder").disabled = false;
    el("btnAsk").disabled = true;
  }

  const video = safeText(p.video_url).trim();
  if (video){
    el("videoLine").hidden = false;
    el("modalVideo").href = video;
  } else {
    el("videoLine").hidden = true;
    el("modalVideo").removeAttribute("href");
  }

  el("qty").value = 1;

  const imgs = [p.img, ...(p.galeria||[])].filter(Boolean);
  const hero = el("heroImg");
  const thumbs = el("thumbs");
  thumbs.innerHTML = "";
  hero.src = (imgs[0] || placeholderImg_(p.nombre));
  hero.alt = p.nombre || "Producto";

  imgs.forEach((u, idx)=>{
    const t = document.createElement("div");
    t.className = "thumb" + (idx===0 ? " thumb--active" : "");
    const im = document.createElement("img");
    im.src = u;
    im.alt = "Miniatura";
    t.appendChild(im);
    t.addEventListener("click", ()=>{
      hero.src = u;
      [...thumbs.children].forEach(x=>x.classList.remove("thumb--active"));
      t.classList.add("thumb--active");
    });
    thumbs.appendChild(t);
  });

  const offers = Array.isArray(p.ofertas) ? p.ofertas : [];
  const offersBox = el("offersBox");
  const offersTable = el("offersTable");
  offersTable.innerHTML = "";
  if (offers.length){
    offersBox.hidden = false;
    offers.forEach(o=>{
      const row = document.createElement("div");
      row.className = "offer";
      const left = document.createElement("div");
      left.className = "offer__left";
      const qty = document.createElement("div");
      qty.className = "offer__qty";
      qty.textContent = `Llevá ${o.qty}`;
      const small = document.createElement("div");
      small.className = "offer__small";
      const total = o.qty * o.precio_unit;
      small.textContent = `${moneyL(o.precio_unit)} c/u • Total ${moneyL(total)}`;
      left.appendChild(qty);
      left.appendChild(small);

      const right = document.createElement("div");
      right.className = "badge";
      right.textContent = "Promo";

      row.appendChild(left);
      row.appendChild(right);

      row.addEventListener("click", ()=>{
        state.selectedOfferQty = o.qty;
        el("qty").value = o.qty;
        [...offersTable.children].forEach(x=>x.classList.remove("offer--active"));
        row.classList.add("offer--active");
      });

      offersTable.appendChild(row);
    });
  } else {
    offersBox.hidden = true;
  }

  el("productBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeProduct(updateUrl=true){
  el("productBackdrop").hidden = true;
  document.body.style.overflow = "";
  state.activeProduct = null;
  if (updateUrl) setUrlState_("replace");
}
function clampQty(){
  let v = Number(el("qty").value || 1);
  if (!Number.isFinite(v) || v < 1) v = 1;
  v = Math.floor(v);
  el("qty").value = v;
  return v;
}
function markOfferNone_(){
  const offersTable = el("offersTable");
  [...offersTable.children].forEach(x=>x.classList.remove("offer--active"));
  state.selectedOfferQty = null;
}
function makeWhatsAppMsg(p, qty){
  const hasOffers = Array.isArray(p.ofertas) && p.ofertas.length>0;
  let unit = Number(p.precio||0);
  let promoLine = "";

  if (hasOffers && state.selectedOfferQty && qty === state.selectedOfferQty){
    const found = p.ofertas.find(x => Number(x.qty) === Number(qty));
    if (found){
      unit = Number(found.precio_unit);
      promoLine = ` (promo x${qty})`;
    }
  }
  const total = qty * unit;
  return [
    `Hola 👋`,
    `Quiero: ${qty} x ${p.nombre}${promoLine}`,
    `Precio: ${moneyL(unit)} c/u • Total: ${moneyL(total)}`,
    ``,
    `Mi ubicación (Depto/Muni/Zona):`,
    `Forma de envío: (Prepago / Pago al recibir / Domicilio)`,
  ].join("\\n");
}
function openWhatsApp(msg){
  const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank", "noopener");
}
function logOrderNoCors_(p, qty, tipo="pedido"){
  if (!CONFIG.apiUrl) return;
  try{
    const params = new URLSearchParams({
      action: "logOrder",
      tipo,
      id_producto: p.id || "",
      nombre: p.nombre || "",
      qty: String(qty || 0),
      precio_unit: String(p.precio || 0),
      origen: "web"
    });
    const img = new Image();
    img.src = CONFIG.apiUrl + "?" + params.toString();
  }catch(_){}
}

// ===== Shipping Modal =====
function openShipping(){
  el("shipBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  buildShippingSelectors();
  renderShippingResults();
}
function closeShipping(){
  el("shipBackdrop").hidden = true;
  document.body.style.overflow = "";
}
function normalizeEnvios_(){
  return state.envios.map(r => ({
    tipo: safeText(r.tipo).trim().toLowerCase(),
    departamento: safeText(r.departamento).trim(),
    municipio: safeText(r.municipio).trim(),
    zona: safeText(r.zona).trim(),
    empresa: safeText(r.empresa).trim(),
    prepago: Number(r.prepago||0),
    pago_al_recibir: Number(r.pago_al_recibir||0),
    notas: safeText(r.notas).trim(),
  })).filter(r => r.departamento && r.municipio);
}
function buildShippingSelectors(){
  const rows = normalizeEnvios_();
  const depts = uniq(rows.map(r=>r.departamento)).sort((a,b)=>a.localeCompare(b,"es"));
  const selDept = el("selDept");
  const selMuni = el("selMuni");
  const selZone = el("selZone");

  selDept.innerHTML = depts.map(d=>`<option>${escapeHtml_(d)}</option>`).join("");
  if (!selDept.value && depts.length) selDept.value = depts[0];

  const updateMuni = () => {
    const d = selDept.value;
    const munis = uniq(rows.filter(r=>r.departamento===d).map(r=>r.municipio)).sort((a,b)=>a.localeCompare(b,"es"));
    selMuni.innerHTML = munis.map(m=>`<option>${escapeHtml_(m)}</option>`).join("");
    if (!munis.includes(selMuni.value)) selMuni.value = munis[0] || "";
    updateZone();
  };
  const updateZone = () => {
    const d = selDept.value;
    const m = selMuni.value;
    const zones = uniq(rows.filter(r=>r.departamento===d && r.municipio===m).map(r=>r.zona).filter(Boolean))
      .sort((a,b)=>a.localeCompare(b,"es"));
    const opts = ["(Sin zona)"].concat(zones);
    selZone.innerHTML = opts.map(z=>`<option>${escapeHtml_(z)}</option>`).join("");
    if (!opts.includes(selZone.value)) selZone.value = "(Sin zona)";
  };

  selDept.onchange = ()=>{ updateMuni(); renderShippingResults(); };
  selMuni.onchange = ()=>{ updateZone(); renderShippingResults(); };
  selZone.onchange = ()=>{ renderShippingResults(); };

  updateMuni();
}
function renderShippingResults(){
  const rows = normalizeEnvios_();
  const d = el("selDept").value;
  const m = el("selMuni").value;
  const z = el("selZone").value;
  const zone = (z === "(Sin zona)") ? "" : z;

  const matches = rows.filter(r => r.departamento===d && r.municipio===m)
    .filter(r => {
      if (r.zona && zone) return r.zona === zone || r.zona.toUpperCase()==="GENERAL";
      if (r.zona && !zone) return r.zona.toUpperCase()==="GENERAL";
      return true;
    });

  const results = el("shipResults");
  results.innerHTML = "";

  if (!matches.length){
    results.innerHTML = `<div class="shipcard">
      <div class="shipcard__title">Sin tarifas</div>
      <div class="muted">No hay precios para esta ubicación. Editalo en la hoja <b>envios</b>.</div>
    </div>`;
    return;
  }

  const groups = {};
  for (const r of matches){
    const key = `${r.tipo}|${r.empresa||"—"}|${r.zona||""}`;
    if (!groups[key]) groups[key] = r;
  }

  Object.keys(groups).sort().forEach(key=>{
    const g = groups[key];
    const card = document.createElement("div");
    card.className = "shipcard";

    const title = document.createElement("div");
    title.className = "shipcard__title";
    title.textContent =
      (g.tipo === "domicilio" ? "Domicilio" : "Paquetería") +
      (g.empresa ? ` • ${g.empresa}` : "") +
      (g.zona ? ` • ${g.zona}` : "");
    card.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "shipcard__grid";
    grid.innerHTML = `
      <div><b>Prepago:</b> ${g.prepago>0 ? moneyL(g.prepago) : "—"}</div>
      <div><b>Pago al recibir:</b> ${g.pago_al_recibir>0 ? moneyL(g.pago_al_recibir) : "—"}</div>
      <div><b>Notas:</b> ${escapeHtml_(g.notas||"")}</div>
    `;
    card.appendChild(grid);
    results.appendChild(card);
  });
}

// ===== Events =====
function setView_(view){
  state.view = view;
  state.page = 1;
  document.getElementById("tabCatalog").classList.toggle("pill--active", view==="catalog");
  document.getElementById("tabOffers").classList.toggle("pill--active", view==="offers");
  document.getElementById("brandSub").textContent = view==="offers" ? "Ofertas" : "Catálogo";
  buildCategoryUI_();
  renderFeatured_();
  renderAll_(true);
  closeProduct(false);
  setUrlState_("replace");
}

function initEvents(){
  document.getElementById("tabCatalog").addEventListener("click", ()=> setView_("catalog"));
  document.getElementById("tabOffers").addEventListener("click", ()=> setView_("offers"));

  document.getElementById("btnTheme").addEventListener("click", toggleTheme_);
  document.getElementById("btnShipping").addEventListener("click", openShipping);
  document.getElementById("btnSetup").addEventListener("click", showSetupModal);

  // Drawer (menú)
  const btnMenu = document.getElementById("btnMenu");
  if (btnMenu) btnMenu.addEventListener("click", openDrawer_);
  const btnDrawerFromProduct = document.getElementById("btnDrawerFromProduct");
  if (btnDrawerFromProduct) btnDrawerFromProduct.addEventListener("click", openDrawer_);
  const btnBrowse = document.getElementById("btnBrowse");
  if (btnBrowse) btnBrowse.addEventListener("click", ()=>{ closeProduct(false); openDrawer_(); });

  const btnCopy = document.getElementById("btnCopyLink");
  if (btnCopy) btnCopy.addEventListener("click", async ()=>{
    const ok = await copyText_(location.href);
    el("status").textContent = ok ? "Link copiado ✅" : "No pude copiar el link 😕";
    setTimeout(()=>{ el("status").textContent = "Listo."; }, 1800);
  });

  const btnCloseDrawer = document.getElementById("btnCloseDrawer");
  if (btnCloseDrawer) btnCloseDrawer.addEventListener("click", closeDrawer_);
  const drawerBackdrop = document.getElementById("drawerBackdrop");
  if (drawerBackdrop) drawerBackdrop.addEventListener("click", closeDrawer_);

  const drawerSearch = document.getElementById("drawerSearch");
  if (drawerSearch) drawerSearch.addEventListener("input", debounce((e)=>{
    state.search = e.target.value || "";
    applyAndRender_(false);
  }, 150));

  const goCat = document.getElementById("drawerGoCatalog");
  if (goCat) goCat.addEventListener("click", ()=>{ setView_("catalog"); closeDrawer_(); scrollToList_(); });

  const goOff = document.getElementById("drawerGoOffers");
  if (goOff) goOff.addEventListener("click", ()=>{ setView_("offers"); closeDrawer_(); scrollToList_(); });

  const clr = document.getElementById("drawerClear");
  if (clr) clr.addEventListener("click", ()=>{
    state.selectedCat="all"; state.selectedSub="all"; state.selectedBrand="all";
    state.stockFilter="all"; state.sort="relev"; state.search=""; state.page=1;
    const s = document.getElementById("search"); if (s) s.value = "";
    const ds = document.getElementById("drawerSearch"); if (ds) ds.value = "";
    closeDrawer_();
    syncFilters_();
    renderAll_(true);
    setUrlState_("replace");
  });
  document.getElementById("goHome").addEventListener("click", (e)=>{ e.preventDefault(); window.scrollTo({top:0,behavior:"smooth"}); });

  document.getElementById("btnExplore").addEventListener("click", scrollToList_);
  document.getElementById("btnViewOffers").addEventListener("click", ()=>{ setView_("offers"); scrollToList_(); });

  document.getElementById("btnClear").addEventListener("click", ()=>{
    state.selectedCat="all"; state.selectedSub="all"; state.stockFilter="all"; state.sort="relev"; state.search=""; state.page=1;
    document.getElementById("search").value = "";
    syncFilters_();
    renderAll_(true);
    setUrlState_("replace");
  });

  document.getElementById("btnMore").addEventListener("click", ()=>{
    state.page += 1;
    renderAll_(false);
  });

  document.getElementById("search").addEventListener("input", debounce((e)=>{
    state.search = e.target.value || "";
    state.page = 1;
    renderAll_(true);
    setUrlState_("replace");
  }, 150));

  document.getElementById("selCat").addEventListener("change", ()=>{
    state.selectedCat = document.getElementById("selCat").value;
    state.selectedSub = "all";
    state.page = 1;
    syncSubSelector_();
    renderAll_(true);
    setUrlState_("replace");
  });
  document.getElementById("selSub").addEventListener("change", ()=>{
    state.selectedSub = document.getElementById("selSub").value;
    state.page = 1;
    renderAll_(true);
    setUrlState_("replace");
  });
  document.getElementById("selSort").addEventListener("change", ()=>{
    state.sort = document.getElementById("selSort").value;
    state.page = 1;
    renderAll_(true);
    setUrlState_("replace");
  });

  document.getElementById("stockChips").addEventListener("click", (e)=>{
    const btn = e.target.closest(".chip");
    if (!btn) return;
    state.stockFilter = btn.dataset.filter;
    state.page = 1;
    syncFilters_();
    renderAll_(true);
    setUrlState_("replace");
  });

  // modals
  document.getElementById("btnCloseProduct").addEventListener("click", closeProduct);
  document.getElementById("productBackdrop").addEventListener("click", (e)=>{ if (e.target === document.getElementById("productBackdrop")) closeProduct(); });

  document.getElementById("btnCloseShip").addEventListener("click", closeShipping);
  document.getElementById("shipBackdrop").addEventListener("click", (e)=>{ if (e.target === document.getElementById("shipBackdrop")) closeShipping(); });

  document.getElementById("qtyMinus").addEventListener("click", ()=>{
    const v = clampQty();
    document.getElementById("qty").value = Math.max(1, v-1);
    markOfferNone_();
  });
  document.getElementById("qtyPlus").addEventListener("click", ()=>{
    const v = clampQty();
    document.getElementById("qty").value = v+1;
    markOfferNone_();
  });
  document.getElementById("qty").addEventListener("input", ()=>{ clampQty(); markOfferNone_(); });

  document.getElementById("btnOrder").addEventListener("click", ()=>{
    const p = state.activeProduct;
    if (!p) return;
    const qty = clampQty();
    openWhatsApp(makeWhatsAppMsg(p, qty));
    logOrderNoCors_(p, qty);
  });
  document.getElementById("btnAsk").addEventListener("click", ()=>{
    const p = state.activeProduct;
    if (!p) return;
    openWhatsApp(`Hola 👋 ¿Tenés disponible: ${p.nombre}?`);
    logOrderNoCors_(p, 0, "consulta");
  });

  window.addEventListener("keydown", (e)=>{
    if (e.key === "Escape"){ closeProduct(); closeShipping(); }
  });
}

// ===== Boot =====
(async function main(){
  setTheme_(getSavedTheme_());
  initEvents();
  await loadConfig();
  await loadData();
  buildDrawerUI_();
  applyUrlStateFromLocation_();
  window.addEventListener("popstate", applyUrlStateFromLocation_);
})();
