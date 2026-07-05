# Web simulator ↔ C equivalence (deterministic, with MC/DC)

This folder gates the **web simulator's logic** (`mode_logic.js`, the single
source of truth loaded by `mode_logic_sim.html`) against the hand-written C
(`src/mode_logic_team.c`) with a **deterministic** differential test — no random
sampling — plus MC/DC-grade coverage. It is the JS analog of the existing C↔C
harness in `verification/simulink_c_equivalence.c` and complements the live
model↔code work in `verification/equivalence_live/` (which it **reuses and does
not modify**).

## What it proves

One deterministic stimulus drives **three** implementations that must agree:

```
boundary_stimulus.csv ─┬─► Python mirror  (exp_mode_c column)
   (±1 LSB, 473 rows)   ├─► compiled C     (mode_probe.c → mode,Mot,Gen,ICE)
                        └─► mode_logic.js   (the web simulator)
```

| Check | Script | Result |
|---|---|---|
| **State + outputs** vs compiled C | `run_js_equivalence.js` | 473/473 rows match (mode **and** Mot/Gen/ICE), 0 mismatches |
| **State** vs Python mirror | `run_js_equivalence.js` | 473/473 rows match (`exp_mode_c`) |
| **MC/DC independence** | `mcdc_independence_pairs.js` | 18/18 probed conditions independently flip the JS decision; 14 modelled decisions mapped |
| **Branch coverage** of `mode_logic.js` | `run_coverage.js` + c8 | 100% stmt/func/line, ~99% branch (only miss: the UMD env-detection line, not decision logic) |

**State is a first-class assertion, not just the three enables.** `EV` and
`REGENB` both map to `{Mot:1, Gen:0, ICE:0}`, so an outputs-only diff would mask
an `EV`↔`REGENB` divergence until a later step. This mirrors improvement **(d)
State equivalence** in `equivalence_live/`, but is free here because C and JS
both expose `current_mode` as a plain `Mode_t` integer.

Because both sides quantize identically (`to_u16`/`to_s16` == `toU16`/`toS16`),
there is **no half-LSB band** on the JS↔C axis: every row, including
`kind=subLSB`, matches exactly.

## Reuse of `verification/equivalence_live/` (not modified)

| Reused (read/executed only) | Role here |
|---|---|
| `gen_boundary_stimulus.py` → `boundary_stimulus.csv` | The deterministic ±1 LSB stimulus (physical + fixed-point columns + `exp_mode_c`). |
| `mode_probe.c` | The compiled-C oracle: inits once, steps the real `mode_logic_team.c`, prints `mode,Mot,Gen,ICE` per row. |
| `mcdc_mapping.csv` | The 14 modelled decisions (chart ↔ C ↔ now JS). |

## How to run

```bash
npm ci            # once
npm run verify    # regenerate stimulus → compile oracle → differential + MC/DC
npm run coverage  # c8 branch coverage of mode_logic.js
# or: npm test    # verify + coverage
```

`verify.js` is a cross-platform Node orchestrator (Windows dev + Linux CI): it
runs the Python generator, compiles `mode_probe.c` + `src/mode_logic_team.c`
with `gcc`/`cc`, runs the oracle, then runs the two JS checks. It needs
`node`, `python3`, and `gcc` on `PATH`.

## Files

| File | Role |
|---|---|
| `run_js_equivalence.js` | The differential harness (state + outputs vs compiled C and vs the mirror). |
| `mcdc_independence_pairs.js` | MC/DC independence check derived from the boundary probe groups + `mcdc_mapping.csv`. |
| `run_coverage.js` | Coverage driver (run under c8) — replays the stimulus + the defensive/full-API paths. |
| `verify.js` | One-shot orchestrator wired to `npm run verify`. |

## Scope / honesty

This is **web-simulator ↔ hand-code equivalence** on the shared fixed-point
grid. It is not code-generator back-to-back and gives no tool-qualification
credit. The authoritative gates remain the Unity suite, the native C MC/DC
(`gcov-14 --conditions`), and the Simulink↔C / live-oracle equivalence in
`equivalence_live/`. This harness makes the previously hand-asserted
"web simulator matches the C" claim **reproducible and CI-gated**.
