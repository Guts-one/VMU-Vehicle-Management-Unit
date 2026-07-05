/* Legacy Code Tool wrapper for src/mode_logic_team.c.
 *
 * Combinational by design: the FSM state (current_mode) is carried OUTSIDE the
 * S-Function via an external Unit Delay in the harness
 *   mode_out --> [1/z, init=STANDSTILL] --> mode_in
 * so the generated S-Function holds no persistent state (no LCT work vectors)
 * and there is no algebraic loop.
 *
 * Argument order MUST match build_sfun_mode_logic.m OutputFcnSpec:
 *   inputs  u1..u5 = speed_dkph, p_dem_dkw, soc_q10000, weng_rpm, mode_in
 *   outputs y1..y4 = mode_out, Mot_Enable, Gen_Enable, ICE_Enable
 */
#include "mode_logic_team.h"
#include "sfun_mode_logic_wrap.h"

void ModeLogic_CoSimStep(const uint16_t speed_dkph[1],
                         const int16_t  p_dem_dkw[1],
                         const uint16_t soc_q10000[1],
                         const uint16_t weng_rpm[1],
                         const uint8_t  mode_in[1],
                         uint8_t mode_out[1],
                         uint8_t mot[1],
                         uint8_t gen[1],
                         uint8_t ice[1])
{
    State_t st;
    Inputs_t in;
    Outputs_t out;

    /* Reconstruct FSM state from the delayed feedback signal; clamp to range. */
    st.current_mode = (mode_in[0] <= (uint8_t)MODE_HYBRID)
                      ? (Mode_t)mode_in[0] : MODE_STANDSTILL;

    in.speed_dkph = speed_dkph[0];
    in.p_dem_dkw  = p_dem_dkw[0];
    in.soc_q10000 = soc_q10000[0];
    in.weng_rpm   = weng_rpm[0];

    ModeLogic_Step(&st, &in, &out);

    mode_out[0] = (uint8_t)st.current_mode;
    mot[0] = out.Mot_Enable;
    gen[0] = out.Gen_Enable;
    ice[0] = out.ICE_Enable;
}
