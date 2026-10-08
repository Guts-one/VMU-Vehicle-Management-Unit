# JavaScript/C equivalence

This harness checks the browser simulator’s [mode_logic.js](../../mode_logic.js) against the compiled [C controller](../../src/mode_logic_team.c). It reuses the live harness’s boundary stimulus, C probe, and transition mapping.

## Checks

| Check | Baseline result |
| --- | --- |
| Active mode and three output enables against compiled C | 473/473 rows match |
| Active mode against the Python-derived expectations | 473/473 rows match |
| Independence pairs for the probed JavaScript conditions | 18/18 conditions across 14 mapped decisions |
| JavaScript coverage through c8 | All statements, functions, and lines; approximately 99% branches |

Both JavaScript and C quantize the physical inputs using the same scales and rounding rule. Their exact 473-row match includes the four sub-LSB probes; the separate live Stateflow/C comparison reports those four as quantization differences.

## Run

From the repository root, with Node.js, Python 3, and GCC available:

```sh
npm ci
npm run verify
npm run coverage
# npm test runs both
```

`verify.js` regenerates the stimulus, compiles the C probe, runs the differential check, and checks the independence pairs. It exits with an error if a stage fails. Set `PYTHON` or `CC` to select an explicit executable. Output goes to `build/js_equivalence/` and `coverage/`.

| Script | Purpose |
| --- | --- |
| `verify.js` | Runs the full JavaScript/C comparison |
| `run_js_equivalence.js` | Compares state and outputs with a compiled-probe CSV; without it, checks the Python-derived expectations only |
| `mcdc_independence_pairs.js` | Checks the probe groups against the condition mapping |
| `run_coverage.js` | Exercises the stimulus and additional defensive/API paths under c8 |

JavaScript branch coverage and the independence-pair check are separate from GCC native MC/DC and Simulink Coverage. The evidence applies to this controller and stimulus; it does not cover the browser UI, target hardware, or every possible input sequence.
