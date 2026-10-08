# Build and test

Run commands from the repository root. Fresh output goes to `build/` or `coverage/`; the selected results in [reports/](../reports/README.md) remain a saved baseline.

## C unit tests

Needs Node.js, GCC, and [Unity](https://github.com/ThrowTheSwitch/Unity). The runner compiles each existing suite separately, generates its `main()`, and stops on a compiler error or failed test. Ruby and npm dependencies are not required for this command.

```sh
git clone --depth 1 https://github.com/ThrowTheSwitch/Unity.git unity
npm run test:c
```

Executables and generated runners go to `build/unit/`. Set `CC` to a GCC-compatible compiler executable and `UNITY_SRC_DIR` to the directory containing `unity.c` if they are not in the default locations.

## JavaScript/C differential and JavaScript coverage

Needs Node.js, Python 3, and GCC. The Python generator consumes the saved 265-row chart stimulus as part of its 473-row boundary sequence. Both state and output enables are checked against compiled C.

```sh
npm ci
npm test
```

To run the two stages separately:

```sh
npm run verify
npm run coverage
```

`PYTHON` and `CC` can select explicit executables. For example, in PowerShell:

```powershell
$env:PYTHON = 'C:\path\to\python.exe'
$env:CC = 'C:\path\to\gcc.exe'
npm test
```

The compiled probe and comparison CSVs go to `build/js_equivalence/`; c8 writes to `coverage/`. `npm run equiv` reuses the compiled probe output from a prior `npm run verify`. `npm run equiv:mirror` only compares JavaScript with the Python-derived expectations; it does not invoke C.

## C coverage and recorded-stimulus replay

The Bash coverage scripts target Linux/WSL. The saved baseline used GCC 11 + lcov 1.14 for branches and GCC/gcov 14.3.0 for condition coverage. Unity is required for the two coverage commands.

```sh
bash scripts/run_branch_coverage.sh
bash scripts/run_mcdc_native.sh
bash scripts/run_simulink_c_equivalence.sh
```

The first two commands write to `build/branch_coverage_lcov/` and `build/mcdc_native_gcov14/`. `CC` and `GCOV` override the compiler and its matching coverage decoder; native MC/DC requires support for `-fcondition-coverage` and `gcov --conditions`.

The replay command needs only GCC and Bash. It compares C outputs against the saved 265-row Stateflow recording and writes to `build/simulink_c_equivalence/`. It does not rerun MATLAB or check active Stateflow state.

## MATLAB and Stateflow

The reference model and saved coverage were produced with MATLAB R2026a. Opening the full plant requires the installed products used by the model; see [model setup](../Model/HEV_powersplit_adapted/README.md).

The isolated live harness needs Simulink, Stateflow, Simulink Coverage, the Legacy Code Tool, and a configured MEX C compiler. Simulink Test is additionally needed for the Test Manager report.

Follow [live-equivalence instructions](../verification/equivalence_live/README.md). Fresh reports go to `build/equivalence_live/`. The recorded 265-row stimulus is retained as an input: its original export script was private and is not shipped. The live harness is the maintained way to rerun the chart comparison.

## Static checks

See [static analysis](static-analysis.md) for cppcheck and MISRA-addon scope. Optional static decision analysis can be regenerated with `mcdc-checker` and a compatible libclang installation:

```sh
mkdir -p build/mcdc_static_checker
mcdc-checker src/mode_logic_team.c -I inc \
  -j build/mcdc_static_checker/report.json \
  > build/mcdc_static_checker/output.txt 2>&1
```

This structural check is separate from measured MC/DC coverage. CI runs C unit tests, general/static analysis, JavaScript/C comparison, and JavaScript coverage; MATLAB and C coverage reports are generated locally.
