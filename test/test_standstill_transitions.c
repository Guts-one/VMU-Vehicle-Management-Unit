/* ============================================================
 * test_person_a_danilo.c
 * Responsible: Danilo (Person A)
 * Requirements: SwLLR01, SwLLR02 (StandStill -> EV / START)
 *               + shared collective tests (init, outputs, NULL guards)
 * ============================================================ */
#include "unity.h"
#include "mode_logic_team.h"

static Mode_t run_from_standstill(const Inputs_t *in, Outputs_t *out) {
    State_t st;
    st.current_mode = MODE_STANDSTILL;
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

/* ------- Shared collective tests ------- */

// SwHLR01 - Sanity
void test_init_valid(void) {
    State_t s; s.current_mode = MODE_HYBRID;
    ModeLogic_Init(&s);
    TEST_ASSERT_EQUAL(MODE_STANDSTILL, s.current_mode);
}

// SwHLR10 - Sanity (NULL robustness)
void test_init_null(void) { ModeLogic_Init(NULL); TEST_PASS(); }

// SwHLR10 - Sanity (NULL state)  <<<< CORRIGIDO
void test_step_null_state(void) {
    Inputs_t in = make_inputs(0, 0, 0.5, 0);
    Outputs_t out;

    // Inicializa todos os campos com um valor sentinel
    out.Mot_Enable = 0xFF;
    out.Gen_Enable = 0xFF;
    out.ICE_Enable = 0xFF;

    ModeLogic_Step(NULL, &in, &out);

    // Nenhum campo deve ter sido alterado
    TEST_ASSERT_EQUAL(0xFF, out.Mot_Enable);
    TEST_ASSERT_EQUAL(0xFF, out.Gen_Enable);
    TEST_ASSERT_EQUAL(0xFF, out.ICE_Enable);
}

// SwHLR10 - Sanity (NULL inputs)
void test_step_null_inputs(void) {
    State_t s; Outputs_t out; out.Mot_Enable = 0xFF;
    ModeLogic_Step(&s, NULL, &out);
    TEST_ASSERT_EQUAL(0xFF, out.Mot_Enable);
}

// SwHLR10 - Sanity (NULL outputs)
void test_step_null_outputs(void) {
    State_t s; Inputs_t in = make_inputs(10, 0, 0.4, 0);
    ModeLogic_Step(&s, &in, NULL);
    TEST_PASS();
}

// SwHLR02 - Output mapping (StandStill)
void test_output_standstill(void) {
    State_t s; Inputs_t in = make_inputs(0, 0, 0.5, 0); Outputs_t out;
    s.current_mode = MODE_STANDSTILL;
    ModeLogic_Step(&s, &in, &out);
    TEST_ASSERT_EQUAL(0, out.Mot_Enable);
    TEST_ASSERT_EQUAL(0, out.Gen_Enable);
    TEST_ASSERT_EQUAL(0, out.ICE_Enable);
}

/* ------- StandStill -> EV (SwLLR01) ------- */

// SwLLR01 - MC/DC (base TTT)
void test_standstill_to_ev_base(void) {
    Outputs_t out; Inputs_t in = make_inputs(10, 0, 0.37, 0);
    TEST_ASSERT_EQUAL(MODE_EV, run_from_standstill(&in, &out));
}

// SwLLR01 - MC/DC (A=F: speed <= SPEED_STOP)
void test_standstill_ev_speed_le_stop_blocks(void) {
    Outputs_t out; Inputs_t in = make_inputs(0.5, 0, 0.37, 0);
    TEST_ASSERT_EQUAL(MODE_STANDSTILL, run_from_standstill(&in, &out));
}

// SwLLR01 - MC/DC (B=F: speed > SPEED_EV_MAX)
void test_standstill_ev_speed_gt_ev_max_blocks(void) {
    Outputs_t out; Inputs_t in = make_inputs(36, 0, 0.37, 0);
    TEST_ASSERT_EQUAL(MODE_START, run_from_standstill(&in, &out));
}

// SwLLR01 - MC/DC (C=F: SOC < SOC_EV_IN)
void test_standstill_ev_soc_lt_ev_in_blocks(void) {
    Outputs_t out; Inputs_t in = make_inputs(10, 0, 0.36, 0);
    TEST_ASSERT_EQUAL(MODE_START, run_from_standstill(&in, &out));
}

/* ------- StandStill -> START (SwLLR02) ------- */

// SwLLR02 - MC/DC (B=T: speed > SPEED_EV_MAX)
void test_standstill_to_start_high_speed(void) {
    Outputs_t out; Inputs_t in = make_inputs(36, 0, 0.5, 0);
    TEST_ASSERT_EQUAL(MODE_START, run_from_standstill(&in, &out));
}

// SwLLR02 - MC/DC (C=T: SOC < SOC_EV_IN)
void test_standstill_to_start_low_soc(void) {
    Outputs_t out; Inputs_t in = make_inputs(10, 0, 0.36, 0);
    TEST_ASSERT_EQUAL(MODE_START, run_from_standstill(&in, &out));
}

// SwLLR02 - MC/DC (A=F: speed <= SPEED_STOP)
void test_standstill_stay_low_speed(void) {
    Outputs_t out; Inputs_t in = make_inputs(0.4, 0, 0.5, 0);
    TEST_ASSERT_EQUAL(MODE_STANDSTILL, run_from_standstill(&in, &out));
}