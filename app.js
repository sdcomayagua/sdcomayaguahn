/* SDComayagua - Frontend (Catálogo + Carrito + WhatsApp) */
(() => {
  const CFG = window.SDCO_CONFIG || {};
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

  // ---------- Helpers ----------
  const fmtMoney = (n) => {
    const val = Number(n || 0);
    try {
      return new Intl.NumberFormat(CFG.LOCALE || "es-HN", {
        style: "currency",
        currency: CFG.CURRENCY || "Lps.",
        maximumFractionDigits: 0
      }).format(val);
    } catch {
      return `L ${Math.round(val)}`;
    }
  };

  const toNum = (v) => {
    if (v === null || v === undefined) return 0;
    const s = String(v).replace(/[^0-9.,-]/g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const normalize = (s) => String(s || "").trim();
  const slug = (s) => normalize(s).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");

  const waLink = (text) => {
    const msg = encodeURIComponent(text);
    return `https://wa.me/${CFG.WHATSAPP_NUMBER}?text=${msg}`;
  };

  const safeArr = (v) => Array.isArray(v) ? v : [];

  const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));

  // ---------- Theme ----------
  const applyTheme = (t) => {
    document.documentElement.dataset.theme = t;
    localStorage.setItem(THEME_KEY, t);
  };
  const initTheme = () => {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  };

  // ---------- State ----------
  let allProducts = [];
  let viewProducts = [];
  let current = null;

  let state = {
    q: "",
    cat: "Todos",
    subcat: "",
    onlyInStock: false,
    sort: "relevance"
  };

  // ---------- Cart ----------
  const CART_KEY = "sdco_cart_v1";
  const cart = {
    items: [],
    load(){
      try{ this.items = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
      catch{ this.items = []; }
    },
    save(){ localStorage.setItem(CART_KEY, JSON.stringify(this.items)); },
    count(){ return this.items.reduce((a,it)=>a+Number(it.qty||0),0); },
    subtotal(){
      return this.items.reduce((a,it)=>a + (toNum(it.price) * Number(it.qty||0)), 0);
    },
    setQty(id, qty){
      qty = Math.max(0, Math.min(999, Number(qty)||0));
      const i = this.items.findIndex(x => x.id === id);
      if (i === -1) return;
      if (qty <= 0) this.items.splice(i,1);
      else this.items[i].qty = qty;
      this.save();
    },
    add(p, qty){
      qty = Math.max(1, Math.min(999, Number(qty)||1));
      const existing = this.items.find(x => x.id === p.id);
      if (existing) existing.qty += qty;
      else this.items.push({
        id: p.id,
        name: p.nombre,
        price: toNum(p.precio),
        img: p.img,
        meta: [p.categoria, p.subcategoria, p.marca].filter(Boolean).join(" • "),
        qty
      });
      this.save();
    },
    clear(){ this.items=[]; this.save(); }
  };

  // ---------- API ----------
  const fetchJSON = async (url, opts={}) => {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  };

  const getProductsUrl = () => {
    if (!CFG.API_BASE) return null;
    return CFG.USE_ONLY_MODE
      ? `${CFG.API_BASE}?only=productos`
      : `${CFG.API_BASE}?resource=productos`;
  };

  const mapProduct = (raw) => {
    // Normaliza a esquema esperado
    const p = Object.assign({}, raw);
    p.id = normalize(p.id || p.ID || p.Id);
    p.nombre = normalize(p.nombre || p.name || p.titulo);
    p.categoria = normalize(p.categoria || p.category);
    p.subcategoria = normalize(p.subcategoria || p.subcategory);
    p.marca = normalize(p.marca || p.brand);
    p.precio = toNum(p.precio || p.price);
    p.stock = Number(p.stock ?? p.Stock ?? 0);
    p.activo = String(p.activo ?? "1") !== "0";
    p.descripcion = normalize(p.descripcion || p.desc);
    p.img = normalize(p.img || p.imagen || p.image);
    p.galeria = uniq([
      p.img,
      p.galeria_1, p.galeria_2, p.galeria_3, p.galeria_4,
      p.galeria_5, p.galeria_6, p.galeria_7, p.galeria_8
    ].map(normalize)).filter(Boolean);
    p.video_url = normalize(p.video_url || "");
    p._search = slug([p.nombre,p.categoria,p.subcategoria,p.marca,p.descripcion].join(" "));
    return p;
  };

  const setStatus = (msg, kind="") => {
    const dot2 = $("#statusDot2");
    const txt2 = $("#statusText2");
    if (txt2) txt2.textContent = msg;
    if (dot2){ dot2.classList.remove("ok","bad"); if(kind) dot2.classList.add(kind); }
    const dot = $("#statusDot");
    const txt = $("#statusText");
    if (txt) txt.textContent = msg;
    if (dot){ dot.classList.remove("ok","bad"); if(kind) dot.classList.add(kind); }
  };

  const loadProducts = async () => {
    try{
      setStatus("Cargando catálogo…");
      const url = getProductsUrl();
      if (!url) throw new Error("Falta API_BASE en config.js");

      // 1) Mostrar cache inmediato (si existe)
      try{
        const cached = localStorage.getItem("sdco_products_cache");
        if (cached){
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length){
            allProducts = parsed.map(mapProduct).filter(p => p.activo && p.id && p.nombre);
            setStatus(`Catálogo listo (cache): ${allProducts.length} productos`, "ok");
          }
        }
      }catch(e){}

      // 2) Fetch con timeout (para que no se quede colgado 10s)
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 6500);

      const data = await fetchJSON(url, { signal: controller.signal });
      clearTimeout(t);

      const rows = data.productos || data.data || data.items || [];
      allProducts = safeArr(rows).map(mapProduct).filter(p => p.activo && p.id && p.nombre);

      // orden estable
      allProducts.sort((a,b)=>a.nombre.localeCompare(b.nombre, "es"));

      // guardar cache
      try{ localStorage.setItem("sdco_products_cache", JSON.stringify(allProducts)); }catch(e){}

      setStatus(`Listo: ${allProducts.length} productos`, "ok");
      $("#updatedAt").textContent = `Actualizado: ${new Date().toLocaleString(CFG.LOCALE || "es-HN")}`;
    } catch (e){
      console.error(e);
      // si ya había cache, dejarlo; si no, vacío
      if (!allProducts || !allProducts.length){
        allProducts = [];
      }
      setStatus("No se pudo cargar el catálogo. Revisá tu Apps Script.", "bad");
    }
  };

  // ---------- UI Build ----------
  const grid = $("#grid");
  const resultsCount = $("#resultsCount");
  const emptyState = $("#emptyState");

  const catChips = $("#catChips");
  const subcatChips = $("#subcatChips");

  const buildChips = () => {
    const cats = uniq(allProducts.map(p => p.categoria).filter(Boolean));
    const render = (wrap, items, active, onClick) => {
      if (!wrap) return;
      wrap.innerHTML = "";
      items.forEach((name) => {
        const b = document.createElement("button");
        b.className = "chip" + (name === active ? " active" : "");
        b.textContent = name;
        b.addEventListener("click", () => onClick(name));
        wrap.appendChild(b);
      });
    };

    render(catChips, ["Todos", ...cats], state.cat, (name) => {
      state.cat = name;
      state.subcat = "";
      syncSubcats();
      applyFilters();
    });

    syncSubcats();
  };

  const syncSubcats = () => {
    if (!subcatChips) return;
    const list = allProducts
      .filter(p => state.cat === "Todos" ? true : p.categoria === state.cat)
      .map(p => p.subcategoria).filter(Boolean);
    const subs = uniq(list);
    const items = subs.length ? ["Todas", ...subs] : [];
    subcatChips.innerHTML = "";
    items.forEach((name) => {
      const b = document.createElement("button");
      const isActive = (state.subcat || "Todas") === name;
      b.className = "chip" + (isActive ? " active" : "");
      b.textContent = name;
      b.addEventListener("click", () => {
        state.subcat = (name === "Todas") ? "" : name;
        applyFilters();
      });
      subcatChips.appendChild(b);
    });
    // Hide if no subcats
    subcatChips.style.display = items.length ? "flex" : "none";
  };

  const makeCard = (p) => {
    const c = document.createElement("article");
    c.className = "card";
    c.tabIndex = 0;
    c.setAttribute("role","button");
    c.setAttribute("aria-label", `Ver ${p.nombre}`);
    c.addEventListener("click", () => openProduct(p.id));
    c.addEventListener("keydown", (e)=>{ if(e.key==="Enter"||e.key===" "){e.preventDefault(); openProduct(p.id);} });

    const inStock = Number(p.stock||0) > 0;

    c.innerHTML = `
      <div class="card__img">
        ${p.img ? `<img loading="lazy" src="${p.img}" alt="${escapeHtml(p.nombre)}">` : `<div style="font-size:32px;opacity:.5">🛍️</div>`}
        <div class="card__badge">${escapeHtml(p.categoria || "Producto")}</div>
      </div>
      <div class="card__body">
        <h3 class="card__title">${escapeHtml(p.nombre)}</h3>
        <div class="card__meta">
          ${p.marca ? `<span>${escapeHtml(p.marca)}</span>` : ""}
          ${p.subcategoria ? `<span>• ${escapeHtml(p.subcategoria)}</span>` : ""}
        </div>
        <div class="card__priceRow">
          <div class="card__price">${fmtMoney(p.precio)}</div>
          <div class="pill ${inStock ? "ok" : "bad"}">${inStock ? "Disponible" : "Agotado"}</div>
        </div>
      </div>
    `;
    return c;
  };

  const renderGrid = () => {
    if (!grid) return;
    grid.innerHTML = "";
    viewProducts.forEach(p => grid.appendChild(makeCard(p)));

    if (resultsCount) resultsCount.textContent = String(viewProducts.length);

    const isEmpty = viewProducts.length === 0;
    if (emptyState) emptyState.hidden = !isEmpty;
  };

  // ---------- Filters ----------
  const relevanceScore = (p, qSlug) => {
    if (!qSlug) return 0;
    // simple: count occurrences of tokens
    const tokens = qSlug.split("-").filter(Boolean);
    let s = 0;
    for (const t of tokens) if (p._search.includes(t)) s += 1;
    // boost name
    if (slug(p.nombre).includes(tokens[0] || "")) s += 1.5;
    return s;
  };

  const applyFilters = () => {
    const q = slug(state.q);
    let list = allProducts.slice();

    if (state.cat !== "Todos") list = list.filter(p => p.categoria === state.cat);
    if (state.subcat) list = list.filter(p => p.subcategoria === state.subcat);
    if (state.onlyInStock) list = list.filter(p => Number(p.stock||0) > 0);

    if (q) list = list.filter(p => p._search.includes(q));

    // sort
    if (state.sort === "price_asc") list.sort((a,b)=>toNum(a.precio)-toNum(b.precio));
    else if (state.sort === "price_desc") list.sort((a,b)=>toNum(b.precio)-toNum(a.precio));
    else if (state.sort === "name_asc") list.sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));
    else { // relevance
      if (q) list.sort((a,b)=>relevanceScore(b,q)-relevanceScore(a,q));
      else list.sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));
    }

    viewProducts = list;
    renderGrid();
  };

  // ---------- Product Modal ----------
  const productModal = $("#productModal");
  const pmImage = $("#pmImage");
  if (pmImage) pmImage.onerror = () => { pmImage.src = "./assets/placeholder.png"; };
  const pmThumbs = $("#pmThumbs");
  const pmTitle = $("#pmTitle");
  const pmMeta = $("#pmMeta");
  const pmPrice = $("#pmPrice");
  const pmStock = $("#pmStock");
  const pmDesc = $("#pmDesc");
  const pmBadge = $("#pmBadge");
  const qtyInput = $("#qtyInput");
  const qtyMinus = $("#qtyMinus");
  const qtyPlus = $("#qtyPlus");
  const addToCartBtn = $("#addToCartBtn");
  const buyNowBtn = $("#buyNowBtn");

  const escapeHtml = (s) => String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

  const setModalImage = (url) => {
    if (!pmImage) return;
    pmImage.src = url || "";
  };

  const openModal = () => {
    productModal?.classList.add("show");
    productModal?.setAttribute("aria-hidden","false");
    document.documentElement.classList.add("prevent-scroll");
  };

  const closeModal = () => {
    productModal?.classList.remove("show");
    productModal?.setAttribute("aria-hidden","true");
    document.documentElement.classList.remove("prevent-scroll");
    current = null;
  };

  const openProduct = (id) => {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;
    current = p;

    // Fill content
    pmTitle.textContent = p.nombre;
    pmBadge.textContent = p.categoria || "Producto";
    pmMeta.textContent = [p.marca, p.subcategoria].filter(Boolean).join(" • ") || "—";
    pmPrice.textContent = fmtMoney(p.precio);
    const inStock = Number(p.stock||0) > 0;
    pmStock.textContent = inStock ? `Stock: ${p.stock}` : "Agotado";
    pmStock.style.color = inStock ? "inherit" : "#ef4444";
    pmDesc.textContent = p.descripcion || "Sin descripción.";

    // thumbs
    const imgs = safeArr(p.galeria).filter(Boolean);
    const main = imgs[0] || p.img || "";
    setModalImage(main);
    pmThumbs.innerHTML = "";
    imgs.slice(0, 9).forEach((u, idx) => {
      const t = document.createElement("button");
      t.className = "thumb" + (idx === 0 ? " active" : "");
      t.innerHTML = `<img src="${u}" alt="">`;
      t.addEventListener("click", () => {
        $$(".thumb", pmThumbs).forEach(x => x.classList.remove("active"));
        t.classList.add("active");
        setModalImage(u);
      });
      pmThumbs.appendChild(t);
    });

    // qty
    if (qtyInput) qtyInput.value = "1";
    addToCartBtn.disabled = !inStock;
    buyNowBtn.disabled = !inStock;

    openModal();
  };

  // ---------- Cart Drawer ----------
  const cartDrawer = $("#cartDrawer");
  const cartItems = $("#cartItems");
  const cartCount = $("#cartCount");
  const cartSubtotal = $("#cartSubtotal");
  const cartTotal = $("#cartTotal");
  const cartShipping = $("#cartShipping");
  const checkoutBtn = $("#checkoutBtn");
  const continueBtn = $("#continueBtn");

  const openDrawer = () => {
    cartDrawer?.classList.add("show");
    cartDrawer?.setAttribute("aria-hidden","false");
    document.documentElement.classList.add("prevent-scroll");
  };

  const closeDrawer = () => {
    cartDrawer?.classList.remove("show");
    cartDrawer?.setAttribute("aria-hidden","true");
    document.documentElement.classList.remove("prevent-scroll");
  };

  const renderCart = () => {
    if (!cartItems) return;
    cartItems.innerHTML = "";

    if (cart.items.length === 0){
      cartItems.innerHTML = `
        <div class="empty" style="margin:10px 0">
          <div class="empty__icon">🛒</div>
          <div class="empty__title">Tu carrito está vacío</div>
          <div class="empty__text">Agregá productos para pedir por WhatsApp.</div>
        </div>
      `;
    } else {
      cart.items.forEach((it) => {
        const line = document.createElement("div");
        line.className = "line";
        line.innerHTML = `
          <div class="line__img">${it.img ? `<img src="${it.img}" alt="">` : ""}</div>
          <div>
            <div class="line__title">${escapeHtml(it.name)}</div>
            <div class="line__meta">${escapeHtml(it.meta || "")}</div>
            <div class="line__row">
              <div class="line__price">${fmtMoney(it.price)}</div>
              <div class="line__controls">
                <button class="small-btn" data-act="minus">−</button>
                <div class="line__qty">${it.qty}</div>
                <button class="small-btn" data-act="plus">+</button>
                <button class="link-danger" data-act="remove">Quitar</button>
              </div>
            </div>
          </div>
        `;
        line.querySelector('[data-act="minus"]').addEventListener("click", () => { cart.setQty(it.id, it.qty - 1); syncCartUI(); });
        line.querySelector('[data-act="plus"]').addEventListener("click", () => { cart.setQty(it.id, it.qty + 1); syncCartUI(); });
        line.querySelector('[data-act="remove"]').addEventListener("click", () => { cart.setQty(it.id, 0); syncCartUI(); });
        cartItems.appendChild(line);
      });
    }

    const sub = cart.subtotal();
    cartSubtotal.textContent = fmtMoney(sub);
    cartShipping.textContent = "Se confirma por WhatsApp";
    cartTotal.textContent = fmtMoney(sub);

    cartCount.textContent = String(cart.count());
  };

  const syncCartUI = () => {
    cart.save();
    renderCart();
  };

  const buildCheckoutMessage = () => {
    const lines = [];
    lines.push(`*Pedido - ${CFG.APP_NAME || "SDComayagua"}*`);
    lines.push("");
    cart.items.forEach((it, idx) => {
      const lineTotal = toNum(it.price) * Number(it.qty||0);
      lines.push(`${idx+1}. ${it.name}`);
      lines.push(`   Cantidad: ${it.qty}`);
      lines.push(`   Precio: ${fmtMoney(it.price)}`);
      lines.push(`   Subtotal: ${fmtMoney(lineTotal)}`);
      if (it.meta) lines.push(`   ${it.meta}`);
      lines.push("");
    });
    lines.push(`*Total:* ${fmtMoney(cart.subtotal())}`);
    lines.push("");
    lines.push("📍 *Dirección / referencia:*");
    lines.push("—");
    lines.push("");
    lines.push("🧾 *Forma de pago:*");
    lines.push("—");
    lines.push("");
    lines.push("Gracias 🙌");
    return lines.join("\n");
  };

  // ---------- Wire Events ----------
  const wire = () => {
    // brand + WhatsApp
    $("#brandName").textContent = CFG.APP_NAME || "SDComayagua";
    $("#waText").textContent = CFG.WHATSAPP_DISPLAY || "";
    const waBtn = $("#waHeaderBtn");
    const waFooter = $("#waFooterBtn");
    const waHello = waLink(`Hola, vengo de la tienda ${CFG.APP_NAME}. ¿Me compartís el catálogo?`);
    waBtn.href = waHello;
    waFooter.href = waHello;

    // search
    const searchInput = $("#searchInput");
    const clearSearch = $("#clearSearch");
    searchInput?.addEventListener("input", () => {
      state.q = searchInput.value;
      clearSearch.classList.toggle("show", !!state.q);
      applyFilters();
    });
    clearSearch?.addEventListener("click", () => {
      state.q = "";
      if (searchInput) searchInput.value = "";
      clearSearch.classList.remove("show");
      applyFilters();
      searchInput?.focus();
    });

    // sort + in stock
    $("#sortSelect")?.addEventListener("change", (e) => { state.sort = e.target.value; applyFilters(); });
    $("#onlyInStock")?.addEventListener("change", (e) => { state.onlyInStock = e.target.checked; applyFilters(); });

    // reset
    $("#resetFilters")?.addEventListener("click", () => {
      state = { q:"", cat:"Todos", subcat:"", onlyInStock:false, sort:"relevance" };
      if (searchInput) searchInput.value = "";
      clearSearch?.classList.remove("show");
      $("#onlyInStock").checked = false;
      $("#sortSelect").value = "relevance";
      buildChips();
      applyFilters();
    });

    // modal close
    productModal?.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.dataset && t.dataset.close) closeModal();
    });
    window.addEventListener("keydown", (e)=>{ if(e.key==="Escape"){ closeModal(); closeDrawer(); } });

    // qty
    qtyMinus?.addEventListener("click", () => {
      const v = Math.max(1, (Number(qtyInput.value)||1) - 1);
      qtyInput.value = String(v);
    });
    qtyPlus?.addEventListener("click", () => {
      const v = Math.min(999, (Number(qtyInput.value)||1) + 1);
      qtyInput.value = String(v);
    });
    qtyInput?.addEventListener("input", () => {
      const v = Math.max(1, Math.min(999, Number(qtyInput.value)||1));
      qtyInput.value = String(v);
    });

    addToCartBtn?.addEventListener("click", () => {
      if (!current) return;
      const qty = Number(qtyInput.value)||1;
      cart.add(current, qty);
      syncCartUI();
      closeModal();
      openDrawer();
    });

    buyNowBtn?.addEventListener("click", () => {
      if (!current) return;
      const qty = Number(qtyInput.value)||1;
      const msg = [
        `*Pedido - ${CFG.APP_NAME || "SDComayagua"}*`,
        "",
        `Producto: ${current.nombre}`,
        `Cantidad: ${qty}`,
        `Precio: ${fmtMoney(current.precio)}`,
        `Subtotal: ${fmtMoney(toNum(current.precio) * qty)}`,
        "",
        "📍 Dirección / referencia:",
        "—",
        "",
        "🧾 Forma de pago:",
        "—"
      ].join("\n");
      window.open(waLink(msg), "_blank", "noopener");
    });

    // cart
    $("#cartBtn")?.addEventListener("click", () => { renderCart(); openDrawer(); });
    cartDrawer?.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.dataset && t.dataset.close) closeDrawer();
    });

    continueBtn?.addEventListener("click", () => closeDrawer());
    checkoutBtn?.addEventListener("click", () => {
      if (cart.items.length === 0) return;
      window.open(waLink(buildCheckoutMessage()), "_blank", "noopener");
    });
  };

  // ---------- Init ----------
  const init = async () => {
    initTheme();
    cart.load();
    wire();
    renderCart();

    await loadProducts();
    buildChips();
    applyFilters();
  };

  init();
})();