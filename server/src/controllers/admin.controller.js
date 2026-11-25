// RF-17, CU-03, CU-13, CU-14: administración. RNF-22: cada acción queda registrada (moderacion, control_cuenta).
const { consulta, una, transaccion } = require('../lib/db');
const { ErrorHttp } = require('../middlewares/errores');
const { texto, entero } = require('../lib/validar');
const { ESTADO_CUENTA, ESTADOS_POR_TIPO, TIPO_ACCION, TIPO_NOTIFICACION } = require('../lib/constantes');
const { SELECT_PUBLICACION } = require('./publicaciones.controller');

function motivoObligatorio(body) {
  const motivo = texto(body.motivo);
  if (motivo.length < 5) throw new ErrorHttp(400, 'Indique el motivo (mínimo 5 caracteres)');
  return motivo.slice(0, 255);
}

const notificar = (ejecutar, idUsuario, idPublicacion, tipo, mensaje) => ejecutar(
  'INSERT INTO notificacion (id_usuario, id_publicacion, id_tipo_notificacion, mensaje) VALUES ($1, $2, $3, $4)',
  [idUsuario, idPublicacion, tipo, mensaje.slice(0, 255)],
);

async function estadisticas(req, res) {
  const [porEstado, porRol, refugios, coincidencias, [moderaciones]] = await Promise.all([
    consulta(`SELECT tp.nombre AS tipo, ep.nombre AS estado, COUNT(p.id_publicacion)::int AS total
              FROM estado_publicacion ep JOIN tipo_publicacion tp ON tp.id_tipo = ep.id_tipo
              LEFT JOIN publicacion p ON p.id_estado = ep.id_estado GROUP BY tp.id_tipo, tp.nombre, ep.id_estado, ep.nombre
              ORDER BY ep.id_estado`),
    consulta(`SELECT r.nombre AS rol, COUNT(u.id_usuario)::int AS total FROM rol r
              LEFT JOIN usuario u ON u.id_rol = r.id_rol GROUP BY r.id_rol, r.nombre ORDER BY r.id_rol`),
    una('SELECT COUNT(*) FILTER (WHERE NOT autorizado)::int AS pendientes, COUNT(*)::int AS total FROM refugio'),
    consulta(`SELECT ec.nombre AS estado, COUNT(co.id_coincidencia)::int AS total FROM estado_coincidencia ec
              LEFT JOIN coincidencia co ON co.id_estado = ec.id_estado GROUP BY ec.id_estado, ec.nombre ORDER BY ec.id_estado`),
    consulta('SELECT COUNT(*)::int AS total FROM moderacion'),
  ]);
  res.json({ porEstado, porRol, refugios, coincidencias, moderaciones: moderaciones.total });
}

async function usuarios(req, res) {
  res.json(await consulta(
    `SELECT u.id_usuario AS id, u.nombres, u.apellidos, u.correo, u.telefono, u.id_rol, r.nombre AS rol,
            u.id_estado_cuenta, ec.nombre AS estado, u.fecha_registro,
            rf.id_refugio, rf.nombre AS refugio, rf.autorizado,
            (SELECT COUNT(*)::int FROM publicacion p WHERE p.id_usuario = u.id_usuario) AS publicaciones
     FROM usuario u JOIN rol r ON r.id_rol = u.id_rol JOIN estado_cuenta ec ON ec.id_estado_cuenta = u.id_estado_cuenta
     LEFT JOIN refugio rf ON rf.id_usuario = u.id_usuario
     ORDER BY u.fecha_registro DESC, u.id_usuario DESC`,
  ));
}

// CU-13: suspender, bloquear o reactivar una cuenta
async function cambiarEstadoCuenta(req, res) {
  const id = entero(req.params.id);
  const idEstado = entero(req.body.idEstado, 'Estado');
  if (!Object.values(ESTADO_CUENTA).includes(idEstado)) throw new ErrorHttp(400, 'Estado de cuenta inválido');
  if (id === req.usuario.id) throw new ErrorHttp(400, 'No puede cambiar el estado de su propia cuenta');
  const motivo = motivoObligatorio(req.body);
  const u = await una('SELECT id_usuario FROM usuario WHERE id_usuario = $1', [id]);
  if (!u) throw new ErrorHttp(404, 'Usuario no encontrado');
  await transaccion(async (tx) => {
    await tx.consulta('UPDATE usuario SET id_estado_cuenta = $1 WHERE id_usuario = $2', [idEstado, id]);
    await tx.consulta(
      'INSERT INTO control_cuenta (id_admin, id_usuario, id_estado_nuevo, motivo) VALUES ($1, $2, $3, $4)',
      [req.usuario.id, id, idEstado, motivo],
    );
  });
  res.json({ id, idEstado });
}

// Autorizar refugios para publicar adopciones y pedir donaciones
async function autorizarRefugio(req, res) {
  const id = entero(req.params.id);
  const autorizado = req.body.autorizado === true;
  const rf = await una('UPDATE refugio SET autorizado = $1 WHERE id_refugio = $2 RETURNING id_usuario, nombre', [autorizado, id]);
  if (!rf) throw new ErrorHttp(404, 'Refugio no encontrado');
  const u = await una('SELECT id_estado_cuenta FROM usuario WHERE id_usuario = $1', [rf.idUsuario]);
  await transaccion(async (tx) => {
    await tx.consulta(
      'INSERT INTO control_cuenta (id_admin, id_usuario, id_estado_nuevo, motivo) VALUES ($1, $2, $3, $4)',
      [req.usuario.id, rf.idUsuario, u.idEstadoCuenta, autorizado ? 'Refugio autorizado' : 'Autorización de refugio retirada'],
    );
    await notificar(tx.consulta, rf.idUsuario, null, TIPO_NOTIFICACION.CUENTA,
      autorizado ? `¡${rf.nombre} fue autorizado! Ya puede publicar adopciones y solicitudes de donación` : `Se retiró la autorización de ${rf.nombre}`);
  });
  res.json({ id, autorizado });
}

async function publicaciones(req, res) {
  res.json(await consulta(
    `SELECT x.*, u.nombres || ' ' || u.apellidos AS autor, u.correo AS correo_autor,
       (SELECT COUNT(*)::int FROM moderacion mo WHERE mo.id_publicacion = x.id AND mo.id_tipo_accion = 2) AS advertencias
     FROM (${SELECT_PUBLICACION}) x JOIN usuario u ON u.id_usuario = x.id_usuario
     ORDER BY x.fecha_creacion DESC, x.id DESC`,
  ));
}

// CU-14: eliminar publicación inadecuada
async function eliminarPublicacion(req, res) {
  const id = entero(req.params.id);
  const motivo = motivoObligatorio(req.body);
  const p = await una('SELECT id_usuario, nombre_animal FROM publicacion WHERE id_publicacion = $1', [id]);
  if (!p) throw new ErrorHttp(404, 'Publicación no encontrada');
  await transaccion(async (tx) => {
    await tx.consulta(
      'INSERT INTO moderacion (id_admin, id_publicacion, id_tipo_accion, motivo) VALUES ($1, $2, $3, $4)',
      [req.usuario.id, id, TIPO_ACCION.ELIMINAR, `${motivo} [${p.nombreAnimal || 'sin nombre'} #${id}]`.slice(0, 255)],
    );
    await notificar(tx.consulta, p.idUsuario, null, TIPO_NOTIFICACION.MODERACION,
      `Tu publicación de ${p.nombreAnimal || 'un animal'} fue eliminada por un administrador. Motivo: ${motivo}`);
    await tx.consulta('DELETE FROM publicacion WHERE id_publicacion = $1', [id]);
  });
  res.status(204).end();
}

// CU-14: enviar advertencia
async function advertir(req, res) {
  const id = entero(req.params.id);
  const motivo = motivoObligatorio(req.body);
  const p = await una('SELECT id_usuario, nombre_animal FROM publicacion WHERE id_publicacion = $1', [id]);
  if (!p) throw new ErrorHttp(404, 'Publicación no encontrada');
  await transaccion(async (tx) => {
    await tx.consulta('INSERT INTO moderacion (id_admin, id_publicacion, id_tipo_accion, motivo) VALUES ($1, $2, $3, $4)', [req.usuario.id, id, TIPO_ACCION.ADVERTENCIA, motivo]);
    await notificar(tx.consulta, p.idUsuario, id, TIPO_NOTIFICACION.MODERACION, `Advertencia sobre tu publicación de ${p.nombreAnimal || 'un animal'}: ${motivo}`);
  });
  res.status(201).json({ mensaje: 'Advertencia enviada' });
}

// RF-17: actualizar el estado de una publicación
async function actualizarEstado(req, res) {
  const id = entero(req.params.id);
  const idEstado = entero(req.body.idEstado, 'Estado');
  const motivo = motivoObligatorio(req.body);
  const p = await una('SELECT id_tipo FROM publicacion WHERE id_publicacion = $1', [id]);
  if (!p) throw new ErrorHttp(404, 'Publicación no encontrada');
  if (!ESTADOS_POR_TIPO[p.idTipo].includes(idEstado)) throw new ErrorHttp(400, 'Estado no válido para este tipo');
  await transaccion(async (tx) => {
    await tx.consulta('UPDATE publicacion SET id_estado = $1 WHERE id_publicacion = $2', [idEstado, id]);
    await tx.consulta('INSERT INTO moderacion (id_admin, id_publicacion, id_tipo_accion, motivo) VALUES ($1, $2, $3, $4)', [req.usuario.id, id, TIPO_ACCION.ACTUALIZAR, motivo]);
  });
  res.json({ id, idEstado });
}

// RNF-22: auditoría de acciones administrativas y análisis de IA
async function auditoria(req, res) {
  res.json(await consulta(
    `SELECT * FROM (
       SELECT mo.fecha_hora AS fecha, 'Moderación' AS categoria, ta.nombre AS accion, mo.motivo AS detalle,
              ad.nombres || ' ' || ad.apellidos AS responsable
       FROM moderacion mo JOIN tipo_accion ta ON ta.id_tipo_accion = mo.id_tipo_accion JOIN usuario ad ON ad.id_usuario = mo.id_admin
       UNION ALL
       SELECT cc.fecha_hora, 'Cuenta', ec.nombre, cc.motivo || ' (' || us.correo || ')', ad.nombres || ' ' || ad.apellidos
       FROM control_cuenta cc JOIN estado_cuenta ec ON ec.id_estado_cuenta = cc.id_estado_nuevo
       JOIN usuario ad ON ad.id_usuario = cc.id_admin JOIN usuario us ON us.id_usuario = cc.id_usuario
       UNION ALL
       SELECT co.fecha_analisis, 'IA', 'Coincidencia ' || ec.nombre,
              '#' || co.id_desaparecida || ' vs #' || co.id_encontrada || ' (' || co.porcentaje || ' %)', 'Sistema'
       FROM coincidencia co JOIN estado_coincidencia ec ON ec.id_estado = co.id_estado
     ) a ORDER BY fecha DESC LIMIT 100`,
  ));
}

module.exports = {
  estadisticas, usuarios, cambiarEstadoCuenta, autorizarRefugio, publicaciones, eliminarPublicacion, advertir, actualizarEstado, auditoria,
};
