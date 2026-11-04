/* Teachable Code lesson runtime. Reads one lesson JSON; renders the story beside a 3D (Three.js) or 2D (SVG) stage. */
(function () {
  const L = JSON.parse(document.getElementById("lesson").textContent), $ = id => document.getElementById(id);
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n.replace(/^var\((.*)\)$/, "$1")).trim();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const calm = matchMedia("(prefers-reduced-motion:reduce)").matches, vis = c => c === "\n" ? "⏎" : c === " " ? "␣" : c;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), backOut = u => { const k = 1.55; u -= 1; return 1 + (k + 1) * u * u * u + k * u * u; };
  const PROV = { ran: "ran", read: "read from code", illustrative: "example" }, ICON = { play: '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z"/></svg>', pause: '<svg viewBox="0 0 16 16"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/></svg>' };
  let cur = 0, playing = false, speed = 1, guess = false, timer = 0, stage = null, inspect = null, sel = null; const answered = {}, dirOpen = new Set(), dirAll = new Set();
  /* the map: stations are permanent parts of the system; objects are the data sitting on them */
  const is3D = L.stage.mode === "3d", STN = is3D ? L.stage.stations : Object.fromEntries(Object.entries(L.stage.objects).filter(([, d]) => d.type !== "group"));
  const stationOf = id => is3D ? (L.stage.objects[id] || {}).at : id;
  const fileStations = path => Object.keys(STN).filter(k => (STN[k].files || []).some(f => f === path || f.startsWith(path + "/")));
  const stFiles = new Set(Object.values(STN).flatMap(s => s.files || []));
  const litStations = i => { const s = new Set(); stateAt(i).focus.forEach(o => { const k = stationOf(o); if (k) s.add(k); }); return s; };

  /* ---------- state: replaying steps makes any step reachable directly ---------- */
  function stateAt(i) {
    const v = new Set(), ever = new Set(), set = {};
    for (let k = 0; k <= i; k++) { const s = L.steps[k]; (s.hide === "all" ? [...v] : s.hide || []).forEach(x => v.delete(x)); (s.show || []).forEach(x => { v.add(x); ever.add(x); }); Object.assign(set, s.set || {}); }
    const s = L.steps[i], fl = (s.flow || []).flatMap(f => [f.from, f.to]);
    return { visible: v, ever, set, focus: s.focus || ((s.show || []).length ? s.show : fl) };
  }

  /* ---------- value renderers: same formats for input and output, so they compare directly ---------- */
  function heat(v, max) { const a = Math.min(1, Math.abs(v) / (max || 1)), c = v < 0 ? "var(--neg)" : "var(--pos)"; return `color-mix(in srgb,${c} ${Math.round(a * 88)}%,transparent)`; }
  function val(v) {
    if (!v) return "";
    if (v.type === "chips") return `<div class="chips">${v.items.map((x, i) => `<span class="chip${(v.hi || []).includes(i) ? " hi" : ""}">${esc(vis(x))}${v.subs ? `<small>${esc(v.subs[i])}</small>` : ""}</span>`).join("")}</div>`;
    if (v.type === "matrix") {
      const m = v.values, max = Math.max(...m.flat().map(Math.abs)), cols = m[0].length, num = cols <= (v.numCols || 8), sz = num ? "minmax(40px,auto)" : "14px";
      const head = v.colLabels ? `<span></span>${v.colLabels.map(c => `<span style="color:var(--muted)">${esc(vis(c))}</span>`).join("")}` : "";
      return `<div class="scroll"><div class="mat" style="grid-template-columns:auto repeat(${cols},${sz})">${head}${m.map((r, i) => `<span class="rl">${esc(vis(v.rowLabels ? v.rowLabels[i] : i))}</span>` + r.map((x, j) => `<span class="${v.mark && v.mark[0] === i && v.mark[1] === j ? "mark" : ""}" style="background:${heat(x, max)}${num ? "" : ";min-width:14px;padding:0"}" title="${x}">${num ? (+x).toFixed(v.digits ?? 2) : ""}</span>`).join("")).join("")}</div></div>${v.note ? `<div class="eyebrow" style="margin-top:6px;font-weight:500">${esc(v.note)}</div>` : ""}`;
    }
    if (v.type === "bars") { const max = v.max || Math.max(...v.items.map(x => x[1])); return `<div class="scroll">${v.items.map((x, i) => `<div class="barrow${(v.hi || []).includes(i) ? " hi" : ""}"><span>${esc(vis(x[0]))}</span><div class="bar"><i style="width:${(100 * x[1] / max).toFixed(1)}%"></i></div><em>${v.pct ? (x[1] * 100).toFixed(1) + "%" : x[1]}</em></div>`).join("")}</div>`; }
    if (v.type === "segments") return `<div class="scroll">${v.items.map(s => `<div class="seg" style="--sc:${s.color || "var(--c)"}"><small>${s.size || ""}</small><b>${esc(s.label)}</b><div>${esc(s.text)}</div></div>`).join("")}</div>`;
    if (v.type === "pair") return v.items.map(x => `<div class="iolab" style="margin:7px 0 4px;font-weight:500">${esc(x.label)}</div>${val(x)}`).join("");
    if (v.tf) return `<div class="tfbody">${esc(v.text).replace(/&lt;code&gt;(.*?)&lt;\/code&gt;/g, "<code>$1</code>").replace(/\n/g, "<br>")}</div>`;
    return `<div class="scroll"><pre class="val">${esc(v.text ?? "")}</pre></div>`;
  }
  const box = (name, color, v, mid) => `<div class="iobox${mid ? " mid" : ""}" style="--c:var(${color})"><div class="iohead"><b>${name}</b>${v.prov ? `<span class="badge ${v.prov}">${PROV[v.prov]}</span>` : ""}</div><div class="iolab">${esc(v.label || "")}</div>${val(v)}</div>`;

  /* ---------- panels ---------- */
  function rail() {
    const lit = litStations(cur), here = (L.steps[cur].code || {}).f, litFiles = new Set([...lit].flatMap(k => STN[k].files || [])), hit = n => n.steps || stFiles.has(n.path), has = n => n.dir ? (n.kids || []).some(has) : hit(n);
    const node = (n, pre) => {
      const path = pre + n.name;
      if (n.dir) { const canOpen = !!n.kids, open = dirOpen.has(path) || (canOpen && has(n) && !dirOpen.has("!" + path)); return `<li><button class="d" data-dir="${esc(path)}" title="${esc(n.note || "")}"><span class="caret">${canOpen ? (open ? "▾" : "▸") : ""}</span><span>${esc(n.name)}/</span><small>${n.files}</small></button>${open ? list(n.kids, path + "/", path) : ""}</li>`; }
      return `<li><button class="f${hit(n) ? "" : " quiet"}${litFiles.has(n.path) ? " lit" : ""}${n.path === here ? " cur" : ""}${sel === n.path ? " sel" : ""}" data-file="${esc(n.path)}" title="${esc(n.note || n.path)}"><span class="caret"></span><span>${esc(n.name)}</span>${n.steps ? `<small>${n.steps.map(x => x + 1).join(" ")}</small>` : ""}</button></li>`;
    };
    const list = (kids, pre, key) => { const dirs = kids.filter(n => n.dir), on = kids.filter(n => !n.dir && hit(n)), off = kids.filter(n => !n.dir && !hit(n)), all = dirAll.has(key); return `<ul>${dirs.map(n => node(n, pre)).join("")}${on.map(n => node(n, pre)).join("")}${all ? off.map(n => node(n, pre)).join("") : ""}${off.length ? `<li><button class="more" data-more="${esc(key)}"><span class="caret"></span>${all ? "hide other files" : `+ ${off.length} other file${off.length === 1 ? "" : "s"}`}</button></li>` : ""}</ul>`; };
    const r = $("railbody"), keep = r.scrollTop; r.innerHTML = `<div class="tree">${list(L.tree.kids, "", "")}</div>`; r.scrollTop = keep;
    r.querySelectorAll("[data-file]").forEach(b => { b.onclick = () => openFile(b.dataset.file); b.onmouseenter = () => stage && stage.lit(fileStations(b.dataset.file)); b.onmouseleave = () => stage && stage.lit(inspectLit()); });
    r.querySelectorAll("[data-dir]").forEach(b => { b.onclick = () => { const k = b.dataset.dir, open = dirOpen.has(k) || !dirOpen.has("!" + k); if (open) { dirOpen.delete(k); dirOpen.add("!" + k); } else { dirOpen.delete("!" + k); dirOpen.add(k); } rail(); }; b.onmouseenter = () => stage && stage.lit(fileStations(b.dataset.dir)); b.onmouseleave = () => stage && stage.lit(inspectLit()); });
    r.querySelectorAll("[data-more]").forEach(b => b.onclick = () => { const k = b.dataset.more; dirAll.has(k) ? dirAll.delete(k) : dirAll.add(k); rail(); });
    const c = r.querySelector(".cur"); if (c) { const t = c.offsetTop; if (t < r.scrollTop || t > r.scrollTop + r.clientHeight - 30) r.scrollTop = t - 50; }
  }
  const inspectLit = () => inspect ? (inspect.station ? [inspect.station] : inspect.file ? fileStations(inspect.file) : []) : [];
  function timeline() {
    const chs = []; L.steps.forEach((s, i) => { const c = chs[chs.length - 1]; if (c && c.name === s.chapter) c.ids.push(i); else chs.push({ name: s.chapter, ids: [i] }); });
    $("tl").innerHTML = chs.map(c => `<div class="tlc${c.ids.includes(cur) ? " cur" : ""}" style="flex-grow:${c.ids.length}"><span title="${esc(c.name)}">${esc(c.name)}</span><div class="tlt">${c.ids.map(i => `<button class="tick${i === cur ? " cur" : i < cur ? " done" : ""}" data-go="${i}" title="${i + 1}. ${esc(L.steps[i].title)}" aria-label="Step ${i + 1}: ${esc(L.steps[i].title)}"></button>`).join("")}</div></div>`).join("");
    $("tl").querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(+b.dataset.go));
  }
  function side() {
    if (inspect) return inspector();
    const s = L.steps[cur]; let h = `<div id="stepno">${cur + 1}<small>/ ${L.steps.length}</small></div><h2>${esc(s.title)}</h2>`;
    if (guess && s.ask && !answered[cur]) { h += `<div class="ask"><p>${esc(s.ask.q)}</p>${s.ask.options.map((o, i) => `<button data-a="${i}">${esc(o)}</button>`).join("")}</div>`; $("side").innerHTML = h; $("side").querySelectorAll("[data-a]").forEach(b => b.onclick = () => { answered[cur] = 1; const ok = +b.dataset.a === s.ask.answer; show(cur, ok ? "Right. " : `Not quite: the answer is “${s.ask.options[s.ask.answer]}”. `); }); return; }
    h += `<p id="plain">${s.plain}</p>${s.why ? `<p class="why">${s.why}</p>` : ""}`;
    if (s.facts) h += `<dl class="facts">${s.facts.map(f => `<dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd>`).join("")}</dl>`;
    if (s.code) h += `<details><summary>Show the code</summary><pre class="code">${esc(s.code.text)}</pre><a href="${esc(L.repo.url)}/blob/${L.repo.commit}/${s.code.f.split("/").map(encodeURIComponent).join("/")}#L${s.code.a}-L${s.code.b}" target="_blank" rel="noopener">${esc(s.code.f)}:${s.code.a}-${s.code.b}</a></details>`;
    if (s.tech) h += `<details><summary>For engineers</summary><p style="font-size:14px;margin:8px 0 0">${s.tech}</p></details>`;
    $("side").innerHTML = h; $("side").scrollTop = 0;
  }
  function io() { const s = L.steps[cur]; $("io").innerHTML = (guess && s.ask && !answered[cur]) ? `<div class="iobox" style="--c:var(--accent);grid-column:1/-1"><div class="iolab" style="margin:0">Answer the question to see this step's data.</div></div>` : box("INPUT", "--in", s.input) + box("WHAT HAPPENS", "--tf", { ...s.transform, tf: true }, true) + box("OUTPUT", "--out", s.output); }
  function log() {
    const st = $("lograp"); st.innerHTML = L.steps.map((s, i) => `<button class="trow${i === cur ? " cur" : i > cur ? " next" : ""}" data-go="${i}"><span class="n">${i + 1}</span><span>${esc(s.title)}${i <= cur ? `<small>${esc(s.log[0])} → ${esc(s.log[1])} · ${esc(s.log[2])}${s.log[3] ? " · " + esc(s.log[3]) : ""}</small>` : ""}</span></button>`).join("");
    st.querySelectorAll("[data-go]").forEach(r => r.onclick = () => go(+r.dataset.go)); $("trailn").textContent = `${cur + 1} of ${L.steps.length}`;
    const c = st.querySelector(".cur"); if (c) { const t = c.offsetTop; if (t < st.scrollTop || t + c.offsetHeight > st.scrollTop + st.clientHeight) st.scrollTop = Math.max(0, t - st.clientHeight / 2); }
  }
  /* ---------- inspector: click any part or data point to see its files and data; click a file to see its parts ---------- */
  function objVal(id, st, mark) {
    const d = L.stage.objects[id], v = st.set[id] || {};
    if (d.type === "slab") { const vals = v.values || d.values, rows = v.rows ?? vals.length; return { type: "matrix", values: vals.slice(0, rows), rowLabels: d.rowLabels, colLabels: d.colLabels, numCols: 4, digits: 2, mark }; }
    if (d.type === "tiles") return { type: "chips", items: d.items, subs: d.subs, hi: d.hi };
    if (d.type === "bars") return { type: "bars", items: d.items, max: d.max, pct: d.pct, hi: d.hi };
    if (d.type === "tower") { const up = v.upto ?? d.layers.length; return { type: "segments", items: d.layers.slice(0, up).map(l => ({ label: l.who || l.label || "", size: `${l.chars.toLocaleString("en")} chars`, color: `var(${l.color})`, text: "" })) }; }
    if (d.type === "stack") { const ids = v.items; return { type: "segments", items: d.items.filter(x => !ids || ids.includes(x.id)).map(x => ({ label: x.label, size: x.size, color: x.color, text: x.text || "" })) }; }
    if (d.type === "label") return { text: d.text };
    if (d.type === "cloud") return { text: `${d.labels.length} characters placed by their weights.` };
    if (d.type === "curve") return { text: `${d.points.length} points on the curve.` };
    return null;
  }
  function inspector() {
    const st = stateAt(cur), back = `<button class="back" id="iBack">← Back to step ${cur + 1}</button>`; let h = back;
    const stepChips = ids => `<div class="schips">${ids.map(i => `<button class="schip${i === cur ? " cur" : ""}" data-go="${i}" title="${esc(L.steps[i].title)}">${i + 1}</button>`).join("")}</div>`;
    if (inspect.file) {
      const f = inspect.file, parts = fileStations(f), steps = L.steps.map((s, i) => (s.code && s.code.f === f) ? i : -1).filter(i => i >= 0), name = f.split("/").pop();
      h += `<div class="eyebrow">PROJECT FILE</div><h2 style="overflow-wrap:anywhere">${esc(name)}</h2><div class="mono" style="font-size:12px;color:var(--muted);overflow-wrap:anywhere">${esc(f)}</div>`;
      if (parts.length) h += `<div class="isec"><span class="eyebrow">PARTS OF THE SYSTEM THAT USE IT</span>${parts.map(k => `<button class="ilink" data-st="${k}">${esc(STN[k].label)}</button>`).join("")}</div>`;
      else h += `<div class="isec" style="color:var(--muted);font-size:13.5px">No part of this lesson uses this file, so it isn't on the map.</div>`;
      if (steps.length) h += `<div class="isec"><span class="eyebrow">STEPS THAT QUOTE IT</span>${stepChips(steps)}</div>` + steps.slice(0, 4).map(i => { const c = L.steps[i].code; return `<details${i === steps[0] ? " open" : ""}><summary>Step ${i + 1}: lines ${c.a}-${c.b}</summary><pre class="code">${esc(c.text)}</pre></details>`; }).join("");
      h += `<div class="isec"><a href="${esc(L.repo.url)}/blob/${L.repo.commit}/${f.split("/").map(encodeURIComponent).join("/")}" target="_blank" rel="noopener">Open on GitHub</a></div>`;
    } else {
      const k = inspect.station, s = STN[k], files = s.files || [], here = Object.keys(L.stage.objects).filter(o => stationOf(o) === k && st.visible.has(o)), steps = L.steps.map((_, i) => litStations(i).has(k) ? i : -1).filter(i => i >= 0);
      h += `<div class="eyebrow">PART OF THE SYSTEM</div><h2>${esc(s.label)}</h2><p style="font-size:14.5px;margin:0">${esc(s.note || s.sub || "")}</p>`;
      if (inspect.point) h += `<div class="point">${esc(inspect.point)}</div>`;
      h += `<div class="isec"><span class="eyebrow">PROJECT FILES</span>${files.length ? files.map(f => `<button class="ilink" data-file="${esc(f)}">${esc(f)}</button>`).join("") : '<span style="font-size:13px;color:var(--muted)">No file in this repo: this part is outside it.</span>'}</div>`;
      h += `<div class="isec"><span class="eyebrow">STEPS THAT LIGHT IT UP</span>${steps.length ? stepChips(steps) : ""}</div>`;
      const vals = here.map(o => { const d = L.stage.objects[o], v = objVal(o, st, inspect.obj === o ? inspect.mark : null); return v ? `<div class="iolab" style="margin:6px 0 4px;font-size:12.5px">${esc(d.label || d.title || "")}</div><div style="--c:var(--accent);overflow:auto">${val(v)}</div>` : ""; }).join("");
      h += `<div class="isec"><span class="eyebrow">DATA HERE AT STEP ${cur + 1}</span>${vals || '<span style="font-size:13px;color:var(--muted)">Nothing has reached this part yet.</span>'}</div>`;
    }
    const side = $("side"); side.innerHTML = h; side.scrollTop = 0; $("iBack").onclick = closeInspect;
    side.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(+b.dataset.go)); side.querySelectorAll("[data-file]").forEach(b => b.onclick = () => openFile(b.dataset.file)); side.querySelectorAll("[data-st]").forEach(b => b.onclick = () => openStation({ station: b.dataset.st }));
  }
  function setInspect(x) { inspect = x; sel = x && x.file || null; if (stage) stage.lit(inspectLit()); rail(); side(); if (!x) applyPrefix(); }
  const openFile = f => setInspect({ file: f }), openStation = p => setInspect({ station: p.station, point: p.point, obj: p.obj, mark: p.mark }), closeInspect = () => setInspect(null), applyPrefix = () => {};

  function show(i, prefix) {
    cur = i; inspect = null; sel = null; const s = L.steps[i]; rail(); timeline(); side(); io(); log(); mini();
    if (prefix) { const p = $("plain"); if (p) p.innerHTML = `<b>${esc(prefix)}</b>` + (L.steps[i].ask.explain ? esc(L.steps[i].ask.explain) + " " : "") + p.innerHTML; }
    $("cap").textContent = s.cap || ""; $("where").textContent = s.code ? `${s.code.f}:${s.code.a}` : "";
    if (stage) { stage.apply(stateAt(i), s); stage.lit([]); }
    try { history.replaceState(null, "", `#step-${i + 1}`); } catch (e) {}
    schedule();
  }
  /* a small map of the whole system, shown only while zoomed in */
  function mini() {
    if (!stage || !stage.stations) return; const S = stage.stations(), x0 = Math.min(...S.map(s => s.x)), y0 = Math.min(...S.map(s => s.y)), x1 = Math.max(...S.map(s => s.x + s.w)), y1 = Math.max(...S.map(s => s.y + s.h)), lit = litStations(cur);
    $("mini").innerHTML = `<svg viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" role="img" aria-label="The whole system">${S.map(s => `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${(x1 - x0) / 60}" class="${lit.has(s.id) ? "on" : ""}" data-fly="${s.id}"><title>${esc(STN[s.id].label)}</title></rect>`).join("")}</svg>`;
    $("mini").querySelectorAll("[data-fly]").forEach(r => r.onclick = () => stage.fly(r.dataset.fly));
  }
  const hooks = {
    pick: p => p ? openStation(p) : (inspect && closeInspect()),
    hover: (t, e) => { const tip = $("tip"); if (!t) { tip.hidden = true; return; } const b = $("stagewrap").getBoundingClientRect(); tip.textContent = t; tip.hidden = false; const w = tip.offsetWidth, h = tip.offsetHeight; tip.style.left = Math.max(4, Math.min(b.width - w - 4, e.clientX - b.left + 14)) + "px"; tip.style.top = Math.max(4, Math.min(b.height - h - 4, e.clientY - b.top + 14)) + "px"; },
    view: zoomed => { $("mini").hidden = !zoomed; },
    used: () => $("hint").classList.add("off")
  };
  const go = i => { i = Math.max(0, Math.min(L.steps.length - 1, i)); show(i); };
  function schedule() { clearTimeout(timer); if (!playing) return; const s = L.steps[cur]; if (guess && s.ask && !answered[cur]) return; if (cur >= L.steps.length - 1) { setPlay(false); return; } timer = setTimeout(() => go(cur + 1), (s.dwell || 8000) / speed); }
  function setPlay(p) { playing = p; $("bPlay").innerHTML = p ? ICON.pause : ICON.play; $("bPlay").setAttribute("aria-label", p ? "Pause" : "Play"); schedule(); }

  /* ---------- 3D stage: a lit table with soft shadows, rounded blocks and glowing data ---------- */
  function Stage3D(root) {
    /* one fixed table: stations and wires never leave; a step only changes what is lit and what data sits on them */
    const T = window.THREE, col = n => new T.Color(css(n)).convertSRGBToLinear();
    let R; try { R = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true }); } catch (e) { console.error("WebGL could not start:", e.message); return null; }
    root.appendChild(R.domElement); R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.setClearColor(0, 0);
    R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.12; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene(), cam = new T.PerspectiveCamera(20, 1, 1, 1200);
    const darkTheme = new T.Color(css("--bg")).getHSL({}).l < .3; scene.add(new T.HemisphereLight(0xffffff, col("--cell"), darkTheme ? .55 : .95));
    const key = new T.DirectionalLight(0xffffff, darkTheme ? .7 : 1.05); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 5; key.shadow.bias = -.0006; scene.add(key, key.target);
    const fill = new T.DirectionalLight(col("--accent"), .22); fill.position.set(-20, 12, -18); scene.add(fill);
    /* the table: a dot grid that fades out, and a plane that only catches shadows */
    const dotC = document.createElement("canvas"); dotC.width = dotC.height = 32; { const x = dotC.getContext("2d"); x.fillStyle = "#fff"; x.beginPath(); x.arc(16, 16, 13, 0, 7); x.fill(); }
    const floorPts = [], floorCol = [], fc = col("--floor"), bc = new T.Color(css("--stage")).convertSRGBToLinear(), N = 46, STEP = 2.4; for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) { const f = clamp(1 - Math.hypot(i, j) / N); floorPts.push(i * STEP, 0, j * STEP); const c = bc.clone().lerp(fc, f * f * .9); floorCol.push(c.r, c.g, c.b); }
    const floorG = new T.BufferGeometry(); floorG.setAttribute("position", new T.Float32BufferAttribute(floorPts, 3)); floorG.setAttribute("color", new T.Float32BufferAttribute(floorCol, 3));
    const floor = new T.Points(floorG, new T.PointsMaterial({ size: .13, sizeAttenuation: true, map: new T.CanvasTexture(dotC), alphaTest: .4, vertexColors: true, toneMapped: false })); floor.position.y = -.04; scene.add(floor);
    const catcher = new T.Mesh(new T.PlaneGeometry(400, 400), new T.ShadowMaterial({ opacity: new T.Color(css("--bg")).getHSL({}).l < .3 ? .38 : .16 })); catcher.rotation.x = -Math.PI / 2; catcher.position.y = -.03; catcher.receiveShadow = true; scene.add(catcher);

    const orbit = { az: 0, el: 1.02, dist: 200, t: new T.Vector3() }, goal = { az: 0, el: 1.02, dist: 200, t: new T.Vector3() }; let touched = false, follow = false, turning = false, wholeDist = 200, drag = null, lastHover = 0; const el = R.domElement, ptr = new Map(), ray = new T.Raycaster(), ndc = new T.Vector2(), ground = new T.Plane(new T.Vector3(0, 1, 0), 0);
    const setRay = e => { const b = el.getBoundingClientRect(); ndc.set((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1); ray.setFromCamera(ndc, cam); };
    const floorAt = e => { setRay(e); return ray.ray.intersectPlane(ground, new T.Vector3()); };
    const zoomBy = (f, e) => { const nd = clamp(goal.dist * f, 5, wholeDist * 1.6), p = e && floorAt(e); if (p) goal.t.add(p.sub(goal.t).multiplyScalar(1 - nd / goal.dist)); goal.dist = nd; touched = true; hooks.used(); };
    let picks = [];
    function pickAt(e) { setRay(e); for (const h of ray.intersectObjects(picks, false)) { let on = true; for (let n = h.object; n; n = n.parent) if (!n.visible) { on = false; break; } const u = h.object.userData.pick; if (on && (!u.o || u.o.op > .05)) return { ...u, instanceId: h.instanceId, }; } return null; }
    function describe(u) {
      const d = u.o && u.o.d, S = STN[u.station]; if (!u.o) return { station: u.station, tip: `${S.label}\nClick for its files and data` };
      const name = d.label || S.label;
      if (u.kind === "slab") { const c = u.o.c, i = Math.floor(u.instanceId / c), j = u.instanceId % c, v = u.o.cur[i][j], rl = d.rowLabels ? vis(d.rowLabels[i]) : i, cl = d.colLabels ? vis(d.colLabels[j]) : j; if (i >= u.o.cur.length) return null; const t = `${name}\nrow “${rl}” · column “${cl}” = ${(+v).toFixed(3)}`; return { station: u.station, obj: u.o.id, mark: [i, j], tip: t, point: t }; }
      if (u.kind === "tile") { const sub = d.subs ? `\nID ${d.subs[u.i]}` : ""; const t = `${name}\n“${vis(d.items[u.i])}”${sub}`; return { station: u.station, obj: u.o.id, tip: t, point: t }; }
      if (u.kind === "bar") { const x = d.items[u.i], t = `${name}\n${vis(x[0])}: ${d.pct ? (x[1] * 100).toFixed(1) + "%" : x[1]}`; return { station: u.station, obj: u.o.id, tip: t, point: t }; }
      if (u.kind === "layer") { const l = d.layers[u.i], head = `Layer ${u.i + 1}${l.who ? ": " + l.who : ""}\n${l.chars.toLocaleString("en")} characters`; return { station: u.station, obj: u.o.id, tip: head + "\nClick to read it", point: head + (l.text ? "\n\n" + l.text : "") }; }
      if (u.kind === "point") { const t = `Character “${vis(d.labels[u.i])}”\nPlaced by its learned weights`; return { station: u.station, obj: u.o.id, tip: t, point: t }; }
      return { station: u.station, obj: u.o.id, tip: `${name}\nClick for its files and data` };
    }
    el.addEventListener("pointerdown", e => { ptr.set(e.pointerId, e); el.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, moved: false, turn: turning || e.shiftKey || e.button === 2 }; el.style.cursor = "grabbing"; hooks.hover(null); if (ptr.size === 2) { const [a, b] = [...ptr.values()]; drag.pinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); } });
    el.addEventListener("pointermove", e => {
      if (ptr.has(e.pointerId)) ptr.set(e.pointerId, e);
      if (drag) {
        if (ptr.size === 2 && drag.pinch) { const [a, b] = [...ptr.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); if (d > 0) zoomBy(drag.pinch / d); drag.pinch = d; drag.moved = true; return; }
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!drag.moved && Math.hypot(dx, dy) < 4) return; drag.moved = true; drag.x = e.clientX; drag.y = e.clientY; touched = true; hooks.used();
        if (drag.turn) { goal.az -= dx * .006; goal.el = clamp(goal.el + dy * .005, .12, 1.5); }
        else { const per = 2 * Math.tan(cam.fov * Math.PI / 360) * orbit.dist / el.clientHeight, ca = Math.cos(orbit.az), sa = Math.sin(orbit.az), f = 1 / Math.max(.35, Math.sin(orbit.el)); goal.t.x += (-dx * ca - dy * sa * f) * per; goal.t.z += (dx * sa - dy * ca * f) * per; }
        return;
      }
      const now = performance.now(); if (now - lastHover < 50) return; lastHover = now; const u = pickAt(e), de = u && describe(u); el.style.cursor = de ? "pointer" : "grab"; hooks.hover(de ? de.tip : null, e);
    });
    const release = e => { ptr.delete(e.pointerId); if (!drag) return; const was = drag; if (ptr.size === 0) drag = null; el.style.cursor = "grab"; if (!was.moved && e.type === "pointerup") { const u = pickAt(e), de = u && describe(u); hooks.pick(de || null); } };
    el.addEventListener("pointerup", release); el.addEventListener("pointercancel", release); el.addEventListener("pointerleave", () => hooks.hover(null)); el.addEventListener("contextmenu", e => e.preventDefault());
    el.addEventListener("wheel", e => { e.preventDefault(); zoomBy(Math.exp(e.deltaY * (e.ctrlKey ? .01 : .0014)), e); }, { passive: false });
    el.addEventListener("dblclick", e => { const u = pickAt(e); if (u) fly(u.station); });

    /* text */
    const MONO = '"JetBrains Mono",Menlo,monospace', DISP = '"Bricolage Grotesque","Hanken Grotesk",sans-serif';
    function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
    function textTex(t, o = {}) {
      const fs = o.fs || 64, c = document.createElement("canvas"), x = c.getContext("2d"), f = `${o.w || 500} ${fs}px ${o.display ? DISP : MONO}`; x.font = f;
      const lines = String(t).split("\n"), pad = o.pill ? fs * .55 : fs * .12, W = Math.ceil(Math.max(...lines.map(l => x.measureText(l).width))) + pad * 2, H = Math.ceil(lines.length * fs * 1.28 + (o.pill ? fs * .5 : fs * .1));
      c.width = W; c.height = H; x.font = f; x.textBaseline = "middle"; x.textAlign = "center";
      if (o.pill) { x.fillStyle = css("--surface"); x.globalAlpha = .9; rr(x, 0, 0, W, H, H * .28 > fs * .5 ? fs * .5 : H * .28); x.fill(); x.globalAlpha = 1; }
      x.fillStyle = o.color || css("--ink"); lines.forEach((l, i) => x.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * fs * 1.28));
      const tx = new T.CanvasTexture(c); tx.encoding = T.sRGBEncoding; tx.anisotropy = 8; tx.minFilter = T.LinearMipmapLinearFilter; return { tx, w: W, h: H };
    }
    const text = (t, h, o) => { const { tx, w, h: H } = textTex(t, o), m = new T.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, toneMapped: false }), s = new T.Sprite(m); s.scale.set(h * w / H, h, 1); s.renderOrder = 5; return s; };

    /* shapes */
    function rounded(w, h, d, r) { r = Math.min(r, w / 2, d / 2); const a = -w / 2, b = -d / 2, s = new T.Shape(); s.moveTo(a + r, b); s.lineTo(a + w - r, b); s.quadraticCurveTo(a + w, b, a + w, b + r); s.lineTo(a + w, b + d - r); s.quadraticCurveTo(a + w, b + d, a + w - r, b + d); s.lineTo(a + r, b + d); s.quadraticCurveTo(a, b + d, a, b + d - r); s.lineTo(a, b + r); s.quadraticCurveTo(a, b, a + r, b); const bev = Math.min(r * .45, h * .2), g = new T.ExtrudeGeometry(s, { depth: Math.max(.001, h - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 2, curveSegments: 3 }); g.rotateX(-Math.PI / 2); g.center(); return g; }
    const soft = c => new T.MeshStandardMaterial({ color: c, roughness: .44, metalness: .02, transparent: true });
    const glowC = document.createElement("canvas"); glowC.width = glowC.height = 128; { const x = glowC.getContext("2d"), g = x.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.3, "rgba(255,255,255,.42)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
    const glowT = new T.CanvasTexture(glowC);
    const base = () => col("--cell"), NEG = col("--neg"), POS = col("--pos");
    const O = {}, cell = .6, shadow = m => { m.castShadow = true; return m; };

    function paintSlab(o, grow) {
      const { d, r, c, im, q } = o, hmax = d.hmax || 1.5, sp = 1.3, tmp = new T.Color(); let n = 0;
      for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) {
        const v = o.cur[i][j], rowOn = o.rf[i], t = clamp(grow * (1 + sp) - ((i / r + j / c) / 2) * sp) * rowOn, u = calm ? (rowOn > 0 ? 1 : 0) : t, hh = (d.flat ? .1 : .08 + hmax * Math.abs(v) / o.max) * u, a = Math.min(1, Math.abs(v) / o.max);
        q.position.set((j - (c - 1) / 2) * cell, hh / 2, (i - (r - 1) / 2) * cell); const sc = u > 0 ? .4 + .6 * u : .0001; q.scale.set(sc, Math.max(hh, .0001), sc); q.updateMatrix(); im.setMatrixAt(n, q.matrix);
        tmp.copy(o.base).lerp(v < 0 ? NEG : POS, .12 + .88 * a); if (o.hi && !o.hi.includes(i)) tmp.lerp(o.base, .78); im.setColorAt(n, tmp); n++;
      }
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
    }
    function make(id, d) {
      const g = new T.Group(); g.position.set(...(d.pos || [0, 0, 0])); g.visible = false; const o = { g, d, id, op: 0, goal: 0, mats: [], size: new T.Vector3(2, 1, 2), mid: new T.Vector3(), y0: (d.pos || [0, 0, 0])[1] };
      const titled = (y, z = 0) => { if (d.label) { const t = text(d.label, d.labelH || .78, { display: true, w: 700, pill: true }); t.position.set(0, y, z); g.add(t); o.mats.push(t.material); } };
      const tag = (s, h, o2, p) => { const t = text(vis(s), h, o2); t.position.set(...p); g.add(t); o.mats.push(t.material); return t; };
      if (d.type === "slab") {
        const m = d.values, r = m.length, c = m[0].length, mat = soft(0xffffff), geo = rounded(cell * .88, 1, cell * .88, .11), im = new T.InstancedMesh(geo, mat, r * c);
        im.castShadow = true; im.userData.pick = { station: d.at, o, kind: "slab" }; im.frustumCulled = false; Object.assign(o, { r, c, im, q: new T.Object3D(), cur: m.map(x => [...x]), tgt: null, max: d.max || Math.max(...m.flat().map(Math.abs)) || 1, rf: m.map(() => 1), rt: m.map(() => 1), hi: null, base: base(), grow: 0, dirty: true });
        paintSlab(o, 0); g.add(im); o.mats.push(mat); o.size.set(c * cell, 2, r * cell); o.mat = mat;
        if (d.rowLabels) d.rowLabels.forEach((l, i) => tag(l, .5, {}, [-(c * cell) / 2 - .55, .2, (i - (r - 1) / 2) * cell]));
        if (d.colLabels) d.colLabels.forEach((l, j) => tag(l, .42, { color: css("--muted") }, [(j - (c - 1) / 2) * cell, .2, -(r * cell) / 2 - .5]));
        titled(d.flat ? .9 : (d.hmax || 1.5) + 1, -(r * cell) / 2 - (d.colLabels ? 1.25 : .7));
      } else if (d.type === "tiles") {
        const n = d.items.length, isZ = d.axis === "z", ws = d.items.map(t => Math.max(1, String(vis(t)).length * .42 + .5)), gap = .14; let run = -(ws.reduce((a, b) => a + b, 0) + gap * (n - 1)) / 2; o.keys = [];
        d.items.forEach((t, i) => { const w = ws[i], cx = run + w / 2; run += w + gap; const tone = (d.tones || [])[i] || ((d.hi || []).includes(i) ? "--out" : null), mat = soft(tone ? col(tone) : col("--surface")), key = shadow(new T.Mesh(rounded(isZ ? 1.3 : w, .36, isZ ? 1 : 1.3, .2), mat)), px = isZ ? 0 : cx, pz = isZ ? (i - (n - 1) / 2) * 1.5 : 0; key.position.set(px, .18, pz); g.add(key); o.mats.push(mat); o.keys.push({ mat, tone }); key.userData.pick = { station: d.at, o, kind: "tile", i }; const sp = text(vis(t), .74, { color: tone ? "#12162c" : css("--ink"), w: 600 }); sp.position.set(px, .92, pz); g.add(sp); o.mats.push(sp.material); if (d.subs) { const u = text(d.subs[i], .34, { color: css("--muted") }); u.position.set(px, .48, pz + .92); g.add(u); o.mats.push(u.material); } });
        const tw = -2 * (-(ws.reduce((a, b) => a + b, 0) + gap * (n - 1)) / 2); o.size = isZ ? new T.Vector3(1.4, 1.4, n * 1.5) : new T.Vector3(tw, 1.4, 1.4); titled(2.1);
      } else if (d.type === "bars") {
        const max = d.max || Math.max(...d.items.map(x => x[1])), n = d.items.length, w = d.barW || .85;
        d.items.forEach((x, i) => { const h = .1 + (d.hmax || 6) * x[1] / max, hi = (d.hi || []).includes(i), mat = soft(hi ? col("--out") : col(d.color || "--tf")), b = shadow(new T.Mesh(rounded(w * .78, h, w * .78, .12), mat)), bx = (i - (n - 1) / 2) * w; b.position.set(bx, h / 2, 0); b.userData.pick = { station: d.at, o, kind: "bar", i }; g.add(b); o.mats.push(mat); tag(x[0], .5, {}, [bx, -.42, w * .66]); if (d.values !== false) tag(d.pct ? Math.round(x[1] * 100) + "%" : String(x[1]), .36, { color: css("--muted") }, [bx, h + .32, 0]); });
        o.size.set(n * w, d.hmax || 6, 1); o.mid.set(0, (d.hmax || 6) / 2, 0); titled((d.hmax || 6) + 1.3);
      } else if (d.type === "box") {
        const s = d.size, c = col(d.color || "--muted"), glass = new T.MeshStandardMaterial({ color: c, transparent: true, roughness: .3, depthWrite: false }); glass.userData.k = .2; const m = new T.Mesh(rounded(s[0], s[1], s[2], .5), glass); m.userData.pick = { station: d.at, o, kind: "box" }; g.add(m); o.mats.push(glass);
        const ln = new T.LineBasicMaterial({ color: c, transparent: true }); ln.userData.k = .85; g.add(new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(...s)), ln)); o.mats.push(ln); o.size.set(...s); titled(s[1] / 2 + .6);
      } else if (d.type === "label") { const t = text(d.text, d.h || .8, { color: d.color ? css(d.color) : css("--ink"), display: !!d.display, w: d.display ? 700 : 500 }); g.add(t); o.mats.push(t.material); }
      else if (d.type === "link") {
        const a = new T.Vector3(...d.a), b = new T.Vector3(...d.b), mid = a.clone().add(b).multiplyScalar(.5), mat = new T.MeshBasicMaterial({ color: col(d.color || "--muted"), transparent: true, toneMapped: false }); mat.userData.k = .6; const cv = new T.CatmullRomCurve3([a, new T.Vector3(mid.x, a.y, a.z), new T.Vector3(mid.x, b.y, b.z), b]); g.add(new T.Mesh(new T.TubeGeometry(cv, 32, d.r || .07, 8, false), mat)); o.mats.push(mat); o.size.set(.1, .1, .1); o.mid.copy(mid);
      } else if (d.type === "tower") {
        /* layers stacked to scale: each layer's height is its character count */
        const w = d.w || 7, dp = d.d || 7, sc = d.scale; o.size.set(w + 12, 12, dp); o.layers = d.layers.map((l, i) => { const mat = soft(col(l.color)), m = shadow(new T.Mesh(rounded(w, 1, dp, .35), mat)); m.userData.pick = { station: d.at, o, kind: "layer", i }; g.add(m); o.mats.push(mat); const lb = l.label ? text(l.label, l.labelH || .95, { pill: true, w: 600, color: css(l.color) }) : null; if (lb) { g.add(lb); o.mats.push(lb.material); } return { m, mat, lb, h: 0, tgt: 0, chars: l.chars, ew: w }; }); o.sc = sc; o.w = w;
      } else if (d.type === "cloud") {
        const sc = d.scale || 6, ball = new T.SphereGeometry(.15, 14, 12); o.pts = d.labels.map((ch, i) => { const k = (d.groups || {})[i] || "--muted", s = text(vis(ch), d.charH || .62, { color: css(k), w: 700 }); s.center.set(.5, -.1); const mt = new T.MeshStandardMaterial({ color: col(k), roughness: .35, transparent: true }), b = shadow(new T.Mesh(ball, mt)); b.userData.pick = { station: d.at, o, kind: "point", i }; g.add(s, b); o.mats.push(s.material, mt); return { s, b }; }); o.sc = sc; o.frame = d.frames[0];
        const ax = new T.LineBasicMaterial({ color: col("--floor"), transparent: true }); ax.userData.k = .7; [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach(v => { const p = new T.BufferGeometry().setFromPoints([new T.Vector3(-v[0] * sc * .8, -v[1] * sc * .8, -v[2] * sc * .8), new T.Vector3(v[0] * sc * .8, v[1] * sc * .8, v[2] * sc * .8)]); g.add(new T.Line(p, ax)); }); o.mats.push(ax); o.size.set(sc * 2, sc * 2, sc * 2); titled(sc + 1.2);
      } else if (d.type === "curve") {
        const P = d.points, W = d.w || 10, H = d.h || 5, xs = P.map(p => p[0]), ys = P.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), pts = P.map(p => new T.Vector3(((p[0] - x0) / (x1 - x0) - .5) * W, (p[1] - y0) / (y1 - y0) * H, 0));
        const lm = new T.MeshBasicMaterial({ color: col("--bad"), transparent: true, toneMapped: false }), cv = new T.CatmullRomCurve3(pts, false, "centripetal"), tg = new T.TubeGeometry(cv, P.length * 3, .07, 6, false); g.add(new T.Mesh(tg, lm)); o.mats.push(lm); o.curve = { lg: tg, pts, x0, x1, cv, total: tg.index.count };
        const am = new T.LineBasicMaterial({ color: col("--muted"), transparent: true }); am.userData.k = .6; g.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-W / 2, H, 0), new T.Vector3(-W / 2, 0, 0), new T.Vector3(W / 2, 0, 0)]), am)); o.mats.push(am);
        const dot = new T.Mesh(new T.SphereGeometry(.2, 16, 14), new T.MeshBasicMaterial({ color: col("--bad"), transparent: true, toneMapped: false })); g.add(dot); o.dot = dot; o.mats.push(dot.material); const hl = new T.Sprite(new T.SpriteMaterial({ map: glowT, color: col("--bad"), transparent: true, depthWrite: false })); hl.material.userData.k = .55; hl.scale.set(1.3, 1.3, 1); dot.add(hl); o.mats.push(hl.material);
        [[y1.toFixed(2), -W / 2 - .9, H], [y0.toFixed(2), -W / 2 - .9, 0]].forEach(a => tag(a[0], .55, { color: css("--muted") }, [a[1], a[2], 0])); [["iter " + x0, -W / 2 + .5], ["iter " + x1, W / 2 - .5]].forEach(a => tag(a[0], .55, { color: css("--muted") }, [a[1], -.45, 0]));
        o.size.set(W, H, 1); o.mid.set(0, H / 2, 0); titled(H + .9);
      }
      scene.add(g); O[id] = o; return o;
    }
    Object.entries(L.stage.objects).forEach(([k, d]) => make(k, d));
    /* stations: a plate, a rim that lights up, and a name that is always readable */
    const SO = {}; Object.entries(STN).forEach(([id, s]) => {
      const [x, z, w, dp] = s.box, g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
      const plate = new T.Mesh(rounded(w, .12, dp, .8), new T.MeshStandardMaterial({ color: col("--surface"), roughness: .75, transparent: true, opacity: darkTheme ? .6 : .86 })); plate.position.y = .05; plate.receiveShadow = true; plate.userData.pick = { station: id }; g.add(plate);
      const rimM = new T.MeshBasicMaterial({ color: col("--accent"), transparent: true, opacity: 0, toneMapped: false, depthWrite: false }), rim = new T.Mesh(rounded(w + .55, .05, dp + .55, 1.05), rimM); rim.position.y = .012; g.add(rim);
      const lab = (color) => { const t = text(s.label, 2.3, { display: true, w: 700, pill: true, color }); t.material.depthTest = false; t.renderOrder = 8; t.position.set(-w / 2 + t.scale.x / 2 - .2, .6, -dp / 2 + .2); g.add(t); return t; };
      const idle = lab(css("--ink")), hot = lab(css("--accent")); idle.userData.pick = hot.userData.pick = { station: id };
      SO[id] = { g, rimM, idle, hot, s, on: 0, sel: 0, tOn: 0, tSel: 0, flash: 0 };
    });
    picks = []; scene.traverse(n => { if (n.userData.pick && (n.isMesh || n.isSprite)) picks.push(n); });
    /* wires: every path any step ever uses, drawn all the time, so the structure is visible from step 1 */
    const WIRE = {}, edgeKeys = new Set((L.stage.wires || []).map(e => e[0] + ">" + e[1])); L.steps.forEach(s => (s.flow || []).forEach(f => { const a = stationOf(f.from), b = stationOf(f.to); if (a && b && a !== b) edgeKeys.add(a + ">" + b); }));
    edgeKeys.forEach(key => {
      const [a, b] = key.split(">"), A = STN[a].box, B = STN[b].box, dx = B[0] - A[0], dz = B[1] - A[1], twoWay = edgeKeys.has(b + ">" + a), off = twoWay ? (a < b ? .55 : -.55) : 0, horiz = Math.abs(dx) / (A[2] + B[2]) > Math.abs(dz) / (A[3] + B[3]), Y = .05;
      const p = horiz ? new T.Vector3(A[0] + Math.sign(dx) * A[2] / 2, Y, A[1] + off) : new T.Vector3(A[0] + off, Y, A[1] + Math.sign(dz) * A[3] / 2), q = horiz ? new T.Vector3(B[0] - Math.sign(dx) * (B[2] / 2 + .35), Y, B[1] + off) : new T.Vector3(B[0] + off, Y, B[1] - Math.sign(dz) * (B[3] / 2 + .35)), m1 = horiz ? new T.Vector3((p.x + q.x) / 2, Y, p.z) : new T.Vector3(p.x, Y, (p.z + q.z) / 2), m2 = horiz ? new T.Vector3((p.x + q.x) / 2, Y, q.z) : new T.Vector3(q.x, Y, (p.z + q.z) / 2);
      const cv = new T.CubicBezierCurve3(p, m1, m2, q), mat = new T.MeshBasicMaterial({ color: col("--floor"), toneMapped: false, transparent: true }), tube = new T.Mesh(new T.TubeGeometry(cv, 40, .085, 6, false), mat), cone = new T.Mesh(new T.ConeGeometry(.3, .75, 12), mat); cone.position.copy(cv.getPoint(1)); cone.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), cv.getTangent(1)); scene.add(tube, cone); WIRE[key] = mat;
    });
    const planOf = id => { const b = STN[id].box; return { id, x: b[0] - b[2] / 2, y: b[1] - b[3] / 2, w: b[2], h: b[3] }; }, stationBox = ids => { const bb = new T.Box3(); ids.forEach(k => { const b = STN[k].box; bb.expandByPoint(new T.Vector3(b[0] - b[2] / 2, 0, b[1] - b[3] / 2)); bb.expandByPoint(new T.Vector3(b[0] + b[2] / 2, 3, b[1] + b[3] / 2)); }); return bb; };
    const center = o => o.g.position.clone().add(o.mid);

    /* flows: a ribbon traces itself, then bright packets travel along it while the step is on screen */
    let flows = [];
    function clearFlows() { flows.forEach(f => { scene.remove(f.grp); f.grp.traverse(c => { if (c.geometry && !c.geometry.userData.shared) c.geometry.dispose(); if (c.material) { if (c.material.map && c.material.map !== glowT) c.material.map.dispose(); c.material.dispose(); } }); }); flows = []; }
    const dotG = new T.SphereGeometry(1, 12, 10); dotG.userData.shared = true;
    function addFlow(fl, i) {
      const a = center(O[fl.from]), b = center(O[fl.to]), lift = fl.lift ?? (1.6 + a.distanceTo(b) * .1), m = a.clone().add(b).multiplyScalar(.5).add(new T.Vector3(0, lift, 0)), curve = new T.QuadraticBezierCurve3(a, m, b), color = col(fl.kind === "grad" ? "--bad" : fl.kind === "loop" ? "--ok" : fl.kind === "tool" ? "--out" : "--accent"), grp = new T.Group();
      const tg = new T.TubeGeometry(curve, 56, .055, 8, false), rib = new T.Mesh(tg, new T.MeshBasicMaterial({ color, transparent: true, opacity: .42, depthWrite: false, toneMapped: false })); tg.setDrawRange(0, 0); grp.add(rib);
      const cone = new T.Mesh(new T.ConeGeometry(.2, .55, 14), new T.MeshBasicMaterial({ color, toneMapped: false })), e = curve.getPoint(.97); cone.position.copy(e); cone.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), curve.getTangent(.97)); cone.visible = false; grp.add(cone);
      const parts = []; for (let k = 0; k < 3; k++) for (let j = 0; j < 6; j++) { const r = (fl.kind === "grad" ? .15 : .19) * (1 - j * .14), p = new T.Mesh(dotG, new T.MeshBasicMaterial({ color, transparent: true, opacity: 1 - j * .15, toneMapped: false })); p.scale.setScalar(r); grp.add(p); if (j === 0) { const hl = new T.Sprite(new T.SpriteMaterial({ map: glowT, color, transparent: true, opacity: .6, depthWrite: false })); hl.scale.setScalar(7); p.add(hl); } parts.push({ p, k, j }); }
      if (fl.label) { const t = text(fl.label, 1.15, { pill: true, w: 600, color: css(fl.kind === "grad" ? "--bad" : fl.kind === "loop" ? "--ok" : "--accent") }); t.position.copy(curve.getPoint(.5)).add(new T.Vector3(0, .65, 0)); grp.add(t); }
      scene.add(grp); flows.push({ curve, parts, grp, tg, cone, delay: i * 450, t0: performance.now() });
    }
    function fitTo(ids, keepAngle) {
      const bb = stationBox(ids), ctr = bb.getCenter(new T.Vector3()), asp = root.clientWidth / Math.max(1, root.clientHeight), tn = Math.tan(cam.fov * Math.PI / 360), az = keepAngle ? goal.az : 0, elv = keepAngle ? goal.el : 1.02;
      /* fit the camera to the projected corners, so the subject fills the stage at this angle */
      const fw = new T.Vector3(Math.cos(elv) * Math.sin(az), Math.sin(elv), Math.cos(elv) * Math.cos(az)), rt = new T.Vector3(Math.cos(az), 0, -Math.sin(az)), up = new T.Vector3().crossVectors(fw, rt).negate(), cs = []; [bb.min.x, bb.max.x].forEach(x => [bb.min.y, bb.max.y].forEach(y => [bb.min.z, bb.max.z].forEach(z => cs.push(new T.Vector3(x, y, z).sub(ctr)))));
      const xs = cs.map(v => v.dot(rt)), ys = cs.map(v => v.dot(up)), mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2, aim = ctr.clone().add(rt.clone().multiplyScalar(mx)).add(up.clone().multiplyScalar(my));
      let fit = 12; cs.forEach((v, i) => { const z = v.dot(fw); fit = Math.max(fit, z + Math.abs(xs[i] - mx) / (tn * asp * .97), z + Math.abs(ys[i] - my) / (tn * .93)); });
      goal.t.copy(aim); goal.dist = fit; goal.az = az; goal.el = elv; return fit;
    }
    const allIds = Object.keys(STN);
    { const rad = 70, sc = key.shadow.camera, bb = stationBox(allIds), ctr = bb.getCenter(new T.Vector3()); sc.left = sc.bottom = -rad; sc.right = sc.top = rad; sc.far = rad * 5; sc.updateProjectionMatrix(); key.target.position.copy(ctr); key.position.copy(ctr).add(new T.Vector3(rad * .55, rad * 1.5, rad * .7)); }
    function setCam() { if (follow) { const lit = [...activeSt]; touched = false; fitTo(lit.length ? lit : allIds); } else if (!touched) wholeDist = fitTo(allIds); }
    function fly(id) { fitTo([id], true); touched = true; hooks.used(); }
    function resize() { const w = root.clientWidth, h = root.clientHeight; R.setSize(w, h); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); wholeDist = Math.max(30, (() => { const s = { ...goal, t: goal.t.clone() }, f = fitTo(allIds); if (touched || follow) { Object.assign(goal, { dist: s.dist, az: s.az, el: s.el }); goal.t.copy(s.t); } return f; })()); if (!touched && !follow) { orbit.dist = goal.dist; orbit.t.copy(goal.t); } }
    let activeSt = new Set(), litExtra = new Set(), lastActive = new Set(); new ResizeObserver(resize).observe(root); resize();
    let anim = null, replay = null;
    function applySet(o, v) {
      const d = o.d;
      if (o.pts) { o.target = d.frames[v.frame ?? (o.target ? d.frames.indexOf(o.target) : 0)] || d.frames[0]; if (v.frame === undefined) o.target = d.frames[0]; }
      if (o.im) { o.hi = v.hiRows || null; const rows = v.rows ?? o.r; o.rt = o.cur.map((_, i) => i < rows ? 1 : 0); o.tgt = v.values || d.values; o.dirty = true; }
      if (o.keys) o.keys.forEach((k, i) => { const t = (v.tones || d.tones || [])[i] || ((d.hi || []).includes(i) ? "--out" : null); k.mat.color.copy(t ? col(t) : col("--surface")); });
      if (o.layers) { const up = v.upto ?? o.layers.length, sizes = v.sizes || {}; o.layers.forEach((l, i) => { l.tgt = i < up ? Math.max(.06, (sizes[i] ?? l.chars) * o.sc) : 0; l.mat.emissive.copy(col(d.layers[i].color)); l.mat.emissiveIntensity = (v.glow || []).includes(i) ? .35 : 0; }); const tot = o.layers.reduce((a, l) => a + l.tgt, 0); o.size.y = Math.max(1, tot); o.mid.set(0, o.size.y / 2, 0); }
    }
    function apply(st, s) {
      clearFlows(); let stag = 0; activeSt = new Set(st.focus.map(stationOf).filter(Boolean));
      Object.entries(SO).forEach(([k, so]) => { so.tOn = activeSt.has(k) ? 1 : 0; if (activeSt.has(k) && !lastActive.has(k)) so.flash = 1; }); lastActive = activeSt;
      Object.values(WIRE).forEach(m => m.color.copy(col("--floor"))); (s.flow || []).forEach(f => { const m = WIRE[stationOf(f.from) + ">" + stationOf(f.to)]; if (m) m.color.copy(col(f.kind === "grad" ? "--bad" : f.kind === "loop" ? "--ok" : f.kind === "tool" ? "--out" : "--accent")); });
      Object.values(O).forEach(o => { const on = st.visible.has(o.id), dim = !st.focus.includes(o.id), was = o.goal > 0; o.goal = on ? (dim ? .62 : 1) : 0; if (on && !was) { o.g.visible = true; o.born = performance.now() + stag * (calm ? 0 : 150); o.u = 0; if (o.im) { o.grow = 0; o.dirty = true; } stag++; } applySet(o, st.set[o.id] || {}); });
      anim = s.animate ? { ...s.animate, t0: performance.now() } : null;
      replay = null; const fr = s.play && s.play.frames; if (fr) Object.entries(fr[fr.length - 1].set || {}).forEach(([k, v]) => O[k] && applySet(O[k], { ...(st.set[k] || {}), ...v }));
      setCam(); (s.flow || []).forEach(addFlow);
      if (fr) { replay = { fr, ms: s.play.ms || 1300, base: st.set, t0: performance.now(), last: -1 }; if (calm) replay.t0 = -1e9; }
    }
    const viewAll = () => { touched = false; follow = false; wholeDist = fitTo(allIds); };
    let lastNow = performance.now();
    function loop(now) {
      requestAnimationFrame(loop);
      const dt = Math.min(50, now - lastNow) / 16.7; lastNow = now; const k = calm ? 1 : 1 - Math.pow(.925, dt);
      ["az", "el", "dist"].forEach(p => orbit[p] += (goal[p] - orbit[p]) * k); orbit.t.lerp(goal.t, k); hooks.view(orbit.dist < wholeDist * .78); floor.position.x = Math.round(orbit.t.x / STEP) * STEP; floor.position.z = Math.round(orbit.t.z / STEP) * STEP; catcher.position.x = orbit.t.x; catcher.position.z = orbit.t.z;
      cam.position.set(orbit.t.x + orbit.dist * Math.cos(orbit.el) * Math.sin(orbit.az), orbit.t.y + orbit.dist * Math.sin(orbit.el), orbit.t.z + orbit.dist * Math.cos(orbit.el) * Math.cos(orbit.az)); cam.lookAt(orbit.t);
      const beat = calm ? 1 : .72 + .28 * Math.sin(now / 420);
      Object.values(SO).forEach(so => { so.on += (so.tOn - so.on) * k * 2; so.sel += (so.tSel - so.sel) * k * 2; so.flash *= Math.pow(.965, dt); const v = Math.max(so.on * beat, so.sel); so.rimM.opacity = Math.min(1, v + so.flash * .4); so.rimM.color.copy(so.sel > .5 ? col("--pos") : col("--accent")); so.idle.material.opacity = 1 - so.on; so.hot.material.opacity = so.on; });
      Object.values(O).forEach(o => {
        if (!o.g.visible) return; if (o.born && now < o.born) return;
        o.op += (o.goal - o.op) * (calm ? 1 : 1 - Math.pow(.86, dt));
        if (o.u < 1) { o.u = calm ? 1 : Math.min(1, o.u + dt / 34); }
        const pop = o.im ? 1 : (o.d.type === "tower" ? 1 : backOut(o.u)); o.g.scale.setScalar(Math.max(.001, pop)); o.g.position.y = o.y0 + (1 - o.u) * (1 - o.u) * (o.im ? 0 : -.7);
        o.mats.forEach(m => m.opacity = o.op * (m.userData.k ?? 1)); if (o.goal === 0 && o.op < .01) o.g.visible = false;
        if (o.pts) { if (o.target) o.frame = o.frame.map((p, i) => p.map((v, j) => v + (o.target[i][j] - v) * (calm ? 1 : 1 - Math.pow(.91, dt)))); o.pts.forEach(({ s, b }, i) => { const [x, y, z] = o.frame[i].map(v => v * o.sc * (o.d.fit || 1)); s.position.set(x, y + .12, z); b.position.set(x, y, z); }); }
        if (o.im) {
          if (o.grow < 1) { o.grow = Math.min(1, o.grow + dt / 58); o.dirty = true; }
          o.rf = o.rf.map((v, i) => { const n = v + (o.rt[i] - v) * (calm ? 1 : 1 - Math.pow(.88, dt)); if (Math.abs(n - v) > .002) o.dirty = true; return Math.abs(n - o.rt[i]) < .004 ? o.rt[i] : n; });
          if (o.tgt) { let mv = 0; o.cur = o.cur.map((r, i) => r.map((v, j) => { const n = v + (o.tgt[i][j] - v) * (calm ? 1 : .08 * dt); mv = Math.max(mv, Math.abs(n - v)); return n; })); if (mv > 1e-3) o.dirty = true; else if (o.tgt !== o.lastTgt) { o.dirty = true; o.lastTgt = o.tgt; } }
          if (o.dirty) { paintSlab(o, calm ? 1 : o.grow); o.dirty = false; }
        }
        if (o.layers) { let y = 0; o.layers.forEach(l => { l.h += (l.tgt - l.h) * (calm ? 1 : 1 - Math.pow(.9, dt)); const on = l.h > .01; l.m.visible = on; if (on) { l.m.scale.y = Math.max(.01, l.h - .05); l.m.position.y = y + l.h / 2; } if (l.lb) { l.lb.visible = l.h > .12; l.lb.position.set(o.w / 2 + .9 + l.lb.scale.x / 2, y + l.h / 2, 0); } y += l.h; }); }
      });
      if (anim) { const n = anim.frames, i = calm ? n - 1 : Math.max(0, Math.floor((now - anim.t0) / anim.ms)) % (n + 10), f = Math.min(i, n - 1), c = O[anim.cloud], cv = O[anim.curve]; if (c) c.target = c.d.frames[f]; if (cv) { const it = anim.iters[f], P = cv.d.points, cut = Math.max(0, P.findIndex(p => p[0] >= it)), u = cut / Math.max(1, P.length - 1); cv.curve.lg.setDrawRange(0, Math.floor(cv.curve.total * u / 6) * 6); cv.dot.position.copy(cv.curve.pts[cut]); } $("cap").textContent = anim.caps[f]; }
      else Object.values(O).forEach(o => { if (o.curve && o.g.visible) { o.curve.lg.setDrawRange(0, o.curve.total); o.dot.position.copy(o.curve.pts[o.curve.pts.length - 1]); } });
      if (replay) { const n = replay.fr.length, raw = Math.floor((now - replay.t0) / replay.ms), f = calm ? n - 1 : Math.min(n - 1, raw % (n + 2)); if (f !== replay.last) { replay.last = f; const fm = replay.fr[f]; Object.entries(fm.set || {}).forEach(([k, v]) => O[k] && applySet(O[k], { ...(replay.base[k] || {}), ...v })); if (fm.cap) $("cap").textContent = fm.cap; } }
      flows.forEach(f => {
        const tr = calm ? 1 : clamp((now - f.t0 - f.delay) / 650); f.tg.setDrawRange(0, Math.floor(f.tg.index.count * tr / 6) * 6); f.cone.visible = tr >= 1;
        f.parts.forEach(({ p, k: c, j }) => { if (calm) { p.visible = false; return; } const u = (now - f.t0 - f.delay - 500) / 2100 - c * .36 - j * .022; if (u < 0) { p.visible = false; return; } const w = u % 1.15; p.visible = w <= 1; if (w <= 1) p.position.copy(f.curve.getPoint(w)); });
      });
      R.render(scene, cam);
    }
    requestAnimationFrame(loop);
    return {
      apply, stations: () => allIds.map(planOf), viewScale: () => goal.dist, onMap: () => allIds.filter(k => SO[k].g.visible), screenOf: id => { const b = STN[id].box, v = new T.Vector3(b[0], .1, b[1] + b[3] * .2).project(cam), r = el.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, objectAt: id => { const o = O[id], v = center(o).project(cam), r = el.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, fly, follow: b => { follow = b; touched = false; if (b) setCam(); else viewAll(); }, fit: viewAll,
      zoom: f => zoomBy(f), lit: ids => { litExtra = new Set(ids); Object.entries(SO).forEach(([k, so]) => so.tSel = litExtra.has(k) ? 1 : 0); }, canTurn: true, turn: b => { turning = b; }
    };
  }

  /* ---------- 2D stage: rounded cards on a dotted table, with labelled packets moving along the wires ---------- */
  function Stage2D(root) {
    const NS = "http://www.w3.org/2000/svg", W = L.stage.world.w, H = L.stage.world.h, svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", `0 0 ${W} ${H}`); const view = { x: 0, y: 0, w: W, h: H }, vg = { x: 0, y: 0, w: W, h: H }; let touched = false, follow = false, drag = null, active = new Set(); const ptr = new Map(); svg.setAttribute("preserveAspectRatio", "xMidYMid meet"); root.appendChild(svg);
    const E = (t, a, p, x) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (x !== undefined) e.textContent = x; (p || svg).appendChild(e); return e; };
    const ROLE = { user: "--accent", app: "--ink", data: "--in", model: "--tf", tool: "--out", external: "--warn" }, FLOW = { loop: "--ok", tool: "--out", grad: "--bad" };
    E("defs", {}, svg).innerHTML = `<pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="var(--floor)" opacity=".55"/></pattern>${["--accent", "--ok", "--out", "--bad", "--floor"].map(c => `<marker id="arr${c}" markerUnits="userSpaceOnUse" markerWidth="13" markerHeight="13" refX="10" refY="5" orient="auto"><path d="M0 0 11 5 0 10z" fill="var(${c})"/></marker>`).join("")}`;
    E("rect", { x: -2 * W, y: -2 * H, width: 5 * W, height: 5 * H, fill: "url(#dots)" }, svg);
    const groups = E("g", {}), wires = E("g", {}), edges = E("g", {}), nodes = E("g", {}), packets = E("g", {}), O = {};
    const IC = { user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0", data: "M4 6c0-3 16-3 16 0s-16 3-16 0v12c0 3 16 3 16 0V6M4 12c0 3 16 3 16 0", model: "M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4", tool: "M15 5a4 4 0 0 0-5 5L4 16l4 4 6-6a4 4 0 0 0 5-5l-3 3-3-1-1-3z", app: "M3 5h18v14H3zM3 9h18", external: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" };
    const wrap = (t, n) => { const out = []; let l = ""; String(t).split(" ").forEach(w => { if ((l + " " + w).trim().length > n) { out.push(l); l = w; } else l = (l + " " + w).trim(); }); if (l) out.push(l); return out; };
    Object.entries(L.stage.objects).forEach(([id, d]) => {
      const g = E("g", d.type === "group" ? { opacity: 1 } : { "data-st": id, opacity: .72, style: "transition:opacity .4s" }, d.type === "group" ? groups : nodes); O[id] = { g, d };
      if (d.type === "group") { const c = d.color ? `var(${d.color})` : "var(--muted)"; E("rect", { x: d.x, y: d.y, width: d.w, height: d.h, rx: 18, fill: `color-mix(in srgb,${c} 7%,transparent)` }, g); E("text", { x: d.x + 16, y: d.y + 27, style: `font:600 15px var(--mono);fill:${c}` }, g, d.label); return; }
      if (d.type === "stack") {
        E("text", { x: d.x, y: d.y - 12, style: "font:700 21px var(--display);fill:var(--ink)" }, g, d.label); E("rect", { x: d.x - 6, y: d.y - 6, width: d.w + 12, height: d.h + 10, rx: 12, fill: "var(--surface)" }, g); O[id].edge = E("rect", { x: d.x - 6, y: d.y - 6, width: d.w + 12, height: d.h + 10, rx: 12, fill: "none", stroke: "var(--accent)", "stroke-width": 0, style: "transition:stroke-width .25s" }, g); O[id].segs = {}; O[id].sizes = {};
        d.items.forEach(s => { const sg = E("g", { "data-seg": s.id, style: "transition:opacity .35s,transform .55s cubic-bezier(.2,.8,.2,1)" }, g), r = E("rect", { x: d.x, y: 0, rx: 8, width: d.w, height: 34, fill: `color-mix(in srgb,${s.color} 24%,var(--surface))`, style: "transition:height .55s cubic-bezier(.2,.8,.2,1)" }, sg); E("text", { x: d.x + 12, y: 23, style: "font:600 14px var(--mono);fill:var(--ink)" }, sg, s.label); E("text", { x: d.x + d.w - 11, y: 23, "text-anchor": "end", style: "font:12.5px var(--mono);fill:var(--muted)" }, sg, s.size); O[id].segs[s.id] = sg; O[id].sizes[s.id] = r; });
        O[id].layout = list => { const items = d.items.filter(s => !list || list.includes(s.id)), tot = d.fixed ? d.items.reduce((a, s) => a + s.chars, 0) : items.reduce((a, s) => a + s.chars, 0), minH = 34, free = d.h - minH * (d.fixed ? d.items.length : items.length); let y = d.y; d.items.forEach(s => { const on = items.includes(s), sg = O[id].segs[s.id]; sg.style.display = on ? "" : "none"; if (!on) return; const h = minH + free * s.chars / tot; sg.style.transform = `translateY(${y}px)`; O[id].sizes[s.id].setAttribute("height", h - 4); O[id].sizes[s.id].style.height = (h - 4) + "px"; y += h; }); };
        O[id].layout(null); return;
      }
      const c = `var(${ROLE[d.role] || "--ink"})`; E("rect", { x: d.x, y: d.y, width: d.w, height: d.h, rx: 14, fill: "var(--surface)" }, g); O[id].edge = E("rect", { x: d.x, y: d.y, width: d.w, height: d.h, rx: 14, fill: "none", stroke: "var(--accent)", "stroke-width": 0, style: "transition:stroke-width .25s" }, g);
      E("circle", { cx: d.x + 27, cy: d.y + 28, r: 17, fill: `color-mix(in srgb,${c} 14%,transparent)` }, g);
      if (IC[d.role]) { const ic = E("g", { transform: `translate(${d.x + 17.4},${d.y + 18.4}) scale(.8)` }, g); E("path", { d: IC[d.role], fill: "none", stroke: c, "stroke-width": 1.9, "stroke-linejoin": "round", "stroke-linecap": "round" }, ic); }
      E("text", { x: d.x + 53, y: d.y + 34, style: "font:700 19px var(--sans);fill:var(--ink)" }, g, d.label); wrap(d.sub || "", Math.floor((d.w - 26) / 8.2)).slice(0, 3).forEach((l, i) => E("text", { x: d.x + 14, y: d.y + 66 + i * 19, style: "font:14px var(--sans);fill:var(--muted)" }, g, l));
    });
    const center = d => [d.x + d.w / 2, d.y + d.h / 2];
    const anchor = (a, b) => { const [ax, ay] = center(a), [bx, by] = center(b), dx = bx - ax, dy = by - ay; return Math.abs(dx) / (a.w + b.w) > Math.abs(dy) / (a.h + b.h) ? [[ax + Math.sign(dx) * a.w / 2, ay], [bx - Math.sign(dx) * b.w / 2, by]] : [[ax, ay + Math.sign(dy) * a.h / 2], [bx, by - Math.sign(dy) * b.h / 2]]; };
    const pathOf = (A, B) => { const [p, q] = anchor(A, B), mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; return Math.abs(q[0] - p[0]) > Math.abs(q[1] - p[1]) ? `M${p} C${mx},${p[1]} ${mx},${q[1]} ${q}` : `M${p} C${p[0]},${my} ${q[0]},${my} ${q}`; };
    const wireKeys = new Set((L.stage.edges || []).map(e => e[0] + ">" + e[1])); L.steps.forEach(s => (s.flow || []).forEach(f => wireKeys.add(f.from + ">" + f.to)));
    wireKeys.forEach(k => { const [a, b] = k.split(">"); E("path", { d: pathOf(O[a].d, O[b].d), fill: "none", stroke: "var(--floor)", "stroke-width": 2, "marker-end": "url(#arr--floor)" }, wires); });
    /* zoom and pan: the view eases toward its goal */
    const paint = () => { let moving = false; ["x", "y", "w", "h"].forEach(k => { const d = vg[k] - view[k]; if (Math.abs(d) > .3) { view[k] += d * (calm ? 1 : .22); moving = true; } else view[k] = vg[k]; }); svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`); hooks.view(view.w < W * .78); if (moving) requestAnimationFrame(paint); else painting = false; }; let painting = false; const kick = () => { if (!painting) { painting = true; requestAnimationFrame(paint); } };
    const toSvg = e => { const b = svg.getBoundingClientRect(), s = Math.max(view.w / b.width, view.h / b.height), cx = view.x + view.w / 2, cy = view.y + view.h / 2; return [cx + (e.clientX - b.left - b.width / 2) * s, cy + (e.clientY - b.top - b.height / 2) * s]; };
    const zoomBy = (f, e) => { const nw = clamp(vg.w * f, W * .16, W * 1.5), r = nw / vg.w, nh = vg.h * r, [px, py] = e ? toSvg(e) : [vg.x + vg.w / 2, vg.y + vg.h / 2]; vg.x = px - (px - vg.x) * r; vg.y = py - (py - vg.y) * r; vg.w = nw; vg.h = nh; touched = true; hooks.used(); kick(); };
    const fitIds = ids => { const bs = ids.map(k => O[k].d), pad = 46, x0 = Math.min(...bs.map(d => d.x)) - pad, y0 = Math.min(...bs.map(d => d.y)) - pad - 20, x1 = Math.max(...bs.map(d => d.x + d.w)) + pad, y1 = Math.max(...bs.map(d => d.y + d.h)) + pad, b = svg.getBoundingClientRect(), asp = (b.width || 1) / (b.height || 1); let w = x1 - x0, h = y1 - y0; if (w / h < asp) w = h * asp; else h = w / asp; vg.x = (x0 + x1) / 2 - w / 2; vg.y = (y0 + y1) / 2 - h / 2; vg.w = w; vg.h = h; kick(); };
    const allIds = Object.keys(STN), viewAll = () => { touched = false; follow = false; vg.x = 0; vg.y = 0; vg.w = W; vg.h = H; kick(); };
    const hitOf = e => { const t = e.target.closest && e.target.closest("[data-st]"); if (!t) return null; const id = t.dataset.st, d = O[id].d, sg = e.target.closest("[data-seg]"); if (sg && d.items) { const x = d.items.find(i => i.id === sg.dataset.seg), head = `${x.label}\n${x.size}`; return { station: id, tip: head + "\nClick to read it", point: head + (x.text ? "\n\n" + x.text : "") }; } return { station: id, tip: `${d.label}\nClick for its files and data` }; };
    svg.addEventListener("pointerdown", e => { ptr.set(e.pointerId, e); svg.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, moved: false, hit: hitOf(e) }; hooks.hover(null); if (ptr.size === 2) { const [a, b] = [...ptr.values()]; drag.pinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); } });
    svg.addEventListener("pointermove", e => { if (ptr.has(e.pointerId)) ptr.set(e.pointerId, e); if (!drag) { const h = hitOf(e); hooks.hover(h ? h.tip : null, e); return; } if (ptr.size === 2 && drag.pinch) { const [a, b] = [...ptr.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); if (d > 0) zoomBy(drag.pinch / d); drag.pinch = d; drag.moved = true; return; } const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!drag.moved && Math.hypot(dx, dy) < 4) return; drag.moved = true; drag.x = e.clientX; drag.y = e.clientY; const b = svg.getBoundingClientRect(), s = Math.max(view.w / b.width, view.h / b.height); vg.x -= dx * s; vg.y -= dy * s; touched = true; hooks.used(); kick(); });
    const rel = e => { ptr.delete(e.pointerId); if (!drag) return; const was = drag; if (ptr.size === 0) drag = null; if (!was.moved && e.type === "pointerup") hooks.pick(was.hit); };
    svg.addEventListener("pointerup", rel); svg.addEventListener("pointercancel", rel); svg.addEventListener("pointerleave", () => hooks.hover(null));
    svg.addEventListener("wheel", e => { e.preventDefault(); zoomBy(Math.exp(e.deltaY * (e.ctrlKey ? .01 : .0014)), e); }, { passive: false });
    svg.addEventListener("dblclick", e => { const h = hitOf(e); if (h) { fitIds([h.station]); touched = true; } });
    let run = [], litSet = new Set();
    const paintLit = () => Object.entries(O).forEach(([k, o]) => { if (o.edge) { const sel = litSet.has(k), hot = active.has(k); o.edge.setAttribute("stroke", sel ? "var(--pos)" : "var(--accent)"); o.edge.setAttribute("stroke-width", sel || hot ? 3 : 0); o.edge.classList.toggle("pulse", hot && !sel); if (o.d.type !== "group") o.g.setAttribute("opacity", sel || hot ? 1 : .72); } });
    function apply(st, s) {
      run.forEach(r => r.stop = true); run = []; packets.innerHTML = ""; edges.innerHTML = ""; active = new Set(st.focus);
      Object.entries(O).forEach(([k, o]) => { if (o.layout) o.layout((st.set[k] || {}).items || (st.ever.has(k) ? null : [])); if (o.segs) Object.entries(o.segs).forEach(([id, sg]) => sg.style.opacity = s.segs && !s.segs.includes(id) ? .3 : 1); }); paintLit();
      if (follow) fitIds(st.focus.length ? st.focus : allIds);
      (s.flow || []).forEach((f, i) => {
        const cv = FLOW[f.kind] || "--accent", p = E("path", { d: pathOf(O[f.from].d, O[f.to].d), fill: "none", stroke: `var(${cv})`, "stroke-width": 2.6, "marker-end": `url(#arr${cv})`, opacity: .55 }, edges), len = p.getTotalLength();
        const pk = E("g", { opacity: 0 }, packets), lab = f.label || "", w = lab.length * 8.7 + 22; E("rect", { x: -w / 2, y: -14, width: w, height: 28, rx: 14, fill: `var(${cv})` }, pk); E("text", { "text-anchor": "middle", y: 5, style: "font:600 14px var(--mono);fill:var(--surface)" }, pk, lab);
        const r = { stop: false }; run.push(r); const t0 = performance.now() + i * 1100; p.style.strokeDasharray = len; p.style.strokeDashoffset = calm ? 0 : len;
        const tick = now => { if (r.stop) return; const el = now - t0; p.style.strokeDashoffset = calm ? 0 : len * (1 - clamp(el / 500)); const raw = calm ? .5 : Math.max(0, (el / 2400) % 1.2), u = Math.min(1, raw), e = u * u * (3 - 2 * u), q = p.getPointAtLength(e * len); pk.setAttribute("transform", `translate(${q.x},${q.y})`); pk.setAttribute("opacity", el < 0 ? 0 : raw > 1.12 ? 0 : 1); if (!calm) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      });
    }
    return { apply, viewScale: () => vg.w, onMap: () => allIds.filter(k => O[k].g.getBoundingClientRect().width > 0 && +O[k].g.getAttribute("opacity") > 0), screenOf: id => { const r = O[id].g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, stations: () => allIds.map(k => { const d = O[k].d; return { id: k, x: d.x, y: d.y, w: d.w, h: d.h }; }), fly: id => { fitIds([id]); touched = true; }, follow: b => { follow = b; if (b) fitIds([...active]); else viewAll(); }, fit: viewAll, zoom: f => zoomBy(f), lit: ids => { litSet = new Set(ids); paintLit(); } };
  }

  /* ---------- boot ---------- */
  function boot() {
    $("q").textContent = L.question; $("q").title = L.question; $("kicker").innerHTML = `<b>Teachable Code</b> · ${esc(L.repo.name)} @ ${esc(L.repo.commit.slice(0, 7))}`;
    $("limits").innerHTML = `<p><b>What this page rests on.</b></p>${L.limits.map(x => `<p>${esc(x)}</p>`).join("")}<p><span class="badge ran">ran</span> recorded from a real execution. <span class="badge read">read from code</span> taken from the source without running it. <span class="badge illustrative">example</span> written to show the shape.</p>`;
    $("bLimits").onclick = () => { const h = !$("limits").hidden; $("limits").hidden = h; $("bLimits").setAttribute("aria-expanded", String(!h)); $("bLimits").classList.toggle("on", !h); };
    $("legend").innerHTML = (L.stage.legend || []).map(x => `<span><i style="background:var(${x[1]})"></i>${esc(x[0])}</span>`).join("");
    try { if (is3D) { if (window.THREE) stage = Stage3D($("stage")); } else stage = Stage2D($("stage")); } catch (e) { console.error(e); stage = null; }
    if (!stage) { $("stage").innerHTML = `<div id="fallback"><div><b>The 3D view could not start in this browser.</b><br>Every step's data, explanation and code are still here.</div></div>`; $("zoombar").hidden = true; $("hint").classList.add("off"); }
    else {
      $("hint").textContent = is3D ? "Scroll to zoom · drag to move · click anything" : "Scroll to zoom · drag to move · click any part"; setTimeout(() => $("hint").classList.add("off"), 7000);
      $("zIn").onclick = () => stage.zoom(.72); $("zOut").onclick = () => stage.zoom(1.38);
      const setFollow = b => { $("zFollow").classList.toggle("on", b); $("zFollow").setAttribute("aria-pressed", String(b)); stage.follow(b); };
      $("zFit").onclick = () => setFollow(false); $("zFollow").onclick = () => setFollow(!$("zFollow").classList.contains("on"));
      if (stage.turn) { $("zTurn").hidden = false; $("zTurn").onclick = () => { const b = !$("zTurn").classList.contains("on"); $("zTurn").classList.toggle("on", b); $("zTurn").setAttribute("aria-pressed", String(b)); stage.turn(b); }; }
    }
    $("where").onclick = () => { const c = L.steps[cur].code; if (c) openFile(c.f); };
    $("bPrev").onclick = () => go(cur - 1); $("bNext").onclick = () => go(cur + 1); $("bPlay").onclick = () => { if (!playing && cur >= L.steps.length - 1) go(0); setPlay(!playing); };
    $("bSpeed").onclick = () => { speed = speed === 1 ? 2 : speed === 2 ? .5 : 1; $("bSpeed").textContent = speed + "×"; schedule(); };
    $("bGuess").onclick = () => { guess = !guess; $("bGuess").classList.toggle("on", guess); show(cur); };
    addEventListener("keydown", e => { if (/INPUT|TEXTAREA/.test(e.target.tagName)) return; if (e.key === "ArrowRight") go(cur + 1); if (e.key === "ArrowLeft") go(cur - 1); if (e.key === "Escape") { if (inspect) closeInspect(); $("limits").hidden = true; $("bLimits").classList.remove("on"); } if (stage && (e.key === "+" || e.key === "=")) stage.zoom(.72); if (stage && e.key === "-") stage.zoom(1.38); if (stage && e.key === "0") $("zFit").click(); });
    const reload = () => { try { location.reload(); } catch (e) {} }; if (stage && L.stage.mode === "3d") { matchMedia("(prefers-color-scheme:dark)").addEventListener("change", reload); new MutationObserver(reload).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); }
    setPlay(false); const h = /^#step-(\d+)$/.exec(location.hash); show(h ? Math.min(L.steps.length, +h[1]) - 1 : 0);
    window.__lesson = { go, count: L.steps.length, mode: L.stage.mode, has3d: !!stage, stations: Object.keys(STN), openFile, stage };
  }
  const fonts = document.fonts && document.fonts.load ? Promise.all(['700 64px "Bricolage Grotesque"', '500 64px "JetBrains Mono"', '600 64px "JetBrains Mono"', '700 64px "JetBrains Mono"'].map(f => document.fonts.load(f))) : Promise.resolve();
  Promise.race([fonts, new Promise(r => setTimeout(r, 1500))]).catch(() => {}).then(boot);
})();
