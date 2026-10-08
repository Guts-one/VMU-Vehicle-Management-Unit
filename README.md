# VMU — Vehicle Management Unit

[![CI](https://github.com/Guts-one/VMU-Vehicle-Management-Unit/actions/workflows/ci.yaml/badge.svg)](https://github.com/Guts-one/VMU-Vehicle-Management-Unit/actions/workflows/ci.yaml)

Supervisory mode control for a power-split hybrid electric vehicle. A Simulink/Stateflow reference model and a hand-written C implementation select `STANDSTILL`, `EV`, `REGENB`, `START`, `ICE`, or `HYBRID` from driver power demand, vehicle speed, battery state of charge, and engine speed.

**[Open the interactive simulator](https://guts-one.github.io/VMU-Vehicle-Management-Unit/mode_logic_sim.html)** · [Verification results](reports/README.md) · [Build and test](docs/testing.md)

## Context and my contribution

This project began as a five-person final project in the UFPE/Stellantis Technological Residency in Automotive Software Development (2026), using a MathWorks power-split HEV example as its starting point.

I’m Gustavo Igor da Silva. During the residency, I adapted the reference model, scoped and linked the requirements, established the C module architecture, and implemented and tested the engine-supported external transitions and the internal ICE/Hybrid transitions. I also worked on the build and static-analysis pipeline.

After the team baseline, I continued the project independently:

- **Fixed-point C interface:** replaced floating-point inputs with explicitly scaled integers and aligned the model, requirements, and regression tests.
- **Model-to-code verification:** added live Stateflow/C co-simulation, boundary probes, active-state comparison, and coverage evidence.
- **Simulator verification:** extracted the browser simulator’s logic into a testable module and added a C/JavaScript differential check to CI.

The [contribution record](docs/contributions.md) separates this continuation from the team’s work and links to the relevant commits. The original browser simulator was created by Danilo Varini.

## What to inspect

| Area | Entry point |
| --- | --- |
| C controller and fixed-point API | [Implementation](src/mode_logic_team.c), [header](inc/mode_logic_team.h), [design notes](docs/fixed-point.md) |
| Reference model | [Model setup and snapshots](Model/HEV_powersplit_adapted/README.md) |
| Requirements and transitions | [Requirements PDF](docs/Requirements.pdf), [transition reference](docs/mode-logic.md), [ownership mapping](docs/requirements-ownership.md) |
| Unit tests | [Five transition suites](test/) |
| Live model/C comparison | [Harness and instructions](verification/equivalence_live/README.md) |
| Browser logic/C comparison | [Differential harness](verification/js_equivalence/README.md) |
| Static analysis | [Scope and commands](docs/static-analysis.md) |

## Verification evidence

These figures describe the saved verification baseline. Reproduction commands and tool versions are in the [report index](reports/README.md).

| Check | Recorded result |
| --- | --- |
| C unit tests | 141 tests, zero failures |
| C MC/DC condition outcomes | 86/86, measured with GCC/gcov 14 |
| Stateflow MC/DC | 39/39, measured with Simulink Coverage |
| Live Stateflow/C comparison | 469 exact matches and 4 documented sub-LSB quantization differences across 473 rows; zero unexpected grid mismatches |
| JavaScript/C comparison | 473/473 rows match on state and outputs |

Coverage counts describe the exercised logic; they do not establish vehicle-level safety or formal MISRA/ISO 26262 compliance. Platform timing and dedicated hysteresis-cycle verification remain outside or incomplete in this baseline; see the [verification limits](reports/README.md#limits).

## Run locally

The browser simulator opens directly from `mode_logic_sim.html`; no build is needed.

For the C and JavaScript checks, install Node.js, Python 3, and GCC, then run from the repository root:

```sh
git clone --depth 1 https://github.com/ThrowTheSwitch/Unity.git unity
npm ci
npm run test:c
npm test
```

`npm run test:c` runs the C unit suites. `npm test` checks JavaScript/C equivalence and JavaScript coverage. Generated output goes to `build/` and `coverage/`. See [testing instructions](docs/testing.md) for tool overrides, C coverage, recorded-stimulus replay, and MATLAB setup.

## Repository layout

```text
Model/          Simulink model, requirements source, and upstream assets
src/            C controller
inc/            Public C interface and calibrations
test/           C unit tests
verification/   Model/C and JavaScript/C harnesses
scripts/        Test and coverage runners
docs/           Design, setup, requirements, and contribution records
reports/        Selected verification evidence
```

`mode_logic.js` and `mode_logic_sim.html` remain at the root so the published simulator URL stays stable. Reports include the assets needed to read them; compiled programs, object files, and coverage counters are generated locally.

## Credits and licensing

The residency team was Danilo Varini, Marinel Almeida, Bruna, Hugo, and Gustavo Igor da Silva. See [contributions](docs/contributions.md) for the division of work.

MathWorks-derived model assets retain their [included license](Model/HEV_powersplit_adapted/LICENSE.md). No repository-wide license is declared for the original project code.
