/* Page config: who it's for, the interaction mode, routes per goal, key frames. */
PAGE = { id: "four-repos-v4", title: "Code Anatomy v4", h1: "Code Anatomy" };

/* ---------- interaction mode ---------- */
PROFILE = {
  goals: [
    { id: "understand", label: "看懂它怎么工作", sub: "整体定位 → 数据怎么流 → 需要哪些概念", predict: true, repro: false },
    { id: "reproduce", label: "复现论文的结果", sub: "依赖、能跑的部分、论文和代码哪里不一样", predict: false, repro: true },
    { id: "intervene", label: "改一个功能 / 验证一个假设", sub: "找杠杆、预演改动、生成 feature request", predict: false, repro: false },
    { id: "transfer", label: "把它的做法用到别处", sub: "跨仓库模式 → 迁移实验", predict: false, repro: false }
  ],
  times: [{ id: "15", label: "15 分钟", sub: "3 帧" }, { id: "60", label: "1 小时", sub: "5 帧" }, { id: "deep", label: "慢慢读", sub: "完整路线" }],
  changePlaceholder: "例如：课堂里老师答完后，检查学生的问题有没有真的被回答。",
  targetPlaceholder: "例如：一个 AI 辅导产品，要判断学生是不是真的懂了，而不只是答对了。"
};

FRAMES = [
  { id: "meta", name: "全局地图", g: "meta" },
  { id: "seal_flow", name: "SEAL · 一轮迭代", g: "seal", layers: { concept: false }, scenario: 1 },
  { id: "seal_concepts", name: "SEAL · 知识层", g: "seal", layers: { concept: true }, scenario: 0, select: "c_restem" },
  { id: "seal_dir", name: "SEAL · 目录", g: "seal.dir" },
  { id: "seal_paper", name: "SEAL · 论文→代码", g: "seal.paper" },
  { id: "seal_levers", name: "SEAL · 干预预演", g: "seal.levers" },
  { id: "maic_system", name: "OpenMAIC · 系统", g: "maic" },
  { id: "maic_turn", name: "OpenMAIC · 课堂提问", g: "maic.turn" },
  { id: "maic_intervene", name: "OpenMAIC · 提议改动", g: "maic", intervene: true },
  { id: "patterns", name: "跨仓库模式", g: "patterns" },
  { id: "sep_flow", name: "SEP · 流水线", g: "sep" },
  { id: "sgl_flow", name: "mini-sglang · 请求", g: "sgl" },
  { id: "method", name: "方法", g: "method" }
];
ROUTES = {
  understand: ["meta", "seal_flow", "seal_concepts", "seal_dir", "seal_paper", "maic_turn", "sep_flow", "sgl_flow"],
  reproduce: ["seal_flow", "seal_dir", "seal_paper", "seal_levers", "maic_system", "sep_flow"],
  intervene: ["seal_paper", "seal_levers", "maic_intervene", "maic_turn", "patterns"],
  transfer: ["meta", "patterns", "seal_levers", "maic_intervene", "seal_paper"]
};

/* ---------- OpenMAIC: file list so feature requests can be checked against the repo ---------- */
GRAPHS.maic.intervene.files = RUN.maicFiles;

/* ---------- patterns: each transfer question becomes a minimal experiment ---------- */
(function(){
  const g = GRAPHS.patterns, N = id => g.nodes.find(n => n.id === id);
  N("q1").experiment = { hyp: "SEAL 的 5 个 self-edit 里，意思相近的那些奖励也相近；先按语义去重，把省下的评估次数用在剩下的 self-edit 上，第 1、2 名就更容易分开。",
    minimal: "取仓库提交的第 0 轮数据（50 篇 × 5 个 self-edit），用 SEP 的 get_semantic_ids 加一个 NLI 模型聚类。只需 CPU：先统计每篇有几个语义组、组内奖励差多少。",
    metric: "组内奖励差 vs 组间奖励差；可去重的比例。", cost: "半天，CPU 即可（NLI 模型需要下载）。", risk: "self-edit 是长段文字，NLI 判断“双向蕴含”可能过于严格，几乎每个都自成一组。" };
  N("q2").experiment = { hyp: "同一个回答让裁判判 3 次，结果不一致的样本，正好是奖励噪声的主要来源。",
    minimal: "从 SEAL 结果里抽 100 道题的 adapter_answer，用 GPT-4.1 的同一判分提示词各判 3 次。", metric: "判分不一致率；不一致样本在高噪声文章里是否更多。", cost: "约 300 次 API 调用。", risk: "仓库只存了一次判分结果，无法直接对照原判分。" };
  N("q3").experiment = { hyp: "模型输出被“修补”的频率，可以作为提示词是否适合这个模型的指标。",
    minimal: "在 OpenMAIC 的 action-parser 里给三条路径（parse / jsonrepair / partial-json）各加一个计数，跑一批评测场景。", metric: "三条路径的比例；换模型后比例怎么变。", cost: "半天埋点 + 一次评测。", risk: "修补多发生在长回答里，长度是混淆因素。" };
  g.transfer = {
    placeholder: PROFILE.targetPlaceholder,
    example: { target: "一个 AI 辅导产品：要判断学生是不是真的懂了，而不只是答对了。", cards: [
      { title: "换几种问法，看回答的语义分散度", pattern: "多采样 → 打分 → 聚合", from: "SEP",
        hypothesis: "同一个概念换 4 种问法，学生回答的语义分散度，比单题对错更能预测一周后的保持。",
        minimal_experiment: "每个概念准备 4 种问法，收集 30 名学生的回答；用 NLI 或 LLM 按语义聚类，算每个学生在每个概念上的熵；一周后复测。",
        metric: "熵对复测正确率的 AUROC，对比“单题对错”。", cost: "约 1 周数据收集，少量 API 费用。", risk: "学生用不同说法表达同一意思时，聚类会把“表达多样”误当成“理解不稳”。" },
      { title: "先给“理解裁判”做校准", pattern: "让模型当裁判", from: "SEAL · OpenMAIC",
        hypothesis: "LLM 判断“学生是否理解”时，同一回答判 3 次不一致的样本，老师之间的分歧也更大。",
        minimal_experiment: "取 100 条学生的解释，让 LLM 判 3 次；挑 20 条一致、20 条不一致，请两位老师盲评。",
        metric: "两组的老师间一致率。", cost: "约 2 天。", risk: "样本量小，只能看方向。" },
      { title: "统计结构化输出被修补的次数", pattern: "把模型文本修成结构", from: "OpenMAIC",
        hypothesis: "辅导系统里结构化输出被修补的轮次，学生追问或放弃的比例更高。",
        minimal_experiment: "在解析层记录 parse / repair / partial 三种路径，收集一周日志。",
        metric: "被修补轮次 vs 正常轮次的追问率和放弃率。", cost: "半天埋点 + 一周日志。", risk: "长回答更容易被修补，长度是混淆因素。" }
    ] }
  };
  g.info.role = "把三个仓库放在一起时，同一种“套路”会出现在不同的地方。左边是模式，中间三列是它在每个仓库里的样子，右边是由此引出的问题；每个问题点开都有一个最小实验。右侧可以输入你自己的场景，生成迁移实验。这一帧是探索性的：模式是我归纳的，不是代码里写好的。";
})();

/* ---------- method: add the interaction step in front ---------- */
(function(){
  const g = GRAPHS.method;
  g.groups.unshift({ x: 20, y: -250, w: 1660, h: 250, label: "⓪ 互动：先读一遍，再问使用者，再决定画什么", kind: "outer" });
  g.nodes.push(
    { id: "m_scan", x: 180, y: -140, label: "快速扫描", sub: "形状 · 概念 · 能不能跑", w: 240, role: "先花几分钟扫仓库，这样问出的问题是具体的（“你熟悉 ReST-EM 吗？”），而不是空泛的（“你懂强化学习吗？”）。" },
    { id: "m_ask", x: 520, y: -140, label: "问目标与先验", sub: "目标 · 熟悉的概念 · 时间 · 想改什么", w: 300, role: "最多两轮、每轮 1–4 个选择题。第二轮的问题由第一轮的回答决定：理解→问概念；干预→问想改什么；迁移→问用到哪里。" },
    { id: "m_route", x: 900, y: -140, label: "判断：理解还是迁移", sub: "决定侧重和路线", w: 280, role: "理解：结构、数据流、概念、论文→代码。复现：依赖、能跑的部分、偏差。干预：杠杆、预演、feature request。迁移：跨仓库模式和实验卡片。" },
    { id: "m_profile", x: 1300, y: -140, label: "页面里的互动模式", sub: "打开时再问一次 → 个人路线", w: 300, role: "生成的页面打开时也会问目标、熟悉的概念和时间，然后排出个人路线：熟悉的概念收起，理解型路线默认打开“预测模式”。" });
  g.edges.push({ from: "m_scan", to: "m_ask" }, { from: "m_ask", to: "m_route" }, { from: "m_route", to: "m_profile" },
    { from: "m_route", to: "m_shape", label: "理解 / 复现", via: [700, 40] }, { from: "m_route", to: "m_lever", label: "干预" }, { from: "m_route", to: "m_pattern", label: "迁移", kind: "spec" });
  g.edges = g.edges.filter(e => !(e.from === "m_read" && e.to === "m_shape"));
  g.edges.push({ from: "m_read", to: "m_scan", label: "", via: [60, 0] });
  g.scenarios.forEach(s => s.steps.forEach(st => { if (st.e === "m_read>m_shape") st.e = "m_route>m_shape"; }));
  g.info.role = "这是做每一个仓库时走的流程，用同一套图画出来。最上面是互动：先扫一遍仓库，再问使用者的目标和先验，判断这次侧重理解还是迁移。下面四个框是四种能力：理解、复现、干预、发现。";
  g.scenarios.unshift({ name: "按目标分流", intro: "同一个仓库，不同的人得到不同的图。", steps: [
    { e: "m_read>m_scan", p: "49 个文件", c: "先扫一遍：知道仓库长什么样、有哪些概念、哪些能跑" },
    { e: "m_scan>m_ask", p: "具体的选项", c: "再问：目标是什么？这些概念熟悉吗？有多少时间？" },
    { e: "m_ask>m_route", p: "目标 = 迁移", c: "第二个问题随第一个答案变：选了迁移，就问“想用到哪里”" },
    { e: "m_route>m_pattern", p: "迁移", c: "迁移：直接去跨仓库模式，生成实验卡片" },
    { e: "m_route>m_shape", p: "理解", c: "如果是理解：从形状、工作流、知识层开始" },
    { e: "m_route>m_lever", p: "干预", c: "如果是干预：从杠杆和预演开始" },
    { e: "m_route>m_profile", p: "个人路线", c: "页面打开时再问一次，按回答排出个人路线" }] });
})();
