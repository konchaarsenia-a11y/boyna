#!/usr/bin/env bash
# Копирует веб → native/www без правок исходного app.html / Code.gs.
set -euo pipefail

export PATH="${HOME}/.local/node/bin:${PATH}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NATIVE="$ROOT/native"
WWW="$NATIVE/www"
OVERLAYS="$NATIVE/overlays"

if [[ ! -f "$ROOT/app.html" ]]; then
  echo "error: app.html not found in $ROOT" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "error: node not found (expected ~/.local/node/bin)" >&2
  exit 1
fi

rm -rf "$WWW"
mkdir -p "$WWW/js" "$WWW/assets"

cp "$ROOT/app.html" "$WWW/index.html"
[[ -f "$ROOT/maps.html" ]] && cp "$ROOT/maps.html" "$WWW/maps.html"
[[ -f "$ROOT/yandex-route.html" ]] && cp "$ROOT/yandex-route.html" "$WWW/yandex-route.html"
[[ -d "$ROOT/assets" ]] && cp -R "$ROOT/assets/." "$WWW/assets/"
cp -R "$OVERLAYS/js/." "$WWW/js/"

ROOT="$ROOT" node <<'NODE'
const fs = require("fs");
const path = require("path");
const wwwIndex = path.join(process.env.ROOT, "native", "www", "index.html");
let html = fs.readFileSync(wwwIndex, "utf8");
const inject = [
  '<script src="js/telegram-shim.js"></script>',
  '<script src="js/boinya-native.js"></script>',
  '<script src="js/native-perf.js"></script>'
].join("\n  ");
const tgCdn = '<script src="https://telegram.org/js/telegram-web-app.js"></script>';
if (html.includes(tgCdn)) {
  html = html.replace(tgCdn, inject);
} else if (!html.includes("js/telegram-shim.js")) {
  html = html.replace("<head>", "<head>\n  " + inject);
}
if (!html.includes("capacitor-entry.js")) {
  html = html.replace(
    "</body>",
    '  <script src="js/capacitor-entry.js"></script>\n</body>'
  );
}
fs.writeFileSync(wwwIndex, html);
console.log("sync-native: injected shims into", wwwIndex);
NODE

cat > "$WWW/js/capacitor-entry.js" <<'EOF'
try {
  if (window.Capacitor && window.Capacitor.Plugins) {
    var P = window.Capacitor.Plugins;
    if (P.StatusBar && P.StatusBar.setStyle) {
      P.StatusBar.setStyle({ style: "DARK" }).catch(function () {});
      if (P.StatusBar.setBackgroundColor) {
        P.StatusBar.setBackgroundColor({ color: "#0a0a0a" }).catch(function () {});
      }
    }
    if (P.SplashScreen && P.SplashScreen.hide) {
      P.SplashScreen.hide().catch(function () {});
    }
  }
} catch (e) {}
EOF

echo "sync-native: OK → $WWW"
