// ═══════════════════════════════════════════════════════════
//  CRM Marimar Group — Google Apps Script Backend
// ═══════════════════════════════════════════════════════════

const SPREADSHEET_ID = '1CzVPvS3FO533RYypXVWF6XN-4vxEADCegzVWm_eHoRE';

// ── Logo: pega el ID del archivo en Google Drive ─────────────
// Sube el logo a Drive → clic derecho → Obtener enlace
// El ID es la parte larga entre /d/ y /view en el enlace
const LOGO_DRIVE_ID = '1yFD7ZHpeSTZStxTU6RCtbbuASY-NhluD';

// ── Datos de la empresa emisora (para facturas) ──────────────

const AUTH_USERS = [
  { username:'admin',      name:'Administrador', role:'ADMIN',      passwordHash:'04445e6487736590d1ef50186b414e737e0164683cbbec64e00e73c000fd3bef', active:true },
  { username:'supervisor', name:'Supervisor',     role:'SUPERVISOR', passwordHash:'47015d5d902fb5fb66ce2e6b5d85131323198b8aa31ab2facd91dd08e95f1e3b', active:true },
  { username:'comercial',  name:'Comercial',      role:'COMERCIAL',  passwordHash:'95683a5950357d68e36a089c6a21ea4a7aff5d341d3c9b2b3bd3d7d2bd6f8c02', active:true },
  { username:'secretaria', name:'Secretaría',     role:'SECRETARIA', passwordHash:'f7ba3491f677cd35f0b4eac944add345d128df4ee1607d56b17120ecfb2afc27', active:true },
];

const ROLE_LABELS = {
  ADMIN:'Administrador',
  SUPERVISOR:'Supervisor',
  COMERCIAL:'Comercial',
  SECRETARIA:'Secretaría'
};

const ROLE_PERMISSIONS = {
  ADMIN:      { read:'*', write:'*', remove:'*' },
  SUPERVISOR: { read:'*', write:'*', remove:'*' },
  COMERCIAL:  { read:'*', write:['cot','ot','oc','sol','facturas','clientes','productos','proveedores'], remove:[] },
  SECRETARIA: { read:['oc','proveedores','productos'], write:['oc','proveedores'], remove:[] },
};

function hashPassword_(password) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password), Utilities.Charset.UTF_8);
  return raw.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

function loginUser(username, password) {
  const user = getAuthUsers_().find(u => u.active && u.username.toLowerCase() === String(username || '').trim().toLowerCase());
  if (!user || user.passwordHash !== hashPassword_(password || '')) {
    throw new Error('Usuario o contraseña inválidos');
  }
  const token = Utilities.getUuid();
  const payload = { username:user.username, name:user.name, email:user.email || '', role:user.role, roleLabel:ROLE_LABELS[user.role] || user.role };
  CacheService.getScriptCache().put('auth_' + token, JSON.stringify(payload), 21600);
  return { token, user:payload };
}


function requestPasswordReset(username) {
  const cleanUser = String(username || '').trim().toLowerCase();
  if (!cleanUser) throw new Error('Indique el usuario para solicitar recuperación.');

  const user = getAuthUsers_().find(u => u.active && u.username.toLowerCase() === cleanUser);
  const adminEmail = EMPRESA.email || 'agencianaviera@marimargroup.com';

  if (user) {
    MailApp.sendEmail({
      to: adminEmail,
      subject: 'CRM Marimar - Solicitud de restablecimiento de contraseña',
      body: 'Se recibió una solicitud para restablecer la contraseña del usuario: ' + user.username + '\n' +
            'Nombre: ' + user.name + '\n' +
            'Rol: ' + (ROLE_LABELS[user.role] || user.role) + '\n\n' +
            'Por seguridad, verifique la identidad de la persona antes de cambiar su contraseña.'
    });
  }

  return { success:true, message:'Si el usuario existe, se envió una solicitud al administrador.' };
}
function logoutUser(token) {
  if (token) CacheService.getScriptCache().remove('auth_' + token);
  return true;
}

function getAuthUser_(token) {
  if (!token) throw new Error('Debe iniciar sesión');
  const raw = CacheService.getScriptCache().get('auth_' + token);
  if (!raw) throw new Error('Sesión expirada. Inicie sesión nuevamente.');
  return JSON.parse(raw);
}

function hasPermission_(role, action, type) {
  const rule = ROLE_PERMISSIONS[role] && ROLE_PERMISSIONS[role][action];
  if (rule === '*') return true;
  return Array.isArray(rule) && rule.indexOf(type) >= 0;
}

function requirePermission_(token, action, type) {
  const user = getAuthUser_(token);
  if (!hasPermission_(user.role, action, type)) {
    throw new Error('No tiene permisos para esta acción');
  }
  return user;
}
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
  proveedores:'Proveedores',
  usuarios:    'Usuarios'
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
               'direccion','ciudad','condicionPago','estado','obs','createdAt'],
  usuarios:   ['id','username','name','email','role','passwordHash','active','createdAt']
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

function seedDefaultUsers_(sheet) {
  const rows = AUTH_USERS.map(u => [Date.now() + Math.floor(Math.random() * 100000), u.username, u.name, '', u.role, u.passwordHash, true, new Date().toISOString()]);
  if (rows.length) sheet.getRange(2, 1, rows.length, HEADERS.usuarios.length).setValues(rows);
}

function getUsersSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAMES.usuarios);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAMES.usuarios);
  if (sheet.getLastRow() === 0) {
    const r = sheet.getRange(1, 1, 1, HEADERS.usuarios.length);
    r.setValues([HEADERS.usuarios]);
    r.setFontWeight('bold');
    r.setBackground('#1a3a5c');
    r.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    seedDefaultUsers_(sheet);
  }
  return sheet;
}
function getAuthUsers_() {
  const sheet = getUsersSheet_();
  if (!sheet || sheet.getLastRow() <= 1) return AUTH_USERS.map(u => Object.assign({ email:'' }, u));
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = normalizeCellValue(row[i]));
    obj.id = obj.id ? Number(obj.id) : '';
    obj.active = obj.active === true || String(obj.active).toLowerCase() === 'true' || String(obj.active).toLowerCase() === 'activo';
    return obj;
  }).filter(u => u.username);
}
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
function getRecords(token, type) {
  requirePermission_(token, 'read', type);
  return getRecordsInternal_(type);
}

function getRecordsInternal_(type) {
  if (!SHEET_NAMES[type] || !HEADERS[type]) throw new Error('Tipo de registro inválido: ' + type);
  const ss    = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES[type]);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const values  = sheet.getDataRange().getValues();
  const headers = values[0];

  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = normalizeCellValue(row[i]); });
    if (typeof obj.items === 'string' && obj.items) {
      try { obj.items = JSON.parse(obj.items); } catch (e) { obj.items = []; }
    }
    if (obj.id)     obj.id     = Number(obj.id);
    if (obj.precio) obj.precio = Number(obj.precio);
    return obj;
  });
}

function normalizeCellValue(value) {
  if (value instanceof Date) return value.toISOString();
  return value === null || value === undefined ? '' : value;
}
function saveRecord(token, type, data) {
  requirePermission_(token, 'write', type);
  if (!SHEET_NAMES[type] || !HEADERS[type]) throw new Error('Tipo de registro inválido: ' + type);
  const ss   = getSpreadsheet();
  let sheet  = ss.getSheetByName(SHEET_NAMES[type]);
  if (!sheet) { initSheets(ss); sheet = ss.getSheetByName(SHEET_NAMES[type]); }

  data.id        = Date.now();
  data.createdAt = new Date().toISOString();
  if (data.items && typeof data.items === 'object') {
    data.items = JSON.stringify(data.items);
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (NUM_PREFIJOS[type]) data[numCampo_(type)] = asignarNumero_(type);
    const row = HEADERS[type].map(h => (data[h] !== undefined ? data[h] : ''));
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }
  supabaseSync_(type, data);
  return { success: true, id: data.id, num: data[numCampo_(type)] || '' };
}

function updateRecordInternal_(type, id, updates) {
  if (!SHEET_NAMES[type] || !HEADERS[type]) throw new Error('Tipo de registro inválido: ' + type);
  if (updates && updates.items && typeof updates.items === 'object') updates.items = JSON.stringify(updates.items);
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

function updateRecord(token, type, id, updates) {
  requirePermission_(token, 'write', type);
  const ok = updateRecordInternal_(type, id, updates);
  if (ok) supabaseResync_(type, id);
  return ok;
}

function updateStatus(token, type, id, newStatus) {
  requirePermission_(token, 'write', type);
  const ok = updateRecordInternal_(type, id, { estado: newStatus });
  if (ok) supabaseResync_(type, id);
  return ok;
}

function deleteRecord(token, type, id) {
  requirePermission_(token, 'remove', type);
  const ss    = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES[type]);
  if (!sheet) return false;

  const values = sheet.getDataRange().getValues();
  const idCol  = values[0].indexOf('id');

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      supabaseRequest_('delete', 'crm_registros?id=eq.' + encodeURIComponent(id));
      return true;
    }
  }
  return false;
}

// ── Dashboard data ───────────────────────────────────────────
function getDashboardData(token) {
  const user = getAuthUser_(token);
  const canRead = type => hasPermission_(user.role, 'read', type);
  const cot  = canRead('cot') ? getRecordsInternal_('cot') : [];
  const ot   = canRead('ot') ? getRecordsInternal_('ot') : [];
  const oc   = canRead('oc') ? getRecordsInternal_('oc') : [];
  const sol  = canRead('sol') ? getRecordsInternal_('sol') : [];
  const fac  = canRead('facturas') ? getRecordsInternal_('facturas') : [];
  const cli  = canRead('clientes') ? getRecordsInternal_('clientes') : [];
  const prov = canRead('proveedores') ? getRecordsInternal_('proveedores') : [];

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
function getSelectData(token) {
  const user = getAuthUser_(token);
  const canRead = type => hasPermission_(user.role, 'read', type);
  return {
    clientes:   (canRead('clientes') ? getRecordsInternal_('clientes') : []).map(c => ({ id:c.id, nombre:c.nombre, rut:c.rut||'', giro:c.giro||'', direccion:c.direccion||'', ciudad:c.ciudad||'', email:c.email||'' })),
    productos:  (canRead('productos') ? getRecordsInternal_('productos') : []).map(p => ({ id:p.id, nombre:p.nombre, precio:p.precio||0, unidad:p.unidad||'' })),
    proveedores:(canRead('proveedores') ? getRecordsInternal_('proveedores') : []).map(p => ({ id:p.id, nombre:p.nombre, rut:p.rut||'' })),
  };
}


function getAccessUsers(token) {
  const user = getAuthUser_(token);
  if (user.role !== 'ADMIN') throw new Error('Solo el administrador puede gestionar accesos');
  return getAuthUsers_().map(u => ({
    id:u.id,
    username:u.username,
    name:u.name,
    email:u.email || '',
    role:u.role,
    roleLabel:ROLE_LABELS[u.role] || u.role,
    active:u.active,
    createdAt:u.createdAt || ''
  }));
}

function saveAccessUser(token, data) {
  const current = getAuthUser_(token);
  if (current.role !== 'ADMIN') throw new Error('Solo el administrador puede gestionar accesos');
  if (!data) throw new Error('Datos de usuario requeridos');

  const username = String(data.username || '').trim().toLowerCase();
  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim();
  const role = String(data.role || '').trim().toUpperCase();
  const active = data.active === true || String(data.active).toLowerCase() === 'true';
  const password = String(data.password || '');
  const id = data.id ? Number(data.id) : Date.now();

  if (!username || !name || !email || !role) throw new Error('Complete usuario, nombre, correo y rol');
  if (!ROLE_LABELS[role]) throw new Error('Rol inválido');

  const sheet = getUsersSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf('id');
  const usernameCol = headers.indexOf('username');
  const hashCol = headers.indexOf('passwordHash');

  for (let i = 1; i < values.length; i++) {
    const sameUser = String(values[i][usernameCol]).toLowerCase() === username;
    const sameId = String(values[i][idCol]) === String(id);
    if (sameUser && !sameId) throw new Error('Ese usuario ya existe');
  }

  let existingHash = '';
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) {
      rowIndex = i + 1;
      existingHash = values[i][hashCol] || '';
      break;
    }
  }

  const passwordHash = password ? hashPassword_(password) : existingHash;
  if (!passwordHash) throw new Error('Indique una contraseña inicial');

  const record = { id, username, name, email, role, passwordHash, active, createdAt:new Date().toISOString() };
  const row = HEADERS.usuarios.map(h => record[h] !== undefined ? record[h] : '');

  if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);

  return { success:true, id };
}

function setAccessUserActive(token, id, active) {
  const current = getAuthUser_(token);
  if (current.role !== 'ADMIN') throw new Error('Solo el administrador puede gestionar accesos');
  const sheet = getUsersSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf('id');
  const activeCol = headers.indexOf('active');
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) {
      sheet.getRange(i + 1, activeCol + 1).setValue(active === true);
      return true;
    }
  }
  return false;
}
function getSpreadsheetUrl(token) {
  requirePermission_(token, 'read', 'oc');
  return getSpreadsheet().getUrl();
}

function getNextFolio(token) {
  requirePermission_(token, 'write', 'facturas');
  const fac = getRecordsInternal_('facturas');
  return fac.length + 1;
}

// ── Numeración correlativa ──────────────────────────────────
// Formato: PREFIJO + MM + AA + correlativo de 5 dígitos que nunca se reinicia.
const NUM_PREFIJOS = { cot:'COT', ot:'OT', oc:'OC', sol:'SDF', facturas:'FAC' };

function numCampo_(type) {
  return type === 'facturas' ? 'folio' : 'num';
}

function formatNumero_(type, seq) {
  const mmaa = Utilities.formatDate(new Date(), 'America/Caracas', 'MMyy');
  return NUM_PREFIJOS[type] + mmaa + String(seq).padStart(5, '0');
}

function seqActual_(type) {
  const raw = PropertiesService.getScriptProperties().getProperty('SEQ_' + type);
  return raw !== null ? Number(raw) : getRecordsInternal_(type).length;
}

function asignarNumero_(type) {
  const seq = seqActual_(type) + 1;
  PropertiesService.getScriptProperties().setProperty('SEQ_' + type, String(seq));
  return formatNumero_(type, seq);
}

function getNextNumber(token, type) {
  requirePermission_(token, 'read', type);
  return NUM_PREFIJOS[type] ? formatNumero_(type, seqActual_(type) + 1) : '';
}

// ── Copia en Supabase ───────────────────────────────────────
// Configurar en Configuración del proyecto → Propiedades de la secuencia de comandos:
//   SUPABASE_URL = https://xxxx.supabase.co
//   SUPABASE_KEY = clave service_role
function supabaseConfig_() {
  const p = PropertiesService.getScriptProperties();
  const url = p.getProperty('SUPABASE_URL');
  const key = p.getProperty('SUPABASE_KEY');
  return url && key ? { url: url.trim().replace(/\/+$/, ''), key: key.trim() } : null;
}

function supabaseRequest_(method, path, body) {
  const cfg = supabaseConfig_();
  if (!cfg) return null;
  const opts = {
    method: method,
    muteHttpExceptions: true,
    headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, Prefer: 'resolution=merge-duplicates,return=minimal' },
  };
  if (body) { opts.contentType = 'application/json'; opts.payload = JSON.stringify(body); }
  try {
    const resp = UrlFetchApp.fetch(cfg.url + '/rest/v1/' + path, opts);
    if (resp.getResponseCode() >= 300) Logger.log('Supabase ' + resp.getResponseCode() + ': ' + resp.getContentText());
    return resp.getResponseCode();
  } catch (e) {
    Logger.log('Supabase error: ' + e);
    return null;
  }
}

function supabaseSync_(type, rec) {
  if (type === 'usuarios' || !rec || !rec.id) return null;
  const data = Object.assign({}, rec);
  if (typeof data.items === 'string' && data.items) { try { data.items = JSON.parse(data.items); } catch (e) {} }
  return supabaseRequest_('post', 'crm_registros?on_conflict=id', {
    id: Number(data.id),
    tipo: type,
    numero: String(data.num || data.folio || data.codigo || ''),
    data: data,
    updated_at: new Date().toISOString(),
  });
}

function supabaseResync_(type, id) {
  if (!supabaseConfig_()) return;
  const rec = getRecordsInternal_(type).find(r => String(r.id) === String(id));
  if (rec) supabaseSync_(type, rec);
}

// Ejecutar desde el editor: autoriza permisos y prueba la conexión.
function probarSupabase() {
  if (!supabaseConfig_()) { Logger.log('Falta configurar SUPABASE_URL y SUPABASE_KEY en las propiedades del script.'); return; }
  const code = supabaseRequest_('get', 'crm_registros?select=id&limit=1');
  Logger.log(code === 200 ? '✅ Conexión con Supabase correcta' : '❌ Supabase respondió: ' + code + ' (revise el registro)');
}

// Ejecutar una vez desde el editor para copiar a Supabase los registros que ya existen.
function sincronizarTodoSupabase() {
  let n = 0;
  Object.keys(SHEET_NAMES).filter(t => t !== 'usuarios').forEach(t => {
    getRecordsInternal_(t).forEach(r => { supabaseSync_(t, r); n++; });
  });
  Logger.log('Registros enviados a Supabase: ' + n);
}

// ── Archivo de documentos en Drive ──────────────────────────
// Mi unidad › PERSONAL JR › MARIMAR › CRM › <tipo>
const ARCHIVO_RUTA = ['PERSONAL JR', 'MARIMAR', 'CRM'];
const ARCHIVO_CARPETAS = { cot:'Cotizaciones', ot:'OT', oc:'OC', sol:'SDF', facturas:'Facturas' };

function getSubFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function getArchivoFolder_(type) {
  let folder = DriveApp.getRootFolder();
  ARCHIVO_RUTA.forEach(n => { folder = getSubFolder_(folder, n); });
  return getSubFolder_(folder, ARCHIVO_CARPETAS[type]);
}

function archiveDocument(token, type, name, html) {
  requirePermission_(token, 'write', type);
  if (!ARCHIVO_CARPETAS[type]) throw new Error('Tipo de documento no válido');
  const folder   = getArchivoFolder_(type);
  const fileName = String(name).replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 150) + '.pdf';
  const old = folder.getFilesByName(fileName);
  while (old.hasNext()) old.next().setTrashed(true);
  const pdf = Utilities.newBlob(html, 'text/html', 'doc.html').getAs('application/pdf').setName(fileName);
  folder.createFile(pdf);
  return ARCHIVO_RUTA.concat(ARCHIVO_CARPETAS[type]).join(' › ');
}

// Ejecutar una vez desde el editor para autorizar Drive y crear las carpetas.
function autorizarDrive() {
  Object.keys(ARCHIVO_CARPETAS).forEach(t => getArchivoFolder_(t));
  Logger.log('Carpetas listas en Mi unidad › ' + ARCHIVO_RUTA.join(' › '));
}

// ── Notas comerciales ───────────────────────────────────────
const NOTAS_DEFAULT = [
  'Precios expresados en USD.',
  'Precios no incluyen IVA.',
  'Validez de la oferta: 30 días.',
  'Tiempo de entrega sujeto a disponibilidad.',
  'Forma de pago: 50% anticipo y 50% contra entrega.',
];

function getNotasComerciales(token) {
  getAuthUser_(token);
  const raw = PropertiesService.getScriptProperties().getProperty('NOTAS_COMERCIALES');
  return raw ? JSON.parse(raw) : NOTAS_DEFAULT;
}

function saveNotasComerciales(token, notas) {
  getAuthUser_(token);
  const clean = (notas || []).map(n => String(n).trim()).filter(Boolean).slice(0, 100);
  PropertiesService.getScriptProperties().setProperty('NOTAS_COMERCIALES', JSON.stringify(clean));
  return clean;
}







