% Copyright 2011-2025 The MathWorks, Inc.

scriptDir = fileparts(mfilename('fullpath'));
HEV_Model_HomeDir = fileparts(scriptDir);
addpath(genpath(HEV_Model_HomeDir));

HEV_Model_PARAM
HEV_SeriesParallel_param_detailed
open_start_content = 1;
decimation = 1;

% If running in a parallel pool
% do not open model or demo script
if(~isempty(ver('parallel')))
    if(~isempty(getCurrentTask()))
        open_start_content = 0;
    end
end

if(open_start_content)
    demoPage = fullfile(scriptDir,'HEV_Model_Demo_Script.html');
    if isfile(demoPage)
        web(demoPage)
    end
    open_system('HEV_powersplit_adapted')
end



