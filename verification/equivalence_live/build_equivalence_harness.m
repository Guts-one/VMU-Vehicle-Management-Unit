function harness = build_equivalence_harness(opts)
%BUILD_EQUIVALENCE_HARNESS  Co-simulation harness: chart + hand-code S-Function.
%   chart (Control/Mode Logic, the live oracle) and the hand C (sfun_mode_logic)
%   driven by the SAME physical stimulus; C path applies the identical fixed-point
%   quantization in-model (Gain -> Data Type Conversion, RndMeth Round, saturate).
%   FSM state external: C mode_out -> Unit Delay(init 0) -> C mode_in.

if nargin < 1, opts = struct(); end
def = struct('srcModel','HEV_powersplit_adapted', 'chartPath','', ...
             'harness','mode_logic_equiv_harness', 'Ts',1);
fn = fieldnames(def);
for k = 1:numel(fn)
    if ~isfield(opts,fn{k}) || isempty(opts.(fn{k})), opts.(fn{k}) = def.(fn{k}); end
end
if isempty(opts.chartPath)
    opts.chartPath = [opts.srcModel '/Control/Mode Logic'];
end

here = fileparts(mfilename('fullpath'));
if exist(['sfun_mode_logic.' mexext],'file') ~= 3
    error('sfun_mode_logic.%s not found. Run build_sfun_mode_logic first.', mexext);
end

% load the source model so we can copy the chart (leave it loaded; do NOT
% auto-close a large Simscape model in -batch -- that was crashing the run).
if ~bdIsLoaded(opts.srcModel), load_system(opts.srcModel); end
assert(getSimulinkBlockHandle(opts.chartPath) >= 0, ...
    'Chart block "%s" not found. Set opts.chartPath.', opts.chartPath);
% make the chart sample time match the harness step already at build time
try
    HEV_Param = evalin('base','HEV_Param'); %#ok<NASGU>
    evalin('base', sprintf('HEV_Param.Control.Mode_Logic_TS = %g;', opts.Ts));
catch
end

H = opts.harness;
if bdIsLoaded(H), close_system(H,0); end
new_system(H);
X = struct('src',30,'gain',360,'dtc',500,'sf',680,'cmp',900,'sink',1080,'fan',210);
P = @(x,y) [x y x+90 y+30];

phys = { 'speed','ts_speed';  'P_dem','ts_pdem';  'charge','ts_soc';  'weng','ts_weng' };
yrow = 40; dy = 90;
for i = 1:size(phys,1)
    add_block('simulink/Sources/From Workspace', [H '/' phys{i,1} '_in'], ...
        'VariableName', phys{i,2}, 'Position', P(X.src, yrow), ...
        'SampleTime', num2str(opts.Ts), 'Interpolate','off', ...
        'OutputAfterFinalValue','Holding final value');
    yrow = yrow + dy;
end

chartBlk = [H '/Mode Logic'];
add_block(opts.chartPath, chartBlk, 'Position', [X.fan 40 X.fan+140 360]);
enableLeafStateOutput(chartBlk);   % active-state (leaf) output on the COPY only
[inIdx, outIdx] = chartPorts(chartBlk);

cspec = { 'speed', 10,    'uint16', 'speed'
          'P_dem', 10,    'int16',  'P_dem'
          'charge',10000, 'uint16', 'charge'
          'weng',  1,     'uint16', 'engine_speed' };
yrow = 40;
for i = 1:size(cspec,1)
    add_block('simulink/Math Operations/Gain', [H '/' cspec{i,1} '_scale'], ...
        'Gain', num2str(cspec{i,2}), 'Position', P(X.gain, yrow));
    add_block('simulink/Signal Attributes/Data Type Conversion', [H '/' cspec{i,1} '_fx'], ...
        'OutDataTypeStr', cspec{i,3}, 'RndMeth','Round', ...
        'SaturateOnIntegerOverflow','on', 'Position', P(X.dtc, yrow));
    yrow = yrow + dy;
end

sfBlk = [H '/C_ModeLogic'];
add_block('built-in/S-Function', sfBlk, 'FunctionName','sfun_mode_logic', ...
    'Position', [X.sf 60 X.sf+120 260]);
add_block('simulink/Discrete/Unit Delay', [H '/mode_delay'], ...
    'InitialCondition','uint8(0)', 'SampleTime', num2str(opts.Ts), ...
    'Position', [X.sf+10 320 X.sf+90 360]);

add_block('simulink/Signal Routing/Mux', [H '/mux_chart'], 'Inputs','3', ...
    'Position', [X.cmp 60 X.cmp+10 180]);
add_block('simulink/Signal Routing/Mux', [H '/mux_c'], 'Inputs','3', ...
    'Position', [X.cmp 220 X.cmp+10 340]);
add_block('simulink/Sinks/To Workspace', [H '/chart_out'], ...
    'VariableName','chart_out','SaveFormat','Array', 'Position', P(X.sink,80));
add_block('simulink/Sinks/To Workspace', [H '/c_out'], ...
    'VariableName','c_out','SaveFormat','Array', 'Position', P(X.sink,240));
add_block('simulink/Sinks/To Workspace', [H '/c_mode'], ...
    'VariableName','c_mode','SaveFormat','Array', 'Position', P(X.sink,400));
% chart active LEAF state (enum) -> logged for state-level equivalence vs c_mode.
% Timeseries format: To Workspace 'Array' does not take enumerated signals.
add_block('simulink/Sinks/To Workspace', [H '/chart_state'], ...
    'VariableName','chart_state','SaveFormat','Timeseries', 'Position', P(X.sink,560));

% wiring
add_line(H, 'speed_in/1',  sprintf('Mode Logic/%d', inIdx.speed), 'autorouting','on');
add_line(H, 'P_dem_in/1',  sprintf('Mode Logic/%d', inIdx.P_dem), 'autorouting','on');
add_line(H, 'charge_in/1', sprintf('Mode Logic/%d', inIdx.charge), 'autorouting','on');
add_line(H, 'weng_in/1',   sprintf('Mode Logic/%d', inIdx.engine_speed), 'autorouting','on');
add_line(H, 'speed_in/1',  'speed_scale/1',  'autorouting','on');
add_line(H, 'P_dem_in/1',  'P_dem_scale/1',  'autorouting','on');
add_line(H, 'charge_in/1', 'charge_scale/1', 'autorouting','on');
add_line(H, 'weng_in/1',   'weng_scale/1',   'autorouting','on');
add_line(H, 'speed_scale/1','speed_fx/1','autorouting','on');
add_line(H, 'P_dem_scale/1','P_dem_fx/1','autorouting','on');
add_line(H, 'charge_scale/1','charge_fx/1','autorouting','on');
add_line(H, 'weng_scale/1','weng_fx/1','autorouting','on');
add_line(H, 'speed_fx/1',  'C_ModeLogic/1','autorouting','on');
add_line(H, 'P_dem_fx/1',  'C_ModeLogic/2','autorouting','on');
add_line(H, 'charge_fx/1', 'C_ModeLogic/3','autorouting','on');
add_line(H, 'weng_fx/1',   'C_ModeLogic/4','autorouting','on');
add_line(H, 'C_ModeLogic/1','mode_delay/1','autorouting','on');
add_line(H, 'mode_delay/1', 'C_ModeLogic/5','autorouting','on');
add_line(H, sprintf('Mode Logic/%d',outIdx.Mot_Enable),'mux_chart/1','autorouting','on');
add_line(H, sprintf('Mode Logic/%d',outIdx.Gen_Enable),'mux_chart/2','autorouting','on');
add_line(H, sprintf('Mode Logic/%d',outIdx.ICE_Enable),'mux_chart/3','autorouting','on');
add_line(H, 'mux_chart/1','chart_out/1','autorouting','on');
add_line(H, 'C_ModeLogic/2','mux_c/1','autorouting','on');
add_line(H, 'C_ModeLogic/3','mux_c/2','autorouting','on');
add_line(H, 'C_ModeLogic/4','mux_c/3','autorouting','on');
add_line(H, 'mux_c/1','c_out/1','autorouting','on');
add_line(H, 'C_ModeLogic/1','c_mode/1','autorouting','on');
ports = get_param(chartBlk,'Ports');   % active-state port is appended LAST
add_line(H, sprintf('Mode Logic/%d', ports(2)), 'chart_state/1', 'autorouting','on');

set_param(H, 'SolverType','Fixed-step', 'Solver','FixedStepDiscrete', ...
    'FixedStep', num2str(opts.Ts), 'StartTime','0', 'StopTime','0', 'SaveOutput','off');

% provide placeholder stimulus vars so wiring/types validate at build time
for vv = {'ts_speed','ts_pdem','ts_soc','ts_weng'}
    if ~evalin('base', sprintf('exist(''%s'',''var'')', vv{1}))
        assignin('base', vv{1}, [0 0; opts.Ts 0]);
    end
end

% validate; report DETAILED causes instead of a vague message
try
    set_param(H,'SimulationCommand','update');
    fprintf('Harness compiled clean.\n');
catch ME
    fprintf(2,'Harness compile reported issues: %s\n', ME.message);
    if isprop(ME,'cause')
        for k=1:numel(ME.cause)
            fprintf(2,'  cause %d: %s\n', k, ME.cause{k}.message);
        end
    end
end

save_system(H, fullfile(here, [H '.slx']));
fprintf('Built harness %s.slx in %s\n', H, here);
harness = H;
end

% ------------------------------------------------------------------ helpers
function enableLeafStateOutput(chartBlk)
%ENABLELEAFSTATEOUTPUT  Add an active-state output port to the copied chart.
% LEAF granularity is required: 'ChildActivity' would collapse the three
% Motion_mode_ICE children (Start_mode/ICE_mode/Hybrid_mode) into one value,
% and those are exactly the modes the C FSM distinguishes (MODE_START/ICE/HYBRID).
% Only the harness COPY is modified; the source model chart is untouched.
rt = sfroot;
ch = rt.find('-isa','Stateflow.Chart','Path',chartBlk);
assert(~isempty(ch), 'Could not resolve Stateflow chart at %s', chartBlk);
ch = ch(1);
pb = get_param(chartBlk,'Ports'); nBefore = pb(2);
try
    ch.HasOutputData = true;                        % creates the output port
    ch.OutputMonitoringMode = 'LeafStateActivity';  % leaf, NOT child activity
catch ME
    error(['Could not enable the active-state output programmatically (%s). ' ...
           'Fallback: select the chart, Property Inspector -> ' ...
           '"Create output for monitoring" -> "Leaf state activity", then re-run.'], ...
           ME.message);
end
try   % cosmetic only (port/data name); property name differs across releases
    ch.OutputData = 'chart_state';
catch
    try, ch.OutputPortName = 'chart_state'; catch, end
end
pa = get_param(chartBlk,'Ports'); nAfter = pa(2);
assert(nAfter == nBefore+1, ...
    'Active-state output port did not appear (outputs %d -> %d).', nBefore, nAfter);
fprintf('Active-state (leaf) output enabled -> chart output port %d\n', nAfter);
end

function [inIdx, outIdx] = chartPorts(chartBlk)
rt = sfroot;
ch = rt.find('-isa','Stateflow.Chart','Path',chartBlk);
assert(~isempty(ch), 'Could not resolve Stateflow chart at %s', chartBlk);
ch = ch(1);
inIdx = struct(); outIdx = struct();
ins  = ch.find('-isa','Stateflow.Data','Scope','Input');
outs = ch.find('-isa','Stateflow.Data','Scope','Output');
for k = 1:numel(ins),  inIdx.(ins(k).Name)  = ins(k).Port;  end
for k = 1:numel(outs), outIdx.(outs(k).Name) = outs(k).Port; end
for f = {'speed','P_dem','charge','engine_speed'}
    assert(isfield(inIdx,f{1}), 'Chart missing input data "%s"', f{1});
end
for f = {'Mot_Enable','Gen_Enable','ICE_Enable'}
    assert(isfield(outIdx,f{1}), 'Chart missing output data "%s"', f{1});
end
end
