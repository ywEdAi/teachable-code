import { resolveActionTimeline } from '@/lib/choreography/timeline';
import { buildWhiteboardConflicts } from '@/lib/orchestration/summarizers/whiteboard-conflicts';
import { BUILT_IN_AGENTS } from '@/lib/orchestration/registry/built-in';
import fs from 'node:fs';
const out: any = {};
const act = JSON.parse(fs.readFileSync('action_out.json','utf8'));
const actions = [
  { id:'a0', type:'spotlight', elementId:'t-b3' },
  { id:'a1', type:'speech', text:'对称轴是过顶点的那条竖直线，公式是 x = -b/(2a)。' },
  { id:'a2', type:'wb_draw_latex', latex:'x=-\\frac{b}{2a}', x:100, y:80, width:300, height:80 },
  { id:'a3', type:'speech', text:'我们在白板上把它推导出来。' },
  { id:'a4', type:'laser', elementId:'l-1' },
  { id:'a5', type:'speech', text:'看这个一般式。' },
  { id:'a6', type:'discussion', topic:'为什么 a 决定开口方向？' },
];
const scenes = [{ id:'scene-quad', type:'slide', actions } as any];
const segs = resolveActionTimeline(scenes);
out.timeline = segs.map((s:any) => ({ type: s.action.type, id: s.action.id, startMs: s.startMs, durationMs: s.durationMs, blocking: s.blocking, text: s.action.text || s.action.latex || s.action.elementId || s.action.topic || '' }));
console.log(out.timeline);
const wb = [
  { id:'w1', type:'text', left:80, top:120, width:420, height:60, content:'树荫减少太阳辐射' },
  { id:'w2', type:'latex', left:300, top:140, width:300, height:80, latex:'x=-b/2a' },
  { id:'w3', type:'shape', left:900, top:480, width:200, height:120 },
];
out.conflicts = buildWhiteboardConflicts(wb); out.wb = wb;
console.log(out.conflicts);
out.agents = Object.values(BUILT_IN_AGENTS).map((a:any) => ({ id:a.id, name:a.name, role:a.role, priority:a.priority, persona:(a.persona||'').slice(0,90), allowed:a.allowedActions }));
console.log(out.agents.map((a:any)=>`${a.id} ${a.name} ${a.role} p${a.priority} [${a.allowed.length}]`).join('\n'));
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
