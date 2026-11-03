/* SEP, mini-sglang, SEAL: system graphs, drill-ins and custom views. */
/* ======================= META: the field ======================= */
def({ id:"meta", title:"三个仓库", kindLabel:"全局地图", world:{w:1500,h:900},
  info:{ role:"上排是一个 LLM 系统的三个环节，下排是你要学的三个仓库各自落在哪一环。仓库之间的连线是它们可以互相借力的地方（虚线是待探索的连接）。",
    extra:`<div class="io"><b>SEP</b><span>2,373 行 Python · 1 个 notebook</span><b>mini-sglang</b><span>9,060 行 Python + CUDA/C++</span><b>SEAL</b><span>11,587 行 Python · 2 个子项目</span></div>` },
  nodes:[
    {id:"serve", x:260, y:110, label:"推理服务", sub:"把请求变成 token", kind:"stage", w:240},
    {id:"unc", x:750, y:110, label:"不确定性评估", sub:"知道自己哪里不可靠", kind:"stage", w:240},
    {id:"self", x:1240, y:110, label:"自我改进", sub:"用新数据更新权重", kind:"stage", w:240},
    {id:"sgl", x:260, y:430, label:"mini-sglang", lines:["形状：请求在进程间的生命周期","调度器 · radix 缓存 · CUDA Graph","9,060 行"], kind:"repo", drill:"sgl",
      role:"一个约 5,000 行核心代码的 SGLang 精简版。没有训练循环，要跟着一个请求穿过几个进程。", io:["HTTP 请求（文本）","流式文本"]},
    {id:"sep", x:750, y:430, label:"Semantic Entropy Probes", lines:["形状：先做标签，再训练便宜的探针","采样 ×11 → 语义分组 → 熵 → 线性探针","2,373 行 + notebook"], kind:"repo", drill:"sep", w:360,
      role:"用一次前向的隐藏状态，近似“采样 10 次再做语义聚类”才能得到的语义熵。", io:["问题","这个回答可能是幻觉的分数"]},
    {id:"seal", x:1240, y:430, label:"SEAL", lines:["形状：嵌套的两层循环","内层 LoRA 试训 · 外层 ReST-EM","11,587 行"], kind:"repo", drill:"seal",
      role:"模型自己写训练数据（self-edit），内层试训打分，外层把高分的写法教给自己。", io:["新文章 / 新任务","更会写 self-edit 的模型"]}
  ],
  edges:[
    {from:"serve", to:"unc", label:"生成的回答"},
    {from:"unc", to:"self", label:"哪里不可靠"},
    {from:"self", to:"serve", label:"新权重上线", kind:"loop", via:[750,-40]},
    {from:"serve", to:"sgl", kind:"control"}, {from:"unc", to:"sep", kind:"control"}, {from:"self", to:"seal", kind:"control"},
    {id:"x1", from:"sgl", to:"sep", label:"SEP 每题采样 11 次：同一前缀，radix 缓存可复用", via:[505,720], kind:"spec"},
    {id:"x2", from:"sep", to:"seal", label:"探针分数能否当便宜的奖励？", via:[995,720], kind:"spec"},
    {id:"x3", from:"seal", to:"sgl", label:"内层每次评估都要起 vLLM + LoRA 推理", via:[750,900]}
  ],
  scenarios:[
    {name:"一圈", intro:"三个环节如何首尾相接。", steps:[
      {e:"serve>unc", p:"回答", c:"推理服务产生回答"},
      {e:"unc>self", p:"不确定性", c:"评估告诉我们哪里不可靠"},
      {e:"self>serve", p:"新权重", c:"自我改进更新权重，再回到推理"}]},
    {name:"仓库之间", intro:"三个仓库彼此可以借力的地方。", steps:[
      {e:"x1", p:"11 次采样", c:"SEP 的采样可以交给推理引擎，并共享前缀缓存"},
      {e:"x2", p:"p(高熵)", c:"一个待探索的问题：语义熵探针能否给 self-edit 打一个便宜的分"},
      {e:"x3", p:"LoRA 推理", c:"SEAL 内层的每次评估本身就是一次推理服务"}]}
  ]
});

/* ======================= SEP ======================= */
def({ id:"sep", repo:"sep", title:"SEP", kindLabel:"系统图 · 数据流水线", world:{w:1640,h:960},
  info:{ role:"三个方框是三份代码。左边两块在 GPU 上生产“昂贵的标签”，右边一块用 CPU 训练一个只看隐藏状态的线性探针。绿色虚线是部署时的捷径：跳过采样和 NLI。" },
  groups:[
    {x:20,y:40,w:580,h:800,label:"generate_answers.py · 需要 GPU"},
    {x:630,y:40,w:400,h:800,label:"compute_uncertainty_measures.py"},
    {x:1060,y:40,w:570,h:800,label:"train-latent-probe.ipynb · CPU"}],
  nodes:[
    {id:"data", x:170, y:160, label:"数据集", sub:"TriviaQA · SQuAD · BioASQ…", kind:"data", io:["HuggingFace datasets","问题 + 参考答案"], role:"每条样本是一个问题和它的参考答案。"},
    {id:"prompt", x:170, y:340, label:"few-shot 提示词", sub:"make_prompt", io:["问题","带示例的提示词"], role:"把问题套进带几个示例的模板。"},
    {id:"llm", x:450, y:340, label:"LLM.generate ×11", sub:"1×T=0.1 · 10×T=1.0", kind:"model", io:["提示词","11 个回答 + log p + 隐藏状态"], role:"第一次低温生成拿来判断对错，其余 10 次高温生成拿来估计不确定性。", code:{f:"semantic_uncertainty/generate_answers.py",a:176,b:181}, run:"gpu"},
    {id:"acc", x:170, y:560, label:"对错标签", sub:"低温回答 vs 参考答案", kind:"data", io:["低温回答","accuracy ∈ {0,1}"]},
    {id:"resp", x:450, y:560, label:"10 个回答", sub:"文本 + token log p", kind:"data", io:["高温生成","[(text, log p)] × 10"]},
    {id:"hid", x:450, y:750, label:"隐藏状态", sub:"TBG · SLT · 每层一份", kind:"data", drill:"sep.hidden", io:["generate 的 hidden_states","(33, 4096) × 2 个位置"], role:"在两个 token 位置上，取所有层的隐藏向量。", code:{f:"semantic_uncertainty/uncertainty/models/huggingface_models.py",a:350,b:355}, run:"gpu"},
    {id:"nli", x:830, y:170, label:"NLI 判官", sub:"DeBERTa-v2-xlarge-mnli", kind:"model", io:["(回答 a, 回答 b)","矛盾 / 中性 / 蕴含"], code:{f:"semantic_uncertainty/uncertainty/uncertainty_measures/semantic_entropy.py",a:39,b:53}, run:"gpu"},
    {id:"clus", x:830, y:400, label:"语义分组", sub:"get_semantic_ids", drill:"sep.cluster", io:["10 个回答","semantic_ids，如 [0,1,2,1,…]"], role:"双向蕴含才算同义；贪心地一组一组拉人。", code:{f:"semantic_uncertainty/uncertainty/uncertainty_measures/semantic_entropy.py",a:178,b:192}, run:"ran"},
    {id:"se", x:830, y:620, label:"语义熵 SE", sub:"cluster_assignment_entropy", io:["semantic_ids","一个标量"], role:"−Σ p(c) log p(c)，p(c) 是每组的占比。探针用的就是这个最简单的版本。", note:"另一个变体 logsumexp_by_id 的 agg='sum' 分支里有一个硬编码的 −5.0（第 227 行）。", code:{f:"semantic_uncertainty/uncertainty/uncertainty_measures/semantic_entropy.py",a:273,b:278}, run:"ran"},
    {id:"split", x:1210, y:170, label:"二值化", sub:"best_split", io:["N 个 SE 值","y ∈ {0,1}"], role:"试 100 个阈值，取让高、低两组方差之和最小的那个。", code:{nb:"semantic_entropy_probes/train-latent-probe.ipynb", cell:16, from:"def best_split", until:"def binarize_entropy"}, run:"synth"},
    {id:"X", x:1210, y:700, label:"特征矩阵 X", sub:"(层 L, 样本 N, 维度 d)", kind:"data", io:["每个样本的 TBG 或 SLT","(33, N, 4096)"]},
    {id:"probe", x:1210, y:440, label:"逻辑回归 ×33", sub:"每层一个", kind:"model", drill:"sep.probe", io:["X[ℓ], y","每层一个探针"], role:"sklearn 默认的 LogisticRegression。大模型冻结，只训练这个线性分类器。", code:{nb:"semantic_entropy_probes/train-latent-probe.ipynb", cell:14, from:"def train_single_metric", maxChars:1400}, run:"synth"},
    {id:"auroc", x:1480, y:440, label:"AUROC", sub:"能否分出对和错", io:["探针分数, 对错","0.5 随机 … 1.0 完美"], role:"把“高语义熵”的概率当成“可能答错”的分数来评估。", w:190}
  ],
  edges:[
    {from:"data", to:"prompt", label:"问题"},
    {from:"prompt", to:"llm", label:"提示词"},
    {from:"llm", to:"acc", label:"第 1 次", lt:.45},
    {from:"llm", to:"resp", label:"第 2–11 次"},
    {from:"llm", to:"hid", label:"hidden_states", via:[700,545], lt:.62},
    {from:"resp", to:"clus", label:"文本"},
    {from:"nli", to:"clus", label:"判断等价", kind:"control"},
    {from:"clus", to:"se", label:"ids"},
    {from:"se", to:"split", label:"SE 值", via:[1030,420]},
    {from:"split", to:"probe", label:"y"},
    {from:"hid", to:"X", label:"存进 pkl"},
    {from:"X", to:"probe", label:"X[ℓ]"},
    {from:"probe", to:"auroc", label:"分数"},
    {from:"acc", to:"auroc", label:"对错", kind:"control", via:[900,960]},
    {id:"infer", from:"hid", to:"probe", label:"部署时：一次前向就够", kind:"infer", via:[850,880]}
  ],
  scenarios:[
    {name:"确定的问题 · Paris", intro:"一个模型很有把握的问题，看数据怎么一路变成“低熵”标签。", skipEdges:["infer"], steps:[
      {e:"data>prompt", p:"Q: capital of France?", c:"取一个问题"},
      {e:"prompt>llm", p:"提示词 + 示例", c:"拼成提示词，送进模型"},
      {par:[{e:"llm>acc", p:"Paris ✓"}, {e:"llm>resp", p:"Paris, It's Paris, …"}, {e:"llm>hid", p:"(33, 4096)"}], c:"一次低温 + 十次高温生成；同时存下隐藏状态"},
      {e:"resp>clus", p:"10 个回答", c:"把 10 个回答送去分组"},
      {e:"nli>clus", p:"18 次调用", c:"NLI 判官两两比较，只调用了 18 次（全部同义）"},
      {e:"clus>se", p:"ids=[0×10]", c:"全部落进同一组"},
      {e:"se>split", p:"SE = 0.00", c:"语义熵为 0"},
      {e:"split>probe", p:"y = 0（低）", c:"标签：低语义熵"},
      {e:"hid>X", p:"一行特征", c:"隐藏状态成为训练特征"},
      {e:"X>probe", p:"X[ℓ] ∈ ℝ⁴⁰⁹⁶", c:"探针学：从 h 预测 y"}]},
    {name:"胡编 · 年份", intro:"模型在编答案：每次说一个不同的年份。", skipEdges:["infer"], steps:[
      {e:"data>prompt", p:"Q: 冷门问题", c:"一个模型其实不知道的问题"},
      {e:"prompt>llm", p:"提示词 + 示例", c:"送进模型"},
      {par:[{e:"llm>acc", p:"1912 ✗"}, {e:"llm>resp", p:"1912, 1915, 1913, …"}, {e:"llm>hid", p:"(33, 4096)"}], c:"十次高温回答说了三种年份"},
      {e:"resp>clus", p:"10 个回答", c:"送去分组"},
      {e:"nli>clus", p:"48 次调用", c:"NLI 被调用 48 次：每开一个新组，都要和剩下的人比一遍"},
      {e:"clus>se", p:"ids=[0,1,2,1,0,2,1,0,2,1]", c:"分成三组，占比 0.3 / 0.4 / 0.3"},
      {e:"se>split", p:"SE = 1.09", c:"语义熵接近 ln 3"},
      {e:"split>probe", p:"y = 1（高）", c:"标签：高语义熵"},
      {e:"hid>X", p:"一行特征", c:"隐藏状态成为训练特征"},
      {e:"X>probe", p:"X[ℓ]", c:"探针学到：这种隐藏状态 → 可能胡编"},
      {e:"probe>auroc", p:"p(高) → 分数", c:"评估：用这个分数区分对和错"},
      {e:"acc>auroc", p:"对错标签", c:"和真实对错比较，得到 AUROC"}]},
    {name:"部署时 · 只走一次前向", intro:"探针训练好之后：不采样、不调用 NLI。", skip:["acc","resp","nli","clus","se","split","X"], steps:[
      {e:"data>prompt", p:"新问题", c:"来了一个新问题"},
      {e:"prompt>llm", p:"一次前向", c:"只做一次前向，甚至不用开始生成"},
      {e:"llm>hid", p:"TBG (33, 4096)", c:"取提示词末尾的隐藏状态"},
      {e:"infer", p:"h_ℓ", c:"直接喂给训练好的探针"},
      {e:"probe>auroc", p:"p(高熵)", c:"得到“可能胡编”的分数。灰掉的部分全部省掉了"}]}
  ]
});

/* ======================= mini-sglang ======================= */
def({ id:"sgl", repo:"sgl", title:"mini-sglang", kindLabel:"系统图 · 进程与数据流", world:{w:1600,h:920},
  info:{ role:"三个大框是三类进程，它们之间只通过 ZMQ 消息通信。右下的子框是 GPU 上的引擎。橙色的环是 decode 循环：采样出的 token 直接写回 GPU，下一轮从那里读。" },
  groups:[
    {x:20,y:170,w:230,h:720,label:"前端进程 · server/"},
    {x:275,y:170,w:240,h:720,label:"分词进程 · tokenizer/"},
    {x:540,y:30,w:1045,h:860,label:"调度进程（每张 GPU 一个）· scheduler/ engine/", kind:"outer"},
    {x:1005,y:360,w:565,h:510,label:"Engine · GPU", kind:"sub"}],
  nodes:[
    {id:"client", x:135, y:70, label:"客户端", kind:"external", w:190},
    {id:"api", x:135, y:300, label:"API Server", sub:"/v1/chat/completions", w:200, io:["HTTP JSON","TokenizeMsg{uid, text}"], code:{f:"python/minisgl/server/api_server.py",a:228,b:232}, run:"gpu"},
    {id:"tok", x:395, y:300, label:"Tokenizer", sub:"chat template → ids", w:210, io:["TokenizeMsg","UserMsg{uid, int32 ids}"], code:{f:"python/minisgl/tokenizer/tokenize.py",a:14,b:30}},
    {id:"detok", x:395, y:760, label:"Detokenizer", sub:"增量解码", w:210, io:["DetokenizeMsg{uid, token}","UserReply{文本片段}"], role:"一个汉字或 emoji 可能跨几个 token，要拼完整才输出。", code:{f:"python/minisgl/tokenizer/detokenize.py",a:70,b:76}},
    {id:"recv", x:690, y:130, label:"收消息", sub:"_process_one_msg", io:["UserMsg","PendingReq"], code:{f:"python/minisgl/scheduler/scheduler.py",a:169,b:176}},
    {id:"prefill", x:690, y:400, label:"PrefillManager", sub:"预算 8192 · 切块", io:["PendingReq 队列","prefill 批 / ChunkedReq"], role:"按到达顺序塞进 token 预算；放不下的长提示词被切块，下一轮继续。", code:{f:"python/minisgl/scheduler/prefill.py",a:72,b:77}},
    {id:"radix", x:900, y:200, label:"Radix 前缀缓存", sub:"match · insert · evict", kind:"data", drill:"sgl.radix", w:200, io:["token ids[:len−1]","命中长度 + KV 槽位"], role:"相同前缀的 KV 只算一次。调度器只匹配 len−1，保证至少算一个 token 拿 logits。", code:{f:"python/minisgl/kvcache/radix_cache.py",a:211,b:226}, run:"ran"},
    {id:"decode", x:690, y:650, label:"DecodeManager", sub:"运行中的请求", io:["所有未结束的请求","decode 批（每个 1 token）"], code:{f:"python/minisgl/scheduler/decode.py",a:32,b:35}},
    {id:"batch", x:900, y:520, label:"组 Batch", sub:"先 prefill，后 decode", w:190, io:["prefill 批 或 decode 批","Batch + page table + positions"], code:{f:"python/minisgl/scheduler/scheduler.py",a:219,b:225}},
    {id:"model", x:1160, y:520, label:"模型 forward", sub:"Qwen3 · 28 层", kind:"model", drill:"sgl.model", w:200, io:["Batch（从全局 Context 读）","logits [bs, vocab]"], code:{f:"python/minisgl/engine/engine.py",a:191,b:200}, run:"gpu"},
    {id:"cg", x:1430, y:430, label:"CUDA Graph", sub:"仅 decode · bs ≤ 160", kind:"model", w:200, io:["decode 批","回放录好的整轮前向"], code:{f:"python/minisgl/engine/graph.py",a:149,b:158}, run:"gpu"},
    {id:"kv", x:1430, y:610, label:"KV 池（显存）", sub:"store_kv / 读 K,V", kind:"data", w:200, io:["每层新算的 K, V","缓存的 K, V"], code:{f:"python/minisgl/kvcache/mha_pool.py",a:45,b:56}, run:"gpu"},
    {id:"sampler", x:1160, y:760, label:"Sampler", sub:"argmax · top-k · top-p", kind:"model", w:200, io:["logits","next token"], code:{f:"python/minisgl/engine/sample.py",a:24,b:45}, run:"gpu"},
    {id:"pool", x:1430, y:790, label:"token_pool", sub:"GPU 上的 token 表", kind:"data", w:200, io:["next token","下一轮的 input_ids"], code:{f:"python/minisgl/scheduler/scheduler.py",a:228,b:232}}
  ],
  edges:[
    {from:"client", to:"api", label:"HTTP", bend:-30, lt:.3},
    {from:"api", to:"client", label:"SSE 流", bend:-30, lt:.7},
    {from:"api", to:"tok", label:"ZMQ"},
    {from:"tok", to:"recv", label:"int32 ids", via:[540,140]},
    {from:"recv", to:"prefill", label:"PendingReq"},
    {from:"prefill", to:"radix", label:"match", bend:25},
    {from:"radix", to:"prefill", label:"命中", bend:25},
    {from:"prefill", to:"batch", label:"prefill 批"},
    {from:"decode", to:"batch", label:"decode 批"},
    {from:"batch", to:"model", label:"Batch"},
    {from:"cg", to:"model", label:"回放", kind:"control"},
    {from:"model", to:"kv", label:"写 / 读 KV"},
    {from:"radix", to:"kv", label:"槽位 = KV 下标", kind:"control", lt:.3},
    {from:"model", to:"sampler", label:"logits"},
    {from:"sampler", to:"pool", label:"token"},
    {from:"pool", to:"batch", label:"下一轮输入", kind:"loop", via:[1000,900]},
    {from:"sampler", to:"decode", label:"未结束", lt:.4},
    {from:"sampler", to:"detok", label:"DetokenizeMsg", via:[800,860]},
    {from:"detok", to:"api", label:"文本片段", via:[260,560]}
  ],
  scenarios:[
    {name:"第一个请求 · 缓存为空", intro:"一个请求从进来到第一个字流回去。", steps:[
      {e:"client>api", p:"“…Explain KV cache”", c:"客户端发来请求"},
      {e:"api>tok", p:"TokenizeMsg", c:"前端分配 uid，交给分词进程"},
      {e:"tok>recv", p:"9 个 int32", c:"文本变成 9 个 token id，进入调度器"},
      {e:"recv>prefill", p:"PendingReq", c:"进入等待队列"},
      {e:"prefill>radix", p:"match ids[:8]", c:"先查前缀缓存"},
      {e:"radix>prefill", p:"命中 0", c:"缓存是空的，一个都没命中"},
      {e:"prefill>batch", p:"prefill 9 tok", c:"整段提示词组成一个 prefill 批"},
      {e:"batch>model", p:"[1 × 9]", c:"送进模型前向"},
      {e:"model>kv", p:"写 9 个槽 ×28 层", c:"每层把新算的 K、V 写进显存池"},
      {e:"model>sampler", p:"logits[1, 151936]", c:"prefill 只保留最后一个位置的 logits"},
      {par:[{e:"sampler>pool", p:"token #1"}, {e:"sampler>detok", p:"DetokenizeMsg"}], c:"采样出第一个 token，一份写回 GPU，一份发去反分词"},
      {e:"detok>api", p:"“A”", c:"拼成文本片段"},
      {e:"api>client", p:"data: A", c:"以 SSE 推回客户端"}]},
    {name:"第二个请求 · 共享前缀", intro:"同一个系统提示词，问了不同的问题。", steps:[
      {e:"client>api", p:"“…Explain radix tree”", c:"第二个请求"},
      {e:"api>tok", p:"TokenizeMsg", c:"交给分词"},
      {e:"tok>recv", p:"9 个 int32", c:"同样 9 个 token，前 7 个和第一个请求一样"},
      {e:"recv>prefill", p:"PendingReq", c:"进入队列"},
      {e:"prefill>radix", p:"match ids[:8]", c:"查前缀缓存"},
      {e:"radix>prefill", p:"命中 7 → 只算 2", c:"命中 7 个 token，节点在“Explain”处被切开（进入 ⤢ 看树）"},
      {e:"radix>kv", p:"槽位 0–6 复用", c:"命中的部分直接复用已有的 KV 槽位"},
      {e:"prefill>batch", p:"prefill 2 tok", c:"只需要为 2 个新 token 做 prefill"},
      {e:"batch>model", p:"[1 × 2]", c:"前向的计算量从 9 降到 2"}]},
    {name:"decode 循环", intro:"两个请求都进入生成阶段之后，每一轮发生什么。", steps:[
      {e:"decode>batch", p:"2 个运行中请求", c:"没有新请求等待，组一个 decode 批"},
      {e:"cg>model", p:"bs=2 的图", c:"decode 形状固定，直接回放录好的 CUDA Graph"},
      {e:"batch>model", p:"[2 × 1]", c:"每个请求只算 1 个新 token"},
      {e:"model>kv", p:"读 10 + 3 个旧 KV", c:"注意力读缓存里的 K、V，并写入新的一个"},
      {e:"model>sampler", p:"logits[2, 151936]", c:"两个请求各自的下一个词分布"},
      {e:"sampler>pool", p:"2 个 token", c:"写回 GPU 的 token 表"},
      {e:"pool>batch", p:"下一轮 input_ids", c:"下一轮直接从 GPU 读输入，CPU 不在路径上"},
      {e:"sampler>decode", p:"都未结束", c:"没遇到 EOS，继续留在运行队列"}]},
    {name:"长提示词 · 分块", intro:"一个 20,000 token 的提示词遇到 8,192 的 prefill 预算。", steps:[
      {e:"tok>recv", p:"20000 tok", c:"一个很长的提示词"},
      {e:"recv>prefill", p:"PendingReq", c:"进入队列"},
      {e:"prefill>batch", p:"块 1：8192", c:"超出预算，切出第一块，变成 ChunkedReq"},
      {e:"batch>model", p:"[1 × 8192]", c:"前向"},
      {e:"model>sampler", p:"采样被丢弃", c:"没算完的块不能产出 token"},
      {e:"prefill>batch", p:"块 2：8192", c:"ChunkedReq 回到队首，下一轮继续"},
      {e:"batch>model", p:"[1 × 8192]", c:"前向"},
      {e:"prefill>batch", p:"块 3：3616", c:"最后一块"},
      {e:"batch>model", p:"[1 × 3616]", c:"前向"},
      {e:"model>sampler", p:"第一个有效 token", c:"整段算完，才产出第一个 token"}]}
  ]
});

def({ id:"sgl.model", repo:"sgl", title:"模型 forward", kindLabel:"模型内部 · 张量形状", world:{w:1560,h:720},
  info:{ role:"按 Qwen3-0.6B 的 config 标形状（hidden 1024、16 个 Q 头、8 个 KV 头、head_dim 128、MLP 3072、28 层；以模型 config.json 为准）。播放时包上写的是张量形状。" },
  groups:[{x:420,y:60,w:820,h:620,label:"Qwen3DecoderLayer × 28 · models/qwen3.py"}],
  nodes:[
    {id:"ids", x:110, y:360, label:"input_ids", sub:"从全局 Context 读", kind:"data", w:180, code:{f:"python/minisgl/models/qwen3.py",a:77,b:80}},
    {id:"emb", x:300, y:360, label:"Embedding", sub:"词表 151936", w:170},
    {id:"n1", x:560, y:170, label:"RMSNorm", sub:"+ 残差", w:180, code:{f:"python/minisgl/models/qwen3.py",a:34,b:41}},
    {id:"qkv", x:830, y:170, label:"qkv_proj", sub:"一次算出 Q K V", w:180},
    {id:"rope", x:1100, y:170, label:"QK-Norm + RoPE", sub:"位置编码", w:200},
    {id:"attn", x:1100, y:400, label:"Attention", sub:"FlashAttention / FlashInfer", kind:"model", w:230, code:{f:"python/minisgl/layers/attention.py",a:47,b:57}},
    {id:"o", x:830, y:400, label:"o_proj", w:180},
    {id:"n2", x:560, y:400, label:"RMSNorm", sub:"+ 残差", w:180},
    {id:"mlp", x:560, y:600, label:"GatedMLP", sub:"gate·up → SiLU×mul → down", w:260},
    {id:"kv", x:1100, y:600, label:"KV 池", sub:"每层一份", kind:"data", w:180},
    {id:"fn", x:1400, y:600, label:"final norm", w:170},
    {id:"head", x:1400, y:420, label:"LM Head", sub:"prefill 只取最后位置", w:220},
    {id:"logits", x:1400, y:230, label:"logits", kind:"data", w:170}
  ],
  edges:[
    {from:"ids", to:"emb"}, {from:"emb", to:"n1", via:[420,170]},
    {from:"n1", to:"qkv"}, {from:"qkv", to:"rope"}, {from:"rope", to:"attn"},
    {from:"attn", to:"kv", label:"store / read", bend:30}, {from:"attn", to:"o"}, {from:"o", to:"n2"}, {from:"n2", to:"mlp"},
    {id:"next", from:"mlp", to:"n1", label:"下一层", kind:"loop", via:[400,390]},
    {from:"mlp", to:"fn", via:[980,760]}, {from:"fn", to:"head"}, {from:"head", to:"logits"}
  ],
  scenarios:[
    {name:"prefill · 9 个 token", intro:"第一个请求的 9 个 token 一次性穿过模型。", steps:[
      {e:"ids>emb", p:"[9]", c:"9 个 token id"},
      {e:"emb>n1", p:"[9, 1024]", c:"每个 token 变成 1024 维向量"},
      {e:"n1>qkv", p:"[9, 1024]", c:"归一化"},
      {e:"qkv>rope", p:"[9, 2048 | 1024 | 1024]", c:"一次线性层算出 Q（16 头）、K、V（各 8 头）"},
      {e:"rope>attn", p:"q[9,16,128] k[9,8,128]", c:"加上位置信息"},
      {e:"attn>kv", p:"写 9 个 K,V", c:"把这 9 个位置的 K、V 存进显存，之后的 decode 就不用重算"},
      {e:"attn>o", p:"[9, 2048]", c:"每个位置只看它之前的位置（因果注意力）"},
      {e:"o>n2", p:"[9, 1024]", c:"投影回 1024 维，加残差"},
      {e:"n2>mlp", p:"[9, 1024]", c:"进入 MLP"},
      {e:"next", p:"[9, 1024] ×28", c:"同样的结构重复 28 层"},
      {e:"mlp>fn", p:"[9, 1024]", c:"最后一层的输出"},
      {e:"fn>head", p:"[9, 1024]", c:"归一化"},
      {e:"head>logits", p:"[1, 151936]", c:"prefill 只保留最后一个位置，得到下一个词的分布"}]},
    {name:"decode · 2 个请求", intro:"decode 时每个请求只算 1 个新 token。", steps:[
      {e:"ids>emb", p:"[2]", c:"两个请求各 1 个 token"},
      {e:"emb>n1", p:"[2, 1024]", c:"嵌入"},
      {e:"n1>qkv", p:"[2, 1024]", c:"归一化"},
      {e:"qkv>rope", p:"[2, 2048 | 1024 | 1024]", c:"Q K V"},
      {e:"rope>attn", p:"q[2,16,128]", c:"每个请求只有一个 query"},
      {e:"attn>kv", p:"读 10 + 3 个 K,V", c:"从缓存读出各自的历史 K、V（请求 1 有 10 个，请求 2 有 3 个），写入 1 个新的"},
      {e:"attn>o", p:"[2, 2048]", c:"计算量很小，瓶颈是读显存"},
      {e:"o>n2", p:"[2, 1024]", c:"投影 + 残差"},
      {e:"n2>mlp", p:"[2, 1024]", c:"MLP"},
      {e:"next", p:"×28", c:"28 层"},
      {e:"mlp>fn", p:"[2, 1024]", c:"输出"},
      {e:"fn>head", p:"[2, 1024]", c:"归一化"},
      {e:"head>logits", p:"[2, 151936]", c:"两个请求各自的下一个词分布"}]}
  ]
});

/* ======================= SEAL ======================= */
def({ id:"seal", repo:"seal", title:"SEAL", kindLabel:"系统图 · 嵌套循环", world:{w:1600,h:880},
  info:{ role:"实线大框是外层 ReST-EM，它更新会写 self-edit 的模型 θ。虚线框是内层：每个 self-edit 训练一个临时 LoRA φ 来打分，打完就扔。左边的蓝色环是“新模型回到下一轮”。" },
  groups:[
    {x:20,y:20,w:1560,h:840,label:"外层 · ReST-EM · 更新 θ", kind:"outer"},
    {x:560,y:290,w:1000,h:270,label:"内层 · TTT server · 每个 self-edit 一次 · 临时 LoRA φ，用完即弃", kind:"dash"}],
  nodes:[
    {id:"article", x:150, y:150, label:"SQuAD 文章 C", sub:"标题 + 段落", kind:"data", w:200},
    {id:"gen", x:430, y:150, label:"θ 写 self-edit", sub:"make_squad_data · k=5", kind:"model", w:220, io:["文章","5 段“推论”文本"], role:"提示词让模型列出这篇文章的各种推论。", code:{f:"general-knowledge/src/data_generation/make_squad_data.py",a:17,b:22}, run:"ran"},
    {id:"se", x:730, y:150, label:"self-edits ×5", sub:"T = 1.0 采样", kind:"data", w:200},
    {id:"seqs", x:690, y:430, label:"切成训练序列", sub:"build_train_sequences", drill:"seal.seqs", w:220, io:["一个 self-edit","若干条“标题⏎内容”+ 原文"], code:{f:"general-knowledge/src/utils.py",a:231,b:237}, run:"ran"},
    {id:"lora", x:950, y:430, label:"LoRA 试训", sub:"r32 · 10 epoch · lr 1e-3", kind:"model", w:220, io:["训练序列","adapter φ"], role:"在冻结的 θ 上训练一个新的 LoRA。", note:"padding 到 2048，labels 直接复制 input_ids，padding 位置也算了 loss；LoraConfig 没指定 target_modules。", code:{f:"general-knowledge/src/inner/TTT_server.py",a:252,b:259}, run:"gpu"},
    {id:"ans", x:1200, y:430, label:"不给原文答题", sub:"vLLM + adapter", kind:"model", w:200, io:["问题（无原文）","答案"], role:"切断从上下文读答案的捷径，只能靠刚写进权重的知识。"},
    {id:"grade", x:1440, y:430, label:"GPT-4.1 判分", sub:"对 / 错", kind:"external", w:200, code:{f:"general-knowledge/src/inner/TTT_server.py",a:97,b:103}, run:"gpu"},
    {id:"reward", x:1440, y:700, label:"奖励 r", sub:"3 次平均 · adapter_mean", kind:"data", w:220, code:{f:"general-knowledge/src/query/query_server.py",a:186,b:194}},
    {id:"select", x:1110, y:700, label:"E-step 取第一名", sub:"build_SFT_dataset", w:220, io:["每篇 5 个 (SE, r)","每篇 1 个 (prompt, SE)"], role:"按奖励排序取第一。没有阈值：奖励全为 0 也会留一个。", code:{f:"general-knowledge/src/EM/build_SFT_dataset.py",a:20,b:30}, run:"ran"},
    {id:"sft", x:780, y:700, label:"M-step SFT", sub:"train_SFT · LoRA r64", kind:"model", w:220, io:["(prompt, 最佳 SE)","合并后的新权重"], role:"loss 只在 self-edit 的 token 上（靠 TRL 对 prompt-completion 数据的默认行为）。", code:{f:"general-knowledge/src/EM/train_SFT.py",a:62,b:85}, run:"gpu"},
    {id:"newm", x:430, y:700, label:"新模型 θ′", sub:"models/iter1", kind:"model", w:200},
    {id:"arc", x:170, y:430, label:"同一框架 · ARC", sub:"self-edit = 训练配置", kind:"portal", drill:"seal.arc", w:220, role:"在 ARC 网格推理上，self-edit 不是文字，而是一份 JSON 训练配置。"}
  ],
  edges:[
    {from:"article", to:"gen", label:"文章"},
    {from:"gen", to:"se", label:"采样"},
    {from:"se", to:"seqs", label:"逐个"},
    {from:"seqs", to:"lora", label:"序列"},
    {from:"lora", to:"ans", label:"φ"},
    {from:"ans", to:"grade", label:"答案"},
    {from:"grade", to:"reward", label:"对错"},
    {from:"reward", to:"select", label:"5 个 r"},
    {from:"select", to:"sft", label:"最佳 SE"},
    {from:"sft", to:"newm", label:"merge"},
    {id:"loop", from:"newm", to:"gen", label:"下一轮", kind:"loop", via:[330,425]},
    {from:"arc", to:"gen", label:"同样的外层", kind:"control"}
  ],
  scenarios:[
    {name:"一轮迭代", intro:"一篇文章走完一圈外层循环。", steps:[
      {e:"article>gen", p:"Apollo 11", c:"一篇文章"},
      {e:"gen>se", p:"SE₁ … SE₅", c:"模型为它写 5 个不同的 self-edit"},
      {e:"se>seqs", p:"SE_B：4 条推论", c:"取出其中一个"},
      {e:"seqs>lora", p:"5 条序列", c:"切成 4 条推论 + 原文"},
      {e:"lora>ans", p:"adapter φ_B", c:"训练一个临时 LoRA"},
      {e:"ans>grade", p:"答案 × |Q|", c:"不给原文，回答关于这篇文章的问题"},
      {e:"grade>reward", p:"r_B = 0.67", c:"判分，3 次取平均。内层对 5 个 self-edit 各做一遍"},
      {e:"reward>select", p:"A .33 B .67 C 0 D .56 E .44", c:"5 个奖励（示意值）"},
      {e:"select>sft", p:"(prompt, SE_B)", c:"只留奖励最高的 B"},
      {e:"sft>newm", p:"merge LoRA", c:"教模型下次写出 B 这样的 self-edit"},
      {e:"loop", p:"θ′", c:"新模型回到第一步，开始下一轮"}]},
    {name:"按脚本原样跑", intro:"query_server.sh 里 SPLIT_NEWLINES=1，但第 41 行判断的是 == \"true\"。", steps:[
      {e:"se>seqs", p:"SE_B：4 条推论", c:"同一个 self-edit"},
      {e:"seqs>lora", p:"只有 2 条序列", c:"--split_newlines 从未被传入：整段推论算一条，加上原文共 2 条（进入 ⤢ 对比）"},
      {e:"lora>ans", p:"adapter φ", c:"后面的奖励都建立在这种切法上。复现前先决定用哪一种"}]},
    {name:"奖励全为 0", intro:"5 个 self-edit 都没让模型答对任何问题。", steps:[
      {e:"grade>reward", p:"全错", c:"每个 adapter 都答错了"},
      {e:"reward>select", p:"0, 0, 0, 0, 0", c:"5 个奖励都是 0"},
      {e:"select>sft", p:"仍保留第一个", c:"没有阈值，sorted 后取 [:1]，一个 0 分的 self-edit 进了训练集"},
      {e:"sft>newm", p:"学了无效写法", c:"可以做的改进实验：只保留比基线好的"}]}
  ]
});

/* seal.seqs : built from the real run */
(function(){
  const g = RUN.seal.gk, nodes = [], edges = [];
  const short = s => s.replace(/^Apollo 11\n/, "").slice(0, 34) + (s.length > 46 ? "…" : "");
  nodes.push({id:"raw", x:170, y:340, label:"self-edit 原文", sub:"4 行推论（手写示例）", kind:"data", w:230, io:["模型输出的一段文字","—"], role:g.completion.replace(/\n/g,"<br>")});
  nodes.push({id:"cut", x:450, y:340, label:"按 --- 切段", sub:"_split_segments", w:200, code:{f:"general-knowledge/src/utils.py",a:188,b:189}});
  nodes.push({id:"flag", x:720, y:340, label:"split_newlines ?", sub:"True: 一行一条", w:220, code:{f:"general-knowledge/src/utils.py",a:231,b:237}, run:"ran"});
  g.seqs_split.forEach((s,i) => { nodes.push({id:"a"+i, x:1120, y:60+i*92, label:i===g.seqs_split.length-1?"原文":`推论 ${i+1}`, sub:short(s), kind:i===g.seqs_split.length-1?"data":"process", w:340, role:escD(s).replace(/\n/g,"<br>")}); edges.push({id:"ea"+i, from:"flag", to:"a"+i, label:i===0?"True":""}); });
  g.seqs_default.forEach((s,i) => { nodes.push({id:"b"+i, x:1120, y:600+i*92, label:i===g.seqs_default.length-1?"原文":"整段推论（一条）", sub:short(s), kind:i===g.seqs_default.length-1?"data":"process", w:340, role:escD(s).replace(/\n/g,"<br>")}); edges.push({id:"eb"+i, from:"flag", to:"b"+i, label:i===0?"False · 脚本实际":"", kind:"control"}); });
  edges.unshift({from:"raw", to:"cut"}, {from:"cut", to:"flag"});
  def({ id:"seal.seqs", repo:"seal", title:"切成训练序列", kindLabel:"节点内部", world:{w:1330,h:800},
    info:{ role:"同一个 self-edit，两种切法。这是在 CPU 上真实运行 build_train_sequences 的结果。右上是论文想要的（一行一条），右下是按脚本原样运行时的实际情况。" },
    nodes, edges,
    scenarios:[
      {name:"split_newlines = True", intro:"一行一条推论，每条都单独训练。", skipEdges:g.seqs_default.map((_,i)=>"eb"+i), steps:[
        {e:"raw>cut", p:"4 行文字", c:"模型写出的推论"},
        {e:"cut>flag", p:"1 段", c:"没有 ---，只有一段"},
        {par:g.seqs_split.map((_,i)=>({e:"ea"+i, p:i===g.seqs_split.length-1?"+ 原文":"一行"})), c:`拆成 ${g.seqs_split.length} 条：每行一条，最后总会附上原文`}]},
      {name:"按脚本原样（False）", intro:"--split_newlines 没有被传入。", skipEdges:g.seqs_split.map((_,i)=>"ea"+i), steps:[
        {e:"raw>cut", p:"4 行文字", c:"同一段推论"},
        {e:"cut>flag", p:"1 段", c:"一段"},
        {par:g.seqs_default.map((_,i)=>({e:"eb"+i, p:i===0?"整段":"+ 原文"})), c:`只有 ${g.seqs_default.length} 条：整段推论一条，原文一条`}]}
    ]});
})();

def({ id:"seal.arc", repo:"seal", title:"ARC 场景", kindLabel:"另一个场景 · 同一框架", world:{w:1560,h:760},
  info:{ role:"self-edit 换成了一份训练配置：用哪些数据增强、loss 算在哪、学习率和 epoch。奖励是二值的：测试网格完全答对才算 1。" },
  groups:[{x:520,y:200,w:760,h:300,label:"内层 · 每份配置训练一个 LoRA（reset_lora 后从零开始）", kind:"dash"}],
  nodes:[
    {id:"task", x:150, y:110, label:"ARC 任务", sub:"几组示例网格 + 测试网格", kind:"data", w:240},
    {id:"gen", x:430, y:110, label:"θ 写配置", sub:"Llama-3.2-1B · T=0.8", kind:"model", w:220, code:{f:"few-shot/utils/prompts.py",a:3,b:41}},
    {id:"cfg", x:750, y:110, label:"配置 JSON", sub:"basic · size · chain · repeat …", kind:"data", w:280},
    {id:"aug", x:650, y:330, label:"get_augmenters", sub:"0 – 23 个增强器", w:220, code:{f:"few-shot/self-edit.py",a:151,b:166}, run:"ran", drill:"seal.arcgrid"},
    {id:"loo", x:650, y:450, label:"留一法 × 增强", sub:"造训练数据", w:220},
    {id:"ttt", x:1000, y:330, label:"LoRA 试训", sub:"r128 · 每任务重置", kind:"model", w:220, code:{f:"few-shot/arclib/update_model.py",a:133,b:140}, run:"gpu"},
    {id:"pred", x:1000, y:450, label:"预测测试网格", sub:"pass@2 投票", kind:"model", w:220, run:"gpu"},
    {id:"r", x:1420, y:450, label:"r ∈ {0, 1}", sub:"完全匹配才是 1", kind:"data", w:200},
    {id:"bc", x:1420, y:640, label:"只留 r = 1", sub:"BC-self-edit.py", w:200, code:{f:"few-shot/BC-self-edit.py",a:64,b:80}},
    {id:"sft", x:1000, y:640, label:"SFT 配置 token", sub:"按 Llama-3 token id 做 mask", kind:"model", w:260, note:"mask 依赖硬编码的 128007, 271。换模型家族时找不到这对 id，会静默地在整段上算 loss。", code:{f:"few-shot/BC-self-edit.py",a:100,b:110}, run:"gpu"},
    {id:"newm", x:430, y:640, label:"新模型 θ′", kind:"model", w:200}
  ],
  edges:[
    {from:"task", to:"gen"}, {from:"gen", to:"cfg", label:"JSON"}, {from:"cfg", to:"aug", label:"4 个开关"},
    {from:"task", to:"loo", label:"示例网格", via:[150,450]},
    {from:"aug", to:"loo", label:"增强器"}, {from:"loo", to:"ttt", label:"训练数据", via:[830,390]},
    {from:"cfg", to:"ttt", label:"lr · epoch · loss 位置", kind:"control", via:[1000,180]},
    {from:"ttt", to:"pred"}, {from:"pred", to:"r", label:"2 次尝试"},
    {from:"r", to:"bc"}, {from:"bc", to:"sft", label:"(prompt, 配置)"}, {from:"sft", to:"newm", label:"merge"},
    {id:"loop", from:"newm", to:"gen", label:"下一轮", kind:"loop", bend:-60}
  ],
  scenarios:[
    {name:"配置答对了", intro:"一份打开 basic + size 的配置。", steps:[
      {e:"task>gen", p:"3 组网格", c:"把示例网格写成文本给模型"},
      {e:"gen>cfg", p:"{basic:T, size:T, …}", c:"模型写出一份配置"},
      {e:"cfg>aug", p:"basic + size", c:"映射到具体的增强器"},
      {e:"aug>loo", p:"14 个增强器", c:"旋转、翻转、放大……共 14 个（进入 ⤢ 看网格）"},
      {e:"task>loo", p:"示例", c:"留一法：每个示例轮流当测试"},
      {e:"loo>ttt", p:"增强后的数据", c:"训练一个 LoRA"},
      {e:"cfg>ttt", p:"lr · epoch", c:"学习率和 epoch 也来自配置"},
      {e:"ttt>pred", p:"adapter", c:"预测测试网格"},
      {e:"pred>r", p:"完全匹配", c:"两次尝试中有一次完全一致"},
      {e:"r>bc", p:"r = 1", c:"保留"},
      {e:"bc>sft", p:"(prompt, 配置)", c:"只在配置的 token 上算 loss"},
      {e:"sft>newm", p:"merge", c:"模型学会写这类配置"},
      {e:"loop", p:"θ′", c:"下一轮"}]},
    {name:"配置无效", intro:"四个开关全关，或 epoch × 数据量超过 375。", steps:[
      {e:"gen>cfg", p:"{全部 false}", c:"一份没有增强的配置"},
      {e:"cfg>aug", p:"0 个增强器", c:"self-edit.py 会把 epoch 设为 0"},
      {e:"ttt>pred", p:"空 LoRA", c:"相当于没训练"},
      {e:"pred>r", p:"答错", c:"测试网格不匹配"},
      {e:"r>bc", p:"r = 0", c:"被过滤掉，不进入训练集"}]}
  ]
});

/* ======================= custom subgraphs ======================= */
const CL = i => `var(--c${i%4})`;

def({ id:"sep.cluster", repo:"sep", title:"语义分组", kindLabel:"节点内部 · 算法过程", world:{w:1180,h:760},
  info:{ role:"get_semantic_ids 的贪心过程，用真实运行的结果重放。每条线是一次“双向蕴含”比较（调用 NLI 两次）：绿色是同义，红色是不同。" },
  custom(ctx){
    const P = Object.entries(RUN.sep).map(([k,v]) => ({name:{"confident (Q: capital of France?)":"Paris","lexically diverse but semantically sure (Q: when did Titanic sink?)":"Titanic · 写法多样","confabulating (Q: obscure fact)":"胡编 · 年份"}[k]||k, v}));
    let si = 0, steps = [], k = 0;
    const g = ctx.g; const cx = 430, cy = 390, rx = 330, ry = 280;
    let pos, nodeEls, lineG, panel;
    function build(){
      const v = P[si].v, n = v.responses.length; g.innerHTML = ""; lineG = ctx.el("g",{},g);
      pos = v.responses.map((_,i) => { const a = -Math.PI/2 + i*2*Math.PI/n; return [cx+rx*Math.cos(a), cy+ry*Math.sin(a)]; });
      nodeEls = v.responses.map((r,i) => { const ng = ctx.el("g",{},g); const w = Math.max(90, r.length*8.5+24); ctx.el("rect",{x:pos[i][0]-w/2,y:pos[i][1]-21,width:w,height:42,rx:9,fill:"var(--surface)",stroke:"var(--line)","stroke-width":2},ng); ctx.el("text",{x:pos[i][0],y:pos[i][1]+5,"text-anchor":"middle",class:"cvtext","font-size":"15"},ng,r); ctx.el("text",{x:pos[i][0]-w/2+6,y:pos[i][1]-26,class:"cvmuted"},ng,"#"+(i+1)); return ng; });
      panel = ctx.el("g",{},g);
      steps = []; const ids = v.semantic_ids, assigned = Array(n).fill(-1); let next = 0;
      for (let i=0;i<n;i++){ if (assigned[i]!==-1) continue; assigned[i]=next; steps.push({open:i, cid:next}); for (let j=i+1;j<n;j++){ const eq = ids[i]===ids[j]; steps.push({i, j, eq, cid:next}); if (eq) assigned[j]=next; } next++; }
      steps.push({done:true}); k = 0; calls = 0; drawPanel();
    }
    let calls = 0;
    function color(i, cid){ const r = nodeEls[i].querySelector("rect"); r.setAttribute("stroke", CL(cid)); r.setAttribute("fill", `color-mix(in srgb, ${CL(cid)} 14%, var(--surface))`); }
    function drawPanel(final){
      const v = P[si].v; panel.innerHTML = "";
      ctx.el("text",{x:860,y:110,class:"cvmuted"},panel,"NLI 调用次数"); ctx.el("text",{x:860,y:150,class:"cvbig"},panel,String(calls));
      ctx.el("text",{x:860,y:210,class:"cvmuted"},panel,"字面不同的写法"); ctx.el("text",{x:860,y:250,class:"cvbig"},panel,String(v.distinct_strings));
      if (final){
        ctx.el("text",{x:860,y:310,class:"cvmuted"},panel,"语义组 p(c)"); const counts = {}; v.semantic_ids.forEach(c => counts[c]=(counts[c]||0)+1);
        Object.entries(counts).forEach(([c,m],i) => { ctx.el("rect",{x:860,y:325+i*34,width:m*26,height:22,rx:4,fill:CL(+c)},panel); ctx.el("text",{x:870+m*26,y:342+i*34,class:"cvmuted"},panel,(m/10).toFixed(1)); });
        const y0 = 360+Object.keys(counts).length*34; ctx.el("text",{x:860,y:y0,class:"cvmuted"},panel,"语义熵 SE"); ctx.el("text",{x:860,y:y0+40,class:"cvbig"},panel,Math.abs(v.cluster_assignment_entropy).toFixed(3));
        ctx.el("text",{x:860,y:y0+80,class:"cvmuted"},panel,"常规熵（看措辞）"); ctx.el("text",{x:860,y:y0+112,class:"cvbig",style:"font-size:22px;fill:var(--muted)"},panel,v.regular_entropy.toFixed(2));
      }
    }
    const api = {
      names: P.map(p => p.name),
      select(i){ si = i; build(); ctx.caption("每开一个新组，就拿它和后面所有回答比一遍。", `0 / ${steps.length}`); },
      reset(){ build(); ctx.caption("每开一个新组，就拿它和后面所有回答比一遍。", `0 / ${steps.length}`); },
      done(){ return k >= steps.length; },
      async step(){
        if (k >= steps.length) return false; const s = steps[k++]; const v = P[si].v;
        if (s.open !== undefined){ color(s.open, s.cid); ctx.caption(`#${s.open+1}「${esc(v.responses[s.open])}」还没有组，开新组 c${s.cid}`, `${k} / ${steps.length}`); await ctx.sleep(400/ctx.speed()); }
        else if (s.done){ lineG.querySelectorAll("line").forEach(l => { if (l.dataset.eq!=="1") l.remove(); }); drawPanel(true); ctx.caption(`结束：${new Set(v.semantic_ids).size} 组，NLI 调用 ${v.nli_calls} 次，SE = ${Math.abs(v.cluster_assignment_entropy).toFixed(3)}`, `${k} / ${steps.length}`); }
        else {
          calls += 2; const [a,b] = [pos[s.i], pos[s.j]];
          const l = ctx.el("line",{x1:a[0],y1:a[1],x2:a[0],y2:a[1],stroke:s.eq?"var(--ok)":"var(--bad)","stroke-width":s.eq?3:1.6,opacity:s.eq?.85:.5,"data-eq":s.eq?"1":"0"}, lineG);
          const dur = 260/ctx.speed(), t0 = performance.now();
          await new Promise(res => { (function f(now){ const t = Math.min(1,(now-t0)/dur); l.setAttribute("x2", a[0]+(b[0]-a[0])*t); l.setAttribute("y2", a[1]+(b[1]-a[1])*t); t<1?requestAnimationFrame(f):res(); })(t0); });
          if (s.eq) color(s.j, s.cid);
          drawPanel(); ctx.caption(`#${s.i+1}「${esc(v.responses[s.i])}」⇄ #${s.j+1}「${esc(v.responses[s.j])}」：${s.eq?"<b style='color:var(--ok)'>同义</b>，拉进 c"+s.cid:"<b style='color:var(--bad)'>不同</b>"}（NLI ×2）`, `${k} / ${steps.length}`);
        }
        return k < steps.length;
      }
    };
    return api;
  }
});

def({ id:"sep.hidden", repo:"sep", title:"隐藏状态取哪里", kindLabel:"节点内部 · 索引", world:{w:1180,h:720},
  info:{ role:"hidden_states 是一个“按生成步”排列的元组：hidden[k] 是第 k 步前向的输出，它最后一个位置的向量负责产出第 k 个回答 token。下面以回答 “It's Paris”（3 个 token）为例。" },
  custom(ctx){
    const g = ctx.g; const cols = ["…","Q:","capital","of","France?","A:","It","'s","Paris"], gen0 = 5; // index of last prompt token
    const rows = ["L0 emb","L1","L2","L3","…","L30","L31","L32"]; const x0 = 170, y0 = 120, cw = 82, ch = 44;
    const cells = [];
    function build(){
      g.innerHTML = ""; cells.length = 0;
      cols.forEach((c,j) => { ctx.el("text",{x:x0+j*cw+cw/2,y:y0-16,"text-anchor":"middle",class:"cvtext","font-size":"14",style:j>gen0?"fill:var(--c1);font-weight:600":""},g,c); });
      ctx.el("text",{x:x0+3*cw,y:y0-46,"text-anchor":"middle",class:"cvmuted"},g,"提示词");
      ctx.el("text",{x:x0+7.5*cw,y:y0-46,"text-anchor":"middle",class:"cvmuted",style:"fill:var(--c1)"},g,"生成的回答");
      rows.forEach((r,i) => { ctx.el("text",{x:x0-12,y:y0+i*ch+ch/2+4,"text-anchor":"end",class:"cvmuted"},g,r); cells[i] = cols.map((_,j) => ctx.el("rect",{x:x0+j*cw+2,y:y0+i*ch+2,width:cw-4,height:ch-4,rx:4,fill:"var(--sunk)",stroke:"var(--line)"},g)); });
      const by = y0+rows.length*ch+26;
      const stepOf = j => j<=gen0 ? 0 : j-gen0;
      cols.forEach((_,j) => { const k = stepOf(j); ctx.el("text",{x:x0+j*cw+cw/2,y:by,"text-anchor":"middle",class:"cvmuted",style:"font-size:11px"},g, j<gen0?"":`hidden[${k}]`); });
      ["It","'s","Paris","⏎"].forEach((t,k) => ctx.el("text",{x:x0+(gen0+k)*cw+cw/2,y:by+20,"text-anchor":"middle",class:"cvmuted",style:"font-size:11px;fill:var(--c1)"},g,"→ "+t));
      ctx.el("text",{x:x0-12,y:by,"text-anchor":"end",class:"cvmuted"},g,"第几步");
      ctx.el("text",{x:x0-12,y:by+20,"text-anchor":"end",class:"cvmuted"},g,"产出");
      vec = ctx.el("g",{},g);
    }
    let vec, k = 0;
    const paint = (j, color, rowsOnly) => cells.forEach(r => { r[j].setAttribute("fill", color); });
    const SC = [
      {name:"TBG · 生成前", intro:"token before generation：提示词最后一个位置。", steps:[
        () => { for (let j=0;j<=gen0;j++) paint(j, "color-mix(in srgb,var(--c0) 18%,var(--sunk))"); return "hidden[0] 是 prefill 这一步：提示词所有位置 × 33 层"; },
        () => { paint(gen0, "var(--c0)"); return "[:, -1, :]：取最后一个位置“A:”。这个位置的输出是第一个回答 token “It”"; },
        () => { drawVec("var(--c0)", "TBG (33, 4096)"); return "torch.stack 所有层 → (33, 4096)。此时模型还一个字都没说"; }]},
      {name:"SLT · 倒数第二个", intro:"second last token：n_generated = 3 时取 hidden[1]。", steps:[
        () => { [6,7,8].forEach(j => paint(j, "color-mix(in srgb,var(--c1) 16%,var(--sunk))")); return "decode 阶段每一步只有一个新位置：hidden[1]、hidden[2]、hidden[3]"; },
        () => { paint(6, "var(--c1)"); return "hidden[n_generated − 2] = hidden[1]：位置 “It”，它产出倒数第二个回答 token “'s”"; },
        () => { paint(7, "color-mix(in srgb,var(--c3) 45%,var(--sunk))"); return "对照：hidden[n_generated − 1] = hidden[2] 是代码里的 last_token_embedding，它产出最后一个 token “Paris”"; },
        () => { drawVec("var(--c1)", "SLT (33, 4096)"); return "同样 stack 所有层。看完回答才知道，所以比 TBG 晚，但信息更多"; }]}
    ];
    function drawVec(color, label){ vec.innerHTML = ""; const x = 990; for (let i=0;i<rows.length;i++) ctx.el("rect",{x, y:y0+i*ch+2, width:46, height:ch-4, rx:4, fill:color, opacity:.85},vec); ctx.el("text",{x:x+23,y:y0-16,"text-anchor":"middle",class:"cvtext","font-size":"14"},vec,label); }
    let si = 0;
    return {
      names: SC.map(s => s.name),
      select(i){ si = i; this.reset(); },
      reset(){ k = 0; build(); ctx.caption(SC[si].intro, `0 / ${SC[si].steps.length}`); },
      done(){ return k >= SC[si].steps.length; },
      async step(){ const S = SC[si].steps; if (k>=S.length) return false; const msg = S[k++](); ctx.caption(msg, `${k} / ${S.length}`); await ctx.sleep(500/ctx.speed()); return k < S.length; }
    };
  }
});

def({ id:"sep.probe", repo:"sep", title:"逐层训练探针", kindLabel:"节点内部 · 合成数据", world:{w:1180,h:640},
  info:{ role:"notebook 对每一层单独训练一个逻辑回归，再画“层 → AUROC”曲线。这里的隐藏状态是合成的，信号最强的层是我设定在第 20 层附近，所以曲线形状本身不代表真实模型，只展示过程。" },
  custom(ctx){
    const p = RUN.probe, Lr = p.auroc_se_by_layer.length, g = ctx.g;
    const X0 = 120, X1 = 1100, Y0 = 520, Y1 = 90, x = i => X0 + i*(X1-X0)/(Lr-1), y = v => Y0 - (v-0.4)/0.6*(Y0-Y1);
    let k = 0, lay;
    function build(){
      g.innerHTML = "";
      [0.4,0.5,0.6,0.7,0.8,0.9,1.0].forEach(v => { ctx.el("line",{x1:X0,x2:X1,y1:y(v),y2:y(v),stroke:"var(--grid)"},g); ctx.el("text",{x:X0-10,y:y(v)+4,"text-anchor":"end",class:"cvmuted"},g,v.toFixed(1)); });
      [0,7,15,23,31].forEach(i => ctx.el("text",{x:x(i),y:Y0+24,"text-anchor":"middle",class:"cvmuted"},g,"层 "+(i+1)));
      ctx.el("text",{x:X0,y:50,class:"cvtext","font-size":"15"},g,"测试 AUROC");
      ctx.el("text",{x:X1,y:50,"text-anchor":"end",class:"cvmuted",style:"fill:var(--ext-ink)"},g,"合成数据 · 曲线形状是设定的");
      ctx.el("line",{x1:X0,x2:X1,y1:y(0.5),y2:y(0.5),stroke:"var(--muted)","stroke-dasharray":"4 4"},g); ctx.el("text",{x:X1,y:y(0.5)-6,"text-anchor":"end",class:"cvmuted"},g,"随机猜 = 0.5");
      lay = ctx.el("g",{},g);
    }
    function upto(n){
      lay.innerHTML = ""; const pts = a => a.slice(0,n).map((v,i)=>`${x(i)},${y(v)}`).join(" ");
      ctx.el("polyline",{points:pts(p.auroc_halluc_by_layer),fill:"none",stroke:"var(--c1)","stroke-width":2,"stroke-dasharray":"5 4"},lay);
      ctx.el("polyline",{points:pts(p.auroc_se_by_layer),fill:"none",stroke:"var(--c0)","stroke-width":2.5},lay);
      p.auroc_se_by_layer.slice(0,n).forEach((v,i) => ctx.el("circle",{cx:x(i),cy:y(v),r:i===n-1?6:3.5,fill:"var(--c0)"},lay));
      ctx.el("text",{x:X0+10,y:Y0+52,class:"cvmuted"},lay,"实线：预测“高语义熵”   虚线：同一探针预测“答错”");
    }
    const groups = []; for (let i=4;i<=Lr;i+=4) groups.push(i); if (groups[groups.length-1]!==Lr) groups.push(Lr);
    return {
      names:["逐层扫描"],
      select(){ this.reset(); }, reset(){ k = 0; build(); ctx.caption(`每层一个 LogisticRegression；best_split 切点 t* = ${p.best_split.toFixed(3)}`, `0 / ${groups.length+1}`); },
      done(){ return k > groups.length; },
      async step(){
        if (k < groups.length){ const n = groups[k++]; upto(n); ctx.caption(`训练到第 ${n} 层：AUROC = ${p.auroc_se_by_layer[n-1].toFixed(3)}`, `${k} / ${groups.length+1}`); await ctx.sleep(300/ctx.speed()); return true; }
        if (k === groups.length){ k++; const best = p.auroc_se_by_layer.indexOf(Math.max(...p.auroc_se_by_layer)); ctx.el("circle",{cx:x(best),cy:y(p.auroc_se_by_layer[best]),r:11,fill:"none",stroke:"var(--lit)","stroke-width":3},lay); ctx.caption(`最好的是第 ${best+1} 层（${p.auroc_se_by_layer[best].toFixed(3)}）。在真实模型上，这条曲线的形状就是论文的“哪一层最懂自己不确定”`, `${k} / ${groups.length+1}`); }
        return false;
      }
    };
  }
});

def({ id:"sgl.radix", repo:"sgl", title:"Radix 前缀缓存", kindLabel:"节点内部 · 真实运行", world:{w:1300,h:720},
  info:{ role:"mini-sglang 自己的 RadixPrefixCache 在 CPU 上处理 4 个请求和一次驱逐的回放（page_size = 1，为了好读用单词代替 token）。绿色是复用的 KV，橙色是新算的，红色是被驱逐的。" },
  custom(ctx){
    const T = RUN.radix, g = ctx.g; let k = 0;
    const NOTES = ["请求 1：缓存是空的，9 个 token 全部新算，占槽位 0–8。",
      "请求 2：前 7 个 token 相同。原节点在“Explain”之后被 split_at 切开，只新算 2 个。",
      "请求 3：完整走到“KV cache”的末尾，命中 9 个，只新算 1 个。",
      "请求 4：没有共同前缀，从根新开一条分支。",
      "evict(3)：从最久没用的叶子删起，“radix tree”和“eviction”被删，释放槽位 9、10、11。"];
    function layout(tree){ const out = []; let leaf = 0; (function walk(nodes, depth, parent){ nodes.forEach(n => { const me = {n, depth, parent}; out.push(me); if (n.children.length) walk(n.children, depth+1, me); else me.leaf = leaf++; }); })(tree, 0, null);
      (function fixY(list){ for (let d = Math.max(...list.map(o=>o.depth)); d >= 0; d--) list.filter(o=>o.depth===d).forEach(o => { if (o.leaf===undefined){ const ch = list.filter(c=>c.parent===o); o.yy = ch.reduce((s,c)=>s+c.yy,0)/ch.length; } else o.yy = o.leaf; }); })(out);
      out.forEach(o => { o.w = Math.max(160, o.n.tokens.join(" ").length*10.2+36); o.left = o.parent ? o.parent.left + o.parent.w + 80 : 150; o.x = o.left + o.w/2; o.y = 150 + o.yy*130; }); return out; }
    function slotsOf(tree){ const s = new Set(); (function w(ns){ ns.forEach(n => { n.slots.forEach(x=>s.add(x)); w(n.children); }); })(tree); return s; }
    function draw(stepIdx, phase){
      g.innerHTML = ""; const st = stepIdx>=0 ? T[stepIdx] : {tree:[], size:{evictable_size:0}};
      const prev = stepIdx>0 ? slotsOf(T[stepIdx-1].tree) : new Set();
      const isEvict = st.step === "evict(3)";
      const tree = (isEvict && phase===0) ? T[stepIdx-1].tree : st.tree;
      const evicted = new Set(isEvict ? st.evicted_slots : []);
      const L = layout(tree);
      ctx.el("rect",{x:20,y:Math.max(110, (L.length? (Math.min(...L.map(o=>o.y))+Math.max(...L.map(o=>o.y)))/2 : 130)-22),width:80,height:44,rx:22,fill:"var(--sunk)",stroke:"var(--line)"},g);
      const rootY = L.length ? (Math.min(...L.filter(o=>o.depth===0).map(o=>o.y))+Math.max(...L.filter(o=>o.depth===0).map(o=>o.y)))/2 : 130;
      g.lastChild.setAttribute("y", rootY-22); ctx.el("text",{x:60,y:rootY+5,"text-anchor":"middle",class:"cvmuted"},g,"root");
      L.forEach(o => { const px = o.parent ? o.parent.left + o.parent.w : 100, py = o.parent ? o.parent.y : rootY; ctx.el("path",{d:`M${px},${py} C${px+40},${py} ${o.x-o.w/2-40},${o.y} ${o.x-o.w/2},${o.y}`,fill:"none",stroke:"var(--line)","stroke-width":2},g); });
      L.forEach(o => {
        const gone = o.n.slots.some(s => evicted.has(s)), fresh = !isEvict && stepIdx>=0 && !prev.has(o.n.slots[0]);
        const col = gone ? "var(--bad)" : fresh ? "var(--c1)" : "var(--ok)";
        const ng = ctx.el("g",{opacity: gone && phase===1 ? 0 : 1},g);
        ctx.el("rect",{x:o.x-o.w/2,y:o.y-27,width:o.w,height:54,rx:8,fill:`color-mix(in srgb, ${col} 15%, var(--surface))`,stroke:col,"stroke-width":2},ng);
        ctx.el("text",{x:o.x,y:o.y-3,"text-anchor":"middle",class:"cvtext","font-size":"17",style:gone?"text-decoration:line-through":""},ng,o.n.tokens.join(" "));
        const s = o.n.slots; ctx.el("text",{x:o.x,y:o.y+17,"text-anchor":"middle",class:"cvmuted",style:"font-size:13px"},ng,`槽位 ${s[0]}${s.length>1?"–"+s[s.length-1]:""}`);
      });
      const m = [["前缀命中", st.prefix_hit??"—"],["新算 KV", st.new_kv_slots_computed??"—"],["可驱逐 token", st.size.evictable_size]];
      m.forEach(([a,b],i) => { ctx.el("text",{x:30+i*230,y:650,class:"cvmuted"},g,a); ctx.el("text",{x:30+i*230,y:690,class:"cvbig"},g,String(b)); });
      if (st.text) ctx.el("text",{x:30,y:50,class:"cvtext","font-size":"16"},g,`输入：${st.text}`);
    }
    const total = T.length;
    return {
      names:["4 个请求 + 驱逐"],
      select(){ this.reset(); }, reset(){ k = 0; draw(-1,0); ctx.caption("从空树开始。按 ▶ 依次送进 4 个请求。", `0 / ${total}`); },
      done(){ return k >= total; },
      async step(){ if (k >= total) return false; const i = k++;
        if (T[i].step === "evict(3)"){ draw(i,0); ctx.caption(NOTES[i], `${k} / ${total}`); await ctx.sleep(1100/ctx.speed()); draw(i,1); }
        else { draw(i,0); ctx.caption(NOTES[i], `${k} / ${total}`); await ctx.sleep(500/ctx.speed()); }
        return k < total; }
    };
  }
});

def({ id:"seal.arcgrid", repo:"seal", title:"增强器", kindLabel:"节点内部 · 真实运行", world:{w:1180,h:620},
  info:{ role:"arclib/augmenters.py 的增强器在 CPU 上真实作用于一个 3×3 网格。配置里的每个开关对应一组增强器：basic 11 个、size 3 个、chain 6 个、repeat 3 个。" },
  custom(ctx){
    const A = RUN.seal.arc, g = ctx.g; const pal = ["var(--sunk)","var(--c0)","var(--c1)","var(--c2)"];
    function grid(x, y, m, s){ m.forEach((row,i) => row.forEach((v,j) => ctx.el("rect",{x:x+j*s,y:y+i*s,width:s-2,height:s-2,rx:2,fill:pal[v]},g))); }
    const items = Object.entries(A.shown); let k = 0;
    function build(){ g.innerHTML = ""; ctx.el("text",{x:60,y:70,class:"cvmuted"},g,"原网格"); grid(60,90,A.grid,40);
      Object.entries(A.aug_counts).forEach(([key,v],i) => { ctx.el("text",{x:60,y:330+i*44,class:"cvmuted"},g,`(${key.split("").join(",")})`); ctx.el("rect",{x:200,y:314+i*44,width:v*14,height:24,rx:4,fill:"var(--accent)",opacity:.8},g); ctx.el("text",{x:210+v*14,y:332+i*44,class:"cvmuted"},g,`${v} 个`); });
      ctx.el("text",{x:60,y:300,class:"cvmuted"},g,"配置 (basic,size,chain,repeat) → 增强器个数"); }
    return {
      names:["逐个增强"],
      select(){ this.reset(); }, reset(){ k = 0; build(); ctx.caption("同一个网格，经过不同增强器变成新的训练样本。", `0 / ${items.length}`); },
      done(){ return k >= items.length; },
      async step(){ if (k >= items.length) return false; const [name, m] = items[k]; const x = 340 + (k%3)*270, y = k<3 ? 60 : 60; const xx = 340 + k*160; ctx.el("text",{x:xx,y:70,class:"cvmuted",style:"font-size:11px"},g,name.length>22?name.slice(0,21)+"…":name); grid(xx, 90, m, m.length>3?22:40); k++; ctx.caption(`${name}`, `${k} / ${items.length}`); await ctx.sleep(400/ctx.speed()); return k < items.length; }
    };
  }
});
