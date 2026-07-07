# Iteration Log — repair and hold the shinobi-wan manifest→plan golden path

Started: <fill at launch> · Budgets: 12h wall-clock / $0 external spend
Holdout N: 443 (derived by power calc: bar 0.80, δ 0.05, 95% → floor 246)
Cycle-0 compressed solution size: <record from first score.sh run>

<!-- One entry per cycle. Hypothesis, predicted effect range, expected
failure mode, and diagnostic are written BEFORE the change — a hypothesis
written after the result is a rationalization. One variable per cycle; a
multi-concern diff marks the cycle CONFOUNDED and its result may not be
cited by later hypotheses. Scores always carry their interval. -->

## Cycle <n> — <timestamp>
- Score (dev): <score ± hw> (prev: <score ± hw>) · Movement: <yes/no — intervals overlap?>
- Probe (per operator): <key_reorder: · item_reorder: · comment_noise: · service_rename: · config_scale:> (floors: 0.8)
- Holdout triple (if called this cycle): (<n>, <dev ± hw>, <holdout ± hw>)
- Hypothesis: <what change should move the metric, and why>
- Predicted effect: <from> → <to> ± <tolerance>  ← committed BEFORE the change
- Expected failure mode: <how this change could fail or turn into a cheat>
- Diagnostic: <what observation distinguishes success from the failure mode>
- Change: <the ONE variable changed> (commit <hash>)
- Result: <score ± hw after> · Hypothesis: <confirmed — landed in range /
  refuted — outside range / CONFOUNDED — multi-variable diff> · <what was learned>
- Reflection: <generalizing or memorizing? which operator scores moved?
  if memorizing, which eval-shaped artifact gets removed next cycle;
  if result was outside the predicted range in EITHER direction, what
  actually caused it>

## Final report
- Best holdout score (± interval):
- Dev/holdout divergence over the run: <none / cycles where flagged>
- Per-operator probe scores at close:
- What generalized:
- What was abandoned (and why):
- Confounded cycles (excluded from causal claims):
- Highest-leverage next steps:
