<#
.SYNOPSIS
Install for Steam: adds the installed Marvel Champions to Steam as a non-Steam game, with the game's icon and library
art, so it plays from the library and Big Picture with a controller.

.DESCRIPTION
Install the game first (the -Windows-x64-Setup.exe or -AllUsers.msi from the release); the script finds it. Steam must
be closed while its shortcut list is written; the script offers to close it. Running it again updates the entry.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File .\install-for-steam.ps1

.PARAMETER Path
The game's marvel-champions.exe, when it isn't where the installer put it.
.PARAMETER SteamPath
The Steam folder, when the registry doesn't say.
.PARAMETER Yes
Close Steam without asking when it is running.
.PARAMETER Uninstall
Remove the Steam entry and its art (the game itself stays installed).
#>
param(
  [string]$Path = "",
  [string]$SteamPath = "",
  [switch]$Yes,
  [switch]$Uninstall
)
$ErrorActionPreference = "Stop"

$Repo = "quincarter/marvel-champions-digital-game"
# The release staging step (scripts/stage-release-assets.mjs) stamps the release's tag here, so a script downloaded
# from a release fetches that release's art. A copy run from the repo uses main's.
$ArtRef = "__MC_RELEASE_TAG__"
if ($ArtRef.StartsWith("__")) { $ArtRef = "main" }
$AppName = "Marvel Champions"
$ExeName = "marvel-champions.exe"
$ArtFiles = @("icon.png", "portrait.jpg", "wide.jpg", "hero.jpg", "logo.png")

function Fail([string]$message) {
  Write-Host "Error: $message" -ForegroundColor Red
  exit 1
}

# --- Steam -----------------------------------------------------------------------------------------------------------

if ($SteamPath -eq "") {
  $key = Get-ItemProperty -Path "HKCU:\Software\Valve\Steam" -ErrorAction SilentlyContinue
  if ($null -ne $key -and $key.SteamPath) { $SteamPath = $key.SteamPath }
}
if ($SteamPath -eq "") { $SteamPath = "${env:ProgramFiles(x86)}\Steam" }
$SteamPath = [System.IO.Path]::GetFullPath($SteamPath.Replace("/", "\"))
if (-not (Test-Path (Join-Path $SteamPath "userdata"))) {
  Fail "no Steam install with a signed-in user was found at $SteamPath. Start Steam and sign in once, or pass -SteamPath."
}
Write-Host "Steam: $SteamPath"

$users = @(Get-ChildItem (Join-Path $SteamPath "userdata") -Directory |
    Where-Object { $_.Name -match '^\d+$' -and $_.Name -ne "0" })
if ($users.Count -eq 0) { Fail "Steam has no signed-in user yet. Start Steam and sign in once, then run this again." }

function Get-SteamProcess {
  # Only this Steam install counts, not another copy somewhere else.
  @(Get-Process -Name steam -ErrorAction SilentlyContinue | Where-Object {
      $_.Path -and $_.Path.StartsWith($SteamPath, [System.StringComparison]::OrdinalIgnoreCase)
    })
}

if ((Get-SteamProcess).Count -gt 0) {
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
    if ($exe -eq $quotedExe -or (Get-VdfField $field[2] "AppName") -eq $AppName) {
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

if ($Path -eq "") { $Path = Find-Game }
if ($Uninstall) {
  if (-not $Path) { $Path = "$env:LOCALAPPDATA\$AppName\$ExeName" }
} elseif (-not $Path -or -not (Test-Path $Path)) {
  Fail "the game isn't installed where its installer puts it. Install it from the release, or pass -Path to marvel-champions.exe."
} else {
  $Path = (Resolve-Path $Path).Path
  Write-Host "Game: $Path"
}

$quotedExe = '"' + $Path + '"'
$gridId = [uint32]((Get-Crc32 ([System.Text.Encoding]::UTF8.GetBytes($quotedExe + $AppName))) -bor [uint32]2147483648)
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
  Write-Host "Removed $AppName from Steam. Start Steam again to see the change."
  exit 0
}

# --- The art ---------------------------------------------------------------------------------------------------------

$artDir = Join-Path $PSScriptRoot "..\linux\steam-art"
if (-not (Test-Path (Join-Path $artDir "hero.jpg"))) { $artDir = Join-Path $PSScriptRoot "steam-art" }
$temp = $null
if (-not (Test-Path (Join-Path $artDir "hero.jpg"))) {
  $temp = Join-Path ([System.IO.Path]::GetTempPath()) ("mc-steam-art-" + [guid]::NewGuid())
  New-Item -ItemType Directory -Path $temp | Out-Null
  $artDir = $temp
  Write-Host "Downloading the library art..."
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  foreach ($file in $ArtFiles) {
    try {
      $url = "https://raw.githubusercontent.com/$Repo/$ArtRef/scripts/linux/steam-art/$file"
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
      @("appid", 2, $signedId), @("AppName", 1, $AppName), @("Exe", 1, $quotedExe),
      @("StartDir", 1, ('"' + (Split-Path $Path) + '\"')), @("icon", 1, $icon), @("ShortcutPath", 1, ""),
      @("LaunchOptions", 1, ""), @("IsHidden", 2, 0), @("AllowDesktopConfig", 2, 1), @("AllowOverlay", 2, 1),
      @("OpenVR", 2, 0), @("Devkit", 2, 0), @("DevkitGameID", 1, ""), @("DevkitOverrideAppID", 2, 0),
      @("LastPlayTime", 2, 0), @("FlatpakAppID", 1, ""), @("tags", 0, (New-Object System.Collections.ArrayList))
    )) { [void]$entry.Add($field) }
  [void](Update-Shortcuts (Join-Path $config "shortcuts.vdf") $quotedExe $entry)
  Write-Host "Added $AppName to Steam user $($user.Name)."
}
if ($temp) { Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue }

Write-Host ""
Write-Host "Done. Start Steam: $AppName is in your library."
