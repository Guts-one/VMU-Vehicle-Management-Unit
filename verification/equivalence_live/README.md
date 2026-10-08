# Live Stateflow/C equivalence

The harness runs the reference Stateflow chart beside the hand-written C controller, wrapped as an S-Function. Both receive the same physical inputs; the C adapter converts them to the fixed-point API. Each row compares the active mode and the three output enables. State comparison matters because EV and regenerative braking share the same enable pattern.

## Recorded result

The [saved run](../../reports/equivalence_live/summary.txt) contains 473 sequential rows: 469 exact matches and four intentional sub-LSB quantization differences. There are zero unexpected grid mismatches. Stateflow coverage is 44/44 decisions, 78/78 condition outcomes, and 39/39 MC/DC outcomes.

The [sub-LSB report](../../reports/equivalence_live/sublsb_band.csv) records off-grid inputs that round across a C threshold. For example, 35.04 km/h rounds to 350 tenths of km/h. These four rows are reported separately and excluded from the grid-match verdict; they must not be described as exact model/C matches. See [fixed-point notes](../../docs/fixed-point.md).

## Run the live comparison

Needs MATLAB/Simulink, Stateflow, Simulink Coverage, the Legacy Code Tool, and a configured MEX C compiler. From the repository root in MATLAB:

```matlab
addpath(genpath('Model/HEV_powersplit_adapted'));
cd verification/equivalence_live
build_sfun_mode_logic
results = run_live_equivalence;
assert(results.pass);
```

The runner builds the harness if necessary. Fresh results are written to `build/equivalence_live/`: summaries, per-row CSVs, chart coverage counts, and an HTML coverage report. Generated S-Function and harness files stay beside the source scripts and are ignored by Git.

The stimulus uses `T−1`, `T`, and `T+1` at the input resolution, setup sequences for the relevant state, four off-grid probes, and the saved chart MC/DC vectors. Regenerate it from the harness directory with `python3 gen_boundary_stimulus.py`. The generator requires [the saved chart stimulus](../../reports/simulink_native_mcdc/stimulus_and_outputs.csv).

## C coverage and comparison

From the repository root in Linux/WSL:

```sh
bash scripts/run_mcdc_native.sh
bash verification/equivalence_live/run_boundary_mcdc.sh
python3 verification/equivalence_live/compare_coverage.py --reports-dir build
```

The Unity suites include defensive paths that the boundary sequence does not reach. The boundary-only result is therefore separate from full-suite coverage. Use a matching GCC/gcov pair with condition-coverage support; `CC`, `GCOV`, and `PYTHON` can select installed executables.

The comparison maps 14 chart transitions to their C predicates. Its chart status comes from the overall chart MC/DC total, while C coverage is checked by mapped predicate. Different condition representations produce different counts. The command fails when evidence is missing or incomplete; output goes to `build/coverage_comparison/`.

To inspect the saved baseline instead, omit `--reports-dir build`. This does not rerun either model or C coverage.

## Test Manager

Simulink Test adds a managed test case and PDF report around the same comparison. From `verification/equivalence_live/` in MATLAB, run:

```matlab
tm_create_and_run
```

The generated test file and report go to `build/equivalence_live/`. The saved [test file](mode_logic_equivalence.mldatx) and [PDF](../../reports/equivalence_live/tm_report.pdf) remain historical evidence. Recreate the test through the script on another machine so its preload callback uses that checkout’s path.

## Main files

| File | Purpose |
| --- | --- |
| `gen_boundary_stimulus.py`, `boundary_stimulus.csv` | Deterministic physical and fixed-point stimulus, with expected C modes |
| `mode_probe.c` | Compiled C replay and comparison with the generator’s expectations |
| `sfun_mode_logic_wrap.c`, `test_wrap.c` | C adapter and its standalone comparison with the controller |
| `build_sfun_mode_logic.m`, `build_equivalence_harness.m` | S-Function and chart/C harness construction |
| `run_live_equivalence.m`, `export_simulink_mcdc.m` | Simulation, state/output checks, and coverage export |
| `mcdc_mapping.csv`, `compare_coverage.py` | Transition correspondence and coverage comparison |
| `tm_setup_equivalence.m`, `tm_check_equivalence.m`, `tm_create_and_run.m` | Test Manager setup, criteria, and execution |
| `verify_all.m` | Combined MATLAB build and simulation check |

The [265-row recorded replay](../simulink_c_equivalence.c) is retained as a fast regression check without MATLAB. It uses recorded outputs and does not replace the live comparison. Neither harness establishes target execution, compiler qualification, or formal safety compliance.
