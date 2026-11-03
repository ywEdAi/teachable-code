/* VIEWS.directory: the repo's real folder tree next to the workflow stages.
   opts = {
     repo: "seal",                       // key in GH (for GitHub links)
     inventory: [{path, lines, defs:[[name, line]], files?}],   // from scripts/inventory.py
     stages: [[id, label, group]],       // group: any string; "side" = not on the main path
     map: [[RegExp, [stageId, ...]]],    // first match wins; unmatched files go to "side"
     groupLabels: {group: "short tag"},  // shown at the right of each stage box
     flowGraph: "seal",                  // graph id to jump to when a stage id is also a node there
     sideNote: "why gray files can wait",
     tours: [{name, intro, stages:[stageId...]}]   // scenarios: step through stages
   } */
VIEWS.directory = function(opts){
  return function(ctx){
    const inv = opts.inventory.filter(f => !/(^|\/)README\.md$/.test(f.path));
    const STAGES = opts.stages, MAP = opts.map, GL = opts.groupLabels || {};
    const stageOf = p => { for (const [re, s] of MAP) if (re.test(p)) return s; return ["side"]; };
    if (!STAGES.some(s => s[0] === "side")) STAGES.push(["side", "其他 / 可以先不读", "side"]);
    const sorted = inv.slice().sort((a, b) => a.path.localeCompare(b.path));
    const tops = [...new Set(sorted.map(f => f.path.split("/")[0]))];
    const size = {}; sorted.forEach(f => { const t = f.path.split("/")[0]; size[t] = (size[t] || 0) + 1 + (f.path.split("/").length - 1) * .3; });
    const colOfTop = {}, load = [0, 0]; tops.slice().sort((a, b) => size[b] - size[a]).forEach(t => { const c = tops.length === 1 ? 1 : (load[0] <= load[1] ? 0 : 1); colOfTop[t] = c; load[c] += size[t]; });
    const rowsByCol = [[], []], seen = new Set();
    sorted.forEach(f => {
      const parts = f.path.replace(/\/$/, "").split("/"), c = colOfTop[parts[0]], rows = rowsByCol[c];
      for (let d = 0; d < parts.length - 1; d++){ const dir = parts.slice(0, d + 1).join("/"); if (!seen.has(dir)){ seen.add(dir); rows.push({ dir: true, name: parts[d] + "/", depth: d, path: dir, col: c }); } }
      rows.push({ dir: false, name: parts[parts.length - 1] + (f.path.endsWith("/") ? "/" : ""), depth: parts.length - 1, path: f.path, lines: f.lines, defs: f.defs || [], files: f.files, stages: stageOf(f.path), col: c });
    });
    const rows = [...rowsByCol[0], ...rowsByCol[1]];
    const RH = 27, maxL = Math.max(1, ...inv.map(f => f.lines || 0)), BARW = 130, NAMEW = 300, SW = 300;
    const COLX = [30, 1130], SX = rowsByCol[0].length ? 640 : 40;
    if (!rowsByCol[0].length) COLX[1] = SX + SW + 160;
    const nRows = Math.max(rowsByCol[0].length, rowsByCol[1].length);
    const sy = i => 70 + i * Math.max(46, (nRows * RH - 40) / STAGES.length);
    const rowY = r => 50 + rowsByCol[r.col].indexOf(r) * RH;
    const g = ctx.g; let rowEls = {}, linkEls = [], stEls = {};
    const isSide = s => s === "side" || (STAGES.find(t => t[0] === s) || [])[2] === "side";
    function build(){
      g.innerHTML = ""; rowEls = {}; linkEls = []; stEls = {};
      const linkG = ctx.el("g", {}, g);
      rows.forEach(r => {
        const y = rowY(r), x0 = COLX[r.col] + r.depth * 16, rg = ctx.el("g", { style: "cursor:pointer" }, g);
        if (r.dir){ ctx.el("text", { x: x0, y: y + 18, class: "cvtext", "font-size": "16", "font-weight": "700" }, rg, r.name); return; }
        const side = isSide(r.stages[0]), bx = COLX[r.col] + NAMEW;
        ctx.el("rect", { x: COLX[r.col] - 4, y: y + 2, width: NAMEW + BARW + 70, height: RH - 4, rx: 4, fill: "transparent", class: "rowbg" }, rg);
        ctx.el("text", { x: x0, y: y + 18, class: "cvtext", "font-size": "15", style: `font-family:var(--mono);${side ? "fill:var(--muted)" : ""}` }, rg, r.name);
        if (r.lines){ const w = Math.max(2, r.lines / maxL * BARW); ctx.el("rect", { x: bx, y: y + 7, width: w, height: 13, rx: 3, fill: side ? "var(--line)" : "var(--c0)", opacity: side ? 1 : .6 }, rg); ctx.el("text", { x: bx + w + 6, y: y + 18, class: "cvmuted", style: "font-size:12px" }, rg, r.lines); }
        if (r.files) ctx.el("text", { x: bx, y: y + 18, class: "cvmuted", style: "font-size:12px" }, rg, r.files + " 个文件");
        rowEls[r.path] = rg; rg.addEventListener("click", () => pickFile(r));
        r.stages.forEach(s => { const si = STAGES.findIndex(t => t[0] === s), ty = sy(si) + 19;
          const fromX = r.col === 0 ? bx + BARW + 60 : COLX[1] - 8, toX = r.col === 0 ? SX - 6 : SX + SW + 6;
          const p = ctx.el("path", { d: `M${fromX},${y + RH / 2} C${(fromX + toX) / 2},${y + RH / 2} ${(fromX + toX) / 2},${ty} ${toX},${ty}`, fill: "none", stroke: side ? "var(--line)" : "var(--c0)", "stroke-width": 1.4, opacity: .35 }, linkG);
          p.dataset.f = r.path; p.dataset.s = s; linkEls.push(p); });
      });
      STAGES.forEach(([id, label, grp], i) => {
        const y = sy(i), sg = ctx.el("g", { style: "cursor:pointer" }, g), gi = Object.keys(GL).indexOf(grp);
        ctx.el("rect", { x: SX, y, width: SW, height: 38, rx: 8, fill: grp === "side" ? "var(--sunk)" : `color-mix(in srgb,var(--c${Math.max(0, gi) % 4}) 13%,var(--surface))`, stroke: "var(--line)", "stroke-width": 1.5 }, sg);
        ctx.el("text", { x: SX + 14, y: y + 25, class: "cvtext", "font-size": "16" }, sg, label);
        ctx.el("text", { x: SX + SW - 10, y: y + 25, "text-anchor": "end", class: "cvmuted", style: "font-size:12px" }, sg, GL[grp] || "");
        stEls[id] = sg; sg.addEventListener("click", () => pickStage(id));
      });
    }
    function highlight(files, stages){
      linkEls.forEach(p => { const on = (files && files.includes(p.dataset.f)) || (stages && stages.includes(p.dataset.s) && (!files || files.includes(p.dataset.f)));
        p.setAttribute("opacity", on ? 1 : .08); p.setAttribute("stroke-width", on ? 2.6 : 1.2); p.setAttribute("stroke", on ? "var(--lit)" : isSide(p.dataset.s) ? "var(--line)" : "var(--c0)"); });
      Object.entries(rowEls).forEach(([p, e]) => { const bg = e.querySelector(".rowbg"); if (bg) bg.setAttribute("fill", files && files.includes(p) ? "color-mix(in srgb,var(--lit) 16%,transparent)" : "transparent"); });
      Object.entries(stEls).forEach(([s, e]) => e.querySelector("rect").setAttribute("stroke", stages && stages.includes(s) ? "var(--lit)" : "var(--line)"));
    }
    function pickStage(id){
      const files = rows.filter(r => !r.dir && r.stages.includes(id)).map(r => r.path); highlight(files, [id]);
      const st = STAGES.find(s => s[0] === id); ctx.visit("stage:" + id, st[1]);
      const canJump = opts.flowGraph && GRAPHS[opts.flowGraph] && GRAPHS[opts.flowGraph].nodes.some(n => n.id === id);
      ctx.inspect(`<span class="kchip">流程步骤</span><h2>${escD(st[1])}</h2><p>落在 ${files.length} 个文件里：</p>${filesHtml(files.map(p => ({ p })), opts.repo)}${id === "side" && opts.sideNote ? `<p class="hint">${opts.sideNote}</p>` : ""}${canJump ? `<button class="btn" id="jb">→ 在流程图里看这一步</button>` : ""}`);
      const jb = document.getElementById("jb"); if (jb) jb.onclick = () => ctx.jump(opts.flowGraph, id);
      return `${st[1]}：${files.map(f => f.split("/").pop()).join("、") || "（没有文件）"}`;
    }
    function pickFile(r){
      highlight([r.path], r.stages); ctx.visit("file:" + r.path, r.name);
      ctx.inspect(`<span class="kchip">文件</span><h2 class="mono" style="font-size:15px;overflow-wrap:anywhere">${escD(r.path)}</h2>
        <div class="io"><b>行数</b><span>${r.lines || "—"}</span><b>属于</b><span>${r.stages.map(s => (STAGES.find(t => t[0] === s) || [s, s])[1]).join("、")}</span></div>
        ${r.defs.length ? `<span class="label">顶层函数和类</span>${filesHtml(r.defs.map(([n, l]) => ({ p: r.path, a: l, what: n })), opts.repo)}` : ""}
        ${isSide(r.stages[0]) && opts.sideNote ? `<p class="hint">${opts.sideNote}</p>` : ""}`);
    }
    const SC = (opts.tours || []).map(t => ({ name: t.name, intro: t.intro, steps: t.stages.map(id => () => pickStage(id)) }));
    let si = 0, k = 0;
    return { names: SC.map(s => s.name), select(i){ si = i; this.reset(); }, reset(){ k = 0; build(); if (SC[si]) ctx.caption(SC[si].intro, `0 / ${SC[si].steps.length}`); },
      done(){ return !SC[si] || k >= SC[si].steps.length; },
      async step(){ const S = SC[si].steps; if (k >= S.length) return false; const m = S[k++](); ctx.caption(m, `${k} / ${S.length}`); await ctx.sleep(900 / ctx.speed()); return k < S.length; } };
  };
};
