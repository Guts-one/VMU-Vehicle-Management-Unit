/* Validate full-model recordings against C/JS and build the offline browser data. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const ML = require(path.join(root, 'mode_logic.js'));
const build = path.join(root, 'build/model_replay');
const recordings = path.join(__dirname, 'recordings');
const dataFile = path.join(root, 'web/model-replays.js');
const header = 'time_s,speed_kmh,engine_rpm,power_kw,soc,mode,motor_enabled,generator_enabled,engine_enabled';
const hash = content => crypto.createHash('sha256').update(content).digest('hex');

function readRecordings(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.sample_time_s, 0.1);
  for (const source of manifest.sources) {
    assert.equal(hash(fs.readFileSync(path.join(root, source.path))), source.sha256,
      source.path + ': recording source changed; export and validate fresh recordings');
  }
  const cycles = {};
  for (const cycle of manifest.cycles) {
    assert.match(cycle.id, /^urban[12]$/);
    assert.equal(cycle.file, cycle.id + '.csv');
    const bytes = fs.readFileSync(path.join(directory, cycle.file));
    assert.equal(hash(bytes), cycle.sha256, cycle.id + ': CSV hash differs from MATLAB export');
    const lines = bytes.toString('utf8').trim().split(/\r?\n/);
    assert.equal(lines.shift(), header);
    const rows = lines.map(line => line.split(',').map(Number));
    assert.equal(rows.length, cycle.samples);
    assert.equal(rows.length, Math.round(cycle.duration_s / manifest.sample_time_s) + 1);
    rows.forEach((row, index) => {
      assert.equal(row.length, 9);
      assert.ok(row.every(Number.isFinite));
      assert.ok(Math.abs(row[0] - index * manifest.sample_time_s) < 1e-7);
      assert.ok(row[4] >= 0 && row[4] <= 1, cycle.id + ': invalid battery fraction');
      assert.ok(Number.isInteger(row[5]) && row[5] >= 0 && row[5] < 6);
      assert.ok(row.slice(6).every(value => value === 0 || value === 1));
      assert.deepEqual(row.slice(6), Object.values(ML.writeOutputs(row[5])), cycle.id + ': invalid recorded enable mapping');
    });
    cycles[cycle.id] = { ...cycle, rows };
  }
  assert.deepEqual(Object.keys(cycles), ['urban1', 'urban2']);
  return { manifest, cycles };
}

function compare(cycles) {
  fs.mkdirSync(build, { recursive: true });
  const exe = path.join(build, process.platform === 'win32' ? 'mode_probe.exe' : 'mode_probe');
  cp.execFileSync(process.env.CC || 'gcc', ['-std=c99', '-Wall', '-Wextra', '-I', 'inc',
    'verification/equivalence_live/mode_probe.c', 'src/mode_logic_team.c', '-o', path.relative(root, exe)], { cwd: root });
  const results = [];
  for (const [id, cycle] of Object.entries(cycles)) {
    let mode = ML.MODE_STANDSTILL;
    const expected = [];
    const fixedRows = ['time_s,speed_kmh,engine_rpm,power_kw,soc'];
    const probeRows = ['row,scenario,phase,kind,speed_dkph,p_dem_dkw,soc_q10000,weng_rpm_fx,exp_mode_c'];
    const modelDifferences = [];
    cycle.rows.forEach((row, index) => {
      const input = { speed: row[1], wEng: row[2], P_dem: row[3], SOC: row[4] };
      const result = ML.stepPhysical(mode, input);
      mode = result.mode;
      const outputs = [result.outputs.Mot_Enable, result.outputs.Gen_Enable, result.outputs.ICE_Enable];
      expected.push([mode, ...outputs]);
      const fx = result.fx;
      fixedRows.push([row[0], fx.speed_dkph / 10, fx.weng_rpm, fx.p_dem_dkw / 10, fx.soc_q10000 / 10000].join(','));
      probeRows.push([index, id, row[0], 'recorded', fx.speed_dkph, fx.p_dem_dkw,
        fx.soc_q10000, fx.weng_rpm, ML.STATE_NAMES[mode]].join(','));
      if (mode !== row[5] || outputs.some((value, i) => value !== row[i + 6])) {
        modelDifferences.push({ sample: index, time_s: row[0], model_mode: row[5], c_js_mode: mode,
          input, fixed_input: fx, model_outputs: row.slice(6), c_js_outputs: outputs });
      }
    });
    const inputPath = path.join(build, id + '-probe-input.csv');
    fs.writeFileSync(inputPath, probeRows.join('\n') + '\n');
    fs.writeFileSync(path.join(build, id + '-fixed.csv'), fixedRows.join('\n') + '\n');
    const probe = cp.spawnSync(exe, [path.relative(root, inputPath)], { cwd: root, encoding: 'utf8' });
    if (probe.error) throw probe.error;
    fs.writeFileSync(path.join(build, id + '-c.csv'), probe.stdout.replace(/\r\n/g, '\n'));
    assert.equal(probe.status, 0, probe.stderr);
    const rows = probe.stdout.trim().split(/\r?\n/).slice(1).map(line => line.split(','));
    assert.equal(rows.length, cycle.rows.length);
    rows.forEach((row, index) => {
      assert.equal(row[4], ML.STATE_NAMES[expected[index][0]], id + ': C/JS state mismatch');
      assert.deepEqual(row.slice(5, 8).map(Number), expected[index].slice(1), id + ': C/JS output mismatch');
    });
    const result = { id, samples: rows.length, c_js_mismatches: 0,
      model_c_js_mismatches: modelDifferences.length, differences: modelDifferences };
    results.push(result);
    console.log(id + ': ' + rows.length + ' samples; C/JS exact; recorded model differences: ' + modelDifferences.length);
  }
  return results;
}

function browserData(manifest, cycles) {
  return { schemaVersion: 1, sampleTime: manifest.sample_time_s,
    generatedAt: manifest.generated_at_utc, model: manifest.model,
    columns: header.split(',').slice(1),
    cycles: Object.fromEntries(Object.entries(cycles).map(([id, cycle]) => [id, {
      name: cycle.name, duration: cycle.duration_s, sha256: cycle.sha256,
      rows: cycle.rows.map(row => row.slice(1))
    }])) };
}

function checkChartEvidence(manifest, cycles) {
  const evidence = JSON.parse(fs.readFileSync(path.join(recordings, 'chart-validation.json'), 'utf8'));
  assert.equal(evidence.source_model_sha256, manifest.sources[0].sha256);
  assert.equal(evidence.verifier_sha256, hash(fs.readFileSync(path.join(__dirname, 'verify_chart.m'))));
  assert.deepEqual(evidence.cycles.map(cycle => cycle.id), Object.keys(cycles));
  for (const cycle of evidence.cycles) {
    assert.equal(cycle.samples, cycles[cycle.id].samples);
    assert.equal(cycle.raw_chart_vs_plant_mismatches, 0);
    assert.equal(cycle.quantized_chart_vs_c_mismatches, 0);
    assert.equal(cycle.recording_sha256, cycles[cycle.id].sha256);
    for (const [suffix, key] of [['-fixed.csv', 'fixed_input_sha256'], ['-c.csv', 'c_output_sha256']]) {
      assert.equal(hash(fs.readFileSync(path.join(build, cycle.id + suffix))), cycle[key],
        cycle.id + ': chart evidence is stale; rerun verify_chart in MATLAB');
    }
  }
}

function bundle(data) {
  return '/* Generated from verified full-model recordings. Run npm run build:replays; do not edit. */\n' +
    '(function (root, factory) {\n' +
    '  if (typeof module === "object" && module.exports) module.exports = factory();\n' +
    '  else root.VmuModelReplays = factory();\n' +
    '})(typeof globalThis !== "undefined" ? globalThis : this, function () {\n' +
    '  return ' + JSON.stringify(data) + ';\n});\n';
}

function main() {
  const mode = process.argv[2] || '--check';
  assert.ok(['--check', '--build', '--inspect'].includes(mode), 'Use --check, --build, or --inspect [export directory]');
  const directory = process.argv[3] ? path.resolve(process.argv[3]) : recordings;
  const { manifest, cycles } = readRecordings(directory);
  const results = compare(cycles);
  const report = { schema_version: 1, sample_time_s: manifest.sample_time_s, cycles: results };
  fs.writeFileSync(path.join(build, 'comparison.json'), JSON.stringify(report, null, 2) + '\n');
  if (mode === '--inspect') return;
  checkChartEvidence(manifest, cycles);
  const browser = bundle(browserData(manifest, cycles));
  if (mode === '--build') {
    fs.writeFileSync(dataFile, browser);
  } else {
    assert.equal(fs.readFileSync(dataFile, 'utf8'), browser, 'Browser replay data is stale; run npm run build:replays');
  }
}
main();
