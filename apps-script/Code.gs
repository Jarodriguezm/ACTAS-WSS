// ═══════════════════════════════════════════════════════════
//  CRM Marimar Group — Google Apps Script Backend
// ═══════════════════════════════════════════════════════════

const SHEET_NAMES = { cot: 'Cotizaciones', ot: 'OT', oc: 'OC' };

const HEADERS = {
  cot: ['id','num','fecha','validez','cliente','rut','contacto','email',
        'proyecto','pago','entrega','obs','items','subtotal','iva','total',
        'estado','createdAt'],
  ot:  ['id','num','fecha','estado','prioridad','inicio','termino','cliente',
        'proyecto','direccion','tecnico','descripcion','materiales','cotRef',
        'obs','items','subtotal','iva','total','createdAt'],
  oc:  ['id','num','fecha','estado','proveedor','rut','contacto','email',
        'proyecto','otRef','pago','entrega','fechaEntrega','solicitante',
        'obs','items','subtotal','iva','total','createdAt'],
};

// ── Entry point ─────────────────────────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('CRM Marimar Group')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── Spreadsheet setup ───────────────────────────────────────
function getSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('SS_ID');
  let ss;

  if (ssId) {
    try { ss = SpreadsheetApp.openById(ssId); } catch (e) { ssId = null; }
  }

  if (!ss) {
    ss = SpreadsheetApp.create('CRM Marimar Group — Base de Datos');
    props.setProperty('SS_ID', ss.getId());
    initSheets(ss);
  }

  return ss;
}

function initSheets(ss) {
  Object.keys(HEADERS).forEach(type => {
    const name = SHEET_NAMES[type];
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);

    const existing = sheet.getLastRow();
    if (existing === 0) {
      const hdrs = HEADERS[type];
      const header = sheet.getRange(1, 1, 1, hdrs.length);
      header.setValues([hdrs]);
      header.setFontWeight('bold');
      header.setBackground('#2c5f9e');
      header.setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
  });

  // Remove default blank sheet
  ['Sheet1','Hoja1','Hoja 1'].forEach(n => {
    const s = ss.getSheetByName(n);
    if (s && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
}

// ── CRUD operations ─────────────────────────────────────────

function getRecords(type) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES[type]);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    if (typeof obj.items === 'string' && obj.items) {
      try { obj.items = JSON.parse(obj.items); } catch (e) { obj.items = []; }
    }
    // Convert numeric id to number
    if (obj.id) obj.id = Number(obj.id);
    return obj;
  });
}

function saveRecord(type, data) {
  const ss = getSpreadsheet();
  const sheetName = SHEET_NAMES[type];
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    initSheets(ss);
    sheet = ss.getSheetByName(sheetName);
  }

  data.id = Date.now();
  data.createdAt = new Date().toISOString();

  // Serialize items array
  if (data.items && typeof data.items === 'object') {
    data.items = JSON.stringify(data.items);
  }

  const row = HEADERS[type].map(h => (data[h] !== undefined ? data[h] : ''));
  sheet.appendRow(row);

  return { success: true, id: data.id };
}

function updateStatus(type, id, newStatus) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES[type]);
  if (!sheet) return false;

  const values = sheet.getDataRange().getValues();
  const idCol     = values[0].indexOf('id');
  const statusCol = values[0].indexOf('estado');

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) {
      sheet.getRange(i + 1, statusCol + 1).setValue(newStatus);
      return true;
    }
  }
  return false;
}

function deleteRecord(type, id) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES[type]);
  if (!sheet) return false;

  const values = sheet.getDataRange().getValues();
  const idCol = values[0].indexOf('id');

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function getSpreadsheetUrl() {
  return getSpreadsheet().getUrl();
}

function getNextNumber(type) {
  const records = getRecords(type);
  const count = records.length + 1;
  const prefix = { cot: 'COT', ot: 'OT', oc: 'OC' }[type];
  return prefix + '-' + String(count).padStart(4, '0');
}
