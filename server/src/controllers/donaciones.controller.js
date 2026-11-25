// RF-25: solicitudes de donaciones o insumos de los refugios y registro de aportes.
// No incluye pagos en línea (exclusión del alcance): el aporte se registra y se coordina con el refugio.
const { consulta, una } = require('../lib/db');
const { ErrorHttp } = require('../middlewares/errores');
const { texto, entero } = require('../lib/validar');
const { ESTADO_SOLICITUD } = require('../lib/constantes');

const SELECT_SOLICITUD = `
  SELECT sd.id_solicitud AS id, sd.titulo, sd.descripcion, sd.fecha, sd.id_estado_solicitud, es.nombre AS estado,
         rf.id_refugio, rf.nombre AS refugio,
         (SELECT COUNT(*)::int FROM donacion d WHERE d.id_solicitud = sd.id_solicitud) AS aportes,
         (SELECT COALESCE(SUM(d.monto), 0)::float FROM donacion d WHERE d.id_solicitud = sd.id_solicitud) AS total_monto
  FROM solicitud_donacion sd
  JOIN estado_solicitud es ON es.id_estado_solicitud = sd.id_estado_solicitud
  JOIN refugio rf ON rf.id_refugio = sd.id_refugio`;

async function listarAbiertas(req, res) {
  res.json(await consulta(`${SELECT_SOLICITUD} WHERE sd.id_estado_solicitud = $1 AND rf.autorizado ORDER BY sd.fecha DESC`, [ESTADO_SOLICITUD.ABIERTA]));
}

function exigirRefugioAutorizado(req) {
  if (!req.usuario.idRefugio) throw new ErrorHttp(403, 'Solo los refugios pueden gestionar solicitudes de donación');
  if (!req.usuario.refugioAutorizado) throw new ErrorHttp(403, 'Su refugio aún no ha sido autorizado por el administrador');
}

async function misSolicitudes(req, res) {
  exigirRefugioAutorizado(req);
  const solicitudes = await consulta(`${SELECT_SOLICITUD} WHERE sd.id_refugio = $1 ORDER BY sd.fecha DESC`, [req.usuario.idRefugio]);
  for (const s of solicitudes) {
    s.detalleAportes = await consulta(
      `SELECT d.id_donacion AS id, d.monto::float, d.detalle, d.fecha, u.nombres || ' ' || u.apellidos AS donante, u.correo, u.telefono
       FROM donacion d JOIN usuario u ON u.id_usuario = d.id_usuario WHERE d.id_solicitud = $1 ORDER BY d.fecha DESC`,
      [s.id],
    );
  }
  res.json(solicitudes);
}

async function crear(req, res) {
  exigirRefugioAutorizado(req);
  const titulo = texto(req.body.titulo);
  const descripcion = texto(req.body.descripcion);
  if (titulo.length < 5) throw new ErrorHttp(400, 'El título debe tener al menos 5 caracteres');
  if (descripcion.length < 10) throw new ErrorHttp(400, 'Describa qué necesita el refugio (mínimo 10 caracteres)');
  const s = await una(
    'INSERT INTO solicitud_donacion (id_refugio, titulo, descripcion) VALUES ($1, $2, $3) RETURNING id_solicitud',
    [req.usuario.idRefugio, titulo.slice(0, 100), descripcion.slice(0, 2000)],
  );
  res.status(201).json(await una(`${SELECT_SOLICITUD} WHERE sd.id_solicitud = $1`, [s.idSolicitud]));
}

async function cambiarEstado(req, res) {
  exigirRefugioAutorizado(req);
  const id = entero(req.params.id);
  const idEstado = entero(req.body.idEstado, 'Estado');
  if (!Object.values(ESTADO_SOLICITUD).includes(idEstado)) throw new ErrorHttp(400, 'Estado inválido');
  const s = await una('UPDATE solicitud_donacion SET id_estado_solicitud = $1 WHERE id_solicitud = $2 AND id_refugio = $3 RETURNING id_solicitud', [idEstado, id, req.usuario.idRefugio]);
  if (!s) throw new ErrorHttp(404, 'Solicitud no encontrada');
  res.json(await una(`${SELECT_SOLICITUD} WHERE sd.id_solicitud = $1`, [id]));
}

async function aportar(req, res) {
  const id = entero(req.params.id);
  const s = await una(
    `SELECT sd.id_refugio, sd.id_estado_solicitud, rf.id_usuario FROM solicitud_donacion sd
     JOIN refugio rf ON rf.id_refugio = sd.id_refugio WHERE sd.id_solicitud = $1`,
    [id],
  );
  if (!s) throw new ErrorHttp(404, 'Solicitud no encontrada');
  if (s.idEstadoSolicitud !== ESTADO_SOLICITUD.ABIERTA) throw new ErrorHttp(400, 'La solicitud ya está cerrada');
  if (s.idUsuario === req.usuario.id) throw new ErrorHttp(400, 'No puede aportar a su propio refugio');
  const detalle = texto(req.body.detalle).slice(0, 255) || null;
  let monto = null;
  if (req.body.monto !== undefined && req.body.monto !== '' && req.body.monto !== null) {
    monto = Number(req.body.monto);
    if (!Number.isFinite(monto) || monto <= 0 || monto > 100000) throw new ErrorHttp(400, 'Monto inválido');
    monto = Math.round(monto * 100) / 100;
  }
  if (monto === null && !detalle) throw new ErrorHttp(400, 'Indique un monto o describa los insumos que aportará');
  const d = await una(
    `INSERT INTO donacion (id_usuario, id_refugio, id_solicitud, monto, detalle) VALUES ($1, $2, $3, $4, $5)
     RETURNING id_donacion AS id, monto::float, detalle, fecha`,
    [req.usuario.id, s.idRefugio, id, monto, detalle],
  );
  res.status(201).json(d);
}

module.exports = { listarAbiertas, misSolicitudes, crear, cambiarEstado, aportar };
