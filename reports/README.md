# Verification reports

Selected evidence from the v2.1.1 baseline is retained here. The C coverage and recorded Stateflow replay were verified in June 2026; the live and JavaScript/C harnesses were added in July 2026. These are saved results, not a claim that MATLAB runs in CI.

## Results and evidence

| Check | Saved result | Evidence |
| --- | --- | --- |
| C unit suites | 141 tests, zero failures | [Summary](summary.txt), [test/requirement matrix](MCDC_matrix.md) |
| C function / line / branch coverage | 41/41 functions; 286/294 lines; 98/100 branches | [lcov HTML](branch_coverage_lcov/html/index.html), [gcov summary](mcdc_native_gcov14/summary.txt) |
| C MC/DC condition outcomes | 86/86 | [Annotated gcov](mcdc_native_gcov14/mode_logic_team.c.gcov) |
| Stateflow decision / condition / MC/DC | 44/44; 78/78; 39/39 | [Coverage HTML](equivalence_live/chart_coverage.html), [machine-readable counts](equivalence_live/chart_coverage.json) |
| Live Stateflow/C state and outputs | 469 exact matches; 4 documented quantization differences; zero unexpected grid mismatches | [Summary](equivalence_live/summary.txt), [all 473 rows](equivalence_live/equivalence_rows.csv), [sub-LSB cases](equivalence_live/sublsb_band.csv) |
| Test Manager | One passing live-equivalence test | [Tool-generated PDF](equivalence_live/tm_report.pdf) |
| Recorded Stateflow/C outputs | 265/265 rows match | [Summary](simulink_c_equivalence_summary.txt), [row results](c_full_stimulus_equivalence.csv) |
| Stateflow hold scenarios | Six scenarios, zero output toggles after settling | [Stability data](simulink_native_mcdc/stability_check.csv) |
| Static decision analysis | One decision inspected; zero non-tree-like issues | [mcdc-checker output](mcdc_static_checker/output.txt) |

C and Stateflow use different representations of conditions, so 86 and 39 are different coverage denominators. The [coverage comparison](equivalence_live/coverage_comparison.csv) maps the corresponding transitions; it does not make those totals interchangeable.

JavaScript/C equivalence is a separate check: both implementations quantize inputs identically and match all 473 rows, including the off-grid probes. Run it with `npm run verify`; see the [harness documentation](../verification/js_equivalence/README.md).

## Reproduce

See [build and test](../docs/testing.md) for dependencies and commands. Fresh output is written to ignored `build/` folders. To compare the saved coverage inputs without modifying them:

```sh
python3 verification/equivalence_live/compare_coverage.py
```

To compare a fresh MATLAB run with fresh C coverage:

```sh
python3 verification/equivalence_live/compare_coverage.py --reports-dir build
```

The comparison writes to `build/coverage_comparison/` and returns a failure if either input is missing or mapped coverage is incomplete.

## Evidence retention

Readable summaries, CSVs, annotated coverage, model coverage data, the Test Manager PDF, and the HTML report assets are kept. Executables, objects, generated test runners, raw coverage counters, and duplicate execution logs are excluded.

Raw reports are preserved as recorded, so some contain the former `Test report/` path or machine-specific paths from the original run. This index provides the current locations. The focused 16-row regression is historical evidence; the 265-row replay and 473-row live harness provide broader comparisons. The original 265-row export script is not included, but its recorded inputs remain available to both maintained harnesses.

## Limits

- The live comparison covers one 473-row sequence, with four known quantization-band differences. It is not exhaustive input-space or target-hardware validation.
- C coverage includes defensive paths; two lcov branches remain uncovered. Full condition coverage is a different metric.
- `NfHLR01` platform timing and `NfHLR02` dedicated SOC/engine-speed hysteresis-cycle tests remain outside or incomplete in the saved verification scope. See [requirements ownership](../docs/requirements-ownership.md).
- The static decision checker inspected one decision. It does not independently establish full MC/DC.
- The S-Function uses a host MEX compiler. Target execution, timing, and vehicle integration are not established by these results.
- Static checks and coverage are project evidence, not a formal MISRA or ISO 26262 compliance assessment.
