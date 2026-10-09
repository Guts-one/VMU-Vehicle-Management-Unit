(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const ML = window.ModeLogic;
  const SIM = window.VmuSimulator;
  if (!ML || !SIM || !window.VmuModelReplays) {
    $('loadError').hidden = false;
    $('inputForm').hidden = true;
    $('cycleBtn').disabled = true;
    return;
  }
  const session = new SIM.Session();
  const MODE_DESCRIPTIONS = [
    'System at rest', 'Electric drive', 'Regenerative braking',
    'Engine start requested', 'Engine-supported drive', 'Combined electric & engine drive'
  ];
  const MODE_COLORS = ['#7890aa', '#63c6a1', '#59bcc8', '#e9ba67', '#a4b8ce', '#79aaf0'];
  let activeTab = 'telemetry';
  let selectedPreset = 0;
  let phase = 'Manual';
  let cycle = { running: false, paused: false, kind: 'urban1', rate: 1, elapsed: 0, next: 0, started: 0, timer: null };

  function announce(message) { $('announcement').textContent = message; }
  function signed(value) { return (value >= 0 ? '+' : '') + value.toFixed(1); }
  function formatInput(field, value) { return Number((value * field.scale).toFixed(field.step === 1 ? 0 : 1)).toString(); }
  function point(radius, degrees) {
    const radians = degrees * Math.PI / 180;
    return [160 + radius * Math.cos(radians), 160 + radius * Math.sin(radians)];
  }
  function arc(radius) {
    return 'M' + point(radius, 135).join(',') + ' A' + radius + ',' + radius + ' 0 1 1 ' + point(radius, 405).join(',');
  }
  function buildGauge(id, multiplier) {
    let markup = '<path class="dial-rim" d="' + arc(153) + '"/><path class="dial-arc" d="' + arc(147) + '"/>';
    for (let i = 0; i <= 70; i += 1) {
      const angle = 135 + i / 70 * 270;
      const major = i % 10 === 0;
      const from = point(140, angle);
      const to = point(major ? 126 : 134, angle);
      markup += '<line class="dial-tick' + (major ? ' major' : '') + '" x1="' + from[0] + '" y1="' + from[1] + '" x2="' + to[0] + '" y2="' + to[1] + '"/>';
      if (major) {
        const label = point(112, angle);
        markup += '<text class="dial-number" x="' + label[0] + '" y="' + label[1] + '">' + (i / 10 * multiplier) + '</text>';
      }
    }
    const end = point(128, 135);
    markup += '<g class="dial-needle"><line x1="160" y1="160" x2="' + end[0] + '" y2="' + end[1] + '"/><circle cx="160" cy="160" r="3"/></g>';
    $(id).querySelector('svg').innerHTML = markup;
  }
  function setGauge(id, value, maximum, label) {
    $(id).querySelector('.dial-needle').style.transform = 'rotate(' + value / maximum * 270 + 'deg)';
    $(id).setAttribute('aria-label', label);
  }

  function buildControls() {
    $('inputRows').innerHTML = SIM.INPUTS.map(field =>
      '<div class="input-row"><div class="input-heading"><label for="' + field.id + '">' + field.label + '</label>' +
      '<div class="input-value"><input id="' + field.id + '" type="number" min="' + field.min + '" max="' + field.max + '" step="' + field.step + '" required aria-describedby="' + field.id + 'Unit inputFeedback"><span id="' + field.id + 'Unit">' + field.unit + '</span></div></div>' +
      '<input id="' + field.id + 'Range" type="range" aria-label="' + field.label + ' slider" min="' + field.min + '" max="' + field.max + '" step="' + field.step + '">' +
      '<div class="input-scale" aria-hidden="true"><span>' + field.min + '</span><span>' + field.max + '</span></div></div>'
    ).join('');
    SIM.INPUTS.forEach(field => {
      const number = $(field.id), range = $(field.id + 'Range');
      number.addEventListener('input', function () {
        if (number.validity.valid) range.value = number.value;
        paintRange(field);
        updateDraft();
      });
      range.addEventListener('input', function () {
        number.value = range.value;
        paintRange(field);
        updateDraft();
      });
    });
    $('presetButtons').innerHTML = SIM.PRESETS.map((preset, index) =>
      '<button type="button" data-preset="' + index + '" aria-pressed="' + (index === 0) + '">' + preset.name + '</button>'
    ).join('');
    $('presetButtons').addEventListener('click', function (event) {
      const button = event.target.closest('button[data-preset]');
      if (!button) return;
      stopCycle();
      selectedPreset = Number(button.dataset.preset);
      session.preset(selectedPreset);
      setInputs(session.input);
      phase = 'Preset: ' + SIM.PRESETS[selectedPreset].name;
      render();
      announce(ML.STATE_NAMES[session.mode] + '. Preset applied from standstill.');
    });
  }
  function paintRange(field) {
    const range = $(field.id + 'Range');
    range.style.setProperty('--position', ((Number(range.value) - field.min) / (field.max - field.min) * 100) + '%');
  }
  function setInputs(input) {
    SIM.INPUTS.forEach(field => {
      $(field.id).value = formatInput(field, input[field.key]);
      $(field.id + 'Range').value = $(field.id).value;
      paintRange(field);
    });
  }
  function readDraft() {
    const input = {}, errors = [];
    SIM.INPUTS.forEach(field => {
      const control = $(field.id);
      const invalid = !control.validity.valid || !Number.isFinite(control.valueAsNumber);
      control.setAttribute('aria-invalid', String(invalid));
      if (invalid) errors.push({ field: field, control: control });
      input[field.key] = control.valueAsNumber / field.scale;
    });
    return { input: input, errors: errors };
  }
  function updateDraft() {
    const draft = readDraft();
    const invalid = draft.errors.length > 0;
    const pending = invalid || SIM.INPUTS.some(field => Math.abs(draft.input[field.key] * field.scale - Number(formatInput(field, session.input[field.key]))) > 1e-9);
    $('inputStatus').textContent = invalid ? 'Check inputs' : pending ? 'Pending' : session.origin === 'model' ? 'Model record' : 'Applied';
    $('inputStatus').className = invalid ? 'invalid' : pending ? 'pending' : '';
    $('inputFeedback').classList.toggle('invalid', invalid);
    if (invalid) {
      const field = draft.errors[0].field;
      $('inputFeedback').textContent = field.label + ': enter ' + field.min + '–' + field.max + ' ' + field.unit + ' in steps of ' + field.step + '.';
    } else {
      $('inputFeedback').textContent = pending ? 'Changes pending. Apply step to update instruments.' : session.origin === 'model' ? 'Recorded values shown rounded. CSV keeps full precision.' : 'Instruments show the applied values.';
    }
    return draft;
  }
  function applyStep() {
    if (cycle.running) return;
    const draft = updateDraft();
    if (draft.errors.length) { draft.errors[0].control.focus(); return; }
    stopCycle();
    selectedPreset = -1;
    session.step(draft.input);
    phase = 'Manual';
    render();
    announce('Step ' + session.steps + '. ' + ML.STATE_NAMES[session.mode] + '.');
  }
  function reset() {
    stopCycle();
    session.reset();
    selectedPreset = 0;
    phase = 'Manual';
    setInputs(session.input);
    render();
    announce('Session reset. Standstill. Inputs restored.');
  }

  function render() {
    const input = session.input;
    $('modeRead').textContent = ML.STATE_NAMES[session.mode];
    $('modeDescription').textContent = MODE_DESCRIPTIONS[session.mode];
    $('speedRead').textContent = Number(input.speed.toFixed(1)).toFixed(1);
    $('sourceRead').textContent = session.origin === 'model' ? 'Simulink recording · inputs, mode and commands' : 'Manual controller · JavaScript';
    $('rpmRead').textContent = Math.round(input.wEng).toLocaleString('en-US');
    $('socRead').textContent = (input.SOC * 100).toFixed(1);
    $('powerRead').textContent = signed(input.P_dem);
    setGauge('rpmGauge', input.wEng, 7000, 'Engine speed: ' + Math.round(input.wEng) + ' rpm');
    setGauge('speedGauge', input.speed, 140, 'Vehicle speed: ' + input.speed.toFixed(1) + ' km/h');
    [['motorOutput', 'Mot_Enable'], ['generatorOutput', 'Gen_Enable'], ['engineOutput', 'ICE_Enable']].forEach(([id, key]) => {
      const enabled = session.outputs[key] === 1;
      $(id).classList.toggle('enabled', enabled);
      $(id).querySelector('dd').textContent = enabled ? 'ON' : 'OFF';
    });
    [...$('batteryMeter').children].forEach((cell, index) => cell.classList.toggle('filled', index < Math.round(input.SOC * 24)));
    const power = $('powerFill');
    power.style.left = ((40 + Math.min(0, input.P_dem)) / 120 * 100) + '%';
    power.style.width = (Math.abs(input.P_dem) / 120 * 100) + '%';
    power.style.backgroundColor = input.P_dem < 0 ? 'var(--green)' : 'var(--amber)';
    [...$('presetButtons').children].forEach((button, index) => button.setAttribute('aria-pressed', String(index === selectedPreset)));
    $('inputFields').disabled = cycle.running;
    $('stepBtn').disabled = cycle.running;
    $('cycleSelect').disabled = cycle.running;
    $('cycleBtn').textContent = cycle.running ? 'Pause' : cycle.paused ? 'Resume' : 'Play';
    $('phaseRead').textContent = phase;
    $('stepRead').textContent = session.steps;
    const progress = cycle.elapsed / SIM.CYCLES[cycle.kind].duration * 100;
    $('cycleProgress').setAttribute('aria-valuenow', String(Math.round(progress)));
    $('cycleProgress').querySelector('i').style.width = progress + '%';
    const count = session.records.length;
    $('recordCount').textContent = count.toLocaleString('en-US') + (count === 1 ? ' sample' : ' samples');
    $('exportBtn').disabled = count === 0;
    $('clearBtn').disabled = count === 0;
    updateDraft();
    renderResults();
  }

  const CHARTS = [
    { id: 'speedChart', readout: 'speedChartValue', key: 'speed', scale: 1, min: 0, max: 140, color: '#67b1fc', unit: 'km/h' },
    { id: 'rpmChart', readout: 'rpmChartValue', key: 'wEng', scale: 1, min: 0, max: 7000, color: '#d9ad72', unit: 'rpm' },
    { id: 'powerChart', readout: 'powerChartValue', key: 'P_dem', scale: 1, min: -40, max: 80, color: '#7ec6d7', unit: 'kW' },
    { id: 'chargeChart', readout: 'chargeChartValue', key: 'SOC', scale: 100, min: 0, max: 100, color: '#63c6a1', unit: '%' }
  ];
  function drawChart(spec) {
    const canvas = $(spec.id), width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const context = canvas.getContext('2d');
    context.scale(dpr, dpr);
    const pad = { left: spec.key === 'wEng' ? 36 : 28, right: 8, top: 8, bottom: 24 };
    const plotWidth = width - pad.left - pad.right, plotHeight = height - pad.top - pad.bottom;
    const records = session.records;
    const firstStep = records.length ? records[0].step : 0;
    const lastStep = records.length > 1 ? records[records.length - 1].step : firstStep + 1;
    const x = step => pad.left + (step - firstStep) / (lastStep - firstStep) * plotWidth;
    const minimum = Math.min(spec.min, ...records.map(record => record.input[spec.key] * spec.scale));
    const y = value => pad.top + plotHeight * (1 - (value - minimum) / (spec.max - minimum));
    context.font = '10px "Segoe UI", sans-serif';
    context.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const value = minimum + (spec.max - minimum) * i / 4;
      const py = y(value);
      context.strokeStyle = '#293d53';
      context.beginPath(); context.moveTo(pad.left, py); context.lineTo(width - pad.right, py); context.stroke();
      context.fillStyle = '#a3b5ca'; context.textAlign = 'right';
      context.fillText(Number(value.toFixed(1)).toString(), pad.left - 6, py + 3);
    }
    for (let i = 0; i <= 4; i += 1) {
      const px = pad.left + plotWidth * i / 4;
      context.strokeStyle = '#213248';
      context.beginPath(); context.moveTo(px, pad.top); context.lineTo(px, height - pad.bottom); context.stroke();
    }
    if (records.length) {
      context.strokeStyle = spec.color;
      context.lineWidth = 1.8;
      context.beginPath();
      records.forEach((record, index) => {
        const px = x(record.step), py = y(record.input[spec.key] * spec.scale);
        if (index === 0) context.moveTo(px, py); else context.lineTo(px, py);
      });
      context.stroke();
      const last = records[records.length - 1];
      const value = last.input[spec.key] * spec.scale;
      context.fillStyle = spec.color;
      context.beginPath(); context.arc(x(last.step), y(value), 2.5, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#a3b5ca'; context.textAlign = 'left';
      context.fillText(String(firstStep), pad.left, height - 6);
      if (records.length > 1) {
        context.textAlign = 'right'; context.fillText(String(last.step), width - pad.right, height - 6);
      }
      $(spec.readout).textContent = (spec.key === 'wEng' ? Math.round(value) : value.toFixed(1)) + ' ' + spec.unit;
      canvas.setAttribute('aria-label', records.length + ' recorded samples; latest value ' + value.toFixed(1) + ' ' + spec.unit + '. Full precision is available in the CSV export.');
    } else {
      context.fillStyle = '#a3b5ca'; context.textAlign = 'center';
      context.fillText('No samples yet', pad.left + plotWidth / 2, pad.top + plotHeight / 2);
      $(spec.readout).textContent = '—';
      canvas.setAttribute('aria-label', 'No recorded samples. Apply a step or run a cycle.');
    }
  }
  function renderResults() {
    if (activeTab === 'telemetry') {
      CHARTS.forEach(drawChart);
      const records = session.records;
      $('telemetryNote').textContent = records.length ? 'Horizontal axis: controller step · latest ' + records.length + ' samples' : 'Apply a step or run a cycle to record data.';
      const groups = [];
      records.slice(-120).forEach(record => {
        const last = groups[groups.length - 1];
        if (last && last.mode === record.mode) { last.count += 1; last.end = record.step; }
        else groups.push({ mode: record.mode, count: 1, start: record.step, end: record.step });
      });
      $('modeTrack').innerHTML = groups.map(group =>
        '<i style="flex:' + group.count + ';background:' + MODE_COLORS[group.mode] + '" title="' + ML.STATE_NAMES[group.mode] + ' · steps ' + group.start + '–' + group.end + '"></i>'
      ).join('');
      $('modeTrack').setAttribute('aria-label', 'Recent mode sequence: ' + (groups.map(group => ML.STATE_NAMES[group.mode]).join(', ') || 'no samples'));
    } else if (activeTab === 'log') {
      $('logNote').textContent = session.records.length > 100 ? 'Latest 100 samples. CSV includes all ' + session.records.length + ' retained samples (limit: 6,000), with source and full precision.' : 'Manual steps and model records, newest first. CSV includes source and full precision.';
      $('logBody').innerHTML = session.records.length ? session.records.slice(-100).reverse().map(record => {
        const input = record.input;
        const values = [record.step, ML.STATE_NAMES[record.mode], input.speed.toFixed(1), Math.round(input.wEng), input.P_dem.toFixed(1), (input.SOC * 100).toFixed(1)];
        return '<tr>' + values.map(value => '<td>' + value + '</td>').join('') +
          ['Mot_Enable', 'Gen_Enable', 'ICE_Enable'].map(key => '<td class="' + (record.outputs[key] ? 'output-on' : '') + '">' + (record.outputs[key] ? 'ON' : 'OFF') + '</td>').join('') + '</tr>';
      }).join('') : '<tr><td colspan="9" class="table-empty">No recorded steps yet.</td></tr>';
    }
  }
  function buildThresholds() {
    const thresholds = ML.thresholds;
    const groups = [
      { title: 'Vehicle speed', suffix: '_DKPH', scale: 10, unit: 'km/h', keys: ['SPEED_STOP', 'SPEED_REGEN', 'SPEED_EV_MAX'] },
      { title: 'Engine speed', suffix: '_RPM', scale: 1, unit: 'rpm', keys: ['ENG_ON', 'ENG_OFF'] },
      { title: 'Power demand', suffix: '_DKW', scale: 10, unit: 'kW', keys: ['PDEM_REGEN', 'PDEM_STOP_LOW', 'PDEM_STOP_HIGH', 'PDEM_HYB_IN', 'PDEM_HYB_OUT', 'PDEM_HYB_MID', 'PDEM_HYB_LOW'] },
      { title: 'Battery charge', suffix: '_Q10000', scale: 100, unit: '%', keys: ['SOC_EV_IN', 'SOC_EV_OUT', 'SOC_MID', 'SOC_LOW'] }
    ];
    $('thresholdGroups').innerHTML = groups.map(group => '<section><h3>' + group.title + '</h3><dl>' + group.keys.map(key =>
      '<div><dt>' + key + '</dt><dd>' + thresholds[key + group.suffix] / group.scale + ' ' + group.unit + '</dd></div>'
    ).join('') + '</dl></section>').join('');
  }

  function stopCycle() {
    if (cycle.timer !== null) clearInterval(cycle.timer);
    cycle = { running: false, paused: false, kind: $('cycleSelect').value, rate: Number($('playbackRate').value), elapsed: 0, next: 0, started: 0, timer: null };
  }
  function advanceCycle() {
    const duration = SIM.CYCLES[cycle.kind].duration;
    cycle.elapsed = Math.min(duration, (performance.now() - cycle.started) / 1000 * cycle.rate);
    const end = Math.min(Math.floor((cycle.elapsed + 1e-7) * 10), duration * 10);
    // Playback rate affects wall time only. Never skip or interpolate model samples.
    while (cycle.next <= end) {
      session.replay(cycle.kind, cycle.next);
      cycle.next += 1;
    }
    setInputs(session.input);
    if (cycle.elapsed >= duration) {
      clearInterval(cycle.timer);
      cycle.timer = null;
      cycle.running = false;
      cycle.paused = false;
      phase = 'Complete · ' + duration + ' s';
      announce('Model playback complete. ' + session.records.length + ' samples.');
    } else phase = 'Model time · ' + ((cycle.next - 1) / 10).toFixed(1) + ' / ' + duration + ' s';
    render();
  }
  function pauseCycle() {
    if (!cycle.running) return;
    advanceCycle();
    if (!cycle.running) return;
    clearInterval(cycle.timer);
    cycle.timer = null;
    cycle.running = false;
    cycle.paused = true;
    phase = 'Paused · ' + ((cycle.next - 1) / 10).toFixed(1) + ' s';
    render();
    announce('Model playback paused.');
  }
  function toggleCycle() {
    if (cycle.running) { pauseCycle(); return; }
    if (!cycle.paused) {
      stopCycle();
      session.reset();
      cycle.kind = $('cycleSelect').value;
      selectedPreset = -1;
    }
    cycle.running = true;
    cycle.paused = false;
    cycle.started = performance.now() - cycle.elapsed / cycle.rate * 1000;
    advanceCycle();
    cycle.timer = setInterval(advanceCycle, 100);
    announce('Model playback running at ' + cycle.rate + ' times speed.');
  }
  function selectTab(name, focus) {
    activeTab = name;
    ['telemetry', 'log', 'thresholds'].forEach(tab => {
      const selected = tab === name;
      $(tab + 'Panel').hidden = !selected;
      $(tab + 'Tab').setAttribute('aria-selected', String(selected));
      $(tab + 'Tab').tabIndex = selected ? 0 : -1;
    });
    renderResults();
    if (focus) $(name + 'Tab').focus();
  }
  function exportCsv() {
    if (!session.records.length) return;
    const url = URL.createObjectURL(new Blob([session.csv()], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vmu-session-' + new Date().toISOString().replace(/[:.]/g, '-') + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce(session.records.length + ' samples exported as CSV.');
  }

  buildControls();
  buildGauge('rpmGauge', 1);
  buildGauge('speedGauge', 20);
  $('batteryMeter').innerHTML = '<i></i>'.repeat(24);
  buildThresholds();
  setInputs(session.input);
  $('inputForm').addEventListener('submit', event => { event.preventDefault(); applyStep(); });
  $('resetBtn').addEventListener('click', reset);
  $('cycleBtn').addEventListener('click', toggleCycle);
  $('cycleSelect').addEventListener('change', () => { stopCycle(); phase = 'Ready to play'; render(); });
  $('playbackRate').addEventListener('change', () => {
    if (cycle.running) advanceCycle();
    cycle.rate = Number($('playbackRate').value);
    cycle.started = performance.now() - cycle.elapsed / cycle.rate * 1000;
    announce('Playback speed: ' + cycle.rate + ' times.');
  });
  $('clearBtn').addEventListener('click', () => { session.clearData(); render(); announce('Recorded data cleared. Current mode and inputs retained.'); });
  $('exportBtn').addEventListener('click', exportCsv);
  const tabs = [...document.querySelectorAll('[data-tab]')];
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab.dataset.tab, false));
    tab.addEventListener('keydown', event => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); selectTab(tabs[next].dataset.tab, true); }
    });
  });
  $('helpBtn').addEventListener('click', () => { pauseCycle(); $('helpDialog').showModal(); });
  $('closeHelpBtn').addEventListener('click', () => $('helpDialog').close());
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey || $('helpDialog').open) return;
    if (event.target.closest('input, button, select, textarea, a, [role="tab"], [contenteditable="true"]')) return;
    if (event.code === 'Space') { event.preventDefault(); applyStep(); }
    if (event.key.toLowerCase() === 'r') { event.preventDefault(); reset(); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseCycle(); });
  new ResizeObserver(() => { if (activeTab === 'telemetry') renderResults(); }).observe($('telemetryPanel'));
  render();
})();
