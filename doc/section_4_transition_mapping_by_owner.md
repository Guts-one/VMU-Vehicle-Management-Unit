# Section 4 Requirements Mapping by Owner

This file draws on Sections 4 and 5 of the requirements document and allocates the requirements by owner. The allocation is reflected in the transition-focused test suites under `test/`; it is not declared in `mode_logic_team.c`. Requirements that do not belong to an individual owner are addressed in dedicated sections at the end (collective responsibility, derived system requirements, and non-functional requirements).

Notes:
- Requirements `SwHLR08` and `SwHLR09` are shown as shared between `Person D` and `Person E` because these families are split between resets to `Start` and the internal `ICE <-> HYBRID` transitions.
- The cross-cutting requirements `SwHLR01`, `SwHLR02`, and `SwHLR10` are the **collective responsibility** of all team members (A-E). See "Collective Responsibility - Cross-Cutting Requirements" below.
- System requirements `SysHLR01`, `SysHLR02`, and `SysHLR03` are covered by derivation: their compliance emerges from the combined `SwHLR03`-`SwHLR09` families. See "Derived System Requirements" below.
- Non-functional requirements `NfHLR01`-`NfHLR04` (Section 5 of the PDF) are listed under "Non-Functional Requirements (Section 5)" below, together with an indication of which can be verified by unit tests and which belong to a separate integration or MISRA gate.

## Danilo - Person A

### Section 4.2 Requirements

| ID | Ownership | Requirement statement |
| --- | --- | --- |
| `SwHLR03` | Primary | While the active software mode is the standstill mode, the software shall evaluate exits to EV mode and Start mode in the priority order defined by the model. |

### Section 4.3 Requirements

| ID | Requirement statement |
| --- | --- |
| `SwLLR01` | When the active software mode is the standstill mode and speed > SPEED_STOP && speed <= SPEED_EV_MAX && SOC >= SOC_EV_IN, the software shall transition to EV mode. |
| `SwLLR02` | When the active software mode is the standstill mode and speed > SPEED_STOP && (speed > SPEED_EV_MAX \|\| SOC < SOC_EV_IN), the software shall transition to Start mode. |

## Marinel - Person B

### Section 4.2 Requirements

| ID | Ownership | Requirement statement |
| --- | --- | --- |
| `SwHLR04` | Primary | While the active software mode is EV mode, the software shall evaluate exits to regenerative-braking mode, Start mode, and standstill mode in the priority order defined by the model. |

### Section 4.3 Requirements

| ID | Requirement statement |
| --- | --- |
| `SwLLR03` | When the active software mode is EV mode and speed > SPEED_REGEN && P_dem <= PDEM_REGEN, the software shall transition to the regenerative-braking mode. |
| `SwLLR04` | When the active software mode is EV mode and (speed > SPEED_EV_MAX \|\| P_dem >= PDEM_HYB_IN \|\| SOC < SOC_EV_OUT), the software shall transition to Start mode. |
| `SwLLR05` | When the active software mode is EV mode and speed <= SPEED_STOP && P_dem <= PDEM_STOP_HIGH && P_dem >= PDEM_STOP_LOW, the software shall transition to the standstill mode. |

## Bruna - Person C

### Section 4.2 Requirements

| ID | Ownership | Requirement statement |
| --- | --- | --- |
| `SwHLR05` | Primary | While the active software mode is the regenerative-braking mode, the software shall evaluate exits to Start mode, standstill mode, and EV mode in the priority order defined by the model. |

### Section 4.3 Requirements

| ID | Requirement statement |
| --- | --- |
| `SwLLR06` | When the active software mode is the regenerative-braking mode and (((speed > SPEED_EV_MAX) && (P_dem >= PDEM_STOP_LOW)) \|\| SOC < SOC_EV_OUT), the software shall transition to Start mode. |
| `SwLLR07` | When the active software mode is the regenerative-braking mode and speed <= SPEED_STOP && P_dem <= PDEM_STOP_HIGH && P_dem >= PDEM_STOP_LOW, the software shall transition to the standstill mode. |
| `SwLLR08` | When the active software mode is the regenerative-braking mode and P_dem >= PDEM_STOP_LOW && speed > SPEED_STOP && speed <= SPEED_EV_MAX && SOC >= SOC_EV_OUT, the software shall transition to EV mode. |

## Hugo - Person D

### Section 4.2 Requirements

| ID | Ownership | Requirement statement |
| --- | --- | --- |
| `SwHLR07` | Primary | While the active software mode is Start and no higher-priority engine-supported external exit is active, the software shall evaluate internal transitions to Hybrid mode and ICE mode in the priority order defined by the model. |
| `SwHLR08` | Shared | While the active software mode is ICE and no higher-priority engine-supported external exit is active, the software shall evaluate internal transitions to Start mode and Hybrid mode in the priority order defined by the model. |
| `SwHLR09` | Shared | While the active software mode is Hybrid and no higher-priority engine-supported external exit is active, the software shall evaluate internal transitions to Start mode and ICE mode in the priority order defined by the model. |

### Section 4.3 Requirements

| ID | Requirement statement |
| --- | --- |
| `SwLLR18` | When the active software mode is Start mode and wEng > ENG_ON && SOC >= SOC_MID && (speed > SPEED_EV_MAX \|\| P_dem >= PDEM_HYB_MID), the software shall transition to Hybrid mode. |
| `SwLLR19` | When the active software mode is Start mode and wEng > ENG_ON && (SOC < SOC_MID \|\| (speed <= SPEED_EV_MAX && P_dem < PDEM_HYB_MID)), the software shall transition to ICE mode. |
| `SwLLR20` | When the active software mode is ICE mode and wEng <= ENG_OFF, the software shall transition to Start mode. |
| `SwLLR22` | When the active software mode is Hybrid mode and wEng <= ENG_OFF, the software shall transition to Start mode. |

## Gustavo - Person E

### Section 4.2 Requirements

| ID | Ownership | Requirement statement |
| --- | --- | --- |
| `SwHLR06` | Primary | While the active software mode is Start, ICE, or Hybrid, the software shall evaluate exits to regenerative-braking mode, EV mode, and standstill mode before any internal transition within the engine-supported mode representation. |
| `SwHLR08` | Shared | While the active software mode is ICE and no higher-priority engine-supported external exit is active, the software shall evaluate internal transitions to Start mode and Hybrid mode in the priority order defined by the model. |
| `SwHLR09` | Shared | While the active software mode is Hybrid and no higher-priority engine-supported external exit is active, the software shall evaluate internal transitions to Start mode and ICE mode in the priority order defined by the model. |

### Section 4.3 Requirements

| ID | Requirement statement |
| --- | --- |
| `SwLLR09` | When the active software mode is Start mode and wEng > ENG_ON && speed > SPEED_REGEN && P_dem <= PDEM_REGEN, the software shall transition to the regenerative-braking mode. |
| `SwLLR10` | When the active software mode is ICE mode and wEng > ENG_ON && speed > SPEED_REGEN && P_dem <= PDEM_REGEN, the software shall transition to the regenerative-braking mode. |
| `SwLLR11` | When the active software mode is Hybrid mode and wEng > ENG_ON && speed > SPEED_REGEN && P_dem <= PDEM_REGEN, the software shall transition to the regenerative-braking mode. |
| `SwLLR12` | When the active software mode is Start mode and wEng > ENG_ON && P_dem <= PDEM_HYB_OUT && P_dem >= PDEM_STOP_LOW && speed > SPEED_STOP && speed <= SPEED_EV_MAX && SOC >= SOC_EV_IN, the software shall transition to EV mode. |
| `SwLLR13` | When the active software mode is ICE mode and wEng > ENG_ON && P_dem <= PDEM_HYB_OUT && P_dem >= PDEM_STOP_LOW && speed > SPEED_STOP && speed <= SPEED_EV_MAX && SOC >= SOC_EV_IN, the software shall transition to EV mode. |
| `SwLLR14` | When the active software mode is Hybrid mode and wEng > ENG_ON && P_dem <= PDEM_HYB_OUT && P_dem >= PDEM_STOP_LOW && speed > SPEED_STOP && speed <= SPEED_EV_MAX && SOC >= SOC_EV_IN, the software shall transition to EV mode. |
| `SwLLR15` | When the active software mode is Start mode and speed <= SPEED_STOP && P_dem <= PDEM_STOP_HIGH && P_dem >= PDEM_STOP_LOW, the software shall transition to the standstill mode. |
| `SwLLR16` | When the active software mode is ICE mode and speed <= SPEED_STOP && P_dem <= PDEM_STOP_HIGH && P_dem >= PDEM_STOP_LOW, the software shall transition to the standstill mode. |
| `SwLLR17` | When the active software mode is Hybrid mode and speed <= SPEED_STOP && P_dem <= PDEM_STOP_HIGH && P_dem >= PDEM_STOP_LOW, the software shall transition to the standstill mode. |
| `SwLLR21` | When the active software mode is ICE mode and P_dem >= PDEM_HYB_MID && SOC >= SOC_MID, the software shall transition to Hybrid mode. |
| `SwLLR23` | When the active software mode is Hybrid mode and (P_dem <= PDEM_HYB_LOW \|\| SOC < SOC_LOW), the software shall transition to ICE mode. |

## Collective Responsibility - Cross-Cutting Requirements

The requirements below do not belong to a specific transition family. They are implemented by logic that applies to all modes: `ModeLogic_Init`, `write_outputs`, and the `default` branch of the dispatcher in `ModeLogic_Step`. They are the **collective responsibility** of all team members (A-E); each transition-focused suite should retain the minimum associated tests.

### Section 4.2 Requirements

| ID | Requirement statement | Implementation | Unit-test coverage |
|---|---|---|---|
| `SwHLR01` | The software shall initialize the active software mode to the standstill mode before the first normal mode-evaluation cycle. | `ModeLogic_Init` in `src/mode_logic_team.c` sets `State_t.current_mode` to `MODE_STANDSTILL`. | The transition-focused suites call `ModeLogic_Init` and verify `current_mode == MODE_STANDSTILL` before the first `ModeLogic_Step`; the ICE/Hybrid suite names this test `test_ModeLogic_Init_sets_standstill`. |
| `SwHLR02` | The software shall command the enable outputs associated with the resolved active software mode according to the mode-to-output mapping of the source model. | `write_outputs` in `src/mode_logic_team.c` maps the resolved `Mode_t` to `{Mot_Enable, Gen_Enable, ICE_Enable}` after dispatch. | Each transition-focused suite tests the output mapping for the modes it exercises. The ICE/Hybrid suite includes five `test_outputs_after_transition_to_*` tests covering RegenB, EV, StandStill, Hybrid, and ICE. |
| `SwHLR10` | The software shall treat initialization to the standstill mode and recovery from an invalid active-mode value as software-defined behaviors outside the 23 modeled transitions. | `NULL` guards in `ModeLogic_Init` and `ModeLogic_Step` in `src/mode_logic_team.c`, plus the dispatcher's `default` branch in `ModeLogic_Step`. | `test_init_null`, `test_ModeLogic_Init_tolerates_null`, `test_step_null_inputs`, and `test_step_null_outputs` exercise null-pointer handling across the transition suites. The dispatcher's defensive `default` branch remains the recovery path for an invalid `current_mode`; the current lcov evidence lists defensive defaults as its remaining uncovered branches. |

Practical convention: when a team member discovers a cross-cutting behavior violation (for example, the dispatcher's `default` branch being reached unexpectedly or `ModeLogic_Init` failing to select `MODE_STANDSTILL`), it should be filed as a collective issue rather than assigned to the owner of the transition that exposed the problem.

---

## Derived System Requirements

The Section 4.1 requirements describe architectural properties of the complete system and cannot be tested independently. Their compliance emerges from the combined `SwHLR03`-`SwHLR09` families. Reverse traceability is as follows:

| System requirement | How it is satisfied |
|---|---|
| `SysHLR01` Power-Split Supervisory Mode Selection (exactly one mode per cycle). | Structurally guaranteed by the dispatcher `switch` in `ModeLogic_Step`, which executes one `case` per cycle, and by the `SwHLR03` (A), `SwHLR04` (B), `SwHLR05` (C), `SwHLR06` (E), `SwHLR07` (D), `SwHLR08` (D+E), and `SwHLR09` (D+E) families, which exhaust the exits from every mode in deterministic priority order. |
| `SysHLR02` Deterministic Powertrain Enable Coordination (`{Mot, Gen, ICE}` pattern by mode). | Implemented by `write_outputs` and covered under the collective responsibility for `SwHLR02`. The values for each mode exactly follow the PDF: standstill `{0,0,0}`, EV `{1,0,0}`, RegenB `{1,0,0}`, Start `{1,1,0}`, ICE `{0,1,1}`, and Hybrid `{1,1,1}`. |
| `SysHLR03` Calibratable and Hysteretic Transition Strategy (use named calibrations and preserve hysteresis). | The `SwLLR*` requirement statements use the calibration-level names `ENG_ON`, `ENG_OFF`, `SPEED_STOP`, `SPEED_REGEN`, `SPEED_EV_MAX`, `PDEM_REGEN`, `PDEM_STOP_LOW`, `PDEM_STOP_HIGH`, `PDEM_HYB_IN`, `PDEM_HYB_OUT`, `PDEM_HYB_MID`, `PDEM_HYB_LOW`, `SOC_EV_IN`, `SOC_EV_OUT`, `SOC_MID`, and `SOC_LOW`. The C interface implements them in `inc/mode_logic_team.h` with unit-qualified macros: `ENG_ON_RPM`, `ENG_OFF_RPM`, `SPEED_STOP_DKPH`, `SPEED_REGEN_DKPH`, `SPEED_EV_MAX_DKPH`, `PDEM_REGEN_DKW`, `PDEM_STOP_LOW_DKW`, `PDEM_STOP_HIGH_DKW`, `PDEM_HYB_IN_DKW`, `PDEM_HYB_OUT_DKW`, `PDEM_HYB_MID_DKW`, `PDEM_HYB_LOW_DKW`, `SOC_EV_IN_Q10000`, `SOC_EV_OUT_Q10000`, `SOC_MID_Q10000`, and `SOC_LOW_Q10000`. Hysteresis preservation is further refined by `NfHLR02`. |

Together, the transition-focused unit tests provide evidence for these derived system requirements; separate per-requirement test cases are not necessary.

---

## Non-Functional Requirements (Section 5)

| ID | Requirement statement | Verification scope | Verification method and status |
|---|---|---|---|
| `NfHLR01` Periodic Execution and Sample Time | Execute every 0.1 s and resolve the next mode in the same cycle. | **Integration / platform** - not directly testable in an isolated unit test because it depends on the scheduler or RTOS. | Verify in the SIL/HIL integration environment. This is outside the scope of this deliverable's unit tests. |
| `NfHLR02` Transition Stability and Hysteresis Preservation | Preserve hysteresis for `SOC_EV_IN/OUT` and `ENG_ON/OFF` in deterministic order. | **Partially covered by unit tests**: boundary tests in each suite exercise every threshold individually; a dedicated hysteresis-cycle test that traverses each threshold pair on entry and exit has not yet been implemented. | Shared: A (`SOC_EV_IN/OUT` for Standstill<->EV), B (`SOC_EV_IN/OUT` for EV<->Start), C (`SOC_EV_OUT` for RegenB), D (`ENG_ON/OFF` for Start<->ICE/Hybrid), and E (`ENG_ON` in the external guards). Add one cycle test for each threshold pair. |
| `NfHLR03` Static Allocation and Bounded State Storage | No `malloc`/`free`, recursion, or VLA. | **Code review and static analysis** - covered by the MISRA C gate in a separate deliverable. | Outside the scope of the unit tests. Verify through the MISRA gate for deliverable 3. |
| `NfHLR04` Deterministic Outputs and Reproducibility | Given the same initialized state and input sequence, repeated executions produce the same outputs. | **Implicit across the full suite**: the code under test has no RNG, real-time dependency, or I/O. Any intermittent failure would indicate a violation. | Collective. Suites that maintain shared state call `ModeLogic_Init` in `setUp`; local-state suites establish the starting mode explicitly in each test or helper. Both patterns make the initial state reproducible. |
