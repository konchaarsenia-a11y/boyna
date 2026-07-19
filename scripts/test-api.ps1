# Быстрая проверка живого webhook Бойня-Конвейер
# Запуск: .\scripts\test-api.ps1

param(
  [string]$Webhook = "https://script.google.com/macros/s/AKfycbzph2uAYgSd3Ja5XDoi647YkAIRDw2SfRIcgEUlaDW82aLpbzkgS36Zq9V5QXxqPNF7/exec",
  [string]$Day = "Понедельник"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=== 1. Online check ===" -ForegroundColor Cyan
try {
  $online = Invoke-WebRequest -Uri $Webhook -UseBasicParsing -TimeoutSec 30
  Write-Host $online.Content
} catch {
  Write-Host "FAIL: $_" -ForegroundColor Red
}

Write-Host "`n=== 2. getClients ($Day) ===" -ForegroundColor Cyan
$dayEnc = [uri]::EscapeDataString($Day)
$url = "$Webhook`?action=getClients&day=$dayEnc&callback=cb"
try {
  $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 45
  $jsonText = $r.Content -replace '^cb\(', '' -replace '\);?\s*$', '' -replace '^undefined\(', '' -replace '\)$', ''
  # JSONP: cb({...})
  if ($r.Content -match '\((\{.*\})\)\s*$') {
    $jsonText = $Matches[1]
  }
  $data = $jsonText | ConvertFrom-Json
  Write-Host "status: $($data.status)"
  Write-Host "clients: $($data.clients.Count)"
  if ($data.clients) {
    $data.clients | ForEach-Object {
      Write-Host ("  - {0}: {1} поз., addr='{2}', note='{3}'" -f $_.name, $_.orderCount, $_.address, $_.note)
    }
  }
} catch {
  Write-Host "FAIL: $_" -ForegroundColor Red
}

Write-Host "`nDone. Для записи/удаления используйте клиента zzz_test через агента." -ForegroundColor Green
