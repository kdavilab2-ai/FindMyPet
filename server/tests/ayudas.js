const request = require('supertest');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const app = require('../src/app');
const db = require('../src/lib/db');

async function limpiarBD() {
  await db.pool.query(`TRUNCATE usuario, ubicacion, publicacion, coincidencia, moderacion, notificacion,
                       valoracion, solicitud_donacion, donacion, token_usuario RESTART IDENTITY CASCADE`);
}

const cerrarBD = () => db.pool.end();

async function idSector(canton, sector) {
  const fila = await db.una(
    'SELECT s.id_sector FROM sector s JOIN canton c ON c.id_canton = s.id_canton WHERE c.nombre = $1 AND s.nombre = $2',
    [canton, sector],
  );
  return fila.idSector;
}

// Crea un usuario directamente en la BD (rol 1 ciudadano, 2 refugio, 3 admin) y devuelve su token
async function crearUsuario({ correo, rol = 1, nombres = 'Usuario', refugioAutorizado = true, avisarAccesos = false }) {
  const u = await db.una(
    `INSERT INTO usuario (id_rol, nombres, apellidos, correo, contrasena_hash, telefono, avisar_accesos)
     VALUES ($1, $2, 'Prueba', $3, $4, '0000000003', $5) RETURNING id_usuario`,
    [rol, nombres, correo, await bcrypt.hash('Clave1234', 4), avisarAccesos],
  );
  if (rol === 2) {
    const ub = await db.una('INSERT INTO ubicacion (id_sector) VALUES ($1) RETURNING id_ubicacion', [await idSector('Milagro', 'Centro')]);
    await db.consulta('INSERT INTO refugio (id_usuario, id_ubicacion, nombre, autorizado) VALUES ($1, $2, $3, $4)', [u.idUsuario, ub.idUbicacion, `Refugio ${nombres}`, refugioAutorizado]);
  }
  const res = await request(app).post('/api/auth/login').send({ correo, contrasena: 'Clave1234' });
  return { id: u.idUsuario, token: res.body.token, usuario: res.body.usuario };
}

let imagenCache;
async function imagenPrueba() {
  if (!imagenCache) {
    imagenCache = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#8B5A2B' } }).jpeg().toBuffer();
  }
  return imagenCache;
}

async function datosBase(datos = {}) {
  return {
    tipo: 1,
    nombreAnimal: 'Rocky',
    idEspecie: 1,
    idRaza: (await db.una("SELECT id_raza FROM raza WHERE nombre = 'Mestizo' AND id_especie = 1")).idRaza,
    idTamano: 2,
    colores: '3,2',
    descripcion: 'Collar rojo, muy amigable',
    idSector: await idSector('Milagro', 'Las Piñas'),
    direccion: 'Cdla. Las Piñas',
    latitud: -2.1415,
    longitud: -79.6013,
    fechaEvento: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    whatsapp: '0000000004',
    ...datos,
  };
}

// Publica con multipart/form-data, como lo hace el frontend
async function publicar(token, datos = {}, { fotos = 1 } = {}) {
  const campos = await datosBase(datos);
  let req = request(app).post('/api/publicaciones').set('Authorization', `Bearer ${token}`);
  for (const [k, v] of Object.entries(campos)) if (v !== null && v !== undefined) req = req.field(k, String(v));
  const img = await imagenPrueba();
  for (let i = 0; i < fotos; i += 1) req = req.attach('archivos', img, { filename: `foto${i}.jpg`, contentType: 'image/jpeg' });
  return req;
}

const conToken = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { app, db, request, limpiarBD, cerrarBD, crearUsuario, publicar, datosBase, idSector, imagenPrueba, conToken };
