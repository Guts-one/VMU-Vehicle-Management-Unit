'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ML = require('../mode_logic.js');
const recordings = require('../web/model-replays.js');
const { Session, DEFAULT_INPUTS, PRESETS, CYCLES, MAX_RECORDS, sampleCycle } = require('../web/simulator-session.js');

test('a manual step evaluates exactly one transition and snapshots its applied input', () => {
  const session = new Session();
  const input = { speed: 50, wEng: 3500, P_dem: 45, SOC: 0.45 };
  session.step(input);
  assert.equal(session.mode, ML.MODE_START);
  session.step(input);
  assert.equal(session.mode, ML.MODE_HYBRID);
  assert.deepEqual(session.outputs, { Mot_Enable: 1, Gen_Enable: 1, ICE_Enable: 1 });
  input.speed = 0;
  assert.equal(session.input.speed, 50);
  assert.equal(session.records[0].input.speed, 50);
  assert.equal(session.steps, 2);
});

test('invalid, missing, and out-of-range input never advances the controller or log', () => {
  for (const invalid of [
    { speed: NaN }, { wEng: Infinity }, { P_dem: -40.1 }, { SOC: 1.001 },
    { speed: -1 }, { speed: 140.1 }, { wEng: 7001 }, { wEng: -1 },
    { P_dem: 80.1 }, { SOC: -0.1 }, { speed: '' }, { SOC: undefined }
  ]) {
    const session = new Session();
    assert.throws(() => session.step({ ...DEFAULT_INPUTS, ...invalid }), RangeError);
    assert.equal(session.mode, ML.MODE_STANDSTILL);
    assert.equal(session.steps, 0);
    assert.equal(session.records.length, 0);
    assert.deepEqual(session.input, DEFAULT_INPUTS);
  }
});

test('all six presets reach their named mode from every prior mode through recorded transitions', () => {
  for (let initial = 0; initial < 6; initial += 1) {
    for (let target = 0; target < 6; target += 1) {
      const session = new Session();
      session.preset(initial);
      session.clearData();
      session.preset(target);
      assert.equal(session.mode, target, PRESETS[initial].name + ' -> ' + PRESETS[target].name);
      assert.deepEqual(session.outputs, ML.writeOutputs(target));
      assert.ok(session.records.length >= 1 && session.records.length <= 3);
      if (target === ML.MODE_ICE || target === ML.MODE_HYBRID) {
        assert.equal(session.records[0].mode, ML.MODE_START);
      }
      assert.equal(session.records.at(-1).mode, target);
    }
  }
});

test('clearing recordings preserves the operating state; reset restores all defaults', () => {
  const session = new Session();
  session.preset(ML.MODE_HYBRID);
  const steps = session.steps;
  session.clearData();
  assert.equal(session.mode, ML.MODE_HYBRID);
  assert.equal(session.steps, steps);
  assert.equal(session.input.speed, 50);
  assert.equal(session.records.length, 0);
  session.reset();
  assert.equal(session.mode, ML.MODE_STANDSTILL);
  assert.equal(session.steps, 0);
  assert.deepEqual(session.input, DEFAULT_INPUTS);
  assert.deepEqual(session.outputs, { Mot_Enable: 0, Gen_Enable: 0, ICE_Enable: 0 });
});

test('full model playback preserves every input, mode and command without interpolation', () => {
  for (const kind of ['urban1', 'urban2']) {
    const session = new Session();
    for (let i = 0; i < CYCLES[kind].samples; i += 1) {
      const sample = session.replay(kind, i);
      const raw = recordings.cycles[kind].rows[i];
      assert.deepEqual([session.input.speed, session.input.wEng, session.input.P_dem, session.input.SOC], raw.slice(0, 4));
      assert.equal(session.mode, raw[4]);
      assert.deepEqual(Object.values(session.outputs), raw.slice(5));
      assert.equal(sample.time, i / 10);
      assert.equal(session.origin, 'model');
    }
    assert.equal(session.records.length, kind === 'urban1' ? 1951 : 4001);
    assert.equal(session.records.at(-1).time, CYCLES[kind].duration);
    assert.ok(session.records.some(row => row.input.speed < 0)); // Preserve solver residuals.
    assert.ok(session.records.some(row => row.mode === ML.MODE_EV && row.input.wEng > 0));
    assert.ok(session.records.some(row => row.mode === ML.MODE_REGENB));
    assert.ok(session.records.some(row => row.mode === ML.MODE_HYBRID));
  }
  assert.throws(() => sampleCycle('unknown', 0), RangeError);
  for (const index of [-1, 0.5, NaN, Infinity, 1951]) {
    assert.throws(() => sampleCycle('urban1', index), RangeError);
  }
  const sample = sampleCycle('urban1', 948);
  sample.input.speed = 0;
  assert.notEqual(sampleCycle('urban1', 948).input.speed, 0);
});

test('playback retains model decisions at quantization boundaries; manual stepping resumes JS', () => {
  const session = new Session();
  let fixedMode = ML.MODE_STANDSTILL;
  for (let i = 0; i <= 1631; i += 1) {
    const sample = session.replay('urban1', i);
    fixedMode = ML.stepPhysical(fixedMode, sample.input).mode;
  }
  assert.equal(session.mode, ML.MODE_START);
  assert.equal(fixedMode, ML.MODE_EV);
  const input = { speed: 35, wEng: 1112, P_dem: 0.2, SOC: 0.69 };
  const expected = ML.stepPhysical(session.mode, input);
  session.step(input);
  assert.equal(session.mode, expected.mode);
  assert.deepEqual(session.outputs, expected.outputs);
  assert.equal(session.origin, 'controller');
  session.reset();
  assert.equal(session.origin, 'controller');
});

test('CSV distinguishes manual and cycle timing and keeps exact column values', () => {
  const session = new Session();
  session.step({ speed: 20, wEng: 0, P_dem: 10, SOC: 0.401 });
  session.replay('urban1', 948);
  const lines = session.csv().trim().split('\r\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], '"step","cycle_time_s","source","mode","speed_kmh","engine_rpm","power_kw","soc_fraction","motor_enabled","generator_enabled","engine_enabled"');
  assert.equal(lines[1], '"1","","Manual","EV","20","0","10","0.401","1","0","0"');
  const cells = lines[2].split(',').map(value => value.slice(1, -1));
  assert.deepEqual(cells.slice(0, 4), ['2', '94.8', 'Model: UrbanCycle1', 'REGENB']);
  assert.deepEqual(cells.slice(4).map(Number), [...recordings.cycles.urban1.rows[948].slice(0, 4), 1, 0, 0]);
});

test('the bounded log and export retain the latest samples without resetting step numbers', () => {
  const session = new Session();
  for (let i = 0; i < MAX_RECORDS + 5; i += 1) session.step(DEFAULT_INPUTS);
  assert.equal(session.steps, MAX_RECORDS + 5);
  assert.equal(session.records.length, MAX_RECORDS);
  assert.equal(session.records[0].step, 6);
  assert.equal(session.csv().trim().split('\r\n').length, MAX_RECORDS + 1);
});
