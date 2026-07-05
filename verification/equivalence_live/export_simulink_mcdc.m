function cov = export_simulink_mcdc(cvdo, blk, outDir)
%EXPORT_SIMULINK_MCDC  Dump chart Decision/Condition/MCDC coverage to CSV+JSON.
%
%   cov = EXPORT_SIMULINK_MCDC(cvdo, blk, outDir)
%     cvdo   : cvdata object from cvsim
%     blk    : block path of the system under coverage (the chart)
%     outDir : folder for chart_coverage.csv / .json
%
%   Returns cov with fields decision/condition/mcdc = [covered total] and
%   human strings *_str, plus per-decision MC/DC details. This is the chart
%   side of the model-vs-code coverage comparison (item c); compare_coverage.py
%   merges it with the gcov --conditions report from the C.

if nargin < 3, outDir = pwd; end

[dCov, dDesc] = decisioninfo(cvdo, blk);
[cCov, cDesc] = conditioninfo(cvdo, blk);
[mCov, mDesc] = mcdcinfo(cvdo, blk);

cov = struct();
cov.decision  = dCov;     % [covered total]
cov.condition = cCov;
cov.mcdc      = mCov;
cov.decision_str  = pct(dCov);
cov.condition_str = pct(cCov);
cov.mcdc_str      = pct(mCov);

% ---- per-decision MC/DC detail table -------------------------------------
rows = {};
if isfield(mDesc,'decision') && ~isempty(mDesc.decision)
    for i = 1:numel(mDesc.decision)
        d = mDesc.decision(i);
        txt = '';
        if isfield(d,'text'), txt = d.text; end
        nc = 0; ncov = 0;
        if isfield(d,'condition')
            nc = numel(d.condition);
            for j = 1:nc
                if isfield(d.condition(j),'achieved') && d.condition(j).achieved
                    ncov = ncov + 1;
                end
            end
        end
        rows(end+1,:) = {i, cleanstr(txt), ncov, nc}; %#ok<AGROW>
    end
end

% ---- write CSV -----------------------------------------------------------
csvFile = fullfile(outDir,'chart_coverage.csv');
fid = fopen(csvFile,'w');
fprintf(fid,'metric,covered,total,percent\n');
fprintf(fid,'decision,%d,%d,%.2f\n',  dCov(1),dCov(2),100*safediv(dCov));
fprintf(fid,'condition,%d,%d,%.2f\n', cCov(1),cCov(2),100*safediv(cCov));
fprintf(fid,'mcdc,%d,%d,%.2f\n',      mCov(1),mCov(2),100*safediv(mCov));
fprintf(fid,'\ndecision_index,text,mcdc_covered,mcdc_total\n');
for i = 1:size(rows,1)
    fprintf(fid,'%d,"%s",%d,%d\n', rows{i,1}, rows{i,2}, rows{i,3}, rows{i,4});
end
fclose(fid);

% ---- write JSON ----------------------------------------------------------
J = struct('block',blk, ...
    'decision',struct('covered',dCov(1),'total',dCov(2)), ...
    'condition',struct('covered',cCov(1),'total',cCov(2)), ...
    'mcdc',struct('covered',mCov(1),'total',mCov(2)), ...
    'mcdc_decisions',{rows});
try
    fid = fopen(fullfile(outDir,'chart_coverage.json'),'w');
    fprintf(fid,'%s', jsonencode(J));
    fclose(fid);
catch ME
    warning('jsonencode failed: %s', ME.message);
end

fprintf('Chart coverage: decision %s | condition %s | MC/DC %s\n', ...
    cov.decision_str, cov.condition_str, cov.mcdc_str);
fprintf('Wrote %s\n', csvFile);
end

function s = pct(cv)
s = sprintf('%d/%d (%.2f%%)', cv(1), cv(2), 100*safediv(cv));
end
function r = safediv(cv)
if cv(2)==0, r = 1; else, r = cv(1)/cv(2); end
end
function s = cleanstr(t)
s = regexprep(char(t), '[\r\n",]', ' ');
s = strtrim(regexprep(s,'\s+',' '));
end
