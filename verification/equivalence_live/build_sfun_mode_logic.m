function build_sfun_mode_logic()
%BUILD_SFUN_MODE_LOGIC  Wrap src/mode_logic_team.c as a Simulink S-Function.
%
%   Uses the Legacy Code Tool (legacy_code) to generate and compile a C-MEX
%   S-Function named 'sfun_mode_logic' from the hand-written production C plus
%   the thin combinational wrapper sfun_mode_logic_wrap.c.
%
%   The block has 5 inputs and 4 outputs (all scalar fixed-point):
%       u1 speed_dkph (uint16)  u2 p_dem_dkw (int16)  u3 soc_q10000 (uint16)
%       u4 weng_rpm   (uint16)  u5 mode_in   (uint8)
%       y1 mode_out (uint8)  y2 Mot_Enable  y3 Gen_Enable  y4 ICE_Enable (uint8)
%
%   The FSM state is carried by an EXTERNAL Unit Delay in the harness
%   (mode_out -> 1/z(init=0) -> mode_in), so the S-Function itself is stateless.
%
%   Prerequisite: a C MEX compiler ( run `mex -setup C` once ).
%
%   See also build_equivalence_harness, run_live_equivalence.

here = fileparts(mfilename('fullpath'));
root = fileparts(fileparts(here));            % repo root (…/verification/..)
inc  = fullfile(root, 'inc');
src  = fullfile(root, 'src');

assert(exist(fullfile(inc,'mode_logic_team.h'),'file')==2, ...
    'mode_logic_team.h not found under %s', inc);
assert(exist(fullfile(src,'mode_logic_team.c'),'file')==2, ...
    'mode_logic_team.c not found under %s', src);
assert(exist(fullfile(here,'sfun_mode_logic_wrap.c'),'file')==2, ...
    'sfun_mode_logic_wrap.c not found under %s', here);

cc = mex.getCompilerConfigurations('C','Selected');
if isempty(cc)
    error(['No C MEX compiler is selected. Run "mex -setup C" first ' ...
           '(MinGW-w64 or MSVC on Windows).']);
end
fprintf('Using MEX C compiler: %s\n', cc.Name);

% generate the S-Function next to this file so the harness can find it
old = cd(here); restore = onCleanup(@() cd(old));

def = legacy_code('initialize');
def.SFunctionName = 'sfun_mode_logic';
def.OutputFcnSpec = [ ...
    'void ModeLogic_CoSimStep(' ...
    'uint16 u1[1], int16 u2[1], uint16 u3[1], uint16 u4[1], uint8 u5[1], ' ...
    'uint8 y1[1], uint8 y2[1], uint8 y3[1], uint8 y4[1])'];
def.HeaderFiles = {'mode_logic_team.h', 'sfun_mode_logic_wrap.h'};
def.SourceFiles = {'mode_logic_team.c', 'sfun_mode_logic_wrap.c'};
def.IncPaths    = {inc};
def.SrcPaths    = {src, here};
def.SampleTime  = 'inherited';   % discrete rate inherited from the harness

fprintf('Generating C-MEX S-Function "%s"...\n', def.SFunctionName);
legacy_code('sfcn_cmex_generate', def);
fprintf('Compiling...\n');
legacy_code('compile', def);

% (optional) generate a TLC file so the block also works in code generation
try
    legacy_code('sfcn_tlc_generate', def);
    legacy_code('rtwmakecfg_generate', def);
catch ME
    warning('TLC/rtwmakecfg generation skipped: %s', ME.message);
end

fprintf('\nDone. Built %s.%s in %s\n', def.SFunctionName, mexext, here);
fprintf('Use build_equivalence_harness to drop the block beside the chart.\n');
end
