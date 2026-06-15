# MC/DC matrix - `mode_logic_team.c`

Cross-reference between Unity tests, requirements, and the MC/DC result for
the fixed-point implementation of the VMU mode logic.

> Authoritative metric: `gcov-14 --conditions` on a `gcc-14
> -fcondition-coverage` build. See `mcdc_native_gcov14/summary.txt`.

## 1. Headline coverage

| Metric | Result |
|---|---:|
| Unity tests / failures | 141 / 0 |
| Functions covered | 41 / 41 (100.00 %) |
| Lines executed | 286 / 294 (97.28 %) |
| Branches taken (lcov) | 98 / 100 (98.00 %) |
| C MC/DC condition outcomes | 86 / 86 (100.00 %) |
| Stateflow native MC/DC | 39 / 39 (100.00 %) |
| Static MC/DC issues | 0 |

The previous structural gaps in the C implementation and Stateflow chart were
closed with equivalent guard forms that preserve transition priority. No C or
Stateflow MC/DC outcome remains uncovered.

## 2. Fixed-point interface under test

Production code no longer exposes `float` inputs. Tests still use physical
units in their local helpers for readability, then convert to the production
fixed-point API before calling `ModeLogic_Step`.

| Signal | C field | Scale |
|---|---|---:|
| Vehicle speed | `speed_dkph` | 0.1 km/h |
| Demanded power | `p_dem_dkw` | 0.1 kW |
| State of charge | `soc_q10000` | 0..10000 |
| Engine speed | `weng_rpm` | rpm |

## 3. Tests to requirements

| Test suite | Tests | Main requirement scope |
|---|---:|---|
| `test_standstill_transitions.c` | 13 | SwLLR01, SwLLR02, output/null/init sanity |
| `test_ev_transitions.c` | 16 | SwLLR03, SwLLR04, SwLLR05 |
| `test_regenb_transitions.c` | 16 | SwLLR06, SwLLR07, SwLLR08 |
| `test_start_to_hybrid_ice_and_resets.c` | 20 | SwLLR18, SwLLR19, SwLLR20, SwLLR22 |
| `test_ice_hybrid_external_and_internal.c` | 76 | SwLLR09-SwLLR17, SwLLR21, SwLLR23, SwHLR06, SwHLR08, SwHLR09 |

The 141 Unity tests cover positive transitions, blocked-by-condition cases,
boundary values, output mapping, null robustness, reset priority, and
external-before-internal priority.

## 4. Refactored MC/DC decisions

| Requirement / transition | Previous gap | Current implementation |
|---|---|---|
| SwLLR02 - `STANDSTILL->START` | The later START guard repeated conditions already implied by the failed higher-priority EV guard. | `guard_standstill_to_start()` is `speed_gt_stop`; this is equivalent because `STANDSTILL->EV` is evaluated first. |
| SwLLR06 - `REGENB->START` | `(A && B) || C` was non-tree-like for unique-cause MC/DC. | `guard_regenb_to_start()` evaluates `speed_gt_ev_max`, `p_dem_ge_stop_low`, and `soc_lt_ev_out` before the guard decision. |
| SwLLR08 - `REGENB->EV` | Upstream `REGENB->START` and `REGENB->STANDSTILL` priority made `speed<=EV_MAX` and `SOC>=EV_OUT` redundant in the later EV guard. | `guard_regenb_to_ev()` is `P_dem>=STOP_LOW && speed>STOP`; the omitted terms are already guaranteed by earlier failed guards. |
| SwLLR19 - `START->ICE` | The later ICE guard was the complement of the higher-priority HYBRID guard under `engine_speed>ENG_ON`. | `guard_start_to_ice()` is `weng_gt_on`; `START->HYBRID` is still evaluated first, preserving behavior. |

## 5. Tool outputs

| Artifact | Purpose |
|---|---|
| `mcdc_native_gcov14/summary.txt` | Native GCC condition-coverage summary: 86 / 86 outcomes. |
| `mcdc_native_gcov14/mode_logic_team.c.gcov` | Annotated source with MC/DC counters. |
| `branch_coverage_lcov/coverage.info` | lcov branch/line trace for `src/mode_logic_team.c`. |
| `mcdc_static_checker/output.txt` | Static tree-likeness result: no errors. |
| `simulink_native_mcdc/index.html` | Native Simulink Coverage report: 39 / 39 MC/DC outcomes. |
| `simulink_native_mcdc/stability_check.csv` | Hold-scenario stability check: PASS, zero post-settle output toggles. |
| `simulink_regression_outputs.csv` | Focused Simulink regression outputs. |
| `c_fixed_point_regression_outputs.csv` | Matching fixed-point C outputs for the same scenarios. |

The remaining two lcov branch misses are defensive `default` paths. They are
not MC/DC conditions and are intentionally kept for robust/MISRA-style handling
of invalid enum values.
