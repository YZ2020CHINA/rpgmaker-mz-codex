[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
& codex plugin remove 'rpgmaker-mz-local@rpgmaker-mz-local-market' --json
if ($LASTEXITCODE -ne 0) { throw 'Plugin removal failed.' }
Write-Output 'Plugin removed. Game projects and backups are retained.'
