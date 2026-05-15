// ============================================================
//  RUTINA COMERCIAL DIARIA — WSS
//  Google Apps Script + UltraMsg WhatsApp API
//  Autor: José Rodríguez / Configurado por Claude
// ============================================================

// ── CONFIGURACIÓN ────────────────────────────────────────────
const CONFIG = {
  ultraMsg: {
    instanceId: "TU_INSTANCE_ID",   // ← reemplaza en UltraMsg
    token:      "TU_TOKEN",          // ← reemplaza en UltraMsg
  },
  sheetName: "Rutina Comercial",
  horaEnvio:  9,   // 09:00 hrs
  horaReporte: 18, // 18:00 hrs cierre
  horaMediadia: 13, // 13:00 hrs seguimiento

  comerciales: [
    {
      nombre:    "Yordano",
      apodo:     "Perro",
      numero:    "56912345678",  // ← número real con código país, sin +
      estilo:    "cordial",
    },
    {
      nombre:    "Leidy",
      apodo:     "Leidy",
      numero:    "56912345679",  // ← número real con código país, sin +
      estilo:    "dinamico",
    },
    {
      nombre:    "Gonzalo",
      apodo:     "Gonzalo",
      numero:    "56912345680",  // ← número real con código país, sin +
      estilo:    "ejecutivo",
    },
  ],
};

// ── MENSAJES PERSONALIZADOS POR ESTILO Y DÍA ─────────────────
function getMensajeManana(comercial, diaSemana) {
  const focos = {
    1: "oportunidades nuevas",     // Lunes
    2: "seguimiento de cotizaciones", // Martes
    3: "clientes dormidos o antiguos", // Miércoles
    4: "cierres de la semana",     // Jueves
    5: "reporte y proyección",     // Viernes
  };

  const foco = focos[diaSemana] || "gestión comercial";

  const preguntas = {
    1: `• ¿Qué oportunidades nuevas tienes en el radar?\n• ¿A quién vas a contactar hoy?\n• ¿Qué prospecto puedes activar esta semana?\n• ¿Cuál es tu objetivo de la semana?`,
    2: `• ¿Qué cotizaciones tienes pendientes de seguimiento?\n• ¿Alguien no ha respondido que puedas empujar hoy?\n• ¿Qué monto tienes en cotizaciones enviadas?\n• ¿Cuál tiene mayor probabilidad de cerrarse?`,
    3: `• ¿Qué cliente no has contactado en más de 2 semanas?\n• ¿Hay algún cliente antiguo que puedas reactivar hoy?\n• ¿Qué servicio nuevo podrías ofrecerle a un cliente existente?\n• ¿Cuántos clientes del portafolio tienes activos este mes?`,
    4: `• ¿Qué cotización puede cerrarse HOY o mañana?\n• ¿Qué necesita empuje para cruzar la línea?\n• ¿Qué apoyo necesitas de mi parte para cerrar?\n• ¿Cuánto tienes proyectado cerrar esta semana?`,
    5: `• ¿Cuántos clientes contactaste esta semana?\n• ¿Cuántas cotizaciones emitiste y por qué monto?\n• ¿Qué negocios cerraste o están a punto de cerrarse?\n• ¿Cuáles son tus 3 focos de la próxima semana?`,
  };

  const bloquePreguntas = preguntas[diaSemana] || preguntas[2];

  if (comercial.estilo === "cordial") {
    return `Buen día ${comercial.apodo} 👊

¿Cómo estás? Espero que bien.

Hoy el foco está en *${foco}*, así que necesito visibilidad rápida:

${bloquePreguntas}

Cuéntame cómo estás y qué ves con opciones reales.

Quedo atento. Vamos a mover esto.`;
  }

  if (comercial.estilo === "dinamico") {
    return `Buen día ${comercial.apodo} ⚡

Cierre de foco: *${foco}*.

Necesito tu reporte rápido:

${bloquePreguntas}

Hay plata ahí afuera, hay que ir a buscarla. Dame los números.

Quedo atenta a tus avances 💪`;
  }

  if (comercial.estilo === "ejecutivo") {
    return `Buen día ${comercial.apodo}.

Foco del día: *${foco}*.

Necesito visibilidad de tu gestión:

${bloquePreguntas}

La idea es priorizar lo que tenga mayor impacto y mantener tracción.

Quedo atento.`;
  }

  return `Buen día ${comercial.apodo}.\n\nFoco hoy: *${foco}*.\n\n${bloquePreguntas}\n\nEspero tu reporte.`;
}

function getMensajeSeguimiento(comercial) {
  const opciones = [
    `Oye ${comercial.apodo}, ¿cómo va la mañana? ¿Algún avance concreto que reportar?`,
    `${comercial.apodo} ¿pudiste avanzar en lo de esta mañana? Dame una actualización rápida.`,
    `¿Cómo vas ${comercial.apodo}? ¿Contactaste a alguien? ¿Algo concreto que reportar?`,
  ];
  return opciones[Math.floor(Math.random() * opciones.length)];
}

function getMensajeCierre(comercial) {
  return `Cierre del día ${comercial.apodo} 📋

Necesito el resumen:

• Clientes contactados hoy:
• Cotizaciones emitidas:
• Monto estimado en cotizaciones:
• Negocios con opción de cierre:
• Próxima acción más importante:

Sin datos no hay gestión. Dame los números.`;
}

// ── ENVÍO VÍA ULTRAMSG ────────────────────────────────────────
function enviarWhatsApp(numero, mensaje) {
  const url = `https://api.ultramsg.com/${CONFIG.ultraMsg.instanceId}/messages/chat`;
  const payload = {
    token: CONFIG.ultraMsg.token,
    to:    `+${numero}`,
    body:  mensaje,
  };

  const options = {
    method:      "post",
    contentType: "application/x-www-form-urlencoded",
    payload:     Object.entries(payload)
                   .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                   .join("&"),
    muteHttpExceptions: true,
  };

  try {
    const resp = UrlFetchApp.fetch(url, options);
    const resultado = JSON.parse(resp.getContentText());
    Logger.log(`✅ Enviado a ${numero}: ${JSON.stringify(resultado)}`);
    return resultado;
  } catch (e) {
    Logger.log(`❌ Error enviando a ${numero}: ${e.message}`);
    return null;
  }
}

// ── REGISTRO EN GOOGLE SHEETS ─────────────────────────────────
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.sheetName);
    const headers = [
      "Fecha", "Comercial", "Tipo", "Mensaje enviado",
      "Respuesta", "Timestamp respuesta",
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight("bold")
         .setBackground("#1a73e8")
         .setFontColor("#ffffff");
  }
  return sheet;
}

function registrarEnvio(comercial, tipo, mensaje) {
  const sheet = getSheet();
  sheet.appendRow([
    new Date().toLocaleDateString("es-CL"),
    comercial.nombre,
    tipo,
    mensaje,
    "",
    "",
  ]);
}

// ── SHEET KPI SEMANAL ─────────────────────────────────────────
function getSheetKPI() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("KPI Semanal");
  if (!sheet) {
    sheet = ss.insertSheet("KPI Semanal");
    const headers = [
      "Semana", "Comercial",
      "Clientes contactados", "Cotizaciones", "Monto estimado",
      "Cierres", "Reuniones", "Nota",
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight("bold")
         .setBackground("#34a853")
         .setFontColor("#ffffff");
  }
  return sheet;
}

// ── TRIGGERS PRINCIPALES ──────────────────────────────────────

/** Se ejecuta todos los días a las 09:00 — envía mensaje de mañana */
function enviarRutinaManana() {
  const hoy = new Date();
  const dia = hoy.getDay(); // 0=Dom, 1=Lun … 5=Vie, 6=Sab

  if (dia === 0 || dia === 6) {
    Logger.log("Fin de semana — no se envía rutina.");
    return;
  }

  CONFIG.comerciales.forEach((c) => {
    const msg = getMensajeManana(c, dia);
    enviarWhatsApp(c.numero, msg);
    registrarEnvio(c, "Mañana", msg);
    Utilities.sleep(1500); // pausa para no saturar la API
  });

  Logger.log("✅ Rutina matutina enviada.");
}

/** Se ejecuta a las 13:00 — seguimiento de mediodía */
function enviarSeguimientoMedioDia() {
  const hoy = new Date();
  const dia = hoy.getDay();
  if (dia === 0 || dia === 6) return;

  CONFIG.comerciales.forEach((c) => {
    const msg = getMensajeSeguimiento(c);
    enviarWhatsApp(c.numero, msg);
    registrarEnvio(c, "Seguimiento", msg);
    Utilities.sleep(1500);
  });

  Logger.log("✅ Seguimiento de mediodía enviado.");
}

/** Se ejecuta a las 18:00 — cierre del día */
function enviarCierreDia() {
  const hoy = new Date();
  const dia = hoy.getDay();
  if (dia === 0 || dia === 6) return;

  CONFIG.comerciales.forEach((c) => {
    const msg = getMensajeCierre(c);
    enviarWhatsApp(c.numero, msg);
    registrarEnvio(c, "Cierre", msg);
    Utilities.sleep(1500);
  });

  Logger.log("✅ Cierre del día enviado.");
}

/** Viernes 17:00 — reporte semanal al jefe (a ti) */
function enviarResumenSemanalJefe(numeroJefe) {
  const hoy = new Date();
  if (hoy.getDay() !== 5) return; // solo viernes

  const semana = Utilities.formatDate(hoy, "America/Santiago", "dd/MM/yyyy");
  const sheet  = getSheetKPI();
  const datos  = sheet.getDataRange().getValues();

  let resumen = `📊 *Resumen Comercial — Semana ${semana}*\n\n`;

  CONFIG.comerciales.forEach((c) => {
    const filas = datos.filter(
      (r) => r[1] === c.nombre && r[0] === semana
    );
    if (filas.length > 0) {
      const f = filas[0];
      resumen += `*${c.nombre}*\n`;
      resumen += `  Clientes: ${f[2] || "-"}\n`;
      resumen += `  Cotizaciones: ${f[3] || "-"}\n`;
      resumen += `  Monto: ${f[4] || "-"}\n`;
      resumen += `  Cierres: ${f[5] || "-"}\n\n`;
    } else {
      resumen += `*${c.nombre}*: sin datos registrados\n\n`;
    }
  });

  resumen += `_Rutina WSS — generado automáticamente_`;

  if (numeroJefe) {
    enviarWhatsApp(numeroJefe, resumen);
  }
  Logger.log("✅ Resumen semanal enviado.");
}

// ── CONFIGURACIÓN DE TRIGGERS AUTOMÁTICOS ────────────────────
/**
 * Ejecutar UNA SOLA VEZ para instalar los triggers automáticos.
 * Ve a: Extensiones > Apps Script > ejecuta configurarTriggers()
 */
function configurarTriggers() {
  // Elimina triggers anteriores para evitar duplicados
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));

  // Rutina mañana: 09:00
  ScriptApp.newTrigger("enviarRutinaManana")
    .timeBased()
    .everyDays(1)
    .atHour(CONFIG.horaEnvio)
    .create();

  // Seguimiento mediodía: 13:00
  ScriptApp.newTrigger("enviarSeguimientoMedioDia")
    .timeBased()
    .everyDays(1)
    .atHour(CONFIG.horaMediadia)
    .create();

  // Cierre del día: 18:00
  ScriptApp.newTrigger("enviarCierreDia")
    .timeBased()
    .everyDays(1)
    .atHour(CONFIG.horaReporte)
    .create();

  Logger.log("✅ Triggers configurados: 09:00, 13:00 y 18:00 de lunes a viernes.");
}

// ── TEST MANUAL ───────────────────────────────────────────────
/** Ejecutar para probar sin esperar el trigger */
function testEnvioManual() {
  const comercial = CONFIG.comerciales[0]; // Yordano
  const msg = getMensajeManana(comercial, new Date().getDay());
  Logger.log("--- MENSAJE DE PRUEBA ---");
  Logger.log(msg);
  // Descomenta la línea siguiente cuando tengas las credenciales UltraMsg:
  // enviarWhatsApp(comercial.numero, msg);
}
