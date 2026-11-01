$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
$node = (Get-Command node.exe -ErrorAction Stop).Source
& $node (Join-Path $PSScriptRoot 'tunnel-publisher.mjs') watch
exit $LASTEXITCODE
