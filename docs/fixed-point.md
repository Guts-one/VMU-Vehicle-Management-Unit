# Fixed-point interface

The controller compares scaled integer inputs against named calibrations in [mode_logic_team.h](../inc/mode_logic_team.h). Physical-to-integer conversion happens in the caller or verification harness, before `ModeLogic_Step`.

| Field | C type | Unit per count | Example |
| --- | --- | --- | --- |
| `speed_dkph` | `uint16_t` | 0.1 km/h | 35.0 km/h → 350 |
| `p_dem_dkw` | `int16_t` | 0.1 kW | −5.0 kW → −50 |
| `soc_q10000` | `uint16_t` | 0.0001 SOC fraction | 37% → 3700 |
| `weng_rpm` | `uint16_t` | 1 rpm | 800 rpm → 800 |

The verification adapters round halfway values away from zero and saturate to the destination integer range. The intended SOC range is 0–10000; the C step function does not clamp it. Callers must supply valid, scaled inputs.

## Why this representation

The mode logic consists of threshold comparisons, so an explicit integer scale keeps the C guards and boundary tests directly comparable. The module uses no floating-point arithmetic, dynamic allocation, or global controller state. Each caller owns its `State_t`.

This repository does not measure target ECU execution time, flash use, or RAM savings. Those depend on the target compiler and hardware.

## Quantization at a threshold

`SPEED_EV_MAX_DKPH` is 350, equivalent to 35.0 km/h. An input of 35.04 km/h becomes 350 after conversion. The physical Stateflow comparison `speed > 35` is true, while the C comparison `speed_dkph > 350` is false.

The live harness records four such intentionally off-grid cases in [sublsb_band.csv](../reports/equivalence_live/sublsb_band.csv). On its 469 grid-aligned rows, outputs and state match. The JavaScript module applies the same conversion as C, so its separate differential check matches all 473 rows.

## Hysteresis and state

The API has distinct thresholds for SOC entry/exit (`3700`/`3500`) and engine on/off (`800`/`790` rpm). Transition ordering is documented in the [mode reference](mode-logic.md). Individual threshold tests exist; dedicated cycles across both sides of each hysteresis pair remain a documented gap under `NfHLR02` in the [ownership mapping](requirements-ownership.md).
