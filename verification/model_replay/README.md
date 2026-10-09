# Full-model recordings for the browser

The browser replays **inputs, modes, and enable commands recorded together from the full vehicle model**. Manual steps and presets still evaluate `mode_logic.js`. Playback runs neither C nor live vehicle dynamics in the browser.

## Recording provenance

`export_replays.m` runs the repository's `HEV_powersplit_adapted.slx` with its `System` electrical variant and existing UrbanCycle1/UrbanCycle2 drive profiles. The plant, source controller chart, parameters, and drive profiles are unchanged. Instrumentation is added in memory and discarded without saving the source model.

| Recording | Model time | Samples at 0.1 s | Model speed range |
| --- | ---: | ---: | ---: |
| UrbanCycle1 | 0–195 s | 1,951 | about 0–50 km/h |
| UrbanCycle2 | 0–400 s | 4,001 | about 0–120 km/h |

The [manifest](recordings/manifest.json) records MATLAB R2026a Update 5, solver `ode23t`, tolerances, relevant installed product versions, and SHA-256 hashes of the model, parameter/data files, exporter, and CSVs. Both runs start from the model's initial conditions. `To Workspace` recorders sample the four actual chart inputs, the active leaf state, and all three enable outputs at the same controller instants. Nothing is interpolated or synthesized.

CSV inputs are vehicle speed (km/h), ICE shaft speed (rpm), demand (kW), and SOC (fraction). Tiny negative speed residuals (minimum about −0.0043 km/h) and braking demand down to −23.87 kW are retained. The browser rounds displayed values, but its CSV retains input precision. Playback speed changes only elapsed wall time; every sample remains in sequence.

## What the comparisons establish

| Check | UrbanCycle1 | UrbanCycle2 |
| --- | ---: | ---: |
| Fresh compiled C vs JavaScript, state and all enables | 1,951/1,951 exact | 4,001/4,001 exact |
| Fresh source chart on raw recorded inputs vs full-plant recording | 1,951/1,951 exact | 4,001/4,001 exact |
| Fresh source chart on C-quantized inputs vs C | 1,951/1,951 exact | 4,001/4,001 exact |
| Full-plant recording vs fixed-point C/JS, samples with a difference | **133** | **14** |

The last row is not an exact-equivalence result. Quantization can change a strict threshold comparison, and the resulting mode history can diverge for several subsequent steps. For example, at 163.1 s in UrbanCycle1, 35.0433845 km/h becomes 35.0 km/h in the fixed-point interface: the source model enters START while C/JS stays in EV. That difference persists through 176.0 s. In UrbanCycle2, 14.9640474 kW becomes 15.0 kW at 283.9 s, changing a transition and its later history.

All differing sample intervals (inclusive, 0.1 s spacing):

| Recording | Model time intervals | Samples |
| --- | --- | ---: |
| UrbanCycle1 | 94.8; 117.3; 163.1–176.0; 186.8 s | 133 |
| UrbanCycle2 | 20.2; 283.9–285.0; 379.7 s | 14 |

`verify_chart.m` establishes the two source-chart comparisons above. Its [saved result](recordings/chart-validation.json) binds the evidence to the exact recordings, source model, verifier, quantized inputs, and C output. CI compiles C afresh, checks every JS result, validates those hashes, and checks the generated browser bundle. CI does not run MATLAB.

The UI therefore displays the **recorded model state and commands** during playback. Passing the same inputs through the JS controller and presenting that result as the original model drive would mix two different executions.

ICE RPM can remain nonzero in EV: the chart does not require zero RPM for that state, the plant starts at 800 rpm, and an OFF command does not impose zero shaft speed. The six presets are useful controller tests, not plant operating-point predictions.

These are software-model recordings, not measured vehicle data or evidence of vehicle-level validation. The C comparison replays plant inputs open loop; the plant has not been rerun in closed loop with the fixed-point C controller. These results are separate from the older 473-row boundary baseline described in [reports](../../reports/README.md).

## Reproduce

Use a fresh MATLAB batch session with the model's Simulink, Stateflow, and Simscape dependencies available. Choose an absolute export directory outside the source model. From the repository root:

```sh
matlab -batch "addpath('verification/model_replay'); export_replays('/absolute/export/directory')"
node verification/model_replay/prepare_replays.js --inspect /absolute/export/directory
matlab -batch "addpath('verification/model_replay'); verify_chart('/absolute/export/directory')"
```

`--inspect` needs Node.js and GCC (`CC` may select another GCC-compatible executable). It compiles the real C source, writes fixed-point inputs and C outputs, and reports all model/C/JS differences in `build/model_replay/comparison.json`. The MATLAB check writes `build/model_replay/chart-validation.json` and fails if either chart comparison differs.

After reviewing a new recording, copy only its two CSVs and manifest into `recordings/`, along with the new `chart-validation.json`. Then:

```sh
npm run build:replays
npm run test:replays
npm run test:ui
```

The generated `web/model-replays.js` contains the same samples as the CSVs in a classic script, so the page needs no fetch, bundler, or MATLAB installation. Do not edit generated samples to suppress a mismatch. Review new differences and refresh this record when model/controller sources change.
