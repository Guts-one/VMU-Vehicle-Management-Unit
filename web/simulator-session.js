/* Session and scripted inputs for the simulator UI. The controller remains in mode_logic.js. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../mode_logic.js'));
  } else {
    root.VmuSimulator = factory(root.ModeLogic);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (logic) {
  'use strict';

  const DEFAULT_INPUTS = Object.freeze({ speed: 0, wEng: 0, P_dem: 0, SOC: 0.40 });
  const INPUTS = Object.freeze([
    { id: 'speed', key: 'speed', label: 'Vehicle speed', min: 0, max: 140, step: 0.1, unit: 'km/h', scale: 1 },
    { id: 'weng', key: 'wEng', label: 'Engine speed', min: 0, max: 7000, step: 1, unit: 'rpm', scale: 1 },
    { id: 'pdem', key: 'P_dem', label: 'Power demand', min: -20, max: 80, step: 0.1, unit: 'kW', scale: 1 },
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
  const MAX_RECORDS = 1200;
  const CSV_COLUMNS = [
    'step', 'cycle_time_s', 'source', 'mode', 'speed_kmh', 'engine_rpm',
    'power_kw', 'soc_percent', 'motor_enabled', 'generator_enabled', 'engine_enabled'
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
    }

    clearData() { this.records = []; }

    step(input, source = 'Manual', time = null) {
      validate(input);
      const result = logic.stepPhysical(this.mode, input);
      this.mode = result.mode;
      this.outputs = result.outputs;
      this.input = { ...input };
      this.steps += 1;
      this.records.push({
        step: this.steps, time: time, source: source, mode: this.mode,
        input: { ...input }, outputs: { ...this.outputs }
      });
      if (this.records.length > MAX_RECORDS) this.records.shift();
      return result;
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
        logic.STATE_NAMES[record.mode], record.input.speed.toFixed(1), Math.round(record.input.wEng),
        record.input.P_dem.toFixed(1), (record.input.SOC * 100).toFixed(1),
        record.outputs.Mot_Enable, record.outputs.Gen_Enable, record.outputs.ICE_Enable
      ]);
      return [CSV_COLUMNS, ...rows].map(row => row.map(escape).join(',')).join('\r\n') + '\r\n';
    }
  }

  // Operating points retained from the original simulator. They prescribe inputs, not physics.
  // Each tuple is [speed km/h, demand kW, battery fraction, engine rpm].
  const SHORT_POINTS = [
    ['At rest', [0, 0, 0.58, 0]],
    ['EV launch', [8, 10, 0.57, 300]],
    ['Urban acceleration', [18, 18, 0.56, 600]],
    ['Urban cruise', [28, 12, 0.54, 800]],
    ['Throttle lift', [20, 1, 0.54, 700]],
    ['Regenerative braking', [18, -8, 0.55, 400]],
    ['Slowing down', [6, -10, 0.56, 100]],
    ['Pickup', [22, 15, 0.55, 1200]],
    ['Overtake', [37, 70, 0.52, 2500]],
    ['Engine crank', [42, 68, 0.50, 3500]],
    ['Hybrid cruise', [50, 45, 0.49, 4000]],
    ['Wind down', [48, 20, 0.49, 2800]]
  ];
  const MINUTE_SEGMENTS = [
    [0, 5, 'Gentle launch', [0, 4, 0.62, 0], [30, 20, 0.60, 500]],
    [5, 12, 'Hard acceleration', [30, 20, 0.60, 500], [80, 68, 0.56, 2000]],
    [12, 18, 'Climb to 120', [80, 60, 0.56, 2000], [120, 55, 0.52, 3200]],
    [18, 24, 'Deceleration', [120, -4, 0.52, 3200], [30, -18, 0.55, 1200]],
    [24, 34, 'Pickup', [30, 14, 0.55, 1200], [100, 58, 0.51, 2800]],
    [34, 42, 'Highway', [100, 42, 0.51, 2800], [120, 52, 0.49, 4200]],
    [42, 50, 'Slow traffic', [120, -5, 0.49, 4200], [40, -14, 0.51, 1500]],
    [50, 60, 'Cool down', [40, 8, 0.51, 1500], [70, 30, 0.46, 2600]]
  ];
  const CYCLES = Object.freeze({
    short: { name: 'Short cycle', duration: 14 },
    minute: { name: 'One-minute cycle', duration: 60 }
  });

  function sampleCycle(kind, seconds) {
    if (!CYCLES[kind] || !Number.isFinite(seconds)) throw new RangeError('Invalid cycle or time.');
    const elapsed = Math.max(0, Math.min(CYCLES[kind].duration, seconds));
    let start, end, label, fraction;
    if (kind === 'short') {
      const position = elapsed / 14 * (SHORT_POINTS.length - 1);
      const index = Math.min(SHORT_POINTS.length - 2, Math.floor(position));
      start = SHORT_POINTS[index][1];
      end = SHORT_POINTS[index + 1][1];
      label = elapsed === 0 ? SHORT_POINTS[0][0] : SHORT_POINTS[index + 1][0];
      fraction = position - index;
    } else {
      const segment = MINUTE_SEGMENTS.find(item => elapsed < item[1]) || MINUTE_SEGMENTS[MINUTE_SEGMENTS.length - 1];
      [ , , label, start, end ] = segment;
      fraction = (elapsed - segment[0]) / (segment[1] - segment[0]);
    }
    const eased = (1 - Math.cos(Math.PI * fraction)) / 2;
    const values = start.map((value, index) => value + (end[index] - value) * eased);
    // Match the precision of the visible numeric inputs.
    const input = {
      speed: Number(values[0].toFixed(1)), P_dem: Number(values[1].toFixed(1)),
      SOC: Math.round(values[2] * 1000) / 1000, wEng: Math.round(values[3])
    };
    return { input: input, label: label };
  }

  return { Session, DEFAULT_INPUTS, INPUTS, PRESETS, CYCLES, MAX_RECORDS, sampleCycle };
});
