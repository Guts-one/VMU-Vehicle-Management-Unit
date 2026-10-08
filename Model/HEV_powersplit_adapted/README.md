# HEV Powersplit Adapted

Adapted MathWorks power-split hybrid electric vehicle model used as the VMU reference. The entry point is `HEV_powersplit_adapted.slx`; supporting data and workflows retain their original helper names where required by the model.

## Main Entry Points

- Model: `HEV_powersplit_adapted.slx`
- Startup script: `Scripts_Data/startup_HEV_Model.m`
- Demo script: `Scripts_Data/HEV_Model_Demo_Script.m`
- Overview script: `Overview/HEV_powersplit_adapted_overview.m`
- Parameter sweep workflow: `Workflows/Param_Sweep/HEV_Model_PCT_Sim.m`

## Quick Start

1. Open MATLAB in this folder.
2. Run `Scripts_Data/startup_HEV_Model.m` to add the model paths, load parameters, and open `HEV_powersplit_adapted.slx`.
3. Use the scripts under `Scripts_Data` and `Workflows` for plots, parameter sweeps, and fuel-consumption studies.

## Model Snapshots

### Overview
![](Overview/html/HEV_SeriesParallel_01.png)

### Electrical System
![](Overview/html/HEV_SeriesParallel_02.png)

### Vehicle
![](Overview/html/HEV_SeriesParallel_03.png)

### System-Level Results
![](Overview/html/HEV_SeriesParallel_07.png)

## Notes

- An HTML demo page can be generated from the demo script; startup opens it only if it exists.
- `LICENSE.md` and `SECURITY.md` were preserved from the original package.

## License

See `LICENSE.md`.
