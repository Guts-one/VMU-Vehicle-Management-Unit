#!/usr/bin/env bash
# Behavioral equivalence check: replays the full Simulink Coverage stimulus
# (reports/simulink_native_mcdc/stimulus_and_outputs.csv) through the
# fixed-point C implementation and compares outputs row by row.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STIMULUS="$ROOT/reports/simulink_native_mcdc/stimulus_and_outputs.csv"
REPORT_DIR="$ROOT/build/simulink_c_equivalence"
mkdir -p "$REPORT_DIR"
OUT_CSV="$REPORT_DIR/c_full_stimulus_equivalence.csv"
SUMMARY="$REPORT_DIR/summary.txt"
BIN="$REPORT_DIR/simulink_c_equivalence"

CC="${CC:-gcc}"

"$CC" -std=c99 -Wall -Wextra -Werror -O0 \
    -Iinc \
    verification/simulink_c_equivalence.c \
    src/mode_logic_team.c \
    -o "$BIN"

if RESULT_LINE="$("$BIN" "$STIMULUS" "$OUT_CSV")"; then
    STATUS=0
else
    STATUS=$?
fi

{
    echo "$RESULT_LINE"
    echo "Compared fields: Mot_Enable, Gen_Enable, ICE_Enable"
    echo "Stimulus: reports/simulink_native_mcdc/stimulus_and_outputs.csv"
    echo "          (full Simulink Coverage MC/DC stimulus, replayed in order)"
    echo "Stateflow model: Model/HEV_powersplit_adapted/HEV_powersplit_adapted.slx"
    echo "C implementation: src/mode_logic_team.c"
    echo "Input conversion: physical Simulink values to fixed-point C API scales"
    echo "                  (round half away from zero, same rule as test/ helpers)"
    echo "Per-row results: build/simulink_c_equivalence/c_full_stimulus_equivalence.csv"
} > "$SUMMARY"

echo "$RESULT_LINE"
echo "Summary: $SUMMARY"
exit $STATUS
