# Test Reports — `mode_logic_team.c`

This folder holds the coverage artifacts generated against `src/mode_logic_team.c`
using the Unity tests under `test/`. Three independent toolchains are exercised:

- **branch coverage** with `gcc-11` + `lcov 1.14`
- **native MC/DC** (Modified Condition / Decision Coverage) with `gcc-14`
  (`-fcondition-coverage`) + `gcov-14 --conditions`
- **static MC/DC tree-likeness check** with `mcdc-checker` (Python tool,
  built on libclang-19)

## Headline numbers (current state of the repo)

| Metric                       | Value             | Source                     |
|------------------------------|-------------------|----------------------------|
| Unity tests                  | 141 / 0 failures  | 5 binaries combined        |
| Functions                    | 100 % (11 / 11)   | `lcov`                     |
| Lines                        | 95.15 % (157/165) | `gcov-14`                  |
| Branches                     | 93.8 % (122/130)  | `lcov` (lcov_branch_coverage) |
| **MC/DC condition outcomes** | **93.10 % (108/116)** | `gcov-14 --conditions` |
| Static MC/DC issues          | 1 (BDD non tree-like at line 63) | `mcdc-checker` |

The 8 uncovered MC/DC outcomes are **structurally unreachable** — see
`MCDC_matrix.md` for the per-decision analysis.

## Folder layout

```text
Test report/
|-- README.md                         (this file: tools, how-to, layout)
|-- summary.txt                       (curated top-level coverage summary)
|-- MCDC_matrix.md                    (tests <-> requirements, per-decision MC/DC)
|-- branch_coverage_lcov/             (lcov 1.14 output, gcc-11)
|   |-- coverage.info                 raw .info tracefile
|   |-- html/index.html               browsable HTML report
|   `-- build_cov/                    generated branch-coverage build products
|-- mcdc_native_gcov14/               (GCC 14 -fcondition-coverage output)
|   |-- mode_logic_team.c.gcov        annotated source with MC/DC marks
|   |-- mode_logic_team.gcov.txt      stdout-form annotated MC/DC report
|   |-- summary.txt                   gcov-14 one-run coverage summary
|   |-- gcov.stderr                   gcov-14 stderr from report generation
|   `-- build_mcdc/                   generated native MC/DC build products
|-- mcdc_static_checker/              (static BDD analysis)
|   |-- output.txt                    mcdc-checker stdout
|   `-- report.json                   Code-Climate-style issues file
```

## Tools used and what they actually measure

| Tool | Version | Metric | Where the data lives |
|---|---|---|---|
| `gcc-11` + `--coverage -fprofile-arcs -ftest-coverage` | 11.4.0 (Ubuntu 22.04) | Lines + branches | `branch_coverage_lcov/coverage.info` |
| `lcov` | 1.14 | Aggregates `.gcda` from all 5 test binaries; `--rc lcov_branch_coverage=1` enables per-branch info | `branch_coverage_lcov/html/index.html` |
| `gcc-14` + `-fcondition-coverage` | 14.3.0 (`ppa:ubuntu-toolchain-r/test`) | Modified Condition / Decision Coverage instrumentation | `mcdc_native_gcov14/build_mcdc/*.gcda` |
| `gcov-14 --conditions` | 14.3.0 | Decodes per-condition T/F outcome coverage from `.gcda` | `mcdc_native_gcov14/mode_logic_team.c.gcov`, `mcdc_native_gcov14/mode_logic_team.gcov.txt`, `mcdc_native_gcov14/summary.txt` |
| `mcdc-checker` | from Codethink/`mcdc-checker` (libclang-19) | Static check: is each decision's BDD tree-like? (necessary precondition for unique-cause MC/DC) | `mcdc_static_checker/report.json` |
| Unity | upstream `master` (vendored under `unity/`) | Test framework | `test/*.c` |

> **Why two GCC versions?**
> Native MC/DC (`-fcondition-coverage`) only landed in GCC 14. The system
> compiler (gcc-11) is still used for plain branch coverage because lcov 1.14
> doesn't yet understand the GCC-14 condition-coverage `.gcda` extensions.

## How to regenerate the reports

The branch and native MC/DC flows are driven by self-contained scripts at the repo root.

> The supported order is: **(1) `run_branch_coverage.sh` → (2) `run_mcdc_native.sh` →
> (3) regenerate the static checker report if needed**.
> The two scripts now write their generated outputs directly into `Test report/`.

### 0. Prerequisites (one-time)

```bash
# branch coverage / gcc-11
sudo apt install -y lcov gcc-11

# native MC/DC: GCC 14 from the ubuntu-toolchain-r PPA
sudo add-apt-repository -y ppa:ubuntu-toolchain-r/test
sudo apt update
sudo apt install -y gcc-14

# static MC/DC: libclang-19 + mcdc-checker
sudo apt install -y libclang-19-dev
# (mcdc-checker installed as a Python tool in /usr/local/bin)
sudo ln -sf /usr/lib/llvm-19/lib/libclang-19.so /usr/lib/libclang.so
sudo ldconfig

# Unity (vendored): the coverage scripts expect ./unity/src/*; if missing:
mkdir -p unity/src
curl -sSL -o unity/src/unity.c           https://raw.githubusercontent.com/ThrowTheSwitch/Unity/master/src/unity.c
curl -sSL -o unity/src/unity.h           https://raw.githubusercontent.com/ThrowTheSwitch/Unity/master/src/unity.h
curl -sSL -o unity/src/unity_internals.h https://raw.githubusercontent.com/ThrowTheSwitch/Unity/master/src/unity_internals.h
```

### 1. Branch coverage (`run_branch_coverage.sh`)

```bash
./run_branch_coverage.sh
```

The script:
1. compiles each `test/*.c` into its own binary (each file defines its own
   `setUp`/`tearDown` so they cannot share a process) with
   `--coverage -fprofile-arcs -ftest-coverage -fprofile-update=atomic`,
2. runs all 5 binaries; each binary writes its own `*-mode_logic_team.gcda`
   under `branch_coverage_lcov/build_cov/`,
3. aggregates those files with `lcov --rc lcov_branch_coverage=1` and extracts
   only `src/mode_logic_team.c`,
4. emits `branch_coverage_lcov/coverage.info` and `branch_coverage_lcov/html/`.

### 2. Native MC/DC (`run_mcdc_native.sh`)

```bash
./run_mcdc_native.sh
```

The script:
1. compiles `mode_logic_team.c` **once** with
   `gcc-14 -fcondition-coverage -fprofile-update=atomic -O0 -g`
   (so a single `.gcno`/`.gcda` accumulates counters from every test binary),
2. compiles each test source file separately and links each against the shared
   `mode_logic_team.o` and `unity.o`,
3. runs each binary, then `gcov-14 --conditions` reads the merged `.gcda` and
   writes `mode_logic_team.c.gcov`, `mode_logic_team.gcov.txt`, and `summary.txt` under `mcdc_native_gcov14/`.

### 3. Static MC/DC tree-likeness (`mcdc-checker`)

```bash
LIBCLANG_PATH=/usr/lib/llvm-19/lib \
    mcdc-checker src/mode_logic_team.c -I inc \
    -j "Test report/mcdc_static_checker/report.json" \
    > "Test report/mcdc_static_checker/output.txt" 2>&1 || true
```

This is a **static** check: it walks the AST of each Boolean decision and
checks whether the resulting BDD is tree-like. Tree-likeness is a necessary
precondition for unique-cause MC/DC; if it isn't tree-like, achieving
unique-cause MC/DC may be impossible without refactoring the decision.
The `|| true` is intentional here because this repo currently has one known
non-tree-like decision, so `mcdc-checker` reports the expected issue with a
non-zero exit code while still producing the report files.

### 4. Output locations

The scripts publish generated artifacts directly into `Test report/`:

```text
Test report/branch_coverage_lcov/coverage.info
Test report/branch_coverage_lcov/html/
Test report/branch_coverage_lcov/build_cov/
Test report/mcdc_native_gcov14/mode_logic_team.c.gcov
Test report/mcdc_native_gcov14/mode_logic_team.gcov.txt
Test report/mcdc_native_gcov14/summary.txt
Test report/mcdc_native_gcov14/gcov.stderr
Test report/mcdc_native_gcov14/build_mcdc/
```

## On adding more tests

A previous pass added 4 candidate tests targeting the missing MC/DC pairs
(line 18 cond 1, line 63 cond 1, line 74 cond 2, line 138 cond 1). Re-running
`gcov-14 --conditions` showed the MC/DC percentage **did not change**
(108/116 either way) because every remaining gap is structurally unreachable
under GCC 14's unique-cause MC/DC criterion — see `MCDC_matrix.md` §4.
The tests were therefore reverted: they passed, but did not raise line,
branch, or MC/DC coverage. Closing the remaining 8 outcomes requires source
refactors (notably splitting the non-tree-like decision at line 63), not
more tests.
