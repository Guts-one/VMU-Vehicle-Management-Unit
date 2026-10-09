/* Manual controller steps and recorded full-model playback for the simulator UI. */
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

  const CYCLES = Object.freeze(Object.fromEntries(Object.entries(replays ? replays.cycles : {}).map(([id, cycle]) =>
    [id, { name: cycle.name, duration: cycle.duration, samples: cycle.rows.length }])));

  function sampleCycle(kind, index) {
    if (!CYCLES[kind] || !Number.isInteger(index) || index < 0 || index >= CYCLES[kind].samples) {
      throw new RangeError('Invalid recording or sample index.');
    }
    const row = replays.cycles[kind].rows[index];
    return { time: index / 10,
      input: { speed: row[0], wEng: row[1], P_dem: row[2], SOC: row[3] },
      mode: row[4], outputs: { Mot_Enable: row[5], Gen_Enable: row[6], ICE_Enable: row[7] }
    };
  }

  return { Session, DEFAULT_INPUTS, INPUTS, PRESETS, CYCLES, MAX_RECORDS, sampleCycle };
});
