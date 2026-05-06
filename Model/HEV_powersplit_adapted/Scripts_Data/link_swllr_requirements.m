function link_swllr_requirements(varargin)
% LINK_SWLLR_REQUIREMENTS  Creates the 23 low-level software requirements
% (SwLLR01..SwLLR23) directly in a Simulink Requirements set and links
% each one to the matching transition of HEV_powersplit_adapted/Control/
% Mode Logic.
%
% Why this script exists: importing the Word document via slreq.import
% kept failing with "Argument must be a text scalar" on save. Building
% the requirement set programmatically sidesteps the entire import path:
% the 23 SwLLRs are created in MATLAB with their CustomID, Summary, and
% Description, then linked to the corresponding Stateflow transitions.
%
% Usage:
%   >> link_swllr_requirements
%   >> link_swllr_requirements('reset', true)   % delete existing reqset and rebuild
%
% Requires Simulink Requirements Toolbox.
%
% Output: a file HEV_powersplit_adapted_swllr.slreqx next to the model,
% with 23 requirements linked to the 17 chart transitions T1..T17 (the
% three software variants of T9, T10, T11 each link to the same chart
% transition because the chart does not split them by source state).

% --- Parse options -------------------------------------------------------
p = inputParser;
p.addParameter('reset', false, @(x) islogical(x) || isnumeric(x));
p.parse(varargin{:});
opts = p.Results;
opts.reset = logical(opts.reset);

modelName  = 'HEV_powersplit_adapted';
chartPath  = [modelName '/Control/Mode Logic'];
reqsetName = [modelName '_swllr'];

scriptDir  = fileparts(mfilename('fullpath'));
modelDir   = fileparts(scriptDir);
slreqxFile = fullfile(modelDir, [reqsetName '.slreqx']);

% --- 1. Open model -------------------------------------------------------
fprintf('Loading model %s ...\n', modelName);
load_system(modelName);

% --- 2. Reset if requested ----------------------------------------------
if opts.reset
    try, slreq.clear; end %#ok<TRYNC>
    if isfile(slreqxFile)
        delete(slreqxFile);
        fprintf('Deleted previous reqset: %s\n', slreqxFile);
    end
end

% --- 3. Find the Stateflow chart and its transitions --------------------
sfr = sfroot;
chart = sfr.find('-isa', 'Stateflow.Chart', 'Path', chartPath);
if isempty(chart)
    allCharts = sfr.find('-isa', 'Stateflow.Chart');
    for k = 1:numel(allCharts)
        if strcmp(allCharts(k).Name, 'Mode Logic') && ...
                contains(allCharts(k).Path, modelName)
            chart = allCharts(k); break;
        end
    end
end
assert(~isempty(chart), 'Could not find chart at %s', chartPath);
if numel(chart) > 1, chart = chart(1); end
fprintf('Chart located: %s\n', chart.Path);

trans_all = chart.find('-isa', 'Stateflow.Transition');
transBy = @(ssid) findBySSID(trans_all, ssid);

% --- 4. Create or load the reqset ---------------------------------------
rs = findOrCreateReqSet(reqsetName, slreqxFile);

% --- 5. Define the 23 SwLLR requirements --------------------------------
% Columns: CustomID, Summary, full requirement statement, target transition SSIDs.
%
% Transitions T2/T11/T13 go through a junction in the chart, so each
% software-level requirement that maps to them is linked to BOTH halves
% of the junction-mediated transition.
R = {
'SwLLR01', 'Standstill Mode to EV Mode', ...
    'When the active software mode is the standstill mode and speed > SPEED_STOP && speed <= SPEED_EV_MAX && SOC >= SOC_EV_IN, the software shall transition to EV mode.', ...
    47;
'SwLLR02', 'Standstill Mode to Start Mode', ...
    'When the active software mode is the standstill mode and speed > SPEED_STOP && (speed > SPEED_EV_MAX || SOC < SOC_EV_IN), the software shall transition to Start mode.', ...
    [49 50];
'SwLLR03', 'EV Mode to Regenerative-Braking Mode', ...
    'When the active software mode is EV mode and speed > SPEED_REGEN && P_dem <= PDEM_REGEN, the software shall transition to the regenerative-braking mode.', ...
    44;
'SwLLR04', 'EV Mode to Start Mode', ...
    'When the active software mode is EV mode and (speed > SPEED_EV_MAX || P_dem >= PDEM_HYB_IN || SOC < SOC_EV_OUT), the software shall transition to Start mode.', ...
    65;
'SwLLR05', 'EV Mode to Standstill Mode', ...
    'When the active software mode is EV mode and speed <= SPEED_STOP && P_dem <= PDEM_STOP_HIGH && P_dem >= PDEM_STOP_LOW, the software shall transition to the standstill mode.', ...
    76;
'SwLLR06', 'Regenerative-Braking Mode to Start Mode', ...
    'When the active software mode is the regenerative-braking mode and (((speed > SPEED_EV_MAX) && (P_dem >= PDEM_STOP_LOW)) || SOC < SOC_EV_OUT), the software shall transition to Start mode.', ...
    17;
'SwLLR07', 'Regenerative-Braking Mode to Standstill Mode', ...
    'When the active software mode is the regenerative-braking mode and speed <= SPEED_STOP && P_dem <= PDEM_STOP_HIGH && P_dem >= PDEM_STOP_LOW, the software shall transition to the standstill mode.', ...
    51;
'SwLLR08', 'Regenerative-Braking Mode to EV Mode', ...
    'When the active software mode is the regenerative-braking mode and P_dem >= PDEM_STOP_LOW && speed > SPEED_STOP && speed <= SPEED_EV_MAX && SOC >= SOC_EV_OUT, the software shall transition to EV mode.', ...
    67;
'SwLLR09', 'Start Mode to Regenerative-Braking Mode', ...
    'When the active software mode is Start mode and wEng > ENG_ON && speed > SPEED_REGEN && P_dem <= PDEM_REGEN, the software shall transition to the regenerative-braking mode.', ...
    16;
'SwLLR10', 'ICE Mode to Regenerative-Braking Mode', ...
    'When the active software mode is ICE mode and wEng > ENG_ON && speed > SPEED_REGEN && P_dem <= PDEM_REGEN, the software shall transition to the regenerative-braking mode.', ...
    16;
'SwLLR11', 'Hybrid Mode to Regenerative-Braking Mode', ...
    'When the active software mode is Hybrid mode and wEng > ENG_ON && speed > SPEED_REGEN && P_dem <= PDEM_REGEN, the software shall transition to the regenerative-braking mode.', ...
    16;
'SwLLR12', 'Start Mode to EV Mode', ...
    'When the active software mode is Start mode and wEng > ENG_ON && P_dem <= PDEM_HYB_OUT && P_dem >= PDEM_STOP_LOW && speed > SPEED_STOP && speed <= SPEED_EV_MAX && SOC >= SOC_EV_IN, the software shall transition to EV mode.', ...
    66;
'SwLLR13', 'ICE Mode to EV Mode', ...
    'When the active software mode is ICE mode and wEng > ENG_ON && P_dem <= PDEM_HYB_OUT && P_dem >= PDEM_STOP_LOW && speed > SPEED_STOP && speed <= SPEED_EV_MAX && SOC >= SOC_EV_IN, the software shall transition to EV mode.', ...
    66;
'SwLLR14', 'Hybrid Mode to EV Mode', ...
    'When the active software mode is Hybrid mode and wEng > ENG_ON && P_dem <= PDEM_HYB_OUT && P_dem >= PDEM_STOP_LOW && speed > SPEED_STOP && speed <= SPEED_EV_MAX && SOC >= SOC_EV_IN, the software shall transition to EV mode.', ...
    66;
'SwLLR15', 'Start Mode to Standstill Mode', ...
    'When the active software mode is Start mode and speed <= SPEED_STOP && P_dem <= PDEM_STOP_HIGH && P_dem >= PDEM_STOP_LOW, the software shall transition to the standstill mode.', ...
    [80 81];
'SwLLR16', 'ICE Mode to Standstill Mode', ...
    'When the active software mode is ICE mode and speed <= SPEED_STOP && P_dem <= PDEM_STOP_HIGH && P_dem >= PDEM_STOP_LOW, the software shall transition to the standstill mode.', ...
    [80 81];
'SwLLR17', 'Hybrid Mode to Standstill Mode', ...
    'When the active software mode is Hybrid mode and speed <= SPEED_STOP && P_dem <= PDEM_STOP_HIGH && P_dem >= PDEM_STOP_LOW, the software shall transition to the standstill mode.', ...
    [80 81];
'SwLLR18', 'Start Mode to Hybrid Mode', ...
    'When the active software mode is Start mode and wEng > ENG_ON && SOC >= SOC_MID && (speed > SPEED_EV_MAX || P_dem >= PDEM_HYB_MID), the software shall transition to Hybrid mode.', ...
    21;
'SwLLR19', 'Start Mode to ICE Mode', ...
    'When the active software mode is Start mode and wEng > ENG_ON && (SOC < SOC_MID || (speed <= SPEED_EV_MAX && P_dem < PDEM_HYB_MID)), the software shall transition to ICE mode.', ...
    [61 75];
'SwLLR20', 'ICE Mode to Start Mode', ...
    'When the active software mode is ICE mode and wEng <= ENG_OFF, the software shall transition to Start mode.', ...
    62;
'SwLLR21', 'ICE Mode to Hybrid Mode', ...
    'When the active software mode is ICE mode and P_dem >= PDEM_HYB_MID && SOC >= SOC_MID, the software shall transition to Hybrid mode.', ...
    68;
'SwLLR22', 'Hybrid Mode to Start Mode', ...
    'When the active software mode is Hybrid mode and wEng <= ENG_OFF, the software shall transition to Start mode.', ...
    12;
'SwLLR23', 'Hybrid Mode to ICE Mode', ...
    'When the active software mode is Hybrid mode and (P_dem <= PDEM_HYB_LOW || SOC < SOC_LOW), the software shall transition to ICE mode.', ...
    69;
};

% --- 6. Create requirements (if missing) and links ----------------------
nReqAdded = 0; nLinked = 0; nWarn = 0;
for i = 1:size(R, 1)
    cid     = R{i, 1};
    summ    = R{i, 2};
    descr   = R{i, 3};
    ssids   = R{i, 4};

    % Find or create the requirement
    req = findReqByCustomId(rs, cid);
    if isempty(req)
        [req, addErr] = createRequirement(rs, cid, summ, descr);
        if isempty(req)
            warning('Could not create requirement %s: %s', cid, addErr);
            nWarn = nWarn + 1;
            continue;
        end
        nReqAdded = nReqAdded + 1;
    end

    % Resolve transitions and link them
    transitions = arrayfun(@(s) transBy(s), ssids, 'UniformOutput', false);
    transitions = [transitions{:}]; % drop empty
    if isempty(transitions)
        warning('No transition resolved for %s (SSIDs %s)', cid, mat2str(ssids));
        nWarn = nWarn + 1;
        continue;
    end
    for k = 1:numel(transitions)
        tgt = transitions(k);
        link = tryCreateLink(tgt, req);
        if ischar(link) || isstring(link)
            if contains(string(link), 'already', 'IgnoreCase', true)
                % already linked - silent
            else
                warning('  %s: link error: %s', cid, link);
                nWarn = nWarn + 1;
            end
        else
            try, link.Type = 'Implement'; end %#ok<TRYNC>
            nLinked = nLinked + 1;
            fprintf('  %s -> Transition SSID %d  [%s]\n', cid, tgt.SSID, ...
                firstN(strrep(strtrim(tgt.LabelString), newline, ' '), 60));
        end
    end
end

fprintf('\nSummary: %d requirement(s) created, %d link(s) created, %d warning(s).\n', ...
    nReqAdded, nLinked, nWarn);

% --- 7. Save & open editor ----------------------------------------------
trySave(rs, slreqxFile);
try, slreq.editor; end %#ok<TRYNC>

end

% =========================================================================
function obj = findBySSID(arr, ssid)
obj = arr(arrayfun(@(o) isequal(o.SSID, ssid), arr));
if numel(obj) > 1, obj = obj(1); end
end

% =========================================================================
function rs = findOrCreateReqSet(name, filePath)
% Try in this order:
%   1. Already-loaded reqset with matching Name
%   2. Load from filePath if it exists on disk
%   3. Create a new reqset
rs = [];
try
    all = slreq.find('Type','ReqSet');
    for i = 1:numel(all)
        try
            if strcmp(all(i).Name, name)
                rs = all(i); return;
            end
        catch
        end
    end
catch
end
if isfile(filePath)
    try
        rs = slreq.load(filePath);
        return;
    catch
    end
end
% Create new
try
    rs = slreq.new(name);
catch ME
    error('Could not create requirement set "%s": %s', name, ME.message);
end
end

% =========================================================================
function [req, errMsg] = createRequirement(rs, cid, summ, descr)
% Try every documented way of creating a child requirement on a ReqSet,
% setting CustomID / Summary / Description afterward through assignment
% or via slreq.set if direct assignment is not allowed.
errMsg = '';
req = [];

% Sequence of factory calls to try.
factories = {
    @() slreq.add(rs)                                    % function-form add
    @() slreq.add(rs, 'Functional')                      % with type
    @() rs.add()                                         % method-form (no args)
    @() rs.addItem('Requirement')                        % old-style addItem
    @() slreq.Requirement(rs)                            % constructor (rare)
};
for i = 1:numel(factories)
    try
        req = factories{i}();
        if ~isempty(req), break; end
    catch ME
        errMsg = ME.message;
        req = [];
    end
end
if isempty(req), return; end

% Description: escape HTML entities so the Requirements Editor doesn't
% truncate the text at the first '<' character.
descrEscaped = htmlEscape(descr);

% Populate properties using whatever path the version accepts. Verify by
% reading the value back; if it didn't take, try alternate paths.
setProp(req, 'CustomID',    cid);
setProp(req, 'Summary',     summ);
setProp(req, 'Description', descrEscaped);
end

% =========================================================================
function s = htmlEscape(s)
s = strrep(s, '&', '&amp;');     % must run first
s = strrep(s, '<', '&lt;');
s = strrep(s, '>', '&gt;');
end

% =========================================================================
function ok = setProp(req, name, value)
% Try direct assignment, fall back to slreq.set, finally to a few alias
% property names that have shown up across releases. Verify the write
% by reading the value back when possible.
aliases = {name};
switch name
    case 'CustomID', aliases = {'CustomID','CustomId','Custom_ID','Id','ID'};
    case 'Summary',  aliases = {'Summary','Name','Title'};
    case 'Description', aliases = {'Description','Text','Body'};
end

ok = false;
for a = 1:numel(aliases)
    aname = aliases{a};
    % Direct assignment
    try
        req.(aname) = value;
        if propEquals(req, aname, value)
            ok = true; return;
        end
    catch
    end
    % slreq.set
    try
        slreq.set(req, aname, value);
        if propEquals(req, aname, value)
            ok = true; return;
        end
    catch
    end
    % Setter method like setCustomID, setSummary, etc.
    try
        setterName = ['set' aname];
        feval(setterName, req, value);
        if propEquals(req, aname, value)
            ok = true; return;
        end
    catch
    end
end

% Final fallback: emit a one-time warning so the user sees that this
% specific property couldn't be set.
warning('off', 'backtrace');
warning('setProp:%s', sprintf('%s could not be set on requirement', name));
warning('on', 'backtrace');
end

% =========================================================================
function tf = propEquals(obj, name, expected)
tf = false;
try
    actual = obj.(name);
    if (ischar(actual) || isstring(actual)) && ...
            (ischar(expected) || isstring(expected))
        tf = strcmp(string(actual), string(expected));
    elseif isequal(actual, expected)
        tf = true;
    end
catch
end
end

% =========================================================================
function req = findReqByCustomId(rs, cid)
req = [];
% Try the find API first
try
    cand = rs.find('CustomID', cid);
    if ~isempty(cand), req = cand(1); return; end
catch
end
% Fall back to manual scan
try
    items = rs.find();
    for i = 1:numel(items)
        try
            if strcmp(string(items(i).CustomID), cid) || ...
               strcmp(string(items(i).CustomId), cid)
                req = items(i); return;
            end
        catch
        end
    end
catch
end
end

% =========================================================================
function link = tryCreateLink(tgt, req)
% Try several source representations to cover MATLAB version differences.
attempts = {};
attempts{end+1} = @() slreq.createLink(tgt, req);
try
    sid = Simulink.ID.getSID(tgt);
    attempts{end+1} = @() slreq.createLink(sid, req);
catch
end
try
    if isprop(tgt, 'Handle')
        h = tgt.Handle;
        attempts{end+1} = @() slreq.createLink(h, req);
    end
catch
end
attempts{end+1} = @() slreq.modeler.createLink(tgt, req);

link = '';
lastErr = 'unknown error';
for i = 1:numel(attempts)
    try
        link = attempts{i}();
        if ~isempty(link), return; end
    catch ME
        lastErr = ME.message;
    end
end
link = lastErr;
end

% =========================================================================
function trySave(rs, filePath)
attempts = {};
if ~isempty(filePath)
    attempts{end+1} = @() rs.save(filePath);
    attempts{end+1} = @() rs.saveAs(filePath);
end
attempts{end+1} = @() rs.save();
for i = 1:numel(attempts)
    try
        attempts{i}();
        fprintf('Reqset saved.\n');
        return;
    catch
    end
end
fprintf(['\nNote: programmatic save was not available in this MATLAB ' ...
    'release.\n      Please save manually from the Requirements Editor ' ...
    '(Ctrl+S\n      or File -> Save All).\n']);
end

% =========================================================================
function s = firstN(s, n)
s = char(s);
if numel(s) > n, s = [s(1:n) '...']; end
end
