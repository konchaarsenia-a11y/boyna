# Superboyna — карта системы

## Ссылки

| Что | URL |
|-----|-----|
| Google Sheet | https://docs.google.com/spreadsheets/d/1aBNcgobp5GNBKySjMKRWEDWWKebF5kqb5A-cZoDuvG8/edit |
| Apps Script webhook | https://script.google.com/macros/s/AKfycbzph2uAYgSd3Ja5XDoi647YkAIRDw2SfRIcgEUlaDW82aLpbzkgS36Zq9V5QXxqPNF7/exec |
| Репозиторий | https://github.com/konchaarsenia-a11y/superboyna.git |

## Листы книги «Доставки Июнь»

| Лист | Роль |
|------|------|
| Прием заказов | Матрица товар×клиент по дням Пн–Пт |
| Будущая неделя | Заказы на следующую неделю (как блок Пн) |
| Нарезка | План нарезки на выбранную дату (A1) |
| Доставки | Маршруты/составы курьера, статусы доставки |
| Склад | Остатки, усушка, снабжение |
| Архив | Итоги закрытых недель |
| Память_Нарезки | Сохранённые флаги/излишки по датам (JSON) |
| Память_Доставок | Сохранённые статусы доставки по датам (JSON) |

## Блоки дней «Прием заказов»

Клиенты: столбцы **C–Q** (15 слотов).

| День | Дата (ячейка) | Ники | Товары | Адрес | Примечание |
|------|---------------|------|--------|-------|-----------|
| Понедельник | A1 | 3 | 4–59 | 60 | 61 |
| Вторник | A62 | 64 | 65–120 | 121 | 122 |
| Среда | A123 | 125 | 126–181 | 182 | 183 |
| Четверг | A184 | 186 | 187–242 | 243 | 244 |
| Пятница | A245 | 247 | 248–303 | 304 | 305 |

«Будущая неделя»: отдельный лист, строки как у понедельника (3 / 4–59 / 60 / 61).

## API webhook

Базовый URL: см. выше (`.../exec`).

### GET (JSONP)

| action | Параметры | Ответ |
|--------|-----------|--------|
| (пусто) | — | `{"status":"online"}` |
| `getClients` | `day`, `callback` | `{status, clients:[{name,orderCount,address,note,basket,col}]}` |
| `deleteClient` | `client`, `day`, `callback` | `{status}` |
| `moveClient` | `client`, `oldDay`, `newDay`, `callback` | `{status}` |
| `getCutting` | `day`, `callback` | `{status, date, items:[{row,name,dry,unit,raw,surplus,done}]}` |
| `getCourier` | `day`, `callback` | `{status, date, clients:[{name,address,note,basket,delivered}]}` |

### POST (JSON body, Content-Type: text/plain)

| action | Тело | Назначение |
|--------|------|------------|
| `saveOrder` | `{day, client, address, note, basket:[{cat,main/name,sub,value/val}]}` | Запись заказа (с фракцией) |
| `deleteClient` | `{action, client, day}` | Очистка столбца |
| `moveClient` | `{action, client, oldDay, newDay}` | Перенос |
| `updateCutting` | `{day, row, surplus?, done?}` | Излишек / нарезано |
| `setDelivered` | `{day, client, delivered}` | Галочка курьера |

Дни: `Понедельник` … `Пятница`, `Будущая неделя` (сравнение без регистра).

### Формат basket (целевой)

```json
{ "cat": "dressura", "name": "ЛЁГКОЕ", "sub": "Среднее", "val": 150 }
```

`sub` обязателен для позиций с фракциями. `saveOrder` должен матчить строку листа с учётом фракции (сейчас баг: пишет в первую подходящую).

## Функции только в таблице (не mini-app пока)

| Функция | Когда |
|---------|--------|
| `onEdit` на «Нарезка»!A1 | Смена даты: память, пересчёт B, восстановление флагов |
| `finishFullWeekProduction` | Кнопка «Завершить неделю»: архив, склад, сдвиг дат, перенос с «Будущей недели» |

### Баг закрытия недели

Копировалось `C1:Q59` — **без адреса (60) и примечания (61)**. Нужно `C3:Q61` + полная очистка блоков дней включая addr/note.

## Тестирование (агент)

1. Разрешён тестовый клиент: **`zzz_test`**.
2. Проверка чтения:
   ```
   GET .../exec?action=getClients&day=Понедельник&callback=cb
   ```
3. Проверка записи: POST `saveOrder` с `zzz_test` → GET `getClients` → сверка позиций → `deleteClient`.
4. Не вызывать `finishFullWeekProduction` без явного ОК от владельца.
5. Фронт: открыть `app.html` локально / через хостинг mini-app; Telegram SDK: `https://telegram.org/js/telegram-web-app.js`.

## API webhook (дополнение v7.5)

| action | Назначение |
|--------|------------|
| `saveBooking` | Бронь на календарную дату → лист `Брони_Заказов` |
| `listBookings` | Список броней (`date` / `from`+`to`) |
| `ensureDayMaterialized` | CRM-календарь → брони → «Прием заказов» на дату D |
| `setupBookingTriggers` | Триггер 07:00 → материализация **завтрашних** доставок (утро D−1) |

### Автоматика дней

1. Менеджер / CRM бронируют **дату доставки D**.
2. Утром **D−1** (~07:00) `morningMaterializeTomorrow` тянет CRM-календарь месяца + составы АФК/ПП/БП в брони и пишет в блок дня «Прием заказов».
3. Поздняя правка с **ростом** объёма после ~12:00 дня D−1 → Telegram нарезчикам (`CUTTER_TELEGRAM_IDS` / роль cutter в `Доступы` / общий `TELEGRAM_CHAT_ID`) со списком позиций `+N г · ЛЁГКОЕ / Среднее`.
4. Розничные брони (`source=retail`) CRM не затирает.

Один раз в Script Editor: `setupBookingTriggersManual()`.  
Опционально Script Property: `CRM_SPREADSHEET_ID` (по умолчанию CRM-бот таблица).


