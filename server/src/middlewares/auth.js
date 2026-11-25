const jwt = require('jsonwebtoken');
const { una } = require('../lib/db');
const { ROL, ESTADO_CUENTA } = require('../lib/constantes');
const { MINUTOS_SESION, ID_SESION } = require('../lib/sesiones');

// RNF-19: la sesión expira tras 30 minutos; el frontend la renueva mientras haya actividad
function firmarToken(usuario, idSesion) {
  return jwt.sign({ id: usuario.idUsuario, rol: usuario.idRol, sid: idSesion }, process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: `${MINUTOS_SESION}m` });
}

async function leerUsuario(req) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) return null;
  const datos = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  if (typeof datos.sid !== 'string' || !ID_SESION.test(datos.sid) || !Number.isInteger(datos.id)) return null;
  const usuario = await una(
    `SELECT u.id_usuario, u.id_rol, u.id_estado_cuenta, u.nombres, u.apellidos, u.correo,
            rf.id_refugio, rf.autorizado
     FROM usuario u JOIN sesion_usuario s ON s.id_usuario = u.id_usuario
     LEFT JOIN refugio rf ON rf.id_usuario = u.id_usuario
     WHERE u.id_usuario = $1 AND s.id_sesion = $2 AND s.expira_en > NOW()`,
    [datos.id, datos.sid],
  );
  if (!usuario || usuario.idEstadoCuenta !== ESTADO_CUENTA.ACTIVA) return null;
  return {
    id: usuario.idUsuario,
    idSesion: datos.sid,
    rol: usuario.idRol,
    nombres: usuario.nombres,
    apellidos: usuario.apellidos,
    correo: usuario.correo,
    idRefugio: usuario.idRefugio,
    refugioAutorizado: Boolean(usuario.autorizado),
    esAdmin: usuario.idRol === ROL.ADMIN,
  };
}

async function verificarToken(req, res, next) {
  try {
    const usuario = await leerUsuario(req);
    if (!usuario) return res.status(401).json({ error: 'Debe iniciar sesión' });
    req.usuario = usuario;
    next();
  } catch {
    return res.status(401).json({ error: 'Su sesión expiró, vuelva a iniciar sesión' });
  }
}

// Para rutas públicas que muestran más datos si hay sesión (RNF-05)
async function sesionOpcional(req, res, next) {
  try {
    req.usuario = await leerUsuario(req);
  } catch {
    req.usuario = null;
  }
  next();
}

// RF-19: control de acceso por rol
function verificarRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tiene permisos para esta acción' });
    }
    next();
  };
}

module.exports = { verificarToken, sesionOpcional, verificarRol, firmarToken };
