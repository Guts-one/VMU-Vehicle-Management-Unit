#!/usr/bin/env bash
# Authoritative MC/DC (condition-outcome) check of the +/-1 LSB BOUNDARY stimulus
# against src/mode_logic_team.c, using GCC 14 (-fcondition-coverage / gcov-14
# --conditions) -- the same toolchain as run_mcdc_native.sh.
#
# Run in WSL Ubuntu (\\wsl.localhost\Ubuntu-22.04\home\vmu...), where gcc-14 is
# installed. In the Cowork Linux sandbox only gcc-11 exists, so this prints a
# branch-coverage proxy instead (each decision in mode_logic_team.c is a single
# condition, so branch coverage of the if-statements == condition outcomes).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"   # repo root
HERE="$ROOT/verification/equivalence_live"
cd "$HERE"

REPORT_DIR="$ROOT/Test report/boundary_mcdc"
BUILD="$REPORT_DIR/build"
rm -rf "$BUILD"; mkdir -p "$BUILD" "$REPORT_DIR"

# regenerate the stimulus so the CSV always matches the generator
python3 gen_boundary_stimulus.py > "$REPORT_DIR/gen.log"

if command -v gcc-14 >/dev/null 2>&1 && command -v gcov-14 >/dev/null 2>&1; then
    CC=gcc-14; GCOV=gcov-14; COND=(-fcondition-coverage); METRIC="MC/DC condition outcomes"
else
    echo "WARNING: gcc-14/gcov-14 not found -> falling back to gcc branch coverage." >&2
    echo "         Run this script in WSL Ubuntu for the authoritative MC/DC metric." >&2
    CC="${CC:-gcc}"; GCOV="${GCOV:-gcov}"; COND=(); METRIC="branch outcomes (MC/DC proxy)"
fi

COMMON=(-std=c99 -Wall -Wextra -O0 -g --coverage "${COND[@]}" -fprofile-update=atomic -I "$ROOT/inc")

# compile the unit under test once so a single .gcda accumulates
"$CC" "${COMMON[@]}" -c "$ROOT/src/mode_logic_team.c" -o "$BUILD/mode_logic_team.o"
"$CC" "${COMMON[@]}" -c "$HERE/mode_probe.c"          -o "$BUILD/mode_probe.o"
"$CC" --coverage "${COND[@]}" "$BUILD/mode_probe.o" "$BUILD/mode_logic_team.o" -o "$BUILD/mode_probe"

echo "==== replaying boundary stimulus through the C ===="
"$BUILD/mode_probe" "$HERE/boundary_stimulus.csv" > "$REPORT_DIR/probe_out.csv" 2> "$REPORT_DIR/probe.stderr"
cat "$REPORT_DIR/probe.stderr"

echo
echo "==== $GCOV on mode_logic_team.c ($METRIC) ===="
if [ ${#COND[@]} -gt 0 ]; then
    "$GCOV" --conditions --branch-counts -t -o "$BUILD" "$ROOT/src/mode_logic_team.c" \
        > "$REPORT_DIR/mode_logic_team.gcov.txt" 2> "$REPORT_DIR/gcov.stderr" || true
    "$GCOV" --conditions -o "$BUILD" "$ROOT/src/mode_logic_team.c" \
        > "$REPORT_DIR/summary.txt" 2>&1 || true
    grep -E "^File|Condition outcomes covered:|Lines executed:" "$REPORT_DIR/summary.txt" || true
else
    "$GCOV" -b -c -o "$BUILD" "$ROOT/src/mode_logic_team.c" > "$REPORT_DIR/summary.txt" 2>&1 || true
    grep -E "Lines executed:|Branches executed:|Taken at least once:" "$REPORT_DIR/summary.txt" || true
    [ -f mode_logic_team.c.gcov ] && mv -f mode_logic_team.c.gcov "$REPORT_DIR/" || true
fi

echo
echo "NOTE: the 6 branch/condition outcomes the boundary set does NOT cover are the"
echo "      defensive null-guards (ModeLogic_Init/Step) and the two unreachable"
echo "      switch defaults. Those are covered by the Unity suite (run_mcdc_native.sh)."
echo "      Boundary + Unity together = full decision-logic MC/DC."
echo "Report: $REPORT_DIR"
