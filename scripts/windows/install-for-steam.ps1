<#
.SYNOPSIS
Install for Steam: adds the installed Marvel Champions to Steam as a non-Steam game, with the game's icon and library
art, so it plays from the library and Big Picture with a controller.

.DESCRIPTION
This one file works for every release: it asks GitHub for the latest one, and when the game is missing or older it
downloads that release's installer and runs it. Steam must be closed while its shortcut list is written; the script
offers to close it. Running it again updates the game and the entry.

Each run records the install in the hidden folder .marvel-champions in your user folder, with a copy of this script.
The game reads that record, says it was installed this way, and offers to run the copy with -Update when a new release
is out.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File .\install-for-steam.ps1

A release ships this as -Windows-Install-for-Steam.cmd (install-for-steam-launcher.cmd in front of it), which runs on
a double-click and takes the same options: MarvelChampions-<version>-Windows-Install-for-Steam.cmd -Uninstall

.PARAMETER Path
The game's marvel-champions.exe, when it isn't where the installer put it.
.PARAMETER SteamPath
The Steam folder, when the registry doesn't say.
.PARAMETER Language
The card language to install, en or es (default: what the last run installed, else en).
.PARAMETER Update
Update the game only: leave Steam alone, so it can run while Steam and the game are open.
.PARAMETER WaitPid
With -Update, download first, then wait for this process to end before running the installer.
.PARAMETER Yes
Close Steam without asking when it is running.
.PARAMETER Uninstall
Remove the Steam entry, its art and the .marvel-champions folder (the game itself stays installed).
#>
param(
  [string]$Path = "",
  [string]$SteamPath = "",
  [string]$Language = "",
  [switch]$Update,
  [int]$WaitPid = 0,
  [switch]$Yes,
  [switch]$Uninstall
)
$ErrorActionPreference = "Stop"

$Repo = "quincarter/marvel-champions-digital-game"
$AppName = "Marvel Champions"
# The shortcut's name: what Steam, Big Picture and status plugins (Discord) show.
$ShortcutName = "Marvel Champions Digital Edition"
$ExeName = "marvel-champions.exe"
$ArtFiles = @("icon.png", "portrait.jpg", "wide.jpg", "hero.jpg", "logo.png")
# The hidden folder the game reads (src-tauri/src/steam_install.rs).
$StateDir = Join-Path ([Environment]::GetFolderPath("UserProfile")) ".marvel-champions"
$Marker = Join-Path $StateDir "install.json"

function Fail([string]$message) {
  Write-Host "Error: $message" -ForegroundColor Red
  exit 1
}

if ($Language -notmatch '^([a-zA-Z]{2})?$') { Fail "-Language takes a two-letter language, en or es." }
$Language = $Language.ToLowerInvariant()

# The install record, or $null when there is none.
function Read-Marker {
  if (-not (Test-Path $Marker)) { return $null }
  try { return [System.IO.File]::ReadAllText($Marker) | ConvertFrom-Json } catch { return $null }
}

$record = Read-Marker
$askedLanguage = $Language
if ($Language -eq "" -and $null -ne $record) { $Language = [string]$record.language }
if ($Language -eq "") { $Language = "en" }

# The latest release and its installer of the given kind in the chosen language, or $null when GitHub can't say. GitHub's
# "latest" is never a draft or a prerelease.
function Get-LatestRelease([string]$kind) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $suffix = if ($kind -eq "msi") { "-Windows-x64-AllUsers.msi" } else { "-Windows-x64-Setup.exe" }
  try {
    $release = Invoke-RestMethod -UseBasicParsing -Uri "https://api.github.com/repos/$Repo/releases/latest"
  } catch { return $null }
  $name = "-" + $Language.ToUpperInvariant() + $suffix
  $asset = @($release.assets | Where-Object { $_.name.EndsWith($name) }) | Select-Object -First 1
  if ($null -eq $asset) { return $null }
  return @{ Version = $release.tag_name.TrimStart("v"); Url = $asset.browser_download_url; Name = $asset.name }
}

function Save-Download([string]$url, [string]$file) {
  # curl.exe ships with Windows and shows progress, which the game reads to fill its bar; Invoke-WebRequest doesn't.
  $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
  if ($null -ne $curl) {
    & $curl.Source -fL --progress-bar -o $file $url
    if ($LASTEXITCODE -ne 0) { Fail "the download failed." }
  } else {
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $file
  }
}

# Runs a downloaded installer and waits for it. The silent per-user setup keeps the folder the game is installed in.
function Install-Game([string]$installer, [string]$kind) {
  if ($kind -eq "msi") {
    $process = Start-Process msiexec.exe -ArgumentList @("/i", ('"' + $installer + '"'), "/passive", "/norestart") `
      -Verb RunAs -Wait -PassThru
  } else {
    $process = Start-Process $installer -ArgumentList "/S" -Wait -PassThru
  }
  # 3010: installed, and Windows would like a restart some time.
  if ($process.ExitCode -ne 0 -and $process.ExitCode -ne 3010) { Fail "the installer stopped with code $($process.ExitCode)." }
}

# The copy of this script the game runs. A copy run from a file is what the player chose; run from the saved copy, the
# latest published one replaces it, so a fix to this script reaches an existing install. The release's .cmd is this
# script with a launcher in a comment at the top, so it runs as a .ps1 too.
function Save-Script {
  $copy = Join-Path $StateDir "install-for-steam.ps1"
  if ($PSCommandPath -and $PSCommandPath -ne $copy) {
    Copy-Item $PSCommandPath $copy -Force
    return
  }
  try {
    $url = "https://github.com/$Repo/releases/latest/download/MarvelChampions-Windows-Install-for-Steam.cmd"
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile "$copy.new"
    Move-Item "$copy.new" $copy -Force
  } catch {
    Remove-Item "$copy.new" -ErrorAction SilentlyContinue
  }
}

function Write-Marker([string]$version) {
  New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
  (Get-Item $StateDir -Force).Attributes = "Hidden, Directory"
  $json = [ordered]@{
    method = "steam-script"; os = "windows"; game = $Path; version = $version; language = $Language
    installedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  } | ConvertTo-Json
  # Not Set-Content: PowerShell 5.1 starts UTF-8 with a byte order mark.
  [System.IO.File]::WriteAllText($Marker, $json, (New-Object System.Text.UTF8Encoding($false)))
  Save-Script
}

# --- Steam -----------------------------------------------------------------------------------------------------------

function Find-Steam {
  if ($script:SteamPath -eq "") {
    $key = Get-ItemProperty -Path "HKCU:\Software\Valve\Steam" -ErrorAction SilentlyContinue
    if ($null -ne $key -and $key.SteamPath) { $script:SteamPath = $key.SteamPath }
  }
  if ($script:SteamPath -eq "") { $script:SteamPath = "${env:ProgramFiles(x86)}\Steam" }
  $script:SteamPath = [System.IO.Path]::GetFullPath($script:SteamPath.Replace("/", "\"))
  if (-not (Test-Path (Join-Path $script:SteamPath "userdata"))) {
    Fail "no Steam install with a signed-in user was found at $($script:SteamPath). Start Steam and sign in once, or pass -SteamPath."
  }
  Write-Host "Steam: $($script:SteamPath)"
  $script:users = @(Get-ChildItem (Join-Path $script:SteamPath "userdata") -Directory |
      Where-Object { $_.Name -match '^\d+$' -and $_.Name -ne "0" })
  if ($script:users.Count -eq 0) { Fail "Steam has no signed-in user yet. Start Steam and sign in once, then run this again." }
}

function Get-SteamProcess {
  # Only this Steam install counts, not another copy somewhere else.
  @(Get-Process -Name steam -ErrorAction SilentlyContinue | Where-Object {
      $_.Path -and $_.Path.StartsWith($SteamPath, [System.StringComparison]::OrdinalIgnoreCase)
    })
}

function Close-Steam {
  if ((Get-SteamProcess).Count -eq 0) { return }
  if (-not $Yes) {
    $answer = Read-Host "Steam is running and would overwrite the change when it exits. Close Steam now? [Y/n]"
    if ($answer -match '^[nN]') { Fail "Steam is still running. Close it and run this again." }
  }
  Write-Host "Closing Steam..."
  Start-Process -FilePath (Join-Path $SteamPath "steam.exe") -ArgumentList "-shutdown"
  for ($i = 0; $i -lt 60 -and (Get-SteamProcess).Count -gt 0; $i++) { Start-Sleep -Seconds 1 }
  if ((Get-SteamProcess).Count -gt 0) { Fail "Steam didn't close within a minute. Exit it from its menu and run this again." }
}

# --- Steam's shortcut list (binary VDF) ------------------------------------------------------------------------------

# A map is an ordered list of [key, type, value]: type 0 a nested map, 1 a string, 2 a 32-bit number, 7 eight raw
# bytes. Everything else Steam stores is kept as read.
function Read-CString([byte[]]$data, [ref]$i) {
  $start = $i.Value
  while ($data[$i.Value] -ne 0) { $i.Value++ }
  $s = [System.Text.Encoding]::UTF8.GetString($data, $start, $i.Value - $start)
  $i.Value++
  return $s
}

function Read-VdfMap([byte[]]$data, [ref]$i) {
  $map = New-Object System.Collections.ArrayList
  while ($true) {
    $type = $data[$i.Value]; $i.Value++
    if ($type -eq 8) { return , $map }
    $key = Read-CString $data $i
    switch ($type) {
      0 { $value = Read-VdfMap $data $i }
      1 { $value = Read-CString $data $i }
      2 { $value = [BitConverter]::ToInt32($data, $i.Value); $i.Value += 4 }
      7 { $value = $data[$i.Value..($i.Value + 7)]; $i.Value += 8 }
      default { throw "unknown field type $type in shortcuts.vdf" }
    }
    [void]$map.Add(@($key, $type, $value))
  }
}

function Write-VdfMap([System.IO.BinaryWriter]$w, $map) {
  foreach ($field in $map) {
    $w.Write([byte]$field[1])
    $w.Write([System.Text.Encoding]::UTF8.GetBytes($field[0])); $w.Write([byte]0)
    switch ($field[1]) {
      0 { Write-VdfMap $w $field[2] }
      1 { $w.Write([System.Text.Encoding]::UTF8.GetBytes([string]$field[2])); $w.Write([byte]0) }
      2 { $w.Write([int32]$field[2]) }
      7 { $w.Write([byte[]]$field[2]) }
    }
  }
  $w.Write([byte]8)
}

function Get-VdfField($map, [string]$key) {
  # The comma keeps PowerShell from unrolling a nested map into its fields on the way out.
  foreach ($field in $map) { if ($field[0] -ieq $key) { return , $field[2] } }
  return $null
}

# Hex literals above 0x7FFFFFFF are negative Int32s in PowerShell, so the CRC-32 constants are written in decimal.
$crcTable = New-Object 'uint32[]' 256
for ($n = 0; $n -lt 256; $n++) {
  $c = [uint32]$n
  for ($k = 0; $k -lt 8; $k++) {
    if ($c -band 1) { $c = [uint32]([uint32]3988292384 -bxor ($c -shr 1)) } else { $c = [uint32]($c -shr 1) }
  }
  $crcTable[$n] = $c
}
function Get-Crc32([byte[]]$bytes) {
  $crc = [uint32]::MaxValue
  foreach ($b in $bytes) { $crc = [uint32]($crcTable[($crc -bxor $b) -band 0xFF] -bxor ($crc -shr 8)) }
  return [uint32]($crc -bxor [uint32]::MaxValue)
}

# Adds (with $entry) or removes this game's shortcut in one user's shortcuts.vdf, replacing an earlier entry for it but
# keeping that entry's collections and last-played time. Returns the grid ids of the entries it took out.
function Update-Shortcuts([string]$file, [string]$quotedExe, $entry) {
  $shortcuts = New-Object System.Collections.ArrayList
  if ((Test-Path $file) -and (Get-Item $file).Length -gt 0) {
    $data = [System.IO.File]::ReadAllBytes($file)
    $i = 0
    $root = Read-VdfMap $data ([ref]$i)
    $found = Get-VdfField $root "shortcuts"
    if ($null -ne $found) { $shortcuts = $found }
  }
  $kept = New-Object System.Collections.ArrayList
  $removed = @()
  $changed = $null -ne $entry
  foreach ($field in $shortcuts) {
    $exe = Get-VdfField $field[2] "Exe"
    # This game's entry under any name it has had (the script's first draft named it "Marvel Champions"), or one added
    # by hand, which points at the same marvel-champions.exe.
    $name = Get-VdfField $field[2] "AppName"
    $target = if ($exe) { Split-Path -Leaf $exe.Trim('"') } else { "" }
    if ($exe -eq $quotedExe -or $name -eq $ShortcutName -or $name -eq $AppName -or $target -ieq $ExeName) {
      $changed = $true
      $oldId = Get-VdfField $field[2] "appid"
      if ($null -ne $oldId) { $removed += [uint32]([int64]$oldId -band 4294967295) }
      if ($null -ne $entry) {
        foreach ($carried in @("tags", "LastPlayTime")) {
          $old = Get-VdfField $field[2] $carried
          if ($null -eq $old) { continue }
          foreach ($new in $entry) { if ($new[0] -eq $carried) { $new[2] = $old } }
        }
      }
    } else { [void]$kept.Add($field[2]) }
  }
  if (-not $changed) { return $removed }
  if ($null -ne $entry) { [void]$kept.Add($entry) }
  $list = New-Object System.Collections.ArrayList
  for ($n = 0; $n -lt $kept.Count; $n++) { [void]$list.Add(@([string]$n, 0, $kept[$n])) }
  New-Item -ItemType Directory -Force -Path (Split-Path $file) | Out-Null
  if (Test-Path $file) { Copy-Item $file "$file.bak" -Force }
  $stream = New-Object System.IO.MemoryStream
  $w = New-Object System.IO.BinaryWriter($stream)
  $root = New-Object System.Collections.ArrayList
  [void]$root.Add(@("shortcuts", 0, $list))
  Write-VdfMap $w $root
  $w.Write([byte]8)
  $w.Flush()
  [System.IO.File]::WriteAllBytes($file, $stream.ToArray())
  return $removed
}

# --- The game --------------------------------------------------------------------------------------------------------

function Find-Game {
  $candidates = New-Object System.Collections.ArrayList
  $uninstall = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
  )
  $entries = Get-ItemProperty $uninstall -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq $AppName }
  foreach ($entry in $entries) {
    if ($entry.InstallLocation) { [void]$candidates.Add($entry.InstallLocation) }
    foreach ($p in @($entry.DisplayIcon, $entry.UninstallString)) {
      if ($p -and $p -notmatch '^MsiExec') { [void]$candidates.Add((Split-Path ($p.Split(",")[0].Trim('"')))) }
    }
  }
  [void]$candidates.Add("$env:LOCALAPPDATA\$AppName")
  [void]$candidates.Add("$env:ProgramFiles\$AppName")
  foreach ($dir in $candidates) {
    $exe = Join-Path $dir $ExeName
    if (Test-Path $exe) { return (Resolve-Path $exe).Path }
  }
  return $null
}

# Which installer the game at $exe came from: the .msi registers itself with Windows Installer, the per-user setup
# doesn't. A game that isn't installed yet gets the per-user setup, which needs no admin rights.
function Get-InstallKind([string]$exe) {
  $keys = @("HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*")
  $msi = @(Get-ItemProperty $keys -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName -eq $AppName -and $_.WindowsInstaller -eq 1 })
  if ($msi.Count -gt 0 -and $exe -and -not $exe.StartsWith($env:LOCALAPPDATA, [System.StringComparison]::OrdinalIgnoreCase)) {
    return "msi"
  }
  return "nsis"
}

# The version the installed game says it is, or "" when it can't be read.
function Get-GameVersion([string]$exe) {
  if (-not $exe -or -not (Test-Path $exe)) { return "" }
  return ([string](Get-Item $exe).VersionInfo.ProductVersion).Trim()
}

# Whether the game at $exe is the latest in the language asked for. With no language asked for, the one it has is fine.
function Test-Latest([string]$exe, [string]$version) {
  if ((Get-GameVersion $exe) -ne $version) { return $false }
  return $askedLanguage -eq "" -or ($null -ne $record -and $record.language -eq $Language)
}

function New-TempFolder {
  $folder = Join-Path ([System.IO.Path]::GetTempPath()) ("mc-steam-" + [guid]::NewGuid())
  New-Item -ItemType Directory -Path $folder | Out-Null
  return $folder
}

# --- Update (from the game, or by hand) ----------------------------------------------------------------------------

# The game shows these MC_UPDATE lines' meaning on screen (packages/client/src/view/steam-update.ts). Steam isn't
# touched: the entry already points at the game's path, and Steam may be what started the game.
if ($Update) {
  if ($Path -eq "" -and $null -ne $record) { $Path = [string]$record.game }
  if ($Path -eq "") { $Path = Find-Game }
  if (-not $Path) { Fail "the game isn't installed where its installer puts it." }
  $kind = Get-InstallKind $Path
  $latest = Get-LatestRelease $kind
  if ($null -eq $latest) { Fail "couldn't find the latest release on GitHub." }
  if (Test-Latest $Path $latest.Version) {
    Write-Host "MC_UPDATE current $($latest.Version)"
    exit 0
  }
  $temp = New-TempFolder
  $installer = Join-Path $temp $latest.Name
  Write-Host "Downloading version $($latest.Version)..."
  Save-Download $latest.Url $installer
  if ($WaitPid -gt 0) {
    # The game went while this downloaded. It may have been started again, and the installer would close it.
    if ($null -eq (Get-Process -Id $WaitPid -ErrorAction SilentlyContinue)) {
      Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
      Fail "the game closed before the download finished, so nothing changed."
    }
    Write-Host "MC_UPDATE ready $($latest.Version)"
    while ($null -ne (Get-Process -Id $WaitPid -ErrorAction SilentlyContinue)) { Start-Sleep -Seconds 1 }
  }
  Install-Game $installer $kind
  Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
  Write-Marker $latest.Version
  Write-Host "MC_UPDATE done $($latest.Version)"
  exit 0
}

Find-Steam
Close-Steam

if ($Path -eq "") { $Path = Find-Game }
$version = ""
if ($Uninstall) {
  if (-not $Path) { $Path = "$env:LOCALAPPDATA\$AppName\$ExeName" }
} else {
  Write-Host "Looking up the latest release..."
  $kind = Get-InstallKind $Path
  $latest = Get-LatestRelease $kind
  if ($null -ne $latest) {
    $version = $latest.Version
    if (Test-Latest $Path $latest.Version) {
      Write-Host "Version $($latest.Version) is already installed."
    } else {
      if ($null -ne (Get-Process -Name marvel-champions -ErrorAction SilentlyContinue)) {
        Fail "the game is running. Close it and run this again."
      }
      $temp = New-TempFolder
      $installer = Join-Path $temp $latest.Name
      Write-Host "Downloading version $($latest.Version)..."
      Save-Download $latest.Url $installer
      Write-Host "Installing..."
      Install-Game $installer $kind
      Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
      if (-not $Path -or -not (Test-Path $Path)) { $Path = Find-Game }
    }
  } else {
    Write-Host "Couldn't reach GitHub; using the game that's installed."
    $version = Get-GameVersion $Path
  }
  if (-not $Path -or -not (Test-Path $Path)) {
    Fail "the game isn't installed where its installer puts it. Install it from the release, or pass -Path to marvel-champions.exe."
  }
  $Path = (Resolve-Path $Path).Path
  Write-Host "Game: $Path"
}

$quotedExe = '"' + $Path + '"'
$gridId = [uint32]((Get-Crc32 ([System.Text.Encoding]::UTF8.GetBytes($quotedExe + $ShortcutName))) -bor [uint32]2147483648)
$signedId = [int32]([int64]$gridId - 4294967296)

if ($Uninstall) {
  foreach ($user in $users) {
    $config = Join-Path $user.FullName "config"
    foreach ($id in @($gridId) + @(Update-Shortcuts (Join-Path $config "shortcuts.vdf") $quotedExe $null)) {
      foreach ($name in @("${id}p.jpg", "${id}.jpg", "${id}_hero.jpg", "${id}_logo.png", "${id}_icon.png")) {
        Remove-Item (Join-Path $config "grid\$name") -ErrorAction SilentlyContinue
      }
    }
  }
  Remove-Item $StateDir -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "Removed $ShortcutName from Steam and deleted $StateDir. Start Steam again to see the change."
  exit 0
}

# --- The art ---------------------------------------------------------------------------------------------------------

# The release's .cmd runs a copy of this from the temp folder, with no art beside it; it downloads the art.
$artDir = ""
if ($PSScriptRoot) {
  $artDir = Join-Path $PSScriptRoot "..\linux\steam-art"
  if (-not (Test-Path (Join-Path $artDir "hero.jpg"))) { $artDir = Join-Path $PSScriptRoot "steam-art" }
}
$temp = $null
if (-not $artDir -or -not (Test-Path (Join-Path $artDir "hero.jpg"))) {
  $temp = Join-Path ([System.IO.Path]::GetTempPath()) ("mc-steam-art-" + [guid]::NewGuid())
  New-Item -ItemType Directory -Path $temp | Out-Null
  $artDir = $temp
  Write-Host "Downloading the library art..."
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  foreach ($file in $ArtFiles) {
    try {
      $url = "https://raw.githubusercontent.com/$Repo/main/scripts/linux/steam-art/$file"
      Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile (Join-Path $temp $file)
    } catch {
      Write-Host "Couldn't download $file; the entry goes without it."
    }
  }
}

# --- The Steam entry -------------------------------------------------------------------------------------------------

foreach ($user in $users) {
  $config = Join-Path $user.FullName "config"
  $grid = Join-Path $config "grid"
  New-Item -ItemType Directory -Force -Path $grid | Out-Null
  # Steam's names for a shortcut's library art: <id>p portrait, <id> wide, <id>_hero, <id>_logo, <id>_icon.
  $copies = @{ "portrait.jpg" = "${gridId}p.jpg"; "wide.jpg" = "${gridId}.jpg"; "hero.jpg" = "${gridId}_hero.jpg";
    "logo.png" = "${gridId}_logo.png"; "icon.png" = "${gridId}_icon.png" }
  foreach ($from in $copies.Keys) {
    $src = Join-Path $artDir $from
    if (Test-Path $src) { Copy-Item $src (Join-Path $grid $copies[$from]) -Force }
  }
  $icon = Join-Path $grid "${gridId}_icon.png"
  if (-not (Test-Path $icon)) { $icon = $Path }
  $entry = New-Object System.Collections.ArrayList
  foreach ($field in @(
      @("appid", 2, $signedId), @("AppName", 1, $ShortcutName), @("Exe", 1, $quotedExe),
      @("StartDir", 1, ('"' + (Split-Path $Path) + '\"')), @("icon", 1, $icon), @("ShortcutPath", 1, ""),
      @("LaunchOptions", 1, ""), @("IsHidden", 2, 0), @("AllowDesktopConfig", 2, 1), @("AllowOverlay", 2, 1),
      @("OpenVR", 2, 0), @("Devkit", 2, 0), @("DevkitGameID", 1, ""), @("DevkitOverrideAppID", 2, 0),
      @("LastPlayTime", 2, 0), @("FlatpakAppID", 1, ""), @("tags", 0, (New-Object System.Collections.ArrayList))
    )) { [void]$entry.Add($field) }
  # An entry it replaced under another name has its art under another id.
  foreach ($old in @(Update-Shortcuts (Join-Path $config "shortcuts.vdf") $quotedExe $entry)) {
    if ($old -eq $gridId) { continue }
    foreach ($name in @("${old}p.jpg", "${old}.jpg", "${old}_hero.jpg", "${old}_logo.png", "${old}_icon.png")) {
      Remove-Item (Join-Path $grid $name) -ErrorAction SilentlyContinue
    }
  }
  Write-Host "Added $ShortcutName to Steam user $($user.Name)."
}
if ($temp) { Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue }
Write-Marker $version

Write-Host ""
Write-Host "Done. Start Steam: $ShortcutName is in your library."
