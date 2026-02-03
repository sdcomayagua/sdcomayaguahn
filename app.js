// SDComayagua PRO v5 – Drawer + Deep Links
const DEFAULT_CONFIG = { apiUrl:"", whatsappNumber:"50431517755", tiendaNombre:"SDComayagua", socials:{fb:"",ig:"",tt:""} };
let CONFIG = {...DEFAULT_CONFIG};

const state = {
  view:"catalog",
  products:[], envios:[], taxonomy:[],
  selectedCat:"all", selectedSub:"all", selectedBrand:"all",
  search:"", stockFilter:"all", sort:"relev",
  activeProduct:null, selectedOfferQty:null,
  page:1, pageSize:24
};

const el = id => document.getElementById(id);
const safe = s => (s==null?"":String(s));
const money = n => `L ${Number(n||0).toFixed(0)}`;
const uniq = a => Array.from(new Set(a));
const debounce=(fn,ms=200)=>{let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),ms);}};

function setTheme(theme){
  const t = theme==="dark"?"dark":"light";
  document.documentElement.setAttribute("data-theme", t);
  try{localStorage.setItem("tienda_theme", t);}catch(_){}
}
function toggleTheme(){
  const cur = document.documentElement.getAttribute("data-theme")||"light";
  setTheme(cur==="dark"?"light":"dark");
}

function getSavedConfig(){ try{return JSON.parse(localStorage.getItem("tienda_config_v5")||"{}");}catch(_){return {}}; }
function saveConfig(cfg){ try{localStorage.setItem("tienda_config_v5", JSON.stringify(cfg));}catch(_){ } }

function showSetup(){
  const b=document.createElement("div");
  b.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.68);display:grid;place-items:center;padding:16px;z-index:9999";
  const c=document.createElement("div");
  c.style.cssText="width:min(720px,100%);border-radius:20px;background:rgba(16,24,38,.98);color:#e9eef7;padding:14px;box-shadow:0 14px 40px rgba(0,0,0,.35)";
  c.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,.10);padding-bottom:10px;margin-bottom:12px;">
      <div style="font-weight:900;">Configurar tienda</div>
      <button id="setupX" style="border:none;background:rgba(255,255,255,.08);color:#e9eef7;width:38px;height:38px;border-radius:12px;cursor:pointer;">✕</button>
    </div>
    <div style="color:#9fb0c6;font-size:13px;margin-bottom:10px;">Pegá la URL de tu Apps Script (termina en <b>/exec</b>).</div>
    <label style="display:block;color:#9fb0c6;font-weight:800;font-size:12px;margin-bottom:6px;">URL API (/exec)</label>
    <input id="setupApi" placeholder="https://script.google.com/macros/s/XXXX/exec" style="width:100%;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(15,22,34,.75);color:#e9eef7;outline:none;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
      <div>
        <label style="display:block;color:#9fb0c6;font-weight:800;font-size:12px;margin-bottom:6px;">WhatsApp</label>
        <input id="setupWa" placeholder="50431517755" style="width:100%;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(15,22,34,.75);color:#e9eef7;outline:none;">
      </div>
      <div>
        <label style="display:block;color:#9fb0c6;font-weight:800;font-size:12px;margin-bottom:6px;">Nombre</label>
        <input id="setupName" placeholder="SDComayagua" style="width:100%;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(15,22,34,.75);color:#e9eef7;outline:none;">
      </div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
      <button id="setupSave" style="flex:1;min-width:220px;padding:12px 14px;border-radius:14px;border:1px solid rgba(79,209,197,.28);background:rgba(79,209,197,.10);color:#e9eef7;font-weight:900;cursor:pointer;">Guardar</button>
      <button id="setupHelp" style="flex:1;min-width:220px;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(15,22,34,.70);color:#e9eef7;font-weight:900;cursor:pointer;">¿Dónde saco la URL?</button>
    </div>
    <div id="setupMsg" style="color:#9fb0c6;font-size:12px;margin-top:10px;white-space:pre-wrap;"></div>
  `;
  b.appendChild(c); document.body.appendChild(b); document.body.style.overflow="hidden";
  const saved=getSavedConfig();
  const api=document.getElementById("setupApi"), wa=document.getElementById("setupWa"), nm=document.getElementById("setupName");
  api.value=saved.apiUrl||CONFIG.apiUrl||""; wa.value=saved.whatsappNumber||CONFIG.whatsappNumber||""; nm.value=saved.tiendaNombre||CONFIG.tiendaNombre||"";
  const close=()=>{document.body.style.overflow="";b.remove();};
  document.getElementById("setupX").onclick=close;
  document.getElementById("setupHelp").onclick=()=>{document.getElementById("setupMsg").textContent=
`En tu Google Sheet:
1) Extensiones → Apps Script
2) Implementar → Nueva implementación → Aplicación web
3) Copiá la URL que termina en /exec`;};
  document.getElementById("setupSave").onclick=()=>{
    const apiUrl=api.value.trim(); const whatsappNumber=wa.value.trim().replace(/\D/g,""); const tiendaNombre=(nm.value.trim()||"SDComayagua");
    if(!apiUrl.includes("/exec")){document.getElementById("setupMsg").textContent="Pegá una URL válida que termine en /exec.";return;}
    saveConfig({apiUrl, whatsappNumber, tiendaNombre}); close(); location.reload();
  };
}

function jsonp(url){
  return new Promise((resolve,reject)=>{
    const cb="cb_"+Math.random().toString(36).slice(2);
    const sep=url.includes("?")?"&":"?";
    window[cb]=(data)=>{delete window[cb];script.remove();resolve(data);};
    const script=document.createElement("script");
    script.src=url+sep+"callback="+cb;
    script.onerror=()=>{delete window[cb];script.remove();reject(new Error("JSONP fail"));};
    document.head.appendChild(script);
  });
}

async function loadConfig(){
  const saved=getSavedConfig();
  try{
    const res=await fetch("config.json",{cache:"no-store"});
    const cfg=await res.json();
    CONFIG={...DEFAULT_CONFIG,...cfg,...saved};
  }catch(_){
    CONFIG={...DEFAULT_CONFIG,...saved};
  }
  document.title=`${CONFIG.tiendaNombre} – Catálogo`;
  el("btnWhatsApp").href=`https://wa.me/${CONFIG.whatsappNumber}`;
  el("drawerWhats").onclick=()=>window.open(`https://wa.me/${CONFIG.whatsappNumber}`,"_blank","noopener");
  if(CONFIG.socials?.fb){el("socialFb").href=CONFIG.socials.fb;}else{el("socialFb").style.display="none";}
  if(CONFIG.socials?.ig){el("socialIg").href=CONFIG.socials.ig;}else{el("socialIg").style.display="none";}
  if(CONFIG.socials?.tt){el("socialTt").href=CONFIG.socials.tt;}else{el("socialTt").style.display="none";}
  setTheme((localStorage.getItem("tienda_theme")||"light"));
}

function getUrl(){return new URL(window.location.href);}
function setParam(k,v){
  const u=getUrl();
  if(v==null||v===""||v==="all") u.searchParams.delete(k); else u.searchParams.set(k,v);
  history.replaceState({}, "", u.toString());
}
function getParam(k){return getUrl().searchParams.get(k);}
function syncUrl(){ setParam("view", state.view==="offers"?"offers":null); setParam("cat", state.selectedCat); setParam("sub", state.selectedSub); setParam("q", state.search?.trim()?state.search.trim():null); setParam("brand", state.selectedBrand); }
function setProductParam(id){ setParam("p", id||null); }
function currentLink(){ return window.location.href; }

async function copy(text){
  try{ await navigator.clipboard.writeText(text); toast("Link copiado ✅"); }
  catch(_){ const ta=document.createElement("textarea"); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast("Link copiado ✅"); }
}
let toastT=null;
function toast(msg){
  let n=document.getElementById("toast");
  if(!n){ n=document.createElement("div"); n.id="toast";
    n.style.cssText="position:fixed;left:50%;bottom:18px;transform:translateX(-50%);padding:10px 12px;border-radius:14px;background:rgba(0,0,0,.75);color:#fff;font-family:Inter,system-ui,Arial;font-weight:800;z-index:9999;box-shadow:0 14px 40px rgba(0,0,0,.35)";
    document.body.appendChild(n);
  }
  n.textContent=msg; n.style.opacity="1"; clearTimeout(toastT); toastT=setTimeout(()=>n.style.opacity="0", 1400);
}

function buildTax(products){
  const m={};
  for(const p of products){
    const c=safe(p.categoria).trim()||"Sin categoría";
    if(!m[c]) m[c]=new Set();
    const s=safe(p.subcategoria).trim(); if(s) m[c].add(s);
  }
  return Object.keys(m).map(c=>({categoria:c, subcategorias:Array.from(m[c])}));
}
function initStats(){
  el("statProducts").textContent=String(state.products.length||0);
  const tax = state.taxonomy.length ? state.taxonomy : buildTax(state.products);
  el("statCats").textContent=String(tax.length||0);
}

function buildCategoryUI(){
  const base = state.view==="offers" ? state.products.filter(p=>Array.isArray(p.ofertas)&&p.ofertas.length>0) : state.products;
  const tax = state.taxonomy.length ? state.taxonomy : buildTax(base);
  const cats = tax.map(x=>x.categoria).filter(Boolean).sort((a,b)=>a.localeCompare(b,"es"));

  // quick pills
  const quick=el("quickCats"); quick.innerHTML="";
  cats.slice(0,8).forEach(c=>{
    const b=document.createElement("button");
    b.className="quick__btn"+(state.selectedCat===c?" quick__btn--active":"");
    b.textContent=c;
    b.onclick=()=>{
      state.selectedCat=(state.selectedCat===c)?"all":c;
      state.selectedSub="all"; state.selectedBrand="all"; state.page=1;
      syncFilters(); syncUrl(); renderAll(true);
    };
    quick.appendChild(b);
  });

  // tiles
  const counts={}; base.forEach(p=>counts[p.categoria]=(counts[p.categoria]||0)+1);
  const tileWrap=el("catTiles"); tileWrap.innerHTML="";
  cats.slice(0,6).forEach(c=>{
    const t=document.createElement("div");
    t.className="tile";
    t.innerHTML=`<div class="tile__t">${escapeHtml(c)}</div><div class="tile__s">${counts[c]||0} productos</div>`;
    t.onclick=()=>{ state.selectedCat=c; state.selectedSub="all"; state.selectedBrand="all"; state.page=1; syncFilters(); syncUrl(); scrollToList(); renderAll(true); };
    tileWrap.appendChild(t);
  });

  // selects
  const selCat=el("selCat");
  selCat.innerHTML=["<option value='all'>Todas</option>", ...cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)].join("");
  if(!["all",...cats].includes(state.selectedCat)) state.selectedCat="all";
  selCat.value=state.selectedCat;

  syncSubSelector();
  syncFilters();
}

function syncSubSelector(){
  const base = state.view==="offers" ? state.products.filter(p=>Array.isArray(p.ofertas)&&p.ofertas.length>0) : state.products;
  const cat=state.selectedCat;
  const subs = uniq(base.filter(p=>cat==="all"?true:p.categoria===cat).map(p=>safe(p.subcategoria).trim()).filter(Boolean)).sort((a,b)=>a.localeCompare(b,"es"));
  const selSub=el("selSub");
  const opts=["all",...subs];
  selSub.innerHTML=opts.map(s=>`<option value="${escapeHtml(s)}">${s==="all"?"Todas":escapeHtml(s)}</option>`).join("");
  if(!opts.includes(state.selectedSub)) state.selectedSub="all";
  selSub.value=state.selectedSub;
}

function syncFilters(){
  el("selCat").value=state.selectedCat;
  syncSubSelector();
  el("selSub").value=state.selectedSub;
  el("selSort").value=state.sort;
  [...el("stockChips").querySelectorAll(".chip")].forEach(x=>x.classList.toggle("chip--active", x.dataset.filter===state.stockFilter));
}

function openDrawer(){ el("drawerBackdrop").hidden=false; document.body.style.overflow="hidden"; el("drawerSearch").focus(); }
function closeDrawer(){ el("drawerBackdrop").hidden=true; document.body.style.overflow=""; }

function buildDrawerUI(){
  const tax = state.taxonomy.length ? state.taxonomy : buildTax(state.products);
  const cats = tax.map(x=>x.categoria).filter(Boolean).sort((a,b)=>a.localeCompare(b,"es"));
  const wrap=el("drawerCats"); wrap.innerHTML="";
  cats.forEach(c=>{
    const item=tax.find(x=>x.categoria===c);
    const subs=(item?.subcategorias||[]).filter(Boolean).sort((a,b)=>a.localeCompare(b,"es"));
    const block=document.createElement("div"); block.className="dcat";
    const head=document.createElement("button"); head.className="dcat__head";
    head.innerHTML=`<span>${escapeHtml(c)}</span><span class="muted">▾</span>`;
    const subWrap=document.createElement("div"); subWrap.className="dcat__sub";
    let open=false;
    head.onclick=()=>{
      open=!open;
      subWrap.style.display=open?"flex":"none";
      state.selectedCat=c; state.selectedSub="all"; state.selectedBrand="all"; state.page=1;
      syncFilters(); syncUrl(); renderAll(true);
    };
    subs.forEach(s=>{
      const b=document.createElement("button"); b.className="dsub"; b.textContent=s;
      b.onclick=(e)=>{ e.stopPropagation(); state.selectedCat=c; state.selectedSub=s; state.selectedBrand="all"; state.page=1; syncFilters(); syncUrl(); renderAll(true); closeDrawer(); scrollToList(); };
      subWrap.appendChild(b);
    });
    block.appendChild(head); block.appendChild(subWrap); wrap.appendChild(block);
  });

  const brands = uniq(state.products.map(p=>safe(p.marca).trim()).filter(Boolean)).sort((a,b)=>a.localeCompare(b,"es"));
  const bw=el("drawerBrands"); bw.innerHTML="";
  if(brands.length){
    const all=document.createElement("button"); all.className="dbrand"; all.textContent="Todas";
    all.onclick=()=>{ state.selectedBrand="all"; state.page=1; syncUrl(); renderAll(true); closeDrawer(); };
    bw.appendChild(all);
    brands.forEach(br=>{
      const b=document.createElement("button"); b.className="dbrand"; b.textContent=br;
      b.onclick=()=>{ state.selectedBrand=br; state.page=1; syncUrl(); renderAll(true); closeDrawer(); scrollToList(); };
      bw.appendChild(b);
    });
  } else {
    bw.innerHTML="<div class='muted' style='font-size:12px'>(No hay marcas todavía)</div>";
  }
}

function escapeHtml(s){
  return safe(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function placeholder(name){
  const t=encodeURIComponent((name||"Producto").slice(0,22));
  return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='900'>
      <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='#eef2ff'/><stop offset='1' stop-color='#ffffff'/>
      </linearGradient></defs>
      <rect width='100%' height='100%' fill='url(#g)'/>
      <text x='50%' y='50%' fill='#5b667a' font-family='Inter,Arial' font-size='44' text-anchor='middle' dominant-baseline='middle'>${t}</text>
    </svg>`
  );
}

function card(p,compact=false){
  const a=document.createElement("article"); a.className="card"; a.onclick=()=>openProduct(p);
  const iw=document.createElement("div"); iw.className="card__imgwrap";
  const img=document.createElement("img"); img.className="card__img"; img.loading="lazy"; img.src=p.img||placeholder(p.nombre); img.alt=p.nombre||"Producto";
  iw.appendChild(img);
  const hasPromo=Array.isArray(p.ofertas)&&p.ofertas.length>0;
  if(p.agotado||hasPromo){
    const r=document.createElement("div"); r.className="ribbon"; r.textContent=p.agotado?"Agotado":"Promo"; iw.appendChild(r);
  }
  a.appendChild(iw);

  const b=document.createElement("div"); b.className="card__body";
  const t=document.createElement("div"); t.className="card__title"; t.textContent=p.nombre||"Producto"; b.appendChild(t);
  const tags=document.createElement("div"); tags.className="card__tags";
  tags.appendChild(tag(p.categoria||"—")); if(!compact&&p.subcategoria) tags.appendChild(tag(p.subcategoria));
  b.appendChild(tags);
  const row=document.createElement("div"); row.className="row";
  const pr=document.createElement("div"); pr.className="price"; pr.textContent=money(p.precio); row.appendChild(pr);
  const bd=document.createElement("div"); bd.className="badge "+(p.agotado?"badge--bad":"badge--good"); bd.textContent=p.agotado?"Agotado":`Stock: ${Number(p.stock||0)}`; row.appendChild(bd);
  b.appendChild(row); a.appendChild(b);
  return a;
}
function tag(txt){ const t=document.createElement("div"); t.className="tag"; t.textContent=txt||"—"; return t; }

function filtered(){
  const term=state.search.trim().toLowerCase();
  let list=[...state.products];
  if(state.view==="offers") list=list.filter(p=>Array.isArray(p.ofertas)&&p.ofertas.length>0);
  if(state.selectedCat!=="all") list=list.filter(p=>p.categoria===state.selectedCat);
  if(state.selectedSub!=="all") list=list.filter(p=>p.subcategoria===state.selectedSub);
  if(state.selectedBrand!=="all") list=list.filter(p=>safe(p.marca).trim()===state.selectedBrand);
  if(state.stockFilter==="inStock") list=list.filter(p=>!p.agotado);
  if(state.stockFilter==="outStock") list=list.filter(p=>p.agotado);
  if(term){
    list=list.filter(p=>{
      const hay=[p.nombre,p.marca,p.categoria,p.subcategoria,p.descripcion].map(x=>safe(x).toLowerCase()).join(" ");
      return hay.includes(term);
    });
  }
  const s=state.sort;
  if(s==="price_asc") list.sort((a,b)=>Number(a.precio||0)-Number(b.precio||0));
  else if(s==="price_desc") list.sort((a,b)=>Number(b.precio||0)-Number(a.precio||0));
  else if(s==="name_asc") list.sort((a,b)=>safe(a.nombre).localeCompare(safe(b.nombre),"es"));
  else list.sort((a,b)=>{ if(a.agotado!==b.agotado) return a.agotado?1:-1; return safe(a.nombre).localeCompare(safe(b.nombre),"es"); });
  return list;
}

function renderFeatured(){
  const list=[...state.products];
  list.sort((a,b)=>{
    const ap=(Array.isArray(a.ofertas)&&a.ofertas.length>0)?0:1;
    const bp=(Array.isArray(b.ofertas)&&b.ofertas.length>0)?0:1;
    if(ap!==bp) return ap-bp;
    return Number(b.stock||0)-Number(a.stock||0);
  });
  const picks=list.slice(0,8);
  const w=el("featured"); w.innerHTML="";
  picks.forEach(p=>w.appendChild(card(p,true)));
}

function renderAll(reset){
  if(reset) state.page=1;
  const list=filtered();
  el("pillCount").textContent=`${list.length} productos`;
  el("empty").hidden=(list.length!==0);

  const title=el("listTitle");
  if(state.view==="offers") title.textContent="Productos en oferta";
  else if(state.selectedCat!=="all") title.textContent=state.selectedCat;
  else title.textContent="Productos";

  const grid=el("grid"); grid.innerHTML="";
  const end=state.page*state.pageSize;
  const shown=list.slice(0,end);
  shown.forEach(p=>grid.appendChild(card(p)));
  el("btnMore").style.display=(shown.length<list.length)?"inline-flex":"none";
}

function scrollToList(){
  const y=el("listSection").getBoundingClientRect().top + window.scrollY - 90;
  window.scrollTo({top:Math.max(0,y),behavior:"smooth"});
}

// ---- Product modal ----
function openProduct(p){
  state.activeProduct=p; state.selectedOfferQty=null;
  setProductParam(safe(p.id));

  el("modalTitle").textContent=p.nombre||"Producto";
  el("modalPrice").textContent=money(p.precio);
  el("modalDesc").textContent=p.descripcion||"Sin descripción por ahora.";

  const cat=p.categoria||"—", sub=p.subcategoria||"—";
  // Breadcrumbs
  const bc=el("modalBreadcrumbs");
  bc.innerHTML = `
    <a href="#" id="bcHome">Inicio</a><span class="sep">›</span>
    <a href="#" id="bcCat">${escapeHtml(cat)}</a><span class="sep">›</span>
    <a href="#" id="bcSub">${escapeHtml(sub)}</a><span class="sep">›</span>
    <span class="cur">${escapeHtml(p.nombre||"Producto")}</span>
  `;
  bc.querySelector("#bcHome").onclick=(e)=>{e.preventDefault(); state.selectedCat="all"; state.selectedSub="all"; state.selectedBrand="all"; state.search=""; state.page=1; syncFilters(); syncUrl(); renderAll(true); closeProduct(); scrollToList(); };
  bc.querySelector("#bcCat").onclick=(e)=>{e.preventDefault(); state.selectedCat=cat; state.selectedSub="all"; state.selectedBrand="all"; state.page=1; syncFilters(); syncUrl(); renderAll(true); closeProduct(); scrollToList(); };
  bc.querySelector("#bcSub").onclick=(e)=>{e.preventDefault(); state.selectedCat=cat; state.selectedSub=sub; state.selectedBrand="all"; state.page=1; syncFilters(); syncUrl(); renderAll(true); closeProduct(); scrollToList(); };
  const catLink=el("modalCatLink"), subLink=el("modalSubLink");
  catLink.textContent=cat; subLink.textContent=sub;
  catLink.onclick=(e)=>{e.preventDefault(); state.selectedCat=cat; state.selectedSub="all"; state.selectedBrand="all"; state.page=1; syncFilters(); syncUrl(); renderAll(true); closeProduct(); scrollToList(); };
  subLink.onclick=(e)=>{e.preventDefault(); state.selectedCat=cat; state.selectedSub=sub; state.selectedBrand="all"; state.page=1; syncFilters(); syncUrl(); renderAll(true); closeProduct(); scrollToList(); };

  const bd=el("modalBadge");
  if(p.agotado){ bd.className="badge badge--bad"; bd.textContent="Agotado"; el("btnOrder").disabled=true; el("btnAsk").disabled=false; }
  else { bd.className="badge badge--good"; bd.textContent=`Stock: ${Number(p.stock||0)}`; el("btnOrder").disabled=false; el("btnAsk").disabled=true; }

  const video=safe(p.video||p.video_url).trim();
  if(video){ el("videoLine").hidden=false; el("modalVideo").href=video; } else { el("videoLine").hidden=true; el("modalVideo").removeAttribute("href"); }

  el("qty").value=1;

  const imgs=[p.imagen||p.img, ...(p.galeria||[])].filter(Boolean);
  const hero=el("heroImg"), thumbs=el("thumbs");
  thumbs.innerHTML="";
  hero.src=(imgs[0]||placeholder(p.nombre)); hero.alt=p.nombre||"Producto";
  imgs.forEach((u,i)=>{
    const t=document.createElement("div"); t.className="thumb"+(i===0?" thumb--active":"");
    const im=document.createElement("img"); im.src=u; im.alt="Miniatura"; t.appendChild(im);
    t.onclick=()=>{ hero.src=u; [...thumbs.children].forEach(x=>x.classList.remove("thumb--active")); t.classList.add("thumb--active"); };
    thumbs.appendChild(t);
  });

  // Related products
  const rel=state.products
    .filter(x=>x && x.id && x.id!==p.id)
    .filter(x=>{
      const sameSub = safe(x.subcategoria).trim() && safe(x.subcategoria).trim()===safe(p.subcategoria).trim() && safe(x.categoria).trim()===safe(p.categoria).trim();
      const sameCat = safe(x.categoria).trim()===safe(p.categoria).trim();
      return sameSub || sameCat;
    })
    .slice(0,6);
  const rbox=el("relatedBox");
  const rgrid=el("relatedGrid");
  rgrid.innerHTML="";
  if(rel.length){
    rbox.hidden=false;
    rel.forEach(x=>{
      const div=document.createElement("div");
      div.className="relcard";
      const img=(x.imagen||x.img||placeholder(x.nombre));
      div.innerHTML = `
        <div class="relcard__img"><img src="${escapeHtml(img)}" alt="" /></div>
        <div class="relcard__body">
          <div class="relcard__name">${escapeHtml(x.nombre||"Producto")}</div>
          <div class="relcard__meta">${escapeHtml(x.marca||"")} • ${money(x.precio)}</div>
        </div>
      `;
      div.onclick=()=>openProduct(x);
      rgrid.appendChild(div);
    });
    el("btnSeeMoreRelated").onclick=(e)=>{e.preventDefault(); state.selectedCat=cat; state.selectedSub=(safe(p.subcategoria).trim()?sub:"all"); state.selectedBrand="all"; state.page=1; syncFilters(); syncUrl(); closeProduct(); scrollToList(); renderAll(true); };
  } else {
    rbox.hidden=true;
  }

  // offers
  const offers=Array.isArray(p.ofertas)?p.ofertas:[];
  el("offersTable").innerHTML="";
  if(offers.length){
    el("offersBox").hidden=false;
    offers.forEach(o=>{
      const row=document.createElement("div"); row.className="offer";
      const total=o.qty*o.precio_unit;
      row.innerHTML=`<div><b>Llevá ${o.qty}</b><div class="muted" style="font-size:12px">${money(o.precio_unit)} c/u • Total ${money(total)}</div></div><div class="badge">Promo</div>`;
      row.onclick=()=>{ state.selectedOfferQty=o.qty; el("qty").value=o.qty; [...el("offersTable").children].forEach(x=>x.classList.remove("offer--active")); row.classList.add("offer--active"); };
      el("offersTable").appendChild(row);
    });
  } else el("offersBox").hidden=true;

  el("productBackdrop").hidden=false;
  document.body.style.overflow="hidden";
}
function closeProduct(){
  el("productBackdrop").hidden=true;
  document.body.style.overflow="";
  setProductParam(null);
}
function clampQty(){
  let v=Number(el("qty").value||1);
  if(!Number.isFinite(v)||v<1) v=1;
  v=Math.floor(v); el("qty").value=v; return v;
}
function clearOfferSelection(){ [...el("offersTable").children].forEach(x=>x.classList.remove("offer--active")); state.selectedOfferQty=null; }

function waMsg(p,qty){
  const hasOffers=Array.isArray(p.ofertas)&&p.ofertas.length>0;
  let unit=Number(p.precio||0); let promoLine="";
  if(hasOffers && state.selectedOfferQty && qty===state.selectedOfferQty){
    const found=p.ofertas.find(x=>Number(x.qty)===Number(qty));
    if(found){ unit=Number(found.precio_unit); promoLine=` (promo x${qty})`; }
  }
  const total=qty*unit;
  return [
    "Hola 👋",
    `Quiero: ${qty} x ${p.nombre}${promoLine}`,
    `Precio: ${money(unit)} c/u • Total: ${money(total)}`,
    "",
    "Mi ubicación (Depto/Muni/Zona):",
    "Forma de envío:",
    "",
    `Link del producto: ${currentLink()}`
  ].join("\\n");
}
function openWA(msg){
  const url=`https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
  window.open(url,"_blank","noopener");
}
function logOrder(p,qty,tipo="pedido"){
  if(!CONFIG.apiUrl) return;
  try{
    const params=new URLSearchParams({action:"logOrder",tipo,id_producto:p.id||"",nombre:p.nombre||"",qty:String(qty||0),precio_unit:String(p.precio||0),origen:"web"});
    const img=new Image(); img.src=CONFIG.apiUrl+"?"+params.toString();
  }catch(_){}
}

// ---- Shipping ----
function openShipping(){ el("shipBackdrop").hidden=false; document.body.style.overflow="hidden"; buildShippingSelectors(); renderShipping(); }
function closeShipping(){ el("shipBackdrop").hidden=true; document.body.style.overflow=""; }
function normEnvios(){
  return state.envios.map(r=>({
    tipo:safe(r.tipo).trim().toLowerCase(),
    departamento:safe(r.departamento).trim(),
    municipio:safe(r.municipio).trim(),
    zona:safe(r.zona).trim(),
    empresa:safe(r.empresa).trim(),
    prepago:Number(r.prepago||0),
    pago_al_recibir:Number(r.pago_al_recibir||0),
    notas:safe(r.notas).trim(),
  })).filter(r=>r.departamento && r.municipio);
}
function buildShippingSelectors(){
  const rows=normEnvios();
  const depts=uniq(rows.map(r=>r.departamento)).sort((a,b)=>a.localeCompare(b,"es"));
  const selDept=el("selDept"), selMuni=el("selMuni"), selZone=el("selZone");
  selDept.innerHTML=depts.map(d=>`<option>${escapeHtml(d)}</option>`).join("");
  if(!selDept.value && depts.length) selDept.value=depts[0];
  const updateMuni=()=>{
    const d=selDept.value;
    const munis=uniq(rows.filter(r=>r.departamento===d).map(r=>r.municipio)).sort((a,b)=>a.localeCompare(b,"es"));
    selMuni.innerHTML=munis.map(m=>`<option>${escapeHtml(m)}</option>`).join("");
    if(!munis.includes(selMuni.value)) selMuni.value=munis[0]||"";
    updateZone();
  };
  const updateZone=()=>{
    const d=selDept.value, m=selMuni.value;
    const zones=uniq(rows.filter(r=>r.departamento===d && r.municipio===m).map(r=>r.zona).filter(Boolean)).sort((a,b)=>a.localeCompare(b,"es"));
    const opts=["(Sin zona)", ...zones];
    selZone.innerHTML=opts.map(z=>`<option>${escapeHtml(z)}</option>`).join("");
    if(!opts.includes(selZone.value)) selZone.value="(Sin zona)";
  };
  selDept.onchange=()=>{updateMuni();renderShipping();};
  selMuni.onchange=()=>{updateZone();renderShipping();};
  selZone.onchange=()=>{renderShipping();};
  updateMuni();
}
function renderShipping(){
  const rows=normEnvios();
  const d=el("selDept").value, m=el("selMuni").value, z=el("selZone").value;
  const zone=(z==="(Sin zona)")?"":z;
  const matches=rows.filter(r=>r.departamento===d && r.municipio===m)
    .filter(r=>{
      if(r.zona && zone) return r.zona===zone || r.zona.toUpperCase()==="GENERAL";
      if(r.zona && !zone) return r.zona.toUpperCase()==="GENERAL";
      return true;
    });
  const results=el("shipResults"); results.innerHTML="";
  if(!matches.length){
    results.innerHTML=`<div class="shipcard"><div class="shipcard__title">Sin tarifas</div><div class="muted">Editalo en la hoja <b>envios</b>.</div></div>`;
    return;
  }
  const groups={};
  matches.forEach(r=>{ const k=`${r.tipo}|${r.empresa||"—"}|${r.zona||""}`; if(!groups[k]) groups[k]=r; });
  Object.keys(groups).sort().forEach(k=>{
    const g=groups[k];
    const title=(g.tipo==="domicilio"?"Domicilio":"Paquetería")+(g.empresa?` • ${g.empresa}`:"")+(g.zona?` • ${g.zona}`:"");
    const card=document.createElement("div"); card.className="shipcard";
    card.innerHTML=`<div class="shipcard__title">${escapeHtml(title)}</div>
      <div class="shipcard__grid">
        <div><b>Prepago:</b> ${g.prepago>0?money(g.prepago):"—"}</div>
        <div><b>Pago al recibir:</b> ${g.pago_al_recibir>0?money(g.pago_al_recibir):"—"}</div>
        <div><b>Notas:</b> ${escapeHtml(g.notas||"")}</div>
      </div>`;
    results.appendChild(card);
  });
}

// ---- View ----
function setView(view){
  state.view=view; state.page=1;
  el("tabCatalog").classList.toggle("pill--active", view==="catalog");
  el("tabOffers").classList.toggle("pill--active", view==="offers");
  el("brandSub").textContent = view==="offers" ? "Ofertas" : "Catálogo";
  syncUrl(); buildCategoryUI(); buildDrawerUI(); renderFeatured(); renderAll(true);
}

function applyUrlState(){
  const cat=getParam("cat"), sub=getParam("sub"), q=getParam("q"), view=getParam("view"), brand=getParam("brand");
  if(view==="offers") state.view="offers";
  if(cat) state.selectedCat=cat;
  if(sub) state.selectedSub=sub;
  if(q) state.search=q;
  if(brand) state.selectedBrand=brand;
  el("search").value=state.search||"";
  el("tabCatalog").classList.toggle("pill--active", state.view==="catalog");
  el("tabOffers").classList.toggle("pill--active", state.view==="offers");
  el("brandSub").textContent = state.view==="offers" ? "Ofertas" : "Catálogo";
}

function openProductFromUrl(){
  const pid=getParam("p");
  if(!pid) return;
  const p=state.products.find(x=>safe(x.id)===pid);
  if(p) openProduct(p);
}

async function loadData(){
  if(!CONFIG.apiUrl){ el("status").textContent="Falta configurar la API."; showSetup(); return; }
  try{
    el("status").textContent="Cargando productos…";
    const p=await jsonp(CONFIG.apiUrl+"?only=productos");
    state.products=Array.isArray(p.productos)?p.productos:[];
    const s=await jsonp(CONFIG.apiUrl+"?only=envios");
    state.envios=Array.isArray(s.envios)?s.envios:[];
    const t=await jsonp(CONFIG.apiUrl+"?only=taxonomia");
    state.taxonomy=Array.isArray(t.taxonomia)?t.taxonomia:[];
    el("status").textContent="Listo.";
    initStats();
    applyUrlState();
    buildCategoryUI();
    buildDrawerUI();
    renderFeatured();
    renderAll(true);
    openProductFromUrl();
  }catch(err){
    console.error(err);
    el("status").textContent="No pude cargar datos. Revisá tu /exec.";
  }
}

// Events
function initEvents(){
  el("tabCatalog").onclick=()=>setView("catalog");
  el("tabOffers").onclick=()=>setView("offers");
  el("btnTheme").onclick=toggleTheme;
  el("btnShipping").onclick=openShipping;
  el("btnSetup").onclick=showSetup;
  el("goHome").onclick=(e)=>{e.preventDefault(); window.scrollTo({top:0,behavior:"smooth"});};
  el("btnExplore").onclick=scrollToList;
  el("btnViewOffers").onclick=()=>{setView("offers"); scrollToList();};
  el("btnClear").onclick=()=>{ state.selectedCat="all";state.selectedSub="all";state.selectedBrand="all";state.stockFilter="all";state.sort="relev";state.search="";state.page=1; el("search").value=""; el("drawerSearch").value=""; syncFilters(); syncUrl(); renderAll(true); };

  el("btnMore").onclick=()=>{ state.page+=1; renderAll(false); };
  el("search").addEventListener("input", debounce((e)=>{ state.search=e.target.value||""; state.page=1; syncUrl(); renderAll(true); },150));

  el("selCat").onchange=()=>{ state.selectedCat=el("selCat").value; state.selectedSub="all"; state.selectedBrand="all"; state.page=1; syncSubSelector(); syncUrl(); renderAll(true); };
  el("selSub").onchange=()=>{ state.selectedSub=el("selSub").value; state.selectedBrand="all"; state.page=1; syncUrl(); renderAll(true); };
  el("selSort").onchange=()=>{ state.sort=el("selSort").value; state.page=1; renderAll(true); };

  el("stockChips").onclick=(e)=>{ const btn=e.target.closest(".chip"); if(!btn) return; state.stockFilter=btn.dataset.filter; state.page=1; syncFilters(); renderAll(true); };

  // modal
  el("btnCloseProduct").onclick=closeProduct;
  el("productBackdrop").onclick=(e)=>{ if(e.target===el("productBackdrop")) closeProduct(); };
  el("qtyMinus").onclick=()=>{ const v=clampQty(); el("qty").value=Math.max(1,v-1); clearOfferSelection(); };
  el("qtyPlus").onclick=()=>{ const v=clampQty(); el("qty").value=v+1; clearOfferSelection(); };
  el("qty").oninput=()=>{ clampQty(); clearOfferSelection(); };

  el("btnOrder").onclick=()=>{ const p=state.activeProduct; if(!p) return; const qty=clampQty(); openWA(waMsg(p,qty)); logOrder(p,qty); };
  el("btnAsk").onclick=()=>{ const p=state.activeProduct; if(!p) return; openWA(`Hola 👋 ¿Tenés disponible: ${p.nombre}?\\n\\nLink: ${currentLink()}`); logOrder(p,0,"consulta"); };
  el("btnKeepBrowsing").onclick=()=>{ closeProduct(); openDrawer(); };
  el("btnOpenMenuFromProduct").onclick=openDrawer;
  el("btnCopyLink").onclick=()=>copy(currentLink());

  // shipping
  el("btnCloseShip").onclick=closeShipping;
  el("shipBackdrop").onclick=(e)=>{ if(e.target===el("shipBackdrop")) closeShipping(); };

  // drawer
  el("btnMenu").onclick=openDrawer;
  el("btnCloseDrawer").onclick=closeDrawer;
  el("drawerBackdrop").onclick=(e)=>{ if(e.target===el("drawerBackdrop")) closeDrawer(); };

  el("drawerGoCatalog").onclick=()=>{ setView("catalog"); closeDrawer(); scrollToList(); };
  el("drawerGoOffers").onclick=()=>{ setView("offers"); closeDrawer(); scrollToList(); };
  el("drawerClear").onclick=()=>{ state.selectedCat="all";state.selectedSub="all";state.selectedBrand="all";state.stockFilter="all";state.sort="relev";state.search="";state.page=1; el("search").value=""; el("drawerSearch").value=""; syncFilters(); syncUrl(); renderAll(true); closeDrawer(); };
  el("drawerCopyFilters").onclick=()=>copy(currentLink());
  el("drawerSearch").addEventListener("input", debounce((e)=>{ state.search=e.target.value||""; el("search").value=state.search; state.page=1; syncUrl(); renderAll(true); },120));

  window.addEventListener("keydown",(e)=>{ if(e.key==="Escape"){ closeProduct(); closeShipping(); closeDrawer(); } });
}

(async function main(){
  setTheme(localStorage.getItem("tienda_theme")||"light");
  initEvents();
  await loadConfig();
  await loadData();
})();
