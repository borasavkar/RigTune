# RigTune - Windows sistem taramasi.
# Yalnizca okur; hicbir ayari degistirmez. Ciktisi tek satir JSON'dur.
$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$cs = @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class OarDisp {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DISPLAY_DEVICE { public int cb; [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string DeviceName; [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string DeviceString; public int StateFlags; [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string DeviceID; [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string DeviceKey; }
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DEVMODE {
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string dmDeviceName;
    public short dmSpecVersion; public short dmDriverVersion; public short dmSize; public short dmDriverExtra; public int dmFields;
    public int dmPositionX; public int dmPositionY; public int dmDisplayOrientation; public int dmDisplayFixedOutput;
    public short dmColor; public short dmDuplex; public short dmYResolution; public short dmTTOption; public short dmCollate;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string dmFormName;
    public short dmLogPixels; public int dmBitsPerPel; public int dmPelsWidth; public int dmPelsHeight; public int dmDisplayFlags; public int dmDisplayFrequency;
    public int dmICMMethod; public int dmICMIntent; public int dmMediaType; public int dmDitherType; public int dmReserved1; public int dmReserved2; public int dmPanningWidth; public int dmPanningHeight;
  }
  [StructLayout(LayoutKind.Sequential)] public struct LUID { public uint LowPart; public int HighPart; }
  [StructLayout(LayoutKind.Sequential)] public struct RATIONAL { public uint Numerator; public uint Denominator; }
  [StructLayout(LayoutKind.Sequential)] public struct PATH_SOURCE { public LUID adapterId; public uint id; public uint modeInfoIdx; public uint statusFlags; }
  [StructLayout(LayoutKind.Sequential)] public struct PATH_TARGET { public LUID adapterId; public uint id; public uint modeInfoIdx; public uint outputTechnology; public uint rotation; public uint scaling; public RATIONAL refreshRate; public uint scanLineOrdering; public int targetAvailable; public uint statusFlags; }
  [StructLayout(LayoutKind.Sequential)] public struct PATH_INFO { public PATH_SOURCE sourceInfo; public PATH_TARGET targetInfo; public uint flags; }
  [StructLayout(LayoutKind.Sequential)] public struct MODE_INFO { public uint infoType; public uint id; public LUID adapterId; public ulong a; public ulong b; public ulong c; public ulong d; public ulong e; public ulong f; }
  [StructLayout(LayoutKind.Sequential)] public struct HEADER { public uint type; public uint size; public LUID adapterId; public uint id; }
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct TARGET_NAME { public HEADER header; public uint flags; public uint outputTechnology; public ushort edidManufactureId; public ushort edidProductCodeId; public uint connectorInstance; [MarshalAs(UnmanagedType.ByValTStr, SizeConst=64)] public string monitorFriendlyDeviceName; [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string monitorDevicePath; }
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct SOURCE_NAME { public HEADER header; [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string viewGdiDeviceName; }
  [StructLayout(LayoutKind.Sequential)] public struct ADV_COLOR { public HEADER header; public uint value; public uint colorEncoding; public uint bitsPerColorChannel; }
  [StructLayout(LayoutKind.Sequential)] public struct ADV_COLOR2 { public HEADER header; public uint value; public uint colorEncoding; public uint bitsPerColorChannel; public uint activeColorMode; }

  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern bool EnumDisplayDevices(string lpDevice, uint iDevNum, ref DISPLAY_DEVICE lpDisplayDevice, uint dwFlags);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern bool EnumDisplaySettings(string deviceName, int modeNum, ref DEVMODE devMode);
  [DllImport("user32.dll")] public static extern int GetDisplayConfigBufferSizes(uint flags, out uint numPaths, out uint numModes);
  [DllImport("user32.dll")] public static extern int QueryDisplayConfig(uint flags, ref uint numPaths, [Out] PATH_INFO[] paths, ref uint numModes, [Out] MODE_INFO[] modes, IntPtr topologyId);
  [DllImport("user32.dll", EntryPoint="DisplayConfigGetDeviceInfo")] public static extern int GetTargetName(ref TARGET_NAME req);
  [DllImport("user32.dll", EntryPoint="DisplayConfigGetDeviceInfo")] public static extern int GetSourceName(ref SOURCE_NAME req);
  [DllImport("user32.dll", EntryPoint="DisplayConfigGetDeviceInfo")] public static extern int GetAdvColor(ref ADV_COLOR req);
  [DllImport("user32.dll", EntryPoint="DisplayConfigGetDeviceInfo")] public static extern int GetAdvColor2(ref ADV_COLOR2 req);

  public class Disp {
    public string gdi; public string adapter; public string devicePath; public string friendly; public uint tech;
    public double hz; public int hdrApi; public bool hdrSupported; public bool hdrEnabled; public bool wcgEnabled; public uint bpc;
    public int w; public int h; public int curHz; public int x; public int y; public int bpp; public bool primary;
    public int maxHzAtCurrent; public int maxW; public int maxH; public int maxHzAtMax; public List<string> modes = new List<string>();
  }

  static Dictionary<string,string> Adapters() {
    var d = new Dictionary<string,string>();
    for (uint i = 0; i < 32; i++) {
      var dd = new DISPLAY_DEVICE(); dd.cb = Marshal.SizeOf(typeof(DISPLAY_DEVICE));
      if (!EnumDisplayDevices(null, i, ref dd, 0)) break;
      d[dd.DeviceName] = dd.DeviceString;
    }
    return d;
  }

  public static List<Disp> Query() {
    var list = new List<Disp>();
    var adapters = Adapters();
    uint np, nm;
    if (GetDisplayConfigBufferSizes(2, out np, out nm) != 0) return list;
    var paths = new PATH_INFO[np]; var modes = new MODE_INFO[nm];
    if (QueryDisplayConfig(2, ref np, paths, ref nm, modes, IntPtr.Zero) != 0) return list;
    for (int i = 0; i < np; i++) {
      var p = paths[i]; var o = new Disp();
      var tn = new TARGET_NAME(); tn.header.type = 2; tn.header.size = (uint)Marshal.SizeOf(typeof(TARGET_NAME)); tn.header.adapterId = p.targetInfo.adapterId; tn.header.id = p.targetInfo.id;
      if (GetTargetName(ref tn) == 0) { o.devicePath = tn.monitorDevicePath; o.friendly = tn.monitorFriendlyDeviceName; o.tech = tn.outputTechnology; }
      var sn = new SOURCE_NAME(); sn.header.type = 1; sn.header.size = (uint)Marshal.SizeOf(typeof(SOURCE_NAME)); sn.header.adapterId = p.sourceInfo.adapterId; sn.header.id = p.sourceInfo.id;
      if (GetSourceName(ref sn) == 0) o.gdi = sn.viewGdiDeviceName;
      var ac2 = new ADV_COLOR2(); ac2.header.type = 15; ac2.header.size = (uint)Marshal.SizeOf(typeof(ADV_COLOR2)); ac2.header.adapterId = p.targetInfo.adapterId; ac2.header.id = p.targetInfo.id;
      if (GetAdvColor2(ref ac2) == 0) {
        o.hdrApi = 2; o.hdrSupported = (ac2.value & 16) != 0; o.hdrEnabled = (ac2.value & 32) != 0 || ac2.activeColorMode == 2; o.wcgEnabled = (ac2.value & 128) != 0; o.bpc = ac2.bitsPerColorChannel;
      } else {
        var ac = new ADV_COLOR(); ac.header.type = 9; ac.header.size = (uint)Marshal.SizeOf(typeof(ADV_COLOR)); ac.header.adapterId = p.targetInfo.adapterId; ac.header.id = p.targetInfo.id;
        if (GetAdvColor(ref ac) == 0) { o.hdrApi = 1; o.hdrSupported = (ac.value & 1) != 0; o.hdrEnabled = (ac.value & 2) != 0; o.bpc = ac.bitsPerColorChannel; }
      }
      if (p.targetInfo.refreshRate.Denominator != 0) o.hz = Math.Round((double)p.targetInfo.refreshRate.Numerator / p.targetInfo.refreshRate.Denominator, 3);
      if (o.gdi != null) {
        string a; if (adapters.TryGetValue(o.gdi, out a)) o.adapter = a;
        var dm = new DEVMODE(); dm.dmSize = (short)Marshal.SizeOf(typeof(DEVMODE));
        if (EnumDisplaySettings(o.gdi, -1, ref dm)) { o.w = dm.dmPelsWidth; o.h = dm.dmPelsHeight; o.curHz = dm.dmDisplayFrequency; o.x = dm.dmPositionX; o.y = dm.dmPositionY; o.bpp = dm.dmBitsPerPel; o.primary = (o.x == 0 && o.y == 0); }
        var best = new Dictionary<string,int>();
        int k = 0;
        var m = new DEVMODE(); m.dmSize = (short)Marshal.SizeOf(typeof(DEVMODE));
        while (k < 4000 && EnumDisplaySettings(o.gdi, k++, ref m)) {
          if (m.dmBitsPerPel < 24) continue;
          string key = m.dmPelsWidth + "x" + m.dmPelsHeight;
          int cur; if (!best.TryGetValue(key, out cur) || m.dmDisplayFrequency > cur) best[key] = m.dmDisplayFrequency;
          if (m.dmPelsWidth == o.w && m.dmPelsHeight == o.h && m.dmDisplayFrequency > o.maxHzAtCurrent) o.maxHzAtCurrent = m.dmDisplayFrequency;
          if ((long)m.dmPelsWidth * m.dmPelsHeight > (long)o.maxW * o.maxH) { o.maxW = m.dmPelsWidth; o.maxH = m.dmPelsHeight; }
        }
        int mx; if (best.TryGetValue(o.maxW + "x" + o.maxH, out mx)) o.maxHzAtMax = mx;
        foreach (var kv in best) o.modes.Add(kv.Key + "@" + kv.Value);
      }
      list.Add(o);
    }
    return list;
  }
}
"@
try { Add-Type -TypeDefinition $cs -Language CSharp -ErrorAction Stop } catch { }

# Virgul, bayt dizisinin (EDID) boru hattinda tek tek baytlara acilmasini engeller.
function RegVal($path, $name) { try { $v = (Get-ItemProperty -LiteralPath $path -Name $name -ErrorAction Stop).$name; return ,$v } catch { return $null } }
function CimDate($d) { if ($d) { try { return ([datetime]$d).ToString('yyyy-MM-dd') } catch { return $null } } else { return $null } }

$out = [ordered]@{ platform = 'win32'; errors = @() }

# Isletim sistemi
try {
  $os = Get-CimInstance Win32_OperatingSystem
  $cv = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
  $out.os = [ordered]@{ name = $os.Caption; version = $os.Version; build = [int]$os.BuildNumber; ubr = (RegVal $cv 'UBR'); displayVersion = (RegVal $cv 'DisplayVersion'); computer = $env:COMPUTERNAME }
} catch { $out.errors += 'os' }

# Islemci ve bellek
try {
  $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
  $out.cpu = [ordered]@{ name = ($cpu.Name -replace '\s+', ' ').Trim(); cores = $cpu.NumberOfCores; threads = $cpu.NumberOfLogicalProcessors; maxMHz = $cpu.MaxClockSpeed; l3KB = $cpu.L3CacheSize }
  $mods = @(Get-CimInstance Win32_PhysicalMemory | ForEach-Object { [ordered]@{ size = [int64]$_.Capacity; speed = $_.Speed; configured = $_.ConfiguredClockSpeed; part = ("" + $_.PartNumber).Trim(); maker = ("" + $_.Manufacturer).Trim(); type = $_.SMBIOSMemoryType } })
  $out.ram = [ordered]@{ modules = $mods }
} catch { $out.errors += 'cpu' }

# Diskler: disk turu (MSFT_PhysicalDisk.MediaType 3 HDD, 4 SSD, 5 SCM), baglanti (MSFT_Disk.BusType 7 USB, 11 SATA, 17 NVMe ...),
# surucu harfleri ve bos alan. Storage modulu yerine dogrudan CIM siniflari okunur (modul yuklemesi birkac saniye surer).
# MSFT_Disk.Number ile MSFT_PhysicalDisk.DeviceId ayni diski gosterir; Depolama Alanlari gibi sanal disklerde eslesme olmaz, tur bilinmez.
try {
  $ns = 'root/Microsoft/Windows/Storage'
  $media = @{}
  foreach ($p in @(Get-CimInstance -Namespace $ns -ClassName MSFT_PhysicalDisk -ErrorAction Stop)) { $media["" + $p.DeviceId] = [int]$p.MediaType }
  $disks = @(Get-CimInstance -Namespace $ns -ClassName MSFT_Disk | ForEach-Object { [ordered]@{ n = [int]$_.Number; name = ("" + $_.FriendlyName).Trim(); bus = [int]$_.BusType; media = $media["" + $_.Number]; size = [int64]$_.Size; boot = [bool]$_.IsBoot } })
  $parts = @(Get-CimInstance -Namespace $ns -ClassName MSFT_Partition | Where-Object { [int]$_.DriveLetter -ne 0 } | ForEach-Object { [ordered]@{ disk = [int]$_.DiskNumber; letter = "" + [char]$_.DriveLetter } })
  $vols = @(Get-CimInstance -Namespace $ns -ClassName MSFT_Volume | Where-Object { [int]$_.DriveLetter -ne 0 } | ForEach-Object { [ordered]@{ letter = "" + [char]$_.DriveLetter; label = $_.FileSystemLabel; fs = $_.FileSystem; type = [int]$_.DriveType; size = [int64]$_.Size; free = [int64]$_.SizeRemaining } })
  $out.storage = [ordered]@{ disks = $disks; partitions = $parts; volumes = $vols; systemDrive = $env:SystemDrive }
} catch { $out.errors += 'disks' }

# Ekran kartlari
$classRoot = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\'
$gpus = @()
foreach ($vc in @(Get-CimInstance Win32_VideoController)) {
  $g = [ordered]@{ name = $vc.Name; pnp = $vc.PNPDeviceID; driverVersion = $vc.DriverVersion; driverDate = (CimDate $vc.DriverDate); adapterRam = $vc.AdapterRAM; status = $vc.Status; curW = $vc.CurrentHorizontalResolution; curH = $vc.CurrentVerticalResolution; curHz = $vc.CurrentRefreshRate }
  $drv = RegVal ("HKLM:\SYSTEM\CurrentControlSet\Enum\" + $vc.PNPDeviceID) 'Driver'
  if ($drv) {
    $k = $classRoot + $drv
    $g.classKey = $drv
    $g.provider = RegVal $k 'ProviderName'
    $q = RegVal $k 'HardwareInformation.qwMemorySize'
    if ($q) { $g.vram = [int64]$q } else {
      $ms = RegVal $k 'HardwareInformation.MemorySize'
      if ($ms -is [byte[]] -and $ms.Length -ge 4) { $g.vram = [int64][BitConverter]::ToUInt32($ms, 0) } elseif ($ms) { $g.vram = [int64]$ms }
    }
    $g.amdSoftwareVersion = RegVal $k 'RadeonSoftwareVersion'
    $g.amdRelease = RegVal $k 'ReleaseVersion'
    $g.amdEdition = RegVal $k 'RadeonSoftwareEdition'
  }
  $gpus += $g
}
$out.gpus = $gpus

# Monitorler: DisplayConfig + GDI kipleri + kayit defterindeki EDID
$disps = @()
try {
  foreach ($d in [OarDisp]::Query()) {
    $o = [ordered]@{ gdi = $d.gdi; adapter = $d.adapter; devicePath = $d.devicePath; friendly = $d.friendly; tech = $d.tech; hz = $d.hz; curHz = $d.curHz; w = $d.w; h = $d.h; x = $d.x; y = $d.y; bpp = $d.bpp; primary = $d.primary; hdrApi = $d.hdrApi; hdrSupported = $d.hdrSupported; hdrEnabled = $d.hdrEnabled; wcgEnabled = $d.wcgEnabled; bpc = $d.bpc; maxHzAtCurrent = $d.maxHzAtCurrent; maxW = $d.maxW; maxH = $d.maxH; maxHzAtMax = $d.maxHzAtMax; modes = @($d.modes) }
    if ($d.devicePath) {
      $parts = $d.devicePath.Replace('\\?\', '').Split('#')
      if ($parts.Length -ge 3) {
        $inst = $parts[0] + '\' + $parts[1] + '\' + $parts[2]
        $o.instance = $inst
        $edid = RegVal ("HKLM:\SYSTEM\CurrentControlSet\Enum\" + $inst + "\Device Parameters") 'EDID'
        if ($edid -is [byte[]]) { $o.edid = ([BitConverter]::ToString($edid)).Replace('-', '') }
      }
    }
    $disps += $o
  }
} catch { $out.errors += 'displays' }
$out.displays = $disps

# Yuklu programlar (surucu uygulamalari ve baslaticilar icin)
$un = @()
$seen = @{}
foreach ($root in 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*') {
  foreach ($e in @(Get-ItemProperty $root)) {
    if (-not $e.DisplayName) { continue }
    $key = $e.DisplayName + '|' + $e.DisplayVersion
    if ($seen.ContainsKey($key)) { continue }
    $seen[$key] = 1
    $us = "" + $e.UninstallString
    if ($us.Length -gt 200) { $us = $us.Substring(0, 200) }
    $un += [ordered]@{ n = $e.DisplayName; v = $e.DisplayVersion; p = $e.Publisher; loc = $e.InstallLocation; un = $us; key = $e.PSChildName; icon = ("" + $e.DisplayIcon) }
  }
}
$out.uninstall = $un

# Oyunla ilgili Windows ayarlari
$ws = [ordered]@{}
$ws.hags = RegVal 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'HwSchMode'
$ws.gameMode = RegVal 'HKCU:\Software\Microsoft\GameBar' 'AutoGameModeEnabled'
$ws.dxUser = RegVal 'HKCU:\Software\Microsoft\DirectX\UserGpuPreferences' 'DirectXUserGlobalSettings'
$ws.gameDvr = RegVal 'HKCU:\System\GameConfigStore' 'GameDVR_Enabled'
$ws.appCapture = RegVal 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' 'AppCaptureEnabled'
$ws.historicalCapture = RegVal 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' 'HistoricalCaptureEnabled'
try { $ws.powerPlan = ((powercfg /getactivescheme) -replace '^.*\(', '' -replace '\)\s*$', '').Trim() } catch { }
$out.winSettings = $ws

# NVIDIA icin ek bilgi (varsa)
$smi = Join-Path $env:SystemRoot 'System32\nvidia-smi.exe'
if (Test-Path $smi) {
  try { $out.nvidiaSmi = (& $smi --query-gpu=name,driver_version,memory.total,pcie.link.gen.max --format=csv,noheader) -join "`n" } catch { }
  try { $out.nvidiaBar1 = ((& $smi -q -d MEMORY) | Select-String -Pattern 'BAR1' -Context 0,2 | Out-String).Trim() } catch { }
}

ConvertTo-Json -InputObject $out -Depth 8 -Compress
