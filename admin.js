/* SDComayagua - Admin (Google Sheets via Apps Script) */
(() => {
  const CFG = window.SDCO_CONFIG || {};
  const $ = (s, el=document) => el.querySelector(s);

  const KEY_STORAGE = "sdco_admin_key";
  const getKey = () => localStorage.getItem(KEY_STORAGE) || "";
  const setKey = (k) => localStorage.setItem(KEY_STORAGE, k || "");
  const clearKey = () => localStorage.removeItem(KEY_STORAGE);

  const fetchJSON = async (url, opts={}) => {
    const res = await fetch(url, opts);
    const text = await res.text();
    try{
      const data = JSON.parse(text);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      return data;
    } catch {
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0,120)}`);
      throw new Error(`Respuesta inválida: ${text.slice(0,120)}`);
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

  const genId = () => {
    const stamp = Date.now().toString(36);
    const rnd = Math.random().toString(36).slice(2,6);
    return `p_${stamp}_${rnd}`;
  };

  const getProductsUrl = () => {
    if (!CFG.API_BASE) return null;
    return CFG.USE_ONLY_MODE
      ? `${CFG.API_BASE}?only=productos`
      : `${CFG.API_BASE}?resource=productos`;
  };

  const postUrl = () => CFG.API_BASE;

  let rows = [];
  let view = [];
  let current = null;

  const els = {
    brandName: $("#brandName"),
    loginBox: $("#loginBox"),
    keyInput: $("#keyInput"),
    loginBtn: $("#loginBtn"),
    logoutBtn: $("#logoutBtn"),
    panel: $("#panel"),
    refreshBtn: $("#refreshBtn"),
    newBtn: $("#newBtn"),
    tbody: $("#tbody"),
    status: $("#status"),
    searchInput: $("#searchInput"),
    clearSearch: $("#clearSearch"),
    filterActive: $("#filterActive"),
    filterStock: $("#filterStock"),

    // editor
    editorModal: $("#editorModal"),
    edTitle: $("#edTitle"),
    edStatus: $("#edStatus"),
    deleteBtn: $("#deleteBtn"),
    duplicateBtn: $("#duplicateBtn"),
    genIdBtn: $("#genIdBtn"),
    cancelBtn: $("#cancelBtn"),
    saveBtn: $("#saveBtn"),

    f_id: $("#f_id"),
    f_nombre: $("#f_nombre"),
    f_categoria: $("#f_categoria"),
    f_subcategoria: $("#f_subcategoria"),
    f_marca: $("#f_marca"),
    f_precio: $("#f_precio"),
    f_stock: $("#f_stock"),
    f_activo: $("#f_activo"),
    f_descripcion: $("#f_descripcion"),
    f_img: $("#f_img"),
    f_video_url: $("#f_video_url"),
    f_g1: $("#f_g1"),
    f_g2: $("#f_g2"),
    f_g3: $("#f_g3"),
    f_g4: $("#f_g4"),
    f_g5: $("#f_g5"),
    f_g6: $("#f_g6"),
    f_g7: $("#f_g7"),
    f_g8: $("#f_g8"),
  };

  const showStatus = (msg) => { if (els.status) els.status.textContent = msg || ""; };

  const openEditor = () => {
    els.editorModal?.classList.add("show");
    els.editorModal?.setAttribute("aria-hidden","false");
    document.documentElement.classList.add("prevent-scroll");
  };
  const closeEditor = () => {
    els.editorModal?.classList.remove("show");
    els.editorModal?.setAttribute("aria-hidden","true");
    document.documentElement.classList.remove("prevent-scroll");
    current = null;
    els.edStatus.textContent = "";
  };

  const mapRow = (raw) => {
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
    p.galeria_1 = normalize(p.galeria_1 || "");
    p.galeria_2 = normalize(p.galeria_2 || "");
    p.galeria_3 = normalize(p.galeria_3 || "");
    p.galeria_4 = normalize(p.galeria_4 || "");
    p.galeria_5 = normalize(p.galeria_5 || "");
    p.galeria_6 = normalize(p.galeria_6 || "");
    p.galeria_7 = normalize(p.galeria_7 || "");
    p.galeria_8 = normalize(p.galeria_8 || "");
    p.video_url = normalize(p.video_url || "");
    p._s = slug([p.nombre,p.categoria,p.subcategoria,p.marca].join(" "));
    return p;
  };

  const load = async () => {
    const url = getProductsUrl();
    if (!url) throw new Error("Falta API_BASE en config.js");
    showStatus("Cargando…");
    const data = await fetchJSON(url);
    const list = data.productos || data.data || data.items || [];
    rows = (Array.isArray(list) ? list : []).map(mapRow);
    showStatus(`Listo: ${rows.length} productos`);
  };

  const apply = () => {
    const q = slug(els.searchInput.value || "");
    const fAct = els.filterActive.value;
    const fSt = els.filterStock.value;

    let list = rows.slice();
    if (q) list = list.filter(r => r._s.includes(q));
    if (fAct === "active") list = list.filter(r => r.activo);
    if (fAct === "inactive") list = list.filter(r => !r.activo);
    if (fSt === "in") list = list.filter(r => Number(r.stock||0) > 0);
    if (fSt === "out") list = list.filter(r => Number(r.stock||0) <= 0);

    // stable sort
    list.sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));

    view = list;
    renderTable();
  };

  const esc = (s) => String(s || "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");

  const fmt = (n) => {
    try { return new Intl.NumberFormat(CFG.LOCALE||"es-HN",{style:"currency",currency:CFG.CURRENCY||"HNL",maximumFractionDigits:0}).format(Number(n||0)); }
    catch { return `L ${Math.round(Number(n||0))}`; }
  };

  const renderTable = () => {
    els.tbody.innerHTML = "";
    if (view.length === 0){
      els.tbody.innerHTML = `<tr><td colspan="7" class="muted">Sin resultados</td></tr>`;
      return;
    }
    view.forEach((p) => {
      const tr = document.createElement("tr");
      const inStock = Number(p.stock||0) > 0;
      tr.innerHTML = `
        <td>
          <div class="cellTitle">${esc(p.nombre || "—")}</div>
          <div class="cellSub">${esc(p.id || "")}</div>
        </td>
        <td>
          <div class="cellTitle">${esc(p.categoria || "—")}</div>
          <div class="cellSub">${esc(p.subcategoria || "")}</div>
        </td>
        <td>${esc(p.marca || "—")}</td>
        <td><strong>${fmt(p.precio)}</strong></td>
        <td><span class="pill ${inStock ? "ok" : "bad"}">${inStock ? p.stock : "0"}</span></td>
        <td><span class="pill ${p.activo ? "ok" : "bad"}">${p.activo ? "Sí" : "No"}</span></td>
        <td>
          <div class="rowBtns">
            <button class="smallBtn" data-act="edit">Editar</button>
          </div>
        </td>
      `;
      tr.querySelector('[data-act="edit"]').addEventListener("click", () => edit(p.id));
      els.tbody.appendChild(tr);
    });
  };

  const fillForm = (p) => {
    els.f_id.value = p?.id || "";
    els.f_nombre.value = p?.nombre || "";
    els.f_categoria.value = p?.categoria || "";
    els.f_subcategoria.value = p?.subcategoria || "";
    els.f_marca.value = p?.marca || "";
    els.f_precio.value = String(p?.precio ?? "");
    els.f_stock.value = String(p?.stock ?? "");
    els.f_activo.value = (p?.activo ? "1" : "0");
    els.f_descripcion.value = p?.descripcion || "";
    els.f_img.value = p?.img || "";
    els.f_video_url.value = p?.video_url || "";
    els.f_g1.value = p?.galeria_1 || "";
    els.f_g2.value = p?.galeria_2 || "";
    els.f_g3.value = p?.galeria_3 || "";
    els.f_g4.value = p?.galeria_4 || "";
    els.f_g5.value = p?.galeria_5 || "";
    els.f_g6.value = p?.galeria_6 || "";
    els.f_g7.value = p?.galeria_7 || "";
    els.f_g8.value = p?.galeria_8 || "";
  };

  const getForm = () => {
    const p = {
      id: normalize(els.f_id.value),
      nombre: normalize(els.f_nombre.value),
      categoria: normalize(els.f_categoria.value),
      subcategoria: normalize(els.f_subcategoria.value),
      marca: normalize(els.f_marca.value),
      precio: toNum(els.f_precio.value),
      stock: Number(els.f_stock.value || 0),
      activo: els.f_activo.value === "1" ? 1 : 0,
      descripcion: normalize(els.f_descripcion.value),
      img: normalize(els.f_img.value),
      video_url: normalize(els.f_video_url.value),
      galeria_1: normalize(els.f_g1.value),
      galeria_2: normalize(els.f_g2.value),
      galeria_3: normalize(els.f_g3.value),
      galeria_4: normalize(els.f_g4.value),
      galeria_5: normalize(els.f_g5.value),
      galeria_6: normalize(els.f_g6.value),
      galeria_7: normalize(els.f_g7.value),
      galeria_8: normalize(els.f_g8.value),
    };
    if (!p.id) p.id = genId();
    return p;
  };

  const edit = (id) => {
    current = rows.find(r => r.id === id) || null;
    els.edTitle.textContent = current ? `Editar: ${current.nombre}` : "Nuevo producto";
    fillForm(current || {});
    els.deleteBtn.style.display = current ? "inline-flex" : "none";
    openEditor();
  };

  const newProduct = () => {
    current = null;
    els.edTitle.textContent = "Nuevo producto";
    fillForm({ id:"", activo:true, stock:0 });
    els.deleteBtn.style.display = "none";
    openEditor();
  };

  const duplicate = () => {
    if (!current) return;
    const copy = Object.assign({}, current);
    copy.id = "";
    copy.nombre = copy.nombre ? `${copy.nombre} (copia)` : "";
    current = null;
    els.edTitle.textContent = "Nuevo (copia)";
    fillForm(copy);
    els.deleteBtn.style.display = "none";
  };

  const save = async () => {
    const adminKey = getKey();
    if (!adminKey) throw new Error("Falta ADMIN_KEY");
    const p = getForm();

    if (!p.nombre) throw new Error("Falta nombre");
    if (!p.categoria) throw new Error("Falta categoría");
    if (!p.precio && p.precio !== 0) throw new Error("Precio inválido");

    els.edStatus.textContent = "Guardando…";

    const body = {
      action: "updateProduct",
      adminKey,
      product: p
    };

    const data = await fetchJSON(postUrl(), {
      method: "POST",
      headers: { "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify(body)
    });

    if (!data.ok) throw new Error(data.error || "No se pudo guardar");
    els.edStatus.textContent = "Guardado ✅";

    await load();
    apply();
    setTimeout(closeEditor, 350);
  };

  const remove = async () => {
    const adminKey = getKey();
    if (!adminKey) throw new Error("Falta ADMIN_KEY");
    if (!current?.id) return;

    const ok = confirm("¿Eliminar este producto? Esta acción no se puede deshacer.");
    if (!ok) return;

    els.edStatus.textContent = "Eliminando…";

    const body = {
      action: "deleteProduct",
      adminKey,
      id: current.id
    };

    const data = await fetchJSON(postUrl(), {
      method: "POST",
      headers: { "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify(body)
    });

    if (!data.ok) throw new Error(data.error || "No se pudo eliminar");
    els.edStatus.textContent = "Eliminado ✅";

    await load();
    apply();
    setTimeout(closeEditor, 350);
  };

  const boot = async () => {
    els.brandName.textContent = CFG.APP_NAME || "SDComayagua";

    // modal close
    els.editorModal?.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.dataset && t.dataset.close) closeEditor();
    });
    window.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closeEditor(); });

    // login state
    const key = getKey();
    if (key) {
      els.loginBox.hidden = true;
      els.panel.hidden = false;
    } else {
      els.loginBox.hidden = false;
      els.panel.hidden = true;
    }

    // login
    els.loginBtn?.addEventListener("click", async () => {
      const k = normalize(els.keyInput.value);
      if (!k) return alert("Ingresá tu ADMIN_KEY");
      setKey(k);
      els.loginBox.hidden = true;
      els.panel.hidden = false;
      await reload();
    });
    els.keyInput?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") els.loginBtn.click(); });

    // logout
    els.logoutBtn?.addEventListener("click", () => {
      clearKey();
      location.reload();
    });

    // toolbar
    els.searchInput?.addEventListener("input", () => {
      const has = !!normalize(els.searchInput.value);
      els.clearSearch.classList.toggle("show", has);
      apply();
    });
    els.clearSearch?.addEventListener("click", () => {
      els.searchInput.value = "";
      els.clearSearch.classList.remove("show");
      apply();
      els.searchInput.focus();
    });
    els.filterActive?.addEventListener("change", apply);
    els.filterStock?.addEventListener("change", apply);

    // actions
    els.refreshBtn?.addEventListener("click", reload);
    els.newBtn?.addEventListener("click", newProduct);

    // editor actions
    els.cancelBtn?.addEventListener("click", closeEditor);
    els.saveBtn?.addEventListener("click", async () => {
      try { await save(); }
      catch(e){ console.error(e); els.edStatus.textContent = `Error: ${e.message}`; }
    });
    els.deleteBtn?.addEventListener("click", async () => {
      try { await remove(); }
      catch(e){ console.error(e); els.edStatus.textContent = `Error: ${e.message}`; }
    });
    els.duplicateBtn?.addEventListener("click", duplicate);
    els.genIdBtn?.addEventListener("click", () => { els.f_id.value = genId(); });

    // first load if logged
    if (getKey()) await reload();
  };

  const reload = async () => {
    try{
      await load();
      apply();
    } catch (e){
      console.error(e);
      showStatus(`Error: ${e.message}`);
      alert(`No se pudo cargar/guardar.\n\nDetalle: ${e.message}\n\nRevisá que tu Apps Script esté publicado y que API_BASE sea correcto.`);
    }
  };

  boot();
})();
