param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$archivePath = Join-Path $projectRoot '立体感知实验室-本地运行包.zip'
$distRoot = Join-Path $projectRoot 'dist'
if (-not (Test-Path -LiteralPath (Join-Path $distRoot 'index.html') -PathType Leaf)) {
  throw 'dist/index.html is missing. Build and validate the project before packaging.'
}

$files = @(
  Get-ChildItem -LiteralPath $distRoot -File -Recurse
  Get-Item -LiteralPath (Join-Path $projectRoot 'scripts/serve-static.mjs')
  Get-Item -LiteralPath (Join-Path $projectRoot '启动实验室.cmd')
  Get-Item -LiteralPath (Join-Path $projectRoot 'docs/README.md')
  Get-Item -LiteralPath (Join-Path $projectRoot 'docs/VALIDATION.md')
  Get-Item -LiteralPath (Join-Path $projectRoot 'docs/ASSET_CREDITS.md')
  Get-Item -LiteralPath (Join-Path $projectRoot 'docs/反透视生成_实现说明.md')
)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $files) {
    $fullPath = [System.IO.Path]::GetFullPath($file.FullName)
    if (-not $fullPath.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to package a file outside the project: $fullPath"
    }
    $entryPath = $fullPath.Substring($projectRoot.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $fullPath, $entryPath, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
  $entry = $archive.CreateEntry('本地运行说明.txt')
  $writer = [System.IO.StreamWriter]::new($entry.Open(), [System.Text.UTF8Encoding]::new($false))
  try {
    $writer.WriteLine('立体感知 · 空间实验室')
    $writer.WriteLine('完整解压此文件夹，安装 Node.js 22.14 或以上版本，双击「启动实验室.cmd」。')
    $writer.WriteLine('默认端口4173；被占用时自动换用空闲端口，实际地址以启动窗口为准。保留窗口，按 Ctrl+C 停止。')
    $writer.WriteLine('本包已含 dist，不需要 npm install，也不需要联网加载资源。')
    $writer.WriteLine('深度线索、错位片场与反透视生成；内置模型随包，可导入FBX并导出透明PNG。')
    $writer.WriteLine('此包是课堂运行版本；源码、完整开发文档、测试和截图在 W04-Practice 工程中。')
  } finally { $writer.Dispose() }
} finally {
  $archive.Dispose()
  $stream.Dispose()
}

[pscustomobject]@{
  path = $archivePath
  bytes = (Get-Item -LiteralPath $archivePath).Length
  sha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
} | ConvertTo-Json
