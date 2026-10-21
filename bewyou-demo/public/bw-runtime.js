/* Bewyou · runtime para Vercel + Postgres.
   Reemplaza las capacidades del entorno de Claude (window.claude.use) por llamadas a /api. */
(function(){
  const PUBLICA = /^\/app\/?$/.test(location.pathname); // la app del usuario no pide clave
  const getKey = () => { try { return localStorage.getItem("bw-key") || ""; } catch (e) { return ""; } };
  function pedirClave(msg){
    if (PUBLICA || document.getElementById("bw-keybox")) return;
    const box = document.createElement("div");
    box.id = "bw-keybox";
    box.innerHTML = '<form style="background:var(--surface,#fff);color:var(--ink,#16203A);padding:24px;border-radius:14px;max-width:360px;width:calc(100% - 32px);display:flex;flex-direction:column;gap:12px;font-family:system-ui;box-shadow:0 20px 60px rgba(0,0,0,.35)">'
      + '<b style="font-size:18px">Acceso para el equipo clínico</b><span style="font-size:14px;opacity:.75">Escribe la clave de acceso.</span>'
      + '<input id="bw-key-in" type="password" autocomplete="current-password" aria-label="Clave de acceso" style="padding:10px;border-radius:8px;border:1px solid #ccc;font-size:15px">'
      + '<span id="bw-key-err" style="font-size:13px;color:#C63A44;min-height:1em"></span>'
      + '<button style="padding:10px;border-radius:8px;border:0;background:#8A2846;color:#fff;font-weight:700;font-size:15px">Entrar</button></form>';
    box.style.cssText = "position:fixed;inset:0;z-index:99;display:grid;place-items:center;background:rgba(10,15,30,.6)";
    const err = box.querySelector("#bw-key-err"); if (msg) err.textContent = msg;
    box.querySelector("form").addEventListener("submit", async e => {
      e.preventDefault(); const k = box.querySelector("#bw-key-in").value.trim(); if (!k) { err.textContent = "Escribe la clave."; return; }
      err.textContent = "Verificando…";
      try {
        const r = await fetch("/api/docs?col=notas", { headers: { "x-bewyou-key": k } });
        if (r.status === 401) { err.textContent = "La clave no es correcta."; return; }
        if (!r.ok) { err.textContent = "No se pudo verificar (" + r.status + "). Intenta de nuevo."; return; }
        try { localStorage.setItem("bw-key", k); } catch (_) {}
        location.reload();
      } catch (_) { err.textContent = "Sin conexión. Intenta de nuevo."; }
    });
    document.body.append(box); setTimeout(() => box.querySelector("input").focus(), 30);
  }
  if (document.documentElement.classList.contains("bw-lock")) pedirClave();
  async function api(path, opt = {}){
    const r = await fetch(path, { ...opt, headers: { "content-type": "application/json", "x-bewyou-key": getKey() } });
    if (r.status === 401) { if (getKey()) { try { localStorage.removeItem("bw-key"); } catch (_) {} pedirClave("La clave cambió o ya no es válida. Escríbela de nuevo."); } else pedirClave(); throw { code: "unauthorized", message: "Falta la clave de acceso" }; }
    if (!r.ok) throw { code: "unavailable", message: "Error " + r.status };
    return r.json();
  }
  const snap = (id, data) => ({ id, exists: data != null, data: () => (data == null ? undefined : data), metadata: { fromCache: false, hasPendingWrites: false } });
  const listeners = new Map();
  function escuchar(col, fn){ if (!listeners.has(col)) listeners.set(col, new Set()); listeners.get(col).add(fn); return () => listeners.get(col).delete(fn); }
  function avisar(col){ (listeners.get(col) || []).forEach(fn => fn()); }
  function sondeo(col, leer, next, err){
    let vivo = true;
    const tick = () => leer().then(s => { if (vivo) next(s); }).catch(e => { if (e && e.code === "unauthorized") { vivo = false; if (err) err(e); } });
    tick(); const t = setInterval(tick, 6000); const off = escuchar(col, tick);
    return () => { vivo = false; clearInterval(t); off(); };
  }
  function docRef(col, id){
    const ref = {
      id, path: col + "/" + id,
      async get(){ const r = await api(`/api/docs?col=${encodeURIComponent(col)}&id=${encodeURIComponent(id)}`); return snap(id, r.data); },
      async set(data){ await api("/api/docs", { method: "PUT", body: JSON.stringify({ col, id, data }) }); avisar(col); },
      async update(data){ const cur = (await ref.get()).data() || {}; await ref.set({ ...cur, ...data }); },
      async delete(){ await api(`/api/docs?col=${encodeURIComponent(col)}&id=${encodeURIComponent(id)}`, { method: "DELETE" }); avisar(col); },
      onSnapshot(next, err){ return sondeo(col, () => ref.get(), next, err); },
      collection(){ throw new TypeError("Subcolecciones no disponibles en este runtime"); }
    };
    return ref;
  }
  function colRef(col){
    const ref = {
      path: col,
      doc: id => docRef(col, id || Math.random().toString(36).slice(2, 12)),
      async add(data){ const d = ref.doc(); await d.set(data); return d; },
      async get(){ let r; try { r = await api(`/api/docs?col=${encodeURIComponent(col)}`); } catch (e) { if (PUBLICA && e.code === "unauthorized") r = { docs: [] }; else throw e; }
        const docs = r.docs.map(d => snap(d.id, d.data)); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } }; },
      onSnapshot(next, err){ return sondeo(col, () => ref.get(), next, err); },
      where(){ return ref; }, orderBy(){ return ref; }, limit(){ return ref; }
    };
    return ref;
  }
  const db = Object.freeze({ doc: p => { const [c, i] = p.split("/"); return docRef(c, i); }, collection: c => colRef(c) });
  async function sample(input, opts = {}){
    const r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json", "x-bewyou-key": getKey() }, body: JSON.stringify({ input }) });
    if (r.status === 501 || r.status === 401 || r.status === 429) throw { code: "not_granted", message: "IA no disponible" };
    if (!r.ok) throw { code: "unavailable", message: "Error " + r.status };
    const j = await r.json(); if (opts.onText) opts.onText({ text: j.text, delta: j.text });
    return { text: j.text, truncated: false };
  }
  sample.json = async (input, opts) => { const r = await sample(input, opts); const m = r.text.match(/\{[\s\S]*\}/); if (!m) throw { code: "invalid_json", text: r.text }; return JSON.parse(m[0]); };
  const user = Object.freeze({ id: async () => null, isOwner: () => false, canEdit: () => false, can: () => null });
  window.claude = Object.freeze({ use: async name => name === "db" ? db : name === "sample" ? sample : name === "user" ? user : null });
})();
