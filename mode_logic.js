/* VMU supervisory mode logic — single source of truth for the web simulator
 * AND the JS<->C equivalence harness.
 *
 * This is a faithful, atomic-predicate port of src/mode_logic_team.c:
 *   - the 16 thresholds mirror inc/mode_logic_team.h exactly;
 *   - the to_u16/to_s16 fixed-point quantization matches
 *     verification/simulink_c_equivalence.c (round half away from zero, saturate);
 *   - each condition is its own `flag*` function with an explicit if-branch, so
 *     branch coverage of this module == condition-outcome (MC/DC) coverage, the
 *     same tree-likeness argument the C uses (mcdc-checker / gcov --conditions);
 *   - guards evaluate all their flags EAGERLY (like the C's `const` locals) so
 *     there is no short-circuit and coverage is faithful to the C.
 *
 * UMD-style classic script: sets globalThis.ModeLogic in the browser (loads via
 * a plain <script src>, so mode_logic_sim.html still opens from file:// with no
 * build step and no CORS/module issues) and module.exports under Node/CommonJS
 * (so the equivalence harness can require it).
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  /* c8 ignore start */             // UMD module-system detection: env boilerplate, not decision logic
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;            // Node / CommonJS (harness)
  } else {
    root.ModeLogic = api;            // browser (classic script)
  }
  /* c8 ignore stop */
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ===== Mode enumeration (mirrors Mode_t in inc/mode_logic_team.h) =====
  var MODE_STANDSTILL = 0;
  var MODE_EV = 1;
  var MODE_REGENB = 2;
  var MODE_START = 3;
  var MODE_ICE = 4;
  var MODE_HYBRID = 5;

  // Names WITH the MODE_ prefix (UI) and the bare Stateflow/C names used by
  // mode_probe.c and the boundary_stimulus.csv `exp_mode_c` column (harness).
  var MODE_NAMES = ['MODE_STANDSTILL', 'MODE_EV', 'MODE_REGENB', 'MODE_START', 'MODE_ICE', 'MODE_HYBRID'];
  var MODE_SHORT_NAMES = ['STOP', 'EV', 'REGEN', 'START', 'ICE', 'HYB'];
  var STATE_NAMES = ['STANDSTILL', 'EV', 'REGENB', 'START', 'ICE', 'HYBRID'];

  // ===== Fixed-point thresholds — mirror inc/mode_logic_team.h exactly =====
  var ENG_ON_RPM = 800;
  var ENG_OFF_RPM = 790;
  var SPEED_STOP_DKPH = 5;
  var SPEED_REGEN_DKPH = 50;
  var SPEED_EV_MAX_DKPH = 350;
  var PDEM_REGEN_DKW = -50;
  var PDEM_STOP_LOW_DKW = -10;
  var PDEM_STOP_HIGH_DKW = 10;
  var PDEM_HYB_IN_DKW = 500;
  var PDEM_HYB_OUT_DKW = 400;
  var PDEM_HYB_MID_DKW = 150;
  var PDEM_HYB_LOW_DKW = 100;
  var SOC_EV_IN_Q10000 = 3700;
  var SOC_EV_OUT_Q10000 = 3500;
  var SOC_LOW_Q10000 = 2500;
  var SOC_MID_Q10000 = 3000;

  var U16_MAX_D = 65535.0;
  var S16_MAX_D = 32767.0;
  var S16_MIN_D = -32768.0;

  // ===== Physical -> fixed-point quantization (== to_u16/to_s16 in C) =====
  function toU16(physical, scale) {
    var scaled = (physical * scale) + 0.5;
    if (!(scaled > 0.0)) { return 0; }
    if (scaled >= U16_MAX_D) { return U16_MAX_D; }
    return Math.trunc(scaled);
  }

  function toS16(physical, scale) {
    var scaled = physical * scale;
    scaled = (scaled >= 0.0) ? (scaled + 0.5) : (scaled - 0.5);
    if (scaled >= S16_MAX_D) { return S16_MAX_D; }
    if (scaled <= S16_MIN_D) { return S16_MIN_D; }
    return Math.trunc(scaled);
  }

  // input = { speed, P_dem, SOC, wEng } (physical) -> fixed-point struct
  function toFixedPoint(input) {
    return {
      speed_dkph: toU16(input.speed, 10.0),
      p_dem_dkw: toS16(input.P_dem, 10.0),
      soc_q10000: toU16(input.SOC, 10000.0),
      weng_rpm: toU16(input.wEng, 1.0)
    };
  }

  // ===== Atomic condition flags (one condition each, explicit branch) =====
  // Returned as 0/1 so `&`/`|` combine exactly like the C uint8_t flags.
  function flagSpeedGtStop(fx) { if (fx.speed_dkph > SPEED_STOP_DKPH) { return 1; } return 0; }
  function flagSpeedLeStop(fx) { if (fx.speed_dkph <= SPEED_STOP_DKPH) { return 1; } return 0; }
  function flagSpeedGtRegen(fx) { if (fx.speed_dkph > SPEED_REGEN_DKPH) { return 1; } return 0; }
  function flagSpeedGtEvMax(fx) { if (fx.speed_dkph > SPEED_EV_MAX_DKPH) { return 1; } return 0; }
  function flagSpeedLeEvMax(fx) { if (fx.speed_dkph <= SPEED_EV_MAX_DKPH) { return 1; } return 0; }
  function flagPDemLeRegen(fx) { if (fx.p_dem_dkw <= PDEM_REGEN_DKW) { return 1; } return 0; }
  function flagPDemGeHybIn(fx) { if (fx.p_dem_dkw >= PDEM_HYB_IN_DKW) { return 1; } return 0; }
  function flagPDemLeHybOut(fx) { if (fx.p_dem_dkw <= PDEM_HYB_OUT_DKW) { return 1; } return 0; }
  function flagPDemLeStopHigh(fx) { if (fx.p_dem_dkw <= PDEM_STOP_HIGH_DKW) { return 1; } return 0; }
  function flagPDemGeStopLow(fx) { if (fx.p_dem_dkw >= PDEM_STOP_LOW_DKW) { return 1; } return 0; }
  function flagPDemGeHybMid(fx) { if (fx.p_dem_dkw >= PDEM_HYB_MID_DKW) { return 1; } return 0; }
  function flagPDemLeHybLow(fx) { if (fx.p_dem_dkw <= PDEM_HYB_LOW_DKW) { return 1; } return 0; }
  function flagSocGeEvIn(fx) { if (fx.soc_q10000 >= SOC_EV_IN_Q10000) { return 1; } return 0; }
  function flagSocLtEvOut(fx) { if (fx.soc_q10000 < SOC_EV_OUT_Q10000) { return 1; } return 0; }
  function flagSocGeMid(fx) { if (fx.soc_q10000 >= SOC_MID_Q10000) { return 1; } return 0; }
  function flagSocLtLow(fx) { if (fx.soc_q10000 < SOC_LOW_Q10000) { return 1; } return 0; }
  function flagWengGtOn(fx) { if (fx.weng_rpm > ENG_ON_RPM) { return 1; } return 0; }
  function flagWengLeOff(fx) { if (fx.weng_rpm <= ENG_OFF_RPM) { return 1; } return 0; }

  // ===== Transition guards (flags evaluated eagerly, then combined) =====
  function guardStandstillToEv(fx) {
    var speedGtStop = flagSpeedGtStop(fx);
    var speedLeEvMax = flagSpeedLeEvMax(fx);
    var socGeEvIn = flagSocGeEvIn(fx);
    return (speedGtStop & speedLeEvMax & socGeEvIn) !== 0;
  }

  function guardStandstillToStart(fx) {
    return flagSpeedGtStop(fx) !== 0;
  }

  function guardToRegenb(fx) {
    var speedGtRegen = flagSpeedGtRegen(fx);
    var pDemLeRegen = flagPDemLeRegen(fx);
    return (speedGtRegen & pDemLeRegen) !== 0;
  }

  function guardEvToStart(fx) {
    var speedGtEvMax = flagSpeedGtEvMax(fx);
    var pDemGeHybIn = flagPDemGeHybIn(fx);
    var socLtEvOut = flagSocLtEvOut(fx);
    return (speedGtEvMax | pDemGeHybIn | socLtEvOut) !== 0;
  }

  function guardToStandstill(fx) {
    var speedLeStop = flagSpeedLeStop(fx);
    var pDemLeStopHigh = flagPDemLeStopHigh(fx);
    var pDemGeStopLow = flagPDemGeStopLow(fx);
    return (speedLeStop & pDemLeStopHigh & pDemGeStopLow) !== 0;
  }

  function guardRegenbToStart(fx) {
    var speedGtEvMax = flagSpeedGtEvMax(fx);
    var pDemGeStopLow = flagPDemGeStopLow(fx);
    var socLtEvOut = flagSocLtEvOut(fx);
    var highSpeedPositiveDemand = speedGtEvMax & pDemGeStopLow;
    return (highSpeedPositiveDemand | socLtEvOut) !== 0;
  }

  function guardRegenbToEv(fx) {
    var pDemGeStopLow = flagPDemGeStopLow(fx);
    var speedGtStop = flagSpeedGtStop(fx);
    return (pDemGeStopLow & speedGtStop) !== 0;
  }

  function guardMotionToEv(fx) {
    var wengGtOn = flagWengGtOn(fx);
    var pDemLeHybOut = flagPDemLeHybOut(fx);
    var pDemGeStopLow = flagPDemGeStopLow(fx);
    var speedGtStop = flagSpeedGtStop(fx);
    var speedLeEvMax = flagSpeedLeEvMax(fx);
    var socGeEvIn = flagSocGeEvIn(fx);
    return (wengGtOn & pDemLeHybOut & pDemGeStopLow & speedGtStop & speedLeEvMax & socGeEvIn) !== 0;
  }

  function guardStartToHybrid(fx) {
    var wengGtOn = flagWengGtOn(fx);
    var socGeMid = flagSocGeMid(fx);
    var speedGtEvMax = flagSpeedGtEvMax(fx);
    var pDemGeHybMid = flagPDemGeHybMid(fx);
    var highLoad = speedGtEvMax | pDemGeHybMid;
    return (wengGtOn & socGeMid & highLoad) !== 0;
  }

  function guardStartToIce(fx) {
    return flagWengGtOn(fx) !== 0;
  }

  function guardIceToHybrid(fx) {
    var pDemGeHybMid = flagPDemGeHybMid(fx);
    var socGeMid = flagSocGeMid(fx);
    return (pDemGeHybMid & socGeMid) !== 0;
  }

  function guardHybridToIce(fx) {
    var pDemLeHybLow = flagPDemLeHybLow(fx);
    var socLtLow = flagSocLtLow(fx);
    return (pDemLeHybLow | socLtLow) !== 0;
  }

  // ===== Per-state handlers (priority order mirrors the C exactly) =====
  function handleStandstill(fx) {
    if (guardStandstillToEv(fx)) { return MODE_EV; }
    if (guardStandstillToStart(fx)) { return MODE_START; }
    return MODE_STANDSTILL;
  }

  function handleEv(fx) {
    if (guardToRegenb(fx)) { return MODE_REGENB; }
    if (guardEvToStart(fx)) { return MODE_START; }
    if (guardToStandstill(fx)) { return MODE_STANDSTILL; }
    return MODE_EV;
  }

  function handleRegenb(fx) {
    if (guardRegenbToStart(fx)) { return MODE_START; }
    if (guardToStandstill(fx)) { return MODE_STANDSTILL; }
    if (guardRegenbToEv(fx)) { return MODE_EV; }
    return MODE_REGENB;
  }

  // Shared exit from Motion_mode_ICE (START, ICE, HYBRID).
  function motionIceCommonExit(fx, currentInBlock) {
    var toRegenb = flagWengGtOn(fx) & (guardToRegenb(fx) ? 1 : 0);
    if (toRegenb !== 0) { return MODE_REGENB; }
    if (guardMotionToEv(fx)) { return MODE_EV; }
    if (guardToStandstill(fx)) { return MODE_STANDSTILL; }
    return currentInBlock;
  }

  function internalMotionIceReset(fx, currentInBlock) {
    if (flagWengLeOff(fx) !== 0) { return MODE_START; }
    return currentInBlock;
  }

  function handleStart(fx) {
    var next = motionIceCommonExit(fx, MODE_START);
    if (next === MODE_START) {
      if (guardStartToHybrid(fx)) { next = MODE_HYBRID; }
      else if (guardStartToIce(fx)) { next = MODE_ICE; }
    }
    return next;
  }

  function handleIce(fx) {
    var next = motionIceCommonExit(fx, MODE_ICE);
    if (next === MODE_ICE) { next = internalMotionIceReset(fx, next); }
    if (next === MODE_ICE) {
      if (guardIceToHybrid(fx)) { next = MODE_HYBRID; }
    }
    return next;
  }

  function handleHybrid(fx) {
    var next = motionIceCommonExit(fx, MODE_HYBRID);
    if (next === MODE_HYBRID) { next = internalMotionIceReset(fx, next); }
    if (next === MODE_HYBRID) {
      if (guardHybridToIce(fx)) { next = MODE_ICE; }
    }
    return next;
  }

  // Next mode from (current mode, fixed-point inputs) — == ModeLogic_Step FSM.
  function stepModeFixed(currentMode, fx) {
    switch (currentMode) {
      case MODE_STANDSTILL: return handleStandstill(fx);
      case MODE_EV: return handleEv(fx);
      case MODE_REGENB: return handleRegenb(fx);
      case MODE_START: return handleStart(fx);
      case MODE_ICE: return handleIce(fx);
      case MODE_HYBRID: return handleHybrid(fx);
      default: return MODE_STANDSTILL;
    }
  }

  // Centralized output mapping (== write_outputs in C).
  function writeOutputs(mode) {
    switch (mode) {
      case MODE_EV: return { Mot_Enable: 1, Gen_Enable: 0, ICE_Enable: 0 };
      case MODE_REGENB: return { Mot_Enable: 1, Gen_Enable: 0, ICE_Enable: 0 };
      case MODE_START: return { Mot_Enable: 1, Gen_Enable: 1, ICE_Enable: 0 };
      case MODE_ICE: return { Mot_Enable: 0, Gen_Enable: 1, ICE_Enable: 1 };
      case MODE_HYBRID: return { Mot_Enable: 1, Gen_Enable: 1, ICE_Enable: 1 };
      case MODE_STANDSTILL:
      default: return { Mot_Enable: 0, Gen_Enable: 0, ICE_Enable: 0 };
    }
  }

  // Convenience: one step from fixed-point inputs -> { mode, outputs }.
  function stepFixed(currentMode, fx) {
    var mode = stepModeFixed(currentMode, fx);
    return { mode: mode, outputs: writeOutputs(mode) };
  }

  // Convenience: one step from PHYSICAL inputs (quantizes first) — for the UI.
  function stepPhysical(currentMode, input) {
    var fx = toFixedPoint(input);
    var mode = stepModeFixed(currentMode, fx);
    return { mode: mode, fx: fx, outputs: writeOutputs(mode) };
  }

  return {
    // enum + names
    MODE_STANDSTILL: MODE_STANDSTILL, MODE_EV: MODE_EV, MODE_REGENB: MODE_REGENB,
    MODE_START: MODE_START, MODE_ICE: MODE_ICE, MODE_HYBRID: MODE_HYBRID,
    MODE_NAMES: MODE_NAMES, MODE_SHORT_NAMES: MODE_SHORT_NAMES, STATE_NAMES: STATE_NAMES,
    // thresholds (exposed for the UI panel + battery flow hints)
    thresholds: {
      ENG_ON_RPM: ENG_ON_RPM, ENG_OFF_RPM: ENG_OFF_RPM,
      SPEED_STOP_DKPH: SPEED_STOP_DKPH, SPEED_REGEN_DKPH: SPEED_REGEN_DKPH, SPEED_EV_MAX_DKPH: SPEED_EV_MAX_DKPH,
      PDEM_REGEN_DKW: PDEM_REGEN_DKW, PDEM_STOP_LOW_DKW: PDEM_STOP_LOW_DKW, PDEM_STOP_HIGH_DKW: PDEM_STOP_HIGH_DKW,
      PDEM_HYB_IN_DKW: PDEM_HYB_IN_DKW, PDEM_HYB_OUT_DKW: PDEM_HYB_OUT_DKW, PDEM_HYB_MID_DKW: PDEM_HYB_MID_DKW,
      PDEM_HYB_LOW_DKW: PDEM_HYB_LOW_DKW, SOC_EV_IN_Q10000: SOC_EV_IN_Q10000, SOC_EV_OUT_Q10000: SOC_EV_OUT_Q10000,
      SOC_LOW_Q10000: SOC_LOW_Q10000, SOC_MID_Q10000: SOC_MID_Q10000
    },
    // quantization
    toU16: toU16, toS16: toS16, toFixedPoint: toFixedPoint,
    // core FSM
    stepModeFixed: stepModeFixed, writeOutputs: writeOutputs,
    stepFixed: stepFixed, stepPhysical: stepPhysical
  };
});
