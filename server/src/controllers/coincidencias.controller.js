const { consulta, una } = require('../lib/db');
const { ErrorHttp } = require('../middlewares/errores');
const { entero } = require('../lib/validar');
const { ESTADO_COINCIDENCIA, TIPO_NOTIFICACION, TIPO } = require('../lib/constantes');
const servicio = require('../services/coincidencias.service');

const RESUMEN = (alias) => `json_build_object(
  'id', ${alias}.id_publicacion, 'nombre', ${alias}.nombre_animal, 'descripcion', ${alias}.descripcion,
  'especie', (SELECT nombre FROM especie WHERE id_especie = ${alias}.id_especie),
  'raza', (SELECT nombre FROM raza WHERE id_raza = ${alias}.id_raza),
  'foto', (SELECT m.url FROM multimedia m WHERE m.id_publicacion = ${alias}.id_publicacion AND m.id_tipo_multimedia = 1 ORDER BY m.id_multimedia LIMIT 1),
  'fechaEvento', (SELECT fecha_evento FROM reporte WHERE id_publicacion = ${alias}.id_publicacion),
  'sector', (SELECT s.nombre || ', ' || c.nombre FROM reporte r JOIN ubicacion u ON u.id_ubicacion = r.id_ubicacion
             JOIN sector s ON s.id_sector = u.id_sector JOIN canton c ON c.id_canton = s.id_canton
             WHERE r.id_publicacion = ${alias}.id_publicacion))`;

// RF-10, RF-11: coincidencias sugeridas para los reportes del usuario
async function misCoincidencias(req, res) {
  const filtro = req.query.publicacion ? 'AND (d.id_publicacion = $2 OR f.id_publicacion = $2)' : '';
  const params = [req.usuario.id];
  if (filtro) params.push(entero(req.query.publicacion));
  const datos = await consulta(
    `SELECT co.id_coincidencia AS id, co.porcentaje::float, co.fecha_analisis, ec.nombre AS estado, co.id_estado,
            (d.id_usuario = $1) AS soy_propietario,
            ${RESUMEN('d')} AS desaparecida, ${RESUMEN('f')} AS encontrada,
            (SELECT json_agg(json_build_object('criterio', ci.nombre, 'puntaje', cc.puntaje::float) ORDER BY ci.id_criterio)
             FROM coincidencia_criterio cc JOIN criterio_ia ci ON ci.id_criterio = cc.id_criterio
             WHERE cc.id_coincidencia = co.id_coincidencia) AS criterios
     FROM coincidencia co
     JOIN estado_coincidencia ec ON ec.id_estado = co.id_estado
     JOIN publicacion d ON d.id_publicacion = co.id_desaparecida
     JOIN publicacion f ON f.id_publicacion = co.id_encontrada
     WHERE (d.id_usuario = $1 OR (f.id_usuario = $1 AND co.id_estado = ${ESTADO_COINCIDENCIA.CONFIRMADA})) ${filtro}
     ORDER BY co.id_estado, co.porcentaje DESC`,
    params,
  );
  res.json(datos);
}

// CU-08: el propietario confirma o descarta la sugerencia
async function responder(req, res) {
  const id = entero(req.params.id);
  const idEstado = entero(req.body.idEstado, 'Estado');
  if (![ESTADO_COINCIDENCIA.CONFIRMADA, ESTADO_COINCIDENCIA.DESCARTADA].includes(idEstado)) {
    throw new ErrorHttp(400, 'Solo puede confirmar o descartar la coincidencia');
  }
  const co = await una(
    `SELECT co.id_coincidencia, co.id_encontrada, d.id_usuario AS propietario, d.nombre_animal, f.id_usuario AS hallador
     FROM coincidencia co JOIN publicacion d ON d.id_publicacion = co.id_desaparecida
     JOIN publicacion f ON f.id_publicacion = co.id_encontrada WHERE co.id_coincidencia = $1`,
    [id],
  );
  if (!co) throw new ErrorHttp(404, 'Coincidencia no encontrada');
  if (co.propietario !== req.usuario.id) throw new ErrorHttp(403, 'Solo el propietario de la mascota puede responder');
  await consulta('UPDATE coincidencia SET id_estado = $1 WHERE id_coincidencia = $2', [idEstado, id]);
  if (idEstado === ESTADO_COINCIDENCIA.CONFIRMADA) {
    await consulta(
      'INSERT INTO notificacion (id_usuario, id_publicacion, id_tipo_notificacion, mensaje) VALUES ($1, $2, $3, $4)',
      [co.hallador, co.idEncontrada, TIPO_NOTIFICACION.COINCIDENCIA,
        `El propietario de ${co.nombreAnimal || 'una mascota'} cree que el animal que encontraste es suyo. Revisa tus notificaciones y contactos`],
    );
  }
  res.json({ id, idEstado });
}

// Ejecuta el análisis a pedido del autor del reporte (por ejemplo, para el video o la demo)
async function analizar(req, res) {
  const id = entero(req.params.id);
  const p = await una('SELECT id_usuario, id_tipo FROM publicacion WHERE id_publicacion = $1', [id]);
  if (!p) throw new ErrorHttp(404, 'Publicación no encontrada');
  if (p.idUsuario !== req.usuario.id && !req.usuario.esAdmin) throw new ErrorHttp(403, 'No puede analizar reportes de otros usuarios');
  if (p.idTipo === TIPO.ADOPCION) throw new ErrorHttp(400, 'Las publicaciones de adopción no se comparan');
  const nuevas = await servicio.analizarReporte(id);
  res.json({ nuevas });
}

module.exports = { misCoincidencias, responder, analizar };
