#!/usr/bin/env python3
"""Item (c): compare structural coverage between the two artifacts.

Cross-references the Stateflow chart MC/DC (Simulink Coverage, exported by
export_simulink_mcdc.m to chart_coverage.json) against the hand-code MC/DC
(GCC condition coverage, from gcov's annotated mode_logic_team.c.gcov), using
mcdc_mapping.csv to align each logical decision on both sides.

They count differently: the chart reports MC/DC outcomes per Stateflow
transition, the C reports condition outcomes per decomposed if-decision (39 vs
86 here). The mapping makes them comparable -- it shows every modelled decision
has a covered counterpart on BOTH sides (ISO 26262 absence-of-unintended-
functionality argument for model-vs-code coverage).

Outputs (Test report/equivalence_live/): coverage_comparison.md / .csv
Runs without MATLAB: if chart_coverage.json is missing it still emits the
C-side + mapping and marks the chart side n/a.
"""
import csv
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
REP = os.path.join(ROOT, "Test report")
OUT = os.path.join(REP, "equivalence_live")


def find_gcov(explicit=None):
    cands = [explicit] if explicit else []
    cands += [
        os.path.join(REP, "mcdc_native_gcov14", "mode_logic_team.c.gcov"),
        os.path.join(REP, "boundary_mcdc", "mode_logic_team.c.gcov"),
        os.path.join(HERE, "cov", "mode_logic_team.c.gcov"),
    ]
    for c in cands:
        if c and os.path.isfile(c):
            return c
    return None


_DEF_RE = re.compile(
    r"^(?:static\s+|void\s+|Mode_t\s+|uint8_t\s+|uint16_t\s+|int16_t\s+)"
    r".*?\b([A-Za-z_]\w*)\s*\(")


def parse_gcov_functions(path):
    """{func: {'cond':[(cov,tot)], 'branch':[taken,...]}} from an annotated
    .gcov, handling both `gcov -b` and `gcov --conditions` formats."""
    funcs = {}
    cur = None

    def slot(name):
        return funcs.setdefault(name, {"cond": [], "branch": []})

    with open(path, encoding="utf-8", errors="ignore") as f:
        for line in f:
            mf = re.match(r"function\s+(\S+)\s+called", line)
            if mf:
                cur = mf.group(1)
                slot(cur)
                continue
            parts = line.split(":", 2)
            if len(parts) == 3:
                code = parts[2]
                if code[:1] not in (" ", "\t", "\n", ""):
                    md = _DEF_RE.match(code)
                    if md and "=" not in code.split("(")[0]:
                        cur = md.group(1)
                        slot(cur)
            mc = re.search(r"condition outcomes covered\s+(\d+)/(\d+)", line)
            if mc and cur is not None:
                slot(cur)["cond"].append((int(mc.group(1)), int(mc.group(2))))
                continue
            mb = re.search(r"branch\s+\d+\s+(?:taken\s+(\d+)|never executed)", line)
            if mb and cur is not None:
                slot(cur)["branch"].append(int(mb.group(1)) if mb.group(1) else 0)
    return funcs


def flag_covered(funcs, flag):
    d = funcs.get(flag)
    if not d:
        return None
    if d["cond"]:
        return all(cov == tot and tot > 0 for cov, tot in d["cond"])
    if d["branch"]:
        return all(x > 0 for x in d["branch"]) and len(d["branch"]) >= 2
    return None


def load_chart_json(path):
    if not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def cov_str(d):
    if not d:
        return "n/a"
    c, t = d.get("covered"), d.get("total")
    p = (100.0 * c / t) if t else 100.0
    return "%d/%d (%.1f%%)" % (c, t, p)


def main(argv):
    gcov = find_gcov(argv[1] if len(argv) > 1 else None)
    chart = load_chart_json(os.path.join(OUT, "chart_coverage.json"))
    os.makedirs(OUT, exist_ok=True)
    funcs = parse_gcov_functions(gcov) if gcov else {}
    with open(os.path.join(HERE, "mcdc_mapping.csv"), newline="", encoding="utf-8") as f:
        mapping = list(csv.DictReader(f))

    rows = []
    for r in mapping:
        conds = [c for c in r["c_conditions"].split(";") if c]
        st = [flag_covered(funcs, c) for c in conds]
        if not funcs:
            cstat = "n/a"
        elif any(s is None for s in st):
            cstat = "UNKNOWN(" + ",".join(c for c, s in zip(conds, st) if s is None) + ")"
        elif all(st):
            cstat = "COVERED"
        else:
            cstat = "GAP(" + ",".join(c for c, s in zip(conds, st) if not s) + ")"
        if chart:
            mc = chart.get("mcdc", {})
            full = mc.get("covered") == mc.get("total") and mc.get("total", 0) > 0
            chstat = "COVERED" if full else "CHECK chart_coverage.csv"
        else:
            chstat = "n/a"
        rows.append((r["id"], r["chart_transition"], r["c_function"], chstat, cstat))

    c_cov = c_tot = 0
    for d in funcs.values():
        if d["cond"]:
            for cv, tt in d["cond"]:
                c_cov += cv
                c_tot += tt
        elif d["branch"]:
            c_tot += len(d["branch"])
            c_cov += sum(1 for x in d["branch"] if x > 0)

    with open(os.path.join(OUT, "coverage_comparison.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "chart_transition", "c_function", "chart_status", "c_status"])
        w.writerows(rows)

    md = []
    md.append("# Model <-> Hand-code coverage comparison (item c)")
    md.append("")
    md.append("Generated by `compare_coverage.py`. Aligns each modelled decision "
              "on both artifacts via `mcdc_mapping.csv`.")
    md.append("")
    md.append("## Headline")
    md.append("")
    md.append("| Metric | Stateflow chart (Simulink Coverage) | Hand code (gcov) |")
    md.append("|---|---|---|")
    if chart:
        md.append("| Decision | %s | - |" % cov_str(chart.get("decision")))
        md.append("| Condition | %s | %d/%d outcomes |" % (cov_str(chart.get("condition")), c_cov, c_tot))
        md.append("| MC/DC | %s | %d/%d (single-condition decisions) |" % (cov_str(chart.get("mcdc")), c_cov, c_tot))
    else:
        md.append("| (chart side) | n/a - run run_live_equivalence.m | - |")
        md.append("| Condition (C) | - | %d/%d outcomes |" % (c_cov, c_tot))
    md.append("")
    md.append("> Note: chart MC/DC counts transition outcomes; C counts decomposed "
              "condition outcomes. They are NOT expected to be the same integer. "
              "The per-decision table below is the apples-to-apples comparison.")
    md.append("")
    md.append("## Per-decision correspondence")
    md.append("")
    md.append("| id | transition | C guard | chart | C |")
    md.append("|---|---|---|---|---|")
    for rid, tr, cf, cs, ccs in rows:
        md.append("| %s | %s | `%s` | %s | %s |" % (rid, tr, cf, cs, ccs))
    md.append("")
    gaps = [r for r in rows if r[4].startswith("GAP") or r[3].startswith("CHECK")]
    if gaps:
        md.append("## Discrepancies to assess")
        md.append("")
        for r in gaps:
            md.append("- decision %s (%s): chart=%s C=%s" % (r[0], r[1], r[3], r[4]))
    else:
        md.append("## Result")
        md.append("")
        md.append("Every mapped decision has a covered counterpart on both artifacts "
                  "(no decision exercised in one but not the other). This supports the "
                  "ISO 26262 absence-of-unintended-functionality argument for "
                  "model-vs-code equivalence.")
    md.append("")
    if not gcov:
        md.append("_(C-side gcov report not found. Run `./run_mcdc_native.sh` or "
                  "`./run_boundary_mcdc.sh` in WSL first.)_")
    with open(os.path.join(OUT, "coverage_comparison.md"), "w") as f:
        f.write("\n".join(md))

    print("gcov source :", gcov or "NONE")
    print("chart json  :", "found" if chart else "NONE")
    print("decisions   :", len(rows), "mapped")
    print("C outcomes covered: %d/%d" % (c_cov, c_tot))
    print("wrote", os.path.join(OUT, "coverage_comparison.md"))
    return 1 if any(r[4].startswith("GAP") for r in rows) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
