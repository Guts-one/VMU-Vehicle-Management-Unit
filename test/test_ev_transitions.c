/* ============================================================
 * test_person_b_marinel.c
 * Responsible: Marinel (Person B)
 * Requirements: SwLLR03, SwLLR04, SwLLR05 (EV -> RegenB / START / StandStill)
 *               + shared collective tests
 * ============================================================ */
#include "unity.h"
#include  "mode_logic_team.h"

static Mode_t run_from_ev(const Inputs_t *in, Outputs_t *out) {
    State_t st; st.current_mode = MODE_EV;
    ModeLogic_Step(&st, in, out);
    return st.current_mode;
}

static Inputs_t make_inputs(float speed, float p_dem, float soc, float w_eng) {
    Inputs_t in;
    in.speed = speed; in.P_dem = p_dem; in.SOC = soc; in.wEng = w_eng;
    return in;
}

void setUp(void){}
void tearDown(void){}

/* Shared collective tests */

// SwHLR01 - Sanity
void test_init_valid(void) {
    State_t s; s.current_mode = MODE_HYBRID;
    ModeLogic_Init(&s);
    TEST_ASSERT_EQUAL(MODE_STANDSTILL, s.current_mode);
}
// SwHLR10 - Sanity (NULL init)
void test_init_null(void) { ModeLogic_Init(NULL); TEST_PASS(); }
// SwHLR10 - Sanity (NULL state)
void test_step_null_state(void) {
    Inputs_t in = make_inputs(0,0,0.5,0); Outputs_t out;
    out.Mot_Enable = 0xFF;
    ModeLogic_Step(NULL, &in, &out);
    TEST_ASSERT_EQUAL(0xFF, out.Mot_Enable);
}
// SwHLR10 - Sanity (NULL inputs)
void test_step_null_inputs(void) {
    State_t s; Outputs_t out; out.Mot_Enable = 0xFF;
    ModeLogic_Step(&s, NULL, &out);
    TEST_ASSERT_EQUAL(0xFF, out.Mot_Enable);
}
// SwHLR10 - Sanity (NULL outputs)
void test_step_null_outputs(void) {
    State_t s; Inputs_t in = make_inputs(10,0,0.4,0);
    ModeLogic_Step(&s, &in, NULL);
    TEST_PASS();
}
// SwHLR02 - Output mapping (EV)
void test_output_ev(void) {
    State_t s; Inputs_t in = make_inputs(20,5,0.4,0); Outputs_t out;
    s.current_mode = MODE_EV;
    ModeLogic_Step(&s, &in, &out);
    TEST_ASSERT_EQUAL(1, out.Mot_Enable);
    TEST_ASSERT_EQUAL(0, out.Gen_Enable);
    TEST_ASSERT_EQUAL(0, out.ICE_Enable);
}

/* EV -> RegenB (SwLLR03) */

// SwLLR03 - MC/DC (base TT)
void test_ev_to_regenb_base(void) {
    Outputs_t out; Inputs_t in = make_inputs(10,-6,0.4,0);
    TEST_ASSERT_EQUAL(MODE_REGENB, run_from_ev(&in, &out));
}
// SwLLR03 - MC/DC (A=F: speed <= SPEED_REGEN)
void test_ev_regenb_speed_false(void) {
    Outputs_t out; Inputs_t in = make_inputs(4,-6,0.4,0);
    TEST_ASSERT_EQUAL(MODE_EV, run_from_ev(&in, &out));
}
// SwLLR03 - MC/DC (B=F: P_dem > PDEM_REGEN)
void test_ev_regenb_pdem_false(void) {
    Outputs_t out; Inputs_t in = make_inputs(10,-4,0.4,0);
    TEST_ASSERT_EQUAL(MODE_EV, run_from_ev(&in, &out));
}

/* EV -> START (SwLLR04) */

// SwLLR04 - MC/DC (A=T: speed > SPEED_EV_MAX)
void test_ev_to_start_high_speed(void) {
    Outputs_t out; Inputs_t in = make_inputs(40,0,0.4,0);
    TEST_ASSERT_EQUAL(MODE_START, run_from_ev(&in, &out));
}
// SwLLR04 - MC/DC (B=T: P_dem >= PDEM_HYB_IN)
void test_ev_to_start_high_pdem(void) {
    Outputs_t out; Inputs_t in = make_inputs(20,50,0.4,0);
    TEST_ASSERT_EQUAL(MODE_START, run_from_ev(&in, &out));
}
// SwLLR04 - MC/DC (C=T: SOC < SOC_EV_OUT)
void test_ev_to_start_low_soc(void) {
    Outputs_t out; Inputs_t in = make_inputs(20,0,0.34,0);
    TEST_ASSERT_EQUAL(MODE_START, run_from_ev(&in, &out));
}

/* EV -> StandStill (SwLLR05) */

// SwLLR05 - MC/DC (base TTT)
void test_ev_to_standstill_base(void) {
    Outputs_t out; Inputs_t in = make_inputs(0.3,0,0.4,0);
    TEST_ASSERT_EQUAL(MODE_STANDSTILL, run_from_ev(&in, &out));
}
// SwLLR05 - MC/DC (A=F: speed > SPEED_STOP)
void test_ev_standstill_speed_blocks(void) {
    Outputs_t out; Inputs_t in = make_inputs(1.0,0,0.4,0);
    TEST_ASSERT_EQUAL(MODE_EV, run_from_ev(&in, &out));
}
// SwLLR05 - MC/DC (B=F: P_dem > PDEM_STOP_HIGH)
void test_ev_standstill_pdem_high_blocks(void) {
    Outputs_t out; Inputs_t in = make_inputs(0.3,2,0.4,0);
    TEST_ASSERT_EQUAL(MODE_EV, run_from_ev(&in, &out));
}
// SwLLR05 - MC/DC (C=F: P_dem < PDEM_STOP_LOW)
void test_ev_standstill_pdem_low_blocks(void) {
    Outputs_t out; Inputs_t in = make_inputs(0.3,-2,0.4,0);
    TEST_ASSERT_EQUAL(MODE_EV, run_from_ev(&in, &out));
}