#!/usr/bin/env bash
# Native MC/DC coverage with GCC 14 (-fcondition-coverage / gcov --conditions)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

REPORT_DIR="$ROOT/Test report/mcdc_native_gcov14"
BUILD="$REPORT_DIR/build_mcdc"
rm -rf "$BUILD"
mkdir -p "$BUILD" "$REPORT_DIR"

CC=gcc-14
GCOV=gcov-14
UNITY_SRC_DIR="${UNITY_SRC_DIR:-unity/src}"
if [ ! -f "$UNITY_SRC_DIR/unity.c" ] && [ -f "/home/vmu/unity/src/unity.c" ]; then
    UNITY_SRC_DIR="/home/vmu/unity/src"
fi
if [ ! -f "$UNITY_SRC_DIR/unity.c" ]; then
    echo "Unity source not found. Set UNITY_SRC_DIR to the directory containing unity.c." >&2
    exit 1
fi
COMMON=(-std=c99 -Wall -Wextra -O0 -g
        --coverage -fcondition-coverage
        -fprofile-update=atomic
        -I inc -I "$UNITY_SRC_DIR")

# Compile mode_logic_team.c ONCE so a single .gcno/.gcda accumulates counters
# from every test binary's run.
$CC "${COMMON[@]}" -c src/mode_logic_team.c -o "$BUILD/mode_logic_team.o"
$CC "${COMMON[@]}" -c "$UNITY_SRC_DIR/unity.c" -o "$BUILD/unity.o"

gen_runner() {
    local src="$1"; local out="$2"
    {
        echo '#include "unity.h"'
        grep -oE '^void[[:space:]]+test_[A-Za-z0-9_]+' "$src" \
            | awk '{print $2}' | sort -u \
            | while read -r fn; do echo "void ${fn}(void);"; done
        echo 'int main(void) {'
        echo '    UNITY_BEGIN();'
        grep -oE '^void[[:space:]]+test_[A-Za-z0-9_]+' "$src" \
            | awk '{print $2}' | sort -u \
            | while read -r fn; do echo "    RUN_TEST(${fn});"; done
        echo '    return UNITY_END();'
        echo '}'
    } > "$out"
}

for tf in test/*.c; do
    base="$(basename "$tf" .c)"
    runner="$BUILD/${base}_runner.c"
    bin="$BUILD/${base}.exe"
    gen_runner "$tf" "$runner"
    # Compile this test file fresh (its setUp/tearDown are unique per binary),
    # then link the shared mode_logic_team.o + unity.o.
    $CC "${COMMON[@]}" -c "$tf" -o "$BUILD/${base}.o"
    $CC "${COMMON[@]}" -c "$runner" -o "$BUILD/${base}_runner.o"
    $CC --coverage -fcondition-coverage \
        "$BUILD/${base}.o" "$BUILD/${base}_runner.o" \
        "$BUILD/mode_logic_team.o" "$BUILD/unity.o" \
        -o "$bin"
done

echo "==== Running test binaries ===="
PASS=0; FAIL=0
for bin in "$BUILD"/*.exe; do
    if "$bin" > "${bin}.log" 2>&1; then
        PASS=$((PASS+1))
    else
        FAIL=$((FAIL+1))
        echo "FAIL: $(basename "$bin")"; tail -10 "${bin}.log"
    fi
done
echo "Binaries: pass=$PASS fail=$FAIL"

# Total Unity tests passed across all binaries
echo
TOTAL_TESTS=$(grep -hE '^[0-9]+ Tests' "$BUILD"/*.log | awk '{ t+=$1 } END {print t}')
TOTAL_FAIL=$(grep -hE '^[0-9]+ Tests'  "$BUILD"/*.log | awk '{ f+=$3 } END {print f}')
echo "Unity totals: $TOTAL_TESTS tests, $TOTAL_FAIL failures"

echo
echo "==== gcov-14 --conditions on mode_logic_team.c ===="
rm -f "$ROOT/mode_logic_team.c.gcov"
$GCOV --conditions --branch-counts -t -o "$BUILD" src/mode_logic_team.c \
    > "$REPORT_DIR/mode_logic_team.gcov.txt" 2>"$REPORT_DIR/gcov.stderr"
$GCOV --conditions -o "$BUILD" src/mode_logic_team.c \
    > "$REPORT_DIR/summary.txt" 2>&1
mv "$ROOT/mode_logic_team.c.gcov" "$REPORT_DIR/mode_logic_team.c.gcov"

# Final summary block
awk '/^File / || /^Lines executed:/ || /^Condition outcomes covered:/ { print }' \
    "$REPORT_DIR/summary.txt"

echo
echo "Detailed report: $REPORT_DIR/mode_logic_team.gcov.txt"
echo "Annotated report: $REPORT_DIR/mode_logic_team.c.gcov"
