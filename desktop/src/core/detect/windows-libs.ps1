# RigTune - Windows oyun kutuphanesi ipuclari (kayit defteri ve Xbox paketleri).
# Yalnizca okur. Ciktisi tek satir JSON'dur.
$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function RegVal($path, $name) { try { $v = (Get-ItemProperty -LiteralPath $path -Name $name -ErrorAction Stop).$name; return ,$v } catch { return $null } }
$out = [ordered]@{}

# Steam
$out.steamPath = RegVal 'HKCU:\Software\Valve\Steam' 'SteamPath'
if (-not $out.steamPath) { $out.steamPath = RegVal 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam' 'InstallPath' }

# Epic
$out.epicAppData = RegVal 'HKLM:\SOFTWARE\WOW6432Node\Epic Games\EpicGamesLauncher' 'AppDataPath'
$out.programData = $env:ProgramData

# GOG
$gog = @()
foreach ($k in @(Get-ChildItem 'HKLM:\SOFTWARE\WOW6432Node\GOG.com\Games')) {
  $p = Get-ItemProperty -LiteralPath $k.PSPath
  $gog += [ordered]@{ id = $k.PSChildName; name = $p.gameName; path = $p.path; exe = $p.exe; dependsOn = $p.dependsOn; launch = $p.launchCommand }
}
$out.gog = $gog

# Ubisoft
$ubi = @()
foreach ($k in @(Get-ChildItem 'HKLM:\SOFTWARE\WOW6432Node\Ubisoft\Launcher\Installs')) {
  $ubi += [ordered]@{ id = $k.PSChildName; dir = (RegVal $k.PSPath 'InstallDir') }
}
$out.ubisoft = $ubi
$out.ubisoftLauncher = RegVal 'HKLM:\SOFTWARE\WOW6432Node\Ubisoft\Launcher' 'InstallDir'
$out.localAppData = $env:LOCALAPPDATA
$out.appData = $env:APPDATA

# EA app: oyunlar kayit defterinde yayinci anahtari altinda "Install Dir" degeri birakir
$ea = @()
foreach ($root in 'HKLM:\SOFTWARE\WOW6432Node\EA Games', 'HKLM:\SOFTWARE\WOW6432Node\Electronic Arts', 'HKLM:\SOFTWARE\EA Games') {
  foreach ($k in @(Get-ChildItem $root)) {
    $dir = RegVal $k.PSPath 'Install Dir'
    if ($dir) { $ea += [ordered]@{ name = $k.PSChildName; dir = $dir; display = (RegVal $k.PSPath 'DisplayName') } }
  }
}
$out.ea = $ea

# Suruculer ve Xbox oyun klasorleri (.GamingRoot)
$drives = @()
foreach ($d in @(Get-PSDrive -PSProvider FileSystem)) {
  if ($null -eq $d.Used) { continue }
  $root = $d.Root
  $gr = $null
  $f = Join-Path $root '.GamingRoot'
  if (Test-Path -LiteralPath $f) {
    try {
      $bytes = [System.IO.File]::ReadAllBytes($f)
      if ($bytes.Length -gt 8) { $gr = [System.Text.Encoding]::Unicode.GetString($bytes, 8, $bytes.Length - 8).Trim([char]0) }
    } catch { }
  }
  $drives += [ordered]@{ root = $root; gamingRoot = $gr; free = $d.Free; used = $d.Used }
}
$out.drives = $drives

# Microsoft Store / Xbox (GDK) oyunlari: paket klasorunde MicrosoftGame.config bulunur
$xbox = @()
foreach ($pk in @(Get-AppxPackage)) {
  if ($pk.IsFramework -or $pk.SignatureKind -eq 'System') { continue }
  $loc = $pk.InstallLocation
  if (-not $loc) { continue }
  $cfg = Join-Path $loc 'MicrosoftGame.config'
  if (Test-Path -LiteralPath $cfg) { $xbox += [ordered]@{ name = $pk.Name; family = $pk.PackageFamilyName; loc = $loc; version = ("" + $pk.Version); cfg = $cfg } }
}
$out.xbox = $xbox

ConvertTo-Json -InputObject $out -Depth 6 -Compress
