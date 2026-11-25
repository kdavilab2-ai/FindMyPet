const { consulta } = require('../lib/db');
const { entero } = require('../lib/validar');

async function listar(req, res) {
  const datos = await consulta(
    `SELECT n.id_notificacion AS id, n.id_publicacion, tn.nombre AS tipo, n.id_tipo_notificacion AS id_tipo,
            n.mensaje, n.leida, n.fecha
     FROM notificacion n JOIN tipo_notificacion tn ON tn.id_tipo_notificacion = n.id_tipo_notificacion
     WHERE n.id_usuario = $1 ORDER BY n.fecha DESC, n.id_notificacion DESC LIMIT 50`,
    [req.usuario.id],
  );
  const [{ noLeidas }] = await consulta(
    'SELECT COUNT(*)::int AS no_leidas FROM notificacion WHERE id_usuario = $1 AND NOT leida',
    [req.usuario.id],
  );
  res.json({ datos, noLeidas });
}

async function marcarLeida(req, res) {
  await consulta('UPDATE notificacion SET leida = TRUE WHERE id_notificacion = $1 AND id_usuario = $2', [entero(req.params.id), req.usuario.id]);
  res.status(204).end();
}

async function marcarTodas(req, res) {
  await consulta('UPDATE notificacion SET leida = TRUE WHERE id_usuario = $1', [req.usuario.id]);
  res.status(204).end();
}

module.exports = { listar, marcarLeida, marcarTodas };
