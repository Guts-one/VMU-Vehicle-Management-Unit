/* One-shot orchestrator for the JS <-> C equivalence gate (see `npm run verify`).
 *
 * Deterministic, reproducible, and cross-platform (Windows dev + Linux CI):
 *   1. regenerate the +/-1 LSB boundary stimulus (reuses the equivalence_live
 *      Python generator — NOT modified, only executed);
 *   2. compile the compiled-C oracle mode_probe.c + src/mode_logic_team.c
 *      (equivalence_live/mode_probe.c is NOT modified, only compiled);
 *   3. run the oracle over the stimulus -> probe_out.csv;
 *   4. run the JS<->C differential harness (state + outputs, 0 mismatches);
 *   5. run the MC/DC independence check.
 *
 * Exits non-zero if any step fails, so CI gates on it.
 */
'use strict';

var cp = require('child_process');
var fs = require('fs');
var path = require('path');

var REPO_ROOT = path.resolve(__dirname, '..', '..');
var LIVE = path.join(REPO_ROOT, 'verification', 'equivalence_live');
var HERE = __dirname;
var STIMULUS = path.join(LIVE, 'boundary_stimulus.csv');
var PROBE_SRC = path.join(LIVE, 'mode_probe.c');
var MODE_SRC = path.join(REPO_ROOT, 'src', 'mode_logic_team.c');
var PROBE_EXE = path.join(HERE, process.platform === 'win32' ? 'mode_probe.exe' : 'mode_probe');
var PROBE_OUT = path.join(HERE, 'probe_out.csv');

function run(cmd, args, opts) {
  console.log('\n$ ' + cmd + ' ' + args.join(' '));
  var r = cp.spawnSync(cmd, args, Object.assign({ stdio: 'inherit', cwd: REPO_ROOT }, opts || {}));
  if (r.error) { throw r.error; }
  if (r.status !== 0) { throw new Error(cmd + ' exited with code ' + r.status); }
}

function firstAvailable(cmds) {
  for (var i = 0; i < cmds.length; i++) {
    var probe = cp.spawnSync(cmds[i], ['--version'], { stdio: 'ignore' });
    if (!probe.error && probe.status === 0) { return cmds[i]; }
  }
  return null;
}

function main() {
  if (!fs.existsSync(PROBE_SRC)) {
    throw new Error('missing ' + PROBE_SRC + ' — this harness reuses verification/' +
      'equivalence_live/; make sure that folder is present in the checkout.');
  }

  // 1. Regenerate the boundary stimulus (deterministic).
  var py = firstAvailable(['python3', 'python']);
  if (!py) { throw new Error('python3/python not found on PATH'); }
  run(py, ['gen_boundary_stimulus.py'], { cwd: LIVE });

  // 2. Compile the compiled-C oracle.
  var cc = firstAvailable(['gcc', 'cc']);
  if (!cc) { throw new Error('gcc/cc not found on PATH'); }
  run(cc, ['-std=c99', '-Wall', '-Wextra', '-I', path.join(REPO_ROOT, 'inc'),
    PROBE_SRC, MODE_SRC, '-o', PROBE_EXE]);

  // 3. Run the oracle over the stimulus.
  console.log('\n$ mode_probe ' + path.relative(REPO_ROOT, STIMULUS));
  var probe = cp.spawnSync(PROBE_EXE, [STIMULUS], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (probe.error) { throw probe.error; }
  fs.writeFileSync(PROBE_OUT, probe.stdout);
  process.stderr.write(probe.stderr || '');   // MODE_PROBE rows=.. result=..
  // mode_probe exits non-zero if its Python mirror != compiled C.
  if (probe.status !== 0) { throw new Error('mode_probe reported mirror divergence'); }

  // 4 + 5. JS<->C differential + MC/DC independence.
  run(process.execPath, [path.join(HERE, 'run_js_equivalence.js'),
    '--probe-out', PROBE_OUT, '--out', path.join(HERE, 'js_out.csv')]);
  run(process.execPath, [path.join(HERE, 'mcdc_independence_pairs.js')]);

  console.log('\nJS<->C equivalence gate: PASS');
}

try {
  main();
} catch (e) {
  console.error('\nJS<->C equivalence gate: FAIL — ' + e.message);
  process.exit(1);
}
