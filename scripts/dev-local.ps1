# Sobe o ambiente local: Redis portátil, API, worker e web.
# A API e o worker não leem o .env da raiz sozinhos; este script carrega antes.
# Uso: pwsh scripts/dev-local.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Get-Content (Join-Path $root '.env') | Where-Object { $_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$' } | ForEach-Object {
  Set-Item "env:$($Matches[1])" $Matches[2].Trim().Trim('"')
}

$node = Join-Path $root '.tools\node-v24.21.0-win-x64'
if (Test-Path $node) { $env:PATH = "$node;$env:PATH" }

if ((Get-Service postgresql-x64-16 -ErrorAction SilentlyContinue).Status -ne 'Running') {
  Write-Warning 'PostgreSQL (postgresql-x64-16) não está rodando.'
}

if (-not (Get-Process redis-server -ErrorAction SilentlyContinue)) {
  $redis = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter redis-server.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $redis) { throw 'redis-server.exe não encontrado.' }
  Start-Process $redis.FullName -ArgumentList '--bind 127.0.0.1 --port 6379 --protected-mode yes --save "" --appendonly no' -WindowStyle Minimized
}

# Janelas filhas herdam as variáveis carregadas acima.
foreach ($script in 'dev:api', 'dev:worker', 'dev:web') {
  Start-Process pwsh -ArgumentList '-NoExit', '-Command', "npm run $script" -WorkingDirectory $root
}

Write-Host 'Web: http://localhost:3000  API: http://localhost:3001'
