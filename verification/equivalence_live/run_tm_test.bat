@echo off
cd /d "%~dp0"
echo Creating and running the Test Manager equivalence test (headless).
echo This simulates 473 steps with coverage - expect a few minutes...
matlab -batch "addpath('%~dp0.'); tm_create_and_run" > tm_console.txt 2>&1
echo Exit code: %ERRORLEVEL%
echo Done. See tm_test_log.txt and tm_console.txt
pause
