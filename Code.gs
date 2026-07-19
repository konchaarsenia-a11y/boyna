/**
 * Бойня-Конвейер — Google Apps Script
 * Источник правды в репозитории: Code.gs
 * После правок: вставить сюда → Deploy → New version
 *
 * Секреты: PropertiesService
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 * Один раз: выполнить setupSecrets() из редактора (заполнить значения внутри и запустить),
 * либо Project Settings → Script properties.
 */

var DAY_BLOCKS = {
  "ПОНЕДЕЛЬНИК": { nick: 3, start: 4, end: 59, addr: 60, note: 61, sheet: "manager" },
  "ВТОРНИК": { nick: 64, start: 65, end: 120, addr: 121, note: 122, sheet: "manager" },
  "СРЕДА": { nick: 125, start: 126, end: 181, addr: 182, note: 183, sheet: "manager" },
  "ЧЕТВЕРГ": { nick: 186, start: 187, end: 242, addr: 243, note: 244, sheet: "manager" },
  "ПЯТНИЦА": { nick: 247, start: 248, end: 303, addr: 304, note: 305, sheet: "manager" },
  "БУДУЩАЯ НЕДЕЛЯ": { nick: 3, start: 4, end: 59, addr: 60, note: 61, sheet: "future" }
};

var MANAGER_DATE_CELLS = { 0: "A1", 1: "A62", 2: "A123", 3: "A184", 4: "A245" };

/** Заполнить токены и выполнить ОДИН раз, затем очистить литералы из кода или оставить пустыми. */
function setupSecrets() {
  var props = PropertiesService.getScriptProperties();
  // Вставьте свои значения перед первым запуском, затем можно удалить строки setProperty:
  // props.setProperty("TELEGRAM_BOT_TOKEN", "ВАШ_ТОКЕН");
  // props.setProperty("TELEGRAM_CHAT_ID", "ВАШ_CHAT_ID");
  Logger.log("Properties keys: " + JSON.stringify(props.getKeys()));
}

function getDayBlock(dayName) {
  var key = String(dayName || "").trim().toUpperCase();
  return DAY_BLOCKS[key] || null;
}

function getTargetSheet(ss, block) {
  if (!block) return null;
  if (block.sheet === "future") return ss.getSheetByName("Будущая неделя");
  return ss.getSheetByName("Прием заказов");
}

function jsonp(callback, obj) {
  var cb = callback || "callback";
  return ContentService.createTextOutput(cb + "(" + JSON.stringify(obj) + ")").setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function jsonpText(callback, obj) {
  var cb = callback || "callback";
  return ContentService.createTextOutput(cb + "(" + JSON.stringify(obj) + ")").setMimeType(ContentService.MimeType.TEXT);
}

function formatSheetDate(val, tz) {
  if (!val) return "";
  if (val instanceof Date) return Utilities.formatDate(val, tz, "dd.MM.yyyy");
  return val.toString();
}

function getCuttingItemMap_() {
  var rawMap = {
    "3": "4,5,6,7", "4": "8,9", "5": "10,11", "6": "12,13,14,15",
    "7": "16", "8": "17", "9": "18", "10": "19", "11": "20",
    "12": "21,22,23", "13": "24", "14": "25", "15": "26", "16": "27",
    "17": "28", "18": "29", "19": "30", "20": "31", "21": "32",
    "22": "33", "23": "34", "24": "35", "25": "36", "26": "37",
    "27": "38", "28": "39", "29": "40", "30": "41", "31": "42",
    "32": "43", "33": "44", "34": "45", "35": "46", "36": "47",
    "37": "48", "38": "49", "39": "50", "40": "51", "41": "52",
    "42": "53", "43": "54", "44": "55", "45": "56", "46": "57",
    "47": "58", "48": "59"
  };
  var itemMap = {};
  for (var key in rawMap) itemMap[key] = rawMap[key].split(",").map(Number);
  return itemMap;
}

function getDayDate_(ss, dayName) {
  var block = getDayBlock(dayName);
  if (!block) return null;
  var sheet = getTargetSheet(ss, block);
  if (!sheet) return null;
  if (block.sheet === "future") return sheet.getRange("A1").getValue();
  var index = Math.floor((block.start - 4) / 61);
  return sheet.getRange(MANAGER_DATE_CELLS[index]).getValue();
}

function findMemoryRow_(memorySheet, dateText, tz) {
  if (!memorySheet || memorySheet.getLastRow() < 1) return 0;
  var dates = memorySheet.getRange(1, 1, memorySheet.getLastRow(), 1).getValues();
  for (var i = 0; i < dates.length; i++) {
    if (formatSheetDate(dates[i][0], tz) === dateText) return i + 1;
  }
  return 0;
}

function getMemoryJson_(memorySheet, dateText, tz) {
  var row = findMemoryRow_(memorySheet, dateText, tz);
  if (!row) return null;
  try {
    return JSON.parse(memorySheet.getRange(row, 2).getValue());
  } catch (err) {
    return null;
  }
}

function saveMemoryJson_(memorySheet, dateText, value, tz) {
  if (!memorySheet) return;
  var row = findMemoryRow_(memorySheet, dateText, tz);
  if (row) memorySheet.getRange(row, 2).setValue(JSON.stringify(value));
  else memorySheet.appendRow([dateText, JSON.stringify(value)]);
}

function getWarehouseRowForCuttingRow_(cRow) {
  var wRow = cRow < 7 ? cRow - 1 : cRow - 2;
  if (cRow >= 12) wRow = cRow < 16 ? 11 : cRow + 10;
  if (cRow >= 43) wRow = cRow - 13;
  return wRow;
}

function recalculateCuttingForDate_(ss, dateText) {
  var cutting = ss.getSheetByName("Нарезка");
  var manager = ss.getSheetByName("Прием заказов");
  var future = ss.getSheetByName("Будущая неделя");
  var tz = ss.getSpreadsheetTimeZone();
  var itemMap = getCuttingItemMap_();
  var totals = [];
  var sourceSheet = null;
  var offset = 0;

  if (future && formatSheetDate(future.getRange("A1").getValue(), tz) === dateText) {
    sourceSheet = future;
  } else if (manager) {
    for (var i = 0; i < 5; i++) {
      if (formatSheetDate(manager.getRange(MANAGER_DATE_CELLS[i]).getValue(), tz) === dateText) {
        sourceSheet = manager;
        offset = i * 61;
        break;
      }
    }
  }

  var matrixRows = sourceSheet === future ? 60 : 310;
  var matrix = sourceSheet ? sourceSheet.getRange(1, 3, matrixRows, 15).getValues() : null;
  for (var cRow = 3; cRow <= 48; cRow++) {
    var total = 0;
    var rows = itemMap[cRow];
    if (matrix && rows) {
      for (var r = 0; r < rows.length; r++) {
        var rowIndex = rows[r] + offset - 1;
        for (var col = 0; col < 15; col++) total += Number(matrix[rowIndex][col]) || 0;
      }
    }
    totals.push([total]);
  }
  if (cutting) cutting.getRange("B3:B48").setValues(totals);
  return totals;
}

function restoreCuttingState_(cutting, memorySheet, dateText, tz) {
  cutting.getRange("C3:C60").clearContent();
  cutting.getRange("F3:F60").setValue(false);
  var saved = getMemoryJson_(memorySheet, dateText, tz);
  if (!saved || !saved.length) return;
  var surplus = [];
  var done = [];
  for (var i = 0; i < 58; i++) {
    var row = saved[i] || [];
    surplus.push([row[0] === undefined ? "" : row[0]]);
    done.push([row[3] === true]);
  }
  cutting.getRange("C3:C60").setValues(surplus);
  cutting.getRange("F3:F60").setValues(done);
}

function saveCuttingState_(cutting, memorySheet, dateText, tz) {
  saveMemoryJson_(memorySheet, dateText, cutting.getRange("C3:F60").getValues(), tz);
}

// ===================== onEdit: Нарезка дата =====================

function onEdit(e) {
  var ss = e.source;
  var sheet = ss.getActiveSheet();
  var range = e.range;
  if (sheet.getName() !== "Нарезка" || range.getA1Notation() !== "A1") return;

  var sheetMemory = ss.getSheetByName("Память_Нарезки");
  var tz = ss.getSpreadsheetTimeZone();
  var oldDateText = e.oldValue ? formatSheetDate(e.oldValue, tz) : "";
  var newDateText = range.getValue() ? formatSheetDate(range.getValue(), tz) : "";
  if (oldDateText) saveCuttingState_(sheet, sheetMemory, oldDateText, tz);
  restoreCuttingState_(sheet, sheetMemory, newDateText, tz);
  recalculateCuttingForDate_(ss, newDateText);
}

// ===================== Завершить неделю =====================

function finishFullWeekProduction() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetCourier = ss.getSheetByName("Доставки");
  var sheetManager = ss.getSheetByName("Прием заказов");
  var sheetWarehouse = ss.getSheetByName("Склад");
  var sheetArchive = ss.getSheetByName("Архив");
  var sheetFuture = ss.getSheetByName("Будущая неделя");
  var sheetCutting = ss.getSheetByName("Нарезка");
  var tz = ss.getSpreadsheetTimeZone();

  if (!sheetCourier || !sheetManager || !sheetWarehouse || !sheetCutting) {
    Browser.msgBox("❌ Ошибка листов!");
    return;
  }

  var dateVal = sheetCourier.getRange("A1").getValue();
  if (!dateVal) {
    Browser.msgBox("❌ Ошибка даты!");
    return;
  }

  var today = dateVal instanceof Date ? dateVal : new Date();
  var formattedDate = Utilities.formatDate(today, tz, "dd.MM.yyyy");
  var weekDaysGeo = [
    { start: 4, end: 59 },
    { start: 65, end: 120 },
    { start: 126, end: 181 },
    { start: 187, end: 242 },
    { start: 248, end: 303 }
  ];

  if (!sheetArchive) {
    sheetArchive = ss.insertSheet("Архив");
    sheetArchive.appendRow(["Дата закрытия", "Успешных клиентов", "Позиция товара", "Объём (гр / шт)"]);
  }

  var weeklyDispatchedItems = {};
  var successClientsCount = 0;
  var sheetMemCourier = ss.getSheetByName("Память_Доставок");
  var rawMap = {
    "3": "4,5,6,7",
    "4": "8,9",
    "5": "10,11",
    "6": "12,13,14,15",
    "7": "16",
    "8": "17",
    "9": "18",
    "10": "19",
    "11": "20",
    "12": "21,22,23",
    "13": "24",
    "14": "25",
    "15": "26",
    "16": "27",
    "17": "28",
    "18": "29",
    "19": "30",
    "20": "31",
    "21": "32",
    "22": "33",
    "23": "34",
    "24": "35",
    "25": "36",
    "26": "37",
    "27": "38",
    "28": "39",
    "29": "40",
    "30": "41",
    "31": "42",
    "32": "43",
    "33": "44",
    "34": "45",
    "35": "46",
    "36": "47",
    "37": "48",
    "38": "49",
    "39": "50",
    "40": "51",
    "41": "52",
    "42": "53",
    "43": "54",
    "44": "55",
    "45": "56",
    "46": "57",
    "47": "58",
    "48": "59"
  };
  var itemMap = {};
  for (var key in rawMap) {
    itemMap[key] = rawMap[key].split(",").map(Number);
  }

  weekDaysGeo.forEach(function (day, index) {
    var dayDateStr = sheetManager.getRange(MANAGER_DATE_CELLS[index]).getValue();
    var currentDayStatuses = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false];
    var dayDateCmp = formatSheetDate(dayDateStr, tz);

    if (dayDateCmp == formattedDate) {
      var deliveryStatusesMatrix = sheetCourier.getRange("C2:Q2").getValues();
      if (deliveryStatusesMatrix.length > 0) currentDayStatuses = deliveryStatusesMatrix[0];
    } else if (sheetMemCourier && sheetMemCourier.getLastRow() > 0) {
      var memRowsC = sheetMemCourier.getLastRow();
      var memDatesC = sheetMemCourier.getRange(1, 1, memRowsC, 1).getValues();
      for (var m = 0; m < memDatesC.length; m++) {
        if (formatSheetDate(memDatesC[m][0], tz) == dayDateCmp) {
          var parsed = JSON.parse(sheetMemCourier.getRange(m + 1, 2).getValue());
          if (parsed.length > 0) currentDayStatuses = parsed;
          break;
        }
      }
    }

    var namesArray = sheetCourier.getRange(day.start, 1, day.end - day.start + 1, 1).getValues();
    var ordersMatrix = sheetCourier.getRange(day.start, 3, day.end - day.start + 1, 15).getValues();
    for (var c = 0; c < 15; c++) {
      if (currentDayStatuses[c] === true) {
        successClientsCount++;
        for (var r = 0; r < ordersMatrix.length; r++) {
          var itemVolume = Number(ordersMatrix[r][c]) || 0;
          var itemName = namesArray[r] ? namesArray[r][0].toString().trim() : "";
          if (itemVolume > 0 && itemName !== "") {
            if (!weeklyDispatchedItems[itemName]) weeklyDispatchedItems[itemName] = 0;
            weeklyDispatchedItems[itemName] += itemVolume;
          }
        }
      }
    }
  });

  var cuttingSurplusValues = sheetCutting.getRange("C3:C60").getValues();
  for (var cRow = 3; cRow <= 48; cRow++) {
    var rowsToSum = itemMap[cRow.toString()];
    if (rowsToSum) {
      var wRow = cRow < 7 ? cRow - 1 : cRow - 2;
      if (cRow >= 12) wRow = cRow < 16 ? 11 : cRow + 10;
      if (cRow >= 43) wRow = cRow - 13;
      var totalGramsWeek = 0;
      weekDaysGeo.forEach(function (day) {
        var dayOffset = day.start - 4;
        var fullManagerMatrix = sheetManager.getRange("C1:Q310").getValues();
        rowsToSum.forEach(function (rNum) {
          var targetRowIdx = rNum + dayOffset - 1;
          for (var colM = 0; colM < 15; colM++) {
            totalGramsWeek += Number(fullManagerMatrix[targetRowIdx][colM]) || 0;
          }
        });
      });
      if (wRow <= 35 && wRow !== 10 && (wRow < 15 || wRow > 25)) {
        var dryPlanKg = totalGramsWeek / 1000;
        var currentLiveCoef = sheetWarehouse.getRange("D" + wRow).getValue() || 0.2;
        var cuttingSurplusKg = Number(cuttingSurplusValues[cRow - 3][0]) || 0;
        var totalRawSpentKg = dryPlanKg / currentLiveCoef + cuttingSurplusKg;
        var currentArrival = Number(sheetWarehouse.getRange("B" + wRow).getValue()) || 0;
        var currentRevision = Number(sheetWarehouse.getRange("F" + wRow).getValue()) || 0;
        sheetWarehouse.getRange("F" + wRow).setValue(Math.max(0, currentRevision + currentArrival - totalRawSpentKg));
        sheetWarehouse.getRange("B" + wRow).setValue(0);
      }
    }
  }

  var pieceStockValues = sheetWarehouse.getRange("K15:K25").getValues();
  sheetWarehouse.getRange("F15:F25").setValues(pieceStockValues);
  sheetWarehouse.getRange("B15:B25").setValue(0);

  var itemsKeys = Object.keys(weeklyDispatchedItems);
  if (itemsKeys.length > 0) {
    itemsKeys.forEach(function (pName) {
      sheetArchive.appendRow([formattedDate, successClientsCount / 5 + " чел.", pName, weeklyDispatchedItems[pName]]);
    });
  }

  for (var k = 0; k < 5; k++) {
    var cellRef = MANAGER_DATE_CELLS[k];
    var oldManagerDate = sheetManager.getRange(cellRef).getValue();
    if (oldManagerDate instanceof Date && !isNaN(oldManagerDate.getTime())) {
      var nextManagerDate = new Date(oldManagerDate);
      nextManagerDate.setDate(nextManagerDate.getDate() + 7);
      sheetManager.getRange(cellRef).setValue(Utilities.formatDate(nextManagerDate, tz, "dd.MM.yyyy"));
    }
  }

  var nextCourierDate = new Date(today);
  nextCourierDate.setDate(nextCourierDate.getDate() + 7);
  sheetCourier.getRange("A1").setValue(Utilities.formatDate(nextCourierDate, tz, "dd.MM.yyyy"));

  // Очистка всех блоков Пн–Пт: ники + товары + адрес + примечание
  Object.keys(DAY_BLOCKS).forEach(function (dayKey) {
    var b = DAY_BLOCKS[dayKey];
    if (b.sheet !== "manager") return;
    sheetManager.getRange(b.nick, 3, 1, 15).clearContent();
    sheetManager.getRange(b.start, 3, b.end - b.start + 1, 15).clearContent();
    sheetManager.getRange(b.addr, 3, 1, 15).clearContent();
    sheetManager.getRange(b.note, 3, 1, 15).clearContent();
  });

  // Перенос с «Будущей недели» включая адрес и примечание (C3:Q61)
  if (sheetFuture) {
    var futureData = sheetFuture.getRange("C3:Q61").getValues();
    sheetManager.getRange("C3:Q61").setValues(futureData);
    sheetFuture.getRange("C3:Q61").clearContent();
  }

  sheetCourier.getRange("C2:Q2").setValue(false);
  ["B4", "B8", "B10", "B12", "B21"].forEach(function (cell) {
    sheetCourier.getRange(cell).setValue("");
  });

  sheetCutting.getRange("F3:F60").setValue(false);
  sheetCutting.getRange("C3:C60").clearContent();
  sheetCutting.getRange("G3:G60").setValue(false);

  var newMondayDate = sheetManager.getRange("A1").getValue();
  sheetCutting.getRange("A1").setValue(newMondayDate);

  var sheetMemory = ss.getSheetByName("Память_Нарезки");
  if (sheetMemory && sheetMemory.getLastRow() > 0) {
    sheetMemory.getRange(1, 1, sheetMemory.getLastRow(), 2).clearContent();
  }
  var sheetMemCourier2 = ss.getSheetByName("Память_Доставок");
  if (sheetMemCourier2 && sheetMemCourier2.getLastRow() > 0) {
    sheetMemCourier2.getRange(1, 1, sheetMemCourier2.getLastRow(), 2).clearContent();
  }

  sendTelegramSnabNotification();
  Browser.msgBox("🎉 СМЕНА ЗАКРЫТА!");
}

// ===================== HTTP API =====================

function doPost(e) {
  var callback = (e.parameter && e.parameter.callback) || "jsonp_callback";
  try {
    var json = JSON.parse(e.postData.contents);
    return handleApiAction(json, callback, true);
  } catch (err) {
    return jsonpText(callback, { status: "error", message: String(err) });
  }
}

function doGet(e) {
  var callback = e.parameter.callback || "callback";
  if (!e.parameter.action) {
    return ContentService.createTextOutput('{"status":"online","msg":"Бэкенд Жив"}').setMimeType(ContentService.MimeType.TEXT);
  }

  var action = e.parameter.action;
  var payload = {
    action: action,
    day: e.parameter.day ? decodeURIComponent(e.parameter.day) : "",
    client: e.parameter.client ? decodeURIComponent(e.parameter.client) : "",
    oldDay: e.parameter.oldDay ? decodeURIComponent(e.parameter.oldDay) : "",
    newDay: e.parameter.newDay ? decodeURIComponent(e.parameter.newDay) : ""
  };

  // getClients — только чтение
  if (action === "getClients") {
    return handleGetClients(payload.day, callback);
  }
  if (action === "getCutting") {
    return handleGetCutting(payload.day, callback);
  }
  if (action === "getCourier") {
    return handleGetCourier(payload.day, callback);
  }

  // delete / move доступны и через GET (JSONP из mini-app)
  if (action === "deleteClient" || action === "moveClient") {
    return handleApiAction(payload, callback, false);
  }

  return jsonp(callback, { status: "unknown_action" });
}

function handleApiAction(json, callback, fromPost) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var action = json.action;

  if (action === "deleteClient") {
    return handleDeleteClient(ss, json, callback);
  }
  if (action === "moveClient") {
    // для move: day в doPost = newDay; в GET передаём newDay отдельно
    if (!json.day && json.newDay) json.day = json.newDay;
    return handleMoveClient(ss, json, callback);
  }
  if (action === "saveOrder") {
    return handleSaveOrder(ss, json, callback);
  }
  if (action === "updateCutting") {
    return handleUpdateCutting(ss, json, callback);
  }
  if (action === "setDelivered") {
    return handleSetDelivered(ss, json, callback);
  }
  return fromPost ? jsonpText(callback, { status: "unknown_action" }) : jsonp(callback, { status: "unknown_action" });
}

function handleGetCutting(dayName, callback) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cutting = ss.getSheetByName("Нарезка");
  var warehouse = ss.getSheetByName("Склад");
  var memory = ss.getSheetByName("Память_Нарезки");
  var dateValue = getDayDate_(ss, dayName);
  var tz = ss.getSpreadsheetTimeZone();
  if (!cutting || !dateValue) return jsonp(callback, { status: "bad_day", items: [] });

  var dateText = formatSheetDate(dateValue, tz);
  var isActiveDate = formatSheetDate(cutting.getRange("A1").getValue(), tz) === dateText;
  var totals = recalculateCuttingForDate_(ss, dateText);
  var names = cutting.getRange("A3:A48").getValues();
  var plans = cutting.getRange("D3:D48").getValues();
  var activeState = isActiveDate ? cutting.getRange("C3:F48").getValues() : null;
  var savedState = isActiveDate ? null : getMemoryJson_(memory, dateText, tz);
  var items = [];

  for (var i = 0; i < 46; i++) {
    var dry = Number(totals[i][0]) || 0;
    if (dry <= 0) continue;
    var name = names[i][0] == null ? "" : String(names[i][0]).trim();
    var row = i + 3;
    var piece = /шт/i.test(name);
    var state = activeState ? activeState[i] : (savedState && savedState[i] ? savedState[i] : []);
    var surplus = Number(state[0]) || 0;
    var done = state[3] === true;
    var raw;
    if (piece) {
      raw = dry;
    } else if (isActiveDate && plans[i][0] !== "" && !isNaN(Number(plans[i][0]))) {
      raw = Number(plans[i][0]);
    } else {
      var wRow = getWarehouseRowForCuttingRow_(row);
      var coef = warehouse ? Number(warehouse.getRange("D" + wRow).getValue()) : 0;
      if (!coef) coef = 0.2;
      raw = (dry / 1000) / coef;
    }
    items.push({ row: row, name: name, dry: dry, unit: piece ? "шт" : "гр", raw: raw, surplus: surplus, done: done });
  }
  return jsonp(callback, { status: "success", date: dateText, day: dayName, items: items });
}

function handleUpdateCutting(ss, json, callback) {
  var cutting = ss.getSheetByName("Нарезка");
  var memory = ss.getSheetByName("Память_Нарезки");
  var tz = ss.getSpreadsheetTimeZone();
  var row = Number(json.row);
  var dateValue = getDayDate_(ss, json.day);
  if (!cutting || !dateValue || row < 3 || row > 48 || row % 1 !== 0) {
    return jsonpText(callback, { status: "bad_request" });
  }

  var oldDate = formatSheetDate(cutting.getRange("A1").getValue(), tz);
  var dateText = formatSheetDate(dateValue, tz);
  if (oldDate && oldDate !== dateText) saveCuttingState_(cutting, memory, oldDate, tz);
  cutting.getRange("A1").setValue(dateValue);
  restoreCuttingState_(cutting, memory, dateText, tz);
  recalculateCuttingForDate_(ss, dateText);

  if (json.surplus !== undefined && json.surplus !== null) {
    cutting.getRange("C" + row).setValue(Number(json.surplus) || 0);
  }
  if (json.done !== undefined && json.done !== null) {
    var done = json.done === true || String(json.done).toLowerCase() === "true";
    cutting.getRange("F" + row).setValue(done);
  }
  saveCuttingState_(cutting, memory, dateText, tz);
  return jsonpText(callback, { status: "success" });
}

/** На листе «Доставки» ники клиентов в строке 3, галочки в строке 2. Столбец C часто «итого» — ищем ник по имени. */
function findCourierClientCol_(courierSheet, clientName) {
  if (!courierSheet) return -1;
  var want = String(clientName || "").trim().toUpperCase();
  var nicks = courierSheet.getRange(3, 3, 1, 16).getValues()[0];
  for (var i = 0; i < nicks.length; i++) {
    var nick = String(nicks[i] || "").trim().toUpperCase();
    if (!nick || nick === "ИТОГО НА ДЕНЬ" || nick === "ИТОГО" || nick === "ФАКТ СНЯТОЕ") continue;
    if (nick === want) return i + 3; // 1-based column
  }
  return -1;
}

function handleGetCourier(dayName, callback) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var courier = ss.getSheetByName("Доставки");
  var memory = ss.getSheetByName("Память_Доставок");
  var tz = ss.getSpreadsheetTimeZone();
  var dateValue = getDayDate_(ss, dayName);
  var clientData = getClientsData_(ss, dayName);
  if (!dateValue || clientData.status !== "success") {
    return jsonp(callback, { status: "bad_day", clients: [] });
  }
  var dateText = formatSheetDate(dateValue, tz);
  var memFlags = getMemoryJson_(memory, dateText, tz) || {};
  var sheetActive = courier && formatSheetDate(courier.getRange("A1").getValue(), tz) === dateText;

  var clients = [];
  for (var i = 0; i < clientData.clients.length; i++) {
    var client = clientData.clients[i];
    var delivered = false;
    var courierCol = findCourierClientCol_(courier, client.name);
    if (sheetActive && courierCol > 0) {
      delivered = courier.getRange(2, courierCol).getValue() === true;
    } else if (memFlags && typeof memFlags === "object") {
      if (Object.prototype.toString.call(memFlags) === "[object Array]") {
        delivered = memFlags[client.col] === true;
      } else {
        delivered = memFlags[String(client.name).toUpperCase()] === true;
      }
    }
    clients.push({
      name: client.name,
      address: client.address,
      note: client.note,
      basket: client.basket,
      delivered: delivered,
      col: client.col,
      courierCol: courierCol
    });
  }
  return jsonp(callback, { status: "success", day: dayName, date: dateText, clients: clients });
}

function handleSetDelivered(ss, json, callback) {
  var block = getDayBlock(json.day);
  var targetSheet = getTargetSheet(ss, block);
  var courier = ss.getSheetByName("Доставки");
  var memory = ss.getSheetByName("Память_Доставок");
  var tz = ss.getSpreadsheetTimeZone();
  var dateValue = getDayDate_(ss, json.day);
  if (!block || !targetSheet || !dateValue) return jsonpText(callback, { status: "bad_day" });

  var want = String(json.client || "").trim().toUpperCase();
  var nicks = targetSheet.getRange(block.nick, 3, 1, 15).getValues()[0];
  var mgrIdx = -1;
  for (var i = 0; i < nicks.length; i++) {
    if (String(nicks[i] || "").trim().toUpperCase() === want) {
      mgrIdx = i;
      break;
    }
  }
  if (mgrIdx < 0) return jsonpText(callback, { status: "client_not_found" });

  var dateText = formatSheetDate(dateValue, tz);
  var delivered = json.delivered === true || String(json.delivered).toLowerCase() === "true";
  var courierCol = findCourierClientCol_(courier, json.client);

  if (courier && formatSheetDate(courier.getRange("A1").getValue(), tz) === dateText && courierCol > 0) {
    courier.getRange(2, courierCol).setValue(delivered);
  } else {
    if (!memory) memory = ss.insertSheet("Память_Доставок");
    var values = getMemoryJson_(memory, dateText, tz);
    if (!values || Object.prototype.toString.call(values) === "[object Array]") {
      values = {};
    }
    values[want] = delivered;
    saveMemoryJson_(memory, dateText, values, tz);
  }
  return jsonpText(callback, { status: "success" });
}

function handleDeleteClient(ss, json, callback) {
  var block = getDayBlock(json.day);
  if (!block) return jsonp(callback, { status: "bad_day" });
  var targetSheet = getTargetSheet(ss, block);
  if (!targetSheet) return jsonp(callback, { status: "error" });

  var nicksRowValues = targetSheet.getRange(block.nick, 3, 1, 15).getValues()[0];
  var want = String(json.client || "").trim().toUpperCase();
  for (var i = 0; i < 15; i++) {
    var currentNick = nicksRowValues[i] ? nicksRowValues[i].toString().trim().toUpperCase() : "";
    if (currentNick === want) {
      var targetCol = i + 3;
      targetSheet.getRange(block.nick, targetCol).setValue("");
      // товары + адрес + примечание
      targetSheet.getRange(block.start, targetCol, block.note - block.start + 1, 1).clearContent();
      checkLiveDeficitAndNotify();
      return jsonp(callback, { status: "success" });
    }
  }
  return jsonp(callback, { status: "client_not_found" });
}

function handleMoveClient(ss, json, callback) {
  var srcBlock = getDayBlock(json.oldDay);
  var dstBlock = getDayBlock(json.newDay || json.day);
  if (!srcBlock || !dstBlock) return jsonp(callback, { status: "bad_day" });

  var sourceSheet = getTargetSheet(ss, srcBlock);
  var targetSheet = getTargetSheet(ss, dstBlock);
  if (!sourceSheet || !targetSheet) return jsonp(callback, { status: "error" });

  var want = String(json.client || "").trim().toUpperCase();
  var oldClientCol = -1;
  var srcNicks = sourceSheet.getRange(srcBlock.nick, 3, 1, 15).getValues()[0];
  for (var i = 0; i < 15; i++) {
    var sNick = srcNicks[i] ? srcNicks[i].toString().trim().toUpperCase() : "";
    if (sNick === want) {
      oldClientCol = i + 3;
      break;
    }
  }
  if (oldClientCol === -1) return jsonp(callback, { status: "src_client_not_found" });

  var oldMeatValues = sourceSheet.getRange(srcBlock.start, oldClientCol, srcBlock.end - srcBlock.start + 1, 1).getValues();
  var oldAddressValue = sourceSheet.getRange(srcBlock.addr, oldClientCol).getValue();
  var oldNoteValue = sourceSheet.getRange(srcBlock.note, oldClientCol).getValue();

  var newClientCol = -1;
  var tgtNicks = targetSheet.getRange(dstBlock.nick, 3, 1, 15).getValues()[0];
  for (var j = 0; j < 15; j++) {
    var tNick = tgtNicks[j] ? tgtNicks[j].toString().trim().toUpperCase() : "";
    if (tNick === want) {
      newClientCol = j + 3;
      break;
    }
  }
  if (newClientCol === -1) {
    for (var colIdx = 3; colIdx <= 17; colIdx++) {
      if (targetSheet.getRange(dstBlock.nick, colIdx).getValue().toString().trim() === "") {
        newClientCol = colIdx;
        targetSheet.getRange(dstBlock.nick, newClientCol).setValue(json.client);
        break;
      }
    }
  }
  if (newClientCol === -1) return jsonp(callback, { status: "no_free_columns" });

  targetSheet.getRange(dstBlock.start, newClientCol, dstBlock.end - dstBlock.start + 1, 1).setValues(oldMeatValues);
  targetSheet.getRange(dstBlock.addr, newClientCol).setValue(oldAddressValue);
  targetSheet.getRange(dstBlock.note, newClientCol).setValue(oldNoteValue);

  sourceSheet.getRange(srcBlock.nick, oldClientCol).setValue("");
  sourceSheet.getRange(srcBlock.start, oldClientCol, srcBlock.note - srcBlock.start + 1, 1).clearContent();

  checkLiveDeficitAndNotify();
  return jsonp(callback, { status: "success" });
}

/**
 * Сохранение заказа с учётом фракции (sub).
 * orderItem: { name|main, sub, val|value, cat }
 */
function handleSaveOrder(ss, json, callback) {
  var block = getDayBlock(json.day);
  if (!block) return jsonpText(callback, { status: "bad_day" });
  var targetSheet = getTargetSheet(ss, block);
  if (!targetSheet) return jsonpText(callback, { status: "error" });

  var want = String(json.client || "").trim().toUpperCase();
  if (!want) return jsonpText(callback, { status: "no_client" });

  var clientCol = -1;
  var mgrNicks = targetSheet.getRange(block.nick, 3, 1, 15).getValues()[0];
  for (var i = 0; i < 15; i++) {
    var mNick = mgrNicks[i] ? mgrNicks[i].toString().trim().toUpperCase() : "";
    if (mNick === want) {
      clientCol = i + 3;
      break;
    }
  }
  if (clientCol === -1) {
    for (var colIdx = 3; colIdx <= 17; colIdx++) {
      if (targetSheet.getRange(block.nick, colIdx).getValue().toString().trim() === "") {
        clientCol = colIdx;
        targetSheet.getRange(block.nick, clientCol).setValue(json.client);
        break;
      }
    }
  }
  if (clientCol === -1) return jsonpText(callback, { status: "no_free_columns" });

  // очистка товаров + адрес + примечание
  targetSheet.getRange(block.start, clientCol, block.note - block.start + 1, 1).clearContent();
  if (json.address) targetSheet.getRange(block.addr, clientCol).setValue(json.address);
  if (json.note) targetSheet.getRange(block.note, clientCol).setValue(json.note);

  var itemsInSheet = targetSheet.getRange(block.start, 1, block.end - block.start + 1, 1).getValues();
  var basket = json.basket || [];

  basket.forEach(function (orderItem) {
    var rawName = String(orderItem.name || orderItem.main || "").trim();
    var rawSub = String(orderItem.sub || "").trim();
    var inputVal = Number(orderItem.val != null ? orderItem.val : orderItem.value) || 0;
    if (!rawName || inputVal <= 0) return;

    var targetRowOffset = findSheetRowForItem(itemsInSheet, rawName, rawSub);
    if (targetRowOffset >= 0) {
      targetSheet.getRange(block.start + targetRowOffset, clientCol).setValue(inputVal);
    }
  });

  checkLiveDeficitAndNotify();
  return jsonpText(callback, { status: "success" });
}

/** Сопоставление позиции мини-аппа со строкой листа (с фракцией). */
function findSheetRowForItem(itemsInSheet, rawName, rawSub) {
  var nameU = rawName.toUpperCase().replace(/\s*ШТ\.?/g, "").trim();
  if (nameU.indexOf(" / ") > -1) {
    var parts = nameU.split(" / ");
    nameU = parts[0].trim();
    if (!rawSub) rawSub = parts[1] ? parts[1].trim() : "";
  }

  var subNorm = normalizeFraction(rawSub);
  var bestIdx = -1;
  var bestScore = -1;

  for (var r = 0; r < itemsInSheet.length; r++) {
    var sheetRaw = itemsInSheet[r][0];
    if (!sheetRaw) continue;
    var sheetFull = sheetRaw.toString().trim().toUpperCase();
    if (sheetFull === "" || sheetFull.indexOf("#") > -1) continue;

    var sheetBase = sheetFull;
    var sheetFrac = "";
    if (sheetFull.indexOf(" / ") > -1) {
      var sp = sheetFull.split(" / ");
      sheetBase = sp[0].trim();
      sheetFrac = normalizeFraction(sp[1] || "");
    } else {
      sheetFrac = extractEmbeddedFraction(sheetFull);
      sheetBase = sheetFull
        .replace(/\s*ШТ\.?/g, "")
        .replace(/\s*ОЧ МАЛ/g, "")
        .replace(/\s*ПОЛОВИНКА/g, "")
        .replace(/\s*ПАЛК/g, "")
        .replace(/\s*ПЛАСТ/g, "")
        .replace(/\s*ОГР/g, "")
        .replace(/\s*МАЛ/g, "")
        .replace(/\s*СРЕД/g, "")
        .replace(/\s*БОЛ/g, "")
        .replace(/\s*КРУПНОЕ/g, "")
        .trim();
    }

    var nameMatch =
      sheetBase === nameU ||
      sheetBase.indexOf(nameU) === 0 ||
      nameU.indexOf(sheetBase) === 0 ||
      sheetFull.indexOf(nameU) === 0;
    if (!nameMatch) continue;

    var score = 1;
    if (subNorm) {
      if (sheetFrac && sheetFrac === subNorm) score = 10;
      else if (sheetFull.indexOf(subNorm) > -1) score = 8;
      else if (!sheetFrac) score = 2;
      else score = 0;
    } else {
      if (!sheetFrac) score = 5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = r;
    }
  }
  return bestScore > 0 ? bestIdx : -1;
}

function normalizeFraction(s) {
  if (!s) return "";
  var u = String(s).trim().toUpperCase();
  if (u === "МЕЛКОЕ" || u === "МАЛ") return "МАЛ";
  if (u === "СРЕДНЕЕ" || u === "СРЕД") return "СРЕД";
  if (u === "БОЛЬШОЕ" || u === "БОЛ") return "БОЛ";
  if (u === "КРУПНОЕ") return "КРУПНОЕ";
  if (u === "ЦЕЛОЕ" || u === "ЦЕЛ") return "ЦЕЛОЕ";
  if (u === "ОЧ МАЛ" || u === "ОЧЕНЬ МЕЛКОЕ") return "ОЧ МАЛ";
  if (u === "ПОЛОВИНКА") return "ПОЛОВИНКА";
  if (u === "ПАЛК") return "ПАЛК";
  if (u === "ПЛАСТ") return "ПЛАСТ";
  if (u === "ОГР") return "ОГР";
  if (u === "ОБЫЧНОЕ" || u === "ОБЫЧНАЯ") return "";
  return u;
}

function extractEmbeddedFraction(sheetFull) {
  if (sheetFull.indexOf("ОЧ МАЛ") > -1) return "ОЧ МАЛ";
  if (sheetFull.indexOf("ПОЛОВИНКА") > -1) return "ПОЛОВИНКА";
  if (sheetFull.indexOf("ПАЛК") > -1) return "ПАЛК";
  if (sheetFull.indexOf("ПЛАСТ") > -1) return "ПЛАСТ";
  if (sheetFull.indexOf("ОГР") > -1) return "ОГР";
  if (/\bМАЛ\b/.test(sheetFull) || sheetFull.indexOf(" МЕЛКОЕ") > -1) return "МАЛ";
  if (sheetFull.indexOf("СРЕД") > -1) return "СРЕД";
  if (sheetFull.indexOf("БОЛ") > -1 || sheetFull.indexOf("БОЛЬШОЕ") > -1) return "БОЛ";
  if (sheetFull.indexOf("КРУПНОЕ") > -1) return "КРУПНОЕ";
  if (sheetFull.indexOf("ЦЕЛОЕ") > -1) return "ЦЕЛОЕ";
  return "";
}

function handleGetClients(dayName, callback) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var data = getClientsData_(ss, dayName);
  for (var i = 0; i < data.clients.length; i++) delete data.clients[i].col;
  return jsonp(callback, data);
}

function getClientsData_(ss, dayName) {
  var block = getDayBlock(dayName);
  if (!block) return { status: "bad_day", clients: [] };
  var targetSheet = getTargetSheet(ss, block);
  if (!targetSheet) return { status: "error", clients: [] };

  var nickRow = block.nick;
  var startRow = block.start;
  var endRow = block.end;
  var addressRow = block.addr;
  var noteRow = block.note;

  var totalSheetCols = targetSheet.getLastColumn();
  var totalSheetRows = targetSheet.getLastRow();
  var colsToRead = totalSheetCols >= 3 ? Math.min(totalSheetCols - 2, 15) : 1;

  var nicksMatrix = targetSheet.getRange(nickRow, 3, 1, colsToRead).getValues();
  var itemsNamesColumn = targetSheet.getRange(startRow, 1, endRow - startRow + 1, 1).getValues();
  var allOrdersMatrix = targetSheet.getRange(startRow, 3, endRow - startRow + 1, colsToRead).getValues();
  var addressesMatrix = totalSheetRows >= addressRow ? targetSheet.getRange(addressRow, 3, 1, colsToRead).getValues() : null;
  var notesMatrix = totalSheetRows >= noteRow ? targetSheet.getRange(noteRow, 3, 1, colsToRead).getValues() : null;

  var clientsDataList = [];
  if (nicksMatrix && nicksMatrix.length > 0) {
    var rowArray = nicksMatrix[0];
    for (var colIdx = 0; colIdx < rowArray.length; colIdx++) {
      var nameClean = rowArray[colIdx] ? rowArray[colIdx].toString().trim() : "";
      var checkUpper = nameClean.toUpperCase();
      if (
        nameClean !== "" &&
        nameClean !== "0" &&
        checkUpper !== "0" &&
        checkUpper !== "ИТОГО НА ДЕНЬ" &&
        checkUpper !== "ИТОГО" &&
        checkUpper !== "ФАКТ СНЯТОЕ" &&
        nameClean.length > 1
      ) {
        var clientBasket = [];
        var totalItemsInOrder = 0;

        for (var rIdx = 0; rIdx < allOrdersMatrix.length; rIdx++) {
          var rawCell = allOrdersMatrix[rIdx][colIdx];
          var cellValue = 0;
          if (rawCell !== null && rawCell !== undefined && typeof rawCell !== "object") {
            cellValue = Number(rawCell) || 0;
          }
          var currentItemName =
            itemsNamesColumn[rIdx] && itemsNamesColumn[rIdx][0] != null
              ? itemsNamesColumn[rIdx][0].toString().trim()
              : "";
          if (currentItemName === "" || currentItemName.indexOf("#") > -1) continue;

          if (cellValue > 0) {
            totalItemsInOrder++;
            var parsed = parseSheetItemName(currentItemName, rIdx);
            clientBasket.push({
              cat: parsed.cat,
              name: parsed.name,
              sub: parsed.sub,
              val: cellValue,
              unit: parsed.unit
            });
          }
        }

        var rawAddr = addressesMatrix && addressesMatrix[0] ? addressesMatrix[0][colIdx] : "";
        var rawNote = notesMatrix && notesMatrix[0] ? notesMatrix[0][colIdx] : "";
        clientsDataList.push({
          name: nameClean,
          orderCount: totalItemsInOrder,
          address: rawAddr != null ? String(rawAddr).trim() : "",
          note: rawNote != null ? String(rawNote).trim() : "",
          basket: clientBasket,
          col: colIdx
        });
      }
    }
  }
  return { status: "success", clients: clientsDataList };
}

/** Единый разбор имени строки листа → name/sub/cat/unit для mini-app. */
function parseSheetItemName(currentItemName, rIdx) {
  var upper = currentItemName.toUpperCase();
  var cat = "other";
  var unit = "гр";

  // Ориентиры по строкам понедельничного блока (индекс 0 = строка 4)
  // 0–11 дрессура-подобные с « / »; жевалки со шт.; и т.д.
  if (currentItemName.indexOf("шт.") > -1 || currentItemName.indexOf("ШТ") > -1) {
    unit = "шт";
  }

  var vegList = ["БАНАНЫ", "ЯБЛОКИ", "ГРУШИ", "ГРУШЫ", "МОРКОВЬ", "ТЫКВА", "БАТАТ"];
  if (upper.indexOf("КРОШКА") > -1) {
    cat = "powder";
    unit = "гр";
  } else if (vegList.indexOf(upper) > -1 || vegList.some(function (v) { return upper === v; })) {
    cat = "veg";
    unit = "гр";
  } else if (
    upper.indexOf("ЛЁГКОЕ") === 0 ||
    upper.indexOf("СЕРДЦЕ") === 0 ||
    upper.indexOf("ПОЧКИ") === 0 ||
    upper.indexOf("РУБЕЦ Т") === 0 ||
    upper.indexOf("БАРАНЬЕ") === 0
  ) {
    if (currentItemName.indexOf(" / ") > -1) {
      cat = "dressura";
      unit = "гр";
    } else {
      cat = "chew";
      unit = unit === "шт" ? "шт" : "гр";
    }
  } else if (
    upper.indexOf("БЫЧИЙ") > -1 ||
    upper.indexOf("ТРАХЕЯ") > -1 ||
    upper.indexOf("АОРТА") > -1 ||
    upper.indexOf("УХО") > -1 ||
    upper.indexOf("НОСЫ") > -1 ||
    upper.indexOf("СТАНОВАЯ") > -1 ||
    upper.indexOf("КОЛЕНИ") > -1 ||
    upper.indexOf("КОПЫТО") > -1 ||
    upper.indexOf("ПЕРЕПЁЛКИ") > -1 ||
    upper.indexOf("ЛОП") > -1 ||
    upper.indexOf("УТИНЫЕ") > -1 ||
    upper.indexOf("ГУБЫ") > -1 ||
    upper.indexOf("КНИЖКА") > -1
  ) {
    cat = "chew";
    unit = "шт";
  }

  var cleanNameOnly = currentItemName;
  var frac = "";

  if (currentItemName.indexOf(" / ") > -1) {
    var splitIdx = currentItemName.indexOf(" / ");
    cleanNameOnly = currentItemName.substring(0, splitIdx).trim();
    var subText = currentItemName.substring(splitIdx + 3).trim();
    frac = subText;
    if (subText === "Мелкое") frac = "Мелкое";
    if (subText === "Среднее") frac = "Среднее";
    if (subText === "Большое") frac = "Большое";
    if (subText === "Крупное") frac = "Крупное";
    if (subText === "Целое") frac = "Целое";
  } else {
    frac = "";
    if (upper.indexOf("ОЧ МАЛ") > -1) frac = "ОЧ МАЛ";
    else if (upper.indexOf("ПОЛОВИНКА") > -1) frac = "ПОЛОВИНКА";
    else if (upper.indexOf("ПАЛК") > -1) frac = "ПАЛК";
    else if (upper.indexOf("ПЛАСТ") > -1) frac = "ПЛАСТ";
    else if (upper.indexOf("ОГР") > -1) frac = "ОГР";
    else if (/\bМАЛ\b/.test(upper)) frac = "МАЛ";
    else if (upper.indexOf("СРЕД") > -1) frac = "СРЕД";
    else if (upper.indexOf("БОЛ") > -1) frac = "БОЛ";

    cleanNameOnly = currentItemName
      .replace(/\s*шт\.?/gi, "")
      .replace(/\s*ШТ\.?/g, "")
      .replace(/\s*ОЧ МАЛ/gi, "")
      .replace(/\s*ПОЛОВИНКА/gi, "")
      .replace(/\s*ПАЛК/gi, "")
      .replace(/\s*ПЛАСТ/gi, "")
      .replace(/\s*ОГР/gi, "")
      .replace(/\s*МАЛ/gi, "")
      .replace(/\s*СРЕД/gi, "")
      .replace(/\s*БОЛ/gi, "")
      .trim();
  }

  return { cat: cat, name: cleanNameOnly, sub: frac, unit: unit };
}

// ===================== Telegram =====================

function checkLiveDeficitAndNotify() {
  sendTelegramSnabNotificationInternal("🚨 *ОПЕРАТИВНЫЙ ДЕФИЦИТ СЫРЬЯ НА СКЛАДЕ!*");
}

function sendTelegramSnabNotification() {
  sendTelegramSnabNotificationInternal("🚨 *ПЛАН СНАБЖЕНИЯ НА НОВУЮ НЕДЕЛЮ*");
}

function sendTelegramSnabNotificationInternal(headerText) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetWarehouse = ss.getSheetByName("Склад");
  if (!sheetWarehouse) return;

  var names = sheetWarehouse.getRange("A2:A35").getValues();
  var snabValues = sheetWarehouse.getRange("G2:G35").getValues();
  var messageLines = [];
  var hasDeficit = false;

  for (var i = 0; i < names.length; i++) {
    var itemName = names[i][0].toString().trim();
    var needToBuy = Number(snabValues[i][0]) || 0;
    if (itemName !== "" && needToBuy > 0) {
      hasDeficit = true;
      var rowNum = i + 2;
      var unit = rowNum >= 15 && rowNum <= 25 ? " шт." : " кг";
      messageLines.push("• " + itemName + ": " + needToBuy.toFixed(1) + unit);
    }
  }

  if (!hasDeficit) return;

  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty("TELEGRAM_BOT_TOKEN");
  var chatId = props.getProperty("TELEGRAM_CHAT_ID");
  if (!token || !chatId) {
    Logger.log("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID не заданы в Script Properties");
    return;
  }

  var fullMessage = headerText + "\n" + messageLines.join("\n") + "\n\n🏭 _Бойня-Конвейер v4.0_";
  UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ chat_id: chatId, text: fullMessage, parse_mode: "Markdown" }),
    muteHttpExceptions: true
  });
}
