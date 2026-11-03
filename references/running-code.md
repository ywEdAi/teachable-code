# Running a repo's own code without its stack

Most research repos need GPUs, model downloads or API keys. Many of their most instructive functions do not: entropy over cluster ids, a radix tree, a step planner, an output parser, a selection rule. Run those for real; the page is better for every real output it shows.

## Find what can run

- `scripts/inventory.py --summary` lists files, definitions and shape signals.
- A function is a good candidate when its body uses only the standard library, numpy or pure logic, even if its module imports torch or an SDK at the top.
- Committed outputs (results folders, eval fixtures) can drive the repo's own post-processing: SEAL's `_top_k` ran on SEAL's committed training results.

## Python

```python
import sys, types; sys.path.insert(0, "<skill>/scripts")
from pyrun import stub, load, exec_cell
stub("wandb", "openai", "torch", "torch.nn", "torch.nn.functional", "transformers")
sys.modules["torch"].cuda = types.SimpleNamespace(is_available=lambda: False)
se = load("se", "/work/repo/semantic_uncertainty/uncertainty/uncertainty_measures/semantic_entropy.py")
ids = se.get_semantic_ids(responses, ToyNLI(), strict_entailment=False)
```

- Run untrusted repo code with `python3 -I` from a directory you control; pass repo paths as arguments.
- A notebook cell: `exec_cell(path, i, env)` with the names it needs in `env`.
- If a stub replaces a model (a toy NLI judge), every output that depends on it is "toy": say which part is real.

## TypeScript / JavaScript

```bash
REPO=/work/repo SHIMS='{"nanoid":"/path/to/nanoid/index.js"}' \
node --experimental-transform-types --import <skill>/scripts/ts_loader/register.mjs runner.ts out.json
```

The loader maps `./x.js` to `./x.ts`, monorepo packages (`@scope/pkg` → `packages/@scope/pkg/src`), the `@/` alias, and bare npm packages to files in `ts_loader/shims/`. Shims are minimal stand-ins (the bundled `jsonrepair` only removes trailing commas; `partial-json` only closes truncated strings, arrays and objects): name them as such wherever their output appears.

## No network, no GPU

When the package registry or model hub is unreachable, do not retry through other routes. Use what is installed (check `pip list`, `/opt/*/node_modules`), stub the rest, and record in the page which nodes "需要 GPU，本次只读代码".

## Provenance labels

| Label | Use when |
|---|---|
| 已在 CPU 上运行仓库原代码 (`run:"ran"`, `prov:"run"`) | the repo's own function produced this output here |
| 仓库提交的真实运行结果 (`prov:"data"`) | the output came from files the authors committed |
| 原代码 + 合成数据 (`run:"synth"`) | real code, inputs you constructed |
| 仓库测试里的 mock 输出 (`prov:"test"`) | strings from the repo's tests |
| 模板里自带的示例 (`prov:"example"`) | examples inside prompt templates |
| 需要 GPU，本次只读代码 (`run:"gpu"`) | nothing ran |
