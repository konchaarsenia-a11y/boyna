# Локальные секреты (НЕ коммитить)

Скопируйте в `secrets.local.md` и заполните:

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
GOOGLE_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
SHEET_URL=https://docs.google.com/spreadsheets/d/1aBNcgobp5GNBKySjMKRWEDWWKebF5kqb5A-cZoDuvG8/edit
```

В Apps Script те же ключи задаются через PropertiesService / функцию `setupSecrets`.
