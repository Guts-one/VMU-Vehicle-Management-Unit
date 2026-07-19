#ifndef MODE_LOGIC_TEAM_H
#define MODE_LOGIC_TEAM_H

/* ============================================================
 * VMU - mode logic
 *
 * Embedded fixed-point interface:
 *   speed_dkph   = vehicle speed in 0.1 km/h
 *   p_dem_dkw    = demanded power in 0.1 kW
 *   soc_q10000   = battery state of charge in 0..10000
 *   weng_rpm     = engine speed in rpm
 *
 * Requirements addressed:
 *   SysHLR03 - Calibratable and Hysteretic Mode Transitions
 *   SwHLR01  - Execution Interface
 *   SwHLR10  - Unique Output Mapping
 *   SwHLR11  - Manual-Code Structure and Traceability
 *
 * ============================================================ */

#include <stdint.h>  

/* Calibratable thresholds represented as scaled integers.
 * Physical values are aligned with the HEV_powersplit_adapted model. */

#define ENG_ON_RPM             (800U)
#define ENG_OFF_RPM            (790U)
#define SPEED_STOP_DKPH        (5U)
#define SPEED_REGEN_DKPH       (50U)
#define SPEED_EV_MAX_DKPH      (350U)
#define PDEM_REGEN_DKW         (-50)
#define PDEM_STOP_LOW_DKW      (-10)
#define PDEM_STOP_HIGH_DKW     (10)
#define PDEM_HYB_IN_DKW        (500)
#define PDEM_HYB_OUT_DKW       (400)
#define PDEM_HYB_MID_DKW       (150)
#define PDEM_HYB_LOW_DKW       (100)
#define SOC_EV_IN_Q10000       (3700U)
#define SOC_EV_OUT_Q10000      (3500U)
#define SOC_LOW_Q10000         (2500U)
#define SOC_MID_Q10000         (3000U)

/* Internal VMU modes. */
typedef enum {
    MODE_STANDSTILL = 0,
    MODE_EV         = 1,
    MODE_REGENB     = 2,
    MODE_START      = 3,
    MODE_ICE        = 4,
    MODE_HYBRID     = 5
} Mode_t;

/* External fixed-point inputs. The step function does not depend on globals. */
typedef struct {
    uint16_t speed_dkph;
    int16_t p_dem_dkw;
    uint16_t soc_q10000;
    uint16_t weng_rpm;
} Inputs_t;

/* Binary outputs.
 * uint8_t reduces the structure size compared with int. */
typedef struct {
    uint8_t Mot_Enable;
    uint8_t Gen_Enable;
    uint8_t ICE_Enable;
} Outputs_t;

/* Internal state-machine state. */
typedef struct {
    Mode_t current_mode;
} State_t;

/* Inputs_t is const to guarantee that the step function does not modify inputs. */
void ModeLogic_Init(State_t *state);
void ModeLogic_Step(State_t *state, const Inputs_t *in, Outputs_t *out);

#endif 
