function results = run_live_equivalence(opts)
%RUN_LIVE_EQUIVALENCE  Live model<->hand-code equivalence with MC/DC coverage.
%   (a) live oracle: chart + C S-Function co-simulated on the same stimulus;
%       equivalence is checked on OUTPUTS and on STATE (chart active leaf
%       state vs C current_mode) -- outputs alone can mask FSM divergence
%   (b) boundary_stimulus.csv probes every threshold at +/-1 LSB; subLSB rows
%       characterise the quantization band (expected divergence, not a fail)
%   (c) chart MC/DC exported and compared with the C-side gcov MC/DC
%
%   opts: .Ts(1) .stimulus(boundary_stimulus.csv) .harness(mode_logic_equiv_harness)
%         .paramScript('') .rebuild(false)

if nargin < 1, opts = struct(); end
def = struct('Ts',1, 'stimulus','boundary_stimulus.csv', ...
             'harness','mode_logic_equiv_harness', 'paramScript','', 'rebuild',false);
fn = fieldnames(def);
for k=1:numel(fn)
    if ~isfield(opts,fn{k}) || isempty(opts.(fn{k})), opts.(fn{k}) = def.(fn{k}); end
end

here = fileparts(mfilename('fullpath'));
root = fileparts(fileparts(here));
addpath(here);
repPath = fullfile(root,'Test report','equivalence_live');
if ~exist(repPath,'dir'), mkdir(repPath); end

% --- 1. build artifacts if needed -----------------------------------------
if opts.rebuild || exist(['sfun_mode_logic.' mexext],'file') ~= 3
    build_sfun_mode_logic();
end
H = opts.harness;
if opts.rebuild || ~exist(fullfile(here,[H '.slx']),'file')
    build_equivalence_harness(struct('harness',H,'Ts',opts.Ts));
end
if ~bdIsLoaded(H), load_system(fullfile(here,[H '.slx'])); end
if getSimulinkBlockHandle([H '/chart_state']) < 0
    % pre-state-comparison harness on disk: rebuild to add the active-state port
    fprintf('Harness lacks chart_state (active leaf state) logging; rebuilding...\n');
    build_equivalence_harness(struct('harness',H,'Ts',opts.Ts));
    if ~bdIsLoaded(H), load_system(fullfile(here,[H '.slx'])); end
end

% --- 2. chart calibrations -------------------------------------------------
if ~isempty(opts.paramScript) && exist(opts.paramScript,'file')
    run(opts.paramScript);
end
ensureParam('HEV_Param','Control.Engine_Start_RPM',800);
ensureParam('HEV_Param','Control.Engine_Stop_RPM', 790);
% The chart sample time is parameterized (HEV_Param.Control.Mode_Logic_TS).
% FORCE it to the harness step so the chart evaluates exactly once per stimulus
% row (otherwise the FSM would advance multiple transitions per row, or the
% fixed-step solver would reject a non-multiple sample time).
forceParam('HEV_Param','Control.Mode_Logic_TS', opts.Ts);

% --- 3. stimulus -> physical timeseries -----------------------------------
T = readtable(fullfile(here,opts.stimulus));
N = height(T);
t = (0:N-1)' * opts.Ts;
assignin('base','ts_speed',[t, T.speed_kph]);
assignin('base','ts_pdem', [t, T.p_dem_kw]);
assignin('base','ts_soc',  [t, T.soc]);
assignin('base','ts_weng', [t, T.weng_rpm]);
stop = (N-1)*opts.Ts;
set_param(H,'StopTime',num2str(stop));

% --- 4. simulate with coverage on the chart -------------------------------
chartBlk = [H '/Mode Logic'];
cvt = cvtest(H);
cvt.settings.decision  = 1;
cvt.settings.condition = 1;
cvt.settings.mcdc      = 1;
fprintf('Running co-simulation with coverage (%d steps)...\n', N);
% cvsim returns the cvdata and a SimulationOutput; order can vary by release,
% so classify by type. To Workspace (Array) signals live in the SimulationOutput.
[r1, r2] = cvsim(cvt, [0 stop]);
if isa(r1,'Simulink.SimulationOutput'),     simOut = r1; cvdo = r2;
elseif isa(r2,'Simulink.SimulationOutput'), simOut = r2; cvdo = r1;
else,                                       simOut = r1; cvdo = r1; end

chart_out = getLogged(simOut,'chart_out', N, 3);
c_out     = getLogged(simOut,'c_out',     N, 3);
c_mode    = getLogged(simOut,'c_mode',    N, 1);
chart_st  = getLogged(simOut,'chart_state', N, 1);         % enum, leaf activity
[chart_mode, chart_names] = mapChartState(chart_st, N);    % -> Mode_t numbering

% --- 5. row-by-row equivalence (outputs AND state) -------------------------
kind = string(T.kind);
outDiff   = any(round(chart_out) ~= round(c_out), 2);
stateDiff = chart_mode(:) ~= double(c_mode(:));
diffMask  = outDiff | stateDiff;
gridFail = find(diffMask & kind ~= "subLSB");
subBand  = find(diffMask & kind == "subLSB");

results = struct();
results.rows = N;
results.grid_mismatches = numel(gridFail);
results.state_mismatches = sum(stateDiff & kind ~= "subLSB");
results.pass = isempty(gridFail);
results.subLSB_band_rows = numel(subBand);

fid = fopen(fullfile(repPath,'equivalence_rows.csv'),'w');
fprintf(fid,'row,scenario,phase,kind,chart_Mot,chart_Gen,chart_ICE,c_Mot,c_Gen,c_ICE,c_mode,chart_mode,chart_state,match\n');
for i=1:N
    m = all(round(chart_out(i,:))==round(c_out(i,:))) && chart_mode(i)==double(c_mode(i));
    fprintf(fid,'%d,%s,%s,%s,%d,%d,%d,%d,%d,%d,%d,%d,%s,%d\n', i-1, ...
        string(T.scenario(i)), string(T.phase(i)), kind(i), ...
        round(chart_out(i,1)),round(chart_out(i,2)),round(chart_out(i,3)), ...
        round(c_out(i,1)),round(c_out(i,2)),round(c_out(i,3)), c_mode(i), ...
        chart_mode(i), chart_names(i), m);
end
fclose(fid);

fid = fopen(fullfile(repPath,'sublsb_band.csv'),'w');
fprintf(fid,'row,scenario,phase,speed_kph,p_dem_kw,soc,weng_rpm,note\n');
for i = subBand'
    fprintf(fid,'%d,%s,%s,%g,%g,%g,%g,%s\n', i-1, string(T.scenario(i)), ...
        string(T.phase(i)), T.speed_kph(i), T.p_dem_kw(i), T.soc(i), T.weng_rpm(i), ...
        'chart(continuous) vs C(quantized) differ within +/-0.5 LSB of threshold');
end
fclose(fid);

% --- 6. export chart coverage + compare with C-side gcov -------------------
cov = export_simulink_mcdc(cvdo, chartBlk, repPath);
results.chart_decision  = cov.decision;
results.chart_condition = cov.condition;
results.chart_mcdc      = cov.mcdc;

try
    cvhtml(fullfile(repPath,'chart_coverage.html'), cvdo);
catch ME
    warning('cvhtml failed: %s', ME.message);
end

sfid = fopen(fullfile(repPath,'summary.txt'),'w');
fprintf(sfid,'LIVE MODEL<->HAND-CODE EQUIVALENCE (S-Function co-simulation)\n');
fprintf(sfid,'Harness         : %s\n', H);
fprintf(sfid,'Oracle (live)   : %s\n', chartBlk);
fprintf(sfid,'Hand code       : src/mode_logic_team.c via sfun_mode_logic\n');
fprintf(sfid,'Stimulus        : %s (%d rows)\n', opts.stimulus, N);
fprintf(sfid,'Grid mismatches : %d (outputs or state)  -> %s\n', results.grid_mismatches, ...
    ternary(results.pass,'PASS','FAIL'));
fprintf(sfid,'State mismatches: %d grid rows (chart active leaf state vs C mode)\n', ...
    results.state_mismatches);
fprintf(sfid,'Sub-LSB band    : %d rows (documented quantization interval)\n', numel(subBand));
fprintf(sfid,'Chart coverage  : decision %s, condition %s, MC/DC %s\n', ...
    cov.decision_str, cov.condition_str, cov.mcdc_str);
fclose(sfid);
type(fullfile(repPath,'summary.txt'));

fprintf('\nTo compare with the C-side MC/DC, run (in WSL):\n');
fprintf('  ./run_mcdc_native.sh && python3 verification/equivalence_live/compare_coverage.py\n');
fprintf('\nReports written to %s\n', repPath);
end

% ---------------------------------------------------------------- helpers
function [num, names] = mapChartState(v, n)
%MAPCHARTSTATE  Chart leaf-state enum -> C Mode_t values (+ names for the CSV).
% Name mapping mirrors inc/mode_logic_team.h; values must track Mode_t.
% 'None' (no active leaf) maps to -1 so it can never equal a valid c_mode --
% it would surface as a state mismatch instead of being silently accepted.
if isa(v,'timeseries'), v = v.Data; end
names = string(v(:));
keys = {'StandStill','EV_mode','RegenB_mode','Start_mode','ICE_mode','Hybrid_mode','None'};
vals = [ 0            1         2             3            4          5            -1  ];
map = containers.Map(keys, vals);
num = -ones(n,1);
for i = 1:min(n, numel(names))
    k = char(names(i));
    if ~isKey(map, k)
        error(['Chart leaf state "%s" has no Mode_t mapping. Update mapChartState in ' ...
               'run_live_equivalence.m (and confirm OutputMonitoringMode is ' ...
               '''LeafStateActivity'', not ''ChildActivity'').'], k);
    end
    num(i) = map(k);
end
if numel(names) ~= n
    warning('chart_state has %d rows, expected %d', numel(names), n);
end
end

function ensureParam(structName, dotted, value)
parts = strsplit(dotted,'.');
if evalin('base', sprintf('exist(''%s'',''var'')', structName))
    S = evalin('base', structName);
else
    S = struct();
end
try
    getfield(S, parts{:});  %#ok<GFLD>
    assignin('base', structName, S);
    return;
catch
end
S = setfield(S, parts{:}, value);   %#ok<SFLD>
assignin('base', structName, S);
fprintf('Set %s.%s = %g (default; provide opts.paramScript to override)\n', ...
    structName, dotted, value);
end

function forceParam(structName, dotted, value)
parts = strsplit(dotted,'.');
if evalin('base', sprintf('exist(''%s'',''var'')', structName))
    S = evalin('base', structName);
else
    S = struct();
end
S = setfield(S, parts{:}, value);   %#ok<SFLD>
assignin('base', structName, S);
fprintf('Forced %s.%s = %g\n', structName, dotted, value);
end

function v = getLogged(out, name, n, ncol)
% Read a To Workspace variable from the SimulationOutput (R2026a single-output
% mode stores them there), falling back to the base workspace for older modes.
v = [];
try
    if isa(out,'Simulink.SimulationOutput')
        names = out.who;
        if any(strcmp(name, names)), v = out.get(name); end
    end
catch
end
if isempty(v)
    try, v = evalin('base', name); catch, end
end
if isempty(v)
    error(['Logged variable "%s" not found in SimulationOutput or base. ' ...
           'Check the To Workspace blocks ran.'], name);
end
if isa(v,'timeseries'), v = v.Data; end
if size(v,2) ~= ncol && size(v,1) == ncol, v = v'; end
if size(v,1) ~= n
    warning('%s has %d rows, expected %d', name, size(v,1), n);
end
end

function s = ternary(c,a,b), if c, s=a; else, s=b; end, end
