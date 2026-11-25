// Datos de demostración. Uso: npm run seed  (BORRA los datos de usuarios y publicaciones)
require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { pool, una, consulta } = require('../src/lib/db');
const { analizarReporte } = require('../src/services/coincidencias.service');

const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const id = async (tabla, columna, nombre, extra = '') =>
  (await una(`SELECT ${columna} AS id FROM ${tabla} WHERE nombre = $1 ${extra}`, [nombre])).id;

async function crearUsuario({ rol, nombres, apellidos, correo, telefono, estado = 1 }) {
  const hash = await bcrypt.hash('Clave1234', 10);
  const u = await una(
    `INSERT INTO usuario (id_rol, id_estado_cuenta, nombres, apellidos, correo, contrasena_hash, telefono, fecha_verificacion)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id_usuario`,
    [rol, estado, nombres, apellidos, correo, hash, telefono],
  );
  await consulta("INSERT INTO consentimiento (id_usuario, version_politica) VALUES ($1, '1.0')", [u.idUsuario]);
  return u.idUsuario;
}

async function crearUbicacion(canton, sector, direccion, latitud, longitud) {
  const idSector = (await una(
    'SELECT s.id_sector AS id FROM sector s JOIN canton c ON c.id_canton = s.id_canton WHERE c.nombre = $1 AND s.nombre = $2',
    [canton, sector],
  )).id;
  const u = await una(
    'INSERT INTO ubicacion (id_sector, direccion, latitud, longitud) VALUES ($1, $2, $3, $4) RETURNING id_ubicacion',
    [idSector, direccion, latitud, longitud],
  );
  return u.idUbicacion;
}

async function crearPublicacion(p) {
  const idEspecie = await id('especie', 'id_especie', p.especie);
  const idRaza = await id('raza', 'id_raza', p.raza, `AND id_especie = ${idEspecie}`);
  const idTamano = await id('tamano', 'id_tamano', p.tamano);
  const estadoInicial = { 1: 1, 2: 3, 3: 5 }[p.tipo];
  const pub = await una(
    `INSERT INTO publicacion (id_usuario, id_tipo, id_estado, id_especie, id_raza, id_tamano, nombre_animal, descripcion, fecha_creacion)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() - ($9 || ' hours')::interval) RETURNING id_publicacion`,
    [p.usuario, p.tipo, p.estado || estadoInicial, idEspecie, idRaza, idTamano, p.nombre, p.descripcion, String(p.horas || 1)],
  );
  const idPub = pub.idPublicacion;
  for (const c of p.colores) {
    await consulta('INSERT INTO publicacion_color VALUES ($1, $2)', [idPub, await id('color', 'id_color', c)]);
  }
  if (p.tipo === 3) {
    await consulta('INSERT INTO adopcion VALUES ($1, $2)', [idPub, p.salud]);
  } else {
    const idUb = await crearUbicacion(...p.ubicacion);
    await consulta('INSERT INTO reporte VALUES ($1, $2, $3)', [idPub, idUb, p.fecha]);
  }
  await consulta('INSERT INTO contacto_publicacion (id_publicacion, id_tipo_contacto, valor) VALUES ($1, 2, $2)', [idPub, p.whatsapp]);
  const m = await una(
    "INSERT INTO multimedia (id_publicacion, id_tipo_multimedia, url, es_valida_ia) VALUES ($1, 1, '', TRUE) RETURNING id_multimedia",
    [idPub],
  );
  await consulta('UPDATE multimedia SET url = $1 WHERE id_multimedia = $2', [`/api/multimedia/${m.idMultimedia}`, m.idMultimedia]);
  await consulta(
    "INSERT INTO multimedia_archivo VALUES ($1, 'image/webp', $2)",
    [m.idMultimedia, p.foto],
  );
  return idPub;
}

async function main() {
  // Verifica que estén todas las fotos de demostración antes de reiniciar los datos.
  const nombresFotos = ['rocky', 'michi', 'perro-encontrado', 'gato-encontrado', 'pelusa', 'toby', 'luna'];
  const fotos = Object.fromEntries(await Promise.all(nombresFotos.map(async (nombre) => [
    nombre, await readFile(join(__dirname, 'fotos-demo', `${nombre}.webp`)),
  ])));
  await pool.query(`TRUNCATE usuario, ubicacion, publicacion, coincidencia, moderacion, notificacion,
                    valoracion, solicitud_donacion, donacion RESTART IDENTITY CASCADE`);

  const admin = await crearUsuario({ rol: 3, nombres: 'Administrador', apellidos: 'FindMyPet', correo: 'admin@findmypet.test', telefono: '0900000005' });
  const ana = await crearUsuario({ rol: 1, nombres: 'Ana', apellidos: 'Torres', correo: 'ana@findmypet.test', telefono: '0900000004' });
  const luis = await crearUsuario({ rol: 1, nombres: 'Luis', apellidos: 'Mendoza', correo: 'luis@findmypet.test', telefono: '0900000006' });
  const huellitasU = await crearUsuario({ rol: 2, nombres: 'María', apellidos: 'Vera', correo: 'huellitas@findmypet.test', telefono: '0900000007' });
  const patitasU = await crearUsuario({ rol: 2, nombres: 'Jorge', apellidos: 'Castro', correo: 'patitas@findmypet.test', telefono: '0900000008' });

  const huellitas = await una(
    'INSERT INTO refugio (id_usuario, id_ubicacion, nombre, autorizado) VALUES ($1, $2, $3, TRUE) RETURNING id_refugio',
    [huellitasU, await crearUbicacion('Milagro', 'Los Pinos', 'Km 1 vía a Mariscal Sucre', -2.1189, -79.5872), 'Fundación Huellitas Milagro'],
  );
  await consulta(
    'INSERT INTO refugio (id_usuario, id_ubicacion, nombre, autorizado) VALUES ($1, $2, $3, FALSE)',
    [patitasU, await crearUbicacion('Naranjito', 'Centro', 'Calle Bolívar y 10 de Agosto', null, null), 'Refugio Patitas Naranjito'],
  );

  // Luis recibe alertas de mascotas perdidas a 5 km de su casa (centro de Milagro)
  await consulta('INSERT INTO preferencia_alerta VALUES ($1, $2, 5)', [luis, await crearUbicacion('Milagro', 'Centro', 'Av. García Moreno', -2.1342, -79.5939)]);

  const rocky = await crearPublicacion({
    usuario: ana, tipo: 1, nombre: 'Rocky', especie: 'Perro', raza: 'Mestizo', tamano: 'Mediano', colores: ['Café', 'Blanco'],
    descripcion: 'Collar rojo con placa. Es amigable pero se asusta con los ruidos fuertes. Se escapó en la noche.',
    ubicacion: ['Milagro', 'Las Piñas', 'Cdla. Las Piñas, Mz. 4', -2.1415, -79.6013], fecha: diasAtras(3), whatsapp: '0900000004',
    foto: fotos.rocky, horas: 70,
  });
  await crearPublicacion({
    usuario: luis, tipo: 1, nombre: 'Michi', especie: 'Gato', raza: 'Siamés', tamano: 'Pequeño', colores: ['Crema', 'Café'],
    descripcion: 'Ojos azules, muy tímida. Se escapó por la ventana del segundo piso.',
    ubicacion: ['Milagro', 'Centro', 'Calle 9 de Octubre', -2.1335, -79.5925], fecha: diasAtras(5), whatsapp: '0900000006',
    foto: fotos.michi, horas: 110,
  });
  await crearPublicacion({
    usuario: luis, tipo: 2, nombre: null, especie: 'Perro', raza: 'Mestizo', tamano: 'Mediano', colores: ['Café', 'Blanco'],
    descripcion: 'Perro café con blanco encontrado cerca del parque, tiene collar rojo sin placa. Está asustado pero bien.',
    ubicacion: ['Milagro', 'Las Piñas', 'Parque de Las Piñas', -2.1431, -79.6034], fecha: diasAtras(2), whatsapp: '0900000006',
    foto: fotos['perro-encontrado'], horas: 40,
  });
  await crearPublicacion({
    usuario: ana, tipo: 2, nombre: null, especie: 'Gato', raza: 'Mestizo', tamano: 'Pequeño', colores: ['Atigrado', 'Gris'],
    descripcion: 'Gatito atigrado encontrado en la Ciudadela Universitaria, muy cariñoso. Parece doméstico.',
    ubicacion: ['Milagro', 'Ciudadela Universitaria', 'Junto a la UNEMI', -2.1495, -79.6031], fecha: diasAtras(1), whatsapp: '0900000004',
    foto: fotos['gato-encontrado'], horas: 20,
  });
  await crearPublicacion({
    usuario: huellitasU, tipo: 3, nombre: 'Pelusa', especie: 'Gato', raza: 'Mestizo', tamano: 'Pequeño', colores: ['Blanco'],
    descripcion: 'Gatita rescatada, muy dulce. Busca un hogar tranquilo y sin perros.',
    salud: 'Vacunada, desparasitada y esterilizada', whatsapp: '0900000007', foto: fotos.pelusa, horas: 200,
  });
  await crearPublicacion({
    usuario: huellitasU, tipo: 3, nombre: 'Toby', especie: 'Perro', raza: 'Mestizo', tamano: 'Mediano', colores: ['Dorado'],
    descripcion: 'Cachorro juguetón de 6 meses. Ideal para familia con patio.',
    salud: 'Vacunas al día y desparasitado', whatsapp: '0900000007', foto: fotos.toby, horas: 150,
  });
  await crearPublicacion({
    usuario: ana, tipo: 1, estado: 2, nombre: 'Luna', especie: 'Perro', raza: 'Husky', tamano: 'Grande', colores: ['Gris', 'Blanco'],
    descripcion: 'Gracias a FindMyPet volvió a casa después de tres días.',
    ubicacion: ['Milagro', 'Los Chirijos', 'Cdla. Los Chirijos', -2.1271, -79.5986], fecha: diasAtras(20), whatsapp: '0900000004',
    foto: fotos.luna, horas: 480,
  });

  // Donaciones y valoraciones
  const sol = await una(
    "INSERT INTO solicitud_donacion (id_refugio, titulo, descripcion) VALUES ($1, 'Alimento para cachorros', 'Necesitamos 3 sacos de balanceado para cachorros y mantas para el invierno.') RETURNING id_solicitud",
    [huellitas.idRefugio],
  );
  await consulta("INSERT INTO donacion (id_usuario, id_refugio, id_solicitud, detalle) VALUES ($1, $2, $3, '1 saco de balanceado de 15 kg')", [luis, huellitas.idRefugio, sol.idSolicitud]);
  await consulta("INSERT INTO valoracion (id_refugio, id_usuario, calificacion, comentario) VALUES ($1, $2, 5, 'Muy responsables, adoptamos a nuestro gato con ellos.')", [huellitas.idRefugio, ana]);

  // Análisis de coincidencias inicial (Rocky vs el perro encontrado en Las Piñas)
  const nuevas = await analizarReporte(rocky);

  console.log('Datos de demostración creados. Contraseña de todas las cuentas: Clave1234');
  console.log('  admin@findmypet.test (Administrador) · ana@findmypet.test y luis@findmypet.test (Ciudadanos)');
  console.log('  huellitas@findmypet.test (Refugio autorizado) · patitas@findmypet.test (Refugio pendiente)');
  console.log(`  Coincidencias sugeridas por IA: ${nuevas} · Administrador id ${admin}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
