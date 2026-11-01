param([ValidateSet('install', 'status', 'stop')][string]$Action = 'status')
$ErrorActionPreference = 'Stop'
$taskName = 'RCFito-Tunnel-Publisher'
$taskRoot = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $PSScriptRoot 'tunnel-publisher-run.ps1'
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing -and -not ($existing.Actions.Arguments -contains ('-NoLogo -NoProfile -WindowStyle Hidden -File "' + $runner + '"'))) {
  throw 'El nombre de tarea pertenece a otra configuración. Se conserva sin cambios.'
}
if ($Action -eq 'status') {
  if ($existing) { $existing | Select-Object TaskName, State; Get-ScheduledTaskInfo -TaskName $taskName | Select-Object LastRunTime, LastTaskResult }
  else { Write-Output 'La tarea aún no está instalada.' }
  exit
}
if ($Action -eq 'stop') { if ($existing) { Stop-ScheduledTask -TaskName $taskName }; Write-Output 'Actualizador detenido; no se detuvo Supabase.'; exit }
if (-not (Test-Path -LiteralPath (Join-Path $taskRoot '.artifacts/quick-tunnel/private/publisher.json'))) { throw 'Primero configura las credenciales privadas del actualizador.' }
$taskUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$engine = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$arguments = '-NoLogo -NoProfile -WindowStyle Hidden -File "' + $runner + '"'
$taskAction = New-ScheduledTaskAction -Execute $engine -Argument $arguments -WorkingDirectory $taskRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $taskUser
$principal = New-ScheduledTaskPrincipal -UserId $taskUser -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $trigger -Principal $principal -Settings $settings -Description 'RCFito: mantiene la conexión privada de Sites al Quick Tunnel de esta PC.' -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State
