function verify_chart(recordingsDir)
%VERIFY_CHART Replay raw and C-quantized inputs through a fresh source chart.
% Run prepare_replays.js --inspect first to compile C and write its results.
root = fileparts(fileparts(fileparts(mfilename('fullpath'))));
work = fullfile(root,'build','model_replay');
oldDir = pwd;
restoreDir = onCleanup(@() cd(oldDir)); %#ok<NASGU>
cd(work);
Simulink.fileGenControl('set','CacheFolder',fullfile(work,'cache'), ...
    'CodeGenFolder',fullfile(work,'codegen'),'createDir',true);
model = 'HEV_powersplit_adapted';
modelDir = fullfile(root,'Model',model);
addpath(genpath(modelDir));
assert(~bdIsLoaded(model),'Use a fresh MATLAB session.');
load_system(fullfile(modelDir,[model '.slx']));
discardSource = onCleanup(@() close_system(model,0)); %#ok<NASGU>
H = 'vmu_recording_chart_check';
new_system(H);
discardHarness = onCleanup(@() close_system(H,0)); %#ok<NASGU>
chartBlk = [H '/Mode Logic'];
add_block([model '/Control/Mode Logic'],chartBlk);
rt = sfroot;
ch = rt.find('-isa','Stateflow.Chart','Path',chartBlk);
ch = ch(1);
ch.HasOutputData = true;
ch.OutputMonitoringMode = 'LeafStateActivity';
ins = ch.find('-isa','Stateflow.Data','Scope','Input');
vars = struct('speed','ts_speed','P_dem','ts_pdem','charge','ts_soc','engine_speed','ts_weng');
for i=1:numel(ins)
    name = ins(i).Name;
    add_block('simulink/Sources/From Workspace',[H '/' name '_input'], ...
        'VariableName',vars.(name),'SampleTime','0.1','Interpolate','off', ...
        'OutputAfterFinalValue','Holding final value');
    add_line(H,[name '_input/1'],sprintf('Mode Logic/%d',ins(i).Port));
end
outs = ch.find('-isa','Stateflow.Data','Scope','Output');
outnames = {'Mot_Enable','Gen_Enable','ICE_Enable'};
add_block('simulink/Signal Routing/Mux',[H '/enables'],'Inputs','3');
for i=1:numel(outnames)
    d = outs(strcmp({outs.Name},outnames{i}));
    add_line(H,sprintf('Mode Logic/%d',d.Port),sprintf('enables/%d',i));
end
add_block('simulink/Sinks/To Workspace',[H '/outputs'], ...
    'VariableName','chart_enables','SaveFormat','Array');
add_line(H,'enables/1','outputs/1');
add_block('simulink/Sinks/To Workspace',[H '/state'], ...
    'VariableName','chart_state','SaveFormat','Timeseries');
p = get_param(chartBlk,'Ports');
add_line(H,sprintf('Mode Logic/%d',p(2)),'state/1');
set_param(H,'SolverType','Fixed-step','Solver','FixedStepDiscrete', ...
    'FixedStep','0.1','StartTime','0','SaveOutput','off');
stateNames = {'StandStill','EV_mode','RegenB_mode','Start_mode','ICE_mode','Hybrid_mode'};
cNames = {'STANDSTILL','EV','REGENB','START','ICE','HYBRID'};
report = struct('matlab_version',version,'cycles',struct([]));
for k=1:2
    id = sprintf('urban%d',k);
    rawFile = fullfile(recordingsDir,[id '.csv']);
    fixedFile = fullfile(work,[id '-fixed.csv']);
    cFile = fullfile(work,[id '-c.csv']);
    raw = readtable(rawFile);
    fixed = readtable(fixedFile);
    c = readtable(cFile);
    [known,cMode] = ismember(string(c.mode),string(cNames));
    assert(all(known));
    counts = zeros(1,2);
    for pass=1:2
        if pass==1
            T = raw;
            expected = [raw.mode,raw.motor_enabled,raw.generator_enabled,raw.engine_enabled];
        else
            T = fixed;
            expected = [cMode-1,c.Mot,c.Gen,c.ICE];
        end
        t = T.time_s;
        simInput = Simulink.SimulationInput(H);
        simInput = simInput.setVariable('ts_speed',[t,T.speed_kmh]);
        simInput = simInput.setVariable('ts_pdem',[t,T.power_kw]);
        simInput = simInput.setVariable('ts_soc',[t,T.soc]);
        simInput = simInput.setVariable('ts_weng',[t,T.engine_rpm]);
        simInput = simInput.setModelParameter('StopTime',num2str(t(end)),'ReturnWorkspaceOutputs','on');
        out = sim(simInput);
        leaf = out.get('chart_state');
        [known,indices] = ismember(string(leaf.Data(:)),string(stateNames));
        assert(all(known) && numel(indices)==height(T));
        assert(max(abs(leaf.Time(:)-t))<1e-7,'Sample time mismatch');
        actual = [indices-1,out.get('chart_enables')];
        counts(pass) = sum(any(actual~=expected,2));
    end
    report.cycles(k).id = id;
    report.cycles(k).samples = height(raw);
    report.cycles(k).raw_chart_vs_plant_mismatches = counts(1);
    report.cycles(k).quantized_chart_vs_c_mismatches = counts(2);
    report.cycles(k).recording_sha256 = sha256(rawFile);
    report.cycles(k).fixed_input_sha256 = sha256(fixedFile);
    report.cycles(k).c_output_sha256 = sha256(cFile);
    fprintf('%s: raw chart/plant differences=%d; quantized chart/C differences=%d\n',id,counts);
end
report.source_model_sha256 = sha256(fullfile(modelDir,[model '.slx']));
report.verifier_sha256 = sha256([mfilename('fullpath') '.m']);
fid=fopen(fullfile(work,'chart-validation.json'),'w');
fprintf(fid,'%s\n',jsonencode(report,PrettyPrint=true));
fclose(fid);
assert(all([report.cycles.raw_chart_vs_plant_mismatches]==0));
assert(all([report.cycles.quantized_chart_vs_c_mismatches]==0));
end

function hash = sha256(path)
fid = fopen(path,'rb');
assert(fid~=-1);
bytes = fread(fid,Inf,'*uint8');
fclose(fid);
digest = java.security.MessageDigest.getInstance('SHA-256');
digest.update(bytes);
hash = lower(reshape(dec2hex(typecast(digest.digest(),'uint8'),2)',1,[]));
end
