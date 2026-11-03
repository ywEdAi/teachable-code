/* ======================= OpenMAIC ======================= */
const M = RUN.maic;
const J = o => JSON.stringify(o, null, 1);

/* meta: add the application layer */
(function(){
  const g = GRAPHS.meta;
  g.world = {w:1500, h:1200};
  g.groups = [{x:40, y:930, w:1420, h:250, label:"应用层 · 把模型组织成一个产品"}];
  g.nodes.push({id:"maic", x:750, y:1055, label:"OpenMAIC", lines:["形状：多智能体系统 + 持久化流水线","生成课程（7 类 LLM 调用）· 课堂里 director 调度多个智能体","约 47 万行 TS（不含测试）"], kind:"repo", drill:"maic", w:470,
    role:"把一个题目或文档变成一节有老师、同学、白板和语音的课。它不训练模型，而是把很多次 LLM 调用组织成一个可恢复、可交互的系统。", io:["一句需求 + 可选材料","可播放、可提问的课堂"]});
  g.edges.find(e => e.id==="x3").via = [750, 860];
  g.edges.push(
    {id:"m1", from:"maic", to:"sgl", label:"课堂里每次发言 = 一次 LLM 推理（经 provider API）", via:[260,800], lt:.35},
    {id:"m2", from:"maic", to:"sep", label:"何时让老师直接答？不确定性可作路由信号（待探索）", kind:"spec", lt:.45},
    {id:"m3", from:"maic", to:"seal", label:"评测里的失败案例能否变成改进数据？（待探索）", via:[1240,800], kind:"spec", lt:.35});
  g.info.extra = g.info.extra.replace("</div>", "<b>OpenMAIC</b><span>~47 万行 TS · Next.js + Postgres</span></div>");
  g.scenarios.push({name:"应用层", intro:"OpenMAIC 和三个模型层仓库的关系。", steps:[
    {e:"m1", p:"LLM 调用", c:"OpenMAIC 不自己做推理，它调用外部模型 API；推理引擎是它脚下那一层"},
    {e:"m2", p:"不确定性", c:"它的 director 要判断谁来回答；评测显示这一步会“漂移”，不确定性信号可能有用"},
    {e:"m3", p:"失败案例", c:"它有一套编排评测（eval/orchestration），失败案例是潜在的自我改进数据"}]});
})();

PREVIEWS.evalSlide = () => {
  const els = M.dsl.realSceneElements; let s = `<svg viewBox="0 0 1000 562.5" role="img" aria-label="评测用幻灯片"><rect width="1000" height="562.5" fill="var(--surface)"/>`;
  els.forEach(e => { s += `<rect x="${e.left}" y="${e.top}" width="${e.width}" height="${e.height}" fill="none" stroke="var(--line)" stroke-dasharray="6 4"/><text x="${e.left+10}" y="${e.top+e.height/2+9}" font-size="${e.textType==="title"?34:26}" font-weight="${e.textType==="title"?700:400}" fill="var(--ink)" font-family="var(--body)">${escD(e.content || "y = ax² + bx + c")}</text><text x="${e.left+e.width-6}" y="${e.top+16}" text-anchor="end" font-size="14" fill="var(--muted)" font-family="var(--mono)">${e.id}</text>`; });
  return s + `</svg>`;
};

/* ---------- system graph ---------- */
def({ id:"maic", repo:"maic", title:"OpenMAIC", kindLabel:"系统图 · 组件与连接", world:{w:1700,h:990},
  info:{ role:"左边是浏览器，中间是一个 Next.js 进程（API 路由和后台 worker 在一起），右上是 Postgres，右下是按 slot 配置的外部 AI 服务。橙色 ✦ 节点是 LLM 调用。打开“复现视角”可以看到哪些部分需要什么。",
    repro:{ why:"把“生成一节课”做成可恢复的服务端任务（v1.2.0 起），因为一次生成要几分钟、几十次 LLM 调用，关掉标签页不能丢。",
      need:"Node ≥ 22.19、pnpm 10、Postgres 16（没有 DATABASE_URL 服务器不启动）、openmaic.yml 里至少配一个 llm slot 和对应 API key。TTS、图像、视频、搜索、文档解析都是可选的。",
      limit:"仓库没有提交任何真实模型输出：测试里是手写 mock，评测结果目录被 .gitignore。要看真实输入输出，必须自己配 key 跑 pnpm eval:*。",
      next:"先只配 llm 一个 slot 跑通生成；再打开 eval/orchestration 看 director 的失败模式，这是最接近“研究问题”的部分。" } },
  groups:[
    {x:20,y:60,w:360,h:900,label:"浏览器 · React"},
    {x:410,y:60,w:820,h:900,label:"Next.js 服务（API 路由 + 后台 worker，同一进程）", kind:"outer"},
    {x:1260,y:60,w:420,h:520,label:"Postgres 16"},
    {x:1260,y:610,w:420,h:350,label:"外部 AI 服务（按 slot 配置）", kind:"dash"}],
  nodes:[
    {id:"user", x:200, y:130, label:"学习者 / 老师", kind:"external", w:220},
    {id:"wb_ui", x:200, y:300, label:"生成页 / 工作台", sub:"需求 · 上传 · 确认大纲", w:250, dep:"infra"},
    {id:"player", x:200, y:540, label:"课堂播放器", sub:"PlaybackEngine", drill:"maic.play", w:240, dep:"ran",
      role:"按时间执行场景里的动作：讲话、高亮、白板、讨论。", code:{f:"lib/playback/engine.ts",a:691,b:704},
      repro:{why:"课件不是视频，而是“动作脚本”，所以可以随时被打断再接着播。", need:"浏览器；语音需要 tts slot，没有就用浏览器朗读或阅读计时。", limit:"spotlight / laser 不等待，一个 5 秒的共享计时器会延长更早的效果。", next:"进入 ⤢ 看一页课是怎么按时间轴播的（时间轴是我实跑仓库函数算出来的）。"}},
    {id:"export", x:200, y:780, label:"导出", sub:"PPTX · 离线 HTML · MP4", w:240, dep:"infra", repro:{need:"MP4 需要单独的 render-service（Chromium + FFmpeg）；没有就下载 ZIP。"}},
    {id:"api_gen", x:570, y:170, label:"/api/generation-runs", sub:"返回 202 + 快照", w:260, dep:"infra", code:{f:"lib/server/generation/run/plan.ts",a:46,b:66}},
    {id:"runner", x:850, y:300, label:"生成 runner", sub:"lease · 心跳 · 断点续跑", drill:"maic.gen", w:250, dep:"ran",
      role:"后台 worker 认领一个 run，按计划一步一步执行，每步结果写成 checkpoint。", code:{f:"lib/server/generation/run/plan.ts",a:86,b:104},
      repro:{why:"生成要几分钟；进程重启或换机器时，要能从最后一个 checkpoint 接着跑。", need:"Postgres（四张表：runs / steps / events / commands）。", limit:"每个用户最多 2 个进行中的 run、10 个排队。", next:"进入 ⤢ 看完整流水线，并播放“断点续跑”（实跑 advanceRun）。"}},
    {id:"slots", x:1090, y:300, label:"slot 解析", sub:"resolveSlot", drill:"maic.slots", w:200, dep:"local",
      role:"每一步“用哪个模型”不写死在代码里，而是查 slot 树。"},
    {id:"sse", x:570, y:430, label:"SSE 事件流", sub:"/events?after=seq", w:240, dep:"infra"},
    {id:"api_chat", x:570, y:640, label:"/api/chat/pi", sub:"流式回答", w:230, dep:"infra",
      repro:{need:"classroom slot 的模型必须支持 tool calling（v1.2.1 起）。"}},
    {id:"director", x:850, y:640, label:"director", sub:"选谁来回答", kind:"ai", drill:"maic.turn", w:220, dep:"ai"},
    {id:"children", x:850, y:830, label:"老师 / 助教 / 同学", sub:"child agents", kind:"ai", w:250, dep:"ai"},
    {id:"kb", x:570, y:860, label:"知识库", sub:"上传 → 解析 → 文本检索", w:240, dep:"infra",
      repro:{limit:"检索是大小写不敏感的字面匹配，没有向量检索；lib/rag 只在测试里用到。", next:"如果要做“按概念找材料”，这里是可以加 embedding 的位置。"}},
    {id:"db_runs", x:1470, y:170, label:"generation_runs", sub:"steps · events · commands", kind:"store", w:300, dep:"infra"},
    {id:"db_docs", x:1470, y:320, label:"课程文档", sub:"document_stages · scenes", kind:"store", w:300, dep:"infra"},
    {id:"db_mat", x:1470, y:470, label:"owner_material", sub:"材料原件 + 解析结果", kind:"store", w:300, dep:"infra"},
    {id:"llm", x:1470, y:700, label:"LLM provider", sub:"OpenAI · Anthropic · DeepSeek…", kind:"external", w:300, dep:"ai"},
    {id:"media", x:1470, y:860, label:"TTS · 图像 · 视频 · 搜索", sub:"可选，没配就降级", kind:"external", w:300, dep:"ai"}
  ],
  edges:[
    {from:"user", to:"wb_ui", label:"需求 + 材料"},
    {from:"wb_ui", to:"api_gen", label:"requirement"},
    {from:"api_gen", to:"db_runs", label:"新建 run", via:[900,120]},
    {from:"api_gen", to:"runner", label:"wake", kind:"control"},
    {from:"runner", to:"db_runs", label:"checkpoint", bend:-30},
    {from:"db_runs", to:"runner", label:"认领 lease", bend:-30},
    {from:"runner", to:"slots", label:"用哪个模型"},
    {from:"slots", to:"llm", label:"course.*"},
    {from:"slots", to:"media", label:"tts · image", via:[1150,800]},
    {from:"runner", to:"db_docs", label:"appendScene"},
    {from:"db_runs", to:"sse", label:"NOTIFY", via:[1050,450]},
    {from:"sse", to:"wb_ui", label:"进度事件"},
    {from:"wb_ui", to:"runner", label:"确认大纲", kind:"control", via:[600,300]},
    {from:"db_docs", to:"player", label:"课程 JSON", via:[1100,560]},
    {from:"user", to:"player", label:"上课", via:[330,330]},
    {from:"player", to:"api_chat", label:"打断提问"},
    {from:"api_chat", to:"director", label:"请求"},
    {from:"director", to:"llm", label:"tool calls", lt:.3},
    {from:"director", to:"children", label:"call_agent"},
    {from:"children", to:"llm", label:"JSON 数组", lt:.4},
    {from:"children", to:"player", label:"text_delta · action", via:[600,980]},
    {from:"wb_ui", to:"kb", label:"上传", via:[420,700]},
    {from:"kb", to:"db_mat", label:"解析结果", via:[1100,960]},
    {from:"player", to:"export", label:"导出"}
  ],
  scenarios:[
    {name:"生成一门课", intro:"从一句需求到课堂可以播放。", steps:[
      {e:"user>wb_ui", p:"“给初二讲光合作用…”", c:"输入一句需求（也可以先上传材料）"},
      {e:"wb_ui>api_gen", p:"requirement", c:"浏览器只负责发起，生成在服务端"},
      {e:"api_gen>db_runs", p:"run: preparing", c:"写入一条 run 记录，立即返回 202"},
      {e:"api_gen>runner", p:"wake", c:"唤醒后台 runner"},
      {e:"db_runs>runner", p:"lease", c:"runner 认领这个 run，持有一个会过期的 lease"},
      {e:"runner>slots", p:"course.outline", c:"这一步要用哪个模型？查 slot 树"},
      {e:"slots>llm", p:"大纲提示词", c:"调用 LLM 生成大纲（系统提示词 17,536 字）"},
      {e:"runner>db_runs", p:"checkpoint: outline", c:"每一步结果都写成 checkpoint"},
      {e:"db_runs>sse", p:"outline_item ×3", c:"事件通过 Postgres NOTIFY 推给 SSE"},
      {e:"sse>wb_ui", p:"大纲出现", c:"浏览器边收边显示大纲"},
      {e:"wb_ui>runner", p:"确认大纲", c:"默认等人确认大纲，这是一个人工把关点"},
      {e:"runner>db_docs", p:"scene 0 …", c:"逐个场景生成内容、脚本和语音，写进课程文档"},
      {e:"db_docs>player", p:"课程 JSON", c:"课堂可以播放了"}]},
    {name:"课堂里提问", intro:"学习者在播放中打断提问。", steps:[
      {e:"user>player", p:"“对称轴公式是什么？”", c:"学习者打断正在播放的课"},
      {e:"player>api_chat", p:"messages + 课堂状态", c:"把对话、当前场景、白板状态一起发给服务器"},
      {e:"api_chat>director", p:"≤6 轮", c:"director 决定谁来回答"},
      {e:"director>llm", p:"tool call", c:"director 本身也是一次 LLM 调用，它只输出工具调用"},
      {e:"director>children", p:"call_agent(老师)", c:"派老师回答"},
      {e:"children>llm", p:"人设 + 场景", c:"老师是另一次 LLM 调用，输出 JSON 数组（讲话 + 动作）"},
      {e:"children>player", p:"高亮 + 讲话", c:"流式回到浏览器：边显示文字，边执行动作（进入 ⤢ director 看细节）"}]},
    {name:"重启后接着生成", intro:"服务器在生成到一半时重启。", steps:[
      {e:"runner>db_runs", p:"checkpoint ×8", c:"已经完成 8 步，每步都有 checkpoint"},
      {n:"runner", p:"进程退出", c:"进程退出，lease 不再续期"},
      {e:"db_runs>runner", p:"接管过期 lease", c:"另一个 worker 发现 lease 过期，接管这个 run"},
      {e:"runner>db_runs", p:"从 scene:1:actions 继续", c:"计划是“已完成步骤”的纯函数，所以直接算出下一步（进入 ⤢ 播放实跑结果）"}]}
  ]
});

/* ---------- generation pipeline ---------- */
const outlineUser = M.plan.outlinePrompt.user;
def({ id:"maic.gen", repo:"maic", title:"生成流水线", kindLabel:"工作流 · 一个 generation run", world:{w:1800,h:1000},
  info:{ role:"上半部分在确认大纲之前，下半部分对每个场景重复“内容 → 讲解脚本 → 语音”。右上的媒体线和场景并行。橙色 ✦ 节点各是一次 LLM 调用，点开能看到它的输入和输出。",
    repro:{ why:"把“一节课”拆成可 checkpoint 的小步，任何一步失败只重试那一步。",
      need:"每个 ✦ 节点对应一个 slot（course.outline / agents / content.* / actions）；可以全部指向同一个模型。",
      limit:"提示词很长（大纲 387 行、幻灯片 940 行），模型换了效果会变；场景内容不确定，同样输入两次结果不同。",
      next:"复现时先固定一个场景类型（slide），再逐个打开 content / actions 的提示词和修补逻辑。" } },
  groups:[
    {x:20,y:40,w:1180,h:440,label:"准备阶段 · preparing → outlining → 等待确认"},
    {x:1230,y:40,w:550,h:440,label:"媒体线 · 与场景并行，失败不暂停整个 run", kind:"dash"},
    {x:20,y:520,w:1760,h:460,label:"生成阶段 · 每个场景 ×N：scene:i:content → actions → narration", kind:"outer"}],
  nodes:[
    {id:"req", x:150, y:140, label:"需求 + 材料", sub:"requirement · materialIds", kind:"data", w:240},
    {id:"mat", x:150, y:360, label:"材料分析", sub:"≤ 5 万字 · ≤ 20 张图", w:230, dep:"infra",
      repro:{limit:"长文档会被截断到 50,000 字，并发出 material_truncated 事件。"}},
    {id:"research", x:430, y:140, label:"网络检索", sub:"webSearch（可选）", w:220, dep:"ai", repro:{need:"webSearch slot；没配就跳过这一步。"}},
    {id:"outline", x:430, y:360, label:"生成大纲", sub:"course.outline · 流式", kind:"ai", w:230, dep:"ai",
      role:"把一句需求变成场景列表，同时推断授课语言和课名。", io:["需求 + 材料摘要 + 检索结果","{languageDirective, courseTitle, outlines[]}"],
      aiio:{ input:{text:outlineUser, prov:"run", note:"这是用仓库自己的 buildPrompt 实际拼出来的用户提示词；另有 17,536 字的系统提示词。"},
        output:{f:"packages/@openmaic/generation/templates/requirements-to-outlines/system.md", a:253, b:293, prov:"example", note:"仓库没有提交真实模型输出。这是模板里自带的示例，模型会被要求照这个格式写。"},
        parsed:{text:"normalizeSceneOutlines：\n· 最多 100 个场景、512 KB\n· id 和 order 必须唯一\n· 缺 pblConfig 的 pbl → 降级为 slide\n· 缺配置的 interactive → 降级为 slide\n流式过程中解析失败的条目会被静默跳过", prov:"code"} },
      repro:{why:"大纲是整门课的骨架，所有后续步骤都按它展开。", limit:"流式解析失败的条目会被静默丢掉；同一模型重试 2 次后才切换 fallback 模型。", next:"把同一需求跑 3 次，比较大纲差异，是理解这条流水线不确定性的最快方法。"}},
    {id:"gate", x:720, y:360, label:"确认大纲", sub:"wait · countdown · auto", kind:"gate", w:230,
      role:"浏览器默认停下来等人确认（可编辑大纲）；外部 agent 调用时设为 auto。", repro:{why:"大纲错了后面全错，所以在最贵的阶段之前放一个人工把关点。"}},
    {id:"agents", x:980, y:360, label:"生成课堂角色", sub:"course.agents · 3–5 个", kind:"ai", w:240, dep:"ai",
      io:["大纲 + 语言","老师 1 个 + 助教 / 同学若干"],
      aiio:{ input:{f:"lib/server/generation/steps/agent-profiles.ts", a:172, b:172, prov:"template"},
        output:{text:J(M.cls.agents.map(a=>({id:a.id,name:a.name,role:a.role,priority:a.priority}))), prov:"run", note:"生成失败时回退到这组内置角色（实跑读取 registry）。规则：恰好 1 个老师、至少 2 个角色。"} }},
    {id:"ck", x:980, y:140, label:"checkpoint", sub:"generation_run_steps", kind:"store", w:230, dep:"infra"},
    {id:"mediaReq", x:1380, y:170, label:"媒体请求", sub:"outline.mediaGenerations", kind:"data", w:240},
    {id:"img", x:1380, y:380, label:"图片生成", sub:"image slot", w:200, dep:"ai"},
    {id:"vid", x:1640, y:380, label:"视频生成", sub:"video slot", w:200, dep:"ai", repro:{limit:"媒体失败不会暂停 run，课件里显示为禁用占位。"}},
    {id:"content", x:170, y:750, label:"场景内容", sub:"按 outline.type 分流", w:230},
    {id:"slide", x:500, y:610, label:"slide", sub:"940 行提示词 → 坐标", kind:"ai", w:230, dep:"ai", preview:"evalSlide",
      aiio:{ input:{f:"packages/@openmaic/generation/templates/slide-content/system.md", a:25, b:55, prov:"template"},
        output:{f:"packages/@openmaic/generation/test/scene-generation.test.ts", a:115, b:128, prov:"test", note:"模型被要求直接输出元素坐标；上面的预览是评测场景里的一页真实结构（DSL 校验通过）。"},
        parsed:{text:"fixElementDefaults → normalizeElement（坏的 shape 变成文本框，其它坏元素丢弃）\n→ LaTeX 用 KaTeX 渲染 → 图片 id 解析 → 重新编号 ${type}_${nanoid(8)}\nDSL validateScene(评测场景) = " + JSON.stringify(M.dsl.realScene), prov:"run"} },
      repro:{limit:"模型直接写绝对坐标，没有布局引擎；版面质量完全取决于模型。", next:"可以对比：让模型输出语义结构，再由代码排版。"}},
    {id:"quiz", x:500, y:710, label:"quiz", sub:"选项必须是 A–Z", kind:"ai", w:230, dep:"ai",
      aiio:{ output:{f:"packages/@openmaic/generation/test/scene-generation.test.ts", a:273, b:280, prov:"test"},
        parsed:{f:"packages/@openmaic/generation/test/scene-generation.test.ts", a:285, b:296, prov:"test", note:"模型给了 correctAnswer:'A' 和纯文本选项，代码把它规范成 {value,label} 和 answer 数组。"} }},
    {id:"inter", x:500, y:810, label:"interactive", sub:"一整页 HTML", kind:"ai", w:230, dep:"ai",
      aiio:{ output:{f:"packages/@openmaic/generation/test/scene-generation.test.ts", a:304, b:304, prov:"test"},
        parsed:{text:"抽取 <script id=\"widget-config\"> →\nwidgetConfig = {type:'simulation', variables:['energy']}\n脚本先用 node:vm 做语法检查，再做后处理", prov:"test"} },
      repro:{limit:"interactive 没有 widgetType 时默认当 simulation；配置缺失的会降级成 slide。"}},
    {id:"pbl", x:500, y:910, label:"pbl", sub:"先单次规划，失败再多步", kind:"ai", w:230, dep:"ai"},
    {id:"repair", x:830, y:750, label:"校验与修补", sub:"没有 zod，全是手写规则", w:240, dep:"ran",
      role:"把 LLM 的“差不多对”变成渲染器能用的结构。", repro:{why:"LLM 输出常有小错：多余字段、错误类型、缺字段。", limit:"修补是静默的：无效的 spotlight 目标会被改成第一个元素。", next:"统计修补发生的频率，就是评估提示词质量的一个指标。"}},
    {id:"actions", x:1120, y:750, label:"讲解脚本", sub:"course.actions · 讲话 + 动作", kind:"ai", drill:"maic.parse", w:260, dep:"ran",
      io:["场景内容（含元素 id）+ 全部标题 + 前面讲过的话","Action[]：speech、spotlight、wb_*、discussion…"],
      aiio:{ input:{f:"packages/@openmaic/generation/templates/slide-actions/system.md", a:11, b:41, prov:"template"},
        output:{text:M.action.clean.raw, prov:"example", note:"我按提示词格式构造的一段输出（仓库没有真实输出）。"},
        parsed:{text:J(M.action.clean.actions), prov:"run", note:"由仓库的 parseActionsFromStructuredOutput 实际解析。"} },
      repro:{why:"课堂不是视频：同一份内容配上“先指哪里、再说什么”的脚本，才能被打断和续播。", limit:"解析失败时回退到“高亮第一个文本 + 读 keyPoints”，标题写死为中文。", next:"进入 ⤢ 看 6 种不规范输出分别被怎么处理（全部实跑）。"}},
    {id:"narration", x:1410, y:750, label:"语音合成", sub:"tts · 每句一个音频", w:230, dep:"ai", repro:{need:"tts slot；没有时播放器用浏览器朗读或阅读计时。"}},
    {id:"scene", x:1660, y:750, label:"完整场景", sub:"Scene + audioId", kind:"data", w:200}
  ],
  edges:[
    {from:"req", to:"mat", label:"有材料时"},
    {from:"req", to:"research", label:"需求"},
    {from:"mat", to:"outline", label:"文本 · 图片"},
    {from:"research", to:"outline", label:"检索摘要"},
    {from:"outline", to:"gate", label:"outlines[]"},
    {from:"outline", to:"ck", label:"checkpoint", kind:"control", via:[700,160]},
    {from:"gate", to:"agents", label:"确认"},
    {from:"gate", to:"mediaReq", label:"开始媒体线", kind:"control", via:[1150,250]},
    {from:"mediaReq", to:"img"}, {from:"mediaReq", to:"vid", label:"", via:[1640,200]},
    {from:"img", to:"scene", label:"替换占位", via:[1560,560]},
    {from:"agents", to:"content", label:"角色", via:[700,560]},
    {from:"content", to:"slide", label:"slide"}, {from:"content", to:"quiz", label:"quiz", lt:.6},
    {from:"content", to:"inter", label:"interactive", lt:.6}, {from:"content", to:"pbl", label:"pbl"},
    {from:"slide", to:"repair"}, {from:"quiz", to:"repair"}, {from:"inter", to:"repair"}, {from:"pbl", to:"repair"},
    {from:"repair", to:"actions", label:"content"},
    {from:"actions", to:"narration", label:"Action[]"},
    {from:"narration", to:"scene", label:"audioId"},
    {id:"next", from:"scene", to:"content", label:"下一个场景 i+1", kind:"loop", via:[930,1050]}
  ],
  scenarios:[
    {name:"光合作用 · 一次生成", intro:"没有上传材料、没配检索的最小配置。", skip:["mat"], steps:[
      {e:"req>research", p:"“初二光合作用 15 分钟…”", c:"一句需求"},
      {e:"research>outline", p:"researchContext: None", c:"webSearch 没配，这一步什么都不做"},
      {e:"outline>ck", p:"checkpoint", c:"大纲流式生成，完成后写 checkpoint"},
      {e:"outline>gate", p:"3 个场景", c:"光合作用的基本概念 · 光反应阶段 · 暗反应阶段（e2e 测试里的 mock 大纲）"},
      {e:"gate>agents", p:"确认", c:"人确认（或修改）大纲"},
      {e:"agents>content", p:"老师 · 助教 · 同学", c:"生成课堂角色，后面写脚本要用到他们"},
      {e:"content>slide", p:"scene 0 · slide", c:"按类型选提示词"},
      {e:"slide>repair", p:"{elements:[…]}", c:"模型直接写出元素和坐标"},
      {e:"repair>actions", p:"5 个元素", c:"修补后交给脚本生成"},
      {e:"actions>narration", p:"spotlight → 讲话 …", c:"脚本：先指哪里，再说什么（进入 ⤢ 看解析）"},
      {e:"narration>scene", p:"每句一个音频", c:"每句讲话合成一段音频"},
      {e:"next", p:"scene 1", c:"下一个场景重复这三步"}]},
    {name:"断点续跑 · 实跑", intro:"仓库的 advanceRun 真实运行：3 个场景，跑到 scene:1:actions 时进程崩溃。", steps:
      M.plan.trace.map((t,i) => {
        const id = t.next || "";
        const node = id==="material-analysis"?"mat":id==="research"?"research":id==="outline"?"outline":id==="await-outline-confirmation"?"gate":id==="agents"?"agents":/:content$/.test(id)?"content":/:actions$/.test(id)?"actions":/:narration$/.test(id)?"narration":id==="complete"?"scene":"actions";
        return {n:node, p:t.event?"✗ 崩溃 · 已有 8 个 checkpoint":id, c:t.event?"进程崩溃。另一个 worker 接管后，advanceRun 只看“哪些步骤已 checkpoint”，算出的下一步仍是 scene:1:actions":`advanceRun → ${id}`};
      })},
    {name:"互动场景", intro:"一个 simulation 类型的场景。", steps:[
      {e:"content>inter", p:"interactive · simulation", c:"按 widgetType 选提示词"},
      {e:"inter>repair", p:"<!DOCTYPE html>…", c:"模型输出一整页 HTML，而不是 JSON"},
      {e:"repair>actions", p:"{variables:['energy']}", c:"从 HTML 里抽出 widget-config"},
      {e:"actions>narration", p:"widget_highlight · setState", c:"脚本可以直接操作互动页面里的元素"}]},
    {name:"测验场景", intro:"模型没完全按格式写。", steps:[
      {e:"content>quiz", p:"quiz", c:"测验提示词"},
      {e:"quiz>repair", p:"correctAnswer:'A'", c:"模型给了纯文本选项和 correctAnswer"},
      {e:"repair>actions", p:"answer:['A']", c:"代码规范成 {value,label} 和 answer 数组"}]},
    {name:"媒体线", intro:"确认大纲后，图片和视频与场景并行生成。", steps:[
      {e:"gate>mediaReq", p:"gen_img_1", c:"大纲里声明了需要生成的图"},
      {e:"mediaReq>img", p:"prompt", c:"逐个生成"},
      {e:"img>scene", p:"替换占位符", c:"幻灯片里的 gen_img_1 被换成真实资源 id"},
      {e:"mediaReq>vid", p:"失败", c:"视频失败不会暂停 run，只在课件里显示禁用占位"}]}
  ]
});

/* ---------- action parser (all real runs) ---------- */
(function(){
  const A = M.action, CAP = s => s.length > 34 ? s.slice(0,33)+"…" : s;
  const out = k => `${A[k].actions.length} 个：` + A[k].actions.map(a=>a.type).join(" · ");
  const tail = (k, extra) => [
    {e:"conv>disc", p:"转换完", c:"text → speech；action → {type, ...params}"},
    {e:"disc>slideonly", p:extra.disc||"不变", c:extra.discC||"discussion 必须是最后一个"},
    {e:"slideonly>wl", p:extra.so||"不变", c:extra.soC||"非 slide 场景去掉 spotlight / laser"},
    {e:"wl>outp", p:extra.wl||"不变", c:extra.wlC||"按角色的白名单过滤"},
    {n:"outp", p:out(k), c:"结果：" + out(k)}];
  const head = (k, how) => [
    {e:"raw>fence", p:CAP(A[k].raw.replace(/\n/g," ")), c:"LLM 的原始文本"},
    {e:"fence>bracket", p:"去围栏", c:"去掉 ``` 代码围栏"},
    {e:"bracket>jp", p:"[ … ]", c:"截取第一个 [ 到最后一个 ]"}, ...how];
  def({ id:"maic.parse", repo:"maic", title:"从 LLM 文本到动作", kindLabel:"节点内部 · 全部实跑", world:{w:1720,h:720},
    info:{ role:"parseActionsFromStructuredOutput 的 7 个步骤。6 个场景都是把我构造的 LLM 输出交给仓库原函数真实解析的结果。", repro:{ need:"原函数依赖 jsonrepair 和 partial-json；本环境装不了 npm 包，这两个用我写的极简替身（只修尾逗号、只补全截断），其余全是原代码。", limit:"修补和过滤都是静默的，只打日志；最终结果可能比模型写的少几个动作。", next:"真实部署里统计“走到 jsonrepair / partial-json 的比例”，能直接反映模型对格式的遵守程度。"} },
    nodes:[
      {id:"raw", x:130, y:360, label:"LLM 原始文本", kind:"data", w:200},
      {id:"fence", x:370, y:360, label:"去掉 ``` 围栏", w:200, dep:"ran"},
      {id:"bracket", x:610, y:360, label:"找 [ … ]", w:180, dep:"ran"},
      {id:"jp", x:860, y:200, label:"JSON.parse", w:200, dep:"ran"},
      {id:"jr", x:860, y:360, label:"jsonrepair", sub:"修引号 · 尾逗号", w:200, dep:"ran"},
      {id:"pj", x:860, y:520, label:"partial-json", sub:"补全被截断的流", w:200, dep:"ran"},
      {id:"conv", x:1110, y:360, label:"转换成 Action", sub:"text → speech", w:210, dep:"ran"},
      {id:"disc", x:1370, y:200, label:"discussion 放最后", sub:"之后的全部截掉", w:230, dep:"ran"},
      {id:"slideonly", x:1370, y:360, label:"去掉 slide 专属动作", sub:"非 slide 场景", w:230, dep:"ran"},
      {id:"wl", x:1370, y:520, label:"角色白名单", sub:"学生不能用 laser", w:230, dep:"ran"},
      {id:"outp", x:1370, y:670, label:"Action[]", kind:"data", w:200}
    ],
    edges:[
      {from:"raw", to:"fence"}, {from:"fence", to:"bracket"}, {from:"bracket", to:"jp"},
      {from:"jp", to:"conv", label:"成功"}, {from:"jp", to:"jr", label:"失败"},
      {from:"jr", to:"conv", label:"修好了"}, {from:"jr", to:"pj", label:"仍失败"},
      {from:"pj", to:"conv", label:"补全"},
      {from:"conv", to:"disc"}, {from:"disc", to:"slideonly"}, {from:"slideonly", to:"wl"}, {from:"wl", to:"outp"}
    ],
    scenarios:[
      {name:"格式正确", intro:A.clean.raw.slice(0,90)+"…", steps:[...head("clean",[{e:"jp>conv", p:"4 项", c:"第一次就解析成功"}]), ...tail("clean",{})]},
      {name:"围栏 + 尾逗号", intro:"模型包了 ```json，数组末尾多一个逗号。", steps:[...head("fenced_trailing_comma",[{e:"jp>jr", p:"SyntaxError", c:"JSON.parse 失败"},{e:"jr>conv", p:"去掉尾逗号", c:"jsonrepair 修好（日志：Recovered malformed JSON）"}]), ...tail("fenced_trailing_comma",{})]},
      {name:"流被截断", intro:"输出停在半句话：“…ATP 和 NAD”。", steps:[...head("truncated_stream",[{e:"jp>jr", p:"没有 ]", c:"JSON.parse 失败"},{e:"jr>pj", p:"仍失败", c:"jsonrepair 也修不好"},{e:"pj>conv", p:"补全字符串和数组", c:"partial-json 把截断处补上，保留已有的内容"}]), ...tail("truncated_stream",{})]},
      {name:"discussion 不在最后", intro:"讨论之后还写了一句话。", steps:[...head("discussion_not_last",[{e:"jp>conv", p:"3 项", c:"解析成功"}]), ...tail("discussion_not_last",{disc:"截掉 1 项", discC:"discussion 之后的那句被截掉"})]},
      {name:"测验场景里用了高亮", intro:"quiz 场景没有可高亮的幻灯片元素。", steps:[...head("quiz_scene_strips_spotlight",[{e:"jp>conv", p:"2 项", c:"解析成功"}]), ...tail("quiz_scene_strips_spotlight",{so:"去掉 1 个 spotlight", soC:"非 slide 场景去掉 spotlight（日志：Stripped 1 slide-only action）"})]},
      {name:"学生越权", intro:"学生角色模仿老师用了 laser。", steps:[...head("student_whitelist",[{e:"jp>conv", p:"3 项", c:"解析成功"}]), ...tail("student_whitelist",{wl:"去掉 laser", wlC:"学生的白名单里没有 laser（日志：Stripped 1 disallowed action）"})]}
    ]});
})();

/* ---------- slot tree ---------- */
(function(){
  const nodes = [{id:"llm", x:760, y:90, label:"llm", sub:"所有对话类的根", w:210, dep:"ai"}];
  const L1 = ["course.research","course.outline","course.agents","course.content","course.actions","classroom","agent"];
  L1.forEach((s,i) => nodes.push({id:s.replace(/\./g,"_"), x:140+i*205, y:270, label:s, w:190, dep:"ai"}));
  ["slide","quiz","interactive","pbl"].forEach((s,i) => nodes.push({id:"cc_"+s, x:420+i*230, y:440, label:"course.content."+s, w:215, dep:"ai"}));
  nodes.push({id:"agent_title", x:1370, y:440, label:"agent.title", sub:"只能在配置文件设", w:190, dep:"ai"});
  ["tts","asr","image","video","webFetch","webSearch","document"].forEach((s,i) => nodes.push({id:"r_"+s, x:140+i*205, y:650, label:s, sub:s==="webFetch"?"没配时用内置读取器":"", w:190, dep:"ai"}));
  const edges = L1.map(s => ({from:"llm", to:s.replace(/\./g,"_"), kind:"control"}));
  ["slide","quiz","interactive","pbl"].forEach(s => edges.push({from:"course_content", to:"cc_"+s, kind:"control"}));
  edges.push({from:"agent", to:"agent_title", kind:"control"});
  def({ id:"maic.slots", repo:"maic", title:"模型 slot", kindLabel:"节点内部 · 配置解析", world:{w:1560,h:720},
    groups:[{x:30,y:560,w:1500,h:150,label:"其它根节点（各自独立，不继承 llm）"}],
    info:{ role:"20 个 slot。上面是对话模型的树：子节点没配就继承父节点。下面是 7 个独立能力，设为 null 就关闭。", repro:{ why:"同一个系统里，大纲、幻灯片、课堂对话可能想用不同价位的模型；部署者也要能锁住某些选择。", need:"openmaic.yml 里的 providers + slots；key 放在 .env.local，用 ${VAR} 引用。", limit:"agent 和 classroom 需要支持 tool calling 的模型；fallback 只对对话类 slot 生效。", next:"复现时可以先让所有 slot 继承 llm，再把最贵的 course.content.slide 单独换模型，观察效果。"} },
    nodes, edges,
    scenarios:[
      {name:"quiz 用哪个模型", intro:"resolveSlot：锁定 → 用户设置 → 部署默认，沿着树往上找。", steps:[
        {n:"cc_quiz", p:"没被锁定", c:"1. 先看这个子树有没有被部署者 lock"},
        {n:"cc_quiz", p:"用户没设", c:"2. 从自己开始往上找用户的设置"},
        {n:"course_content", p:"用户没设", c:"往上一层"},
        {n:"llm", p:"用户没设", c:"一直到根，用户都没设"},
        {n:"cc_quiz", p:"部署也没设", c:"3. 再从自己开始往上找部署默认（openmaic.yml）"},
        {n:"llm", p:"openai:gpt-5.5", c:"在根上找到部署默认：llm: openai:gpt-5.5（示例配置）"}]},
      {name:"关掉一个能力", intro:"在 openmaic.yml 里把 video 设为 null。", steps:[
        {n:"r_video", p:"null", c:"video: null 关闭视频生成"},
        {n:"r_video", p:"课件里显示禁用占位", c:"媒体线遇到视频请求时直接跳过，不影响整个 run"}]}
    ]});
})();

/* ---------- live Q&A turn ---------- */
const ANS = M.answering;
def({ id:"maic.turn", repo:"maic", title:"课堂里的一次提问", kindLabel:"工作流 · 多智能体调度", world:{w:1720,h:900},
  info:{ role:"director 是一个只会调用工具的 LLM：读场景、派某个角色发言、结束这一轮。每个角色是另一次 LLM 调用，输出“讲话 + 动作”的 JSON 数组，流式回到浏览器。", repro:{ why:"多人课堂需要有人决定“谁说话”。这里没有算法，选择完全靠 director 提示词里的 9 条规则。", need:"支持 tool calling 的模型（classroom slot）。", limit:"priority 字段从不参与计算，只是写进提示词；评测专门测 director 会不会“漂移”（没人回答问题本身）。", next:"eval/orchestration 的通过线是 70% 路由到老师。这是一个很好的可复现研究问题：换模型、换规则，看路由正确率。"} },
  nodes:[
    {id:"learner", x:130, y:170, label:"学习者", kind:"external", w:180},
    {id:"player", x:130, y:450, label:"课堂播放器", sub:"打断：记住播到哪", w:230, dep:"infra"},
    {id:"route", x:420, y:450, label:"/api/chat/pi", sub:"≤6 轮 · 每人 ≤8 动作", w:240, dep:"infra"},
    {id:"director", x:720, y:450, label:"director", sub:"4 个工具", kind:"ai", w:210, dep:"ai",
      io:["对话历史 + 大纲 + 已发言者 + 角色列表","工具调用：read_scene / call_agent / cue_user / close_session"],
      aiio:{ input:{f:"lib/chat/pi/prompts.ts", a:124, b:135, prov:"template", note:"director 提示词里的路由规则（节选）。"},
        output:{text:'read_scene({sceneId: "scene-quad"})\ncall_agent({agentId: "t1", instruction: "直接给出对称轴公式 x = -b/(2a)"})\ncue_user({prompt: "还有哪里不清楚？"})', prov:"eval", note:"评测场景 answer-content.json 期望的行为：先给公式。仓库没有提交真实输出。"} },
      repro:{limit:"没有算法选择器；选谁全靠 LLM 遵守提示词。", next:"进入下面“漂移”场景，看评测要抓的失败模式。"}},
    {id:"scene", x:720, y:170, label:"read_scene", sub:"取当前场景全部内容", w:220},
    {id:"teacher", x:1060, y:250, label:"李老师", sub:"teacher · priority 10", kind:"agent", color:"var(--c0)", w:220, dep:"ai",
      aiio:{ input:{f:"lib/chat/pi/prompts.ts", a:196, b:204, prov:"template", note:"每个角色的提示词：人设 + 只能输出 JSON 数组 + 可用动作 + 当前场景元素。老师的发言上限约 70 个汉字。"},
        output:{f:"tests/lib/chat/pi/call-agent-json-actions.test.ts", a:294, b:302, prov:"test"},
        parsed:{text:"SSE 事件：\naction wb_open\naction wb_draw_text {content:'树荫减少太阳辐射', x:80, y:120}\naction wb_close\ntext_delta '我画了一个很简单的关系：…'", prov:"test"} }},
    {id:"assistant", x:1060, y:450, label:"助教小韩", sub:"assistant · priority 7", kind:"agent", color:"var(--c2)", w:220, dep:"ai"},
    {id:"student", x:1060, y:650, label:"小明", sub:"student · priority 4", kind:"agent", color:"var(--c1)", w:220, dep:"ai"},
    {id:"parse", x:1380, y:450, label:"流式解析 + 守卫", sub:"partial-json · 预算 · 去重", w:250, dep:"ran"},
    {id:"wbcheck", x:1380, y:200, label:"白板冲突检查", sub:"重叠 · 出界", drill:"maic.wb", w:230, dep:"ran"},
    {id:"sse", x:1380, y:700, label:"SSE 事件", sub:"agent_start · text_delta · action", kind:"data", w:270},
    {id:"cue", x:720, y:700, label:"结束这一轮", sub:"cue_user / close_session", w:240}
  ],
  edges:[
    {from:"learner", to:"player", label:"提问"},
    {from:"player", to:"route", label:"请求"},
    {from:"route", to:"director", label:"开始"},
    {from:"director", to:"scene", label:"read_scene", bend:30},
    {from:"scene", to:"director", label:"场景证据", bend:30},
    {from:"director", to:"teacher", label:"call_agent"},
    {from:"director", to:"assistant", label:"call_agent"},
    {from:"director", to:"student", label:"call_agent"},
    {from:"teacher", to:"director", label:"发言摘要", kind:"control", bend:-50},
    {from:"teacher", to:"parse", label:"JSON 流"},
    {from:"assistant", to:"parse", label:"JSON 流"},
    {from:"student", to:"parse", label:"JSON 流"},
    {from:"parse", to:"sse"},
    {from:"sse", to:"player", label:"边显示边执行", via:[720,920]},
    {from:"director", to:"cue", label:"终止工具"},
    {from:"wbcheck", to:"teacher", label:"写进下一轮提示", kind:"control"}
  ],
  scenarios:[
    {name:"直接提问 · 期望路径", intro:"评测场景：学习者直接问公式。", steps:[
      {e:"learner>player", p:"“对称轴 x 坐标公式？”", c:"学习者打断课堂"},
      {e:"player>route", p:"messages + 课堂状态", c:"连同当前场景和白板状态发出"},
      {e:"route>director", p:"开始", c:"director 开始一轮"},
      {e:"director>scene", p:"scene-quad", c:"问题和当前幻灯片有关，先读场景"},
      {e:"scene>director", p:"标题 + 3 条要点 + 公式", c:"幻灯片上并没有写出 x = -b/(2a)"},
      {e:"director>teacher", p:"直接给公式", c:"规则 5：明确的问题先派老师"},
      {e:"teacher>parse", p:"[laser l-1, text…]", c:"老师输出 JSON 数组：指向公式，再说一句"},
      {e:"parse>sse", p:"action · text_delta", c:"边解析边检查，然后推送"},
      {e:"sse>player", p:"指公式 + 朗读", c:"浏览器边显示文字边执行动作"},
      {e:"teacher>director", p:"李老师：x = -b/(2a)…", c:"老师的发言摘要回到 director"},
      {e:"director>cue", p:"cue_user", c:"问题已回答，邀请学习者继续"}]},
    {name:"漂移 · 评测失败模式", intro:ANS.description, steps:[
      {e:"learner>player", p:"“对称轴 x 坐标公式？”", c:"同一个问题"},
      ...ANS.agentResponses.map(r => ({e:"director>"+({"default-1":"teacher","default-2":"assistant","default-3":"student"}[r.agentId]), p:r.agentName+"："+r.contentPreview.slice(0,16)+"…", c:`${r.agentName}：${r.contentPreview}`})),
      {n:"director", p:"3 轮都没给公式", c:"三个角色各说了一个相关但不是答案的点。评测期望 director 下一步派老师直接回答"},
      {e:"director>teacher", p:"直接给出 x = -b/(2a)", c:"通过线：≥ 70% 的样本路由到老师"}]},
    {name:"讨论模式", intro:"一个由学生发起的讨论。", steps:[
      {n:"director", p:"discussion · 学生发起", c:"规则 1 变成：发起者先说，然后老师引导"},
      {e:"director>student", p:"发起者先说", c:"小明先抛出观点"},
      {e:"director>teacher", p:"引导", c:"老师引导"},
      {e:"director>assistant", p:"换一个角度", c:"同一轮里不重复同一个人、不连续派同一角色"},
      {e:"director>cue", p:"等学习者", c:"最多 6 个发言就停下，把话轮交还学习者"}]},
    {name:"白板画重叠了", intro:"老师在白板上写的两样东西叠在一起。", steps:[
      {e:"teacher>parse", p:"wb_draw_text + wb_draw_latex", c:"老师在白板上画了两样东西"},
      {e:"parse>sse", p:"action ×2", c:"照常执行"},
      {n:"wbcheck", p:"重叠 33% · 出界 100px", c:"下一轮之前，代码计算白板上的几何冲突（实跑，进入 ⤢）"},
      {e:"wbcheck>teacher", p:"冲突写进提示词", c:"冲突以文字形式写进下一次提示词，要求先删或清空再画"}]}
  ]
});

/* ---------- custom: scene playback ---------- */
def({ id:"maic.play", repo:"maic", title:"一页课怎么播", kindLabel:"节点内部 · 实跑时间轴", world:{w:1500,h:900},
  info:{ role:"上面是评测里的一页真实幻灯片结构，下面是仓库的 resolveActionTimeline 对一段脚本算出的时间轴（实跑）。spotlight / laser 不阻塞，讲话、白板、讨论会阻塞。讲话时长按每个汉字 150 毫秒估算。" },
  custom(ctx){
    const els = M.dsl.realSceneElements, T = M.cls.timeline, g = ctx.g, S = 0.82, X0 = 40, Y0 = 60;
    const totalMs = Math.max(...T.map(t => t.startMs + t.durationMs));
    const TX0 = 40, TX1 = 1460, tx = ms => TX0 + ms/totalMs*(TX1-TX0), TY = 660;
    let k = 0, rects = {}, wbG, bubble, head, effect;
    function build(){
      g.innerHTML = ""; rects = {};
      ctx.el("rect",{x:X0,y:Y0,width:1000*S,height:562.5*S,fill:"var(--surface)",stroke:"var(--line)"},g);
      els.forEach(e => { rects[e.id] = ctx.el("rect",{x:X0+e.left*S,y:Y0+e.top*S,width:e.width*S,height:e.height*S,rx:4,fill:"none",stroke:"var(--line)","stroke-dasharray":"5 4"},g);
        ctx.el("text",{x:X0+e.left*S+8,y:Y0+(e.top+e.height/2)*S+8,class:"cvtext","font-size":e.textType==="title"?26:20,"font-weight":e.textType==="title"?700:400},g, e.content || "y = ax² + bx + c");
        ctx.el("text",{x:X0+(e.left+e.width)*S-4,y:Y0+e.top*S+13,"text-anchor":"end",class:"cvmuted",style:"font-size:11px"},g,e.id); });
      wbG = ctx.el("g",{opacity:0},g);
      ctx.el("rect",{x:880,y:Y0,width:580,height:330,rx:10,fill:"var(--surface)",stroke:"var(--accent)","stroke-width":2},wbG);
      ctx.el("text",{x:900,y:Y0+28,class:"cvmuted"},wbG,"白板");
      ctx.el("text",{x:24,y:TY-18,class:"cvmuted"},g,"时间轴（resolveActionTimeline 实跑）");
      T.forEach((t,i) => { const row = t.blocking ? 0 : 1; const y = TY + row*46;
        ctx.el("rect",{x:tx(t.startMs),y,width:Math.max(4,tx(t.startMs+t.durationMs)-tx(t.startMs)-2),height:36,rx:5,fill:t.blocking?(t.type==="speech"?"var(--c0)":t.type==="discussion"?"var(--c3)":"var(--c2)"):"var(--c1)",opacity:.25},g);
        ctx.el("text",{x:tx(t.startMs)+6,y:y+23,class:"cvmuted",style:"font-size:11px;fill:var(--ink)"},g,t.type); });
      ctx.el("text",{x:TX1,y:TY+120,"text-anchor":"end",class:"cvmuted"},g,`${(totalMs/1000).toFixed(1)} 秒`);
      ctx.el("text",{x:TX0,y:TY+120,class:"cvmuted"},g,"上排：阻塞（讲话 · 白板 · 讨论）  下排：不阻塞（spotlight · laser）");
      head = ctx.el("line",{x1:TX0,x2:TX0,y1:TY-6,y2:TY+92,stroke:"var(--lit)","stroke-width":3},g);
      bubble = ctx.el("g",{},g); effect = ctx.el("g",{},g);
    }
    function say(text){ bubble.innerHTML = ""; if (!text) return; ctx.el("rect",{x:40,y:Y0+562.5*S+14,width:1420,height:44,rx:10,fill:"var(--accent-soft)",stroke:"var(--accent)"},bubble); ctx.el("text",{x:58,y:Y0+562.5*S+43,class:"cvtext","font-size":"18"},bubble,"老师：" + text); }
    return {
      names:["播放这一页"],
      select(){ this.reset(); }, reset(){ k = 0; build(); ctx.caption("一页幻灯片 + 一段动作脚本。按 ▶ 按时间轴播放。", `0 / ${T.length}`); },
      done(){ return k >= T.length; },
      async step(){
        if (k >= T.length) return false; const t = T[k++];
        head.setAttribute("x1", tx(t.startMs)); head.setAttribute("x2", tx(t.startMs));
        if (t.type==="spotlight" || t.type==="laser"){ effect.innerHTML = ""; const r = rects[t.text]; if (r){ const b = r.getBBox();
            if (t.type==="spotlight") ctx.el("rect",{x:b.x-4,y:b.y-4,width:b.width+8,height:b.height+8,rx:6,fill:"none",stroke:"var(--lit)","stroke-width":4},effect);
            else ctx.el("circle",{cx:b.x+b.width-30,cy:b.y+b.height/2,r:10,fill:"var(--bad)"},effect); } }
        if (t.type==="speech") say(t.text);
        if (t.type==="wb_open") wbG.setAttribute("opacity", 1);
        if (t.type==="wb_draw_latex") ctx.el("text",{x:930,y:Y0+150,class:"cvtext","font-size":"40",style:"font-family:var(--mono)"},wbG,"x = −b / (2a)");
        if (t.type==="discussion") say("（讨论卡片）" + t.text);
        const label = {spotlight:`spotlight ${t.text}：不等待，直接进入下一个动作`, laser:`laser ${t.text}：不等待`, speech:`讲话 ${(t.durationMs/1000).toFixed(1)} 秒`, wb_open:"先打开白板：脚本里没写 wb_open，时间轴自动补了一个（2 秒）", wb_draw_latex:"在白板上写公式（0.8 秒）", discussion:"讨论：显示卡片，暂停等学习者"}[t.type] || t.type;
        ctx.caption(`${(t.startMs/1000).toFixed(1)}s · ${label}`, `${k} / ${T.length}`);
        await ctx.sleep(Math.max(500, Math.min(1600, t.durationMs/4))/ctx.speed());
        return k < T.length;
      }
    };
  }
});

/* ---------- custom: whiteboard conflicts ---------- */
def({ id:"maic.wb", repo:"maic", title:"白板冲突检查", kindLabel:"节点内部 · 实跑", world:{w:1500,h:880},
  info:{ role:"白板上的元素由 LLM 直接给出绝对坐标，没有布局引擎。唯一的空间反馈是 buildWhiteboardConflicts：算出重叠和出界，把结果写成文字塞进下一次提示词。下面的检测文字是实跑结果。" },
  custom(ctx){
    const W = M.cls.wb, g = ctx.g, S = 0.9, X0 = 40, Y0 = 50; let k = 0;
    function build(){ g.innerHTML = ""; ctx.el("rect",{x:X0,y:Y0,width:1000*S,height:563*S,fill:"var(--surface)",stroke:"var(--ink)","stroke-width":2},g); ctx.el("text",{x:X0,y:Y0-12,class:"cvmuted"},g,"白板 1000 × 563"); }
    function draw(e){ const r = ctx.el("rect",{x:X0+e.left*S,y:Y0+e.top*S,width:e.width*S,height:e.height*S,rx:4,class:"wbbox"},g); ctx.el("text",{x:X0+e.left*S+8,y:Y0+e.top*S+30,class:"cvtext","font-size":"18"},g,e.content||e.latex||e.type); return r; }
    const steps = [
      () => { draw(W[0]); return "老师写了一行字"; },
      () => { draw(W[1]); const a = W[0], b = W[1]; const x = Math.max(a.left,b.left), y = Math.max(a.top,b.top), x2 = Math.min(a.left+a.width,b.left+b.width), y2 = Math.min(a.top+a.height,b.top+b.height);
        ctx.el("rect",{x:X0+x*S,y:Y0+y*S,width:(x2-x)*S,height:(y2-y)*S,fill:"var(--bad)",opacity:.35},g); return "又写了一个公式，和前面那行字重叠了"; },
      () => { draw(W[2]); ctx.el("rect",{x:X0+1000*S,y:Y0+W[2].top*S,width:(W[2].left+W[2].width-1000)*S,height:W[2].height*S,fill:"var(--bad)",opacity:.35},g); return "画了一个形状，超出了白板右下边界"; },
      () => { const lines = M.cls.conflicts.split("\n").filter(Boolean); lines.forEach((ln,i) => ctx.el("text",{x:960,y:80+i*26,class:"cvmuted",style:"font-size:13px;fill:var(--ink)"},g, ln.length>58?ln.slice(0,57)+"…":ln)); return "检测结果被写成这段文字，放进下一次提示词，要求模型先 wb_delete 或 wb_clear"; }
    ];
    return { names:["画三样东西"], select(){ this.reset(); }, reset(){ k = 0; build(); ctx.caption("白板是空的。", `0 / ${steps.length}`); }, done(){ return k >= steps.length; },
      async step(){ if (k >= steps.length) return false; const m = steps[k++](); ctx.caption(m, `${k} / ${steps.length}`); await ctx.sleep(700/ctx.speed()); return k < steps.length; } };
  }
});
