import { advanceRun } from '@/lib/server/generation/run/plan';
import { buildPrompt } from '@openmaic/generation/prompts/loader';
import fs from 'node:fs';
const out: any = {};
// 1) Replay a run: material attached, 3-scene outline, crash after scene:1:actions, resume.
const done = new Set<string>(); let state: any = 'preparing'; const trace: any[] = []; const runInput = { materialIds: ['mat_1'] };
for (let i = 0; i < 40; i++){
  const a: any = advanceRun({ state, runInput, completed: done, sceneCount: 3 });
  if (a.kind === 'await-outline-confirmation'){ trace.push({ next: 'await-outline-confirmation' }); state = 'generating'; continue; }
  if (a.kind === 'complete'){ trace.push({ next: 'complete' }); break; }
  trace.push({ next: a.step.id, state: a.state });
  if (a.step.id === 'scene:1:actions' && !out.crashed){ out.crashed = true; trace.push({ event: 'worker crash → lease expires → another worker resumes; checkpoints so far: ' + done.size }); continue; }
  done.add(a.step.id);
}
out.trace = trace;
// 2) Real prompts built by the package's own loader
const p = buildPrompt('requirements-to-outlines' as any, { requirement: '给初二学生讲光合作用，15 分钟，要有一个互动模拟和一个小测验', userProfile: '', pdfContent: 'None', availableImages: 'No images available', researchContext: 'None', teacherContext: '', hasSourceImages: false });
out.outlinePrompt = { systemChars: p!.system.length, systemHead: p!.system.slice(0, 700), user: p!.user };
const sa = buildPrompt('slide-actions' as any, {});
out.slideActionsSystemHead = sa ? sa.system.slice(0, 1600) : null;
out.templates = fs.readdirSync(process.env.REPO + '/packages/@openmaic/generation/templates').map(t => ({ t, systemLines: fs.readFileSync(`${process.env.REPO}/packages/@openmaic/generation/templates/${t}/system.md`,'utf8').split('\n').length }));
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(trace.map(t => t.next || t.event).join('\n')); console.log('outline system prompt chars', out.outlinePrompt.systemChars); console.log(out.templates);
