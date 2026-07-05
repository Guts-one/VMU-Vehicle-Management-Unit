/* Coverage driver for mode_logic.js — run under c8 (see `npm run coverage`).
 *
 * Replays the +/-1 LSB boundary stimulus (the MC/DC-grade set that already
 * gives the C 86/86 condition outcomes) through the web simulator's logic, so
 * c8 branch coverage of mode_logic.js == condition-outcome coverage. Because
 * every guard is an atomic-predicate tree (mirroring the C's flag* functions),
 * full branch coverage of those predicates is MC/DC by the same tree-likeness
 * argument the repo makes for the C (mcdc-checker).
 *
 * Plus two defensive calls that hit the unreachable `default` switch arms — the
 * JS analog of the C's defensive defaults, which the Unity suite covers so the
 * boundary set alone does not have to.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ModeLogic = require('../../mode_logic.js');

var REPO_ROOT = path.resolve(__dirname, '..', '..');
var STIMULUS = path.join(REPO_ROOT, 'verification', 'equivalence_live', 'boundary_stimulus.csv');

function main() {
  var text = fs.readFileSync(STIMULUS, 'utf8');
  var lines = text.split('\n').filter(function (l) { return l.length > 0; });
  var header = lines[0].replace(/\r$/, '').split(',');
  var idx = {
    s: header.indexOf('speed_dkph'),
    p: header.indexOf('p_dem_dkw'),
    c: header.indexOf('soc_q10000'),
    w: header.indexOf('weng_rpm_fx')
  };

  var mode = ModeLogic.MODE_STANDSTILL;
  var rows = 0;
  for (var i = 1; i < lines.length; i++) {
    var f = lines[i].replace(/\r$/, '').split(',');
    var fx = {
      speed_dkph: parseInt(f[idx.s], 10),
      p_dem_dkw: parseInt(f[idx.p], 10),
      soc_q10000: parseInt(f[idx.c], 10),
      weng_rpm: parseInt(f[idx.w], 10)
    };
    mode = ModeLogic.stepModeFixed(mode, fx);
    ModeLogic.writeOutputs(mode);
    rows++;
  }

  // Defensive defaults (unreachable in a valid FSM run) — mirror the C's
  // defensive switch defaults, exercised so branch coverage is complete.
  var dummyFx = { speed_dkph: 0, p_dem_dkw: 0, soc_q10000: 0, weng_rpm: 0 };
  ModeLogic.stepModeFixed(255, dummyFx);
  ModeLogic.writeOutputs(255);

  // Exercise the physical->fixed-point helpers and convenience wrappers (the
  // UI-facing API the boundary harness bypasses), including the toU16/toS16
  // saturation branches, so the whole public surface is covered.
  ModeLogic.toU16(-1.0, 10.0);          // <= 0 -> 0
  ModeLogic.toU16(1e9, 10.0);           // >= U16_MAX -> saturate high
  ModeLogic.toS16(1e9, 10.0);           // >= S16_MAX -> saturate high
  ModeLogic.toS16(-1e9, 10.0);          // <= S16_MIN -> saturate low
  ModeLogic.toFixedPoint({ speed: 35.0, P_dem: -5.0, SOC: 0.40, wEng: 900 });
  ModeLogic.stepFixed(ModeLogic.MODE_STANDSTILL, dummyFx);
  ModeLogic.stepPhysical(ModeLogic.MODE_STANDSTILL, { speed: 20, P_dem: 0, SOC: 0.40, wEng: 500 });

  console.log('coverage driver: replayed ' + rows + ' boundary rows + defensive + full-API calls');
}

main();
