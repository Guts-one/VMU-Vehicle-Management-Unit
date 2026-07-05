@echo off
cd /d "%~dp0"
echo Running MATLAB verification (headless). This can take a few minutes...
matlab -batch "addpath('%~dp0.'); verify_all" > matlab_console.txt 2>&1
echo Exit code: %ERRORLEVEL%
echo Done. See verify_log.txt and matlab_console.txt
