<#
.SYNOPSIS
The game's own updater on Windows (issue #843): downloads a release's installer, waits for the game to quit, installs
it and starts the game again.

.DESCRIPTION
The desktop app carries this file (src-tauri/src/self_update.rs writes it to ~/.marvel-champions/ and runs it with no
window) for a game installed from the release's Setup.exe or .msi. It reports to the game in update.log the way the
Install for Steam script does: MC_UPDATE <state> <version> lines, curl's progress, and an "Error:" line when it stops
(packages/client/src/view/steam-update.ts reads them).

It downloads first, then waits for the game, because Windows can't replace a running exe. If the game exits before the
download ends it gives up, changing nothing, so a game started again in the meantime isn't closed under the player.
#>
param(
  [Parameter(Mandatory = $true)][string]$Url,
  [Parameter(Mandatory = $true)][ValidateSet("nsis", "msi")][string]$Kind,
  [Parameter(Mandatory = $true)][string]$Version,
  [Parameter(Mandatory = $true)][string]$Game,
  [Parameter(Mandatory = $true)][int]$WaitPid
)
$ErrorActionPreference = "Stop"
$StateDir = Join-Path ([Environment]::GetFolderPath("UserProfile")) ".marvel-champions"

function Fail([string]$message) {
  Write-Host "Error: $message"
  exit 1
}

$temp = Join-Path ([System.IO.Path]::GetTempPath()) ("mc-update-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $temp | Out-Null
$installer = Join-Path $temp ([System.IO.Path]::GetFileName(([Uri]$Url).AbsolutePath))
try {
  Write-Host "Downloading version $Version..."
  # curl.exe ships with Windows and prints the progress the game fills its bar from.
  $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
  if ($null -ne $curl) {
    & $curl.Source -fL --progress-bar -o $installer $Url
    if ($LASTEXITCODE -ne 0) { Fail "the download failed." }
  } else {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $installer
  }
  if ($null -eq (Get-Process -Id $WaitPid -ErrorAction SilentlyContinue)) {
    Fail "the game closed before the download finished, so nothing changed."
  }
  Write-Host "MC_UPDATE ready $Version"
  while ($null -ne (Get-Process -Id $WaitPid -ErrorAction SilentlyContinue)) { Start-Sleep -Seconds 1 }

  # A game started while the installer runs exits at once (steam_install.rs, leave_for_running_update).
  $installing = Join-Path $StateDir "installing"
  New-Item -ItemType File -Force -Path $installing | Out-Null
  try {
    if ($Kind -eq "msi") {
      # The .msi installs for every user, so Windows asks for an administrator's permission.
      $process = Start-Process msiexec.exe -ArgumentList @("/i", ('"' + $installer + '"'), "/passive", "/norestart") `
        -Verb RunAs -Wait -PassThru
    } else {
      $process = Start-Process $installer -ArgumentList "/S" -Wait -PassThru
    }
  } finally {
    Remove-Item $installing -ErrorAction SilentlyContinue
  }
  # 3010: installed, and Windows would like a restart some time.
  if ($process.ExitCode -ne 0 -and $process.ExitCode -ne 3010) {
    Fail "the installer stopped with code $($process.ExitCode)."
  }
  Write-Host "MC_UPDATE done $Version"
} catch {
  Fail $_.Exception.Message
} finally {
  Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
}

if (Test-Path $Game) {
  Start-Process -FilePath $Game -WorkingDirectory (Split-Path $Game)
}
exit 0
