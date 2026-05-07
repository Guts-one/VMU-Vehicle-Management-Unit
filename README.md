# VMU — Vehicle Management Unit

## Overview

This repository hosts the VMU (Vehicle Management Unit) baseline for a power-split hybrid electric vehicle (HEV).
It brings together the system reference Simulink model with linked requirements, a manual C implementation of the supervisory mode logic, the final requirements document, an interactive web simulator, and a complete test, coverage, and CI infrastructure aligned with **MISRA C 2012**.

The VMU supervisory logic selects operating modes — `STANDSTILL`, `EV`, `REGENB`, `START`, `ICE`, `HYBRID` — based on driver power demand, vehicle speed, battery state of charge, and engine speed.

## Repository Structure

```text
.
├── .github/workflows/
│   └── ci.yaml                      # Build, unit tests, and MISRA static analysis
├── Model/
│   ├── HEV_powersplit_adapted/      # Simulink reference model with requirements traceability
│   ├── HEV Powersplit_adapted_model_Document.pdf
│   └── Requirements.docx
├── inc/
│   └── mode_logic_team.h            # Modular team-oriented API (current baseline)
├── src/
│   ├── mode_logic_team.c            # C implementation of the supervisory logic
│   └── transicoes_estados_mode_logic.md
├── test/
│   ├── test_ev_transitions.c                      # EV-mode transition tests
│   ├── test_regenb_transitions.c                  # Regenerative-braking transition tests
│   ├── test_standstill_transitions.c              # Standstill transition tests
│   ├── test_start_to_hybrid_ice_and_resets.c      # START → HYBRID/ICE and reset paths
│   └── test_ice_hybrid_external_and_internal.c    # ICE/HYBRID external + internal transitions
├── Test report/                     # Versioned coverage artifacts (branch + MC/DC)
│   ├── README.md                    # Test-report tooling, layout, and how-to
│   ├── MCDC_matrix.md               # Tests ↔ requirements ↔ MC/DC matrix
│   ├── summary.txt                  # Curated coverage summary
│   ├── branch_coverage_lcov/        # gcc-11 + lcov 1.14 (lines + branches)
│   ├── mcdc_native_gcov14/          # gcc-14 -fcondition-coverage (native MC/DC)
│   └── mcdc_static_checker/         # mcdc-checker BDD tree-likeness check
├── doc/
│   ├── Requirements.pdf             # Final requirements document
│   └── mapeamento_transicoes_secao4_por_responsavel.md
├── mode_logic_sim.html              # Interactive web simulator
├── run_branch_coverage.sh           # Branch/line coverage runner (gcc-11 + lcov)
├── run_mcdc_native.sh               # Native MC/DC runner (gcc-14 + gcov-14 --conditions)
├── misra.py                         # MISRA C 2012 verification script
├── MISRA_COMPLIANCE.md              # Detailed MISRA rules and patterns
├── MISRA_QUICKSTART.md              # Developer quick-start for MISRA
├── UnityExecution.md                # Unity build/coverage instructions
└── README.md
```

## Main Components

### Simulink Reference Model

Located in `Model/HEV_powersplit_adapted/`. It contains the supervisory model that the C baseline mirrors, together with **requirements linked directly inside the model** for traceability, plus overview material, scripts, image assets, and workflow support files. A standalone document describing the model is available at `Model/HEV Powersplit_adapted_model_Document.pdf`.

### C Mode Logic Baseline

The current C implementation lives in:

- `src/mode_logic_team.c`
- `inc/mode_logic_team.h`

The implementation provides:

- mode enumeration and I/O structures
- calibratable threshold constants for transitions (aligned with the Simulink model)
- per-state handlers structured for traceability
- centralized output mapping for motor, generator, and ICE enables (no one-step delay)
- MISRA-oriented coding style: `const` inputs, explicit `uint8_t` booleans, structured control flow

### Requirements & Transition Documentation

- `doc/Requirements.pdf` — final requirements document.
- `src/transicoes_estados_mode_logic.md` — state names, threshold mapping, transition priorities, and expected behavior per mode.
- `doc/mapeamento_transicoes_secao4_por_responsavel.md` — Section 4 transitions mapped per responsible team member.

### Test Suite

The repository ships a transition-oriented test infrastructure built on the **Unity** framework. Tests are organized by the state-machine transition they exercise, rather than per author:

| Suite | File | Scope |
|---|---|---|
| Standstill transitions | `test/test_standstill_transitions.c` | STANDSTILL entry/exit |
| EV transitions | `test/test_ev_transitions.c` | Entries, exits, and guards for EV mode |
| Regen-B transitions | `test/test_regenb_transitions.c` | Regenerative-braking transitions |
| START → HYBRID/ICE | `test/test_start_to_hybrid_ice_and_resets.c` | Cranking path and reset behavior |
| ICE/HYBRID transitions | `test/test_ice_hybrid_external_and_internal.c` | External and internal ICE/HYBRID transitions |

> **Note:** the test files contain only `void test_*(void)` functions — no `main()`. The Unity test runner (`main` + `RUN_TEST(...)` calls) is **generated automatically** via `unity/auto/generate_test_runner.rb` per test file. See *Build and Run the C Tests* below.

### Coverage Reports

The `Test report/` folder is the versioned home for coverage artifacts produced against `src/mode_logic_team.c` using the Unity tests under `test/`. Three independent toolchains are exercised:

- **branch coverage** with `gcc-11` + `lcov 1.14`
- **native MC/DC** (Modified Condition / Decision Coverage) with `gcc-14` (`-fcondition-coverage`) + `gcov-14 --conditions`
- **static MC/DC tree-likeness check** with `mcdc-checker` (Python + libclang-19)

**Headline numbers (current state of the repo):**

| Metric                       | Value                 | Source                        |
|------------------------------|-----------------------|-------------------------------|
| Unity tests                  | 141 / 0 failures      | 5 binaries combined           |
| Functions                    | 100 % (11 / 11)       | `lcov`                        |
| Lines                        | 95.15 % (157 / 165)   | `gcov-14`                     |
| Branches                     | 93.85 % (122 / 130)   | `lcov` (lcov_branch_coverage) |
| **MC/DC condition outcomes** | **93.10 % (108 / 116)** | `gcov-14 --conditions`      |
| Static MC/DC issues          | 1 (BDD non tree-like at line 63) | `mcdc-checker`     |

The 8 uncovered MC/DC outcomes are **structurally unreachable**. See `Test report/README.md` for tool details and `Test report/MCDC_matrix.md` for the tests ↔ requirements mapping and per-decision MC/DC analysis.

### Interactive Web Simulator

`mode_logic_sim.html` is a standalone, dependency-free simulator that mirrors the C state machine in JavaScript.

Features:

- Real-time dashboard for the active mode and powertrain enables
- Animated gauges for vehicle speed (km/h) and engine speed (RPM)
- Telemetry charts: vehicle speed, power demand (`P_dem`), state of charge (`SOC`), engine speed (`wEng`), and mode-transition history
- Manual control panel for all state variables
- Pre-configured scenarios (EV, regenerative braking)
- Automated drive cycles (short cycle and 1-minute continuous cycle) with automatic phase display
- Transition history table with input/output values

Open it in any modern browser — no build step or server required.

## Getting Started

### Open the Simulink Model

1. Open MATLAB.
2. Navigate to `Model/HEV_powersplit_adapted`.
3. Open `HEV_powersplit_adapted.slx`.
4. See the local `README.md` inside the model folder for model-specific notes and the linked requirements view.

### Build, Run, and Cover the C Tests

The full build and coverage flow is documented in [UnityExecution.md](UnityExecution.md). The transition test files contain only Unity test cases (`void test_*(void)`); the runner with `main()` is generated by Unity's helper script before compilation.

Place the Unity sources at `unity/src/` (or clone the framework: `git clone --depth 1 https://github.com/ThrowTheSwitch/Unity.git unity`).

#### Recommended path — full suite + coverage in one command

Two self-contained scripts at the repo root generate the runners, compile every test against `src/mode_logic_team.c` + `unity.c`, run the 5 binaries, and write the resulting artifacts directly into `Test report/`:

```bash
# Branch + line coverage (gcc-11 + lcov)
./run_branch_coverage.sh

# Native MC/DC (gcc-14 -fcondition-coverage + gcov-14 --conditions)
./run_mcdc_native.sh
```

The supported order is **(1) `run_branch_coverage.sh` → (2) `run_mcdc_native.sh` → (3) regenerate the static checker report if needed**. See `Test report/README.md` for the prerequisite toolchain (gcc-11, gcc-14 from `ppa:ubuntu-toolchain-r/test`, `lcov`, `libclang-19-dev`, `mcdc-checker`) and the static-check command.

#### Alternative — run a single suite manually

Useful when you want to run just one transition suite (e.g. while debugging a specific test) or when the GCC 14 / lcov toolchain required by the scripts isn't available. This path skips the consolidated coverage report:

```bash
# 1. Generate the Unity runner (creates test/<TEST_FILE>_runner.c with main + RUN_TEST calls)
ruby unity/auto/generate_test_runner.rb test/<TEST_FILE>.c test/<TEST_FILE>_runner.c

# 2. Compile the suite together with the generated runner
gcc -std=c99 -Wall -Wextra \
    --coverage -fprofile-arcs -ftest-coverage -O0 \
    -Iinc -Iunity/src \
    src/mode_logic_team.c \
    unity/src/unity.c \
    test/<TEST_FILE>.c \
    test/<TEST_FILE>_runner.c \
    -o test_runner

# 3. Run
./test_runner
```

## Code Quality & Standards

### MISRA C 2012 Compliance

The project follows **MISRA C 2012** to ensure reliability and safety, with automated verification on every pull request.

**Status:**
- Minimum: 0 high-severity violations
- Desirable: 0 high + 0 medium violations
- Goal: zero violations

**Key guidelines applied:**
- `const` for input parameters (Rule 8.13)
- Unsigned-integer suffixes (Rule 10.1)
- Explicit type declarations (Rule 10)
- Structured control flow (Rules 15, 16) — including the Rule 15.5 single-exit pattern
- Static scope for internal functions (Rule 8.7)

**References:**
- [MISRA_QUICKSTART.md](MISRA_QUICKSTART.md) — developer quick-start
- [MISRA_COMPLIANCE.md](MISRA_COMPLIANCE.md) — detailed rules and patterns

**Local verification:**

1. Install `cppcheck`:
   ```bash
   # Windows
   winget install Cppcheck.Cppcheck
   # macOS
   brew install cppcheck
   # Linux (Ubuntu/Debian)
   sudo apt-get install cppcheck
   ```

2. Run static analysis with the project's MISRA addon (same scope and flags as CI — only `src/` and `inc/` are checked; `--inline-suppr` honors the in-source `cppcheck-suppress` directives that document the public-API false positives):
   ```bash
   cppcheck --enable=all --addon=misra --inline-suppr \
            --suppress=missingIncludeSystem -Iinc src/ inc/
   # or use the bundled script
   python misra.py
   ```

   > **Note:** the `test/` folder is intentionally excluded from MISRA — Unity macros and test patterns are not meant to be MISRA-compliant.

3. Build with strict warnings:
   ```bash
   gcc -Wall -Wextra -Werror -Iinc -o test_runner src/mode_logic_team.c test/<TEST_FILE>.c
   ```

### Continuous Integration

GitHub Actions (`.github/workflows/ci.yaml`) runs on every pull request and on pushes to `main`, performing:

1. **Static analysis** — cppcheck general checks plus a dedicated MISRA C 2012 pass. Because the Ubuntu `cppcheck` package omits the Python addons, the workflow fetches them from the upstream cppcheck source (matching the installed version) and then runs the MISRA addon manually over `cppcheck --dump` output, so any addon-internal Python error is visible in the log instead of being hidden behind a generic exit code.
2. **Build and test** — fetches Unity, generates a runner per test file with `unity/auto/generate_test_runner.rb`, then compiles each transition suite against `src/mode_logic_team.c` + `unity.c` + the generated runner and runs the resulting binary.

PR checks and downloadable analysis reports are available under the workflow run's "Checks" / "Artifacts" tabs.

## Notes

- `src/mode_logic_team.c` is the single C implementation maintained on `main`. Legacy per-author MC/DC suites and the `Person_E_Gustavo`/`shared_tests` folders were consolidated into the transition-oriented suites listed above.
- `mode_logic_sim.html` is kept in sync with the thresholds and transition logic of `mode_logic_team.c`.
- Generated Simulink artifacts under `Model/HEV_powersplit_adapted/slprj/` are intentionally not versioned; they are produced locally on first build.
- The `Test report/` folder is **versioned on purpose** (the `.gitignore` whitelists it). Local `unity/` clones, raw `.gcov`/`.gcda`/`.gcno`/`.info` outside `Test report/`, and bare `coverage_html/` directories are ignored to keep CI clean.
- The public-API entry points `ModeLogic_Init` and `ModeLogic_Step` carry inline `cppcheck-suppress` directives for `misra-c2012-8.7` (Rule 8.7 — internal linkage) and `unusedFunction`. Both are false positives: the functions are consumed by `test/` and external clients, so they cannot be `static` and are not actually unused.

## License

Model content derived from MathWorks example assets is governed by its own license file under:

- `Model/HEV_powersplit_adapted/LICENSE.md`
