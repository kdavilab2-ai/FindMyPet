const { consulta, una } = require('../lib/db');
const { ErrorHttp } = require('../middlewares/errores');
const { texto, entero } = require('../lib/validar');
const { JSON_UBICACION, JOIN_UBICACION } = require('../lib/ubicacion');
const { ESTADO_SOLICITUD } = require('../lib/constantes');

const SELECT_REFUGIO = `
  SELECT rf.id_refugio AS id, rf.nombre, rf.autorizado, ${JSON_UBICACION} AS ubicacion,
         COALESCE((SELECT ROUND(AVG(v.calificacion), 1)::float FROM valoracion v WHERE v.id_refugio = rf.id_refugio), 0) AS promedio,
         (SELECT COUNT(*)::int FROM valoracion v WHERE v.id_refugio = rf.id_refugio) AS valoraciones,
         (SELECT COUNT(*)::int FROM publicacion p WHERE p.id_usuario = rf.id_usuario AND p.id_tipo = 3 AND p.id_estado = 5) AS en_adopcion,
         (SELECT COUNT(*)::int FROM solicitud_donacion sd WHERE sd.id_refugio = rf.id_refugio AND sd.id_estado_solicitud = 1) AS solicitudes_abiertas
  FROM refugio rf
  JOIN usuario u ON u.id_usuario = rf.id_usuario AND u.id_estado_cuenta = 1
  ${JOIN_UBICACION('rf.id_ubicacion')}`;

async function listar(req, res) {
  res.json(await consulta(`${SELECT_REFUGIO} WHERE rf.autorizado ORDER BY promedio DESC, rf.nombre`));
}

async function obtener(req, res) {
  const id = entero(req.params.id);
  const refugio = await una(`${SELECT_REFUGIO} WHERE rf.id_refugio = $1 AND rf.autorizado`, [id]);
  if (!refugio) throw new ErrorHttp(404, 'Refugio no encontrado');
  refugio.resenas = await consulta(
    `SELECT v.id_valoracion AS id, v.calificacion, v.comentario, v.fecha,
            u.nombres || ' ' || LEFT(u.apellidos, 1) || '.' AS autor, (v.id_usuario = $2) AS es_mia
     FROM valoracion v JOIN usuario u ON u.id_usuario = v.id_usuario
     WHERE v.id_refugio = $1 ORDER BY v.fecha DESC`,
    [id, req.usuario?.id || 0],
  );
  refugio.solicitudes = await consulta(
    `SELECT sd.id_solicitud AS id, sd.titulo, sd.descripcion, sd.fecha, es.nombre AS estado,
            (SELECT COUNT(*)::int FROM donacion d WHERE d.id_solicitud = sd.id_solicitud) AS aportes
     FROM solicitud_donacion sd JOIN estado_solicitud es ON es.id_estado_solicitud = sd.id_estado_solicitud
     WHERE sd.id_refugio = $1 AND sd.id_estado_solicitud = $2 ORDER BY sd.fecha DESC`,
    [id, ESTADO_SOLICITUD.ABIERTA],
  );
  res.json(refugio);
}

// RF-24: valorar la atención de un refugio autorizado
async function valorar(req, res) {
  const id = entero(req.params.id);
  const calificacion = entero(req.body.calificacion, 'Calificación');
  if (calificacion > 5) throw new ErrorHttp(400, 'La calificación debe ser de 1 a 5 estrellas');
  const refugio = await una('SELECT id_usuario, autorizado FROM refugio WHERE id_refugio = $1', [id]);
  if (!refugio || !refugio.autorizado) throw new ErrorHttp(404, 'Refugio no encontrado');
  if (refugio.idUsuario === req.usuario.id) throw new ErrorHttp(400, 'No puede valorar su propio refugio');
  const comentario = texto(req.body.comentario).slice(0, 1000) || null;
  const v = await una(
    `INSERT INTO valoracion (id_refugio, id_usuario, calificacion, comentario) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id_refugio, id_usuario) DO UPDATE SET calificacion = EXCLUDED.calificacion,
       comentario = EXCLUDED.comentario, fecha = NOW()
     RETURNING id_valoracion AS id, calificacion, comentario`,
    [id, req.usuario.id, calificacion, comentario],
  );
  res.status(201).json(v);
}

module.exports = { listar, obtener, valorar };
