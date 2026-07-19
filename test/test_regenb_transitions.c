/* ============================================================
 * test_Bruna.c
 * Adapted for Ceedling
 * ============================================================ */
#include "unity.h"
#include "mode_logic_team.h"

static Mode_t run_from_regenb(const Inputs_t *in, Outputs_t *out) {
    State_t st; 
    st.current_mode = MODE_REGENB;
    ModeLogic_Step(&st, in, out);
    return st.current_mode;
}

static Inputs_t make_inputs(float speed, float p_dem, float soc, float w_eng) {
    Inputs_t in;
    in.speed_dkph = (uint16_t)((speed * 10.0f) + 0.5f);
    in.p_dem_dkw = (p_dem >= 0.0f) ?
        (int16_t)((p_dem * 10.0f) + 0.5f) :
        (int16_t)((p_dem * 10.0f) - 0.5f);
    in.soc_q10000 = (uint16_t)((soc * 10000.0f) + 0.5f);
    in.weng_rpm = (uint16_t)(w_eng + 0.5f);
    return in;
}

void setUp(void){}
void tearDown(void){}

/* =========================
   Shared collective tests
   ========================= */

// SwHLR01 - Sanity
void test_init_valid(void) {
    State_t s; 
    s.current_mode = MODE_HYBRID;
    ModeLogic_Init(&s);
    TEST_ASSERT_EQUAL(MODE_STANDSTILL, s.current_mode);
}

// SwHLR10 - Sanity (NULL init)
void test_init_null(void) { 
    ModeLogic_Init(NULL); 
    TEST_PASS(); 
}

// SwHLR10 - Sanity (NULL state)
void test_step_null_state(void) {
    Inputs_t in = make_inputs(0,0,0.5,0);
    Outputs_t out;
    out.Mot_Enable = 0xAA;
    ModeLogic_Step(NULL, &in, &out);
    TEST_ASSERT_EQUAL(0xAA, out.Mot_Enable);
}

// SwHLR10 - Sanity (NULL inputs)
void test_step_null_inputs(void) {
    State_t s; 
    Outputs_t out; 
    out.Mot_Enable = 0xFF;
    ModeLogic_Step(&s, NULL, &out);
    TEST_ASSERT_EQUAL(0xFF, out.Mot_Enable);
}

// SwHLR10 - Sanity (NULL outputs)
void test_step_null_outputs(void) {
    State_t s; 
    Inputs_t in = make_inputs(10,0,0.4,0);
    ModeLogic_Step(&s, &in, NULL);
    TEST_PASS();
}

// SwHLR02 - Output mapping (RegenB)
void test_output_regenb(void) {
    State_t s; 
    Inputs_t in = make_inputs(10,-6,0.4,0); 
    Outputs_t out;
    s.current_mode = MODE_REGENB;
    ModeLogic_Step(&s, &in, &out);

    TEST_ASSERT_EQUAL(1, out.Mot_Enable);
    TEST_ASSERT_EQUAL(0, out.Gen_Enable);
    TEST_ASSERT_EQUAL(0, out.ICE_Enable);
}

/* =========================
   RegenB -> START (SwLLR06)
   ========================= */

void test_regenb_to_start_high_speed(void) {
    Outputs_t out; 
    Inputs_t in = make_inputs(40,-1,0.5,0);
    TEST_ASSERT_EQUAL(MODE_START, run_from_regenb(&in, &out));
}

void test_regenb_to_start_low_soc(void) {
    Outputs_t out; 
    Inputs_t in = make_inputs(20,-6,0.34,0);
    TEST_ASSERT_EQUAL(MODE_START, run_from_regenb(&in, &out));
}

void test_regenb_start_blocked_by_speed_and_soc(void) {
    Outputs_t out; 
    Inputs_t in = make_inputs(20,-6,0.5,0);
    TEST_ASSERT_NOT_EQUAL(MODE_START, run_from_regenb(&in, &out));
}

/* =========================
   RegenB -> StandStill (SwLLR07)
   ========================= */

void test_regenb_to_standstill_base(void) {
    Outputs_t out; 
    Inputs_t in = make_inputs(0.3,0,0.5,0);
    TEST_ASSERT_EQUAL(MODE_STANDSTILL, run_from_regenb(&in, &out));
}

void test_regenb_standstill_speed_blocks(void) {
    Outputs_t out; 
    Inputs_t in = make_inputs(1.0,0,0.5,0);
    TEST_ASSERT_EQUAL(MODE_EV, run_from_regenb(&in, &out));
}

void test_regenb_standstill_pdem_high_blocks(void) {
    Outputs_t out; 
    Inputs_t in = make_inputs(0.3,2,0.5,0);
    TEST_ASSERT_EQUAL(MODE_REGENB, run_from_regenb(&in, &out));
}

void test_regenb_standstill_pdem_low_blocks(void) {
    Outputs_t out; 
    Inputs_t in = make_inputs(0.3,-2,0.5,0);
    TEST_ASSERT_EQUAL(MODE_REGENB, run_from_regenb(&in, &out));
}

/* =========================
   RegenB -> EV (SwLLR08)
   ========================= */

void test_regenb_to_ev_base(void) {
    Outputs_t out; 
    Inputs_t in = make_inputs(20,0,0.4,0);
    TEST_ASSERT_EQUAL(MODE_EV, run_from_regenb(&in, &out));
}

void test_regenb_ev_pdem_blocks(void) {
    Outputs_t out; 
    Inputs_t in = make_inputs(20,-2,0.4,0);
    TEST_ASSERT_EQUAL(MODE_REGENB, run_from_regenb(&in, &out));
}

void test_regenb_ev_speed_stop_blocks(void) {
    Outputs_t out; 
    Inputs_t in = make_inputs(0.3,0,0.4,0);
    TEST_ASSERT_EQUAL(MODE_STANDSTILL, run_from_regenb(&in, &out));
}
