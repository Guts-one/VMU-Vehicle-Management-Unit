function res = tm_check_equivalence(simout)
%TM_CHECK_EQUIVALENCE  Custom-criteria backend for the Test Manager test.
%   res = TM_CHECK_EQUIVALENCE(simout) re-applies the same row-by-row
%   comparison as run_live_equivalence.m (outputs AND state; subLSB rows
%   reported separately, never failed) to a Simulink.SimulationOutput from
%   mode_logic_equiv_harness. Keep in sync with run_live_equivalence.m.
%
%   Test Manager usage (test case > CUSTOM CRITERIA, body of customCriteria):
%       res = tm_check_equivalence(test.sltest_simout);
%       test.verifyEqual(res.grid_mismatches, 0, ...
%           sprintf('%d grid rows diverged (outputs or state)', res.grid_mismatches));
%       test.verifyEqual(res.state_mismatches, 0, ...
%           'chart active leaf state vs C current_mode diverged on grid rows');

here = fileparts(mfilename('fullpath'));
T = readtable(fullfile(here,'boundary_stimulus.csv'));
N = height(T);
kind = string(T.kind);

chart_out = grab(simout,'chart_out',   N, 3);
c_out     = grab(simout,'c_out',       N, 3);
c_mode    = grab(simout,'c_mode',      N, 1);
chart_st  = grab(simout,'chart_state', N, 1);   % enum, leaf activity

% Leaf-state names -> Mode_t values. Mirror of inc/mode_logic_team.h; keep in
% sync with mapChartState in run_live_equivalence.m. 'None' -> -1 so an
% inactive chart can never silently equal a valid c_mode.
names = string(chart_st(:));
keys = {'StandStill','EV_mode','RegenB_mode','Start_mode','ICE_mode','Hybrid_mode','None'};
vals = [ 0            1         2             3            4          5            -1  ];
map = containers.Map(keys, vals);
chart_mode = -ones(N,1);
for i = 1:min(N, numel(names))
    k = char(names(i));
    if ~isKey(map, k)
        error('Chart leaf state "%s" has no Mode_t mapping (update tm_check_equivalence).', k);
    end
    chart_mode(i) = map(k);
end

outDiff   = any(round(chart_out) ~= round(c_out), 2);
stateDiff = chart_mode(:) ~= double(c_mode(:));
diffMask  = outDiff | stateDiff;

res = struct();
res.rows             = N;
res.grid_mismatches  = sum(diffMask  & kind ~= "subLSB");
res.state_mismatches = sum(stateDiff & kind ~= "subLSB");
res.subLSB_band_rows = sum(diffMask  & kind == "subLSB");
res.pass             = res.grid_mismatches == 0;
fprintf(['tm_check_equivalence: rows=%d grid_mismatches=%d state_mismatches=%d ' ...
         'subLSB_band=%d\n'], res.rows, res.grid_mismatches, ...
         res.state_mismatches, res.subLSB_band_rows);
end

% ---------------------------------------------------------------- helpers
function v = grab(out, name, n, ncol)
% To Workspace variables live in the SimulationOutput (R2026a single-output
% mode); fall back to the base workspace for older logging modes.
v = [];
try
    if isa(out,'Simulink.SimulationOutput') && any(strcmp(name, out.who))
        v = out.get(name);
    end
catch
end
if isempty(v)
    try, v = evalin('base', name); catch, end
end
if isempty(v)
    error('Logged variable "%s" not found in SimulationOutput or base workspace.', name);
end
if isa(v,'timeseries'), v = v.Data; end
if size(v,2) ~= ncol && size(v,1) == ncol, v = v'; end
if size(v,1) ~= n
    warning('%s has %d rows, expected %d', name, size(v,1), n);
end
end
