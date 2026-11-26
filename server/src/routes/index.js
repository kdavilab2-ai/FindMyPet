const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const a = require('../lib/async');
const { recibirArchivos } = require('../lib/archivos');
const { verificarToken, sesionOpcional, verificarRol } = require('../middlewares/auth');
const { ROL } = require('../lib/constantes');

const auth = require('../controllers/auth.controller');
const perfil = require('../controllers/perfil.controller');
const seguridad = require('../controllers/seguridad.controller');
const catalogos = require('../controllers/catalogos.controller');
const publicaciones = require('../controllers/publicaciones.controller');
const avistamientos = require('../controllers/avistamientos.controller');
const coincidencias = require('../controllers/coincidencias.controller');
const notificaciones = require('../controllers/notificaciones.controller');
const refugios = require('../controllers/refugios.controller');
const admin = require('../controllers/admin.controller');
const multimedia = require('../controllers/multimedia.controller');

const router = Router();

// El inicio de sesión tiene su propio cupo. Solo los intentos fallidos lo consumen.
const opcionesLimiteAuth = {
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Demasiados intentos. Espere unos minutos e intente de nuevo' },
};
const limiteAuth = rateLimit(opcionesLimiteAuth);
const limiteLogin = rateLimit({ ...opcionesLimiteAuth, skipSuccessfulRequests: true });

router.get('/salud', (req, res) => res.json({ ok: true }));
router.get('/catalogos', a(catalogos.listar));
router.get('/multimedia/:id', a(multimedia.obtener));

// Autenticación (RF-01, RF-02, RF-18)
router.use('/auth', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.post('/auth/registro', limiteAuth, a(auth.registro));
router.post('/auth/login', limiteLogin, a(auth.login));
router.post('/auth/olvide', limiteAuth, a(auth.olvideContrasena));
router.post('/auth/restablecer', limiteAuth, a(auth.restablecerContrasena));
router.post('/auth/renovar', verificarToken, a(auth.renovar));
router.post('/auth/cerrar', verificarToken, a(auth.cerrar));
router.get('/auth/yo', verificarToken, a(auth.yo));

// Perfil y alertas (RF-03, RF-26)
router.get('/perfil', verificarToken, a(perfil.obtener));
router.put('/perfil', verificarToken, a(perfil.actualizar));
router.put('/perfil/contrasena', verificarToken, limiteAuth, a(perfil.cambiarContrasena));
router.put('/perfil/alertas', verificarToken, a(perfil.guardarAlerta));
router.delete('/perfil/alertas', verificarToken, a(perfil.quitarAlerta));

router.use('/seguridad', verificarToken, (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.get('/seguridad', a(seguridad.obtener));
router.delete('/seguridad/sesiones', a(seguridad.revocar));
router.delete('/seguridad/sesiones/:id', a(seguridad.revocar));
router.put('/seguridad/notificaciones', a(seguridad.notificaciones));
router.get('/seguridad/contactos', a(seguridad.contactos));
router.patch('/seguridad/contactos/:id', a(seguridad.cambiarContacto));
router.get('/seguridad/mis-datos', a(seguridad.descargar));
router.get('/seguridad/solicitudes', a(seguridad.solicitudes));
router.post('/seguridad/solicitudes', limiteAuth, a(seguridad.solicitar));
router.delete('/seguridad/solicitudes/:tipo', a(seguridad.retirarSolicitud));

// Publicaciones (RF-04 a RF-08, RF-12 a RF-16, RF-20, RF-21)
router.get('/publicaciones', a(publicaciones.listar));
router.get('/publicaciones/resumen', a(publicaciones.resumen));
router.get('/publicaciones/mias', verificarToken, a(publicaciones.misPublicaciones));
router.get('/publicaciones/:id', sesionOpcional, a(publicaciones.obtener));
router.get('/publicaciones/:id/avistamientos', sesionOpcional, a(publicaciones.listarAvistamientos));
router.post('/publicaciones', verificarToken, recibirArchivos, a(publicaciones.crear));
router.put('/publicaciones/:id', verificarToken, recibirArchivos, a(publicaciones.actualizar));
router.patch('/publicaciones/:id/estado', verificarToken, a(publicaciones.cambiarEstado));
router.delete('/publicaciones/:id', verificarToken, a(publicaciones.eliminar));
router.get('/publicaciones/:id/coordinacion', verificarToken, a(avistamientos.coordinacion));
router.post('/publicaciones/:id/coordinacion', verificarToken, rateLimit({
  windowMs: 60_000, limit: 15, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => String(req.usuario.id), message: { error: 'Espera un minuto antes de enviar más mensajes' },
}), a(avistamientos.enviar));
router.patch('/publicaciones/:id/custodia/confirmar', verificarToken, verificarRol(ROL.REFUGIO), a(avistamientos.confirmar));
router.post('/publicaciones/:id/interes', verificarToken, a(publicaciones.interesAdopcion));

// Coincidencias con IA (RF-09, RF-10, RF-11)
router.get('/coincidencias', verificarToken, a(coincidencias.misCoincidencias));
router.patch('/coincidencias/:id', verificarToken, a(coincidencias.responder));
router.post('/coincidencias/analizar/:id', verificarToken, a(coincidencias.analizar));

// Notificaciones
router.get('/notificaciones', verificarToken, a(notificaciones.listar));
router.patch('/notificaciones/leidas', verificarToken, a(notificaciones.marcarTodas));
router.patch('/notificaciones/:id/leida', verificarToken, a(notificaciones.marcarLeida));

// Refugios y valoraciones (RF-24)
router.get('/refugios', a(refugios.listar));
router.get('/refugios/mis-avistamientos', verificarToken, verificarRol(ROL.REFUGIO), a(avistamientos.delRefugio));
router.get('/refugios/mis-intereses', verificarToken, verificarRol(ROL.REFUGIO), a(refugios.interesesAdopcion));
router.get('/refugios/:id', sesionOpcional, a(refugios.obtener));
router.post('/refugios/:id/valoraciones', verificarToken, verificarRol(ROL.CIUDADANO), a(refugios.valorar));

// Administración (RF-17, RF-19, RNF-22)
const soloAdmin = [verificarToken, verificarRol(ROL.ADMIN)];
router.get('/admin/solicitudes-cuenta', soloAdmin, a(seguridad.solicitudesAdmin));
router.get('/admin/estadisticas', soloAdmin, a(admin.estadisticas));
router.get('/admin/usuarios', soloAdmin, a(admin.usuarios));
router.patch('/admin/usuarios/:id/estado', soloAdmin, a(admin.cambiarEstadoCuenta));
router.patch('/admin/refugios/:id', soloAdmin, a(admin.autorizarRefugio));
router.get('/admin/publicaciones', soloAdmin, a(admin.publicaciones));
router.delete('/admin/publicaciones/:id', soloAdmin, a(admin.eliminarPublicacion));
router.post('/admin/publicaciones/:id/advertencia', soloAdmin, a(admin.advertir));
router.patch('/admin/publicaciones/:id/estado', soloAdmin, a(admin.actualizarEstado));
router.get('/admin/auditoria', soloAdmin, a(admin.auditoria));

module.exports = router;
