const { consulta } = require('../lib/db');
const ia = require('../lib/ia');

// Todos los catálogos en una sola respuesta para llenar formularios y filtros
async function listar(req, res) {
  const [tipos, estados, especies, razas, tamanos, colores, provincias, cantones, sectores, tiposContacto] = await Promise.all([
    consulta('SELECT id_tipo AS id, nombre FROM tipo_publicacion ORDER BY id_tipo'),
    consulta('SELECT id_estado AS id, id_tipo, nombre FROM estado_publicacion ORDER BY id_estado'),
    consulta('SELECT id_especie AS id, nombre FROM especie ORDER BY id_especie'),
    consulta('SELECT id_raza AS id, id_especie, nombre FROM raza ORDER BY id_especie, (nombre = \'Mestizo\') DESC, nombre'),
    consulta('SELECT id_tamano AS id, nombre FROM tamano ORDER BY id_tamano'),
    consulta('SELECT id_color AS id, nombre FROM color ORDER BY nombre'),
    consulta('SELECT id_provincia AS id, nombre FROM provincia ORDER BY nombre'),
    consulta('SELECT id_canton AS id, id_provincia, nombre FROM canton ORDER BY nombre'),
    consulta('SELECT id_sector AS id, id_canton, nombre FROM sector ORDER BY nombre'),
    consulta('SELECT id_tipo_contacto AS id, nombre FROM tipo_contacto ORDER BY id_tipo_contacto'),
  ]);
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    tipos, estados, especies, razas, tamanos, colores, provincias, cantones, sectores, tiposContacto,
    iaDisponible: ia.disponible(),
  });
}

module.exports = { listar };
