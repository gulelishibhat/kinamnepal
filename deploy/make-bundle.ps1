# Builds the Elastic Beanstalk source bundle (zip) for the API.
# Ships source for packages/api + packages/shared + workspace manifests +
# platform hooks + Procfile. The EB prebuild hook installs deps and compiles.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$version = "v1-$stamp"
$staging = Join-Path $env:TEMP "eb-bundle-$stamp"
$zipPath = Join-Path $env:TEMP "eb-bundle-$stamp.zip"

Write-Output "Staging at $staging"
New-Item -ItemType Directory -Path $staging -Force | Out-Null

# Copy workspace root manifests + config needed to install/build on server.
$rootFiles = @(
  'package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml',
  'tsconfig.json', 'tsconfig.base.json', 'Procfile', '.npmrc'
)
foreach ($f in $rootFiles) {
  $src = Join-Path $root $f
  if (Test-Path $src) { Copy-Item $src (Join-Path $staging $f) -Force }
}

# Copy directories: packages/api, packages/shared, .platform, .ebextensions
# but exclude node_modules / dist / build / .env* / tsbuildinfo.
$excludeDirs = @('node_modules', 'dist', 'build', '.vite', 'coverage')
function Copy-Tree($relPath) {
  $srcDir = Join-Path $root $relPath
  if (-not (Test-Path $srcDir)) { return }
  Get-ChildItem -Recurse -File -LiteralPath $srcDir | ForEach-Object {
    $full = $_.FullName
    $rel = $full.Substring($root.Length).TrimStart('\','/')
    $parts = $rel -split '[\\/]'
    if ($parts | Where-Object { $excludeDirs -contains $_ }) { return }
    if ($_.Extension -eq '.tsbuildinfo') { return }
    if ($_.Name -like '.env*') { return }
    if ($_.Name -like '*.log') { return }
    $dest = Join-Path $staging $rel
    $destDir = Split-Path $dest -Parent
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item $full $dest -Force
  }
}

Copy-Tree 'packages\api'
Copy-Tree 'packages\shared'
Copy-Tree '.platform'
Copy-Tree '.ebextensions'

# Zip the staging dir with FORWARD-SLASH entry names (Linux/EB requires this;
# CreateFromDirectory on Windows writes backslashes which EB's unzip mishandles).
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$fs = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create)
$archive = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  Get-ChildItem -Recurse -File -LiteralPath $staging | ForEach-Object {
    $rel = $_.FullName.Substring($staging.Length).TrimStart('\','/').Replace('\','/')
    $entry = $archive.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
    $entryStream = $entry.Open()
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    $entryStream.Write($bytes, 0, $bytes.Length)
    $entryStream.Close()
  }
} finally {
  $archive.Dispose()
  $fs.Dispose()
}

$size = [Math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Output "VERSION=$version"
Write-Output "ZIP=$zipPath"
Write-Output "SIZE_MB=$size"
