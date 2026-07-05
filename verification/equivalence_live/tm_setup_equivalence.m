function tm_setup_equivalence()
%TM_SETUP_EQUIVALENCE  PRE-LOAD callback for the Test Manager equivalence test.
%   Reproduces steps 1-3 of run_live_equivalence.m (build artifacts if needed,
%   chart calibrations, stimulus -> base workspace, StopTime) so the Test
%   Manager can own the simulation, verdict, coverage and report instead of
%   the script. Keep defaults in sync with run_live_equivalence.m.
%
%   Test Manager usage (test case > CALLBACKS > PRE-LOAD):
%       addpath('verification/equivalence_live');   % if not already on path
%       tm_setup_equivalence;

Ts   = 1;
stim = 'boundary_stimulus.csv';
H    = 'mode_logic_equiv_harness';

here = fileparts(mfilename('fullpath'));
root = fileparts(fileparts(here));
addpath(here);
addpath(genpath(fullfile(root,'Model')));   % source model for harness rebuilds

% --- build artifacts if needed (same checks as run_live_equivalence) -------
if exist(['sfun_mode_logic.' mexext],'file') ~= 3
    build_sfun_mode_logic();
end
if ~exist(fullfile(here,[H '.slx']),'file')
    build_equivalence_harness(struct('harness',H,'Ts',Ts));
end
if ~bdIsLoaded(H), load_system(fullfile(here,[H '.slx'])); end
if getSimulinkBlockHandle([H '/chart_state']) < 0
    fprintf('Harness lacks chart_state logging; rebuilding...\n');
    build_equivalence_harness(struct('harness',H,'Ts',Ts));
    if ~bdIsLoaded(H), load_system(fullfile(here,[H '.slx'])); end
end

% --- chart calibrations (defaults match run_live_equivalence) --------------
S = struct();
if evalin('base','exist(''HEV_Param'',''var'')')
    S = evalin('base','HEV_Param');
end
if ~isfield(S,'Control'), S.Control = struct(); end
if ~isfield(S.Control,'Engine_Start_RPM'), S.Control.Engine_Start_RPM = 800; end
if ~isfield(S.Control,'Engine_Stop_RPM'),  S.Control.Engine_Stop_RPM  = 790; end
S.Control.Mode_Logic_TS = Ts;   % FORCE chart sample time to the harness step
assignin('base','HEV_Param',S);

% --- stimulus -> physical timeseries in the base workspace -----------------
T = readtable(fullfile(here,stim));
N = height(T);
t = (0:N-1)' * Ts;
assignin('base','ts_speed',[t, T.speed_kph]);
assignin('base','ts_pdem', [t, T.p_dem_kw]);
assignin('base','ts_soc',  [t, T.soc]);
assignin('base','ts_weng', [t, T.weng_rpm]);

% the harness is saved with StopTime 0 -- without this the sim ends at t=0
set_param(H,'StopTime',num2str((N-1)*Ts));
fprintf('tm_setup_equivalence: %d stimulus rows, StopTime=%g, Ts=%g\n', N, (N-1)*Ts, Ts);
end
