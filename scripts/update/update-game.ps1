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
  # The installer's SHA-256 as the release lists it: a download that doesn't match is never run.
  [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-fA-F]{64}$')][string]$Sha256,
  [Parameter(Mandatory = $true)][string]$Game,
  [Parameter(Mandatory = $true)][int]$WaitPid
)
$ErrorActionPreference = "Stop"
$StateDir = Join-Path ([Environment]::GetFolderPath("UserProfile")) ".marvel-champions"

function Fail([string]$message) {
  Write-Host "Error: $message"
  exit 1
}

# The game, started on its own: the new version once installed, else the one the player had.
function Start-Game {
  if (Test-Path $Game) { Start-Process -FilePath $Game -WorkingDirectory (Split-Path $Game) }
}

$temp = Join-Path ([System.IO.Path]::GetTempPath()) ("mc-update-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $temp | Out-Null
$installer = Join-Path $temp ([System.IO.Path]::GetFileName(([Uri]$Url).AbsolutePath))
$quit = $false
$failure = $null
try {
  Write-Host "Downloading version $Version..."
  # curl.exe ships with Windows and prints the progress the game fills its bar from.
  $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
  if ($null -ne $curl) {
    & $curl.Source -fL --progress-bar -o $installer $Url
    if ($LASTEXITCODE -ne 0) { throw "the download failed." }
  } else {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $installer
  }
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $installer).Hash -ne $Sha256.ToUpperInvariant()) {
    throw "the download doesn't match the release, so nothing changed."
  }
  if ($null -eq (Get-Process -Id $WaitPid -ErrorAction SilentlyContinue)) {
    throw "the game closed before the download finished, so nothing changed."
  }
  # From here until the install is done, a game started again exits at once (steam_install.rs,
  # leave_for_running_update): made before waiting, so even a game restarted the moment this one quits can't run on
  # the files the installer is replacing. The file counts while it is fresh, so it is touched every second.
  $installing = Join-Path $StateDir "installing"
  New-Item -ItemType File -Force -Path $installing | Out-Null
  try {
    Write-Host "MC_UPDATE ready $Version"
    while ($null -ne (Get-Process -Id $WaitPid -ErrorAction SilentlyContinue)) {
      (Get-Item -LiteralPath $installing).LastWriteTime = Get-Date
      Start-Sleep -Seconds 1
    }
    $quit = $true
    if ($Kind -eq "msi") {
      # The .msi installs for every user, so Windows asks for an administrator's permission.
      $process = Start-Process msiexec.exe -ArgumentList @("/i", ('"' + $installer + '"'), "/passive", "/norestart") `
        -Verb RunAs -PassThru
    } else {
      $process = Start-Process $installer -ArgumentList "/S" -PassThru
    }
    # Holding the handle from the start keeps the exit code readable once it ends.
    $null = $process.Handle
    while (-not $process.WaitForExit(1000)) { (Get-Item -LiteralPath $installing).LastWriteTime = Get-Date }
  } finally {
    Remove-Item $installing -ErrorAction SilentlyContinue
  }
  # 3010: installed, and Windows would like a restart some time.
  if ($process.ExitCode -ne 0 -and $process.ExitCode -ne 3010) {
    throw "the installer stopped with code $($process.ExitCode), so the game is unchanged."
  }
  Write-Host "MC_UPDATE done $Version"
} catch {
  # A refused permission prompt lands here too ("The operation was canceled by the user").
  $failure = [string]$_.Exception.Message
} finally {
  Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
}

# The player quit to install, so the game starts again either way: updated, or as it was, with the reason in the log
# for its Title to show (platform/self-update.ts).
# The reason goes in the log before the game starts, so the game finds it there.
if ($null -ne $failure) {
  Write-Host "Error: $failure"
  # Last, so the game finds it at the end of the log on its next launch however much the installer printed before it.
  if ($quit) { Write-Host "MC_UPDATE failed $Version" }
}
if ($quit) { Start-Game }
if ($null -ne $failure) { exit 1 }
exit 0
