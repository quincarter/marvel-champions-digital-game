<# : Install for Steam launcher. cmd runs the lines up to the closing mark; PowerShell reads them as a comment.
@echo off
rem The release's -Windows-Install-for-Steam.cmd is this file followed by install-for-steam.ps1 (stage-release-assets
rem stitches them). Windows marks a download as coming from the internet, and the default RemoteSigned policy won't
rem run an unsigned .ps1 with that mark, so the script is read as text and run from -Command (#474).
setlocal
set "MC_STEAM_SCRIPT=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create([IO.File]::ReadAllText($env:MC_STEAM_SCRIPT)))" %*
set "MC_EXIT=%ERRORLEVEL%"
echo.
pause
exit /b %MC_EXIT%
#>
