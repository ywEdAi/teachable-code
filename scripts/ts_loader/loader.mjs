// Node resolve hook so a TypeScript repo's own modules run without installing its dependencies.
// Run:  REPO=/path/to/repo node --experimental-transform-types --import <this dir>/register.mjs your_script.ts
//  - "./x.js" → "./x.ts" when only the .ts exists (TS projects import with .js suffixes)
//  - "@scope/pkg" → packages/@scope/pkg/src/index.ts for monorepo packages (PKG_ROOTS, default "packages")
//  - "@/..." → repo root (common tsconfig path alias)
//  - bare npm packages → files named in SHIMS (JSON env: {"name": "/abs/path.mjs"}) or ./shims/<name>.mjs
//    Shims are stand-ins: say so wherever their output is shown.
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const REPO = process.env.REPO || process.cwd();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHIMS = JSON.parse(process.env.SHIMS || '{}');
const PKG_ROOTS = (process.env.PKG_ROOTS || 'packages').split(',');
function tsOf(p){ for (const c of [p.replace(/\.js$/, '.ts'), p.replace(/\.js$/, '.tsx'), p + '.ts', p + '.tsx', p + '/index.ts']) if (existsSync(c)) return c; return null; }
export async function resolve(spec, ctx, next){
  if (SHIMS[spec]) return { url: pathToFileURL(SHIMS[spec]).href, shortCircuit: true };
  const local = path.join(HERE, 'shims', spec.replace(/\//g, '__') + '.mjs');
  if (!spec.startsWith('.') && !spec.startsWith('@/') && !spec.startsWith('node:') && existsSync(local)) return { url: pathToFileURL(local).href, shortCircuit: true };
  const m = spec.match(/^(@[^/]+\/[^/]+)(\/.*)?$/);
  if (m) for (const root of PKG_ROOTS) { const base = path.join(REPO, root, m[1], 'src'); if (existsSync(base)) { const p = tsOf(path.join(base, m[2] ? m[2].replace(/^\//, '') : 'index')); if (p) return { url: pathToFileURL(p).href, shortCircuit: true }; } }
  if (spec.startsWith('@/')) { const p = tsOf(path.join(REPO, spec.slice(2))); if (p) return { url: pathToFileURL(p).href, shortCircuit: true }; }
  if (spec.startsWith('.') && ctx.parentURL) { const abs = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec); if (!existsSync(abs) || !/\.(m?js|ts|tsx)$/.test(abs)) { const p = tsOf(abs); if (p) return { url: pathToFileURL(p).href, shortCircuit: true }; } }
  return next(spec, ctx);
}
