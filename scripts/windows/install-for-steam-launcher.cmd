<# : Install for Steam launcher. cmd runs the lines up to the closing mark; PowerShell reads them as a comment.
@echo off
rem The release's -Windows-Install-for-Steam.cmd is this file followed by install-for-steam.ps1 (stage-release-assets
rem stitches them). Windows marks a download as coming from the internet, and the default RemoteSigned policy won't
rem run an unsigned .ps1 with that mark, so a double-click .cmd runs it instead (#474). -File needs a .ps1, so it runs
rem a copy of this file, which keeps quoted options with spaces in them (-Path "C:\Program Files\...") whole.
setlocal
set "MC_STEAM_SCRIPT=%TEMP%\mc-install-for-steam-%RANDOM%%RANDOM%.ps1"
rem No ( ) block here: a parenthesis in the TEMP path would end it early.
copy /y "%~f0" "%MC_STEAM_SCRIPT%" >nul
if errorlevel 1 goto copy_failed
powershell -NoProfile -ExecutionPolicy Bypass -File "%MC_STEAM_SCRIPT%" %*
set "MC_EXIT=%ERRORLEVEL%"
del "%MC_STEAM_SCRIPT%" >nul 2>&1
echo.
pause
exit /b %MC_EXIT%

:copy_failed
echo Error: couldn't copy the script to "%TEMP%".
pause
exit /b 1
#>
