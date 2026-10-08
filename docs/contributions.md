# Contributions and project history

The VMU started as a five-person residency project. Gustavo Igor da Silva maintains this repository and continued it after the team baseline. The release tags distinguish the two stages:

- [v1.0.2](https://github.com/Guts-one/VMU-Vehicle-Management-Unit/tree/v1.0.2), May 2026: residency team baseline.
- [v2.0.0–v2.1.1](https://github.com/Guts-one/VMU-Vehicle-Management-Unit/compare/v1.0.2...v2.1.1), June–July 2026: Gustavo’s individual continuation, including fixed-point conversion and additional verification.

## Gustavo’s work during the residency

| Work | Evidence |
| --- | --- |
| Adapted the MathWorks reference model and linked the software requirements | [Model update](https://github.com/Guts-one/VMU-Vehicle-Management-Unit/commit/15c2173), [requirements links and model documentation](https://github.com/Guts-one/VMU-Vehicle-Management-Unit/commit/fda06a2) |
| Established the C module architecture and implemented the engine-supported external exits and ICE/Hybrid internal transitions | [Initial module and interface](https://github.com/Guts-one/VMU-Vehicle-Management-Unit/commit/0cbc84d), [boundary corrections](https://github.com/Guts-one/VMU-Vehicle-Management-Unit/commit/321c142) |
| Wrote the Person E transition tests and shared-requirement tests | [Original test contribution](https://github.com/Guts-one/VMU-Vehicle-Management-Unit/commit/f93959f), now consolidated under [test/](../test/) |
| Updated the build and cppcheck/MISRA workflow for the consolidated source and tests | [Workflow alignment](https://github.com/Guts-one/VMU-Vehicle-Management-Unit/commit/69513a5), [addon execution](https://github.com/Guts-one/VMU-Vehicle-Management-Unit/commit/3477f51) |

## Individual continuation

| Work | Evidence |
| --- | --- |
| Converted the C interface and guards to scaled integers | [Fixed-point conversion](https://github.com/Guts-one/VMU-Vehicle-Management-Unit/commit/f7d63ba), [interface notes](fixed-point.md) |
| Aligned requirements and the model with that interface; refreshed C and Stateflow coverage | [Model/requirements alignment](https://github.com/Guts-one/VMU-Vehicle-Management-Unit/commit/ecf4d74), [coverage refresh](https://github.com/Guts-one/VMU-Vehicle-Management-Unit/commit/555424e) |
| Added recorded-stimulus replay, then live model/C co-simulation with state checks and boundary probes | [Replay harness](https://github.com/Guts-one/VMU-Vehicle-Management-Unit/commit/346e880), [live harness](https://github.com/Guts-one/VMU-Vehicle-Management-Unit/commit/fea18ae) |
| Extracted and verified the browser logic against compiled C in CI | [JavaScript/C equivalence](https://github.com/Guts-one/VMU-Vehicle-Management-Unit/commit/5f74e49) |

## Team contribution

The original allocation is preserved in the [requirements ownership mapping](requirements-ownership.md). Shared initialization, output mapping, and defensive behavior belong to the team.

| Contributor | Original transition responsibility |
| --- | --- |
| Danilo Varini | Standstill exits; also created the [original browser simulator](https://github.com/Guts-one/VMU-Vehicle-Management-Unit/commit/831c47a) |
| Marinel Almeida | EV exits and corresponding tests |
| Bruna | Regenerative-braking exits and corresponding tests |
| Hugo | START-to-ICE/Hybrid paths and engine-off resets |
| Gustavo Igor da Silva | External exits from the engine-supported states and internal ICE/Hybrid transitions |

The later conversion and verification work builds on these contributions. Consolidated file names do not imply that the whole controller or simulator was written by one person.

## Upstream assets

The reference plant originates from a MathWorks power-split HEV example. Its supporting data, diagrams, scripts, and license are retained under [Model/HEV_powersplit_adapted/](../Model/HEV_powersplit_adapted/). Adapting this model is distinct from creating the original plant model.
