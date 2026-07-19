# ASCII-only live API test (Cyrillic only in URI-encoded day names)
$ErrorActionPreference = "Continue"
$wh = "https://script.google.com/macros/s/AKfycbzph2uAYgSd3Ja5XDoi647YkAIRDw2SfRIcgEUlaDW82aLpbzkgS36Zq9V5QXxqPNF7/exec"
$outFile = "F:\всякое\Git\projects\superboyna\scripts\last-test-report.txt"
$lines = New-Object System.Collections.Generic.List[string]

function L([string]$t) { $lines.Add($t); Write-Host $t }

function ParseJsonp([string]$text) {
  if ($text -match '\((\{[\s\S]*\})\)\s*$') { return $Matches[1] | ConvertFrom-Json }
  if ($text.Trim().StartsWith("{")) { return $text | ConvertFrom-Json }
  throw "bad response"
}

function ApiGet($action, $day, $extra) {
  $dayEnc = [uri]::EscapeDataString($day)
  $url = "$wh`?action=$action&day=$dayEnc&callback=cb"
  if ($extra) { $url += "&" + $extra }
  $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 90
  return ParseJsonp $r.Content
}

function ApiPost($obj) {
  $json = $obj | ConvertTo-Json -Depth 10 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  try {
    Invoke-WebRequest -Uri $wh -Method POST -Body $bytes -ContentType "text/plain;charset=utf-8" -UseBasicParsing -TimeoutSec 90 | Out-Null
  } catch {}
}

# Days in Unicode escapes to avoid file encoding issues
$Mon = [string]([char]0x041F)+([char]0x043E)+([char]0x043D)+([char]0x0435)+([char]0x0434)+([char]0x0435)+([char]0x043B)+([char]0x044C)+([char]0x043D)+([char]0x0438)+([char]0x043A)
$Tue = [string]([char]0x0412)+([char]0x0442)+([char]0x043E)+([char]0x0440)+([char]0x043D)+([char]0x0438)+([char]0x043A)
$Wed = [string]([char]0x0421)+([char]0x0440)+([char]0x0435)+([char]0x0434)+([char]0x0430)
$Legkoe = [string]([char]0x041B)+([char]0x0401)+([char]0x0413)+([char]0x041A)+([char]0x041E)+([char]0x0415)
$Srednee = [string]([char]0x0421)+([char]0x0440)+([char]0x0435)+([char]0x0434)+([char]0x043D)+([char]0x0435)+([char]0x0435)
$Serdce = [string]([char]0x0421)+([char]0x0415)+([char]0x0420)+([char]0x0414)+([char]0x0426)+([char]0x0415)
$Celoe = [string]([char]0x0426)+([char]0x0435)+([char]0x043B)+([char]0x043E)+([char]0x0435)
$Uho = [string]([char]0x0423)+([char]0x0425)+([char]0x041E)+([char]0x0020)+([char]0x0413)
$Obychnoe = [string]([char]0x041E)+([char]0x0431)+([char]0x044B)+([char]0x0447)+([char]0x043D)+([char]0x043E)+([char]0x0435)

L "=== LIVE TEST ==="

# 1 online
try {
  $o = (Invoke-WebRequest -Uri $wh -UseBasicParsing -TimeoutSec 45).Content
  if ($o -match "online|status") { L "[OK] online" } else { L "[FAIL] online body=$o" }
} catch { L "[FAIL] online $_" }

# 2 getClients Mon
try {
  $mon = ApiGet "getClients" $Mon $null
  if ($mon.status -eq "success") { L ("[OK] getClients Mon count=" + $mon.clients.Count) } else { L ("[FAIL] getClients Mon " + $mon.status) }
} catch { L "[FAIL] getClients Mon $_" }

# 3 getCutting
try {
  $cut = ApiGet "getCutting" $Mon $null
  if ($cut.status -eq "success") { L ("[OK] getCutting items=" + $cut.items.Count + " date=" + $cut.date) }
  elseif ($cut.status -eq "unknown_action") { L "[FAIL] getCutting OLD_DEPLOY unknown_action" }
  else { L ("[FAIL] getCutting " + $cut.status) }
} catch { L "[FAIL] getCutting $_" }

# 4 getCourier
try {
  $cou = ApiGet "getCourier" $Mon $null
  if ($cou.status -eq "success") { L ("[OK] getCourier clients=" + $cou.clients.Count) }
  elseif ($cou.status -eq "unknown_action") { L "[FAIL] getCourier OLD_DEPLOY" }
  else { L ("[FAIL] getCourier " + $cou.status) }
} catch { L "[FAIL] getCourier $_" }

# 5 saveOrder
$saveObj = [ordered]@{
  action = "saveOrder"
  day = $Tue
  client = "zzz_test"
  address = "Minsk test street 1"
  note = "test note"
  basket = @(
    @{ cat="dressura"; name=$Legkoe; main=$Legkoe; sub=$Srednee; val=111; value=111 }
    @{ cat="chew"; name=$Uho; main=$Uho; sub=$Obychnoe; val=2; value=2 }
  )
}
L "[..] POST saveOrder"
ApiPost $saveObj
Start-Sleep -Seconds 5

try {
  $tue = ApiGet "getClients" $Tue $null
  $z = @($tue.clients | Where-Object { $_.name -eq "zzz_test" })[0]
  if ($null -eq $z) { L "[FAIL] saveOrder zzz_test not found" }
  else {
    L ("[OK] saveOrder found positions=" + $z.orderCount + " addr=" + $z.address)
    $lung = @($z.basket | Where-Object { $_.name -like "*LEG*" -or $_.name -like "*$Legkoe*" -or ($_.val -eq 111) })[0]
    # match by val and unit more reliably
    $has111 = @($z.basket | Where-Object { $_.val -eq 111 }).Count -gt 0
    $has2 = @($z.basket | Where-Object { $_.val -eq 2 }).Count -gt 0
    if ($has111) { L "[OK] has qty 111" } else { L "[FAIL] missing qty 111" }
    if ($has2) { L "[OK] has qty 2" } else { L "[FAIL] missing qty 2" }
    $u2 = @($z.basket | Where-Object { $_.val -eq 2 })[0]
    if ($u2 -and $u2.unit -eq "sht") { L "[OK] unit sht" }
    elseif ($u2 -and $u2.unit -eq ([char]0x0448 + [char]0x0442)) { L "[OK] unit sht(cyr)" }
    elseif ($u2) { L ("[OK] unit for qty2=" + $u2.unit + " name=" + $u2.name + " sub=" + $u2.sub) }
    else { L "[FAIL] no unit check" }
    # dump basket
    foreach ($b in $z.basket) { L ("[.. basket " + $b.name + "/" + $b.sub + "=" + $b.val + $b.unit + " cat=" + $b.cat) }
  }
} catch { L "[FAIL] verify save $_" }

# 6 overwrite
$editObj = [ordered]@{
  action = "saveOrder"
  day = $Tue
  client = "zzz_test"
  address = "Minsk updated"
  note = "updated"
  basket = @(
    @{ cat="dressura"; name=$Serdce; main=$Serdce; sub=$Celoe; val=50; value=50 }
  )
}
L "[..] POST overwrite"
ApiPost $editObj
Start-Sleep -Seconds 5
try {
  $tue2 = ApiGet "getClients" $Tue $null
  $z2 = @($tue2.clients | Where-Object { $_.name -eq "zzz_test" })[0]
  if ($z2.orderCount -eq 1 -and $z2.basket[0].val -eq 50) { L "[OK] overwrite 1x50" } else { L ("[FAIL] overwrite count=" + $z2.orderCount) }
  if ($z2.address -match "updated") { L "[OK] address updated" } else { L ("[FAIL] address=" + $z2.address) }
  foreach ($b in $z2.basket) { L ("[.. basket " + $b.name + "/" + $b.sub + "=" + $b.val + $b.unit) }
} catch { L "[FAIL] overwrite $_" }

# 7 move
L "[..] move Tue->Wed"
try {
  $mvUrl = "$wh`?action=moveClient&client=zzz_test&oldDay=$([uri]::EscapeDataString($Tue))&newDay=$([uri]::EscapeDataString($Wed))&callback=cb"
  $mv = ParseJsonp ((Invoke-WebRequest -Uri $mvUrl -UseBasicParsing -TimeoutSec 90).Content)
  if ($mv.status -eq "success") { L "[OK] move status success" } else { L ("[FAIL] move " + $mv.status) }
  Start-Sleep -Seconds 4
  $onTue = @((ApiGet "getClients" $Tue $null).clients | Where-Object { $_.name -eq "zzz_test" })
  $onWed = @((ApiGet "getClients" $Wed $null).clients | Where-Object { $_.name -eq "zzz_test" })
  if ($onTue.Count -eq 0 -and $onWed.Count -eq 1) { L "[OK] move verified" } else { L ("[FAIL] move tue=" + $onTue.Count + " wed=" + $onWed.Count) }
} catch { L "[FAIL] move $_" }

# 8 delete
L "[..] delete Wed"
try {
  $delUrl = "$wh`?action=deleteClient&client=zzz_test&day=$([uri]::EscapeDataString($Wed))&callback=cb"
  $del = ParseJsonp ((Invoke-WebRequest -Uri $delUrl -UseBasicParsing -TimeoutSec 90).Content)
  if ($del.status -eq "success") { L "[OK] delete status success" } else { L ("[FAIL] delete " + $del.status) }
  Start-Sleep -Seconds 4
  $still = @((ApiGet "getClients" $Wed $null).clients | Where-Object { $_.name -eq "zzz_test" })
  if ($still.Count -eq 0) { L "[OK] delete verified" } else { L "[FAIL] still on Wed" }
} catch { L "[FAIL] delete $_" }

# 9 cutting toggle
try {
  $cut2 = ApiGet "getCutting" $Mon $null
  if ($cut2.status -eq "success" -and $cut2.items.Count -gt 0) {
    $item = $cut2.items[0]
    ApiPost @{ action="updateCutting"; day=$Mon; row=$item.row; done=$true; surplus=0.1 }
    Start-Sleep -Seconds 5
    $cut3 = ApiGet "getCutting" $Mon $null
    $again = @($cut3.items | Where-Object { $_.row -eq $item.row })[0]
    if ($again.done -eq $true) { L "[OK] cutting done persisted" } else { L "[FAIL] cutting done not persisted" }
    ApiPost @{ action="updateCutting"; day=$Mon; row=$item.row; done=$false; surplus=0 }
    L "[OK] cutting restored"
  } else { L "[..] skip cutting write" }
} catch { L "[FAIL] cutting $_" }

# 10 courier toggle
try {
  $cou2 = ApiGet "getCourier" $Mon $null
  if ($cou2.status -eq "success" -and $cou2.clients.Count -gt 0) {
    $c = $cou2.clients[0]
    $prev = [bool]$c.delivered
    $next = -not $prev
    ApiPost @{ action="setDelivered"; day=$Mon; client=$c.name; delivered=$next }
    Start-Sleep -Seconds 5
    $cou3 = ApiGet "getCourier" $Mon $null
    $c2 = @($cou3.clients | Where-Object { $_.name -eq $c.name })[0]
    if ([bool]$c2.delivered -eq $next) { L ("[OK] courier toggle " + $c.name) } else { L "[FAIL] courier toggle" }
    ApiPost @{ action="setDelivered"; day=$Mon; client=$c.name; delivered=$prev }
    L "[OK] courier restored"
  } else { L "[..] skip courier write" }
} catch { L "[FAIL] courier $_" }

$ok = @($lines | Where-Object { $_ -like "[OK]*" }).Count
$fail = @($lines | Where-Object { $_ -like "[FAIL]*" }).Count
L ("=== SUMMARY OK=$ok FAIL=$fail ===")
$lines | Set-Content -Path $outFile -Encoding UTF8
