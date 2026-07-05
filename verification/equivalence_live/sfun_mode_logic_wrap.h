/* Prototype for the Legacy Code Tool co-simulation wrapper.
 * Added to def.HeaderFiles so the generated sfun_mode_logic.c sees a
 * declaration of ModeLogic_CoSimStep (otherwise MinGW errors with
 * implicit-function-declaration). Definition is in sfun_mode_logic_wrap.c. */
#ifndef SFUN_MODE_LOGIC_WRAP_H
#define SFUN_MODE_LOGIC_WRAP_H

#include <stdint.h>

void ModeLogic_CoSimStep(const uint16_t speed_dkph[1],
                         const int16_t  p_dem_dkw[1],
                         const uint16_t soc_q10000[1],
                         const uint16_t weng_rpm[1],
                         const uint8_t  mode_in[1],
                         uint8_t mode_out[1],
                         uint8_t mot[1],
                         uint8_t gen[1],
                         uint8_t ice[1]);

#endif /* SFUN_MODE_LOGIC_WRAP_H */
