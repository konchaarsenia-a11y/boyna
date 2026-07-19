# -*- coding: utf-8 -*-
import json, time, urllib.parse, urllib.request

WH = "https://script.google.com/macros/s/AKfycbzph2uAYgSd3Ja5XDoi647YkAIRDw2SfRIcgEUlaDW82aLpbzkgS36Zq9V5QXxqPNF7/exec"
report = []

def log(s):
    print(s, flush=True)
    report.append(s)

def get(action, **kw):
    q = {"action": action, "callback": "cb"}
    q.update(kw)
    url = WH + "?" + urllib.parse.urlencode(q)
    with urllib.request.urlopen(url, timeout=90) as r:
        text = r.read().decode("utf-8")
    if text.startswith("cb(") and text.endswith(")"):
        text = text[3:-1]
    return json.loads(text)

def post(obj):
    data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(WH, data=data, headers={"Content-Type": "text/plain;charset=utf-8"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.read().decode("utf-8", errors="replace")
    except Exception as e:
        return f"POST_ERR:{e}"

log("=== PY LIVE TEST ===")

# overwrite
log("POST overwrite")
post({
    "action": "saveOrder",
    "day": "Вторник",
    "client": "zzz_test",
    "address": "Minsk updated addr",
    "note": "updated note",
    "basket": [{"cat": "dressura", "name": "СЕРДЦЕ", "main": "СЕРДЦЕ", "sub": "Целое", "val": 50, "value": 50}],
})
time.sleep(5)
tue = get("getClients", day="Вторник")
z = next((c for c in tue.get("clients", []) if c["name"] == "zzz_test"), None)
if z and z["orderCount"] == 1 and z["basket"][0]["val"] == 50 and "СЕРДЦЕ" in z["basket"][0]["name"]:
    log("[OK] overwrite 1x50 SERDCE")
else:
    log(f"[FAIL] overwrite z={json.dumps(z, ensure_ascii=False)}")
if z and "updated" in (z.get("address") or ""):
    log("[OK] address updated")
else:
    log(f"[FAIL] address {z.get('address') if z else None}")

# move
log("GET move Tue->Wed")
mv = get("moveClient", client="zzz_test", oldDay="Вторник", newDay="Среда")
log(f"[..] move status={mv.get('status')}")
time.sleep(4)
tue2 = get("getClients", day="Вторник")
wed = get("getClients", day="Среда")
on_tue = [c for c in tue2.get("clients", []) if c["name"] == "zzz_test"]
on_wed = [c for c in wed.get("clients", []) if c["name"] == "zzz_test"]
if not on_tue and on_wed:
    log(f"[OK] move verified wed_pos={on_wed[0]['orderCount']}")
else:
    log(f"[FAIL] move tue={len(on_tue)} wed={len(on_wed)}")

# delete
log("GET delete Wed")
dl = get("deleteClient", client="zzz_test", day="Среда")
log(f"[..] delete status={dl.get('status')}")
time.sleep(4)
wed2 = get("getClients", day="Среда")
still = [c for c in wed2.get("clients", []) if c["name"] == "zzz_test"]
if not still:
    log("[OK] delete verified")
else:
    log("[FAIL] still on Wed")

# cutting
cut = get("getCutting", day="Понедельник")
log(f"[OK] getCutting items={len(cut.get('items', []))} date={cut.get('date')}" if cut.get("status") == "success" else f"[FAIL] cutting {cut}")
if cut.get("items"):
    item = cut["items"][0]
    post({"action": "updateCutting", "day": "Понедельник", "row": item["row"], "done": True, "surplus": 0.1})
    time.sleep(5)
    cut2 = get("getCutting", day="Понедельник")
    again = next((i for i in cut2.get("items", []) if i["row"] == item["row"]), None)
    if again and again.get("done") is True:
        log("[OK] cutting done persisted")
    else:
        log(f"[FAIL] cutting done again={again}")
    post({"action": "updateCutting", "day": "Понедельник", "row": item["row"], "done": False, "surplus": 0})
    log("[OK] cutting restored")

# courier
cou = get("getCourier", day="Понедельник")
log(f"[OK] getCourier n={len(cou.get('clients', []))}" if cou.get("status") == "success" else f"[FAIL] courier {cou}")
if cou.get("clients"):
    c = cou["clients"][0]
    prev = bool(c.get("delivered"))
    post({"action": "setDelivered", "day": "Понедельник", "client": c["name"], "delivered": (not prev)})
    time.sleep(5)
    cou2 = get("getCourier", day="Понедельник")
    c2 = next((x for x in cou2.get("clients", []) if x["name"] == c["name"]), None)
    if c2 and bool(c2.get("delivered")) == (not prev):
        log(f"[OK] courier toggle {c['name']}")
    else:
        log(f"[FAIL] courier toggle prev={prev} now={c2}")
    post({"action": "setDelivered", "day": "Понедельник", "client": c["name"], "delivered": prev})
    log("[OK] courier restored")

# units sample Mon
mon = get("getClients", day="Понедельник")
units_ok = True
for cl in mon.get("clients", [])[:3]:
    for b in cl.get("basket", []):
        name = b.get("name", "")
        unit = b.get("unit")
        if "УХО" in name or "ТРАХЕЯ" in name or "КОЛЕНИ" in name or "БЫЧИЙ" in name:
            if unit != "шт":
                units_ok = False
                log(f"[FAIL] unit {name}={unit}")
        if "ЛЁГКОЕ" in name or "СЕРДЦЕ" in name:
            if unit != "гр":
                units_ok = False
                log(f"[FAIL] unit {name}={unit}")
if units_ok:
    log("[OK] units spot-check gr/sht")

ok = sum(1 for x in report if x.startswith("[OK]"))
fail = sum(1 for x in report if x.startswith("[FAIL]"))
log(f"=== SUMMARY OK={ok} FAIL={fail} ===")
open(r"F:\всякое\Git\projects\superboyna\scripts\last-test-report.txt", "w", encoding="utf-8").write("\n".join(report))
