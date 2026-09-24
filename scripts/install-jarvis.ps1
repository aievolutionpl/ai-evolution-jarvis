# AI Evolution Jarvis — instalacja jednym poleceniem (Windows).
#
#   irm https://raw.githubusercontent.com/aievolutionpl/ai-evolution-jarvis/main/scripts/install-jarvis.ps1 | iex
#
# Pobiera najnowszy instalator z GitHub Releases, instaluje go po cichu dla
# bieżącego użytkownika (bez UAC — instalator NSIS jest per-user), a potem
# uruchamia aplikację. Skrót na pulpicie i w menu Start tworzy sam instalator.
#
# Parametry:
#   -Version v0.17.2   konkretne wydanie zamiast najnowszego
#   -NoLaunch          nie uruchamiaj aplikacji po instalacji
#   -DryRun            pokaż, co zostałoby pobrane, bez zmian na dysku

param(
    [string]$Version = 'latest',
    [switch]$NoLaunch,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Repo = if ($env:JARVIS_REPO) { $env:JARVIS_REPO } else { 'aievolutionpl/ai-evolution-jarvis' }
$AppName = 'AI Evolution Jarvis'

function Say([string]$Message) { Write-Host "> $Message" -ForegroundColor Cyan }

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }

if ($env:JARVIS_RELEASE_JSON) {
    $release = Get-Content -Raw $env:JARVIS_RELEASE_JSON | ConvertFrom-Json
} else {
    $api = if ($Version -eq 'latest') {
        "https://api.github.com/repos/$Repo/releases/latest"
    } else {
        "https://api.github.com/repos/$Repo/releases/tags/$Version"
    }
    $release = Invoke-RestMethod -Uri $api -Headers @{ Accept = 'application/vnd.github+json' }
}

# The NSIS .exe, not the .msi: it is the per-user, no-admin path.
$asset = $release.assets | Where-Object { $_.name -match "-win-$arch\.exe$" } | Select-Object -First 1
if (-not $asset -and $arch -eq 'arm64') {
    # x64 builds run on Windows on ARM through emulation.
    $asset = $release.assets | Where-Object { $_.name -match '-win-x64\.exe$' } | Select-Object -First 1
}
if (-not $asset) { throw "Brak instalatora Windows w wydaniu $($release.tag_name)." }

Say "Wydanie: $($release.tag_name)"
Say "Pobieram: $($asset.browser_download_url)"

if ($DryRun) {
    Say 'Tryb próbny — nic nie zostało zmienione.'
    return
}

$installer = Join-Path $env:TEMP $asset.name
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $installer -UseBasicParsing

Say 'Instaluję (bez uprawnień administratora)…'
$process = Start-Process -FilePath $installer -ArgumentList '/S' -PassThru -Wait
Remove-Item $installer -Force -ErrorAction SilentlyContinue
if ($process.ExitCode -ne 0) { throw "Instalator zakończył się kodem $($process.ExitCode)." }

$exe = Join-Path $env:LOCALAPPDATA "Programs\$AppName\$AppName.exe"
Say "Gotowe. Skrót '$AppName' jest na pulpicie i w menu Start."

if (-not $NoLaunch -and (Test-Path $exe)) {
    Say "Uruchamiam $AppName…"
    Start-Process -FilePath $exe
}
