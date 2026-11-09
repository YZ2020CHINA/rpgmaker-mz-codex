[CmdletBinding()]
param(
    [string]$MZPath = 'D:\steam\steamapps\common\RPG Maker MZ',
    [string]$NodePath,
    [string]$ChromiumPath,
    [string]$ProjectPath,
    [switch]$PrepareOnly
)
$ErrorActionPreference = 'Stop'
if (-not $NodePath) {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { $NodePath = $cmd.Source }
    else { $NodePath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
}
if (-not (Test-Path -LiteralPath $NodePath -PathType Leaf)) { throw 'Node.js 20+ not found. Pass -NodePath.' }
& $NodePath -e 'if (Number(process.versions.node.split(".")[0]) < 20) process.exit(1)'
if ($LASTEXITCODE -ne 0) { throw 'Node.js 20+ is required.' }
$MZPath = [IO.Path]::GetFullPath($MZPath)
if (-not (Test-Path -LiteralPath (Join-Path $MZPath 'RPGMZ.exe'))) { throw "RPGMZ.exe not found in $MZPath" }
if ($ProjectPath) {
    $ProjectPath = [IO.Path]::GetFullPath($ProjectPath)
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath 'game.rmmzproject'))) { throw 'Invalid project directory.' }
}
if (-not $ChromiumPath) {
    $ChromiumPath = @('C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', 'C:\Program Files\Google\Chrome\Application\chrome.exe') | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if ($ChromiumPath -and -not (Test-Path -LiteralPath $ChromiumPath -PathType Leaf)) { throw 'Chromium executable missing.' }
$runtime = Join-Path $PSScriptRoot 'plugins\rpgmaker-mz-local'
if (-not (Test-Path -LiteralPath (Join-Path $runtime 'server.mjs'))) { throw 'Build the plugin or extract the complete release ZIP first.' }
$utf8 = [Text.UTF8Encoding]::new($false)
$cfg = @{ installPath = $MZPath; chromiumPath = "$ChromiumPath"; projectPath = "$ProjectPath" }
[IO.File]::WriteAllText((Join-Path $runtime 'config.json'), ($cfg | ConvertTo-Json), $utf8)
# Codex copies local plugin source to its cache. ${CLAUDE_PLUGIN_ROOT} resolves there at activation.
$mcp = @{ mcpServers = @{ 'rpgmaker-mz' = @{ type = 'stdio'; command = [IO.Path]::GetFullPath($NodePath); args = @('${CLAUDE_PLUGIN_ROOT}/server.mjs'); startup_timeout_sec = 30; tool_timeout_sec = 300 } } }
[IO.File]::WriteAllText((Join-Path $runtime 'mcp.json'), ($mcp | ConvertTo-Json -Depth 8), $utf8)
if ($PrepareOnly) { Write-Output "Prepared: $runtime"; return }
$codexExe = (Get-Command codex -ErrorAction Stop).Source
& $codexExe plugin marketplace add $PSScriptRoot --json
if ($LASTEXITCODE -ne 0) { throw 'Marketplace registration failed.' }
& $codexExe plugin add 'rpgmaker-mz-local@rpgmaker-mz-local-market' --json
if ($LASTEXITCODE -ne 0) { throw 'Plugin installation failed.' }
& $codexExe plugin list --marketplace rpgmaker-mz-local-market --json
if ($LASTEXITCODE -ne 0) { throw 'Plugin listing failed.' }
Write-Output 'Installed. Start a new Codex chat to load the MCP tools and skills.'
