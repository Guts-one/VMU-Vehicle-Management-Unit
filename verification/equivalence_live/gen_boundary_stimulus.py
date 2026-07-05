#!/usr/bin/env python3
"""Generate the +/-1 LSB boundary stimulus for the VMU mode-logic
model<->hand-code equivalence (live oracle) workflow.

WHY THIS EXISTS
---------------
The previous "back-to-back" replay used an MC/DC stimulus whose values were all
LSB-aligned. That hid a half-LSB quantization band: e.g. the chart evaluates
`speed > 35` in continuous km/h, while the C evaluates `speed_dkph > 350` on a
0.1 km/h grid. A physical 35.04 km/h rounds to 350 dkph, so the chart says TRUE
and the (quantized) C says FALSE. The boundary set below attacks every threshold
at the finest resolution the C can represent (T-1, T, T+1 in LSB units) and adds
an explicit sub-LSB probe set that *characterises* the residual continuous band.

WHAT IT EMITS
-------------
boundary_stimulus.csv with BOTH representations of every input so the live
harness can feed:
  * the Stateflow chart  -> physical columns  (speed_kph, p_dem_kw, soc, weng_rpm)
  * the C / S-Function   -> fixed-point cols  (speed_dkph, p_dem_dkw, soc_q10000, weng_rpm_fx)
For grid-exact rows physical == fixed-point/scale, so chart and C see the SAME
operating point and must agree exactly. For kind=subLSB rows the physical value
sits off the grid on purpose (to quantify the band) and the harness treats the
expected mismatch as a documented quantization interval, not a failure.

Scales (LSB):
  speed : 1 dkph     = 0.1 km/h
  p_dem : 1 dkw      = 0.1 kW
  soc   : 1 q10000   = 0.0001 (fraction)
  weng  : 1 rpm      = 1 rpm

The module also embeds a faithful mirror of src/mode_logic_team.c used ONLY to
(a) drive the FSM into the right source mode before each probe and (b) predict
the C mode so the generated set can be cross-checked against the real compiled
C (see mode_probe.c). The mirror is NOT the oracle: the live oracle is the chart.
"""

import csv
import os
import sys

# ---- thresholds (must mirror inc/mode_logic_team.h) ------------------------
ENG_ON_RPM        = 800
ENG_OFF_RPM       = 790
SPEED_STOP        = 5
SPEED_REGEN       = 50
SPEED_EV_MAX      = 350
PDEM_REGEN        = -50
PDEM_STOP_LOW     = -10
PDEM_STOP_HIGH    = 10
PDEM_HYB_IN       = 500
PDEM_HYB_OUT      = 400
PDEM_HYB_MID      = 150
PDEM_HYB_LOW      = 100
SOC_EV_IN         = 3700
SOC_EV_OUT        = 3500
SOC_LOW           = 2500
SOC_MID           = 3000

SS, EV, REGENB, START, ICE, HYBRID = 0, 1, 2, 3, 4, 5
MODE_NAME = {SS: "STANDSTILL", EV: "EV", REGENB: "REGENB",
             START: "START", ICE: "ICE", HYBRID: "HYBRID"}

# scales: fixed-point units per physical unit
SCALE = {"speed": 10.0, "pdem": 10.0, "soc": 10000.0, "weng": 1.0}


# ---- faithful mirror of the C transition logic ----------------------------
def step_mode(mode, s, p, c, w):
    """One ModeLogic_Step. Inputs are FIXED-POINT ints. Returns next mode."""
    speed_gt_stop     = s > SPEED_STOP
    speed_le_stop     = s <= SPEED_STOP
    speed_gt_regen    = s > SPEED_REGEN
    speed_gt_ev_max   = s > SPEED_EV_MAX
    speed_le_ev_max   = s <= SPEED_EV_MAX
    p_dem_le_regen    = p <= PDEM_REGEN
    p_dem_ge_hyb_in   = p >= PDEM_HYB_IN
    p_dem_le_hyb_out  = p <= PDEM_HYB_OUT
    p_dem_le_stop_hi  = p <= PDEM_STOP_HIGH
    p_dem_ge_stop_low = p >= PDEM_STOP_LOW
    p_dem_ge_hyb_mid  = p >= PDEM_HYB_MID
    p_dem_le_hyb_low  = p <= PDEM_HYB_LOW
    soc_ge_ev_in      = c >= SOC_EV_IN
    soc_lt_ev_out     = c < SOC_EV_OUT
    soc_ge_mid        = c >= SOC_MID
    soc_lt_low        = c < SOC_LOW
    weng_gt_on        = w > ENG_ON_RPM
    weng_le_off       = w <= ENG_OFF_RPM

    to_regenb     = speed_gt_regen and p_dem_le_regen
    to_standstill = speed_le_stop and p_dem_le_stop_hi and p_dem_ge_stop_low
    g_ss_to_ev    = speed_gt_stop and speed_le_ev_max and soc_ge_ev_in
    g_ss_to_start = speed_gt_stop
    g_ev_to_start = speed_gt_ev_max or p_dem_ge_hyb_in or soc_lt_ev_out
    g_rb_to_start = (speed_gt_ev_max and p_dem_ge_stop_low) or soc_lt_ev_out
    g_rb_to_ev    = p_dem_ge_stop_low and speed_gt_stop
    g_motion_ev   = (weng_gt_on and p_dem_le_hyb_out and p_dem_ge_stop_low
                     and speed_gt_stop and speed_le_ev_max and soc_ge_ev_in)
    g_start_hyb   = weng_gt_on and soc_ge_mid and (speed_gt_ev_max or p_dem_ge_hyb_mid)
    g_start_ice   = weng_gt_on
    g_ice_hyb     = p_dem_ge_hyb_mid and soc_ge_mid
    g_hyb_ice     = p_dem_le_hyb_low or soc_lt_low

    def common_exit(cur):
        if weng_gt_on and to_regenb:
            return REGENB
        if g_motion_ev:
            return EV
        if to_standstill:
            return SS
        return cur

    if mode == SS:
        if g_ss_to_ev:
            return EV
        if g_ss_to_start:
            return START
        return SS
    if mode == EV:
        if to_regenb:
            return REGENB
        if g_ev_to_start:
            return START
        if to_standstill:
            return SS
        return EV
    if mode == REGENB:
        if g_rb_to_start:
            return START
        if to_standstill:
            return SS
        if g_rb_to_ev:
            return EV
        return REGENB
    if mode == START:
        nxt = common_exit(START)
        if nxt == START:
            if g_start_hyb:
                return HYBRID
            if g_start_ice:
                return ICE
        return nxt
    if mode == ICE:
        nxt = common_exit(ICE)
        if nxt == ICE and weng_le_off:
            nxt = START
        if nxt == ICE and g_ice_hyb:
            return HYBRID
        return nxt
    if mode == HYBRID:
        nxt = common_exit(HYBRID)
        if nxt == HYBRID and weng_le_off:
            nxt = START
        if nxt == HYBRID and g_hyb_ice:
            return ICE
        return nxt
    return SS


# canonical one-step drivers (fixed-point) that move the FSM toward a mode
DRIVE = {
    EV:     dict(s=100, p=0,    c=4000, w=0),    # SS -> EV
    REGENB: dict(s=100, p=-100, c=4000, w=0),    # EV -> REGENB
    START:  dict(s=100, p=0,    c=2000, w=0),    # SS -> START (soc<EV_IN)
    ICE:    dict(s=100, p=0,    c=2000, w=900),  # START -> ICE
    HYBRID: dict(s=100, p=200,  c=3500, w=900),  # START -> HYBRID
}
PATH = {
    SS:     [],
    EV:     [EV],
    REGENB: [EV, REGENB],
    START:  [START],
    ICE:    [START, ICE],
    HYBRID: [START, HYBRID],
}


def reach(target):
    """Return list of drive input dicts that take SS -> target, verified."""
    rows, mode = [], SS
    for hop in PATH[target]:
        d = DRIVE[hop]
        rows.append(d)
        mode = step_mode(mode, d["s"], d["p"], d["c"], d["w"])
        assert mode == hop, f"reach({MODE_NAME[target]}): wanted {MODE_NAME[hop]} got {MODE_NAME[mode]}"
    assert mode == target
    return rows


# ---- boundary probe specs --------------------------------------------------
# Each spec: id, source mode, swept var, threshold T, baseline (other fixed pts).
# Baselines make the swept condition the deciding factor (unique cause) so the
# resulting MODE changes across {T-1, T, T+1} -> observable at the outputs.
SPECS = [
    # id,               mode,   var,     T,             base(other fixed-point)
    ("SPEED_STOP.start", SS,    "speed", SPEED_STOP,    dict(p=0,    c=3000, w=0)),
    ("SPEED_STOP.toSS",  EV,    "speed", SPEED_STOP,    dict(p=0,    c=4000, w=0)),
    ("SPEED_REGEN",      EV,    "speed", SPEED_REGEN,   dict(p=-100, c=4000, w=0)),
    ("SPEED_EV_MAX.ev",  EV,    "speed", SPEED_EV_MAX,  dict(p=0,    c=4000, w=0)),
    ("SPEED_EV_MAX.ss",  SS,    "speed", SPEED_EV_MAX,  dict(p=0,    c=4000, w=0)),
    ("ENG_ON",           START, "weng",  ENG_ON_RPM,    dict(s=100,  p=0,    c=2000)),
    ("ENG_OFF",          ICE,   "weng",  ENG_OFF_RPM,   dict(s=100,  p=0,    c=2000)),
    ("PDEM_REGEN",       EV,    "pdem",  PDEM_REGEN,    dict(s=100,  c=4000, w=0)),
    ("PDEM_STOP_LOW",    EV,    "pdem",  PDEM_STOP_LOW, dict(s=0,    c=4000, w=0)),
    ("PDEM_STOP_HIGH",   EV,    "pdem",  PDEM_STOP_HIGH,dict(s=0,    c=4000, w=0)),
    ("PDEM_HYB_IN",      EV,    "pdem",  PDEM_HYB_IN,   dict(s=100,  c=4000, w=0)),
    ("PDEM_HYB_OUT",     START, "pdem",  PDEM_HYB_OUT,  dict(s=100,  c=4000, w=900)),
    ("PDEM_HYB_MID",     START, "pdem",  PDEM_HYB_MID,  dict(s=100,  c=3500, w=900)),
    ("PDEM_HYB_LOW",     HYBRID,"pdem",  PDEM_HYB_LOW,  dict(s=100,  c=3000, w=900)),
    ("SOC_EV_IN",        SS,    "soc",   SOC_EV_IN,     dict(s=100,  p=0,    w=0)),
    ("SOC_EV_OUT",       EV,    "soc",   SOC_EV_OUT,    dict(s=100,  p=0,    w=0)),
    ("SOC_MID",          ICE,   "soc",   SOC_MID,       dict(s=100,  p=200,  w=900)),
    ("SOC_LOW",          HYBRID,"soc",   SOC_LOW,       dict(s=100,  p=200,  w=900)),
]

VAR_KEY = {"speed": "s", "pdem": "p", "soc": "c", "weng": "w"}
SPEC_VAR = {sid: var for (sid, _m, var, _T, _b) in SPECS}

# extra "tour" sequences to drive every handler branch (REGENB exits, resets,
# start_to_hybrid via speed>EV_MAX, etc.). Each entry is a list of fixed-point
# input dicts applied in order, after a forced reset to STANDSTILL.
TOURS = [
    # REGENB -> START via soc<EV_OUT
    [dict(s=100,p=0,c=4000,w=0), dict(s=100,p=-100,c=4000,w=0), dict(s=100,p=0,c=2000,w=0)],
    # REGENB -> STANDSTILL
    [dict(s=100,p=0,c=4000,w=0), dict(s=100,p=-100,c=4000,w=0), dict(s=0,p=0,c=4000,w=0)],
    # REGENB -> EV (regenb_to_ev true)
    [dict(s=100,p=0,c=4000,w=0), dict(s=100,p=-100,c=4000,w=0), dict(s=100,p=0,c=4000,w=0)],
    # START -> HYBRID via speed>EV_MAX branch of high_load
    [dict(s=100,p=0,c=2000,w=0), dict(s=400,p=0,c=3500,w=900)],
    # motion common_exit: START -> REGENB (weng_gt_on & to_regenb)
    [dict(s=100,p=0,c=2000,w=0), dict(s=100,p=-100,c=2000,w=900)],
    # ICE -> HYBRID then HYBRID -> ICE (hysteresis)
    [dict(s=100,p=0,c=2000,w=900), dict(s=100,p=200,c=3500,w=900), dict(s=100,p=50,c=2000,w=900)],
    # ICE internal reset weng<=off -> START
    [dict(s=100,p=0,c=2000,w=900), dict(s=100,p=0,c=2000,w=700)],
    # motion_to_ev full true path (START -> EV)
    [dict(s=100,p=0,c=2000,w=900), dict(s=100,p=0,c=4000,w=900)],
    # REGENB stays REGENB with regenb_to_ev FALSE (covers handle_regenb L382
    # else-if to_ev == 0 side: rb_to_start false, to_standstill false, to_ev false)
    [dict(s=100,p=0,c=4000,w=0), dict(s=100,p=-100,c=4000,w=0), dict(s=100,p=-100,c=4000,w=0)],
]


def fx_to_phys(var, fx):
    return fx / SCALE[var]


# universal one-step input that forces ANY mode -> STANDSTILL
# (speed<=stop, p in stop band; soc high so EV exit guards stay false)
RESET = dict(s=0, p=0, c=5000, w=0)


def quantize(phys, scale):
    """round-half-away-from-zero, identical to the C harness to_u16/to_s16."""
    scaled = phys * scale
    return int(scaled + 0.5) if scaled >= 0 else int(scaled - 0.5)


def build():
    """Two-pass: first assemble the raw input sequence (with an explicit reset
    before every probe so each probe is evaluated from a known source mode),
    then run ONE continuous mirror FSM over the whole sequence to label the
    predicted C mode. The single continuous pass guarantees exp_mode_c matches
    a real sequential C run (mode_probe) that inits once and never resets."""
    raw = []  # list of dicts: scenario, phase, kind, s, p, c, w, phys_override

    def emit(scenario, phase, kind, fx, phys_override=None):
        raw.append(dict(scenario=scenario, phase=phase, kind=kind,
                        s=fx.get("s", 0), p=fx.get("p", 0),
                        c=fx.get("c", 0), w=fx.get("w", 0),
                        phys_override=phys_override))

    def arm(scenario, mode0):
        """Force SS, then drive SS -> mode0."""
        emit(scenario, "reset", "drive", RESET)
        for d in reach(mode0):
            emit(scenario, "drive", "drive", d)

    probe_spans = []  # (spec_id, mode0, [row indices of the 3 probes])

    for spec_id, mode0, var, T, base in SPECS:
        idxs = []
        for val in (T - 1, T, T + 1):
            arm(spec_id, mode0)                 # re-arm from a clean mode0
            fx = dict(base)
            fx[VAR_KEY[var]] = val
            idxs.append(len(raw))
            emit(spec_id, f"{var}={val}", "probe", fx)
        probe_spans.append((spec_id, mode0, idxs))

    for ti, tour in enumerate(TOURS):
        emit(f"TOUR{ti}", "reset", "drive", RESET)
        for j, d in enumerate(tour):
            emit(f"TOUR{ti}", f"hop{j}", "tour", d)

    sub = [
        # label, var, source mode, base(fx), off-grid physical value
        ("SPEED_EV_MAX.subLSB", "speed", EV, dict(p=0, c=4000, w=0), 35.04),
        ("SPEED_STOP.subLSB",   "speed", SS, dict(p=0, c=3000, w=0), 0.54),
        ("SOC_EV_IN.subLSB",    "soc",   SS, dict(s=100, p=0, w=0),  0.36996),
        ("PDEM_HYB_IN.subLSB",  "pdem",  EV, dict(s=100, c=4000, w=0), 49.96),
    ]
    for label, var, mode0, base, phys in sub:
        arm(label, mode0)
        fx = dict(base)
        fx[VAR_KEY[var]] = quantize(phys, SCALE[var])
        col = {"speed": "speed_kph", "pdem": "p_dem_kw",
               "soc": "soc", "weng": "weng_rpm"}[var]
        emit(label, f"{var}~{phys}", "subLSB", fx, phys_override=(col, phys))

    # ---- import the chart MC/DC independence-pair stimulus -----------------
    # The project's proven chart MC/DC set drives every Stateflow transition's
    # unique-cause pairs -> 39/39 chart MC/DC. Its inputs are grid-aligned, so
    # the chart and the quantized C agree exactly; replaying them in the live
    # harness closes chart MC/DC alongside the C-side boundary probes.
    _here = os.path.dirname(os.path.abspath(__file__))
    _cm = os.path.join(_here, '..', '..', 'Test report',
                       'simulink_native_mcdc', 'stimulus_and_outputs.csv')
    if os.path.isfile(_cm):
        emit('CHART_MCDC', 'reset', 'drive', RESET)
        with open(_cm, newline='') as _f:
            for _r in csv.DictReader(_f):
                fx = dict(s=quantize(float(_r['speed_kph']), SCALE['speed']),
                          p=quantize(float(_r['p_dem_kw']), SCALE['pdem']),
                          c=quantize(float(_r['soc']),      SCALE['soc']),
                          w=quantize(float(_r['weng_rpm']), SCALE['weng']))
                emit('chartmcdc:' + _r.get('scenario', 'row'),
                     str(_r.get('step', '')), 'chartmcdc', fx)
    else:
        print('NOTE: chart MC/DC stimulus not found at', _cm, file=sys.stderr)

    # ---- pass 2: continuous mirror to label predicted mode -----------------
    rows = []
    mode = SS
    for step, r in enumerate(raw):
        mode = step_mode(mode, r["s"], r["p"], r["c"], r["w"])
        row = dict(
            step=step, scenario=r["scenario"], phase=r["phase"], kind=r["kind"],
            speed_kph=round(fx_to_phys("speed", r["s"]), 4),
            p_dem_kw=round(fx_to_phys("pdem", r["p"]), 4),
            soc=round(fx_to_phys("soc", r["c"]), 4),
            weng_rpm=round(fx_to_phys("weng", r["w"]), 4),
            speed_dkph=r["s"], p_dem_dkw=r["p"],
            soc_q10000=r["c"], weng_rpm_fx=r["w"],
            exp_mode_c=MODE_NAME[mode],
        )
        if r["phys_override"]:
            col, val = r["phys_override"]
            row[col] = val
        rows.append(row)

    flips = []
    for spec_id, mode0, idxs in probe_spans:
        seq = [(raw[i][VAR_KEY[SPEC_VAR[spec_id]]], rows[i]["exp_mode_c"])
               for i in idxs]
        flips.append((spec_id, MODE_NAME[mode0], seq))
    return rows, flips


def main():
    rows, flips = build()
    out = "boundary_stimulus.csv"
    cols = ["step", "scenario", "phase", "kind",
            "speed_kph", "p_dem_kw", "soc", "weng_rpm",
            "speed_dkph", "p_dem_dkw", "soc_q10000", "weng_rpm_fx",
            "exp_mode_c"]
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)

    print(f"wrote {out}: {len(rows)} rows")
    print("\nBoundary flips (mirror) -- each should change mode across T..T+1:")
    ok = True
    for spec_id, before, seq in flips:
        modes = [m for _, m in seq]
        changed = len(set(modes)) > 1
        ok = ok and changed
        flag = "OK " if changed else "!! "
        print(f"  {flag}{spec_id:20s} from {before:10s} -> "
              + ", ".join(f"{v}:{m}" for v, m in seq))
    if not ok:
        print("\nERROR: some boundary did not flip the mode", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
