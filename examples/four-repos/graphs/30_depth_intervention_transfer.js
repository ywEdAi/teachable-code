/* ======================= v3: depth, paper→code, intervention, patterns, method ======================= */
const S2 = RUN.seal2;               // estep (real ReST-EM data), levers, inventory
const EX = S2.estep.example;        // Crimean War, iter0, real
const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/* ---------- SEAL: real AI I/O on the self-edit node ---------- */
(function(){
  const g = GRAPHS.seal;
  const gen = g.nodes.find(n => n.id === "gen");
  const comps = EX.completions;
  gen.aiio = {
    input: { text: EX.prompt, prov: "data", note: "SEAL 仓库提交的第 0 轮训练结果里，第一篇文章（Crimean War）真实用到的提示词。" },
    output: { text: comps.map((c, i) => `【self-edit ${i + 1}】奖励 ${c.stats.adapter_mean.toFixed(3)}（基线 ${c.stats.baseline_mean.toFixed(2)}）\n` + short(c.text, 260)).join("\n\n"), prov: "data", note: "同一个提示词采样出的 5 个真实 self-edit。第 2 个退化成了重复的关键词列表。" },
    parsed: { text: `_top_k(按 adapter_mean 排序取第 1 个) → self-edit ${EX.picked + 1}\n\n第 2、3 个奖励并列 0.333；Python 的排序是稳定的，并列时保留原顺序，所以选中了退化的第 2 个。`, prov: "run", note: "用仓库自己的 build_SFT_dataset._top_k 在这份真实数据上实跑。" }
  };
  gen.role = "让模型读一篇文章，写出它的“推论”。每篇文章采样 5 个，后面比较哪个最有用。";
  const files = {
    gen: [{p:"general-knowledge/src/data_generation/make_squad_data.py", a:70, what:"make_prompt：拼提示词"}, {p:"general-knowledge/scripts/make_squad_data.sh", what:"k=5、T=1.0 的启动脚本"}],
    seqs: [{p:"general-knowledge/src/utils.py", a:193, what:"build_train_sequences"}],
    lora: [{p:"general-knowledge/src/inner/TTT_server.py", a:252, what:"分词、labels、LoRA 训练"}, {p:"general-knowledge/scripts/TTT_server.sh", what:"两张卡：vLLM + 训练"}],
    ans: [{p:"general-knowledge/src/inner/TTT_server.py", a:67, what:"accuracy_and_texts：挂 adapter 答题"}],
    grade: [{p:"general-knowledge/src/utils.py", a:153, what:"grade_with_gpt4"}],
    reward: [{p:"general-knowledge/src/query/query_server.py", a:128, what:"evaluate_completion：3 次平均"}],
    select: [{p:"general-knowledge/src/EM/build_SFT_dataset.py", a:20, what:"_top_k"}],
    sft: [{p:"general-knowledge/src/EM/train_SFT.py", a:62, what:"LoRA r64 + SFTTrainer + merge"}, {p:"general-knowledge/scripts/train_SFT.sh", what:"2 卡 DeepSpeed ZeRO-3"}]
  };
  g.nodes.forEach(n => { if (files[n.id]) n.files = files[n.id]; });

  /* knowledge layer */
  g.world = { w: 1600, h: 1240 };
  g.groups.push({ x: 20, y: 905, w: 1560, h: 320, label: "知识层 · 读懂这段代码需要的概念（紫色虚线指向用到它的地方）", layer: "concept", kind: "concept" });
  const C = (id, x, y, label, sub, o) => g.nodes.push(Object.assign({ id, x, y, label, sub, kind: "concept", layer: "concept", w: 250 }, o));
  C("c_selfedit", 180, 990, "self-edit", "模型写给自己的训练数据", {
    def: "模型针对一段新输入，自己生成的“用来更新自己的数据或指令”。它不是答案，而是一份学习材料。",
    here: "知识任务里是一段“推论”文本；ARC 任务里是一份 JSON 训练配置（用哪些数据增强、学习率、轮数）。",
    trap: "self-edit 本身不会被直接评分，被评分的是“用它训练之后，模型变得多好”。", prereq: ["c_sft"] });
  C("c_sft", 500, 990, "监督微调 SFT", "让模型更可能写出给定文本", {
    def: "给定一段目标文本，调整参数，让模型逐词预测这段文本的概率变大。",
    formula: "L(θ) = − Σ<sub>t</sub> log p<sub>θ</sub>( y<sub>t</sub> | x, y<sub>&lt;t</sub> )",
    here: "这个仓库里 SFT 出现两次：内层用 self-edit 训练一个临时 LoRA；外层用“提示词 → 最好的 self-edit”训练模型本身。", mini: "sft",
    trap: "“只在哪些 token 上算 loss”是实现细节，但会改变学到的东西。外层只算 self-edit 部分；内层连 padding 也算进去了。", prereq: ["c_lm"] });
  C("c_lora", 820, 990, "LoRA 低秩适配", "只训练很少的新参数", {
    def: "不改原来的权重 W，只给它加一个由两个小矩阵相乘得到的增量。训练时只更新这两个小矩阵。",
    formula: "W′ = W + (α / r) · B A ，  B ∈ ℝ<sup>d×r</sup>，A ∈ ℝ<sup>r×k</sup>，r ≪ d",
    here: "内层 r=32、α=64、10 个 epoch、lr 1e-3；外层 r=64、α=128。ARC 里每个任务前把 B 清零、A 复原，等于从原模型重新开始。", mini: "lora",
    trap: "B 初始化为 0，所以刚挂上的 LoRA 和原模型完全一样；“训练 10 个 epoch”才让它记住文章。", prereq: ["c_sft"] });
  C("c_ttt", 1140, 990, "测试时训练 TTT", "遇到新输入时先学一下再答", {
    def: "不是提前训练好再用，而是在遇到一个具体输入时，先用这个输入做一小段训练，再回答。",
    here: "输入是一篇文章：先用 self-edit 训练一个只属于这篇文章的 LoRA，用完就扔。",
    trap: "这里不是“在测试题上训练”：训练只用 self-edit（和原文），从不看问题和答案。", prereq: ["c_lora"] });
  C("c_cbqa", 1460, 990, "闭卷问答", "不给原文，只靠权重回答", {
    def: "回答时不提供原文，模型只能依赖参数里已有的知识。",
    here: "TTT 之后答题时故意不放原文，所以分数上升 = 知识真的写进了权重。",
    trap: "如果答题时带着原文，就测不出权重里学到了什么。", prereq: ["c_lm"] });
  C("c_lm", 180, 1130, "下一个词的概率", "语言模型的基本输出", {
    def: "语言模型对每个位置给出“下一个词是什么”的概率分布；一段文本的概率是每个词概率的乘积。",
    formula: "log p(y) = Σ<sub>t</sub> log p( y<sub>t</sub> | y<sub>&lt;t</sub> )",
    here: "SFT 的 loss、策略梯度里的 log p(SE|C) 都建立在这个量上。" });
  C("c_pg", 500, 1130, "策略梯度", "多做得分高的事", {
    def: "把“生成一段文本”看成一个动作：奖励高的动作，把它的概率调高。",
    formula: "∇J ≈ (1/NM) Σ<sub>i,j</sub> r<sub>ij</sub> · ∇ log p<sub>θ</sub>( SE<sub>ij</sub> | C<sub>i</sub> )",
    here: "论文式 (3)。奖励不能对参数求导（要先训练再答题），所以只能用这种“采样 → 打分 → 加权”的估计。",
    trap: "奖励依赖当前模型本身（训练后答题），这和普通强化学习不一样，论文把它当作固定值处理。", prereq: ["c_lm"] });
  C("c_restem", 820, 1130, "ReST-EM", "只在好样本上做 SFT", {
    def: "E 步：采样很多输出，按奖励筛出好的；M 步：只在这些好输出上做 SFT。重复几轮。",
    formula: "奖励 r ∈ {0,1} 时，式 (4) 里 r=0 的项消失 → 等价于“只在 r=1 的样本上 SFT”",
    here: "论文试过 GRPO 和 PPO，发现训练不稳定，所以用这个更简单的方法。仓库里每篇文章只留奖励最高的 1 个。", mini: "rest",
    trap: "“最好的那个”不等于“好的”：如果 5 个都没超过基线，仓库仍然会留一个。", prereq: ["c_pg", "c_sft"] });
  C("c_judge", 1140, 1130, "LLM 当裁判", "用另一个模型判对错", {
    def: "答案对不对不用字符串匹配，而是让一个强模型读题、标准答案和回答，判断是否正确。",
    here: "GPT-4.1 回答 yes / no。这个判断本身也是奖励的一部分，所以它的偏差会被学进去。",
    trap: "裁判本身有噪声；同一个回答两次判断可能不同。", prereq: ["c_cbqa"] });
  C("c_noise", 1460, 1130, "奖励噪声", "分数差多少才算真的差", {
    def: "每个 self-edit 的奖励是 3 次训练 + 评估的平均。每次结果都不一样，平均值也有误差。",
    formula: "标准误 SE = s / √n ，n = 3",
    here: `仓库的真实数据：同一个 self-edit 重复 3 次的标准差平均 ${S2.levers.summary.within_sd.toFixed(3)}，而 5 个不同 self-edit 之间的标准差只有 ${S2.levers.summary.between_sd.toFixed(3)}。噪声比差异还大。`,
    trap: `按两倍标准误粗略判断，50 篇里有 ${S2.levers.summary.C_indistinct} 篇的第 1 名和第 2 名分不开。`, prereq: ["c_judge"] });
  const CE = (from, to) => g.edges.push({ from, to, kind: "concept" });
  CE("c_selfedit", "gen"); CE("c_selfedit", "se"); CE("c_sft", "lora"); CE("c_sft", "sft"); CE("c_lora", "lora"); CE("c_lora", "sft");
  CE("c_ttt", "lora"); CE("c_cbqa", "ans"); CE("c_judge", "grade"); CE("c_noise", "reward"); CE("c_restem", "select"); CE("c_restem", "sft"); CE("c_pg", "select");
  const PE = (from, to) => g.edges.push({ from, to, kind: "prereq" });
  PE("c_lm", "c_sft"); PE("c_sft", "c_lora"); PE("c_lora", "c_ttt"); PE("c_lm", "c_pg"); PE("c_pg", "c_restem"); PE("c_sft", "c_restem"); PE("c_lm", "c_cbqa"); PE("c_cbqa", "c_judge"); PE("c_judge", "c_noise"); PE("c_sft", "c_selfedit");
  g.scenarios.unshift({ name: "从零读懂 · 概念顺序", intro: "如果你还不懂 LoRA、ReST-EM：沿着先修关系走一遍，每到一个概念，看它用在代码的哪里。", steps: [
    { n: "c_lm", p: "起点", c: "一切都建立在“下一个词的概率”上" },
    { e: "c_lm>c_sft", p: "先修", c: "SFT：让模型更可能写出某段文本" },
    { e: "c_sft>c_lora", p: "先修", c: "LoRA：只训练很少的新参数来做 SFT" },
    { e: "c_lora>lora", p: "用在这里", c: "内层：用 self-edit 训练一个临时 LoRA" },
    { e: "c_lora>c_ttt", p: "先修", c: "这种“遇到输入先学再答”叫测试时训练" },
    { e: "c_cbqa>ans", p: "用在这里", c: "答题时不给原文，测知识是否进了权重" },
    { e: "c_judge>c_noise", p: "先修", c: "裁判有噪声，3 次平均也有误差" },
    { e: "c_noise>reward", p: "用在这里", c: `真实数据：噪声 ${S2.levers.summary.within_sd.toFixed(2)} > 差异 ${S2.levers.summary.between_sd.toFixed(2)}` },
    { e: "c_lm>c_pg", p: "先修", c: "策略梯度：奖励高的输出，概率调高" },
    { e: "c_pg>c_restem", p: "先修", c: "奖励只有 0/1 时，策略梯度 = 只在好样本上 SFT" },
    { e: "c_restem>select", p: "用在这里", c: "E 步：每篇只留第一名" },
    { e: "c_restem>sft", p: "用在这里", c: "M 步：在留下的样本上 SFT，合并成新模型" }] });
})();

/* ---------- mini visuals ---------- */
MINIS.lora = () => {
  const d = 3584, r = 32, full = d * d, lora = 2 * d * r, pct = (lora / full * 100).toFixed(1);
  return `<svg viewBox="0 0 460 170" role="img" aria-label="LoRA 参数量"><rect x="10" y="20" width="120" height="120" fill="var(--sunk)" stroke="var(--line)"/><text x="70" y="85" text-anchor="middle" font-family="var(--mono)" font-size="13" fill="var(--ink)">W</text><text x="70" y="158" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--muted)">${d}×${d} 冻结</text>
  <text x="150" y="85" font-size="20" fill="var(--ink)">+</text>
  <rect x="180" y="20" width="10" height="120" fill="var(--concept)" opacity=".8"/><text x="185" y="158" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--muted)">B</text>
  <rect x="200" y="20" width="120" height="10" fill="var(--concept)" opacity=".8"/><text x="260" y="48" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--muted)">A (r=${r})</text>
  <text x="340" y="70" font-family="var(--mono)" font-size="12" fill="var(--ink)">原矩阵 ${(full / 1e6).toFixed(1)}M</text>
  <text x="340" y="92" font-family="var(--mono)" font-size="12" fill="var(--concept)">LoRA ${(lora / 1e3).toFixed(0)}K</text>
  <text x="340" y="114" font-family="var(--mono)" font-size="12" fill="var(--ink)">= ${pct}%</text></svg><p class="hint" style="padding:0 8px 6px">按隐藏维度 3584（Qwen2.5-7B 的配置）计算一个方阵的参数量。</p>`;
};
MINIS.sft = () => {
  const toks = [["提示词：Let's read the following passage…", 0], ["Implications:", 0], ["1. Greece played a peripheral role…", 1], ["2. …", 1], ["<pad> <pad> …", 2]];
  return `<svg viewBox="0 0 460 150" role="img" aria-label="哪些 token 算 loss">${toks.map((t, i) => { const y = 14 + i * 26, c = t[1] === 1 ? "var(--ok)" : t[1] === 2 ? "var(--bad)" : "var(--muted)"; return `<rect x="8" y="${y}" width="300" height="20" rx="4" fill="var(--sunk)" stroke="${c}"/><text x="14" y="${y + 14}" font-family="var(--mono)" font-size="11" fill="var(--ink)">${esc(t[0])}</text><text x="318" y="${y + 14}" font-size="11.5" fill="${c}">${t[1] === 1 ? "外层：算 loss" : t[1] === 2 ? "内层：也算了 loss" : "外层：不算"}</text>`; }).join("")}</svg>`;
};
MINIS.rest = () => {
  const cs = EX.completions, W = 440, x = i => 30 + i * 82;
  const y = v => 120 - v * 200;
  let s = `<svg viewBox="0 0 ${W} 170" role="img" aria-label="一篇文章的 5 个 self-edit 和奖励"><line x1="20" x2="${W - 10}" y1="${y(cs[0].stats.baseline_mean)}" y2="${y(cs[0].stats.baseline_mean)}" stroke="var(--muted)" stroke-dasharray="4 4"/><text x="${W - 12}" y="${y(cs[0].stats.baseline_mean) - 5}" text-anchor="end" font-size="11" fill="var(--muted)">基线 ${cs[0].stats.baseline_mean.toFixed(2)}</text>`;
  cs.forEach((c, i) => { const m = c.stats.adapter_mean, sd = c.stats.adapter_std, pick = i === EX.picked;
    s += `<line x1="${x(i) + 20}" x2="${x(i) + 20}" y1="${y(m + sd)}" y2="${y(Math.max(0, m - sd))}" stroke="var(--ink)" opacity=".4"/><circle cx="${x(i) + 20}" cy="${y(m)}" r="${pick ? 8 : 6}" fill="${pick ? "var(--lit)" : "var(--concept)"}"/><text x="${x(i) + 20}" y="160" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--ink)">#${i + 1} ${m.toFixed(2)}</text>`; });
  return s + `<text x="${x(EX.picked) + 32}" y="${y(cs[EX.picked].stats.adapter_mean) + 4}" font-size="11" fill="var(--lit)">被选中</text></svg><p class="hint" style="padding:0 8px 6px">真实数据（Crimean War）：竖线是 3 次评估的 ±1 标准差。被选中的是退化的关键词列表。</p>`;
};

/* ---------- SEAL directory lens: the reusable VIEWS.directory ---------- */
def({ id: "seal.dir", repo: "seal", title: "SEAL · 目录", kindLabel: "目录视角 · 文件 ↔ 流程", world: { w: 1700, h: 1180 },
  info: { role: "左右两边是仓库真实的文件夹结构（条的长度 = 行数），中间是流程里的步骤。点一个步骤，看它落在哪些文件里；点一个文件，看它有哪些函数、属于哪一步。灰色的是论文里的对照实验和扩展，复现主结果时可以先不读。" },
  custom: VIEWS.directory({
    repo: "seal", inventory: S2.inv, flowGraph: "seal",
    stages: [["gen", "写 self-edit", "gk"], ["seqs", "切成训练序列", "gk"], ["lora", "LoRA 试训 · 答题", "gk"], ["grade", "GPT-4.1 判分", "gk"], ["reward", "奖励（3 次平均）", "gk"], ["select", "E-step 取第一名", "gk"], ["sft", "M-step SFT", "gk"],
      ["arc_gen", "写训练配置", "fs"], ["arc_data", "数据增强", "fs"], ["arc_ttt", "LoRA 试训", "fs"], ["arc_eval", "评估 pass@2", "fs"], ["arc_bc", "只留答对的 SFT", "fs"],
      ["side", "对照实验 / 扩展", "side"], ["data", "数据与结果", "side"]],
    groupLabels: { gk: "知识任务", fs: "ARC", side: "" },
    map: [[/make_squad_data\.(py|sh)$/, ["gen"]], [/src\/utils\.py$/, ["seqs", "grade"]], [/TTT_server\.(py|sh)$/, ["lora", "grade"]], [/query_server\.(py|sh)$/, ["reward"]],
      [/build_SFT_dataset\.py$/, ["select"]], [/train_SFT\.(py|sh)$/, ["sft"]],
      [/few-shot\/self-edit\.py$|few-shot\/utils\/prompts\.py$/, ["arc_gen"]], [/arclib\/(augmenters|arc|representers|messagers)\.py$/, ["arc_data"]],
      [/arclib\/update_model\.py$|few-shot\/ttt\.py$/, ["arc_ttt"]], [/eval-self-edits\.py$|arclib\/(eval|voting)\.py$|few-shot\/inference\//, ["arc_eval"]], [/BC-self-edit\.py$/, ["arc_bc"]],
      [/\/$/, ["data"]]],
    sideNote: "不在主流程上：论文的对照实验（CPT、Generative Adapter、EntiGraph、GPT-4.1 合成数据）或持续学习扩展。复现主结果时可以先跳过。",
    tours: [{ name: "一轮迭代经过的文件", intro: "知识任务的一轮 ReST-EM 依次用到哪些文件。", stages: ["gen", "seqs", "lora", "grade", "reward", "select", "sft"] },
            { name: "可以先不读的", intro: "灰色文件属于对照实验和扩展。", stages: ["side", "data"] }]
  })
});

/* ---------- paper → code ---------- */
def({ id: "seal.paper", repo: "seal", title: "SEAL · 论文 → 代码", kindLabel: "论文 ↔ 实现", world: { w: 1600, h: 980 },
  info: { role: "左边是论文（arXiv 2506.10943）里的算法和公式，右边是实现它们的代码和仓库提交的结果。连线颜色说明实现和论文的关系：绿 = 一致，黄 = 近似，红 = 偏离，灰点 = 不能直接比较。",
    repro: { why: "复现时最容易出错的地方，是以为代码完全按论文写。这张图把“哪里一样、哪里不一样”标出来。", limit: "论文公式是我根据论文 HTML 版整理的写法；论文里出现的数字已逐字核对。", next: "红线和黄线就是做干预实验的入口，见第 5 帧。" } },
  groups: [{ x: 20, y: 40, w: 600, h: 920, label: "论文 · arXiv 2506.10943" }, { x: 980, y: 40, w: 600, h: 920, label: "代码 + 仓库提交的结果" }],
  nodes: [
    { id: "p_alg", x: 320, y: 140, label: "算法 1 · 自编辑强化学习循环", sub: "采样 SE → 内层 SFT → 评估 → 更新", kind: "paper", tag: "Alg. 1", w: 460,
      formula: "for t = 1,2,…: 采样 (C,τ) → SE ~ LM<sub>θ</sub>(·|C) → θ′ ← SFT(θ, SE) → 答 τ → r → θ<sub>t+1</sub> ← RL_Update(θ, r, SE)",
      maps: [{ s: "match", to: "k_gen", why: "第 4 行“从 LM 采样 SE”= make_squad_data.py，每篇 k=5、T=1.0。" },
             { s: "approx", to: "k_ttt", why: "第 5 行“用 SE 做内层 SFT”= TTT_server.py。", evidence: "实现细节：padding 到 2048，labels 直接复制 input_ids，padding 位置没有设成 −100；LoraConfig 没指定 target_modules。论文没写这些。" }] },
    { id: "p_eq1", x: 320, y: 290, label: "式 (1) · 目标", sub: "最大化期望奖励", kind: "paper", tag: "Eq. 1", w: 460,
      maps: [{ s: "approx", to: "k_topk", why: "目标没法直接优化，论文用 ReST-EM 近似它（式 3、4）。" }] },
    { id: "p_eq2", x: 320, y: 440, label: "式 (2) · 二值奖励", sub: "r = 1 当且仅当超过基线", kind: "paper", tag: "Eq. 2", w: 460,
      maps: [{ s: "approx", to: "k_query", why: "代码记录的是连续的准确率 adapter_mean（3 次平均），不是 0/1。" },
             { s: "diverge", to: "k_topk", why: "论文脚注：知识任务只奖励“带来最大提升”的那一个。代码取最大值，但不检查它是否真的有提升。", evidence: `实跑仓库的 _top_k 于提交的第 0 轮数据：50 篇里有 ${S2.estep.rank_iter0.picked_gain_le_0} 篇被选中的 self-edit 不比基线好（按式 2 应得 r=0）；第 1 轮是 ${S2.estep.rank_iter1.picked_gain_le_0} 篇。` }] },
    { id: "p_eq34", x: 320, y: 590, label: "式 (3)(4) · 梯度 → 只在好样本上 SFT", sub: "r=0 的项可以忽略", kind: "paper", tag: "Eq. 3–4", w: 460,
      maps: [{ s: "match", to: "k_sft", why: "M 步只在 self-edit 的 token 上算 loss，对应式 (4) 的 token 级求和。", evidence: "代码没有显式 mask，依赖 TRL 对 prompt-completion 数据的默认行为；换 TRL 版本时要核对。" }] },
    { id: "p_why", x: 320, y: 740, label: "为什么用 ReST-EM", sub: "试过 GRPO、PPO：训练不稳定", kind: "paper", tag: "§3", w: 460,
      maps: [{ s: "match", to: "k_topk", why: "“基于过滤的行为克隆”= 先筛选（_top_k），再 SFT。" }] },
    { id: "p_t2", x: 320, y: 890, label: "表 2 · 单篇知识整合 47.0%", sub: "Qwen2.5-7B · 基线 32.7%", kind: "paper", tag: "Table 2", w: 460,
      maps: [{ s: "nocompare", to: "k_res", why: "仓库提交的结果在名为 3B 的文件夹里，而论文主实验用 Qwen2.5-7B。", evidence: `仓库结果：基础模型写的 self-edit → ${(S2.estep.eval_base.adapter_mean_accuracy * 100).toFixed(1)}%；第 2 轮后 → ${(S2.estep.eval_iter2.adapter_mean_accuracy * 100).toFixed(1)}%（验证集）。方向一致，但不是同一个实验。` }] },
    { id: "k_gen", x: 1280, y: 140, label: "make_squad_data.py", sub: "采样 5 个 self-edit", w: 440, code: { f: "general-knowledge/src/data_generation/make_squad_data.py", a: 17, b: 22 } },
    { id: "k_ttt", x: 1280, y: 290, label: "TTT_server.py", sub: "内层 LoRA SFT + 答题", w: 440, code: { f: "general-knowledge/src/inner/TTT_server.py", a: 252, b: 259 } },
    { id: "k_query", x: 1280, y: 440, label: "query_server.py · adapter_mean", sub: "奖励 = 3 次平均准确率", w: 440, code: { f: "general-knowledge/src/query/query_server.py", a: 186, b: 194 } },
    { id: "k_topk", x: 1280, y: 590, label: "build_SFT_dataset._top_k", sub: "每篇只留第一名", w: 440, code: { f: "general-knowledge/src/EM/build_SFT_dataset.py", a: 20, b: 30 } },
    { id: "k_sft", x: 1280, y: 740, label: "train_SFT.py", sub: "TRL SFTTrainer + LoRA r64", w: 440, code: { f: "general-knowledge/src/EM/train_SFT.py", a: 62, b: 85 } },
    { id: "k_res", x: 1280, y: 890, label: "results/query_server/3B/eval", sub: "仓库提交的真实结果", kind: "data", w: 440 }
  ],
  edges: [
    { from: "p_alg", to: "k_gen", kind: "match", label: "一致" }, { from: "p_alg", to: "k_ttt", kind: "approx", label: "近似" },
    { from: "p_eq1", to: "k_topk", kind: "approx", label: "近似", bend: -40 }, { from: "p_eq2", to: "k_query", kind: "approx", label: "近似" },
    { from: "p_eq2", to: "k_topk", kind: "diverge", label: "偏离", bend: 30 }, { from: "p_eq34", to: "k_sft", kind: "match", label: "一致" },
    { from: "p_why", to: "k_topk", kind: "match", label: "一致", bend: 30 }, { from: "p_t2", to: "k_res", kind: "nocompare", label: "不可直接比较" }
  ],
  scenarios: [{ name: "逐条核对", intro: "沿着论文从上到下，看每一处在代码里是怎么实现的。", steps: [
    { e: "p_alg>k_gen", p: "采样 SE", c: "算法第 4 行 → make_squad_data.py：一致" },
    { e: "p_alg>k_ttt", p: "内层 SFT", c: "算法第 5 行 → TTT_server.py：近似（padding 也算进 loss，论文没提）" },
    { e: "p_eq2>k_query", p: "r", c: "式 (2) 的 0/1 奖励 → 代码里是连续的 adapter_mean" },
    { e: "p_eq2>k_topk", p: `${S2.estep.rank_iter0.picked_gain_le_0}/50 没有提升`, c: `偏离：取了最大值，却不检查是否超过基线。第 0 轮有 ${S2.estep.rank_iter0.picked_gain_le_0} 篇这样的样本进了训练集` },
    { e: "p_eq34>k_sft", p: "只算 SE token", c: "式 (4) → train_SFT.py：一致（依赖 TRL 默认行为）" },
    { e: "p_t2>k_res", p: "3B ≠ 7B", c: `论文 47.0%（7B）vs 仓库 ${(S2.estep.eval_iter2.adapter_mean_accuracy * 100).toFixed(1)}%（3B 文件夹）：不能直接比较` }] }]
});

/* ---------- intervention preview on real data (custom) ---------- */
def({ id: "seal.levers", repo: "seal", title: "SEAL · 干预预演", kindLabel: "干预 · 在真实数据上预演", world: { w: 1560, h: 640 },
  info: { role: "每一列是一篇文章（仓库提交的第 0 轮训练数据，共 50 篇），每列 5 个点是它的 5 个 self-edit，竖线是 3 次评估的 ±1 标准差，橙色圈是 E-step 选中的那个。选一个场景，看改动会让训练集发生什么变化。不需要 GPU。" },
  custom(ctx){
    const A = S2.levers.articles, sm = S2.levers.summary, g = ctx.g, X0 = 70, X1 = 1500, Y0 = 560, Y1 = 90;
    const x = i => X0 + (i + .5) * (X1 - X0) / A.length, y = v => Y0 - v * (Y0 - Y1) / 1.0;
    let cols = [];
    function build(){
      g.innerHTML = ""; cols = [];
      [0, .2, .4, .6, .8, 1].forEach(v => { ctx.el("line", { x1: X0, x2: X1, y1: y(v), y2: y(v), stroke: "var(--grid)" }, g); ctx.el("text", { x: X0 - 10, y: y(v) + 4, "text-anchor": "end", class: "cvmuted" }, g, v.toFixed(1)); });
      ctx.el("text", { x: X0, y: 60, class: "cvtext", "font-size": "15" }, g, "答对率（挂上 LoRA 后，3 次平均）");
      A.forEach((a, i) => {
        const cg = ctx.el("g", {}, g); const xi = x(i);
        ctx.el("line", { x1: xi - 9, x2: xi + 9, y1: y(a.base), y2: y(a.base), stroke: "var(--muted)", "stroke-width": 2 }, cg);
        a.comps.forEach((c, j) => { const xx = xi + (j - 2) * 3.2;
          ctx.el("line", { x1: xx, x2: xx, y1: y(Math.min(1, c.m + c.sd)), y2: y(Math.max(0, c.m - c.sd)), stroke: "var(--ink)", opacity: .18 }, cg);
          ctx.el("circle", { cx: xx, cy: y(c.m), r: 2.6, fill: "var(--c0)", opacity: .7, class: "cdot", "data-j": j }, cg); });
        const pc = a.comps[a.pick]; const ring = ctx.el("circle", { cx: xi + (a.pick - 2) * 3.2, cy: y(pc.m), r: 6.5, fill: "none", stroke: "var(--lit)", "stroke-width": 2.2 }, cg);
        cg.addEventListener("click", () => showArticle(i)); cg.style.cursor = "pointer";
        cols.push({ g: cg, ring });
      });
      ctx.el("text", { x: X0, y: Y0 + 30, class: "cvmuted" }, g, "← 50 篇文章（点一列看详情）  ·  短横线 = 不挂 LoRA 的基线  ·  橙圈 = E-step 选中");
      lever(null);
    }
    function showArticle(i){
      const a = A[i]; ctx.visit("article:" + i, a.title);
      ctx.inspect(`<span class="kchip">一篇文章 · 真实数据</span><h2>${esc(a.title)}</h2><div class="io"><b>基线</b><span>${a.base}</span><b>选中</b><span>#${a.pick + 1}（增益 ${a.comps[a.pick].gain}）</span></div>
        <table class="small" style="width:100%;font-size:12.5px;border-collapse:collapse"><tr><th align="left">#</th><th align="right">均值</th><th align="right">±sd</th><th align="right">增益</th><th align="right">重复行</th></tr>${a.comps.map((c, j) => `<tr style="${j === a.pick ? "color:var(--lit);font-weight:600" : ""}"><td>${j + 1}</td><td align="right">${c.m}</td><td align="right">${c.sd}</td><td align="right">${c.gain}</td><td align="right">${Math.round(c.dup * 100)}%</td></tr>`).join("")}</table>
        <p class="hint">${a.distinctC ? "第 1 名和第 2 名的差距大于两者标准误之和。" : "第 1 名和第 2 名的差距小于两者标准误之和：按这个粗略标准，排名分不开。"}</p>`);
    }
    function lever(id){
      A.forEach((a, i) => { const c = cols[i]; c.g.setAttribute("opacity", 1); c.ring.setAttribute("stroke", "var(--lit)");
        const pc = a.comps[a.pick]; c.ring.setAttribute("cx", x(i) + (a.pick - 2) * 3.2); c.ring.setAttribute("cy", y(pc.m)); });
      if (id === "A") A.forEach((a, i) => { if (!a.keepA) { cols[i].g.setAttribute("opacity", .25); cols[i].ring.setAttribute("stroke", "var(--bad)"); } });
      if (id === "B") A.forEach((a, i) => { if (a.pickB !== a.pick) { const pc = a.comps[a.pickB]; cols[i].ring.setAttribute("cx", x(i) + (a.pickB - 2) * 3.2); cols[i].ring.setAttribute("cy", y(pc.m)); cols[i].ring.setAttribute("stroke", "var(--ok)"); } });
      if (id === "C") A.forEach((a, i) => { if (!a.distinctC) cols[i].ring.setAttribute("stroke", "var(--muted)"); });
    }
    const card = (t, hyp, diff, measure, cost, result) => `<span class="kchip">干预卡片</span><h2>${t}</h2><div class="lev">
      <div class="rgrid"><b>假设</b><span>${hyp}</span><b>怎么衡量</b><span>${measure}</span><b>成本</b><span>${cost}</span></div>
      <span class="label">改动（作用于代码副本，不改原仓库）</span><div class="diff">${diff}</div>
      <span class="label">在真实数据上预演的结果</span><div>${result}</div></div>`;
    const D = s => s.split("\n").map(l => l.startsWith("+") ? `<span class="add">${esc(l)}</span>` : l.startsWith("-") ? `<span class="del">${esc(l)}</span>` : esc(l)).join("\n");
    const CARDS = {
      A: card("按论文：没有提升就不要", "只用真正超过基线的 self-edit 训练，模型学到的“写法”更干净，下一轮增益更高。",
        D(`  build_SFT_dataset.py · _top_k\n- for c in sorted(comps, key=…)[:k]\n+ for c in sorted(comps, key=…)[:k]\n+     if c["stats"].get("gain_mean", 0) > 0`),
        "下一轮的 mean_gain 和验证集准确率，对比不加阈值的版本。", "多一轮外层迭代（需要 GPU）。预演本身零成本。",
        `<span class="big">${sm.A_dropped}</span> / ${sm.n} 篇被移出训练集（红色）。这些样本按论文式 (2) 的定义本来就应该是 r=0。`),
      B: card("并列时看增益，并拒绝退化输出", "并列时，退化的关键词列表会因为排在前面而被选中；换个规则可以避开。",
        D(`  build_SFT_dataset.py · _top_k\n- key=lambda c: c["stats"].get(metric, 0)\n+ key=lambda c: (c["stats"].get(metric, 0), c["stats"].get("gain_mean", 0))\n+ 并跳过重复行 > 30% 的 self-edit`),
        "被换掉的样本数；人工看换掉前后的 self-edit 质量。", "零 GPU。",
        `<span class="big">${sm.B_changed}</span> 篇的选择改变（绿圈）：Crimean War 从退化的 #2 换成正常的 #3。并列很常见（${S2.estep.rank_iter0.ties_at_top}/50 篇），但大多数并列项本身质量相近。`),
      C: card("先确认奖励能区分好坏", "3 次评估的噪声太大，E-step 的“第一名”很多时候是随机的。增加评估次数或换更稳定的奖励，比改模型更先要做。",
        D(`  query_server.sh\n- EVAL_TIMES=3\n+ EVAL_TIMES=8    # 标准误降到约 0.61 倍`),
        "第 1、2 名能分开的文章比例；同一 self-edit 两次排名的一致性。", "内层评估次数 × 8/3（GPU 时间同比例增加）。",
        `<span class="big">${sm.C_indistinct}</span> / ${sm.n} 篇的第 1、2 名分不开（灰圈）。同一 self-edit 重复评估的标准差 ${sm.within_sd.toFixed(3)}，大于不同 self-edit 之间的 ${sm.between_sd.toFixed(3)}。粗略检验，仅作提示。`),
      D: card("内层训练不要在 padding 上算 loss", "padding 位置参与 loss 会稀释真正的文本信号，内层 LoRA 学得更慢，奖励更吵。",
        D(`  TTT_server.py · 第 259 行\n  labels = tok["input_ids"].copy()\n+ labels = [l if m else -100 for l, m in zip(labels, tok["attention_mask"])]`),
        "同一批 self-edit 的奖励均值和标准差，改动前后对比。", "需要 GPU 重跑内层。",
        `不能在 CPU 上预演，这一张卡只给出改动和衡量方法。`)
    };
    const SC = [
      { name: "A · 按论文加阈值", id: "A" }, { name: "B · 并列与退化", id: "B" }, { name: "C · 奖励噪声", id: "C" }, { name: "D · padding 掩码", id: "D" }];
    let si = 0, k = 0;
    return { names: SC.map(s => s.name), select(i){ si = i; this.reset(); },
      reset(){ k = 0; build(); ctx.caption("这是 E-step 现在的选择。按 ▶ 应用改动。", "0 / 1"); ctx.inspect(CARDS[SC[si].id]); },
      done(){ return k >= 1; },
      async step(){ if (k >= 1) return false; k = 1; lever(SC[si].id); ctx.inspect(CARDS[SC[si].id]);
        ctx.caption({ A: `红色：${sm.A_dropped} 篇被移出训练集`, B: `绿色：${sm.B_changed} 篇的选择改变`, C: `灰色：${sm.C_indistinct} 篇的排名分不开`, D: "这项改动需要 GPU，图上没有变化" }[SC[si].id], "1 / 1"); return false; } };
  }
});

/* ---------- OpenMAIC: intervention config ---------- */
(function(){
  const g = GRAPHS.maic;
  g.intervene = {
    repo: "THU-MAIC/OpenMAIC @ 70859b4",
    placeholder: "例如：老师回答完以后，自动检查学生的问题有没有真的被回答；没有就让老师再答一次。",
    conventions: [
      "AGENTS.md: reads and writes stay within the requesting owner (owner scoping).",
      "AGENTS.md: shared layers do not hard-code a model or vendor; a new model use is a slot in lib/config/model-slots.ts (STAGE_SLOTS maps stage keys to slots).",
      "AGENTS.md: server-side requests to user-supplied URLs go through lib/server/ssrf-guard.ts.",
      "AGENTS.md: changing a published package under packages/@openmaic/* needs a version bump.",
      "Generation steps are checkpointed by id in lib/server/generation/run/plan.ts; a new step must be pure-plan compatible (advanceRun).",
      "Classroom chat: director (lib/chat/pi/director-loop.ts) has tools read_scene, call_agent, cue_user, close_session; child agents (lib/chat/pi/tools/call-agent.ts) emit a JSON array parsed into speech + actions; prompts in lib/chat/pi/prompts.ts.",
      "Evals: eval/orchestration/answering-runner.ts (routing to teacher, pass >= 0.7) and answer-content-judge.ts (LLM judge returning leads_with_answer, answered_anywhere)."
    ],
    facts: [
      "Director picks agents only by prompt rules; the priority field is printed but never computed with.",
      "Eval scenario answering.json: teacher, assistant and student all drift and nobody gives x = -b/(2a).",
      "The repo has no committed real LLM outputs; eval results are gitignored."
    ],
    example: {
      prompt: "老师回答完以后，自动检查学生的问题有没有真的被回答；没有就让老师再答一次。",
      anchors: ["director", "children", "api_chat"],
      result: {
        title: "回答后核对：没答上就再派老师一次",
        summary: "在每个角色发言后，用一次便宜的模型调用判断学习者最新的问题是否已经被回答；如果没有，把结果写进 director 的下一步上下文，让它再派老师直接作答，最多一次。判断逻辑复用评测里已有的 answer-content 裁判。",
        grounding: [
          "eval/orchestration/answering.json 记录了“三个角色都在漂移、没人给出公式”的失败模式。",
          "answer-content-judge.ts 已经有返回 {leads_with_answer, answered_anywhere} 的裁判提示词，可以从评测搬到运行时。",
          "AGENTS.md 要求不写死模型：新的调用要走一个 slot。",
          "director 的选择只靠提示词规则（prompts.ts 的规则 5），没有任何程序化检查。"],
        new_components: [
          { id: "new_check", label: "回答核对", sub: "quick 模型 · 每轮 ≤1 次", kind: "ai", role: "读学习者最新消息和刚才的发言，返回是否已回答。", near: "children" },
          { id: "new_slot", label: "classroom.check slot", sub: "继承 classroom", kind: "process", role: "新 slot，默认继承 classroom，可单独指定便宜模型。", near: "slots" }],
        edges: [
          { from: "children", to: "new_check", label: "发言全文" },
          { from: "new_check", to: "llm", label: "裁判提示词" },
          { from: "new_check", to: "director", label: "未回答 → 提示" },
          { from: "new_slot", to: "new_check", label: "用哪个模型" }],
        flow: [
          { from: "player", to: "api_chat", payload: "“对称轴公式？”", caption: "学习者提问" },
          { from: "api_chat", to: "director", payload: "开始", caption: "director 开始一轮" },
          { from: "director", to: "children", payload: "call_agent(同学)", caption: "director 先派了同学（这正是评测里的漂移）" },
          { from: "children", to: "new_check", payload: "“a 决定开口方向…”", caption: "发言结束后交给核对" },
          { from: "new_check", to: "llm", payload: "answered_anywhere?", caption: "一次便宜的模型调用" },
          { from: "new_check", to: "director", payload: "未回答", caption: "把“问题还没被回答”写进 director 的下一步上下文" },
          { from: "director", to: "children", payload: "call_agent(老师)", caption: "director 改派老师直接给公式" },
          { from: "children", to: "player", payload: "x = -b/(2a)", caption: "答案流回课堂" }],
        changes: [
          { node: "director", file: "lib/chat/pi/director-loop.ts", change: "在 afterToolCall 里，call_agent 返回后调用核对；未回答时把一条系统提示追加到 director 上下文，并记录已重派次数（上限 1）。" },
          { node: "children", file: "lib/chat/pi/tools/call-agent.ts", change: "AgentTurnSummary 增加完整发言文本（目前只有 300 字预览），供核对使用。" },
          { node: "slots", file: "lib/config/model-slots.ts", change: "新增 classroom.check（父节点 classroom），并在 STAGE_SLOTS 加一个 stage key。" },
          { node: "api_chat", file: "lib/types/chat.ts", change: "done 事件的 directorToolTrace 里记录核对结果，便于评测读取。" }],
        contracts: [{ name: "AnswerCheck", shape: "{ answered: boolean, missing?: string, judgedBy: slotId }" }],
        risks: ["每轮多一次模型调用：延迟增加，需要用 quick 模型。", "裁判误判会导致老师重复回答，所以重派上限为 1。", "对闲聊、问候等不需要“回答”的消息要跳过，否则会误触发。"],
        tests: ["tests/lib/chat/pi 下为 director-loop 增加：核对返回未回答时，下一次 call_agent 的目标是老师，且只重派一次。", "核对 slot 未配置时，行为与现在完全一致。"],
        eval: "复用 eval/orchestration：在 answering.json 的漂移样本上，比较“路由到老师”的比例和 answer-content 的 answered_anywhere，改动前后各跑一次。",
        open_questions: ["核对应该在每个角色之后跑，还是只在一轮结束前跑一次？", "讨论模式（没有明确问题）是否完全关闭核对？"]
      }
    }
  };
})();

/* ---------- cross-repo patterns ---------- */
def({ id: "patterns", title: "跨仓库模式", kindLabel: "迁移 · 探索性", world: { w: 1620, h: 900 },
  info: { role: "把三个仓库放在一起时，同一种“套路”会出现在不同的地方。左边是模式，中间三列是它在每个仓库里的样子，右边是由此引出的、还没有答案的问题。这一帧是探索性的：模式是我归纳的，不是代码里写好的。",
    repro: { why: "理解一个仓库靠细读；把几个仓库放在一起，才能看到哪些做法可以迁移。", limit: "模式识别带有主观判断：同一个名字下，三个实现的目的并不相同（中间每个节点写了差别）。", next: "右边的问题可以变成第 6 帧那样的 feature request，或者一个小实验。" } },
  groups: [{ x: 290, y: 40, w: 300, h: 840, label: "SEP" }, { x: 610, y: 40, w: 300, h: 840, label: "SEAL" }, { x: 930, y: 40, w: 300, h: 840, label: "OpenMAIC" }],
  nodes: [
    { id: "pt1", x: 140, y: 190, label: "多采样 → 打分 → 选/聚合", sub: "用多次生成换一个更可靠的信号", kind: "pattern", w: 250 },
    { id: "pt2", x: 140, y: 470, label: "让模型当裁判", sub: "对错由另一个模型判断", kind: "pattern", w: 250 },
    { id: "pt3", x: 140, y: 750, label: "把模型文本修成结构", sub: "解析失败时静默修补", kind: "pattern", w: 250 },
    { id: "a1", x: 440, y: 190, label: "采样 10 个回答", sub: "按语义聚类 → 熵（不挑，聚合）", w: 270, jump: { g: "sep", n: "clus", label: "语义分组" }, role: "目的：量出不确定性。10 个回答不挑出“最好”的，而是看它们有多分散。" },
    { id: "b1", x: 760, y: 190, label: "采样 5 个 self-edit", sub: "内层训练 → 奖励 → 只留第一名", w: 270, jump: { g: "seal", n: "select", label: "E-step" }, role: "目的：找出最好的训练数据。只留第一名，其余丢弃。" },
    { id: "c1", x: 1080, y: 190, label: "一次只生成一份", sub: "director 选人，不做多采样", w: 270, jump: { g: "maic.turn", n: "director", label: "director" }, role: "不采样多份。可靠性靠提示词规则和评测，而不是靠多次生成。" },
    { id: "a2", x: 440, y: 470, label: "NLI 判断是否同义", sub: "DeBERTa · 也可换 GPT-4", w: 270, jump: { g: "sep", n: "nli", label: "NLI 判官" }, role: "判断两个回答意思是否相同，不判对错。" },
    { id: "b2", x: 760, y: 470, label: "GPT-4.1 判对错", sub: "直接变成奖励", w: 270, jump: { g: "seal", n: "grade", label: "判分" }, role: "判断答案对错，结果直接成为训练信号。" },
    { id: "c2", x: 1080, y: 470, label: "评测里的 LLM 裁判", sub: "只用于离线评测", w: 270, jump: { g: "maic.turn", n: "director", label: "评测" }, role: "判断老师是否先给出答案。只在评测里用，不影响运行时。" },
    { id: "a3", x: 440, y: 750, label: "从回复前 30 字找关键词", sub: "找不到 → 记为“中性”", w: 270, jump: { g: "sep", n: "nli", label: "NLI 判官" }, role: "EntailmentLLM 在回复前 30 个字符里找 entailment / neutral / contradiction，都没有时打日志 MANUAL NEUTRAL 并返回中性。" },
    { id: "b3", x: 760, y: 750, label: "从输出里切出推论", sub: "去掉 CoT、按 --- 或行切分", w: 270, jump: { g: "seal.seqs", n: "flag", label: "切分" }, role: "build_train_sequences：截掉 Implications: 之前的内容，按 --- 或换行切成训练序列，最多 30 条。" },
    { id: "c3", x: 1080, y: 750, label: "三层修补 JSON", sub: "JSON.parse → jsonrepair → partial-json", w: 270, jump: { g: "maic.parse", n: "jr", label: "动作解析" }, role: "解析失败时依次修补，再按场景类型和角色白名单过滤。" },
    { id: "q1", x: 1440, y: 190, label: "SEAL 的奖励能否先聚类再评估？", sub: "相同意思的 self-edit 不必各训一次", kind: "question", w: 300, role: "SEP 的语义聚类可以给 SEAL 的 5 个 self-edit 去重；省下的评估预算用来增加 eval_times，正好针对第 5 帧发现的奖励噪声。" },
    { id: "q2", x: 1440, y: 470, label: "裁判本身有多准？", sub: "三个项目都没有给裁判做校准", kind: "question", w: 300, role: "三个仓库都把裁判的输出当真值。能否像 SEP 那样，给裁判本身估一个不确定性，低置信度时再判一次？" },
    { id: "q3", x: 1440, y: 750, label: "修补的次数能当指标吗？", sub: "静默修补 = 看不见的失败", kind: "question", w: 300, role: "三个仓库都会静默修补模型输出。统计修补发生的频率，可以作为提示词质量或模型是否适合这个任务的指标。" }
  ],
  edges: [
    { from: "pt1", to: "a1", kind: "control" }, { from: "a1", to: "b1", kind: "control" }, { from: "b1", to: "c1", kind: "control" }, { from: "c1", to: "q1", kind: "spec" },
    { from: "pt2", to: "a2", kind: "control" }, { from: "a2", to: "b2", kind: "control" }, { from: "b2", to: "c2", kind: "control" }, { from: "c2", to: "q2", kind: "spec" },
    { from: "pt3", to: "a3", kind: "control" }, { from: "a3", to: "b3", kind: "control" }, { from: "b3", to: "c3", kind: "control" }, { from: "c3", to: "q3", kind: "spec" }
  ],
  scenarios: [
    { name: "多采样", intro: "同一个动作，三种目的。", steps: [{ e: "pt1>a1", p: "聚合", c: "SEP：采样 10 个，不挑，只看分散程度 → 不确定性" }, { e: "a1>b1", p: "挑选", c: "SEAL：采样 5 个，只留第一名 → 训练数据" }, { e: "b1>c1", p: "不采样", c: "OpenMAIC：只生成一份，靠规则和评测保证质量" }, { e: "c1>q1", p: "迁移", c: "问题：SEP 的语义聚类能否帮 SEAL 去重、省下评估预算？" }] },
    { name: "模型当裁判", intro: "三个裁判，三种用途。", steps: [{ e: "pt2>a2", p: "同义？", c: "SEP：NLI 只判断是否同义" }, { e: "a2>b2", p: "对错 → 奖励", c: "SEAL：GPT-4.1 判对错，直接成为训练信号" }, { e: "b2>c2", p: "离线评测", c: "OpenMAIC：只在评测里用" }, { e: "c2>q2", p: "迁移", c: "问题：三个都没校准裁判本身" }] },
    { name: "修补模型输出", intro: "三处静默修补。", steps: [{ e: "pt3>a3", p: "关键词", c: "SEP：找不到关键词就当“中性”" }, { e: "a3>b3", p: "切分", c: "SEAL：截掉前缀、按行切" }, { e: "b3>c3", p: "三层修补", c: "OpenMAIC：parse → repair → partial" }, { e: "c3>q3", p: "迁移", c: "问题：修补频率能否当质量指标？" }] }
  ]
});

/* ---------- the method, drawn with itself ---------- */
def({ id: "method", title: "方法", kindLabel: "这个工具自己的工作流", world: { w: 1700, h: 960 },
  info: { role: "这是我做每一个仓库时走的流程，用同一套图画出来。上面四个框是你说的四种能力：理解、复现、干预、发现。每个节点点开，能看到这一步做什么、依据什么原则、产出什么，以及在 SEAL 上的实际产出。",
    repro: { why: "定位：先做理解（1–6 帧都服务它），干预是理解之后的第一个“动手”环节，发现 / 迁移放在最后，并明确标为探索性。", next: "这张图就是将来 skill 的骨架：每个节点对应 skill 里的一个步骤和一段代码。" } },
  groups: [
    { x: 20, y: 40, w: 640, h: 560, label: "① 理解 comprehension" },
    { x: 690, y: 40, w: 330, h: 560, label: "② 复现 reproduction" },
    { x: 1050, y: 40, w: 330, h: 560, label: "③ 干预 intervention" },
    { x: 1410, y: 40, w: 270, h: 560, label: "④ 发现 discovery · 探索性", kind: "dash" },
    { x: 20, y: 640, w: 1660, h: 300, label: "贯穿每一步的原则", kind: "concept" }],
  nodes: [
    { id: "m_read", x: 180, y: 130, label: "读仓库", sub: "README · 行数 · 入口", w: 230, role: "克隆、统计每个文件的行数、找入口脚本和 README 里的执行顺序。SEAL 有 49 个 .py / .sh；知识任务的主流程只用其中 10 个（6 个 Python + 4 个启动脚本）；目录帧里灰掉的就是不在主流程上的。" },
    { id: "m_shape", x: 480, y: 130, label: "判断形状", sub: "流水线 · 生命周期 · 嵌套循环 · 多智能体", w: 270, role: "先决定这个仓库“长什么样”，再决定用哪种图。SEP 是流水线，mini-sglang 是请求生命周期，SEAL 是嵌套循环，OpenMAIC 是多智能体系统。", note: "原则：结构不是静态关系，而是一个请求在时间里经过哪些地方。" },
    { id: "m_flow", x: 180, y: 300, label: "工作流图", sub: "动起来的数据", w: 230, jump: { g: "seal", n: "gen", label: "SEAL 流程" }, role: "节点是代码里的步骤，连线是数据，场景是“一个真实请求怎么走”。" },
    { id: "m_dir", x: 480, y: 300, label: "目录图", sub: "文件 ↔ 步骤", w: 230, jump: { g: "seal.dir" }, role: "同一个仓库按文件夹看：每个步骤落在哪些文件、哪些文件可以先不读。" },
    { id: "m_concept", x: 180, y: 470, label: "知识层", sub: "概念 + 先修关系", w: 230, jump: { g: "seal", n: "c_restem", label: "ReST-EM" }, role: "把读懂代码需要的概念放在同一张图上，用紫色虚线连到用到它的代码。每个概念有定义、公式、在这里怎么用、容易误解的地方。" },
    { id: "m_paper", x: 480, y: 470, label: "论文 → 代码", sub: "一致 · 近似 · 偏离", w: 230, jump: { g: "seal.paper" }, role: "把论文的算法和公式逐条对到代码，并标出实现和论文的差别。" },
    { id: "m_run", x: 855, y: 200, label: "能跑的先跑", sub: "CPU · 替身依赖", w: 250, role: "没有 GPU 和外网时，挑出纯逻辑的函数，用最小替身补上依赖，实跑仓库原代码。图上用绿色标出“实跑过”。" },
    { id: "m_io", x: 855, y: 420, label: "抓 AI 的输入输出", sub: "优先真实数据，标明来源", w: 250, jump: { g: "seal", n: "gen", label: "真实 self-edit" }, role: "来源优先级：仓库提交的真实结果 > 本地实跑 > 测试里的 mock > 模板示例。每一块都标明来源。SEAL 提交了真实运行结果，所以这里用的是真实模型输出。" },
    { id: "m_lever", x: 1215, y: 150, label: "找杠杆", sub: "偏离 · 静默修补 · 噪声", w: 250, role: "来源：论文 ↔ 代码的偏离、代码里的静默修补、真实数据里的异常（并列、退化、噪声）。" },
    { id: "m_preview", x: 1215, y: 320, label: "在真实数据上预演", sub: "改代码副本，跑提交的数据", w: 250, jump: { g: "seal.levers" }, role: "能在 CPU 上预演的干预，直接在仓库提交的数据上跑改过的代码副本，给出“会改变多少样本”。" },
    { id: "m_fr", x: 1215, y: 490, label: "提议 → feature request", sub: "自然语言 + 图上点选", w: 250, jump: { g: "maic" }, role: "用户用一句话描述想加的功能，并在图上点选相关组件。生成的 feature request 只能引用图上的组件和文件，新组件以虚线画回图上，并能播放它的数据流。" },
    { id: "m_pattern", x: 1545, y: 250, label: "跨仓库模式", sub: "同一套路，不同目的", w: 230, jump: { g: "patterns" }, role: "多个仓库放在一起时，找出重复出现的做法，标出差别，并提出迁移问题。" },
    { id: "m_q", x: 1545, y: 450, label: "迁移问题", sub: "下一个实验", w: 230, jump: { g: "patterns", n: "q1", label: "问题" }, role: "每个模式引出一个还没有答案的问题。" },
    { id: "m_p1", x: 230, y: 760, label: "show, not tell", sub: "能画出来就不写成文字", kind: "concept", w: 300, def: "解释留在右侧，图本身承担主要的意思：数据在动、节点有状态、改动画回图上。" },
    { id: "m_p2", x: 650, y: 760, label: "先全局，再放大", sub: "zoom in / zoom out", kind: "concept", w: 300, def: "先看到整体定位和形状，再进入某一个节点的内部图。" },
    { id: "m_p3", x: 1070, y: 760, label: "每个说法都能追溯", sub: "文件:行号 · 数据来源", kind: "concept", w: 300, def: "代码片段在构建时按行号从仓库取出并核对；数字来自实跑或仓库提交的结果，并标明来源。" },
    { id: "m_p4", x: 1490, y: 760, label: "读者自己的路径", sub: "痕迹 · 问题 · 反馈", kind: "concept", w: 300, def: "借鉴 Creative Reading：读者自己决定往哪里走，留下的痕迹和问题是他自己的“读法”。" }
  ],
  edges: [
    { from: "m_read", to: "m_shape" }, { from: "m_shape", to: "m_flow" }, { from: "m_shape", to: "m_dir" }, { from: "m_flow", to: "m_concept" }, { from: "m_dir", to: "m_paper" },
    { from: "m_flow", to: "m_run", via: [690, 260] }, { from: "m_run", to: "m_io" }, { from: "m_paper", to: "m_lever", via: [880, 560] }, { from: "m_io", to: "m_lever" },
    { from: "m_lever", to: "m_preview" }, { from: "m_preview", to: "m_fr" }, { from: "m_lever", to: "m_pattern", kind: "spec" }, { from: "m_pattern", to: "m_q", kind: "spec" }, { from: "m_q", to: "m_fr", kind: "spec", label: "变成提议" }
  ],
  scenarios: [{ name: "SEAL 走一遍", intro: "SEAL 经过这条流程时，每一步产出了什么。", steps: [
    { n: "m_read", p: "49 个文件", c: "读仓库：49 个 .py/.sh；发现 results/ 里有真实运行结果" },
    { e: "m_read>m_shape", p: "嵌套循环", c: "判断形状：外层 ReST-EM 套内层 LoRA 试训" },
    { e: "m_shape>m_flow", p: "12 个节点", c: "工作流图：一篇文章走完一圈" },
    { e: "m_shape>m_dir", p: "10 个主流程文件", c: "目录图：知识任务的主流程只用 10 个文件" },
    { e: "m_flow>m_concept", p: "10 个概念", c: "知识层：从“下一个词的概率”到 ReST-EM" },
    { e: "m_dir>m_paper", p: "6 处对照", c: "论文 → 代码：1 处偏离、3 处近似" },
    { e: "m_flow>m_run", p: "_top_k 实跑", c: "能跑的先跑：E-step、切分序列、数据增强" },
    { e: "m_run>m_io", p: "真实 self-edit", c: "抓输入输出：用仓库提交的真实 self-edit 和奖励" },
    { e: "m_io>m_lever", p: "并列 · 退化 · 噪声", c: `找杠杆：${S2.estep.rank_iter0.ties_at_top} 篇并列、退化输出被选中、${S2.levers.summary.C_indistinct}/50 排名分不开` },
    { e: "m_lever>m_preview", p: "4 张卡片", c: "预演：3 张能在 CPU 上直接看到效果" },
    { e: "m_lever>m_pattern", p: "3 个模式", c: "跨仓库：多采样、模型当裁判、静默修补" },
    { e: "m_q>m_fr", p: "变成提议", c: "迁移问题可以继续变成 feature request" }] }]
});
