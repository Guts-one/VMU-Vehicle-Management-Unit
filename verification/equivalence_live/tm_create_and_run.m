function tm_create_and_run()
%TM_CREATE_AND_RUN  Create + run the Test Manager equivalence test, headless.
%   Creates mode_logic_equivalence.mldatx (simulation test + pre-load callback
%   + custom criteria + Decision/Condition/MCDC coverage), runs it, prints the
%   verdict, and generates a PDF report under Test report/equivalence_live/.
%   Logs everything to tm_test_log.txt (same diary pattern as verify_all.m).

here = fileparts(mfilename('fullpath'));
root = fileparts(fileparts(here));
cd(here); addpath(here);
addpath(genpath(fullfile(root,'Model')));

diary(fullfile(here,'tm_test_log.txt')); diary on;
c = onCleanup(@() diary('off'));
fprintf('==== TM TEST START %s ====\n', datestr(now));
fprintf('MATLAB: %s\n', version);
% ver('sltest') can false-negative (install without a formatted Contents.m),
% so probe the license feature + path instead.
fprintf('license Simulink_Test feature : %d\n', license('test','Simulink_Test'));
fprintf('sltestmgr on path             : %s\n', which('sltestmgr'));
assert(license('test','Simulink_Test')==1, ...
    'License does not include the Simulink_Test feature.');

mldatx = fullfile(here,'mode_logic_equivalence.mldatx');
repDir = fullfile(root,'Test report','equivalence_live');
if ~exist(repDir,'dir'), mkdir(repDir); end

% --- 1. fresh test file ------------------------------------------------------
fprintf('\n---- STEP: create test file ----\n');
sltest.testmanager.clear;          % close any open test files
sltest.testmanager.clearResults;
if exist(mldatx,'file'), delete(mldatx); end
tf = sltest.testmanager.TestFile(mldatx);
ts = tf.getTestSuites;
ts(1).Name = 'Model-code equivalence';
% delete the auto-created default case; create an explicit simulation test
def = ts(1).getTestCases;
tc = createTestCase(ts(1), 'simulation', 'chart vs hand C - outputs, state, MCDC');
if ~isempty(def), remove(def(1)); end

% --- 2. configure the test case ---------------------------------------------
fprintf('\n---- STEP: configure test case ----\n');
setProperty(tc, 'Model', 'mode_logic_equiv_harness');

preload = sprintf('addpath(''%s'');\ntm_setup_equivalence;', here);
setProperty(tc, 'PreloadCallback', preload);

critBody = sprintf([ ...
    '%%%% chart vs hand-written C: outputs AND state, subLSB excluded\n' ...
    'res = tm_check_equivalence(test.sltest_simout);\n' ...
    'test.verifyEqual(res.grid_mismatches, 0, sprintf( ...\n' ...
    '    ''%%d grid rows diverged (outputs or state)'', res.grid_mismatches));\n' ...
    'test.verifyEqual(res.state_mismatches, 0, ...\n' ...
    '    ''chart active leaf state vs C current_mode diverged on grid rows'');\n']);
cc = getCustomCriteria(tc);
cc.Callback = critBody;
cc.Enabled = true;

% --- 3. coverage at the test-file level --------------------------------------
fprintf('\n---- STEP: coverage settings ----\n');
cov = getCoverageSettings(tf);
cov.RecordCoverage = true;
cov.MetricSettings = 'dcm';        % d=decision, c=condition, m=MCDC
saveToFile(tf);
fprintf('Saved %s\n', mldatx);

% --- 4. run -------------------------------------------------------------------
fprintf('\n---- STEP: run (this simulates 473 steps with coverage) ----\n');
rs = sltest.testmanager.run;       % ResultSet for the one open test file
try, fprintf('ResultSet Outcome : %s\n', char(string(rs.Outcome))); catch, end

pass = false;
try
    tfr = getTestFileResults(rs);
    fprintf('TestFile Outcome  : %s  (passed %d / failed %d / total %d)\n', ...
        char(string(tfr.Outcome)), tfr.NumPassed, tfr.NumFailed, tfr.NumTotal);
    pass = tfr.NumFailed == 0 && tfr.NumPassed >= 1;
catch ME
    fprintf('Could not read TestFileResults (%s); falling back to ResultSet.\n', ME.message);
    try, pass = contains(char(string(rs.Outcome)),'Pass'); catch, end
end

% --- 5. report ----------------------------------------------------------------
fprintf('\n---- STEP: report ----\n');
pdf = fullfile(repDir,'tm_report.pdf');
try
    % IncludeTestResults: 0 = passed AND failed (default reports only failed,
    % which errors out on an all-pass run -- seen 2026-07-05)
    sltest.testmanager.report(rs, pdf, 'IncludeTestResults', 0, ...
        'IncludeCoverageResult', true, 'LaunchReport', false);
    fprintf('Report written: %s\n', pdf);
catch ME
    fprintf(2,'Report with coverage failed (%s); retrying minimal...\n', ME.message);
    try
        sltest.testmanager.report(rs, pdf, 'IncludeTestResults', 0, ...
            'LaunchReport', false);
        fprintf('Report written (minimal options): %s\n', pdf);
    catch ME2
        fprintf(2,'REPORT FAIL: %s\n', ME2.message);
    end
end

sltest.testmanager.close;
fprintf('\n==== TM TEST END  overall=%s ====\n', tern(pass,'PASS','FAIL'));
assert(pass, 'Test Manager run did not pass -- see log above.');
end

function r = tern(c,a,b), if c, r=a; else, r=b; end, end
