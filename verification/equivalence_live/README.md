# Live model ↔ hand-code equivalence (with MC/DC)

This folder implements the **"keep the hand-written C"** path: instead of the
old offline replay of a frozen golden CSV, the Stateflow chart (the design,
`Control/Mode Logic`) is the **live oracle**, the hand-written firmware
(`src/mode_logic_team.c`) runs beside it as an **S-Function**, both are driven
by the **same stimulus**, and structural coverage is **compared between the two
artifacts**. It strengthens the previous `verification/simulink_c_equivalence.c`
in four ways:

| Improvement | What it does | Files |
|---|---|---|
| **(a) Live oracle** | C is wrapped as an S-Function and co-simulated next to the *live* chart in one harness — the chart re-runs every time, so it can never go stale. | `sfun_mode_logic_wrap.c`, `build_sfun_mode_logic.m`, `build_equivalence_harness.m`, `run_live_equivalence.m` |
| **(b) ±1 LSB boundary stimulus** | Every threshold is probed at `T-1, T, T+1` (finest grid the C can represent), with the swept condition made decisive. Kills the half-LSB blind spot; a sub-LSB set characterises the residual quantization band. | `gen_boundary_stimulus.py`, `boundary_stimulus.csv`, `run_boundary_mcdc.sh`, `mode_probe.c`, `test_wrap.c` |
| **(c) Coverage comparison** | Chart MC/DC (Simulink Coverage) is aligned decision-by-decision with C MC/DC (gcov `--conditions`) so every modelled decision is shown covered on *both* sides. | `mcdc_mapping.csv`, `export_simulink_mcdc.m`, `compare_coverage.py` |
| **(d) State equivalence** | The chart exports its active **leaf** state (active-state output, `LeafStateActivity`) and every row also compares it against the C FSM's `current_mode` — two FSMs can agree on the three enables while sitting in different states, and outputs alone would mask that until it diverges later. | `build_equivalence_harness.m` (`enableLeafStateOutput`), `run_live_equivalence.m` (`mapChartState`) |

## How the layers fit (and what supersedes what)

Each layer answers a different question with different dependencies — none is
deleted; in a safety-style workflow evidence gets **superseded, not erased**:

| Layer | Question it answers | Needs | Status |
|---|---|---|---|
| Unity suite (`test/*.c`, `run_mcdc_native.sh`) | Unit behaviour incl. defensive paths no stimulus can reach (null-guards, `switch` defaults) | gcc only | **Active** — part of the 86/86 gcov argument |
| Offline replay (`../simulink_c_equivalence.c`) | Does the C reproduce a *frozen recording* of the chart? | gcc only | **Superseded** as equivalence evidence (frozen oracle, LSB-aligned stimulus — see report §2.3). Kept as a fast MATLAB-free regression net for C-side edits. |
| Boundary probe (`mode_probe.c` + `boundary_stimulus.csv`) | Does the compiled C hit validated expectations at every ±1 LSB boundary? | gcc only | **Active** — strongest MATLAB-free regression check (expectations cross-validated by the live co-sim) |
| Live co-sim (`run_live_equivalence.m`) | Does the C match the **live** chart on outputs AND state, with chart MC/DC? | MATLAB + Simulink Coverage | **Authoritative equivalence evidence**; also writes the per-row CSVs and the chart-coverage export that `compare_coverage.py` consumes |
| Test Manager (`mode_logic_equivalence.mldatx`, Part D) | Same run with a formal verdict, coverage and report inside the tool | MATLAB + Simulink Test | **Formalization layer** over the live co-sim — management/traceability, no new test power |
| Coverage comparison (`compare_coverage.py`, gcov) | Is every modelled decision covered on **both** artifacts? | Python + gcc | **Active** — the "no unintended functionality" argument |

Practical note: only the gcc/Python layers survive a lapsed MATLAB license as
*runnable* tests; the MATLAB layers then stand as recorded evidence
(`Test report/equivalence_live/`, incl. `tm_report.pdf`, and the `.mldatx`).

## The half-LSB blind spot, and the fix

The chart evaluates physical quantities (`speed>35` km/h); the C evaluates
fixed-point integers (`speed_dkph>350`, 0.1 km/h grid). A physical `35.04` km/h
rounds to `350` dkph, so the **chart says TRUE while the quantized C says
FALSE** — a divergence the old LSB-aligned stimulus never hit.

Fix: the harness feeds **one physical stimulus** to both, and converts to
fixed-point **in-model, visibly**, with the *identical* rule the firmware uses
— `Gain(scale)` → `Data Type Conversion (RndMeth='Round'` = round half away from
zero, saturate on). On the exact grid both agree by construction; the ±1 LSB
probes prove each comparison flips at exactly the right integer; the `subLSB`
rows feed deliberately off-grid physical values to *quantify* the residual
±0.5 LSB band (reported, not failed — it is a quantization property, not a bug).

## Where each part runs (Windows MATLAB vs WSL)

Some of this repo's coverage was produced in **WSL Ubuntu**
(`\\wsl.localhost\Ubuntu-22.04\home\vmu`, where `gcc-14`/`gcov-14` live), while
MATLAB R2026a + the `.slx` run on **Windows**. This workflow keeps that split:

- **Windows / MATLAB** (Simulink Test + Simulink Coverage + a MEX C compiler):
  `build_sfun_mode_logic.m` → `build_equivalence_harness.m` → `run_live_equivalence.m`.
  The S-Function compiles the firmware natively via MEX — no WSL needed here.
- **WSL Ubuntu** (`gcc-14`/`gcov-14`): `run_boundary_mcdc.sh` and the existing
  `run_mcdc_native.sh` produce the authoritative C-side condition coverage.
- **Either** (Python 3): `gen_boundary_stimulus.py`, `compare_coverage.py`.

`compare_coverage.py` reads files by repo-relative path, so run it from the repo
clone that has both the MATLAB output (`Test report/equivalence_live/`) and the
gcov output (`Test report/mcdc_native_gcov14/`). If you run MATLAB on Windows and
gcov in WSL, point both at the same working tree (the WSL path
`/home/vmu/...` and the Windows path are the same checkout) before comparing.

## How to run

### Part A — live co-simulation (MATLAB, Windows)
```matlab
cd verification/equivalence_live
build_sfun_mode_logic            % one-time: needs `mex -setup C`
results = run_live_equivalence;  % builds harness, runs co-sim, writes reports
```
Outputs under `Test report/equivalence_live/`: `summary.txt`,
`equivalence_rows.csv` (per-row chart-vs-C, incl. `chart_mode`/`chart_state`
columns), `sublsb_band.csv`, `chart_coverage.csv/.json`, `chart_coverage.html`.
`results.pass` is true when every **grid** row matches on outputs AND state
(sub-LSB rows are reported separately).

> A harness `.slx` built before the state comparison lacks the `chart_state`
> port; `run_live_equivalence` detects that and rebuilds it automatically
> (the source model must be on the path, as at first build).
> State-name ↔ `Mode_t` map (`mapChartState`): `StandStill`→0, `EV_mode`→1,
> `RegenB_mode`→2, `Start_mode`→3, `ICE_mode`→4, `Hybrid_mode`→5 — keep in
> sync with `inc/mode_logic_team.h` if either side is renamed.

> If your chart constants aren't on the path, pass a param script:
> `run_live_equivalence(struct('paramScript','../../Model/HEV_powersplit_adapted/Scripts_Data/HEV_Model_PARAM.m'))`.
> Otherwise it defaults `EngOnRPM=800`, `EngOffRPM=790`.

### Part B — authoritative C-side MC/DC (WSL)
```bash
./run_mcdc_native.sh        # existing Unity suite -> 86/86 condition outcomes
./verification/equivalence_live/run_boundary_mcdc.sh   # boundary set alone
```

### Part C — compare the two artifacts
```bash
python3 verification/equivalence_live/compare_coverage.py
# -> Test report/equivalence_live/coverage_comparison.md / .csv
```

### Part D — Test Manager formalization (MATLAB, Windows; needs Simulink Test)

```
run_tm_test.bat          REM or in MATLAB: tm_create_and_run
```

Creates/overwrites `mode_logic_equivalence.mldatx` (simulation test; pre-load
callback `tm_setup_equivalence.m`, custom criteria `tm_check_equivalence.m`,
Decision/Condition/MCDC coverage), runs it headless, and writes
`Test report/equivalence_live/tm_report.pdf`.

## File reference

| File | Role |
|---|---|
| `gen_boundary_stimulus.py` | Generates `boundary_stimulus.csv` (both physical + fixed-point columns) and self-checks every boundary flips the mode. |
| `boundary_stimulus.csv` | The ±1 LSB stimulus (drive/probe/tour/subLSB rows). |
| `mode_probe.c` | Runs the stimulus through the REAL `mode_logic_team.c`; verifies the Python mirror == compiled C; measures coverage. |
| `sfun_mode_logic_wrap.c` | Combinational LCT wrapper; FSM state carried by an external Unit Delay. |
| `test_wrap.c` | Stand-alone proof the wrapper == direct FSM (no MATLAB needed). |
| `build_sfun_mode_logic.m` | Legacy Code Tool build of `sfun_mode_logic`. |
| `build_equivalence_harness.m` | Builds `mode_logic_equiv_harness.slx` (chart + S-Function + shared stimulus + in-model quantization + chart active-leaf-state output). |
| `run_live_equivalence.m` | Main driver: co-sim with coverage, row-by-row compare (outputs **and** state), reports. |
| `export_simulink_mcdc.m` | Dumps chart Decision/Condition/MCDC to CSV/JSON. |
| `mcdc_mapping.csv` | Chart transition ↔ C guard/condition map (14 decisions). |
| `compare_coverage.py` | Merges chart + C coverage into a per-decision comparison. |
| `run_boundary_mcdc.sh` | Authoritative boundary-set MC/DC via gcc-14 (gcc-11 branch fallback). |
| `tm_setup_equivalence.m` | Test Manager pre-load callback: builds S-Function/harness if missing, loads the stimulus, sets `StopTime`. |
| `tm_check_equivalence.m` | Test Manager custom criteria: same row-by-row comparison as the runner, from the `SimulationOutput`. |
| `tm_create_and_run.m` | Creates `mode_logic_equivalence.mldatx` programmatically, runs it headless, writes the PDF report. |
| `verify_all.m` | One-shot headless self-check of the whole toolkit (`matlab -batch "verify_all"`). |

## Limitations / honesty

- This is **model↔hand-code equivalence**, not code-generator back-to-back. It
  is the right activity when the team writes production C by hand, but it does
  not give Embedded Coder code-gen credit. For tool-qualified ISO 26262 credit
  you would additionally argue qualification of gcc/gcov and the harness.
- The S-Function compiles the firmware with the host MEX compiler, not the
  target compiler — same source, different toolchain. Add PIL on target for
  full compliance.
- Equivalence is proven on the shared fixed-point grid; the ±0.5 LSB continuous
  band is a documented quantization interval, not a defect.

## Recorded results (MATLAB R2026a)

Latest full run of the toolkit (`verify_all` + Part D). The Test-Manager
formalization ran headless: `mode_logic_equivalence.mldatx` **Passed (1/1)**
with Decision/Condition/MCDC coverage recorded; the tool-generated report is
versioned at `Test report/equivalence_live/tm_report.pdf`.

| Item | Result |
|---|---:|
| S-Function build (Legacy Code Tool) | OK |
| Harness compile | clean |
| Live equivalence (chart vs C, outputs **and** state), 473-row stimulus | **0 grid mismatches -> PASS** |
| Sub-LSB band (expected quantization divergence) | 4 rows |
| Chart decision / condition / MC/DC (Simulink Coverage) | **44/44 / 78/78 / 39/39 (100%)** |
| Hand-code condition outcomes (gcov) | **86/86** |
| Per-decision model<->code correspondence | 14/14 COVERED both sides |

The stimulus combines the +/-1 LSB boundary probes (C-side + boundary equivalence)
with the chart MC/DC independence-pair vectors, so a single co-simulation closes
chart MC/DC, C MC/DC, and equivalence at once.
