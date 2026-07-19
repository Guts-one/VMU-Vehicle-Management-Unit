# State Transitions - `HEV_powersplit_adapted`

This document summarizes the `Control/Mode Logic` Stateflow chart and the
equivalent contract implemented in `src/mode_logic_team.c`.

## Model-to-C Name Mapping

| Model | C Code |
|---|---|
| `StandStill` | `MODE_STANDSTILL` |
| `EV_mode` | `MODE_EV` |
| `RegenB_mode` | `MODE_REGENB` |
| `Motion_mode_ICE/Start_mode` | `MODE_START` |
| `Motion_mode_ICE/ICE_mode` | `MODE_ICE` |
| `Motion_mode_ICE/Hybrid_mode` | `MODE_HYBRID` |
| `speed` | `speed_dkph` (0.1 km/h) |
| `P_dem` | `p_dem_dkw` (0.1 kW) |
| `charge` | `soc_q10000` (0..10000) |
| `engine_speed` | `weng_rpm` (rpm) |

The Simulink model continues to use physical values. The production C API uses
scaled integers to avoid `float` in embedded software.

## Thresholds

| C Macro | Integer Value | Physical Value | Purpose |
|---|---:|---:|---|
| `ENG_ON_RPM` | 800 | 800 rpm | engine on |
| `ENG_OFF_RPM` | 790 | 790 rpm | reset when the engine falls below the threshold |
| `SPEED_STOP_DKPH` | 5 | 0.5 km/h | stop / `StandStill` |
| `SPEED_REGEN_DKPH` | 50 | 5.0 km/h | entry into `RegenB_mode` |
| `SPEED_EV_MAX_DKPH` | 350 | 35.0 km/h | upper limit of the EV range |
| `PDEM_REGEN_DKW` | -50 | -5.0 kW | regenerative braking |
| `PDEM_STOP_LOW_DKW` | -10 | -1.0 kW | lower neutral-band limit |
| `PDEM_STOP_HIGH_DKW` | 10 | 1.0 kW | upper neutral-band limit |
| `PDEM_HYB_IN_DKW` | 500 | 50.0 kW | EV/RegenB to `Motion_mode_ICE` |
| `PDEM_HYB_OUT_DKW` | 400 | 40.0 kW | `Motion_mode_ICE` to EV |
| `PDEM_HYB_MID_DKW` | 150 | 15.0 kW | `Start`/`ICE` to `Hybrid` |
| `PDEM_HYB_LOW_DKW` | 100 | 10.0 kW | `Hybrid` to `ICE` |
| `SOC_EV_IN_Q10000` | 3700 | 0.37 | entry/hold threshold for EV |
| `SOC_EV_OUT_Q10000` | 3500 | 0.35 | exit threshold for EV |
| `SOC_MID_Q10000` | 3000 | 0.30 | `Hybrid` versus `ICE` split |
| `SOC_LOW_Q10000` | 2500 | 0.25 | transition from `Hybrid` to `ICE` |

## Initial State

- Top-level chart entry: `StandStill`
- Entry into `Motion_mode_ICE`: `Start_mode`

## Outputs by State

| Model State | C State | `Mot_Enable` | `Gen_Enable` | `ICE_Enable` |
|---|---|---:|---:|---:|
| `StandStill` | `MODE_STANDSTILL` | 0 | 0 | 0 |
| `EV_mode` | `MODE_EV` | 1 | 0 | 0 |
| `RegenB_mode` | `MODE_REGENB` | 1 | 0 | 0 |
| `Start_mode` | `MODE_START` | 1 | 1 | 0 |
| `ICE_mode` | `MODE_ICE` | 0 | 1 | 1 |
| `Hybrid_mode` | `MODE_HYBRID` | 1 | 1 | 1 |

## Top-Level Transitions

### Exits from `StandStill`

Priority:

1. `StandStill -> EV_mode`
   - Model: `[speed>0.5 && speed<=35 && charge>=0.37]`
   - C: `guard_standstill_to_ev()`

2. `StandStill -> Motion_mode_ICE`
   - Model: `[speed>0.5]`
   - C: `guard_standstill_to_start()`
   - Note: This is equivalent because `StandStill -> EV_mode` is evaluated
     first. If `speed>0.5` and the EV guard fails, then either `speed>35` or
     `charge<0.37` is already true.

### Exits from `EV_mode`

Priority:

1. `EV_mode -> RegenB_mode`
   - Model: `[speed>5 && P_dem<=-5]`
   - C: `guard_to_regenb()`

2. `EV_mode -> Motion_mode_ICE`
   - Model: `[speed>35 || P_dem>=50 || charge<0.35]`
   - C: `guard_ev_to_start()`

3. `EV_mode -> StandStill`
   - Model: `[speed<=0.5 && P_dem<=1 && P_dem>=-1]`
   - C: `guard_to_standstill()`

### Exits from `RegenB_mode`

Priority:

1. `RegenB_mode -> Motion_mode_ICE`
   - Model: `[((speed>35) & (P_dem>=-1)) | (charge<0.35)]`
   - C: `guard_regenb_to_start()`

2. `RegenB_mode -> StandStill`
   - Model: `[speed<=0.5 && P_dem<=1 && P_dem>=-1]`
   - C: `guard_to_standstill()`

3. `RegenB_mode -> EV_mode`
   - Model: `[P_dem>=-1 && speed>0.5]`
   - C: `guard_regenb_to_ev()`
   - Note: This is equivalent because `RegenB_mode -> Motion_mode_ICE` and
     `RegenB_mode -> StandStill` are evaluated first. When both fail,
     `speed<=35` and `charge>=0.35` are already guaranteed for this transition.

## Transitions from `Motion_mode_ICE` to External States

Priority:

1. `Motion_mode_ICE -> RegenB_mode`
   - Model: `[engine_speed>EngOnRPM && speed>5 && P_dem<=-5]`
   - C: `flag_weng_gt_on() & guard_to_regenb()`

2. `Motion_mode_ICE -> EV_mode`
   - Model: `[engine_speed>EngOnRPM && P_dem<=40 && P_dem>=-1 && speed>0.5 && speed<=35 && charge>=0.37]`
   - C: `guard_motion_to_ev()`

3. `Motion_mode_ICE -> StandStill`
   - Model: `[speed<=0.5 && P_dem<=1 && P_dem>=-1]`
   - C: `guard_to_standstill()`

## Internal Transitions within `Motion_mode_ICE`

### Exits from `Start_mode`

Priority:

1. `Start_mode -> Hybrid_mode`
   - Model: `[engine_speed>EngOnRPM && charge>=0.30 && (speed>35 || P_dem>=15)]`
   - C: `guard_start_to_hybrid()`

2. `Start_mode -> ICE_mode`
   - Model: `[engine_speed>EngOnRPM]`
   - C: `guard_start_to_ice()`
   - Note: This is equivalent because `Start_mode -> Hybrid_mode` is evaluated
     first. With `engine_speed>EngOnRPM`, failure of the Hybrid guard implies
     the complementary condition that leads to `ICE_mode`.

### Exits from `ICE_mode`

Priority:

1. `ICE_mode -> Start_mode`
   - Model: `[engine_speed<=EngOffRPM]`
   - C: `flag_weng_le_off()`

2. `ICE_mode -> Hybrid_mode`
   - Model: `[P_dem>=15 && charge>=0.30]`
   - C: `guard_ice_to_hybrid()`

### Exits from `Hybrid_mode`

Priority:

1. `Hybrid_mode -> Start_mode`
   - Model: `[engine_speed<=EngOffRPM]`
   - C: `flag_weng_le_off()`

2. `Hybrid_mode -> ICE_mode`
   - Model: `[P_dem<=10 || charge<0.25]`
   - C: `guard_hybrid_to_ice()`

## Cross-Validation

The MATLAB R2026a validation covers two workflows:

- Native Simulink Coverage for the `Control/Mode Logic` chart: 44/44 decisions,
  78/78 condition outcomes, and 39/39 MC/DC, with no filters or justifications.
- Targeted regression across 16 boundary, priority, and hysteresis cases: all
  three public outputs matched the fixed-point C reference for the same sequence
  of physical inputs converted to the scaled-integer representation.

The stability check uses six hold scenarios (`StandStill`, `EV`, `RegenB`,
`Start`, `ICE`, `Hybrid`) and found no output toggles after settling.
