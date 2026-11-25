const nodemailer = require('nodemailer');

// En pruebas los correos se guardan aquí en lugar de enviarse
const enviados = [];

let transporte = null;
function obtenerTransporte() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporte) {
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporte;
}

async function enviarCorreo({ para, asunto, html, texto }) {
  if (process.env.NODE_ENV === 'test') {
    enviados.push({ para, asunto, html, texto });
    return;
  }
  const t = obtenerTransporte();
  if (!t) {
    // Sin SMTP configurado (desarrollo): se muestra el contenido en la consola del servidor
    console.log(`\n[correo] Para: ${para}\n[correo] Asunto: ${asunto}\n[correo] ${texto}\n`);
    return;
  }
  await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: para, subject: asunto, html, text: texto });
}

module.exports = { enviarCorreo, enviados };
