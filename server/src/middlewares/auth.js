const jwt = require('jsonwebtoken');
const { una } = require('../lib/db');
const { ROL, ESTADO_CUENTA } = require('../lib/constantes');

// RNF-19: la sesión expira tras 30 minutos; el frontend la renueva mientras haya actividad
const DURACION_SESION = '30m';

function firmarToken(usuario) {
  return jwt.sign({ id: usuario.idUsuario, rol: usuario.idRol }, process.env.JWT_SECRET, { expiresIn: DURACION_SESION });
}

async function leerUsuario(req) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) return null;
  const datos = jwt.verify(token, process.env.JWT_SECRET);
  const usuario = await una(
    `SELECT u.id_usuario, u.id_rol, u.id_estado_cuenta, u.nombres, u.apellidos, u.correo,
            rf.id_refugio, rf.autorizado
     FROM usuario u LEFT JOIN refugio rf ON rf.id_usuario = u.id_usuario
     WHERE u.id_usuario = $1`,
    [datos.id],
  );
  if (!usuario || usuario.idEstadoCuenta !== ESTADO_CUENTA.ACTIVA) return null;
  return {
    id: usuario.idUsuario,
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
