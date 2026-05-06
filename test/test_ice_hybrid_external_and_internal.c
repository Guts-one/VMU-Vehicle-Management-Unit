/* ============================================================
 * test_person_e_gustavo.c
 * Responsible: Gustavo (Person E)
 * Requirements: SwLLR09..17,21,23 + priority tests SwHLR06/08/09
 * ============================================================ */

#include "unity.h"
#include "mode_logic_team.h"

/* ---------------------- fixtures ----------------------------------------- */

static State_t   g_state;
static Outputs_t g_out;

void setUp(void) {
    ModeLogic_Init(&g_state);
    g_out.Mot_Enable = 0U;
    g_out.Gen_Enable = 0U;
    g_out.ICE_Enable = 0U;
}

void tearDown(void) {}

static Mode_t step_from(Mode_t start_mode, Inputs_t in) {
    g_state.current_mode = start_mode;
    ModeLogic_Step(&g_state, &in, &g_out);
    return g_state.current_mode;
}

static Inputs_t make_inputs(float speed, float P_dem, float SOC, float wEng) {
    Inputs_t in;
    in.speed = speed;
    in.P_dem = P_dem;
    in.SOC   = SOC;
    in.wEng  = wEng;
    return in;
}

/* ========================================================================= *
 *  Sanity
 * ========================================================================= */

// SwHLR01 - Sanity
void test_ModeLogic_Init_sets_standstill(void) {
    State_t s;
    s.current_mode = MODE_HYBRID;
    ModeLogic_Init(&s);
    TEST_ASSERT_EQUAL_INT(MODE_STANDSTILL, s.current_mode);
}

// SwHLR10 - Sanity (NULL init)
void test_ModeLogic_Init_tolerates_null(void) {
    ModeLogic_Init(NULL);
    TEST_PASS();
}

// SwHLR10 - Sanity (NULL args)
void test_ModeLogic_Step_tolerates_null_args(void) {
    State_t  s; s.current_mode = MODE_ICE;
    Inputs_t in = make_inputs(10.0f, 20.0f, 0.5f, 900.0f);
    Outputs_t out = {0};

    ModeLogic_Step(NULL, &in, &out);
    ModeLogic_Step(&s,   NULL, &out);
    ModeLogic_Step(&s,   &in,  NULL);

    TEST_ASSERT_EQUAL_INT(MODE_ICE, s.current_mode);
}

/* ========================================================================= *
 *  SwLLR09 - Start -> RegenB
 * ========================================================================= */

// SwLLR09 - MC/DC (positive TTT)
void test_SwLLR09_Start_to_RegenB_positive(void) {
    Inputs_t in = make_inputs(10.0f, -10.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_START, in);
    TEST_ASSERT_EQUAL_INT(MODE_REGENB, next);
}

// SwLLR09 - MC/DC (A=F: wEng <= ENG_ON)
void test_SwLLR09_Start_blocked_by_wEng_not_over_ENG_ON(void) {
    Inputs_t in = make_inputs(10.0f, -10.0f, 0.5f, 800.0f);
    Mode_t next = step_from(MODE_START, in);
    TEST_ASSERT_NOT_EQUAL(MODE_REGENB, next);
}

// SwLLR09 - MC/DC (B=F: speed <= SPEED_REGEN)
void test_SwLLR09_Start_blocked_by_speed_not_over_SPEED_REGEN(void) {
    Inputs_t in = make_inputs(5.0f, -10.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_START, in);
    TEST_ASSERT_NOT_EQUAL(MODE_REGENB, next);
}

// SwLLR09 - MC/DC (C=F: P_dem > PDEM_REGEN)
void test_SwLLR09_Start_blocked_by_P_dem_not_under_PDEM_REGEN(void) {
    Inputs_t in = make_inputs(10.0f, -4.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_START, in);
    TEST_ASSERT_NOT_EQUAL(MODE_REGENB, next);
}

/* ========================================================================= *
 *  SwLLR10 - ICE -> RegenB
 * ========================================================================= */

// SwLLR10 - MC/DC (positive TTT)
void test_SwLLR10_ICE_to_RegenB_positive(void) {
    Inputs_t in = make_inputs(10.0f, -10.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_EQUAL_INT(MODE_REGENB, next);
}

// SwLLR10 - MC/DC (A=F)
void test_SwLLR10_ICE_blocked_by_wEng(void) {
    Inputs_t in = make_inputs(10.0f, -10.0f, 0.5f, 800.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_NOT_EQUAL(MODE_REGENB, next);
}

// SwLLR10 - MC/DC (B=F)
void test_SwLLR10_ICE_blocked_by_speed(void) {
    Inputs_t in = make_inputs(5.0f, -10.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_NOT_EQUAL(MODE_REGENB, next);
}

// SwLLR10 - MC/DC (C=F)
void test_SwLLR10_ICE_blocked_by_P_dem(void) {
    Inputs_t in = make_inputs(10.0f, -4.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_NOT_EQUAL(MODE_REGENB, next);
}

/* ========================================================================= *
 *  SwLLR11 - Hybrid -> RegenB
 * ========================================================================= */

// SwLLR11 - MC/DC (positive TTT)
void test_SwLLR11_Hybrid_to_RegenB_positive(void) {
    Inputs_t in = make_inputs(10.0f, -10.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_EQUAL_INT(MODE_REGENB, next);
}

// SwLLR11 - MC/DC (A=F)
void test_SwLLR11_Hybrid_blocked_by_wEng(void) {
    Inputs_t in = make_inputs(10.0f, -10.0f, 0.5f, 800.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_NOT_EQUAL(MODE_REGENB, next);
}

// SwLLR11 - MC/DC (B=F)
void test_SwLLR11_Hybrid_blocked_by_speed(void) {
    Inputs_t in = make_inputs(5.0f, -10.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_NOT_EQUAL(MODE_REGENB, next);
}

// SwLLR11 - MC/DC (C=F)
void test_SwLLR11_Hybrid_blocked_by_P_dem(void) {
    Inputs_t in = make_inputs(10.0f, -4.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_NOT_EQUAL(MODE_REGENB, next);
}

/* ========================================================================= *
 *  SwLLR12 - Start -> EV
 * ========================================================================= */

// SwLLR12 - MC/DC (positive TTTTTT)
void test_SwLLR12_Start_to_EV_positive(void) {
    Inputs_t in = make_inputs(20.0f, 10.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_START, in);
    TEST_ASSERT_EQUAL_INT(MODE_EV, next);
}

// SwLLR12 - MC/DC (A=F)
void test_SwLLR12_Start_EV_blocked_by_wEng(void) {
    Inputs_t in = make_inputs(20.0f, 10.0f, 0.5f, 800.0f);
    Mode_t next = step_from(MODE_START, in);
    TEST_ASSERT_NOT_EQUAL(MODE_EV, next);
}

// SwLLR12 - MC/DC (B=F: P_dem > PDEM_HYB_OUT)
void test_SwLLR12_Start_EV_blocked_by_P_dem_over_HYB_OUT(void) {
    Inputs_t in = make_inputs(20.0f, 45.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_START, in);
    TEST_ASSERT_NOT_EQUAL(MODE_EV, next);
}

// SwLLR12 - MC/DC (C=F: P_dem < PDEM_STOP_LOW)
void test_SwLLR12_Start_EV_blocked_by_P_dem_under_STOP_LOW(void) {
    Inputs_t in = make_inputs(20.0f, -3.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_START, in);
    TEST_ASSERT_NOT_EQUAL(MODE_EV, next);
}

// SwLLR12 - MC/DC (D=F: speed <= SPEED_STOP)
void test_SwLLR12_Start_EV_blocked_by_speed_not_over_SPEED_STOP(void) {
    Inputs_t in = make_inputs(0.3f, 10.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_START, in);
    TEST_ASSERT_NOT_EQUAL(MODE_EV, next);
}

// SwLLR12 - MC/DC (E=F: speed > SPEED_EV_MAX)
void test_SwLLR12_Start_EV_blocked_by_speed_over_SPEED_EV_MAX(void) {
    Inputs_t in = make_inputs(40.0f, 10.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_START, in);
    TEST_ASSERT_NOT_EQUAL(MODE_EV, next);
}

// SwLLR12 - MC/DC (F=F: SOC < SOC_EV_IN)
void test_SwLLR12_Start_EV_blocked_by_SOC_under_SOC_EV_IN(void) {
    Inputs_t in = make_inputs(20.0f, 10.0f, 0.36f, 900.0f);
    Mode_t next = step_from(MODE_START, in);
    TEST_ASSERT_NOT_EQUAL(MODE_EV, next);
}

/* ========================================================================= *
 *  SwLLR13 - ICE -> EV
 * ========================================================================= */

// SwLLR13 - MC/DC (positive TTTTTT)
void test_SwLLR13_ICE_to_EV_positive(void) {
    Inputs_t in = make_inputs(20.0f, 10.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_EQUAL_INT(MODE_EV, next);
}

// SwLLR13 - MC/DC (A=F)
void test_SwLLR13_ICE_EV_blocked_by_wEng(void) {
    Inputs_t in = make_inputs(20.0f, 10.0f, 0.5f, 800.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_NOT_EQUAL(MODE_EV, next);
}

// SwLLR13 - MC/DC (B=F)
void test_SwLLR13_ICE_EV_blocked_by_P_dem_over_HYB_OUT(void) {
    Inputs_t in = make_inputs(20.0f, 45.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_NOT_EQUAL(MODE_EV, next);
}

// SwLLR13 - MC/DC (C=F)
void test_SwLLR13_ICE_EV_blocked_by_P_dem_under_STOP_LOW(void) {
    Inputs_t in = make_inputs(20.0f, -3.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_NOT_EQUAL(MODE_EV, next);
}

// SwLLR13 - MC/DC (D=F)
void test_SwLLR13_ICE_EV_blocked_by_speed_not_over_SPEED_STOP(void) {
    Inputs_t in = make_inputs(0.3f, 10.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_NOT_EQUAL(MODE_EV, next);
}

// SwLLR13 - MC/DC (E=F)
void test_SwLLR13_ICE_EV_blocked_by_speed_over_SPEED_EV_MAX(void) {
    Inputs_t in = make_inputs(40.0f, 10.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_NOT_EQUAL(MODE_EV, next);
}

// SwLLR13 - MC/DC (F=F)
void test_SwLLR13_ICE_EV_blocked_by_SOC_under_SOC_EV_IN(void) {
    Inputs_t in = make_inputs(20.0f, 10.0f, 0.36f, 900.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_NOT_EQUAL(MODE_EV, next);
}

/* ========================================================================= *
 *  SwLLR14 - Hybrid -> EV
 * ========================================================================= */

// SwLLR14 - MC/DC (positive TTTTTT)
void test_SwLLR14_Hybrid_to_EV_positive(void) {
    Inputs_t in = make_inputs(20.0f, 10.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_EQUAL_INT(MODE_EV, next);
}

// SwLLR14 - MC/DC (A=F)
void test_SwLLR14_Hybrid_EV_blocked_by_wEng(void) {
    Inputs_t in = make_inputs(20.0f, 10.0f, 0.5f, 800.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_NOT_EQUAL(MODE_EV, next);
}

// SwLLR14 - MC/DC (B=F)
void test_SwLLR14_Hybrid_EV_blocked_by_P_dem_over_HYB_OUT(void) {
    Inputs_t in = make_inputs(20.0f, 45.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_NOT_EQUAL(MODE_EV, next);
}

// SwLLR14 - MC/DC (C=F)
void test_SwLLR14_Hybrid_EV_blocked_by_P_dem_under_STOP_LOW(void) {
    Inputs_t in = make_inputs(20.0f, -3.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_NOT_EQUAL(MODE_EV, next);
}

// SwLLR14 - MC/DC (D=F)
void test_SwLLR14_Hybrid_EV_blocked_by_speed_not_over_SPEED_STOP(void) {
    Inputs_t in = make_inputs(0.3f, 10.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_NOT_EQUAL(MODE_EV, next);
}

// SwLLR14 - MC/DC (E=F)
void test_SwLLR14_Hybrid_EV_blocked_by_speed_over_SPEED_EV_MAX(void) {
    Inputs_t in = make_inputs(40.0f, 10.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_NOT_EQUAL(MODE_EV, next);
}

// SwLLR14 - MC/DC (F=F)
void test_SwLLR14_Hybrid_EV_blocked_by_SOC_under_SOC_EV_IN(void) {
    Inputs_t in = make_inputs(20.0f, 10.0f, 0.36f, 900.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_NOT_EQUAL(MODE_EV, next);
}

/* ========================================================================= *
 *  SwLLR15 - Start -> StandStill
 * ========================================================================= */

// SwLLR15 - MC/DC (positive TTT)
void test_SwLLR15_Start_to_StandStill_positive(void) {
    Inputs_t in = make_inputs(0.3f, 0.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_START, in);
    TEST_ASSERT_EQUAL_INT(MODE_STANDSTILL, next);
}

// SwLLR15 - MC/DC (A=F)
void test_SwLLR15_Start_StandStill_blocked_by_speed_over_SPEED_STOP(void) {
    Inputs_t in = make_inputs(1.0f, 0.0f, 0.5f, 800.0f);
    Mode_t next = step_from(MODE_START, in);
    TEST_ASSERT_NOT_EQUAL(MODE_STANDSTILL, next);
}

// SwLLR15 - MC/DC (B=F)
void test_SwLLR15_Start_StandStill_blocked_by_P_dem_over_STOP_HIGH(void) {
    Inputs_t in = make_inputs(0.3f, 2.0f, 0.5f, 800.0f);
    Mode_t next = step_from(MODE_START, in);
    TEST_ASSERT_NOT_EQUAL(MODE_STANDSTILL, next);
}

// SwLLR15 - MC/DC (C=F)
void test_SwLLR15_Start_StandStill_blocked_by_P_dem_under_STOP_LOW(void) {
    Inputs_t in = make_inputs(0.3f, -2.0f, 0.5f, 800.0f);
    Mode_t next = step_from(MODE_START, in);
    TEST_ASSERT_NOT_EQUAL(MODE_STANDSTILL, next);
}

/* ========================================================================= *
 *  SwLLR16 - ICE -> StandStill
 * ========================================================================= */

// SwLLR16 - MC/DC (positive TTT)
void test_SwLLR16_ICE_to_StandStill_positive(void) {
    Inputs_t in = make_inputs(0.3f, 0.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_EQUAL_INT(MODE_STANDSTILL, next);
}

// SwLLR16 - MC/DC (A=F)
void test_SwLLR16_ICE_StandStill_blocked_by_speed_over_SPEED_STOP(void) {
    Inputs_t in = make_inputs(1.0f, 0.0f, 0.5f, 800.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_NOT_EQUAL(MODE_STANDSTILL, next);
}

// SwLLR16 - MC/DC (B=F)
void test_SwLLR16_ICE_StandStill_blocked_by_P_dem_over_STOP_HIGH(void) {
    Inputs_t in = make_inputs(0.3f, 2.0f, 0.5f, 800.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_NOT_EQUAL(MODE_STANDSTILL, next);
}

// SwLLR16 - MC/DC (C=F)
void test_SwLLR16_ICE_StandStill_blocked_by_P_dem_under_STOP_LOW(void) {
    Inputs_t in = make_inputs(0.3f, -2.0f, 0.5f, 800.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_NOT_EQUAL(MODE_STANDSTILL, next);
}

/* ========================================================================= *
 *  SwLLR17 - Hybrid -> StandStill
 * ========================================================================= */

// SwLLR17 - MC/DC (positive TTT)
void test_SwLLR17_Hybrid_to_StandStill_positive(void) {
    Inputs_t in = make_inputs(0.3f, 0.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_EQUAL_INT(MODE_STANDSTILL, next);
}

// SwLLR17 - MC/DC (A=F)
void test_SwLLR17_Hybrid_StandStill_blocked_by_speed_over_SPEED_STOP(void) {
    Inputs_t in = make_inputs(1.0f, 0.0f, 0.5f, 800.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_NOT_EQUAL(MODE_STANDSTILL, next);
}

// SwLLR17 - MC/DC (B=F)
void test_SwLLR17_Hybrid_StandStill_blocked_by_P_dem_over_STOP_HIGH(void) {
    Inputs_t in = make_inputs(0.3f, 2.0f, 0.5f, 800.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_NOT_EQUAL(MODE_STANDSTILL, next);
}

// SwLLR17 - MC/DC (C=F)
void test_SwLLR17_Hybrid_StandStill_blocked_by_P_dem_under_STOP_LOW(void) {
    Inputs_t in = make_inputs(0.3f, -2.0f, 0.5f, 800.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_NOT_EQUAL(MODE_STANDSTILL, next);
}

/* ========================================================================= *
 *  SwLLR21 - ICE -> Hybrid
 * ========================================================================= */

// SwLLR21 - MC/DC (positive TT)
void test_SwLLR21_ICE_to_Hybrid_positive(void) {
    Inputs_t in = make_inputs(40.0f, 20.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_EQUAL_INT(MODE_HYBRID, next);
}

// SwLLR21 - MC/DC (A=F)
void test_SwLLR21_ICE_Hybrid_blocked_by_P_dem_under_HYB_MID(void) {
    Inputs_t in = make_inputs(40.0f, 12.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_EQUAL_INT(MODE_ICE, next);
}

// SwLLR21 - MC/DC (B=F)
void test_SwLLR21_ICE_Hybrid_blocked_by_SOC_under_SOC_MID(void) {
    Inputs_t in = make_inputs(40.0f, 20.0f, 0.29f, 900.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_EQUAL_INT(MODE_ICE, next);
}

/* ========================================================================= *
 *  SwLLR23 - Hybrid -> ICE
 * ========================================================================= */

// SwLLR23 - MC/DC (TF: low P_dem)
void test_SwLLR23_Hybrid_to_ICE_positive_low_P_dem(void) {
    Inputs_t in = make_inputs(40.0f, 5.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_EQUAL_INT(MODE_ICE, next);
}

// SwLLR23 - MC/DC (FT: low SOC)
void test_SwLLR23_Hybrid_to_ICE_positive_low_SOC(void) {
    Inputs_t in = make_inputs(40.0f, 20.0f, 0.20f, 900.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_EQUAL_INT(MODE_ICE, next);
}

// SwLLR23 - MC/DC (FF: no transition)
void test_SwLLR23_Hybrid_stays_when_both_conditions_false(void) {
    Inputs_t in = make_inputs(40.0f, 20.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_EQUAL_INT(MODE_HYBRID, next);
}

/* ========================================================================= *
 *  Priority tests SwHLR06, SwHLR08, SwHLR09
 * ========================================================================= */

// SwHLR06 - Priority (external EV beats internal Hybrid)
void test_SwHLR06_ICE_external_EV_beats_internal_Hybrid(void) {
    Inputs_t in = make_inputs(10.0f, 20.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_EQUAL_INT(MODE_EV, next);
}

// SwHLR06 - Priority (external EV beats internal ICE)
void test_SwHLR06_Hybrid_external_EV_beats_internal_ICE(void) {
    Inputs_t in = make_inputs(10.0f, 5.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_EQUAL_INT(MODE_EV, next);
}

// SwHLR06 - Priority (external Regen beats internal Hybrid)
void test_SwHLR06_Start_external_Regen_beats_internal_Hybrid(void) {
    Inputs_t in = make_inputs(40.0f, -10.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_START, in);
    TEST_ASSERT_EQUAL_INT(MODE_REGENB, next);
}

// SwHLR06 - Priority (external StandStill beats internal ICE)
void test_SwHLR06_Hybrid_external_StandStill_beats_internal_ICE(void) {
    Inputs_t in = make_inputs(0.3f, 0.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_EQUAL_INT(MODE_STANDSTILL, next);
}

// SwHLR08 - Priority (reset beats ICE->Hybrid)
void test_SwHLR08_ICE_reset_to_Start_beats_ICE_to_Hybrid(void) {
    Inputs_t in = make_inputs(40.0f, 20.0f, 0.5f, 700.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_EQUAL_INT(MODE_START, next);
}

// SwHLR09 - Priority (reset beats Hybrid->ICE)
void test_SwHLR09_Hybrid_reset_to_Start_beats_Hybrid_to_ICE(void) {
    Inputs_t in = make_inputs(40.0f, 5.0f, 0.5f, 700.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_EQUAL_INT(MODE_START, next);
}

// SwHLR06 - Priority (no external, falls through to internal)
void test_SwHLR06_Start_with_low_SOC_no_external_goes_to_internal(void) {
    Inputs_t in = make_inputs(10.0f, 0.0f, 0.25f, 900.0f);
    Mode_t next = step_from(MODE_START, in);
    TEST_ASSERT_NOT_EQUAL(MODE_REGENB, next);
    TEST_ASSERT_NOT_EQUAL(MODE_EV, next);
    TEST_ASSERT_NOT_EQUAL(MODE_STANDSTILL, next);
}

/* ========================================================================= *
 *  Output mapping for modes touched by Person E
 * ========================================================================= */

// SwHLR02 - Output mapping (RegenB)
void test_outputs_after_transition_to_RegenB(void) {
    Inputs_t in = make_inputs(10.0f, -10.0f, 0.5f, 900.0f);
    (void)step_from(MODE_START, in);
    TEST_ASSERT_EQUAL_UINT8(1U, g_out.Mot_Enable);
    TEST_ASSERT_EQUAL_UINT8(0U, g_out.Gen_Enable);
    TEST_ASSERT_EQUAL_UINT8(0U, g_out.ICE_Enable);
}

// SwHLR02 - Output mapping (EV)
void test_outputs_after_transition_to_EV(void) {
    Inputs_t in = make_inputs(20.0f, 10.0f, 0.5f, 900.0f);
    (void)step_from(MODE_ICE, in);
    TEST_ASSERT_EQUAL_UINT8(1U, g_out.Mot_Enable);
    TEST_ASSERT_EQUAL_UINT8(0U, g_out.Gen_Enable);
    TEST_ASSERT_EQUAL_UINT8(0U, g_out.ICE_Enable);
}

// SwHLR02 - Output mapping (StandStill)
void test_outputs_after_transition_to_StandStill(void) {
    Inputs_t in = make_inputs(0.3f, 0.0f, 0.5f, 900.0f);
    (void)step_from(MODE_HYBRID, in);
    TEST_ASSERT_EQUAL_UINT8(0U, g_out.Mot_Enable);
    TEST_ASSERT_EQUAL_UINT8(0U, g_out.Gen_Enable);
    TEST_ASSERT_EQUAL_UINT8(0U, g_out.ICE_Enable);
}

// SwHLR02 - Output mapping (Hybrid)
void test_outputs_after_transition_to_Hybrid(void) {
    Inputs_t in = make_inputs(40.0f, 20.0f, 0.5f, 900.0f);
    (void)step_from(MODE_ICE, in);
    TEST_ASSERT_EQUAL_UINT8(1U, g_out.Mot_Enable);
    TEST_ASSERT_EQUAL_UINT8(1U, g_out.Gen_Enable);
    TEST_ASSERT_EQUAL_UINT8(1U, g_out.ICE_Enable);
}

// SwHLR02 - Output mapping (ICE)
void test_outputs_after_transition_to_ICE(void) {
    Inputs_t in = make_inputs(40.0f, 5.0f, 0.5f, 900.0f);
    (void)step_from(MODE_HYBRID, in);
    TEST_ASSERT_EQUAL_UINT8(0U, g_out.Mot_Enable);
    TEST_ASSERT_EQUAL_UINT8(1U, g_out.Gen_Enable);
    TEST_ASSERT_EQUAL_UINT8(1U, g_out.ICE_Enable);
}

/* ========================================================================= *
 *  Boundaries (exact thresholds)
 * ========================================================================= */

// Boundary - wEng = ENG_ON blocks Regen (strict >)
void test_boundary_wEng_equal_ENG_ON_blocks_Regen(void) {
    Inputs_t in = make_inputs(10.0f, -10.0f, 0.5f, 800.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_NOT_EQUAL(MODE_REGENB, next);
}

// Boundary - speed = SPEED_REGEN blocks Regen (strict >)
void test_boundary_speed_equal_SPEED_REGEN_blocks_Regen(void) {
    Inputs_t in = make_inputs(5.0f, -10.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_NOT_EQUAL(MODE_REGENB, next);
}

// Boundary - P_dem = PDEM_REGEN allows Regen (<=)
void test_boundary_P_dem_equal_PDEM_REGEN_allows_Regen(void) {
    Inputs_t in = make_inputs(10.0f, -5.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_EQUAL_INT(MODE_REGENB, next);
}

// Boundary - speed = SPEED_EV_MAX allows EV (<=)
void test_boundary_speed_equal_SPEED_EV_MAX_allows_EV(void) {
    Inputs_t in = make_inputs(35.0f, 10.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_EQUAL_INT(MODE_EV, next);
}

// Boundary - speed = SPEED_STOP allows StandStill (<=)
void test_boundary_speed_equal_SPEED_STOP_allows_StandStill(void) {
    Inputs_t in = make_inputs(0.5f, 0.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_EQUAL_INT(MODE_STANDSTILL, next);
}

// Boundary - P_dem = PDEM_STOP_LOW allows StandStill (>=)
void test_boundary_P_dem_equal_STOP_LOW_allows_StandStill(void) {
    Inputs_t in = make_inputs(0.3f, -1.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_EQUAL_INT(MODE_STANDSTILL, next);
}

// Boundary - SOC = SOC_EV_IN allows EV (>=)
void test_boundary_SOC_equal_SOC_EV_IN_allows_EV(void) {
    Inputs_t in = make_inputs(20.0f, 10.0f, 0.37f, 900.0f);
    Mode_t next = step_from(MODE_START, in);
    TEST_ASSERT_EQUAL_INT(MODE_EV, next);
}

// Boundary - P_dem = PDEM_HYB_MID allows ICE->Hybrid (>=)
void test_boundary_P_dem_equal_HYB_MID_allows_ICE_to_Hybrid(void) {
    Inputs_t in = make_inputs(40.0f, 15.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_ICE, in);
    TEST_ASSERT_EQUAL_INT(MODE_HYBRID, next);
}

// Boundary - P_dem = PDEM_HYB_LOW allows Hybrid->ICE (<=)
void test_boundary_P_dem_equal_HYB_LOW_allows_Hybrid_to_ICE(void) {
    Inputs_t in = make_inputs(40.0f, 10.0f, 0.5f, 900.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_EQUAL_INT(MODE_ICE, next);
}

// Boundary - SOC = SOC_LOW blocks Hybrid->ICE (strict <)
void test_boundary_SOC_equal_SOC_LOW_blocks_Hybrid_to_ICE_via_SOC(void) {
    Inputs_t in = make_inputs(40.0f, 20.0f, 0.25f, 900.0f);
    Mode_t next = step_from(MODE_HYBRID, in);
    TEST_ASSERT_EQUAL_INT(MODE_HYBRID, next);
}