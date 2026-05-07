#include "unity.h"
void test_init_null(void);
void test_init_valid(void);
void test_output_regenb(void);
void test_regenb_ev_pdem_blocks(void);
void test_regenb_ev_speed_stop_blocks(void);
void test_regenb_standstill_pdem_high_blocks(void);
void test_regenb_standstill_pdem_low_blocks(void);
void test_regenb_standstill_speed_blocks(void);
void test_regenb_start_blocked_by_speed_and_soc(void);
void test_regenb_to_ev_base(void);
void test_regenb_to_standstill_base(void);
void test_regenb_to_start_high_speed(void);
void test_regenb_to_start_low_soc(void);
void test_step_null_inputs(void);
void test_step_null_outputs(void);
void test_step_null_state(void);
int main(void) {
    UNITY_BEGIN();
    RUN_TEST(test_init_null);
    RUN_TEST(test_init_valid);
    RUN_TEST(test_output_regenb);
    RUN_TEST(test_regenb_ev_pdem_blocks);
    RUN_TEST(test_regenb_ev_speed_stop_blocks);
    RUN_TEST(test_regenb_standstill_pdem_high_blocks);
    RUN_TEST(test_regenb_standstill_pdem_low_blocks);
    RUN_TEST(test_regenb_standstill_speed_blocks);
    RUN_TEST(test_regenb_start_blocked_by_speed_and_soc);
    RUN_TEST(test_regenb_to_ev_base);
    RUN_TEST(test_regenb_to_standstill_base);
    RUN_TEST(test_regenb_to_start_high_speed);
    RUN_TEST(test_regenb_to_start_low_soc);
    RUN_TEST(test_step_null_inputs);
    RUN_TEST(test_step_null_outputs);
    RUN_TEST(test_step_null_state);
    return UNITY_END();
}
