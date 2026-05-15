# Rutina Comercial Diaria — WSS
Sistema automático de mensajes WhatsApp para equipo comercial.

## Qué hace
- **09:00** → mensaje personalizado a cada comercial según el día de la semana
- **13:00** → seguimiento de mediodía (pregunta rápida de avance)
- **18:00** → solicitud de cierre del día con números reales
- **Viernes 17:00** → resumen semanal a ti

Cada comercial recibe un mensaje con su tono:
- Yordano "Perro" → cordial con exigencia elegante
- Leidy → dinámico, orientado a cierres y plata
- Gonzalo → ejecutivo, entre pares

---

## Paso 1 — Crear cuenta UltraMsg
1. Ir a [ultramsg.com](https://ultramsg.com)
2. Registrarte y crear una instancia
3. Conectar tu WhatsApp escaneando el QR
4. Copiar el **Instance ID** y el **Token**

---

## Paso 2 — Crear Google Sheet
1. Crear un Google Sheet nuevo
2. Nombrar el archivo: `Rutina Comercial WSS`
3. Ir a **Extensiones > Apps Script**
4. Eliminar el código que trae por defecto
5. Pegar todo el contenido de `Code.gs`

---

## Paso 3 — Configurar en el script
En la sección `CONFIG` al inicio del archivo, reemplaza:

```javascript
ultraMsg: {
  instanceId: "TU_INSTANCE_ID",   // ← el de UltraMsg
  token:      "TU_TOKEN",          // ← el de UltraMsg
},

comerciales: [
  { nombre: "Yordano", apodo: "Perro",   numero: "56912345678" },
  { nombre: "Leidy",   apodo: "Leidy",   numero: "56912345679" },
  { nombre: "Gonzalo", apodo: "Gonzalo", numero: "56912345680" },
],
```

**Formato del número:** código de país + número, sin +  
Ejemplo Chile: `56912345678` (56 + 9 + 8 dígitos)

---

## Paso 4 — Probar antes de activar
1. En Apps Script, selecciona la función `testEnvioManual`
2. Haz clic en **Ejecutar**
3. Revisa el log (Ver > Registros)
4. Si el mensaje se ve bien, descomenta la línea de envío

---

## Paso 5 — Activar triggers automáticos
1. En Apps Script, selecciona la función `configurarTriggers`
2. Haz clic en **Ejecutar**
3. Autoriza los permisos que pida Google
4. Verifica en **Activadores (Triggers)** que queden 3 programados

Listo. El sistema corre solo de lunes a viernes.

---

## Estructura del Google Sheet

### Hoja "Rutina Comercial"
| Fecha | Comercial | Tipo | Mensaje enviado | Respuesta | Timestamp respuesta |
|-------|-----------|------|-----------------|-----------|---------------------|

### Hoja "KPI Semanal"
| Semana | Comercial | Clientes contactados | Cotizaciones | Monto estimado | Cierres | Reuniones | Nota |
|--------|-----------|----------------------|--------------|----------------|---------|-----------|------|

Puedes llenar el KPI semanal a mano o pedirle a cada comercial que lo complete vía formulario Google Forms vinculado al sheet.

---

## Focos por día
| Día | Foco comercial |
|-----|---------------|
| Lunes | Oportunidades nuevas y prospección |
| Martes | Seguimiento de cotizaciones enviadas |
| Miércoles | Clientes dormidos o antiguos |
| Jueves | Cierres de la semana |
| Viernes | Reporte: cotizado, vendido, pendiente, trabas |

---

## Costo estimado
- Google Sheets + Apps Script: **$0**
- UltraMsg: desde **$10 USD/mes** (plan básico sirve)
- Total: menos de un café al día por tener un sistema de control comercial funcionando
