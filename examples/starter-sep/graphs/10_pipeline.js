/* A minimal page written without coordinates: the engine lays it out. */
const R0 = Object.values(RUN.sep)[2];   // the "confabulating" case, real output of get_semantic_ids
def({ id: "meta", repo: "sep", title: "SEP · 起步版", kindLabel: "数据流水线 · 自动布局",
  info: { role: "Semantic Entropy Probes 的三段代码。所有节点都没有写坐标，由引擎自动排版：分组左右排开，组内按数据流分层。" },
  groups: [ { id: "gen", label: "generate_answers.py · 需要 GPU" }, { id: "unc", label: "compute_uncertainty_measures.py" }, { id: "probe", label: "train-latent-probe.ipynb · CPU" } ],
  nodes: [
    { id: "q", group: "gen", label: "问题", sub: "TriviaQA 等", kind: "data" },
    { id: "llm", group: "gen", label: "LLM.generate ×11", sub: "1×T=0.1 · 10×T=1.0", kind: "model", code: { f: "semantic_uncertainty/generate_answers.py", a: 176, b: 181 }, run: "gpu" },
    { id: "ans", group: "gen", label: "10 个回答", kind: "data" },
    { id: "hid", group: "gen", label: "隐藏状态", sub: "TBG · SLT", kind: "data" },
    { id: "clus", group: "unc", label: "语义分组", sub: "get_semantic_ids", code: { f: "semantic_uncertainty/uncertainty/uncertainty_measures/semantic_entropy.py", a: 178, b: 192 }, run: "ran" },
    { id: "se", group: "unc", label: "语义熵", sub: "cluster_assignment_entropy", code: { f: "semantic_uncertainty/uncertainty/uncertainty_measures/semantic_entropy.py", a: 273, b: 278 }, run: "ran" },
    { id: "y", group: "probe", label: "二值化标签", sub: "best_split" },
    { id: "lr", group: "probe", label: "逻辑回归 ×33", sub: "每层一个", kind: "model" },
    { id: "c_entropy", layer: "concept", kind: "concept", label: "熵", sub: "分布有多分散", def: "一个分布越分散，熵越大。", formula: "H = − Σ p log p", here: `这里 p 是每个语义组的占比。实跑：${R0.clusters} 组 → H = ${R0.cluster_assignment_entropy}`, trap: "措辞不同不代表意思不同；只数字面写法会高估不确定性。" },
    { id: "c_nli", layer: "concept", kind: "concept", label: "自然语言推理 NLI", sub: "A 能否推出 B", def: "判断两句话之间是蕴含、中性还是矛盾。", here: "双向蕴含才算同义。", prereq: [] },
    { id: "c_probe", layer: "concept", kind: "concept", label: "线性探针", sub: "从隐藏状态读出一个量", def: "冻结大模型，只在它的隐藏向量上训练一个线性分类器。", prereq: ["c_entropy"] }
  ],
  edges: [
    { from: "q", to: "llm", label: "提示词" }, { from: "llm", to: "ans", label: "文本" }, { from: "llm", to: "hid", label: "hidden_states" },
    { from: "ans", to: "clus", label: "10 个回答" }, { from: "clus", to: "se", label: "ids" }, { from: "se", to: "y", label: "SE" },
    { from: "hid", to: "lr", label: "X" }, { from: "y", to: "lr", label: "y" },
    { from: "c_nli", to: "clus", kind: "concept" }, { from: "c_entropy", to: "se", kind: "concept" }, { from: "c_probe", to: "lr", kind: "concept" }, { from: "c_entropy", to: "c_probe", kind: "prereq" }
  ],
  scenarios: [ { name: "胡编的问题", intro: "模型每次说一个不同的年份。", steps: [
    { e: "q>llm", p: "冷门问题", c: "取一个问题" },
    { par: [ { e: "llm>ans", p: R0.responses.slice(0, 3).join(", ") + "…" }, { e: "llm>hid", p: "(33, 4096)" } ], c: "十次高温回答，同时存下隐藏状态" },
    { e: "ans>clus", p: "10 个回答", c: "按意思分组（仓库原函数实跑）" },
    { e: "clus>se", p: "ids=" + JSON.stringify(R0.semantic_ids), c: `分成 ${R0.clusters} 组` },
    { e: "se>y", p: "SE = " + R0.cluster_assignment_entropy, c: "高语义熵" },
    { e: "y>lr", p: "y = 1", c: "成为探针的训练标签" } ] } ]
});
PAGE = { id: "starter-sep", title: "SEP Lens", h1: "SEP" };
PROFILE = { goals: [ { id: "understand", label: "看懂它怎么工作", sub: "数据流 + 概念", predict: true }, { id: "reproduce", label: "复现", sub: "哪些能跑、哪些要 GPU", repro: true } ],
  times: [ { id: "15", label: "15 分钟" }, { id: "deep", label: "慢慢读" } ] };
FRAMES = [ { id: "flow", name: "流水线", g: "meta", layers: { concept: false } }, { id: "concepts", name: "概念", g: "meta", layers: { concept: true } } ];
ROUTES = { understand: ["concepts", "flow"], reproduce: ["flow"] };
