# Бойня-Конвейер (superboyna)

Telegram Mini App + Google Sheets для подписки на лакомства для собак.

## Структура

```
superboyna/
  app.html              # Mini App (фронт)
  Code.gs               # Apps Script (бэкенд) — вставлять в редактор Script
  PROJECT.md            # Карта листов и API
  TZ.md                 # Техническое задание
  scripts/test-api.ps1  # Быстрая проверка webhook
  .cursor/rules/        # Правила для Cursor Agent
```

## Деплой Apps Script

1. Открыть [таблицу](https://docs.google.com/spreadsheets/d/1aBNcgobp5GNBKySjMKRWEDWWKebF5kqb5A-cZoDuvG8/edit) → **Расширения → Apps Script**.
2. Заменить код на содержимое `Code.gs` из этого репозитория.
3. **Один раз** выполнить функцию `setupSecrets` (или вручную: Настройки проекта → Свойства скрипта):
   - `TELEGRAM_BOT_TOKEN` = токен бота
   - `TELEGRAM_CHAT_ID` = ваш chat id
4. **Развернуть → Управление развёртываниями → Изменить** (карандаш) → Новая версия → Развернуть.
5. Скопировать URL `/exec` в `app.html` (`GOOGLE_WEBHOOK_URL`) и в `PROJECT.md`, если URL изменился.

## Деплой Mini App

1. Выложить `app.html` на HTTPS (GitHub Pages / Cloudflare / любой хостинг).
2. В BotFather: Menu Button / Web App URL → ссылка на `app.html`.

## Тест API (PowerShell)

```powershell
.\scripts\test-api.ps1
```

Или вручную открыть в браузере:

`WEBHOOK?action=getClients&day=Понедельник&callback=cb`

## Для Cursor Agent

- Правило: `.cursor/rules/superboyna.mdc` (always on).
- Тестовый клиент: `zzz_test`.
- Не закрывать неделю без явного ОК владельца.
- После правок — тест через webhook, потом инструкция владельцу на Deploy.

## Документы

- [ИНСТРУКЦИЯ.md](./ИНСТРУКЦИЯ.md) — **для владельца: куда вставить код**
- [PROJECT.md](./PROJECT.md) — устройство таблиц и API
- [TZ.md](./TZ.md) — ТЗ и отложенные задачи (токен бота)
