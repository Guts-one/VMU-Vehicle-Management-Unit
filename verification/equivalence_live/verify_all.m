function verify_all()
%VERIFY_ALL  Headless self-check of the live-equivalence toolkit (matlab -batch).
%   Logs every stage to verify_log.txt with explicit STEP OK / STEP FAIL lines.
here = fileparts(mfilename('fullpath'));
root = fileparts(fileparts(here));
cd(here); addpath(here);
addpath(genpath(fullfile(root,'Model')));   % so HEV_powersplit_adapted.slx loads

diary(fullfile(here,'verify_log.txt')); diary on;
fprintf('==== VERIFY START %s ====\n', datestr(now));
fprintf('MATLAB: %s\n', version);
tb = {'simulink','Simulink'; 'stateflow','Stateflow'; ...
      'sltest','Simulink Test'; 'slcoverage','Simulink Coverage'; ...
      'simulinkcoder','Simulink Coder'; 'ecoder','Embedded Coder'};
for i=1:size(tb,1)
    fprintf('  toolbox %-18s : %s\n', tb{i,2}, tern(~isempty(ver(tb{i,1})),'YES','no'));
end
% ver-based rows can false-negative (e.g. sltest with no formatted Contents.m);
% the license feature test is authoritative:
fprintf('  license Simulink_Test feature : %s\n', ...
    tern(license('test','Simulink_Test')==1,'YES','no'));
cc = mex.getCompilerConfigurations('C','Selected');
if isempty(cc), fprintf('  MEX C compiler     : NONE (run mex -setup C)\n');
else, fprintf('  MEX C compiler     : %s\n', cc.Name); end

ok = true;
ok = step('build S-Function (legacy_code)', @() build_sfun_mode_logic()) && ok;
ok = step('build co-sim harness',           @() build_equivalence_harness()) && ok;
[sok, res] = step_out('run live equivalence', @() run_live_equivalence());
ok = sok && ok;
if sok && isstruct(res)
    fprintf('\n  RESULT pass=%d  grid_mismatches=%d  state_mismatches=%d  subLSB_band=%d\n', ...
        res.pass, res.grid_mismatches, res.state_mismatches, res.subLSB_band_rows);
    pr('chart decision', res, 'chart_decision');
    pr('chart condition', res, 'chart_condition');
    pr('chart MC/DC', res, 'chart_mcdc');
end

fprintf('\n==== VERIFY END  overall=%s ====\n', tern(ok,'OK','HAS FAILURES'));
diary off;
end

function pr(label, res, fld)
if isfield(res,fld) && numel(res.(fld))==2
    v=res.(fld);
    fprintf('  %-15s : %d/%d\n', label, v(1), v(2));
end
end

function r = tern(c,a,b), if c, r=a; else, r=b; end, end

function ok = step(name, fn)
fprintf('\n---- STEP: %s ----\n', name);
t=tic;
try
    fn(); ok=true;
    fprintf('STEP OK (%.1fs): %s\n', toc(t), name);
catch ME
    ok=false;
    fprintf(2,'STEP FAIL: %s\n%s\n', name, getReport(ME,'extended','hyperlinks','off'));
end
end

function [ok,out] = step_out(name, fn)
fprintf('\n---- STEP: %s ----\n', name);
t=tic; out=[];
try
    out=fn(); ok=true;
    fprintf('STEP OK (%.1fs): %s\n', toc(t), name);
catch ME
    ok=false;
    fprintf(2,'STEP FAIL: %s\n%s\n', name, getReport(ME,'extended','hyperlinks','off'));
end
end
