function manifest = export_replays(outputDir)
%EXPORT_REPLAYS Record the full HEV plant at the supervisor's sample instants.
% Results are written outside the source model. The loaded model is instrumented
% in memory only and is never saved. Run in a separate MATLAB batch session.
arguments
    outputDir (1,:) char
end
here = fileparts(mfilename('fullpath'));
root = fileparts(fileparts(here));
if ~exist(outputDir,'dir'), mkdir(outputDir); end
oldDir = pwd;
restoreDir = onCleanup(@() cd(oldDir)); %#ok<NASGU>
cd(outputDir);
Simulink.fileGenControl('set','CacheFolder',fullfile(outputDir,'cache'), ...
    'CodeGenFolder',fullfile(outputDir,'codegen'),'createDir',true);
modelDir = fullfile(root,'Model','HEV_powersplit_adapted');
addpath(genpath(modelDir));
model = 'HEV_powersplit_adapted';
assert(~bdIsLoaded(model),'Use a fresh MATLAB session; do not instrument an open user model.');
load_system(fullfile(modelDir,[model '.slx']));
discardModel = onCleanup(@() close_system(model,0)); %#ok<NASGU>
HEV_SeriesParallel_config_electrical(model,'System');
set_param(model,'SignalLogging','off','SimscapeLogType','none');
params = evalin('base','HEV_Param');
sampleTime = params.Control.Mode_Logic_TS;
assert(sampleTime==0.1,'Review the replay format if the controller sample time changes.');

chartPath = [model '/Control/Mode Logic'];
rt = sfroot;
chart = rt.find('-isa','Stateflow.Chart','Path',chartPath);
chart = chart(1);
chart.HasOutputData = true;
chart.OutputMonitoringMode = 'LeafStateActivity';
inputData = chart.find('-isa','Stateflow.Data','Scope','Input');
outputData = chart.find('-isa','Stateflow.Data','Scope','Output');
ports = get_param(chartPath,'PortHandles');
inputNames = {'speed','engine_speed','P_dem','charge'};
for i=1:numel(inputNames)
    d = inputData(strcmp({inputData.Name},inputNames{i}));
    line = get_param(ports.Inport(d.Port),'Line');
    source = get_param(line,'SrcPortHandle');
    addRecorder([model '/Control'],source,['replay_' inputNames{i}],sampleTime);
end
outputNames = {'Mot_Enable','Gen_Enable','ICE_Enable'};
for i=1:numel(outputNames)
    d = outputData(strcmp({outputData.Name},outputNames{i}));
    addRecorder([model '/Control'],ports.Outport(d.Port),['replay_' outputNames{i}],sampleTime);
end
addRecorder([model '/Control'],ports.Outport(end),'replay_mode',sampleTime);

manifest = struct('schema_version',1,'model',model,'chart','Control/Mode Logic', ...
    'generated_at_utc',char(datetime('now','TimeZone','UTC','Format',"yyyy-MM-dd'T'HH:mm:ss'Z'")), ...
    'matlab_version',version,'sample_time_s',sampleTime, ...
    'electrical_variant','System','solver',get_param(model,'Solver'), ...
    'relative_tolerance',get_param(model,'RelTol'),'absolute_tolerance',get_param(model,'AbsTol'), ...
    'capture','Full plant; supervisor input and output signals sampled without interpolation.', ...
    'state_names',{{'STANDSTILL','EV','REGENB','START','ICE','HYBRID'}});
products = ver;
manifest.products = products(ismember({products.Name}, ...
    {'MATLAB','Simulink','Stateflow','Simscape','Simscape Electrical','Simscape Driveline'}));
sources = {fullfile(modelDir,[model '.slx']), ...
    fullfile(modelDir,'Scripts_Data','HEV_Model_PARAM.m'), ...
    fullfile(modelDir,'Scripts_Data','HEV_SeriesParallel_param_detailed.m'), ...
    fullfile(modelDir,'Scripts_Data','HEV_SeriesParallel_config_electrical.m'), ...
    fullfile(modelDir,'Scripts_Data','FuelConsMap.mat'), ...
    fullfile(modelDir,'Scripts_Data','HEV_SeriesParallel_35kWCurrentRef.mat'), ...
    fullfile(modelDir,'Scripts_Data','UrbanCycle1.mat'), ...
    fullfile(modelDir,'Scripts_Data','UrbanCycle2.mat'),mfilename('fullpath')};
sources{end} = [sources{end} '.m'];
manifest.sources = struct([]);
for i=1:numel(sources)
    manifest.sources(i).path = strrep(erase(sources{i},[root filesep]),filesep,'/');
    manifest.sources(i).sha256 = sha256(sources{i});
end
stateNames = {'StandStill','EV_mode','RegenB_mode','Start_mode','ICE_mode','Hybrid_mode'};
driveCycles = evalin('base','DriveCycles');
manifest.cycles = struct([]);
for cycleNumber=1:2
    assignin('base','Drive_Cycle_Num',cycleNumber);
    duration = driveCycles(cycleNumber).time(end);
    set_param(model,'StopTime',num2str(duration));
    fprintf('Running full plant: UrbanCycle%d, %g s.\n',cycleNumber,duration);
    elapsed = tic;
    simInput = Simulink.SimulationInput(model);
    simInput = simInput.setModelParameter('ReturnWorkspaceOutputs','on');
    try
        out = sim(simInput);
    catch exception
        fprintf(2,'%s\n',getReport(exception,'extended','hyperlinks','off'));
        rethrow(exception);
    end
    seconds = toc(elapsed);
    speed = out.get('replay_speed');
    time = speed.Time(:);
    expected = (0:round(duration/sampleTime))'*sampleTime;
    assert(numel(time)==numel(expected) && max(abs(time-expected))<1e-7, ...
        'Unexpected sample times; do not interpolate controller records.');
    engine = values(out,'replay_engine_speed',time);
    demand = values(out,'replay_P_dem',time);
    charge = values(out,'replay_charge',time);
    motor = values(out,'replay_Mot_Enable',time);
    generator = values(out,'replay_Gen_Enable',time);
    ice = values(out,'replay_ICE_Enable',time);
    states = string(values(out,'replay_mode',time));
    [known,indices] = ismember(states,string(stateNames));
    assert(all(known),'Unrecognized Stateflow leaf state.');
    data = [time,double(speed.Data(:)),double(engine),double(demand),double(charge), ...
        indices(:)-1,double(motor),double(generator),double(ice)];
    assert(all(isfinite(data),'all'),'Non-finite values in full-plant output.');
    filename = sprintf('urban%d.csv',cycleNumber);
    fid = fopen(fullfile(outputDir,filename),'w');
    assert(fid~=-1,'Cannot open replay output.');
    fprintf(fid,'time_s,speed_kmh,engine_rpm,power_kw,soc,mode,motor_enabled,generator_enabled,engine_enabled\n');
    fprintf(fid,'%.17g,%.17g,%.17g,%.17g,%.17g,%d,%d,%d,%d\n',data');
    fclose(fid);
    manifest.cycles(cycleNumber).id = sprintf('urban%d',cycleNumber);
    manifest.cycles(cycleNumber).name = sprintf('UrbanCycle%d',cycleNumber);
    manifest.cycles(cycleNumber).duration_s = duration;
    manifest.cycles(cycleNumber).samples = size(data,1);
    manifest.cycles(cycleNumber).file = filename;
    manifest.cycles(cycleNumber).sha256 = sha256(fullfile(outputDir,filename));
    manifest.cycles(cycleNumber).simulation_wall_time_s = seconds;
    manifest.cycles(cycleNumber).input_min = min(data(:,2:5));
    manifest.cycles(cycleNumber).input_max = max(data(:,2:5));
    fprintf('Captured %d samples in %.1f s. Ranges [speed,rpm,demand,SOC]:\n',size(data,1),seconds);
    disp([min(data(:,2:5));max(data(:,2:5))]);
end
fid=fopen(fullfile(outputDir,'manifest.json'),'w');
fprintf(fid,'%s\n',jsonencode(manifest,PrettyPrint=true));
fclose(fid);
fprintf('Full-plant replay export complete. Source model was not saved.\n');
end

function addRecorder(parent,source,name,sampleTime)
block = [parent '/' name];
add_block('simulink/Sinks/To Workspace',block,'VariableName',name, ...
    'SaveFormat','Timeseries','SampleTime',num2str(sampleTime), ...
    'MaxDataPoints','inf','Decimation','1');
ports = get_param(block,'PortHandles');
add_line(parent,source,ports.Inport(1),'autorouting','on');
end

function data = values(out,name,time)
signal = out.get(name);
assert(numel(signal.Time)==numel(time) && max(abs(signal.Time(:)-time))<1e-7, ...
    'Recorded signals are not synchronized.');
data = signal.Data(:);
end

function hash = sha256(path)
fid = fopen(path,'rb');
assert(fid~=-1,'Missing source or output file: %s',path);
data = fread(fid,Inf,'*uint8');
fclose(fid);
digest = java.security.MessageDigest.getInstance('SHA-256');
digest.update(data);
bytes = typecast(digest.digest(),'uint8');
hash = lower(reshape(dec2hex(bytes,2)',1,[]));
end
