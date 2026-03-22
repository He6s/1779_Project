param(
  [string]$BaseUrl = "http://localhost:3001"
)

Set-Location "c:/Users/Yiwei Cao/Desktop/ECE1779/1779_Project"

$base = $BaseUrl
$errors = @()

function Assert-Check($cond, $msg) {
  if ($cond) {
    Write-Output ("PASS: " + $msg)
  } else {
    Write-Output ("FAIL: " + $msg)
    $script:errors += $msg
  }
}

Write-Output "== Compose Status =="
docker compose ps

try {
  $h = Invoke-RestMethod -Uri "$base/health" -Method Get
  Assert-Check ($h.ok -eq $true) "/health ok"
} catch {
  Assert-Check $false "/health reachable"
}

try {
  $r = Invoke-RestMethod -Uri "$base/ready" -Method Get
  Assert-Check ($r.ok -eq $true -and $r.db -eq "connected") "/ready db+redis connected"
} catch {
  Assert-Check $false "/ready reachable"
}

$u1Mail = "u1_" + [guid]::NewGuid().ToString("N").Substring(0, 8) + "@test.local"
$u2Mail = "u2_" + [guid]::NewGuid().ToString("N").Substring(0, 8) + "@test.local"

try {
  $reg1 = Invoke-RestMethod -Uri "$base/auth/register" -Method Post -ContentType "application/json" -Body (@{email=$u1Mail;password="Password123!"} | ConvertTo-Json)
  Assert-Check ($reg1.ok -eq $true -and $reg1.token) "register user1 with token"
} catch {
  Assert-Check $false "register user1"
}

try {
  $reg2 = Invoke-RestMethod -Uri "$base/auth/register" -Method Post -ContentType "application/json" -Body (@{email=$u2Mail;password="Password123!"} | ConvertTo-Json)
  Assert-Check ($reg2.ok -eq $true -and $reg2.token) "register user2 with token"
} catch {
  Assert-Check $false "register user2"
}

$t1 = $reg1.token
$t2 = $reg2.token

try {
  $me = Invoke-RestMethod -Uri "$base/me" -Headers @{Authorization="Bearer $t1"}
  Assert-Check ($me.ok -eq $true -and $me.user.email -eq $u1Mail) "token auth /me"
} catch {
  Assert-Check $false "/me with token"
}

try {
  $group = Invoke-RestMethod -Uri "$base/groups" -Method Post -Headers @{Authorization="Bearer $t1"} -ContentType "application/json" -Body (@{name="Test Group " + ([guid]::NewGuid().ToString("N").Substring(0, 6))} | ConvertTo-Json)
  Assert-Check ($group.ok -eq $true -and $group.group.id) "create group as user1"
} catch {
  Assert-Check $false "create group"
}

$gid = $group.group.id

try {
  $add = Invoke-RestMethod -Uri "$base/groups/$gid/members" -Method Post -Headers @{Authorization="Bearer $t1"} -ContentType "application/json" -Body (@{email=$u2Mail} | ConvertTo-Json)
  Assert-Check ($add.ok -eq $true) "owner add member user2"
} catch {
  Assert-Check $false "add member user2"
}

try {
  $members = Invoke-RestMethod -Uri "$base/groups/$gid/members" -Headers @{Authorization="Bearer $t1"}
  Assert-Check ($members.members.Count -ge 2) "group has >=2 members"
} catch {
  Assert-Check $false "list members"
}

try {
  $expBody = @{description="Groceries"; amount_cents=1000; currency="CAD"; split_type="equal"; participant_ids=@($reg1.user.id, $reg2.user.id)} | ConvertTo-Json -Depth 4
  $exp = Invoke-RestMethod -Uri "$base/groups/$gid/expenses" -Method Post -Headers @{Authorization="Bearer $t1"} -ContentType "application/json" -Body $expBody
  Assert-Check ($exp.ok -eq $true -and $exp.splits.Count -eq 2) "create equal-split expense"
} catch {
  Assert-Check $false "create expense"
}

try {
  $bal = Invoke-RestMethod -Uri "$base/groups/$gid/balances" -Headers @{Authorization="Bearer $t1"}
  $sum = ($bal.balances | Measure-Object -Property net_cents -Sum).Sum
  $u1 = $bal.balances | Where-Object {$_.user_id -eq $reg1.user.id}
  $u2 = $bal.balances | Where-Object {$_.user_id -eq $reg2.user.id}
  Assert-Check ($sum -eq 0) "balance net sum equals 0"
  Assert-Check (($u1.net_cents -eq 500) -and ($u2.net_cents -eq -500)) "balance values after expense"
} catch {
  Assert-Check $false "balances after expense"
}

try {
  $settleBody = @{from_user=$reg2.user.id; to_user=$reg1.user.id; amount_cents=500} | ConvertTo-Json
  $settle = Invoke-RestMethod -Uri "$base/groups/$gid/settlements" -Method Post -Headers @{Authorization="Bearer $t2"} -ContentType "application/json" -Body $settleBody
  Assert-Check ($settle.ok -eq $true) "create settlement from user2->user1"
} catch {
  Assert-Check $false "create settlement"
}

try {
  $bal2 = Invoke-RestMethod -Uri "$base/groups/$gid/balances" -Headers @{Authorization="Bearer $t1"}
  $u1b = $bal2.balances | Where-Object {$_.user_id -eq $reg1.user.id}
  $u2b = $bal2.balances | Where-Object {$_.user_id -eq $reg2.user.id}
  Assert-Check (($u1b.net_cents -eq 0) -and ($u2b.net_cents -eq 0)) "balances become zero after settlement"
} catch {
  Assert-Check $false "balances after settlement"
}

try {
  $act = Invoke-RestMethod -Uri "$base/groups/$gid/activity?limit=10&offset=0" -Headers @{Authorization="Bearer $t1"}
  Assert-Check (($act.activity | Measure-Object).Count -ge 2) "activity log has events"
} catch {
  Assert-Check $false "activity query"
}

if ($errors.Count -eq 0) {
  Write-Output "VALIDATION_RESULT: PASS"
  exit 0
}

Write-Output ("VALIDATION_RESULT: FAIL -> " + ($errors -join "; "))
exit 1
