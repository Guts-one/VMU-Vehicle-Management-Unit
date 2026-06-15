# Test Reports - `mode_logic_team.c`

This folder holds coverage and regression artifacts generated against
`src/mode_logic_team.c` using the Unity tests under `test/`.

## Headline Numbers

| Metric | Value | Source |
|---|---:|---|
| Unity tests | 141 / 0 failures | 5 binaries combined |
| Functions | 100.00 % (41 / 41) | `lcov` |
| Lines | 97.28 % (286 / 294) | `gcov-14` |
| Branches | 98.00 % (98 / 100) | `lcov` branch coverage |
| C MC/DC condition outcomes | 100.00 % (86 / 86) | `gcov-14 --conditions` |
| Stateflow native MC/DC | 100.00 % (39 / 39) | Simulink Coverage |
| Stateflow decision/condition | 100.00 % / 100.00 % | Simulink Coverage |
| Stateflow stability | PASS | 6 hold scenarios |
| Simulink↔C equivalence | 265 / 265 rows match | full MC/DC stimulus replay |
| Static MC/DC issues | 0 | `mcdc-checker` |

No C or Stateflow MC/DC outcome remains uncovered. The two lcov branch misses
are defensive `default` paths and are not MC/DC conditions.

## Folder Layout

```text
Test report/
|-- README.md
|-- summary.txt
|-- MCDC_matrix.md
|-- simulink_c_equivalence_summary.txt
|-- c_full_stimulus_equivalence.csv
|-- simulink_c_regression_summary.txt
|-- c_fixed_point_regression_outputs.csv
|-- simulink_regression_outputs.csv
|-- simulink_native_mcdc/
|   |-- index.html
|   |-- summary.txt
|   |-- stimulus_and_outputs.csv
|   |-- stability_check.csv
|   `-- coverage_data.mat
|-- branch_coverage_lcov/
|   |-- coverage.info
|   |-- html/index.html
|   `-- build_cov/
|-- mcdc_native_gcov14/
|   |-- mode_logic_team.c.gcov
|   |-- mode_logic_team.gcov.txt
|   |-- summary.txt
|   |-- gcov.stderr
|   `-- build_mcdc/
`-- mcdc_static_checker/
    |-- output.txt
    `-- report.json
```

## Tools

| Tool | Version / source | Purpose |
|---|---|---|
| `gcc-11` | Ubuntu 22.04 | Branch/line instrumentation for lcov |
| `lcov` | 1.14 | Branch/line aggregation and HTML report |
| `gcc-14` | 14.3.0 | Native condition coverage instrumentation |
| `gcov-14 --conditions` | 14.3.0 | MC/DC condition-outcome decoding |
| `mcdc-checker` | libclang-19 backend | Static BDD tree-likeness check |
| Unity | `unity/src` or `UNITY_SRC_DIR` | Unit-test framework |
| MATLAB/Simulink Coverage | R2026a | Native Stateflow MC/DC and regression simulation |

## Regeneration Flow

Run from the repository root in WSL Ubuntu 22.04:

```bash
./run_branch_coverage.sh
./run_mcdc_native.sh
./run_simulink_c_equivalence.sh

LIBCLANG_PATH=/usr/lib/llvm-19/lib \
    mcdc-checker src/mode_logic_team.c -I inc \
    -j "Test report/mcdc_static_checker/report.json" \
    > "Test report/mcdc_static_checker/output.txt" 2>&1
```

If the repo does not contain `unity/src/unity.c`, either clone Unity into
`unity/` or set:

```bash
export UNITY_SRC_DIR=/home/vmu/unity/src
```

The scripts also auto-detect `/home/vmu/unity/src` when `unity/src` is absent.

## Current MC/DC Status

The fixed-point implementation and Stateflow chart now close the previous
structural gaps using equivalent lower-priority guards. Conditions that are
already implied by higher-priority transitions are not repeated in the later
guard.

The affected logical transitions are:

- `STANDSTILL -> START`
- `REGENB -> EV`
- `START -> ICE`

`REGENB -> START` remains decomposed with atomic predicates in C for
tree-likeness. The current native C metric is 86 / 86 outcomes; the current
native Simulink Coverage metric is 39 / 39 MC/DC outcomes with no filters or
justifications.

This preserves the modeled priority and hysteresis while making every condition
outcome observable to `gcov-14 --conditions`.

## Simulink Regression Evidence

The Stateflow chart `Control/Mode Logic` in
`Model/HEV_powersplit_adapted/HEV_powersplit_adapted.slx` was updated for the
same equivalent guard structure where applicable. MATLAB R2026a validation:

- native Simulink Coverage completed with 44 / 44 decisions, 78 / 78
  condition outcomes, and 39 / 39 MC/DC outcomes;
- the native coverage report used no filters, exclusions, or justifications;
- six hold scenarios passed stability checks with zero output toggles after
  settle;
- **the full 265-row MC/DC stimulus replayed through the fixed-point C
  implementation matched the recorded chart outputs row by row (0 mismatches)**
  — `./run_simulink_c_equivalence.sh`, primary equivalence evidence;
- a focused 16-row harness simulation also matched the fixed-point C outputs
  for `Mot_Enable`, `Gen_Enable`, and `ICE_Enable` (historical evidence,
  superseded by the 265-row replay).

The equivalence and coverage outputs are stored in:

- `simulink_native_mcdc/index.html`
- `simulink_native_mcdc/summary.txt`
- `simulink_native_mcdc/stimulus_and_outputs.csv`
- `simulink_native_mcdc/stability_check.csv`
- `simulink_c_equivalence_summary.txt`
- `c_full_stimulus_equivalence.csv`
- `simulink_regression_outputs.csv`
- `c_fixed_point_regression_outputs.csv`
- `simulink_c_regression_summary.txt`
