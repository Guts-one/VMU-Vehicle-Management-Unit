#!/usr/bin/env bash
# Branch/line coverage runner for mode_logic_team.c using Unity tests.
# Usage: ./run_branch_coverage.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

REPORT_DIR="$ROOT/Test report/branch_coverage_lcov"
BUILD="$REPORT_DIR/build_cov"
COV_DIR="$REPORT_DIR/html"
INFO="$REPORT_DIR/coverage.info"
CC=gcc-11

rm -rf "$BUILD" "$COV_DIR" "$INFO"
mkdir -p "$BUILD" "$REPORT_DIR"

# Helper: generate a Unity runner from a test file by scanning void test_* funcs
gen_runner() {
    local src="$1"; local out="$2"
    {
        echo '#include "unity.h"'
        # Forward-declare every test_* function found in the file
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

CFLAGS=(-std=c99 -Wall -Wextra -O0 -g
        --coverage -fprofile-arcs -ftest-coverage
        -fprofile-update=atomic
        -I inc -I unity/src)

# Compile each test file separately because setUp/tearDown collide.
for tf in test/*.c; do
    base="$(basename "$tf" .c)"
    runner="$BUILD/${base}_runner.c"
    bin="$BUILD/${base}.exe"
    echo ">>> Building $base"
    gen_runner "$tf" "$runner"
    # IMPORTANT: compile mode_logic_team.c only ONCE per test binary
    # but reuse the same gcno/gcda layout so counters accumulate across runs.
    "$CC" "${CFLAGS[@]}" \
        "$tf" "$runner" \
        unity/src/unity.c \
        src/mode_logic_team.c \
        -o "$bin"
done

echo
echo ">>> Running tests"
PASS=0; FAIL=0
for bin in "$BUILD"/*.exe; do
    echo "--- $(basename "$bin") ---"
    if "$bin"; then
        PASS=$((PASS+1))
    else
        FAIL=$((FAIL+1))
    fi
done
echo
echo "Test binaries: pass=$PASS fail=$FAIL"

echo
echo ">>> Generating lcov branch report"
lcov --capture --directory "$BUILD" \
     --rc lcov_branch_coverage=1 \
     --output-file "$INFO" \
     --no-external \
     --base-directory "$ROOT" 2>&1 | tail -20

# Keep only mode_logic_team.c (drop unity, runners, tests)
lcov --rc lcov_branch_coverage=1 \
     --extract "$INFO" "*/src/mode_logic_team.c" \
     --output-file "$INFO" 2>&1 | tail -10

genhtml "$INFO" \
    --branch-coverage \
    --legend \
    --title "mode_logic_team.c coverage" \
    --output-directory "$COV_DIR" 2>&1 | tail -20

echo
echo ">>> Summary"
lcov --rc lcov_branch_coverage=1 --summary "$INFO" 2>&1 | tail -15
echo
echo "HTML report: $COV_DIR/index.html"
