/* ============================================================
 * test_person_d_hugo.c
 * Responsible: Hugo (Person D)
 * Requirements: SwLLR18, SwLLR19 (Start -> Hybrid / ICE)
 *             SwLLR20, SwLLR22 (ICE/Hybrid -> Start via reset)
 *             + shared collective tests
 * ============================================================ */
#include "unity.h"
#include "mode_logic_team.h"

/* Helpers */
static State_t g_st;
static Outputs_t g_out;
static Inputs_t make_in(float s, float soc, float p, float w) {
    Inputs_t in; in.speed=s; in.SOC=soc; in.P_dem=p; in.wEng=w; return in;
}
static void force_mode(Mode_t m) { g_st.current_mode = m; }
static Mode_t do_step(Inputs_t *in) {
    ModeLogic_Step(&g_st, in, &g_out);
    return g_st.current_mode;
}

/* Threshold shortcuts */
#define SPD_EV_MID    10.0f
#define SPD_ABOVE_EV  40.0f
#define SPD_STOPPED   0.3f
#define PDEM_NEUTRAL  5.0f
#define PDEM_HIGH     20.0f
#define SOC_ABOVE_MID 0.36f
#define SOC_BELOW_MID 0.28f
#define SOC_HIGH      0.50f
#define WENG_RUNNING  900.0f
#define WENG_STALLED  780.0f
#define WENG_CRANKING 795.0f

void setUp(void){ ModeLogic_Init(&g_st); }
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
    Inputs_t in = make_in(0,0,0,0); Outputs_t out;
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
    State_t s; Inputs_t in = make_in(10,0.5,5,900);
    ModeLogic_Step(&s, &in, NULL);
    TEST_PASS();
}
// SwHLR02 - Output mapping (START)
void test_output_start(void) {
    force_mode(MODE_START);
    Inputs_t in = make_in(SPD_EV_MID, SOC_ABOVE_MID, PDEM_NEUTRAL, WENG_CRANKING);
    do_step(&in);
    TEST_ASSERT_EQUAL(1, g_out.Mot_Enable);
    TEST_ASSERT_EQUAL(1, g_out.Gen_Enable);
    TEST_ASSERT_EQUAL(0, g_out.ICE_Enable);
}
// SwHLR02 - Output mapping (ICE)
void test_output_ice(void) {
    force_mode(MODE_ICE);
    Inputs_t in = make_in(SPD_EV_MID, SOC_ABOVE_MID, PDEM_NEUTRAL, WENG_RUNNING);
    do_step(&in);
    TEST_ASSERT_EQUAL(0, g_out.Mot_Enable);
    TEST_ASSERT_EQUAL(1, g_out.Gen_Enable);
    TEST_ASSERT_EQUAL(1, g_out.ICE_Enable);
}
// SwHLR02 - Output mapping (HYBRID)
void test_output_hybrid(void) {
    force_mode(MODE_HYBRID);
    Inputs_t in = make_in(SPD_EV_MID, SOC_ABOVE_MID, PDEM_HIGH, WENG_RUNNING);
    do_step(&in);
    TEST_ASSERT_EQUAL(1, g_out.Mot_Enable);
    TEST_ASSERT_EQUAL(1, g_out.Gen_Enable);
    TEST_ASSERT_EQUAL(1, g_out.ICE_Enable);
}

/* ------- Start -> Hybrid (SwLLR18) ------- */

// SwLLR18 - MC/DC (base A=T, B=T, C=T)
void test_start_to_hybrid_base(void) {
    force_mode(MODE_START);
    Inputs_t in = make_in(SPD_EV_MID, SOC_ABOVE_MID, PDEM_HIGH, WENG_RUNNING);
    TEST_ASSERT_EQUAL(MODE_HYBRID, do_step(&in));
}
// SwLLR18 - MC/DC (A=F: wEng not > ENG_ON)
void test_start_hybrid_a_false(void) {
    force_mode(MODE_START);
    Inputs_t in = make_in(SPD_EV_MID, SOC_ABOVE_MID, PDEM_HIGH, WENG_CRANKING);
    TEST_ASSERT_EQUAL(MODE_START, do_step(&in));
}
// SwLLR18 - MC/DC (B=F: SOC < SOC_MID) – falls through to ICE
void test_start_hybrid_b_false(void) {
    force_mode(MODE_START);
    Inputs_t in = make_in(SPD_EV_MID, SOC_BELOW_MID, PDEM_HIGH, WENG_RUNNING);
    TEST_ASSERT_EQUAL(MODE_ICE, do_step(&in));
}
// SwLLR18 - MC/DC (C=T: speed > SPEED_EV_MAX, D=F)
void test_start_hybrid_c_true(void) {
    force_mode(MODE_START);
    Inputs_t in = make_in(SPD_ABOVE_EV, SOC_ABOVE_MID, PDEM_NEUTRAL, WENG_RUNNING);
    TEST_ASSERT_EQUAL(MODE_HYBRID, do_step(&in));
}
// SwLLR18 - MC/DC (D=F, C=F) – leads to ICE, proving D independence
void test_start_hybrid_d_false(void) {
    force_mode(MODE_START);
    Inputs_t in = make_in(SPD_EV_MID, SOC_ABOVE_MID, PDEM_NEUTRAL, WENG_RUNNING);
    TEST_ASSERT_EQUAL(MODE_ICE, do_step(&in));
}

/* ------- Start -> ICE (SwLLR19) ------- */

// SwLLR19 - MC/DC (base A=T, E=T, F=T, G2=T)
void test_start_to_ice_base(void) {
    force_mode(MODE_START);
    Inputs_t in = make_in(SPD_EV_MID, SOC_BELOW_MID, PDEM_NEUTRAL, WENG_RUNNING);
    TEST_ASSERT_EQUAL(MODE_ICE, do_step(&in));
}
// SwLLR19 - MC/DC (A=F)
void test_start_ice_a_false(void) {
    force_mode(MODE_START);
    Inputs_t in = make_in(SPD_EV_MID, SOC_BELOW_MID, PDEM_NEUTRAL, WENG_CRANKING);
    TEST_ASSERT_EQUAL(MODE_START, do_step(&in));
}
// SwLLR19 - MC/DC (E=T, F=F, G2=F) – E sole driver
void test_start_ice_e_true(void) {
    force_mode(MODE_START);
    Inputs_t in = make_in(SPD_ABOVE_EV, SOC_BELOW_MID, PDEM_HIGH, WENG_RUNNING);
    TEST_ASSERT_EQUAL(MODE_ICE, do_step(&in));
}
// SwLLR19 - MC/DC (F=T, E=F, G2=T)
void test_start_ice_f_true(void) {
    force_mode(MODE_START);
    Inputs_t in = make_in(SPD_EV_MID, SOC_ABOVE_MID, PDEM_NEUTRAL, WENG_RUNNING);
    TEST_ASSERT_EQUAL(MODE_ICE, do_step(&in));
}
// SwLLR19 - MC/DC (G2=T, E=F, F=T) – repetition for G2 independence
void test_start_ice_g2_true(void) {
    force_mode(MODE_START);
    Inputs_t in = make_in(SPD_EV_MID, SOC_ABOVE_MID, PDEM_NEUTRAL, WENG_RUNNING);
    TEST_ASSERT_EQUAL(MODE_ICE, do_step(&in));
}

/* ------- ICE / Hybrid reset to Start (SwLLR20, SwLLR22) ------- */

// SwLLR20 - MC/DC (wEng <= ENG_OFF)
void test_ice_reset_to_start(void) {
    force_mode(MODE_ICE);
    Inputs_t in = make_in(SPD_EV_MID, SOC_ABOVE_MID, PDEM_NEUTRAL, WENG_STALLED);
    TEST_ASSERT_EQUAL(MODE_START, do_step(&in));
}
// SwLLR22 - MC/DC (wEng <= ENG_OFF)
void test_hybrid_reset_to_start(void) {
    force_mode(MODE_HYBRID);
    Inputs_t in = make_in(SPD_EV_MID, SOC_ABOVE_MID, PDEM_NEUTRAL, WENG_STALLED);
    TEST_ASSERT_EQUAL(MODE_START, do_step(&in));
}