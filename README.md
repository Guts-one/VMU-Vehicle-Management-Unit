# VMU — Vehicle Management Unit

## Overview

This repository hosts the VMU (Vehicle Management Unit) baseline for a power-split hybrid electric vehicle (HEV).
It brings together the system reference model, a manual C implementation of the supervisory mode logic, the final requirements document, an interactive web simulator, and a complete test and CI infrastructure aligned with **MISRA C 2012**.

The VMU supervisory logic selects operating modes — `STANDSTILL`, `EV`, `REGENB`, `START`, `ICE`, `HYBRID` — based on driver power demand, vehicle speed, battery state of charge, and engine speed.

## Repository Structure

```text
.
├── .github/workflows/
│   └── ci.yaml                      # Build, unit tests, and MISRA static analysis
├── Model/
│   └── HEV_powersplit_adapted/      # Simulink reference model with requirements traceability
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
├── Test report/                     # Generated coverage report (HTML/lcov)
├── doc/
│   ├── Requirements.pdf             # Final requirements document
│   └── mapeamento_transicoes_secao4_por_responsavel.md
├── mode_logic_sim.html              # Interactive web simulator
├── misra.py                         # MISRA C 2012 verification script
├── MISRA_COMPLIANCE.md              # Detailed MISRA rules and patterns
├── MISRA_QUICKSTART.md              # Developer quick-start for MISRA
├── UnityExecution.md                # Unity build/coverage instructions
└── README.md
```

## Main Components

### Simulink Reference Model

Located in `Model/HEV_powersplit_adapted/`. It contains the supervisory model that the C baseline mirrors, together with **requirements linked directly inside the model** for traceability, plus overview material, scripts, image assets, and workflow support files.

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

The repository ships a transition-oriented test infrastructure built on the **Unity** framework with **MC/DC** and line-coverage reporting via `gcov`/`lcov`. Tests are organized by the state-machine transition they exercise, rather than per author:

| Suite | File | Scope |
|---|---|---|
| EV transitions | `test/test_ev_transitions.c` | Entries, exits, and guards for EV mode |
| Regen-B transitions | `test/test_regenb_transitions.c` | Regenerative-braking transitions |
| Standstill transitions | `test/test_standstill_transitions.c` | STANDSTILL entry/exit |
| START → HYBRID/ICE | `test/test_start_to_hybrid_ice_and_resets.c` | Cranking path and reset behavior |
| ICE/HYBRID transitions | `test/test_ice_hybrid_external_and_internal.c` | External and internal ICE/HYBRID transitions |

The latest coverage report is published under `Test report/`.

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

### Build and Run the C Tests

The full build and coverage flow is documented in [UnityExecution.md](UnityExecution.md). A typical suite is built with the Unity sources placed at `unity/src/` and a one-line GCC invocation:

```bash
gcc -std=c99 -Wall -Wextra \
    --coverage -fprofile-arcs -ftest-coverage -O0 \
    -Iinc -Iunity/src \
    src/mode_logic_team.c \
    unity/src/unity.c \
    test/<TEST_FILE>.c \
    -o test_runner
./test_runner
```

Coverage reports (when `lcov`/`genhtml` are available) are published under `Test report/`.

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

2. Run static analysis with the project's MISRA addon:
   ```bash
   cppcheck --enable=all --addon=misra --suppress=missingIncludeSystem -Iinc src/ inc/ test/
   # or use the bundled script
   python misra.py
   ```

3. Build with strict warnings:
   ```bash
   gcc -Wall -Wextra -Werror -Iinc -o test_runner src/mode_logic_team.c test/<TEST_FILE>.c
   ```

### Continuous Integration

GitHub Actions (`.github/workflows/ci.yaml`) runs on every pull request and performs:

1. **Static analysis** — MISRA C 2012 verification via `cppcheck` + `misra.py`.
2. **Build and test** — compilation with strict flags and execution of the Unity suites.

PR checks and downloadable analysis reports are available under the workflow run's "Checks" / "Artifacts" tabs.

## Notes

- `src/mode_logic_team.c` is the single C implementation maintained on `main`. Legacy per-author MC/DC suites and the `Person_E_Gustavo`/`shared_tests` folders were consolidated into the transition-oriented suites listed above.
- `mode_logic_sim.html` is kept in sync with the thresholds and transition logic of `mode_logic_team.c`.
- Generated Simulink artifacts under `Model/HEV_powersplit_adapted/slprj/` are intentionally not versioned; they are produced locally on first build.

## License

Model content derived from MathWorks example assets is governed by its own license file under:

- `Model/HEV_powersplit_adapted/LICENSE.md`
