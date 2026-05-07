#include "unity.h"
void test_ev_regenb_pdem_false(void);
void test_ev_regenb_speed_false(void);
void test_ev_standstill_pdem_high_blocks(void);
void test_ev_standstill_pdem_low_blocks(void);
void test_ev_standstill_speed_blocks(void);
void test_ev_to_regenb_base(void);
void test_ev_to_standstill_base(void);
void test_ev_to_start_high_pdem(void);
void test_ev_to_start_high_speed(void);
void test_ev_to_start_low_soc(void);
void test_init_null(void);
void test_init_valid(void);
void test_output_ev(void);
void test_step_null_inputs(void);
void test_step_null_outputs(void);
void test_step_null_state(void);
int main(void) {
    UNITY_BEGIN();
    RUN_TEST(test_ev_regenb_pdem_false);
    RUN_TEST(test_ev_regenb_speed_false);
    RUN_TEST(test_ev_standstill_pdem_high_blocks);
    RUN_TEST(test_ev_standstill_pdem_low_blocks);
    RUN_TEST(test_ev_standstill_speed_blocks);
    RUN_TEST(test_ev_to_regenb_base);
    RUN_TEST(test_ev_to_standstill_base);
    RUN_TEST(test_ev_to_start_high_pdem);
    RUN_TEST(test_ev_to_start_high_speed);
    RUN_TEST(test_ev_to_start_low_soc);
    RUN_TEST(test_init_null);
    RUN_TEST(test_init_valid);
    RUN_TEST(test_output_ev);
    RUN_TEST(test_step_null_inputs);
    RUN_TEST(test_step_null_outputs);
    RUN_TEST(test_step_null_state);
    return UNITY_END();
}
