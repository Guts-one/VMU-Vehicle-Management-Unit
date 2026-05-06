/* VMU - mode logic */

#include <stddef.h>            
#include "../inc/mode_logic_team.h"

/* Priority: EV before START. */
static Mode_t handle_standstill(const Inputs_t *in)
{
    Mode_t next = MODE_STANDSTILL;

    /* STANDSTILL -> EV */
    if ((in->speed >  SPEED_STOP)   &&
        (in->speed <= SPEED_EV_MAX) &&
        (in->SOC   >= SOC_EV_IN)) {
        next = MODE_EV;
    }
    /* STANDSTILL -> START */
    else if ((in->speed > SPEED_STOP) &&
             ((in->speed > SPEED_EV_MAX) ||
              (in->SOC   <  SOC_EV_IN))) {
        next = MODE_START;
    }
    else {
    }

    return next;
}

/* EV entry: SOC_EV_IN (0.37), exit: SOC_EV_OUT (0.35) -- hysteresis gap. */
static Mode_t handle_ev(const Inputs_t *in)
{
    Mode_t next = MODE_EV;

    /* EV -> REGENB */
    if ((in->speed >  SPEED_REGEN) &&
        (in->P_dem <= PDEM_REGEN)) {
        next = MODE_REGENB;
    }
    /* EV -> START */
    else if ((in->speed > SPEED_EV_MAX) ||
             (in->P_dem >= PDEM_HYB_IN) ||
             (in->SOC   <  SOC_EV_OUT)) {
        next = MODE_START;
    }
    /* EV -> STANDSTILL */
    else if ((in->speed <= SPEED_STOP)     &&
             (in->P_dem <= PDEM_STOP_HIGH) &&
             (in->P_dem >= PDEM_STOP_LOW)) {
        next = MODE_STANDSTILL;
    }
    else {
    }

    return next;
}


static Mode_t handle_regenb(const Inputs_t *in)
{
    Mode_t next = MODE_REGENB;

    /* REGENB -> START */
    if (((in->speed > SPEED_EV_MAX) && (in->P_dem >= PDEM_STOP_LOW)) ||
        (in->SOC < SOC_EV_OUT)) {
        next = MODE_START;
    }
    /* REGENB -> STANDSTILL */
    else if ((in->speed <= SPEED_STOP)     &&
             (in->P_dem <= PDEM_STOP_HIGH) &&
             (in->P_dem >= PDEM_STOP_LOW)) {
        next = MODE_STANDSTILL;
    }
    /* REGENB -> EV */
    else if ((in->P_dem >= PDEM_STOP_LOW) &&
             (in->speed > SPEED_STOP) &&
             (in->speed <= SPEED_EV_MAX) &&
             (in->SOC >= SOC_EV_OUT)) {
        next = MODE_EV;
    }
    else {
    }

    return next;
}

/* Common exit from Motion_mode_ICE (shared by START, ICE, HYBRID). */
static Mode_t motion_ice_common_exit(const Inputs_t *in, Mode_t current_in_block)
{
    Mode_t next = current_in_block;

    if ((in->wEng > ENG_ON) &&
        (in->speed > SPEED_REGEN) &&
        (in->P_dem <= PDEM_REGEN)) {
        next = MODE_REGENB;
    } else if ((in->wEng > ENG_ON) &&
               (in->P_dem <= PDEM_HYB_OUT) &&
               (in->P_dem >= PDEM_STOP_LOW) &&
               (in->speed > SPEED_STOP) &&
               (in->speed <= SPEED_EV_MAX) &&
               (in->SOC >= SOC_EV_IN)) {
        next = MODE_EV;
    } else if ((in->speed <= SPEED_STOP) &&
               (in->P_dem <= PDEM_STOP_HIGH) &&
               (in->P_dem >= PDEM_STOP_LOW)) {
        next = MODE_STANDSTILL;
    } else {
    }

    return next;
}

/* Reset to START when engine stalls (checked before ICE <-> HYBRID). */
static Mode_t internal_motion_ice_reset(const Inputs_t *in, Mode_t current_in_block)
{
    Mode_t next = current_in_block;

    if (in->wEng <= ENG_OFF) {
        next = MODE_START;
    } else {
    }

    return next;
}


static Mode_t handle_start(const Inputs_t *in)
{
    Mode_t next;

    next = motion_ice_common_exit(in, MODE_START);

    if (next == MODE_START) {
        if ((in->wEng > ENG_ON) &&
            (in->SOC >= SOC_MID) &&
            ((in->speed > SPEED_EV_MAX) ||
             (in->P_dem >= PDEM_HYB_MID))) {
            next = MODE_HYBRID;
        } else if ((in->wEng > ENG_ON) &&
                   ((in->SOC < SOC_MID) ||
                    ((in->speed <= SPEED_EV_MAX) &&
                     (in->P_dem < PDEM_HYB_MID)))) {
            next = MODE_ICE;
        } else {
        }
    } else {
    }

    return next;
}


static Mode_t handle_ice(const Inputs_t *in)
{
    Mode_t next;

    next = motion_ice_common_exit(in, MODE_ICE);

    if (next == MODE_ICE) {
        next = internal_motion_ice_reset(in, next);
    } else {
    }

    if (next == MODE_ICE) {
        if ((in->P_dem >= PDEM_HYB_MID) &&
            (in->SOC   >= SOC_MID)) {
            next = MODE_HYBRID;
        } else {
        }
    } else {
    }

    return next;
}


static Mode_t handle_hybrid(const Inputs_t *in)
{
    Mode_t next;

    next = motion_ice_common_exit(in, MODE_HYBRID);

    if (next == MODE_HYBRID) {
        next = internal_motion_ice_reset(in, next);
    } else {
    }

    if (next == MODE_HYBRID) {
        if ((in->P_dem <= PDEM_HYB_LOW) ||
            (in->SOC   <  SOC_LOW)) {
            next = MODE_ICE;
        } else {
        }
    } else {
    }

    return next;
}


static void write_outputs(Mode_t mode, Outputs_t *out)
{
    switch (mode) {
        case MODE_STANDSTILL:
            out->Mot_Enable = 0U;
            out->Gen_Enable = 0U;
            out->ICE_Enable = 0U;
            break;

        case MODE_EV:
            out->Mot_Enable = 1U;
            out->Gen_Enable = 0U;
            out->ICE_Enable = 0U;
            break;

        case MODE_REGENB:
            out->Mot_Enable = 1U;
            out->Gen_Enable = 0U;
            out->ICE_Enable = 0U;
            break;

        case MODE_START:
            out->Mot_Enable = 1U;
            out->Gen_Enable = 1U;
            out->ICE_Enable = 0U;
            break;

        case MODE_ICE:
            out->Mot_Enable = 0U;
            out->Gen_Enable = 1U;
            out->ICE_Enable = 1U;
            break;

        case MODE_HYBRID:
            out->Mot_Enable = 1U;
            out->Gen_Enable = 1U;
            out->ICE_Enable = 1U;
            break;

        default:
            out->Mot_Enable = 0U;
            out->Gen_Enable = 0U;
            out->ICE_Enable = 0U;
            break;
    }
}

/* Public API consumed by test/ and external clients */
/* cppcheck-suppress misra-c2012-8.7 */
/* cppcheck-suppress unusedFunction */
void ModeLogic_Init(State_t *state)
{
    if (state != NULL) {
        state->current_mode = MODE_STANDSTILL;
    } else {
    }
}

/* Public API consumed by test/ and external clients */
/* cppcheck-suppress misra-c2012-8.7 */
/* cppcheck-suppress unusedFunction */
void ModeLogic_Step(State_t *state, const Inputs_t *in, Outputs_t *out)
{
    if ((state != NULL) && (in != NULL) && (out != NULL)) {
        Mode_t next = state->current_mode;

        switch (state->current_mode) {
            case MODE_STANDSTILL:
                next = handle_standstill(in);
                break;

            case MODE_EV:
                next = handle_ev(in);
                break;

            case MODE_REGENB:
                next = handle_regenb(in);
                break;

            case MODE_START:
                next = handle_start(in);
                break;

            case MODE_ICE:
                next = handle_ice(in);
                break;

            case MODE_HYBRID:
                next = handle_hybrid(in);
                break;

            default:
                next = MODE_STANDSTILL;
                break;
        }

        state->current_mode = next;
        write_outputs(next, out);
    } else {
    }
}
