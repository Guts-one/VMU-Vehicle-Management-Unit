/* JS <-> C differential equivalence harness for the VMU mode logic.
 *
 * Drives the SAME deterministic stimulus that already validates the C and the
 * Stateflow chart (verification/equivalence_live/boundary_stimulus.csv, the
 * +/-1 LSB boundary set) through the web simulator's logic module
 * (mode_logic.js) and compares, per row:
 *
 *   (1) STATE  : JS next mode  vs  the CSV `exp_mode_c` column
 *                (the Python mirror, already cross-checked == compiled C by
 *                 verification/equivalence_live/mode_probe.c).
 *   (2) STATE + OUTPUTS : JS mode + Mot/Gen/ICE  vs  the compiled C output
 *                (mode_probe.c run over the same CSV), when a probe output CSV
 *                is supplied via --probe-out.
 *
 * State is a first-class assertion (not just the three enables): EV and REGENB
 * share the output triple {Mot:1,Gen:0,ICE:0}, so an outputs-only diff would
 * mask an EV<->REGENB state divergence until it blows up on a later step. This
 * mirrors improvement (d) "State equivalence" in equivalence_live, but for free
 * here because both C and JS expose current_mode as a plain Mode_t integer.
 *
 * Because both sides operate on the SAME quantized fixed-point integers, there
 * is no half-LSB band on the JS<->C axis: every row (including kind=subLSB)
 * must match exactly.
 *
 * Usage:
 *   node run_js_equivalence.js [--stimulus <csv>] [--probe-out <csv>] [--out <csv>]
 * Exit code 0 iff every row matches on every checked axis.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ModeLogic = require('../../mode_logic.js');

var REPO_ROOT = path.resolve(__dirname, '..', '..');

function parseArgs(argv) {
  var out = {
    stimulus: path.join(REPO_ROOT, 'verification', 'equivalence_live', 'boundary_stimulus.csv'),
    probeOut: null,
    out: null
  };
  for (var i = 2; i < argv.length; i++) {
    var a = argv[i];
    if (a === '--stimulus') { out.stimulus = argv[++i]; }
    else if (a === '--probe-out') { out.probeOut = argv[++i]; }
    else if (a === '--out') { out.out = argv[++i]; }
    else { throw new Error('unknown argument: ' + a); }
  }
  return out;
}

function splitCsvLine(line) {
  return line.replace(/\r$/, '').split(',');
}

// Read a CSV into { header: [...], rows: [ {col: value, ...}, ... ] }.
function readCsv(file) {
  var text = fs.readFileSync(file, 'utf8');
  var lines = text.split('\n').filter(function (l) { return l.length > 0; });
  if (lines.length === 0) { throw new Error('empty CSV: ' + file); }
  var header = splitCsvLine(lines[0]);
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var fields = splitCsvLine(lines[i]);
    var row = {};
    for (var c = 0; c < header.length; c++) { row[header[c]] = fields[c]; }
    rows.push(row);
  }
  return { header: header, rows: rows };
}

function requireCols(header, cols, file) {
  cols.forEach(function (name) {
    if (header.indexOf(name) < 0) {
      throw new Error('stimulus ' + file + ' is missing required column: ' + name);
    }
  });
}

function main() {
  var args = parseArgs(process.argv);
  var stim = readCsv(args.stimulus);
  requireCols(stim.header,
    ['speed_dkph', 'p_dem_dkw', 'soc_q10000', 'weng_rpm_fx', 'exp_mode_c'],
    args.stimulus);

  // Optional compiled-C oracle (mode_probe.c output over the same stimulus).
  var probe = null;
  if (args.probeOut) {
    probe = readCsv(args.probeOut);
    requireCols(probe.header, ['mode', 'Mot', 'Gen', 'ICE'], args.probeOut);
    if (probe.rows.length !== stim.rows.length) {
      throw new Error('probe-out has ' + probe.rows.length + ' rows, stimulus has ' +
        stim.rows.length + ' — they must be the same run');
    }
  }

  var currentMode = ModeLogic.MODE_STANDSTILL;   // init once, like mode_probe.c
  var stateMismatches = 0;   // JS vs exp_mode_c
  var fullMismatches = 0;    // JS vs compiled C (mode + enables)
  var outRows = [];
  var firstFailures = [];

  for (var i = 0; i < stim.rows.length; i++) {
    var r = stim.rows[i];
    var fx = {
      speed_dkph: parseInt(r.speed_dkph, 10),
      p_dem_dkw: parseInt(r.p_dem_dkw, 10),
      soc_q10000: parseInt(r.soc_q10000, 10),
      weng_rpm: parseInt(r.weng_rpm_fx, 10)
    };
    var next = ModeLogic.stepModeFixed(currentMode, fx);
    var out = ModeLogic.writeOutputs(next);
    currentMode = next;

    var jsName = ModeLogic.STATE_NAMES[next];
    var expName = (r.exp_mode_c || '').trim();
    var stateMatch = (jsName === expName);
    if (!stateMatch) {
      stateMismatches++;
      if (firstFailures.length < 10) {
        firstFailures.push('row ' + i + ' (' + (r.scenario || '') + '): JS=' + jsName +
          ' exp_mode_c=' + expName);
      }
    }

    var fullMatch = true;
    if (probe) {
      var p = probe.rows[i];
      fullMatch = (jsName === (p.mode || '').trim()) &&
        (out.Mot_Enable === parseInt(p.Mot, 10)) &&
        (out.Gen_Enable === parseInt(p.Gen, 10)) &&
        (out.ICE_Enable === parseInt(p.ICE, 10));
      if (!fullMatch) {
        fullMismatches++;
        if (firstFailures.length < 10) {
          firstFailures.push('row ' + i + ' (' + (r.scenario || '') + '): JS=[' + jsName +
            ' ' + out.Mot_Enable + out.Gen_Enable + out.ICE_Enable + '] C=[' +
            (p.mode || '').trim() + ' ' + p.Mot + p.Gen + p.ICE + ']');
        }
      }
    }

    outRows.push([i, r.scenario || '', r.kind || '', jsName,
      out.Mot_Enable, out.Gen_Enable, out.ICE_Enable, expName,
      stateMatch ? 1 : 0, probe ? (fullMatch ? 1 : 0) : ''].join(','));
  }

  if (args.out) {
    fs.writeFileSync(args.out,
      'row,scenario,kind,js_mode,Mot,Gen,ICE,exp_mode_c,state_match,full_match\n' +
      outRows.join('\n') + '\n');
  }

  var rows = stim.rows.length;
  console.log('JS<->C EQUIVALENCE');
  console.log('  stimulus         : ' + path.relative(REPO_ROOT, args.stimulus).replace(/\\/g, '/'));
  console.log('  rows             : ' + rows);
  console.log('  state vs mirror  : ' + (rows - stateMismatches) + '/' + rows +
    ' match (exp_mode_c)');
  if (probe) {
    console.log('  state+outputs vs C: ' + (rows - fullMismatches) + '/' + rows +
      ' match (compiled mode_probe.c)');
  } else {
    console.log('  state+outputs vs C: skipped (no --probe-out; pass the compiled ' +
      'mode_probe.c output for the full check)');
  }

  var failed = stateMismatches > 0 || fullMismatches > 0;
  if (failed) {
    console.log('  RESULT           : MISMATCH');
    console.log('  first divergences:');
    firstFailures.forEach(function (f) { console.log('    - ' + f); });
    process.exit(1);
  }
  console.log('  RESULT           : MATCH (0 mismatches)');
}

main();
