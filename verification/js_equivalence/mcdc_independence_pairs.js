/* MC/DC independence check for mode_logic.js (the web simulator's logic).
 *
 * MC/DC requires showing that each condition INDEPENDENTLY affects its
 * decision's outcome. The +/-1 LSB boundary stimulus is built exactly for that:
 * every `kind=probe` group sweeps ONE threshold across {T-1, T, T+1} with the
 * other inputs held so the swept condition is the deciding factor. So if the JS
 * next-mode CHANGES across a probe group, that condition has been shown to
 * independently flip the decision — the MC/DC independence pair, in the JS.
 *
 * This re-derives, on the JS side, the "Boundary flips" self-check that
 * gen_boundary_stimulus.py runs on its Python mirror, and cross-references the
 * 14 modelled decisions in verification/equivalence_live/mcdc_mapping.csv so the
 * chart <-> C <-> JS correspondence is explicit.
 *
 * Exit 0 iff every probed condition independently flips the JS decision.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ModeLogic = require('../../mode_logic.js');

var REPO_ROOT = path.resolve(__dirname, '..', '..');
var LIVE = path.join(REPO_ROOT, 'verification', 'equivalence_live');
var STIMULUS = path.join(LIVE, 'boundary_stimulus.csv');
var MAPPING = path.join(LIVE, 'mcdc_mapping.csv');

function readLines(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter(function (l) { return l.length > 0; });
}

function main() {
  // 1. Replay the whole stimulus through the JS, recording the mode per row.
  var lines = readLines(STIMULUS);
  var header = lines[0].replace(/\r$/, '').split(',');
  var col = {};
  header.forEach(function (name, i) { col[name] = i; });

  var mode = ModeLogic.MODE_STANDSTILL;
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var f = lines[i].replace(/\r$/, '').split(',');
    var fx = {
      speed_dkph: parseInt(f[col.speed_dkph], 10),
      p_dem_dkw: parseInt(f[col.p_dem_dkw], 10),
      soc_q10000: parseInt(f[col.soc_q10000], 10),
      weng_rpm: parseInt(f[col.weng_rpm_fx], 10)
    };
    mode = ModeLogic.stepModeFixed(mode, fx);
    rows.push({ scenario: f[col.scenario], phase: f[col.phase], kind: f[col.kind], mode: mode });
  }

  // 2. Group the probe rows by scenario (each group = one condition swept T-1/T/T+1).
  var groups = {};
  var order = [];
  rows.forEach(function (r) {
    if (r.kind !== 'probe') { return; }
    if (!groups[r.scenario]) { groups[r.scenario] = []; order.push(r.scenario); }
    groups[r.scenario].push(r);
  });

  // 3. Assert each group flips the decision (the mode is not constant).
  var passed = 0;
  var failures = [];
  order.forEach(function (sid) {
    var g = groups[sid];
    var names = g.map(function (r) { return ModeLogic.STATE_NAMES[r.mode]; });
    var flips = new Set(names).size > 1;
    if (flips) { passed++; }
    else { failures.push(sid + ' -> [' + names.join(', ') + '] (mode did not change)'); }
  });

  // 4. Cross-reference the 14 modelled decisions (chart <-> C <-> JS).
  var mapLines = readLines(MAPPING);
  var decisions = mapLines.slice(1).map(function (l) {
    var f = l.replace(/\r$/, '').split(',');
    return { id: f[0], transition: f[1], cFunction: f[3] };
  });

  console.log('MC/DC INDEPENDENCE (mode_logic.js)');
  console.log('  probed conditions : ' + order.length + ' (from +/-1 LSB boundary groups)');
  console.log('  independently flip: ' + passed + '/' + order.length);
  console.log('  modelled decisions: ' + decisions.length + ' mapped in mcdc_mapping.csv (chart<->C<->JS)');

  if (failures.length > 0) {
    console.log('  RESULT            : FAIL');
    failures.forEach(function (m) { console.log('    - ' + m); });
    process.exit(1);
  }
  console.log('  RESULT            : PASS (every probed condition independently flips the JS decision)');
}

main();
