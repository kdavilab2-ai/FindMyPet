const bcrypt = require('bcryptjs');
const { una, consulta, transaccion } = require('../lib/db');
const { ErrorHttp } = require('../middlewares/errores');
const { TIPO, TIPO_NOTIFICACION } = require('../lib/constantes');
const { entero } = require('../lib/validar');
const { ID_SESION, avisoSeguridad } = require('../lib/sesiones');
const { JSON_UBICACION, JOIN_UBICACION } = require('../lib/ubicacion');
const { SELECT_PUBLICACION } = require('./publicaciones.controller');

// RNF-19 y RNF-21: configuración y metadatos de sesiones de la cuenta autenticada.
async function obtener(req, res) {
  const { id, idSesion } = req.usuario;
  const [preferencias, sesiones] = await Promise.all([
    una('SELECT avisar_accesos FROM usuario WHERE id_usuario = $1', [id]),
    consulta(`SELECT id_sesion AS id, navegador, sistema, iniciada_en, renovada_en, id_sesion = $2 AS actual
      FROM sesion_usuario WHERE id_usuario = $1 AND expira_en > NOW() ORDER BY actual DESC, renovada_en DESC`, [id, idSesion]),
  ]);
  res.json({ ...preferencias, sesiones });
}

async function revocar(req, res) {
  const destino = req.params.id;
  if (destino && (!ID_SESION.test(destino) || destino === req.usuario.idSesion)) {
    throw new ErrorHttp(400, 'Seleccione otra sesión');
  }
  const { id, idSesion } = req.usuario;
  await transaccion(async (tx) => {
    await tx.consulta('SELECT id_usuario FROM usuario WHERE id_usuario = $1 FOR UPDATE', [id]);
    const [actual] = await tx.consulta('SELECT 1 FROM sesion_usuario WHERE id_usuario = $1 AND id_sesion = $2 AND expira_en > NOW() FOR UPDATE', [id, idSesion]);
    if (!actual) throw new ErrorHttp(401, 'Debe iniciar sesión');
    const revocadas = await tx.consulta(`DELETE FROM sesion_usuario
      WHERE id_usuario = $1 AND id_sesion <> $2 AND ($3::uuid IS NULL OR id_sesion = $3) AND expira_en > NOW()
      RETURNING id_sesion`, [id, idSesion, destino || null]);
    if (destino && !revocadas.length) throw new ErrorHttp(404, 'Sesión no encontrada');
    if (revocadas.length) await avisoSeguridad(tx.consulta, id, destino ? 'Se cerró otra sesión de tu cuenta.' : 'Se cerraron las demás sesiones de tu cuenta.');
  });
  res.status(204).end();
}

async function notificaciones(req, res) {
  const { avisarAccesos } = req.body;
  if (typeof avisarAccesos !== 'boolean') throw new ErrorHttp(400, 'Selecciona si quieres recibir avisos de nuevos accesos');
  const id = req.usuario.id;
  await transaccion(async (tx) => {
    const cambiadas = await tx.consulta('UPDATE usuario SET avisar_accesos = $1 WHERE id_usuario = $2 AND avisar_accesos <> $1 RETURNING id_usuario', [avisarAccesos, id]);
    if (cambiadas.length) await avisoSeguridad(tx.consulta, id, 'Se actualizaron tus preferencias de avisos por nuevos accesos.');
  });
  res.json({ avisarAccesos });
}

// RNF-05: en reportes de pérdida y hallazgo siempre queda disponible un contacto para usuarios autenticados.
async function contactos(req, res) {
  const datos = await consulta(`SELECT p.id_publicacion AS id, p.nombre_animal, tp.nombre AS tipo, p.id_tipo_contacto_visible,
      json_agg(json_build_object('id', tc.id_tipo_contacto, 'tipo', tc.nombre) ORDER BY tc.id_tipo_contacto) AS canales
    FROM publicacion p JOIN tipo_publicacion tp ON tp.id_tipo = p.id_tipo
    JOIN contacto_publicacion cp USING (id_publicacion) JOIN tipo_contacto tc USING (id_tipo_contacto)
    WHERE p.id_usuario = $1 AND p.id_tipo IN ($2, $3)
    GROUP BY p.id_publicacion, tp.nombre ORDER BY p.fecha_creacion DESC, p.id_publicacion DESC`,
  [req.usuario.id, TIPO.DESAPARECIDA, TIPO.ENCONTRADA]);
  res.json(datos);
}

async function cambiarContacto(req, res) {
  const id = entero(req.params.id, 'Publicación');
  const tipo = req.body.idTipoContactoVisible;
  if (tipo !== null && (!Number.isInteger(tipo) || tipo < 1)) throw new ErrorHttp(400, 'Contacto inválido');
  await transaccion(async (tx) => {
    const [p] = await tx.consulta(`SELECT 1 FROM publicacion
      WHERE id_publicacion = $1 AND id_usuario = $2 AND id_tipo IN ($3, $4) FOR UPDATE`,
    [id, req.usuario.id, TIPO.DESAPARECIDA, TIPO.ENCONTRADA]);
    if (!p) throw new ErrorHttp(404, 'Reporte no encontrado');
    const [canal] = await tx.consulta(`SELECT 1 FROM contacto_publicacion WHERE id_publicacion = $1
      AND ($2::int IS NULL OR id_tipo_contacto = $2) LIMIT 1`, [id, tipo]);
    if (!canal) throw new ErrorHttp(400, 'Elige un contacto registrado en este reporte');
    await tx.consulta('UPDATE publicacion SET id_tipo_contacto_visible = $1 WHERE id_publicacion = $2', [tipo, id]);
  });
  res.json({ idTipoContactoVisible: tipo });
}

async function solicitudes(req, res) {
  res.json(await consulta('SELECT tipo, creada_en FROM solicitud_derecho_cuenta WHERE id_usuario = $1 ORDER BY creada_en DESC', [req.usuario.id]));
}

async function solicitar(req, res) {
  const { tipo, actual, confirmar } = req.body;
  if (!['desactivacion', 'eliminacion'].includes(tipo) || confirmar !== true || typeof actual !== 'string' || !actual) {
    throw new ErrorHttp(400, 'Confirma la solicitud con tu contraseña actual');
  }
  await transaccion(async (tx) => {
    const [u] = await tx.consulta('SELECT contrasena_hash FROM usuario WHERE id_usuario = $1 FOR UPDATE', [req.usuario.id]);
    const [vigente] = await tx.consulta('SELECT 1 FROM sesion_usuario WHERE id_sesion = $1 AND id_usuario = $2 AND expira_en > NOW() FOR UPDATE', [req.usuario.idSesion, req.usuario.id]);
    if (!vigente) throw new ErrorHttp(401, 'Debe iniciar sesión');
    if (!u || !(await bcrypt.compare(actual, u.contrasenaHash))) throw new ErrorHttp(400, 'La contraseña actual es incorrecta');
    const [creada] = await tx.consulta(`INSERT INTO solicitud_derecho_cuenta (id_usuario, tipo) VALUES ($1, $2)
      ON CONFLICT (id_usuario, tipo) DO NOTHING RETURNING id_solicitud`, [req.usuario.id, tipo]);
    if (creada) await avisoSeguridad(tx.consulta, req.usuario.id, tipo === 'eliminacion'
      ? 'Enviaste una solicitud de eliminación de cuenta para revisión.'
      : 'Enviaste una solicitud de desactivación de cuenta para revisión.');
  });
  res.status(202).json({ mensaje: 'Solicitud pendiente de revisión por la administración' });
}

async function retirarSolicitud(req, res) {
  await consulta('DELETE FROM solicitud_derecho_cuenta WHERE id_usuario = $1 AND tipo = $2', [req.usuario.id, req.params.tipo]);
  res.status(204).end();
}

async function solicitudesAdmin(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json(await consulta(`SELECT s.id_solicitud AS id, s.tipo, s.creada_en, u.nombres, u.apellidos, u.correo
    FROM solicitud_derecho_cuenta s JOIN usuario u USING (id_usuario) ORDER BY s.creada_en DESC LIMIT 100`));
}

// RNF-21: exportación de datos propios con campos explícitos. Se excluyen credenciales y mensajes de terceros.
async function descargar(req, res) {
  const { id } = req.usuario;
  const [perfil, consentimientos, publicaciones, contactosPropios, archivos, alerta, refugio, valoraciones, aportes, avisos, sesiones, solicitudesCuenta] = await Promise.all([
    una(`SELECT u.nombres, u.apellidos, u.correo, u.telefono, u.fecha_registro, u.fecha_verificacion,
      u.avisar_accesos, r.nombre AS rol, e.nombre AS estado
      FROM usuario u JOIN rol r USING (id_rol) JOIN estado_cuenta e USING (id_estado_cuenta) WHERE u.id_usuario = $1`, [id]),
    consulta('SELECT version_politica, fecha_aceptacion FROM consentimiento WHERE id_usuario = $1 ORDER BY fecha_aceptacion', [id]),
    consulta(`${SELECT_PUBLICACION} WHERE p.id_usuario = $1 ORDER BY p.fecha_creacion DESC`, [id]),
    consulta(`SELECT cp.id_publicacion, tc.nombre AS tipo, cp.valor,
      (p.id_tipo_contacto_visible IS NULL OR p.id_tipo_contacto_visible = cp.id_tipo_contacto) AS visible
      FROM contacto_publicacion cp JOIN publicacion p USING (id_publicacion) JOIN tipo_contacto tc USING (id_tipo_contacto)
      WHERE p.id_usuario = $1`, [id]),
    consulta(`SELECT m.id_publicacion, t.nombre AS tipo, m.url FROM multimedia m
      JOIN publicacion p USING (id_publicacion) JOIN tipo_multimedia t USING (id_tipo_multimedia)
      WHERE p.id_usuario = $1 ORDER BY m.id_multimedia`, [id]),
    una(`SELECT pa.radio_km, ${JSON_UBICACION} AS ubicacion FROM preferencia_alerta pa
      ${JOIN_UBICACION('pa.id_ubicacion')} WHERE pa.id_usuario = $1`, [id]),
    una(`SELECT rf.nombre, rf.autorizado, ${JSON_UBICACION} AS ubicacion FROM refugio rf
      ${JOIN_UBICACION('rf.id_ubicacion')} WHERE rf.id_usuario = $1`, [id]),
    consulta('SELECT id_refugio, calificacion, comentario, fecha FROM valoracion WHERE id_usuario = $1', [id]),
    consulta('SELECT id_refugio, id_solicitud, monto, detalle, fecha FROM donacion WHERE id_usuario = $1', [id]),
    consulta('SELECT mensaje, leida, fecha FROM notificacion WHERE id_usuario = $1 AND id_tipo_notificacion = $2 ORDER BY fecha DESC', [id, TIPO_NOTIFICACION.SEGURIDAD]),
    consulta('SELECT navegador, sistema, iniciada_en, renovada_en FROM sesion_usuario WHERE id_usuario = $1 AND expira_en > NOW()', [id]),
    consulta('SELECT tipo, creada_en FROM solicitud_derecho_cuenta WHERE id_usuario = $1 ORDER BY creada_en DESC', [id]),
  ]);
  const agrupar = (filas) => {
    const porPublicacion = new Map();
    for (const { idPublicacion, ...dato } of filas) {
      if (!porPublicacion.has(idPublicacion)) porPublicacion.set(idPublicacion, []);
      porPublicacion.get(idPublicacion).push(dato);
    }
    return porPublicacion;
  };
  const porContacto = agrupar(contactosPropios);
  const porArchivo = agrupar(archivos);
  const reportes = publicaciones.map(({ idUsuario, ...p }) => ({
    ...p, contactos: porContacto.get(p.id) || [], multimedia: porArchivo.get(p.id) || [],
  }));
  res.attachment('findmypet-mis-datos.json').json({
    generadoEn: new Date().toISOString(), perfil, consentimientos, publicaciones: reportes,
    alertaProximidad: alerta, refugio, valoraciones, aportes, avisosSeguridad: avisos, sesiones, solicitudesCuenta,
  });
}

module.exports = { obtener, revocar, notificaciones, contactos, cambiarContacto, descargar, solicitudes, solicitar, retirarSolicitud, solicitudesAdmin };
