# Нативное приложение (Capacitor)

Параллельно с Telegram Mini App. **Исходный веб не трогаем:** корневые `app.html` и `Code.gs` остаются для TG / Apps Script. UI-правки нативки — только в `native/overlays/` + `scripts/sync-native.sh`.

## Структура

```
native/
  package.json              # Capacitor + плагины
  capacitor.config.json     # appId: ru.boinya.konveyer
  overlays/                 # слой поверх sync-снимка (источник правды)
    css/ native-theme.css
    js/  telegram-shim.js, boinya-native.js, native-perf.js, …
    assets/
  www/                      # КОПИЯ веба (gitignore, собирается sync)
  ios/                      # Xcode, SPM (без CocoaPods)
  android/                  # каркас
scripts/sync-native.sh      # app.html → www/index.html + inject оверлеев
```

## Быстрый старт

```bash
export PATH="$HOME/.local/node/bin:$PATH"   # если Node в ~/.local/node
cd native
npm install
npm run sync          # или: bash ../scripts/sync-native.sh
npx cap sync
npx cap open ios      # Xcode
```

В Xcode: Signing (Team) → iPhone → ▶.

## Sync после правок веба

```bash
bash scripts/sync-native.sh
cd native && npx cap sync
```

Копируется свежий `app.html` → `native/www/index.html`, плюс `assets/`, `maps.html`, `yandex-route.html`.  
В копии Telegram CDN заменяется на локальные шимы. **Корневой `app.html` не меняется.**

## Auth / линк с ботом (GBI)

В `Code.gs` (точечный merge с Mac, см. `MERGE_NATIVE_AUTH.md` + `native/CODE_GS_NATIVE_AUTH.snippet.gs`):

- `/start gbi_<token>` в `handleTelegramUpdate_`
- actions `getNativeLinkInfo`, `pollNativeAuth`

Веб-агент **не откатывает и не удаляет** это. Лист **Доступы** и `getMyAccess` общие с Mini App.

## Мост BoinyaNative

`window.BoinyaNative` — haptic / openUrl / notify / Live Activity.  
iOS: ActivityKit + Widget Extension (Dynamic Island) в target Xcode.

## iOS без CocoaPods

Проект на **Swift Package Manager** (`ios/App/CapApp-SPM`).  
Если `npx cap add ios` ругается на CocoaPods — шаблон уже развёрнут; достаточно `npx cap sync ios`.

## Не делать

- Секреты / provisioning в git
- Править корневой `app.html` «под натив»
- Ломать shared `Code.gs`-контракты нативки (см. Handoff в [AGENTS.md](./AGENTS.md))
- Живые клиенты — только `zzz_test`

## Что дальше (TZ §N)

- [x] Signing на iPhone
- [x] ActivityKit + Widget (Dynamic Island) — manager day
- [ ] Push (APNs)
- [ ] Полная Android-сборка
