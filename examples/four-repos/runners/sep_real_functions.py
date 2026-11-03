"""Run the REAL semantic-entropy functions from the SEP repo on CPU.
torch/transformers/wandb/openai are not installable here, so we stub those
imports; the functions under test are pure numpy and run unmodified."""
import sys, types, json
for name in ["wandb", "openai", "torch", "torch.nn", "torch.nn.functional", "transformers",
             "uncertainty.models.huggingface_models", "uncertainty.utils.openai", "uncertainty.utils.utils"]:
    m = types.ModuleType(name); sys.modules[name] = m
sys.modules["torch"].cuda = types.SimpleNamespace(is_available=lambda: False)
sys.modules["torch"].nn = sys.modules["torch.nn"]; sys.modules["torch.nn"].functional = sys.modules["torch.nn.functional"]
sys.modules["transformers"].AutoModelForSequenceClassification = object
sys.modules["transformers"].AutoTokenizer = object
sys.modules["uncertainty.models.huggingface_models"].HuggingfaceModel = object
pkg = types.ModuleType("uncertainty.utils"); pkg.openai = sys.modules["uncertainty.utils.openai"]; pkg.utils = sys.modules["uncertainty.utils.utils"]
sys.modules["uncertainty.utils"] = pkg
sys.path.insert(0, sys.argv[1])
import importlib.util
spec = importlib.util.spec_from_file_location("se", sys.argv[1] + "/uncertainty/uncertainty_measures/semantic_entropy.py")
se = importlib.util.module_from_spec(spec); spec.loader.exec_module(se)
import numpy as np

# Toy NLI judge standing in for DeBERTa-MNLI: answers mean the same if they normalize to the same canonical form.
CANON = {"paris": "paris", "it's paris": "paris", "the capital is paris": "paris", "paris, france": "paris",
         "lyon": "lyon", "marseille": "marseille", "1912": "1912", "april 1912": "1912", "1915": "1915",
         "in 1912": "1912", "1913": "1913", "it sank in 1912": "1912"}
class ToyNLI:
    calls = 0
    def check_implication(self, a, b, example=None):
        ToyNLI.calls += 1
        return 2 if CANON[a.lower()] == CANON[b.lower()] else 0   # 2=entailment, 0=contradiction

cases = {
  "confident (Q: capital of France?)": (["Paris", "It's Paris", "Paris", "The capital is Paris", "Paris, France", "Paris", "Paris", "It's Paris", "Paris", "Paris"],
                       [-0.1,-0.4,-0.1,-0.6,-0.5,-0.1,-0.1,-0.4,-0.1,-0.1]),
  "lexically diverse but semantically sure (Q: when did Titanic sink?)": (["1912", "April 1912", "In 1912", "It sank in 1912", "1912", "april 1912", "in 1912", "1912", "It sank in 1912", "April 1912"],
                       [-0.3,-0.9,-0.8,-1.2,-0.3,-0.9,-0.8,-0.3,-1.2,-0.9]),
  "confabulating (Q: obscure fact)": (["1912", "1915", "1913", "1915", "1912", "1913", "1915", "1912", "1913", "1915"],
                       [-1.1,-1.2,-1.3,-1.1,-1.2,-1.4,-1.0,-1.3,-1.2,-1.1]),
}
out = {}
for k, (resp, ll) in cases.items():
    ToyNLI.calls = 0
    ids = se.get_semantic_ids(resp, ToyNLI(), strict_entailment=False)
    calls = ToyNLI.calls
    cae = se.cluster_assignment_entropy(ids)
    per_id = se.logsumexp_by_id(ids, ll, agg="sum_normalized")
    se_rao = se.predictive_entropy_rao(per_id)
    naive = se.predictive_entropy(ll)  # regular (lexical) entropy estimate
    n_lex = len(set(r.lower() for r in resp))
    out[k] = dict(responses=resp, semantic_ids=ids, nli_calls=calls, distinct_strings=n_lex,
                  clusters=len(set(ids)), cluster_assignment_entropy=round(float(cae),3),
                  semantic_entropy_rao=round(float(se_rao),3), regular_entropy=round(float(naive),3),
                  logsumexp_sum_agg_quirk=[round(float(x),3) for x in se.logsumexp_by_id(ids, ll, agg="sum")])
    print(k); [print("  ", kk, "=", vv) for kk, vv in out[k].items() if kk != "responses"]
json.dump(out, open(sys.argv[2], "w"), indent=1)
