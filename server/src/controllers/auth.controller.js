const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { una, transaccion } = require('../lib/db');
const { ErrorHttp } = require('../middlewares/errores');
const { firmarToken } = require('../middlewares/auth');
const { enviarCorreo } = require('../lib/correo');
const { leerUbicacion, guardarUbicacion } = require('../lib/ubicacion');
const { REGEX_CORREO, REGEX_TELEFONO, texto, requerido, contrasenaSegura } = require('../lib/validar');
const { ROL, ESTADO_CUENTA, TIPO_TOKEN, VERSION_POLITICA } = require('../lib/constantes');

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

async function sesion(idUsuario) {
  const u = await una(
    `SELECT u.id_usuario, u.id_rol, r.nombre AS rol, u.nombres, u.apellidos, u.correo, u.telefono,
            rf.id_refugio, rf.nombre AS nombre_refugio, rf.autorizado
     FROM usuario u JOIN rol r ON r.id_rol = u.id_rol
     LEFT JOIN refugio rf ON rf.id_usuario = u.id_usuario
     WHERE u.id_usuario = $1`,
    [idUsuario],
  );
  return {
    token: firmarToken(u),
    usuario: {
      id: u.idUsuario, idRol: u.idRol, rol: u.rol, nombres: u.nombres, apellidos: u.apellidos,
      correo: u.correo, telefono: u.telefono,
      refugio: u.idRefugio ? { id: u.idRefugio, nombre: u.nombreRefugio, autorizado: u.autorizado } : null,
    },
  };
}

// RF-01 y RF-19: registro de ciudadano o refugio. RNF-21: consentimiento obligatorio.
async function registro(req, res) {
  const b = req.body;
  requerido(b, ['nombres', 'apellidos', 'correo', 'contrasena']);
  const correo = texto(b.correo).toLowerCase();
  if (!REGEX_CORREO.test(correo)) throw new ErrorHttp(400, 'Correo inválido');
  const contrasena = contrasenaSegura(b.contrasena);
  const telefono = texto(b.telefono) || null;
  if (telefono && !REGEX_TELEFONO.test(telefono)) throw new ErrorHttp(400, 'El teléfono debe tener 10 dígitos y empezar con 0');
  if (b.aceptaPolitica !== true) throw new ErrorHttp(400, 'Debe aceptar la política de tratamiento de datos personales');
  const idRol = b.tipoCuenta === 'REFUGIO' ? ROL.REFUGIO : ROL.CIUDADANO;

  let ubicacionRefugio;
  if (idRol === ROL.REFUGIO) {
    if (!texto(b.nombreRefugio)) throw new ErrorHttp(400, 'Ingrese el nombre del refugio o fundación');
    ubicacionRefugio = leerUbicacion(b);
  }
  if (await una('SELECT 1 FROM usuario WHERE correo = $1', [correo])) {
    throw new ErrorHttp(409, 'El correo ya está registrado');
  }

  const hash = await bcrypt.hash(contrasena, 10);
  const idUsuario = await transaccion(async (tx) => {
    const [u] = await tx.consulta(
      `INSERT INTO usuario (id_rol, nombres, apellidos, correo, contrasena_hash, telefono)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_usuario`,
      [idRol, texto(b.nombres).slice(0, 80), texto(b.apellidos).slice(0, 80), correo, hash, telefono],
    );
    await tx.consulta('INSERT INTO consentimiento (id_usuario, version_politica) VALUES ($1, $2)', [u.idUsuario, VERSION_POLITICA]);
    if (idRol === ROL.REFUGIO) {
      const idUbicacion = await guardarUbicacion(tx.consulta, ubicacionRefugio);
      await tx.consulta(
        'INSERT INTO refugio (id_usuario, id_ubicacion, nombre) VALUES ($1, $2, $3)',
        [u.idUsuario, idUbicacion, texto(b.nombreRefugio).slice(0, 100)],
      );
    }
    return u.idUsuario;
  });
  res.status(201).json(await sesion(idUsuario));
}

// RF-02
async function login(req, res) {
  requerido(req.body, ['correo', 'contrasena']);
  const correo = texto(req.body.correo).toLowerCase();
  const u = await una('SELECT id_usuario, contrasena_hash, id_estado_cuenta FROM usuario WHERE correo = $1', [correo]);
  const valida = u && (await bcrypt.compare(String(req.body.contrasena), u.contrasenaHash));
  if (!valida) throw new ErrorHttp(401, 'Correo o contraseña incorrectos');
  if (u.idEstadoCuenta === ESTADO_CUENTA.SUSPENDIDA) throw new ErrorHttp(403, 'Su cuenta está suspendida. Contacte al administrador');
  if (u.idEstadoCuenta === ESTADO_CUENTA.BLOQUEADA) throw new ErrorHttp(403, 'Su cuenta está bloqueada');
  res.json(await sesion(u.idUsuario));
}

// RNF-19: renueva el token mientras el usuario esté activo
async function renovar(req, res) {
  res.json(await sesion(req.usuario.id));
}

async function yo(req, res) {
  res.json((await sesion(req.usuario.id)).usuario);
}

// RF-18 / CU-12: recuperación de contraseña por correo
async function olvideContrasena(req, res) {
  const correo = texto(req.body.correo).toLowerCase();
  if (!REGEX_CORREO.test(correo)) throw new ErrorHttp(400, 'Correo inválido');
  const u = await una('SELECT id_usuario, nombres FROM usuario WHERE correo = $1', [correo]);
  if (!u) throw new ErrorHttp(404, 'No existe una cuenta registrada con ese correo');

  const token = crypto.randomBytes(32).toString('hex');
  await una(
    `INSERT INTO token_usuario (id_usuario, id_tipo_token, token_hash, expira_en)
     VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')`,
    [u.idUsuario, TIPO_TOKEN.RECUPERACION, hashToken(token)],
  );
  const enlace = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/restablecer?token=${token}`;
  await enviarCorreo({
    para: correo,
    asunto: 'FindMyPet: restablecer contraseña',
    texto: `Hola ${u.nombres}, para crear una nueva contraseña abre este enlace (válido por 1 hora): ${enlace}`,
    html: `<p>Hola ${u.nombres},</p><p>Para crear una nueva contraseña haz clic en el enlace (válido por 1 hora):</p>
           <p><a href="${enlace}">Restablecer contraseña</a></p><p>Si no lo solicitaste, ignora este correo.</p>`,
  });
  res.json({ mensaje: 'Te enviamos un enlace a tu correo para restablecer la contraseña' });
}

async function restablecerContrasena(req, res) {
  requerido(req.body, ['token', 'contrasena']);
  const contrasena = contrasenaSegura(req.body.contrasena);
  const t = await una(
    `SELECT id_token, id_usuario FROM token_usuario
     WHERE token_hash = $1 AND id_tipo_token = $2 AND fecha_uso IS NULL AND expira_en > NOW()`,
    [hashToken(texto(req.body.token)), TIPO_TOKEN.RECUPERACION],
  );
  if (!t) throw new ErrorHttp(400, 'El enlace no es válido o ya expiró. Solicite uno nuevo');
  await transaccion(async (tx) => {
    await tx.consulta('UPDATE usuario SET contrasena_hash = $1 WHERE id_usuario = $2', [await bcrypt.hash(contrasena, 10), t.idUsuario]);
    await tx.consulta('UPDATE token_usuario SET fecha_uso = NOW() WHERE id_token = $1', [t.idToken]);
  });
  res.json({ mensaje: 'Contraseña actualizada. Ya puede iniciar sesión' });
}

module.exports = { registro, login, renovar, yo, olvideContrasena, restablecerContrasena, sesion };
