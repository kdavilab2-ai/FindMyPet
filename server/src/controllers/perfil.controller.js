const bcrypt = require('bcryptjs');
const { una, consulta, transaccion } = require('../lib/db');
const { ErrorHttp } = require('../middlewares/errores');
const { leerUbicacion, guardarUbicacion, JSON_UBICACION, JOIN_UBICACION } = require('../lib/ubicacion');
const { REGEX_TELEFONO, texto, requerido, entero, contrasenaSegura } = require('../lib/validar');
const { datosUsuario, sesion } = require('./auth.controller');
const { invalidarCredenciales, avisoSeguridad } = require('../lib/sesiones');

// RF-03: ver perfil
async function obtener(req, res) {
  const usuario = await datosUsuario(req.usuario.id);
  const alerta = await una(
    `SELECT pa.radio_km, ${JSON_UBICACION} AS ubicacion
     FROM preferencia_alerta pa ${JOIN_UBICACION('pa.id_ubicacion')} WHERE pa.id_usuario = $1`,
    [req.usuario.id],
  );
  let refugioUbicacion = null;
  if (usuario.refugio) {
    const fila = await una(`SELECT ${JSON_UBICACION} AS ubicacion FROM refugio rf ${JOIN_UBICACION('rf.id_ubicacion')} WHERE rf.id_refugio = $1`, [usuario.refugio.id]);
    refugioUbicacion = fila.ubicacion;
    usuario.refugio.ubicacion = refugioUbicacion;
  }
  const [{ total }] = await consulta('SELECT COUNT(*)::int AS total FROM publicacion WHERE id_usuario = $1', [req.usuario.id]);
  res.json({ ...usuario, alerta, publicaciones: total });
}

// RF-03: actualizar datos personales (y los del refugio si corresponde)
async function actualizar(req, res) {
  const b = req.body;
  requerido(b, ['nombres', 'apellidos']);
  const telefono = texto(b.telefono) || null;
  if (telefono && !REGEX_TELEFONO.test(telefono)) throw new ErrorHttp(400, 'El teléfono debe tener 10 dígitos y empezar con 0');
  await transaccion(async (tx) => {
    await tx.consulta(
      'UPDATE usuario SET nombres = $1, apellidos = $2, telefono = $3 WHERE id_usuario = $4',
      [texto(b.nombres).slice(0, 80), texto(b.apellidos).slice(0, 80), telefono, req.usuario.id],
    );
    if (req.usuario.idRefugio && b.nombreRefugio !== undefined) {
      if (!texto(b.nombreRefugio)) throw new ErrorHttp(400, 'El nombre del refugio no puede quedar vacío');
      const [rf] = await tx.consulta('SELECT id_ubicacion FROM refugio WHERE id_refugio = $1', [req.usuario.idRefugio]);
      if (b.idSector) await guardarUbicacion(tx.consulta, leerUbicacion(b), rf.idUbicacion);
      await tx.consulta('UPDATE refugio SET nombre = $1 WHERE id_refugio = $2', [texto(b.nombreRefugio).slice(0, 100), req.usuario.idRefugio]);
    }
  });
  res.json(await sesion(req.usuario.id, req.usuario.idSesion));
}

// RF-03 y RNF-19: reautentica el cambio e invalida las demás sesiones y enlaces de recuperación.
async function cambiarContrasena(req, res) {
  const { actual, nueva, confirmar } = req.body;
  if (typeof actual !== 'string' || !actual) throw new ErrorHttp(400, 'Ingrese la contraseña actual');
  contrasenaSegura(nueva);
  if (nueva !== confirmar) throw new ErrorHttp(400, 'Las contraseñas no coinciden');
  const { id, idSesion } = req.usuario;
  await transaccion(async (tx) => {
    const [u] = await tx.consulta('SELECT contrasena_hash FROM usuario WHERE id_usuario = $1 FOR UPDATE', [id]);
    const [vigente] = await tx.consulta('SELECT 1 FROM sesion_usuario WHERE id_sesion = $1 AND id_usuario = $2 AND expira_en > NOW() FOR UPDATE', [idSesion, id]);
    if (!vigente) throw new ErrorHttp(401, 'Debe iniciar sesión');
    if (!u || !(await bcrypt.compare(actual, u.contrasenaHash))) throw new ErrorHttp(400, 'La contraseña actual es incorrecta');
    if (await bcrypt.compare(nueva, u.contrasenaHash)) throw new ErrorHttp(400, 'Elige una contraseña diferente de la actual');
    await tx.consulta('UPDATE usuario SET contrasena_hash = $1 WHERE id_usuario = $2', [await bcrypt.hash(nueva, 10), id]);
    await invalidarCredenciales(tx.consulta, id, idSesion);
    await avisoSeguridad(tx.consulta, id, 'Se cambió la contraseña de tu cuenta y se cerraron las otras sesiones.');
  });
  res.json({ mensaje: 'Contraseña actualizada. Se cerraron las otras sesiones.' });
}

// RF-26: zona y radio para recibir alertas de mascotas desaparecidas cercanas
async function guardarAlerta(req, res) {
  const ubicacion = leerUbicacion(req.body);
  const radioKm = entero(req.body.radioKm || 5, 'Radio');
  if (radioKm > 50) throw new ErrorHttp(400, 'El radio máximo es 50 km');
  await transaccion(async (tx) => {
    const [actual] = await tx.consulta('SELECT id_ubicacion FROM preferencia_alerta WHERE id_usuario = $1', [req.usuario.id]);
    const idUbicacion = await guardarUbicacion(tx.consulta, ubicacion, actual?.idUbicacion);
    await tx.consulta(
      `INSERT INTO preferencia_alerta (id_usuario, id_ubicacion, radio_km) VALUES ($1, $2, $3)
       ON CONFLICT (id_usuario) DO UPDATE SET radio_km = EXCLUDED.radio_km`,
      [req.usuario.id, idUbicacion, radioKm],
    );
  });
  res.json({ mensaje: 'Alertas activadas' });
}

async function quitarAlerta(req, res) {
  await consulta('DELETE FROM preferencia_alerta WHERE id_usuario = $1', [req.usuario.id]);
  res.status(204).end();
}

module.exports = { obtener, actualizar, cambiarContrasena, guardarAlerta, quitarAlerta };
