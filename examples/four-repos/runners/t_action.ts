import { parseActionsFromStructuredOutput } from '@openmaic/generation/action-parser';
const log = { info:(...a:any[])=>console.log('  [info]', ...a), warn:(...a:any[])=>console.log('  [warn]', ...a), error:()=>{}, debug:()=>{} } as any;
const cases: Record<string,{raw:string, scene?:string, allowed?:string[]}> = {
  clean: { raw: `[{"type":"action","name":"spotlight","params":{"elementId":"t-b1"}},{"type":"text","content":"先看这条公式：对称轴 x = -b/(2a)。"},{"type":"action","name":"wb_open","params":{}},{"type":"text","content":"我们在白板上推导一下。"}]`, scene:'slide' },
  fenced_trailing_comma: { raw: "```json\n[{\"type\":\"text\",\"content\":\"光反应发生在类囊体膜上。\"},{\"type\":\"action\",\"name\":\"laser\",\"params\":{\"elementId\":\"img-1\"}},]\n```", scene:'slide' },
  truncated_stream: { raw: `[{"type":"text","content":"暗反应在叶绿体基质中进行，"},{"type":"text","content":"它需要光反应产生的 ATP 和 NAD`, scene:'slide' },
  discussion_not_last: { raw: `[{"type":"text","content":"大家怎么看？"},{"type":"action","name":"discussion","params":{"topic":"为什么 a 决定开口方向"}},{"type":"text","content":"这句会被丢掉"}]`, scene:'slide' },
  quiz_scene_strips_spotlight: { raw: `[{"type":"action","name":"spotlight","params":{"elementId":"q1"}},{"type":"text","content":"做第一题。"}]`, scene:'quiz' },
  student_whitelist: { raw: `[{"type":"text","content":"老师我来！"},{"type":"action","name":"laser","params":{"elementId":"t-b1"}},{"type":"action","name":"wb_draw_text","params":{"content":"x=-b/2a"}}]`, scene:'slide', allowed:['wb_draw_text'] },
};
const out: any = {};
for (const [k, c] of Object.entries(cases)){
  console.log('==', k);
  const acts = parseActionsFromStructuredOutput(c.raw, c.scene, c.allowed, log);
  const view = acts.map(a => { const { id, ...rest } = a as any; return rest; });
  console.log(JSON.stringify(view));
  out[k] = { raw: c.raw, scene: c.scene, allowed: c.allowed ?? null, actions: view };
}
(await import('node:fs')).writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
