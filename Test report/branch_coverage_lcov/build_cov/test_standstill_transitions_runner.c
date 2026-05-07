#include "unity.h"
void test_init_null(void);
void test_init_valid(void);
void test_output_standstill(void);
void test_standstill_ev_soc_lt_ev_in_blocks(void);
void test_standstill_ev_speed_gt_ev_max_blocks(void);
void test_standstill_ev_speed_le_stop_blocks(void);
void test_standstill_stay_low_speed(void);
void test_standstill_to_ev_base(void);
void test_standstill_to_start_high_speed(void);
void test_standstill_to_start_low_soc(void);
void test_step_null_inputs(void);
void test_step_null_outputs(void);
void test_step_null_state(void);
int main(void) {
    UNITY_BEGIN();
    RUN_TEST(test_init_null);
    RUN_TEST(test_init_valid);
    RUN_TEST(test_output_standstill);
    RUN_TEST(test_standstill_ev_soc_lt_ev_in_blocks);
    RUN_TEST(test_standstill_ev_speed_gt_ev_max_blocks);
    RUN_TEST(test_standstill_ev_speed_le_stop_blocks);
    RUN_TEST(test_standstill_stay_low_speed);
    RUN_TEST(test_standstill_to_ev_base);
    RUN_TEST(test_standstill_to_start_high_speed);
    RUN_TEST(test_standstill_to_start_low_soc);
    RUN_TEST(test_step_null_inputs);
    RUN_TEST(test_step_null_outputs);
    RUN_TEST(test_step_null_state);
    return UNITY_END();
}
