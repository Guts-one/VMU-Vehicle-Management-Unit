/* Controller tests, a synthetic demonstration, and recorded full-model playback. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../mode_logic.js'), require('./model-replays.js'));
  } else {
    root.VmuSimulator = factory(root.ModeLogic, root.VmuModelReplays);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (logic, replays) {
  'use strict';

  const DEFAULT_INPUTS = Object.freeze({ speed: 0, wEng: 0, P_dem: 0, SOC: 0.40 });
  const INPUTS = Object.freeze([
    { id: 'speed', key: 'speed', label: 'Vehicle speed', min: 0, max: 140, step: 0.1, unit: 'km/h', scale: 1 },
    { id: 'weng', key: 'wEng', label: 'Engine speed', min: 0, max: 7000, step: 1, unit: 'rpm', scale: 1 },
    { id: 'pdem', key: 'P_dem', label: 'Power demand', min: -40, max: 80, step: 0.1, unit: 'kW', scale: 1 },
    { id: 'soc', key: 'SOC', label: 'Battery charge', min: 0, max: 100, step: 0.1, unit: '%', scale: 100 }
  ]);
  const PRESETS = Object.freeze([
    { name: 'Standstill', input: DEFAULT_INPUTS },
    { name: 'EV', input: { speed: 20, P_dem: 10, SOC: 0.40, wEng: 0 } },
    { name: 'Regen', input: { speed: 10, P_dem: -5.5, SOC: 0.40, wEng: 0 } },
    { name: 'Start', input: { speed: 35, P_dem: 39, SOC: 0.30, wEng: 600 } },
    { name: 'ICE', input: { speed: 40, P_dem: 0, SOC: 0.20, wEng: 900 } },
    { name: 'Hybrid', input: { speed: 50, P_dem: 45, SOC: 0.45, wEng: 3500 } }
  ]);
  const MAX_RECORDS = 6000;
  const CSV_COLUMNS = [
    'step', 'cycle_time_s', 'source', 'mode', 'speed_kmh', 'engine_rpm',
    'power_kw', 'soc_fraction', 'motor_enabled', 'generator_enabled', 'engine_enabled'
  ];

  function validate(input) {
    for (const field of INPUTS) {
      const value = input[field.key] * field.scale;
      if (typeof input[field.key] !== 'number' || !Number.isFinite(value) || value < field.min || value > field.max) {
        throw new RangeError(field.label + ' must be between ' + field.min + ' and ' + field.max + ' ' + field.unit + '.');
      }
    }
  }

  class Session {
    constructor() { this.reset(); }

    reset() {
      this.mode = logic.MODE_STANDSTILL;
      this.outputs = logic.writeOutputs(this.mode);
      this.input = { ...DEFAULT_INPUTS };
      this.steps = 0;
      this.records = [];
      this.origin = 'controller';
    }

    clearData() { this.records = []; }

    step(input, source = 'Manual', time = null) {
      validate(input);
      const result = logic.stepPhysical(this.mode, input);
      this.record(input, result.mode, result.outputs, source, time, 'controller');
      return result;
    }

    demo(index) {
      const sample = sampleDemo(index);
      validate(sample.input);
      const result = logic.stepPhysical(this.mode, sample.input);
      this.record(sample.input, result.mode, result.outputs,
        'Demo: ' + CYCLES.demo.name, sample.time, 'demo');
      return { ...sample, ...result };
    }

    replay(kind, index) {
      const sample = sampleCycle(kind, index);
      // Keep plant inputs, leaf state, and enable commands together. Re-running
      // the fixed-point JS controller would produce a different recorded drive.
      this.record(sample.input, sample.mode, sample.outputs,
        'Model: ' + CYCLES[kind].name, sample.time, 'model');
      return sample;
    }

    record(input, mode, outputs, source, time, origin) {
      this.mode = mode;
      this.outputs = { ...outputs };
      this.input = { ...input };
      this.origin = origin;
      this.steps += 1;
      this.records.push({
        step: this.steps, time: time, source: source, mode: this.mode,
        input: { ...input }, outputs: { ...this.outputs }
      });
      if (this.records.length > MAX_RECORDS) this.records.shift();
    }

    // Each real transition is recorded. A preset starts from standstill, unlike a manual step.
    preset(index) {
      const preset = PRESETS[index];
      if (!preset) throw new RangeError('Unknown operating preset.');
      validate(preset.input);
      this.mode = logic.MODE_STANDSTILL;
      this.outputs = logic.writeOutputs(this.mode);
      for (let i = 0; i < 12; i += 1) {
        const next = logic.stepPhysical(this.mode, preset.input);
        if (i > 0 && next.mode === this.mode) break;
        this.step(preset.input, 'Preset: ' + preset.name);
      }
      return this.input;
    }

    csv() {
      const escape = value => '"' + String(value).replace(/"/g, '""') + '"';
      const rows = this.records.map(record => [
        record.step, record.time === null ? '' : record.time.toFixed(1), record.source,
        logic.STATE_NAMES[record.mode], record.input.speed, record.input.wEng,
        record.input.P_dem, record.input.SOC,
        record.outputs.Mot_Enable, record.outputs.Gen_Enable, record.outputs.ICE_Enable
      ]);
      return [CSV_COLUMNS, ...rows].map(row => row.map(escape).join(',')).join('\r\n') + '\r\n';
    }
  }

  const CYCLES = Object.freeze({
    demo: Object.freeze({ name: 'Dynamic drive', duration: 90, samples: 901, origin: 'demo' }),
    ...Object.fromEntries(Object.entries(replays ? replays.cycles : {}).map(([id, cycle]) =>
      [id, Object.freeze({ name: cycle.name, duration: cycle.duration, samples: cycle.rows.length, origin: 'model' })]))
  });

  // Scripted operating points, not a plant simulation. RPM, load, and SOC are
  // supplied inputs; only the supervisor's mode and commands are calculated.
  // Each moving segment varies continuously, with brief stops only at the ends.
  // Columns: time (s), speed (km/h), RPM, demand (kW), SOC, segment description.
  const DEMO_POINTS = [
    [0,    0,    0,   0, 0.4800, 'Electric departure'],
    [2,    6,    0,  10, 0.4799, 'City acceleration'],
    [5,   24,    0,  18, 0.4796, 'City acceleration'],
    [9,   33,    0,  22, 0.4791, 'City braking'],
    [12,  27,    0, -12, 0.4790, 'City braking'],
    [15,  19,    0, -18, 0.4792, 'City braking'],
    [18,   8,    0,  -6, 0.4794, 'Electric restart'],
    [20,   3,    0,   8, 0.4793, 'Electric acceleration'],
    [25,  32,    0,  26, 0.4788, 'Engine start'],
    [28,  46,  600,  43, 0.4782, 'Hybrid acceleration'],
    [30,  57, 1600,  51, 0.4777, 'Hybrid acceleration'],
    [35,  82, 3400,  60, 0.4766, 'Load release'],
    [39,  96, 2600,   8, 0.4762, 'Overtake'],
    [43, 110, 4200,  47, 0.4752, 'Overtake'],
    [46, 121, 4600,  55, 0.4742, 'Highway braking'],
    [49, 104, 3500, -24, 0.4745, 'Regenerative braking'],
    [52,  86, 2200, -31, 0.4751, 'Regenerative braking'],
    [55,  61, 1000, -16, 0.4757, 'Return to electric drive'],
    [58,  42,  900,   8, 0.4761, 'Return to electric drive'],
    [61,  30,  900,  15, 0.4758, 'Electric acceleration'],
    [62,  31,    0,  18, 0.4757, 'Engine start'],
    [64,  46,  600,  44, 0.4753, 'Second acceleration'],
    [66,  58, 1500,  54, 0.4747, 'Second acceleration'],
    [69,  74, 3200,  42, 0.4740, 'Load release'],
    [72,  66, 2600,   7, 0.4742, 'Return braking'],
    [75,  54, 1900, -18, 0.4746, 'Return braking'],
    [78,  34,  800, -23, 0.4752, 'Return braking'],
    [81,  14,    0,  -8, 0.4758, 'Approaching stop'],
    [86,   7,    0,  -3, 0.4760, 'Approaching stop'],
    [90,   0,    0,   0, 0.4761, 'Stopped']
  ];

  function sampleDemo(index) {
    if (!Number.isInteger(index) || index < 0 || index >= CYCLES.demo.samples) {
      throw new RangeError('Invalid demonstration sample index.');
    }
    const time = index / 10;
    const right = DEMO_POINTS.findIndex(point => point[0] >= time);
    const to = DEMO_POINTS[right], from = DEMO_POINTS[Math.max(0, right - 1)];
    const ratio = right === 0 ? 0 : (time - from[0]) / (to[0] - from[0]);
    const blend = ratio * ratio * (3 - 2 * ratio);
    const interpolate = (column, precision) => Number((from[column] + (to[column] - from[column]) * blend).toFixed(precision));
    return {
      time,
      phase: index === CYCLES.demo.samples - 1 ? 'Stopped' : from[5],
      input: { speed: interpolate(1, 2), wEng: interpolate(2, 0), P_dem: interpolate(3, 2), SOC: interpolate(4, 5) }
    };
  }

  function sampleCycle(kind, index) {
    if (!CYCLES[kind] || CYCLES[kind].origin !== 'model' || !Number.isInteger(index) || index < 0 || index >= CYCLES[kind].samples) {
      throw new RangeError('Invalid recording or sample index.');
    }
    const row = replays.cycles[kind].rows[index];
    return { time: index / 10,
      input: { speed: row[0], wEng: row[1], P_dem: row[2], SOC: row[3] },
      mode: row[4], outputs: { Mot_Enable: row[5], Gen_Enable: row[6], ICE_Enable: row[7] }
    };
  }

  return { Session, DEFAULT_INPUTS, INPUTS, PRESETS, CYCLES, MAX_RECORDS, sampleCycle, sampleDemo };
});
