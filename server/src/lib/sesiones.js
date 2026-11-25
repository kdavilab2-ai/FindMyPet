const { randomUUID } = require('node:crypto');
const { TIPO_NOTIFICACION, TIPO_TOKEN } = require('./constantes');

const MINUTOS_SESION = 30;
const VIGENCIA = `NOW() + INTERVAL '${MINUTOS_SESION} minutes'`;
const ID_SESION = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function identificarDispositivo(agente) {
  const ua = agente || '';
  const navegador = [[/Edg(?:A|iOS)?\//, 'Edge'], [/Firefox\/|FxiOS\//, 'Firefox'], [/Chrome\/|CriOS\//, 'Chrome'], [/Safari\//, 'Safari']]
    .find(([patron]) => patron.test(ua))?.[1] || 'Navegador no identificado';
  const sistema = [[/Android/, 'Android'], [/iPhone|iPad|iPod/, 'iOS'], [/Windows/, 'Windows'], [/Macintosh/, 'macOS'], [/Linux/, 'Linux']]
    .find(([patron]) => patron.test(ua))?.[1] || 'Sistema no identificado';
  return { navegador, sistema };
}

function avisoSeguridad(consultar, idUsuario, mensaje) {
  return consultar('INSERT INTO notificacion (id_usuario, id_tipo_notificacion, mensaje) VALUES ($1, $2, $3)',
    [idUsuario, TIPO_NOTIFICACION.SEGURIDAD, mensaje]);
}

async function iniciarSesion(consultar, idUsuario, agente, avisar) {
  const { navegador, sistema } = identificarDispositivo(agente);
  const idSesion = randomUUID();
  await consultar('DELETE FROM sesion_usuario WHERE id_usuario = $1 AND expira_en <= NOW()', [idUsuario]);
  await consultar(`INSERT INTO sesion_usuario (id_sesion, id_usuario, navegador, sistema, expira_en)
    VALUES ($1, $2, $3, $4, ${VIGENCIA})`, [idSesion, idUsuario, navegador, sistema]);
  if (avisar) await avisoSeguridad(consultar, idUsuario, `Nuevo inicio de sesión. ${navegador} · ${sistema}.`);
  return idSesion;
}

async function invalidarCredenciales(consultar, idUsuario, conservar = null) {
  await consultar('DELETE FROM sesion_usuario WHERE id_usuario = $1 AND id_sesion IS DISTINCT FROM $2::uuid', [idUsuario, conservar]);
  await consultar('UPDATE token_usuario SET fecha_uso = NOW() WHERE id_usuario = $1 AND id_tipo_token = $2 AND fecha_uso IS NULL',
    [idUsuario, TIPO_TOKEN.RECUPERACION]);
}

module.exports = { MINUTOS_SESION, VIGENCIA, ID_SESION, avisoSeguridad, iniciarSesion, invalidarCredenciales };
