'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ML = require('../mode_logic.js');
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
    { speed: NaN }, { wEng: Infinity }, { P_dem: -20.1 }, { SOC: 1.001 },
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

test('both full scripted cycles run at fixed sample times and retain their final point', () => {
  for (const kind of ['short', 'minute']) {
    const session = new Session();
    for (let i = 0; i <= CYCLES[kind].duration * 10; i += 1) {
      const sample = sampleCycle(kind, i / 10);
      session.step(sample.input, CYCLES[kind].name, i / 10);
      assert.ok(session.mode >= 0 && session.mode < 6);
    }
    assert.equal(session.records.length, kind === 'short' ? 141 : 601);
    assert.equal(session.records.at(-1).time, CYCLES[kind].duration);
    assert.equal(session.input.speed, kind === 'short' ? 48 : 70);
    assert.ok(session.records.some(row => row.mode === ML.MODE_REGENB));
    assert.ok(session.records.some(row => row.mode === ML.MODE_HYBRID));
  }
  assert.deepEqual(sampleCycle('short', -10).input, sampleCycle('short', 0).input);
  assert.deepEqual(sampleCycle('minute', 70).input, sampleCycle('minute', 60).input);
  assert.throws(() => sampleCycle('unknown', 0), RangeError);
  assert.throws(() => sampleCycle('short', NaN), RangeError);
});

test('CSV distinguishes manual and cycle timing and keeps exact column values', () => {
  const session = new Session();
  session.step({ speed: 20, wEng: 0, P_dem: 10, SOC: 0.401 });
  session.step({ speed: 10, wEng: 0, P_dem: -5.5, SOC: 0.401 }, 'Short cycle', 0.1);
  const lines = session.csv().trim().split('\r\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], '"step","cycle_time_s","source","mode","speed_kmh","engine_rpm","power_kw","soc_percent","motor_enabled","generator_enabled","engine_enabled"');
  assert.equal(lines[1], '"1","","Manual","EV","20.0","0","10.0","40.1","1","0","0"');
  assert.equal(lines[2], '"2","0.1","Short cycle","REGENB","10.0","0","-5.5","40.1","1","0","0"');
});

test('the bounded log and export retain the latest samples without resetting step numbers', () => {
  const session = new Session();
  for (let i = 0; i < MAX_RECORDS + 5; i += 1) session.step(DEFAULT_INPUTS);
  assert.equal(session.steps, MAX_RECORDS + 5);
  assert.equal(session.records.length, MAX_RECORDS);
  assert.equal(session.records[0].step, 6);
  assert.equal(session.csv().trim().split('\r\n').length, MAX_RECORDS + 1);
});
