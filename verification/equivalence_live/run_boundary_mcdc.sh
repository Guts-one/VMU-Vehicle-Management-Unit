#!/usr/bin/env bash
# Measure condition coverage of the boundary sequence with GCC/gcov 14+.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HERE="$ROOT/verification/equivalence_live"
REPORT_DIR="$ROOT/build/boundary_mcdc"
BUILD="$REPORT_DIR/build"
CC="${CC:-gcc-14}"
GCOV="${GCOV:-gcov-14}"
PYTHON="${PYTHON:-python3}"

rm -rf "$BUILD"
mkdir -p "$BUILD"
(cd "$HERE" && "$PYTHON" gen_boundary_stimulus.py) > "$REPORT_DIR/generator.log"
cd "$ROOT"
COMMON=(-std=c99 -Wall -Wextra -Werror -O0 -g --coverage -fcondition-coverage
        -fprofile-update=atomic -I "$ROOT/inc")
"$CC" "${COMMON[@]}" -c "$ROOT/src/mode_logic_team.c" -o "$BUILD/mode_logic_team.o"
"$CC" "${COMMON[@]}" -c "$HERE/mode_probe.c" -o "$BUILD/mode_probe.o"
"$CC" --coverage -fcondition-coverage "$BUILD/mode_probe.o" "$BUILD/mode_logic_team.o" -o "$BUILD/mode_probe"
"$BUILD/mode_probe" "$HERE/boundary_stimulus.csv" > "$REPORT_DIR/probe_out.csv" 2> "$REPORT_DIR/probe.stderr"
cat "$REPORT_DIR/probe.stderr"

cd "$REPORT_DIR"
"$GCOV" --conditions --branch-counts -t -o "$BUILD" "$ROOT/src/mode_logic_team.c" \
    > mode_logic_team.gcov.txt 2> gcov.stderr
"$GCOV" --conditions -o "$BUILD" "$ROOT/src/mode_logic_team.c" > summary.txt 2>&1
cat summary.txt
printf '\nBoundary coverage excludes defensive paths exercised by the Unity suites.\n'
printf 'Report: %s\n' "$REPORT_DIR"
