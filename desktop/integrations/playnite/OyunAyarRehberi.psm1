# RigTune - Playnite dışa aktarıcı.
# Playnite'taki yüklü oyunların listesini RigTune'un okuyabileceği bir JSON dosyasına yazar.
# Playnite açıkken kütüphane dosyasını kilitlediği için uygulama listeyi buradan alır.
# Yalnızca okur; Playnite kütüphanesinde hiçbir şeyi değiştirmez.
# Dosya: %APPDATA%\RigTune\playnite-games.json (1.0 sürümü uygulamanın eski adındaki "Oyun Ayar Rehberi" klasörüne yazıyordu).
# Kimlik (Id), klasör ve modül dosyasının adı eski kurulumun üzerine yazılabilsin diye değiştirilmedi.

function Export-OarGames {
    try {
        $outDir = Join-Path $env:APPDATA 'RigTune'
        if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
        $list = New-Object System.Collections.ArrayList
        foreach ($g in $PlayniteApi.Database.Games) {
            if (-not $g.IsInstalled) { continue }
            $dir = $g.InstallDirectory
            if ($dir) { try { $dir = $PlayniteApi.ExpandGameVariables($g, $dir) } catch { } }
            $src = ''
            if ($g.Source) { $src = $g.Source.Name }
            $last = $null
            if ($g.LastActivity) { $last = ([DateTimeOffset]$g.LastActivity).ToUnixTimeMilliseconds() }
            [void]$list.Add([pscustomobject]@{
                id           = $g.Id.ToString()
                name         = $g.Name
                installDir   = $dir
                source       = $src
                pluginId     = $g.PluginId.ToString()
                gameId       = $g.GameId
                lastActivity = $last
                hidden       = [bool]$g.Hidden
            })
        }
        $ver = ''
        try { $ver = $PlayniteApi.ApplicationInfo.ApplicationVersion.ToString() } catch { }
        $doc = [pscustomobject]@{ version = 1; exportedAt = ([DateTimeOffset]::Now).ToUnixTimeMilliseconds(); playnite = $ver; games = $list }
        $target = Join-Path $outDir 'playnite-games.json'
        $tmp = $target + '.tmp'
        ConvertTo-Json -InputObject $doc -Depth 4 | Set-Content -LiteralPath $tmp -Encoding UTF8
        Move-Item -LiteralPath $tmp -Destination $target -Force
        return $list.Count
    } catch {
        if ($__logger) { $__logger.Error("RigTune export failed: $_") }
        return -1
    }
}

function OnApplicationStarted() { param($evnArgs) Export-OarGames | Out-Null }
function OnApplicationStopped() { param($evnArgs) Export-OarGames | Out-Null }
function OnLibraryUpdated() { param($evnArgs) Export-OarGames | Out-Null }
function OnGameInstalled() { param($evnArgs) Export-OarGames | Out-Null }
function OnGameUninstalled() { param($evnArgs) Export-OarGames | Out-Null }

# Eklentiler menüsünde elle aktarma seçeneği
function GetMainMenuItems() {
    param($getMainMenuItemsArgs)
    $item = New-Object Playnite.SDK.Plugins.ScriptMainMenuItem
    $item.Description = 'RigTune: oyun listesini şimdi aktar'
    $item.FunctionName = 'ExportOarGamesManual'
    $item.MenuSection = '@'
    return $item
}

function ExportOarGamesManual() {
    param($scriptMainMenuItemActionArgs)
    $n = Export-OarGames
    if ($n -ge 0) { $PlayniteApi.Dialogs.ShowMessage("$n yüklü oyun RigTune için aktarıldı.", 'RigTune') }
    else { $PlayniteApi.Dialogs.ShowErrorMessage('Aktarma başarısız oldu; ayrıntı Playnite günlüğünde.', 'RigTune') }
}
