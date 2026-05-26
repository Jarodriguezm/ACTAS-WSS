// ═══════════════════════════════════════════════════════════
//  CRM Marimar Group — Google Apps Script Backend
// ═══════════════════════════════════════════════════════════

const SPREADSHEET_ID = '1CzVPvS3FO533RYypXVWF6XN-4vxEADCegzVWm_eHoRE';

// ── Logo: pega el ID del archivo en Google Drive ─────────────
// Sube el logo a Drive → clic derecho → Obtener enlace
// El ID es la parte larga entre /d/ y /view en el enlace
const LOGO_DRIVE_ID = '1yFD7ZHpeSTZStxTU6RCtbbuASY-NhluD';

// ── Datos de la empresa emisora (para facturas) ──────────────
const EMPRESA = {
  nombre:    'MARIMAR AGENCIA NAVIERA Y ADUANAL CA',
  rut:       'J-30029443-9',
  giro:      'Agencia Naviera y Aduanal',
  direccion: 'Calle Simón Rodríguez #10',
  ciudad:    'Cumaná, Edo. Sucre',
  email:     'agencianaviera@marimargroup.com',
  telefono:  '0293-431.12.11',
  web:       'https://marimargroup.com/',
  ivaPorc:   16,
  seniat:    'Tipografia Y Papeleria Rosales, C.A. - Calle Las Delicias, N° 46 Caigüire, Telefax: (0293) 431.80.96 - Cumaná - RIF: J-30282010-3 | Autorizado por Providencia Nº SENIAT/07/00057 de Fecha 30/01/2008, Control desde el N° 00 04801 Hasta el N° 00 05300 | Factura desde el N°. 09601 hasta el N°. 10100, Elaborado el 31/07/2019',
};

const SHEET_NAMES = {
  cot:        'Cotizaciones',
  ot:         'OT',
  oc:         'OC',
  sol:        'Solicitudes',
  facturas:   'Facturas',
  clientes:   'Clientes',
  productos:  'Productos',
  proveedores:'Proveedores'
};

const HEADERS = {
  cot: ['id','num','fecha','validez','cliente','rut','contacto','email',
        'proyecto','pago','entrega','obs','items','subtotal','iva','total','estado','createdAt'],
  ot:  ['id','num','fecha','estado','prioridad','inicio','termino','cliente',
        'proyecto','direccion','tecnico','descripcion','materiales','cotRef',
        'obs','items','subtotal','iva','total','createdAt'],
  oc:  ['id','num','fecha','estado','proveedor','rut','contacto','email',
        'proyecto','otRef','pago','entrega','fechaEntrega','solicitante',
        'obs','items','subtotal','iva','total','createdAt'],
  sol: ['id','num','fecha','estado','cliente','rut','contacto','email',
        'proyecto','cotRef','otRef','solicitante','obs',
        'items','subtotal','iva','total','createdAt'],
  facturas:   ['id','folio','ncontrol','fecha','rut','razonSocial','giro',
               'direccion','ciudad','email','items','neto','iva','ivaPorc',
               'total','formaPago','estado','obs','createdAt'],
  clientes:   ['id','codigo','nombre','rut','giro','email','telefono',
               'direccion','ciudad','tipo','estado','obs','createdAt'],
  productos:  ['id','codigo','nombre','descripcion','unidad','precio',
               'categoria','estado','obs','createdAt'],
  proveedores:['id','codigo','nombre','rut','giro','email','telefono',
               'direccion','ciudad','condicionPago','estado','obs','createdAt']
};

// ── Entry point ─────────────────────────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('CRM Marimar Group')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── Logo ────────────────────────────────────────────────────
// Devuelve la URL pública del logo — cero scopes adicionales requeridos.
// El archivo debe estar compartido como "Cualquiera con el enlace puede ver".
function getLogoBase64() {
  if (!LOGO_DRIVE_ID) return '';
  return 'https://drive.google.com/uc?id=' + LOGO_DRIVE_ID + '&export=view';
}

function getEmpresaData() {
  return EMPRESA;
}

// ── Spreadsheet ─────────────────────────────────────────────
function getSpreadsheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  initSheets(ss);
  return ss;
}

function initSheets(ss) {
  Object.keys(HEADERS).forEach(type => {
    const name  = SHEET_NAMES[type];
    let sheet   = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      const hdrs = HEADERS[type];
      const r    = sheet.getRange(1, 1, 1, hdrs.length);
      r.setValues([hdrs]);
      r.setFontWeight('bold');
      r.setBackground('#1a3a5c');
      r.setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
  });
}

// ── CRUD ────────────────────────────────────────────────────
function getRecords(type) {
  const ss    = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES[type]);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const values  = sheet.getDataRange().getValues();
  const headers = values[0];

  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    if (typeof obj.items === 'string' && obj.items) {
      try { obj.items = JSON.parse(obj.items); } catch (e) { obj.items = []; }
    }
    if (obj.id)     obj.id     = Number(obj.id);
    if (obj.precio) obj.precio = Number(obj.precio);
    return obj;
  });
}

function saveRecord(type, data) {
  const ss   = getSpreadsheet();
  let sheet  = ss.getSheetByName(SHEET_NAMES[type]);
  if (!sheet) { initSheets(ss); sheet = ss.getSheetByName(SHEET_NAMES[type]); }

  data.id        = Date.now();
  data.createdAt = new Date().toISOString();
  if (data.items && typeof data.items === 'object') {
    data.items = JSON.stringify(data.items);
  }

  const row = HEADERS[type].map(h => (data[h] !== undefined ? data[h] : ''));
  sheet.appendRow(row);
  return { success: true, id: data.id };
}

function updateRecord(type, id, updates) {
  const ss    = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES[type]);
  if (!sheet) return false;

  const values  = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol   = headers.indexOf('id');

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) {
      Object.keys(updates).forEach(key => {
        const col = headers.indexOf(key);
        if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(updates[key]);
      });
      return true;
    }
  }
  return false;
}

function updateStatus(type, id, newStatus) {
  return updateRecord(type, id, { estado: newStatus });
}

function deleteRecord(type, id) {
  const ss    = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES[type]);
  if (!sheet) return false;

  const values = sheet.getDataRange().getValues();
  const idCol  = values[0].indexOf('id');

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

// ── Dashboard data ───────────────────────────────────────────
function getDashboardData() {
  const cot  = getRecords('cot');
  const ot   = getRecords('ot');
  const oc   = getRecords('oc');
  const sol  = getRecords('sol');
  const fac  = getRecords('facturas');
  const cli  = getRecords('clientes');
  const prov = getRecords('proveedores');

  return {
    counts: {
      cot: cot.length, ot: ot.length, oc: oc.length,
      sol: sol.length, facturas: fac.length,
      clientes: cli.length, proveedores: prov.length
    },
    cotStats: countByStatus(cot),
    otStats:  countByStatus(ot),
    solStats: countByStatus(sol),
    facStats: countByStatus(fac),
    montoTotalCot: cot.reduce((a, r) => a + (Number(r.total) || 0), 0),
    montoTotalFac: fac.reduce((a, r) => a + (Number(r.total) || 0), 0),
    cotBorradores:  cot.filter(r => r.estado === 'Borrador').slice(-6).reverse(),
    otBorradores:   ot.filter(r => ['Borrador','Pendiente'].includes(r.estado)).slice(-6).reverse(),
    cotAbiertas:    cot.filter(r => ['Pendiente','Aprobada'].includes(r.estado)).slice(-6).reverse(),
    ocPendientes:   oc.filter(r => r.estado === 'Pendiente').slice(-6).reverse(),
    solPendientes:  sol.filter(r => r.estado === 'Pendiente').slice(-6).reverse(),
    facRecientes:   fac.slice(-5).reverse(),
    recentClientes: cli.slice(-5).reverse(),
    recentProv:     prov.slice(-5).reverse(),
  };
}

function countByStatus(records) {
  const c = {};
  records.forEach(r => { const s = r.estado || 'Sin estado'; c[s] = (c[s] || 0) + 1; });
  return c;
}

// ── Selects ──────────────────────────────────────────────────
function getSelectData() {
  return {
    clientes:   getRecords('clientes').map(c => ({ id:c.id, nombre:c.nombre, rut:c.rut||'', giro:c.giro||'', direccion:c.direccion||'', ciudad:c.ciudad||'', email:c.email||'' })),
    productos:  getRecords('productos').map(p => ({ id:p.id, nombre:p.nombre, precio:p.precio||0, unidad:p.unidad||'' })),
    proveedores:getRecords('proveedores').map(p => ({ id:p.id, nombre:p.nombre, rut:p.rut||'' })),
  };
}

function getSpreadsheetUrl() {
  return getSpreadsheet().getUrl();
}

function getNextFolio() {
  const fac = getRecords('facturas');
  return fac.length + 1;
}
