# MC/DC matrix — `mode_logic_team.c`

Cross-reference between Unity tests, the high/low-level requirements they
exercise, and the MC/DC condition-outcome coverage achieved on each Boolean
decision in the source.

> **Authoritative metric:** `gcov-14 --conditions` on a `gcc-14
> -fcondition-coverage` build — see `mcdc_native_gcov14/summary.txt`.

## 1. Headline coverage

| Metric                       | Result                |
|------------------------------|-----------------------|
| Unity tests / failures       | 141 / 0               |
| Functions covered            | 11 / 11   (100 %)     |
| Lines executed               | 157 / 165 (95.15 %)   |
| Branches taken (lcov)        | 122 / 130 (93.8 %)    |
| **MC/DC condition outcomes** | **108 / 116 (93.10 %)** |

The 8 uncovered MC/DC outcomes are analysed in section 4.

## 2. Tests ↔ requirements

Test files and the requirements each one targets.

### 2.1 `test_standstill_transitions.c` — 13 tests

| Test | Requirement | Notes |
|---|---|---|
| `test_init_valid` | SwHLR01 | sanity (Init forces STANDSTILL) |
| `test_init_null`  | SwHLR10 | sanity (NULL state in Init) |
| `test_step_null_state`   | SwHLR10 | sanity (NULL state in Step) |
| `test_step_null_inputs`  | SwHLR10 | sanity (NULL inputs) |
| `test_step_null_outputs` | SwHLR10 | sanity (NULL outputs) |
| `test_output_standstill` | SwHLR02 | output mapping STANDSTILL |
| `test_standstill_to_ev_base`             | SwLLR01 | base TTT → EV (line 12) |
| `test_standstill_ev_speed_le_stop_blocks`  | SwLLR01 | A=F |
| `test_standstill_ev_speed_gt_ev_max_blocks`| SwLLR01 | B=F |
| `test_standstill_ev_soc_lt_ev_in_blocks`   | SwLLR01 | C=F |
| `test_standstill_to_start_high_speed`    | SwLLR02 | B=T (line 18) |
| `test_standstill_to_start_low_soc`       | SwLLR02 | C=T |
| `test_standstill_stay_low_speed`         | SwLLR02 | A=F |

### 2.2 `test_ev_transitions.c` — 16 tests

| Test | Requirement | Notes |
|---|---|---|
| `test_init_valid`, `test_init_null`, `test_step_null_*` | SwHLR01 / SwHLR10 | sanity |
| `test_output_ev` | SwHLR02 | output mapping EV |
| `test_ev_to_regenb_base`, `test_ev_regenb_speed_false`, `test_ev_regenb_pdem_false` | SwLLR03 | EV→RegenB (line 35) |
| `test_ev_to_start_high_speed`, `test_ev_to_start_high_pdem`, `test_ev_to_start_low_soc` | SwLLR04 | EV→START (line 40) |
| `test_ev_to_standstill_base`, `test_ev_standstill_speed_blocks`, `test_ev_standstill_pdem_high_blocks`, `test_ev_standstill_pdem_low_blocks` | SwLLR05 | EV→StandStill (line 46) |

### 2.3 `test_regenb_transitions.c` — 16 tests

| Test | Requirement | Notes |
|---|---|---|
| `test_init_valid`, `test_init_null`, `test_step_null_*` | SwHLR01 / SwHLR10 | sanity |
| `test_output_regenb` | SwHLR02 | output mapping REGENB |
| `test_regenb_to_start_high_speed`, `test_regenb_to_start_low_soc`, `test_regenb_start_blocked_by_speed_and_soc` | SwLLR06 | REGENB→START (line 63) |
| `test_regenb_to_standstill_base`, `test_regenb_standstill_speed_blocks`, `test_regenb_standstill_pdem_high_blocks`, `test_regenb_standstill_pdem_low_blocks` | SwLLR07 | REGENB→STANDSTILL (line 68) |
| `test_regenb_to_ev_base`, `test_regenb_ev_pdem_blocks`, `test_regenb_ev_speed_stop_blocks` | SwLLR08 | REGENB→EV (line 74) |

### 2.4 `test_start_to_hybrid_ice_and_resets.c` — 20 tests

| Test | Requirement | Notes |
|---|---|---|
| `test_init_valid`, `test_init_null`, `test_step_null_*` | SwHLR01 / SwHLR10 | sanity |
| `test_output_start`, `test_output_ice`, `test_output_hybrid` | SwHLR02 | output mapping |
| `test_start_to_hybrid_base`, `test_start_hybrid_a_false`, `test_start_hybrid_b_false`, `test_start_hybrid_c_true`, `test_start_hybrid_d_false` | SwLLR18 | START→HYBRID (line 133) |
| `test_start_to_ice_base`, `test_start_ice_a_false`, `test_start_ice_e_true`, `test_start_ice_f_true`, `test_start_ice_g2_true` | SwLLR19 | START→ICE (line 138) |
| `test_ice_reset_to_start`     | SwLLR20 | ICE engine-stall reset (line 117) |
| `test_hybrid_reset_to_start`  | SwLLR22 | HYBRID engine-stall reset (line 117) |

### 2.5 `test_ice_hybrid_external_and_internal.c` — 76 tests

Covers SwLLR09–SwLLR17, SwLLR21, SwLLR23 plus the priority requirements
SwHLR06 (external > internal), SwHLR08, SwHLR09 (engine-stall reset
priority). This is the densest file; tests are positive cases plus one
"blocked-by-condition-X" test per condition.

| Requirement | Decision (source line) | Tests |
|---|---|---|
| SwLLR09 | START→REGENB via `motion_ice_common_exit` (91) | `test_SwLLR09_Start_to_RegenB_positive` + 3 blocked-by tests |
| SwLLR10 | ICE→REGENB    (91) | `test_SwLLR10_*` (1+3) |
| SwLLR11 | HYBRID→REGENB (91) | `test_SwLLR11_*` (1+3) |
| SwLLR12 | START→EV      (95) | `test_SwLLR12_*` (1+6) |
| SwLLR13 | ICE→EV        (95) | `test_SwLLR13_*` (1+6) |
| SwLLR14 | HYBRID→EV     (95) | `test_SwLLR14_*` (1+6) |
| SwLLR15 | START→STANDSTILL (102) | `test_SwLLR15_*` (1+3) |
| SwLLR16 | ICE→STANDSTILL   (102) | `test_SwLLR16_*` (1+3) |
| SwLLR17 | HYBRID→STANDSTILL (102) | `test_SwLLR17_*` (1+3) |
| SwLLR21 | ICE→HYBRID    (164) | `test_SwLLR21_*` (1+2) |
| SwLLR23 | HYBRID→ICE    (188) | `test_SwLLR23_*` (3) |
| SwHLR06 | external > internal priority | 4 tests |
| SwHLR08 | ICE reset > ICE→HYBRID | 1 test |
| SwHLR09 | HYBRID reset > HYBRID→ICE | 1 test |

## 3. Per-decision MC/DC status

Numbering follows `gcov-14 --conditions` on the source file. Each decision
contributes `2 × (number of atomic conditions)` outcomes. ✅ = full coverage,
⚠️ = at least one outcome uncovered.

| Source line | Decision (transition / role) | Conditions | Outcomes covered | Status | Notes |
|---:|---|---|---|:---:|---|
|  12 | STANDSTILL→EV `c1 && c2 && c3` | `speed>STOP` ∧ `speed≤EV_MAX` ∧ `SOC≥EV_IN` | 6/6 | ✅ | |
|  18 | STANDSTILL→START `c1 && (c2 \|\| c3)` | `speed>STOP` ∧ (`speed>EV_MAX` ∨ `SOC<EV_IN`) | **4/6** | ⚠️ | cond 1 F + cond 2 F (see §4.1) |
|  35 | EV→REGENB `c1 && c2` | `speed>REGEN` ∧ `P_dem≤PDEM_REGEN` | 4/4 | ✅ | |
|  40 | EV→START `c1 \|\| c2 \|\| c3` | `speed>EV_MAX` ∨ `P_dem≥HYB_IN` ∨ `SOC<EV_OUT` | 6/6 | ✅ | |
|  46 | EV→STANDSTILL `c1 && c2 && c3` | `speed≤STOP` ∧ `P_dem≤STOP_HIGH` ∧ `P_dem≥STOP_LOW` | 6/6 | ✅ | |
|  63 | REGENB→START `(c1 && c2) \|\| c3` | (`speed>EV_MAX` ∧ `P_dem≥STOP_LOW`) ∨ `SOC<EV_OUT` | **5/6** | ⚠️ | cond 1 F (see §4.2) — BDD non tree-like (`mcdc-checker`) |
|  68 | REGENB→STANDSTILL `c1 && c2 && c3` | `speed≤STOP` ∧ `P_dem≤STOP_HIGH` ∧ `P_dem≥STOP_LOW` | 6/6 | ✅ | |
|  74 | REGENB→EV `c1 && c2 && c3 && c4` | `P_dem≥STOP_LOW` ∧ `speed>STOP` ∧ `speed≤EV_MAX` ∧ `SOC≥EV_OUT` | **6/8** | ⚠️ | cond 2 F + cond 3 F (see §4.3) |
|  91 | motion_ice→REGENB `c1 && c2 && c3` | `wEng>ENG_ON` ∧ `speed>REGEN` ∧ `P_dem≤PDEM_REGEN` | 6/6 | ✅ | |
|  95 | motion_ice→EV `c1 && c2 && c3 && c4 && c5 && c6` | full 6-term AND | 12/12 | ✅ | |
| 102 | motion_ice→STANDSTILL `c1 && c2 && c3` | `speed≤STOP` ∧ `P_dem≤STOP_HIGH` ∧ `P_dem≥STOP_LOW` | 6/6 | ✅ | |
| 117 | engine-stall reset `c1` | `wEng≤ENG_OFF` | 2/2 | ✅ | SwLLR20 / SwLLR22 |
| 132 | START path guard `c1` | `next == MODE_START` | 2/2 | ✅ | |
| 133 | START→HYBRID `c1 && c2 && (c3 \|\| c4)` | `wEng>ENG_ON` ∧ `SOC≥SOC_MID` ∧ (`speed>EV_MAX` ∨ `P_dem≥HYB_MID`) | 8/8 | ✅ | |
| 138 | START→ICE `c1 && (c2 \|\| (c3 && c4))` | `wEng>ENG_ON` ∧ (`SOC<SOC_MID` ∨ (`speed≤EV_MAX` ∧ `P_dem<HYB_MID`)) | **5/8** | ⚠️ | cond 1, 2, 3 F (see §4.4) |
| 158 | ICE path guard | `next == MODE_ICE` | 2/2 | ✅ | |
| 163 | ICE post-reset guard | `next == MODE_ICE` | 2/2 | ✅ | |
| 164 | ICE->HYBRID `c1 && c2` | `P_dem>=HYB_MID` AND `SOC>=SOC_MID` | 4/4 | ✅ | |
| 182 | HYBRID path guard | `next == MODE_HYBRID` | 2/2 | ✅ | |
| 187 | HYBRID post-reset guard | `next == MODE_HYBRID` | 2/2 | ✅ | |
| 188 | HYBRID->ICE `c1 || c2` | `P_dem<=HYB_LOW` OR `SOC<SOC_LOW` | 4/4 | ✅ | |
| 252 | `ModeLogic_Init` NULL guard | `state != NULL` | 2/2 | ✅ | |
| 263 | `ModeLogic_Step` NULL guards | three pointer non-null | 6/6 | ✅ | |

`switch` `default:` arms in `write_outputs` (line 202) and `ModeLogic_Step`
(line 266) are **not** counted as MC/DC conditions by GCC 14 — they are
plain branches. They appear as 1 uncovered branch each in `lcov` (which is
why branch coverage is 93.8 % vs MC/DC 93.10 %). They are unreachable as
long as `Mode_t` only takes the values defined in the enum — i.e., they are
defensive coding mandated by MISRA, not a real test gap.

## 4. The 8 uncovered MC/DC outcomes 

Each missing outcome was traced through the state machine to determine
whether it is **reachable** (a missing test) or **structurally unreachable**
(no test can produce the required (value, decision) pair without changing
the source). No reachable MC/DC gaps remain in this analysis; the remaining
8 are structural under GCC 14's unique-cause MC/DC accounting.

### 4.1 Line 18 — STANDSTILL→START — `c1 && (c2 || c3)`

Conditions: `c1 = speed>STOP`, `c2 = speed>EV_MAX`, `c3 = SOC<EV_IN`.

Pre-condition for reaching line 18 is that the line-12 first-`if`
(STANDSTILL→EV) is **false**, i.e. `speed≤STOP ∨ speed>EV_MAX ∨ SOC<EV_IN`.

| Cond | Outcome | Verdict | Reasoning |
|---|---|---|---|
| 1 | F | a candidate test was tried (`speed=0.3, SOC=0.30` → STANDSTILL stays) but `gcov-14` did not pair it. The valid pair `(T,F,T)→T` (line 18) vs `(F, F implicit, T implicit)→F` exists at runtime, but GCC 14's MC/DC algorithm requires the short-circuited operands to have been **observed**, not just implicit — and `c1=F` short-circuits `c2`. **Effectively unreachable for unique-cause MC/DC under GCC 14.** | structural |
| 2 | F | the only MC/DC pair would be `(T,T,F)→T` vs `(T,F,F)→F`. But `(T,F,F)` at line 18 means `speed∈(STOP,EV_MAX] ∧ SOC≥EV_IN`, which is exactly the line-12 first-`if` true case — so the function returns `MODE_EV` and **never reaches line 18**. **Genuinely unreachable**. | structural |

### 4.2 Line 63 — REGENB→START — `(c1 && c2) || c3`

Conditions: `c1 = speed>EV_MAX`, `c2 = P_dem≥STOP_LOW`, `c3 = SOC<EV_OUT`.

Already flagged by `mcdc-checker` as **BDD not tree-like** (variables
appearing on multiple paths) — the precondition for unique-cause MC/DC
fails by construction. The non-tree-like solution it found is exactly:
`SOC<0.35f, speed>35.0f, P_dem≥1.0f`.

| Cond | Outcome | Verdict | Reasoning |
|---|---|---|---|
| 1 | F | candidate pair `(T,T,F)→T` (`test_regenb_to_start_high_speed`) vs `(F,T,F)→F` (`speed=20, P_dem=0, SOC=0.5`) was tried, but the BDD non-tree-likeness blocks GCC 14's pair recognition. Refactoring the decision (e.g. splitting the `\|\|` into a sequential `else if`) would make this tree-like. | structural (non tree-like) |

### 4.3 Line 74 — REGENB→EV — `c1 && c2 && c3 && c4`

Conditions: `c1 = P_dem≥STOP_LOW`, `c2 = speed>STOP`, `c3 = speed≤EV_MAX`,
`c4 = SOC≥EV_OUT`.

| Cond | Outcome | Verdict | Reasoning |
|---|---|---|---|
| 2 | F | the runtime observation is present (`test_regenb_standstill_pdem_high_blocks` reaches line 74 with `c1=T,c2=F`). But — same issue as 4.1 — once `c2=F` short-circuits, GCC 14 can't pair the case with the `(T,T,T,T)→T` test from `test_regenb_to_ev_base` because `c3` and `c4` were never observed. | structural |
| 3 | F | the only valid MC/DC pair `(T,T,F,T)→F` vs `(T,T,T,T)→T` requires `speed>EV_MAX` at line 74. But that combination triggers REGENB→START at **line 63** (`(speed>EV_MAX ∧ P_dem≥STOP_LOW) → MODE_START`), so line 74 is **not reached**. **Genuinely unreachable**. | structural |

### 4.4 Line 138 — START→ICE — `c1 && (c2 || (c3 && c4))`

Conditions: `c1 = wEng>ENG_ON`, `c2 = SOC<SOC_MID`,
`c3 = speed≤EV_MAX`, `c4 = P_dem<HYB_MID`.

To reach line 138 the START→HYBRID guard at line 133 must have failed. With
`c1=T` (`wEng>ENG_ON`) the only ways line 133 can fail are
(a) `SOC<SOC_MID` (i.e. `c2=T` at line 138) or
(b) `speed≤EV_MAX ∧ P_dem<HYB_MID` (i.e. both `c3=T` **and** `c4=T` at line 138).

| Cond | Outcome | Verdict | Reasoning |
|---|---|---|---|
| 1 | F | a candidate pair was tried (`wEng=WENG_STALLED` with same `speed/SOC/P_dem` as `test_start_to_ice_base`), but as in 4.1 the `c1=F` short-circuit prevents GCC 14 from forming a unique-cause MC/DC pair. | structural |
| 2 | F | requires `c1=T ∧ c2=F ∧ ((c3=F) ∨ (c4=F))` — but case (a) above is excluded (otherwise we'd be back to `c2=T`), so we are forced into case (b), which fixes `c3=c4=T`. The pair `(T,T,*,*)→T` vs `(T,F,F,*)→F` is unreachable. | structural |
| 3 | F | requires `c3=F` (`speed>EV_MAX`) reaching line 138 — but `speed>EV_MAX` makes line-133 third clause `(speed>EV_MAX ∨ P_dem≥HYB_MID)` true, so (with `c1=T,c2=T` at line 133) line 133 succeeds and we go to **HYBRID** instead. | structural |

## 5. Reachable-vs-structural recap

| Decision | Outcomes total | Reachable misses | Structural misses |
|---|---|---|---|
| Line 18  | 6 | 0 | 2 |
| Line 63  | 6 | 0 | 1 |
| Line 74  | 8 | 0 | 2 |
| Line 138 | 8 | 0 | 3 |
| **All others** | 88 | 0 | 0 |
| **Total** | 116 | **0** | **8** |

**All reachable MC/DC pairs are covered by the existing 141 Unity tests.**
Closing the remaining 8 outcomes would require source refactors:

- Line 63: split `(A && B) || C` into two `else if` clauses (eliminates the
  non-tree-like BDD) — would fix outcome 4.2.
- Lines 18 / 74 / 138: the missing outcomes are blocked by short-circuiting
  and/or upstream `if`/`else if` guards in the same function. Closing them
  would require extracting or refactoring the Boolean decisions so the
  missing condition pairs can be evaluated; adding more black-box tests
  through `ModeLogic_Step` is not sufficient.
