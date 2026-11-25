const { texto, entero, coordenada } = require('./validar');
const { ErrorHttp } = require('../middlewares/errores');

// RF-20: ubicación por zona (provincia/cantón/sector), dirección o punto en el mapa
function leerUbicacion(body) {
  if (!body.idSector) throw new ErrorHttp(400, 'Seleccione la provincia, el cantón y el sector');
  const latitud = coordenada(body.latitud, -90, 90, 'Latitud');
  const longitud = coordenada(body.longitud, -180, 180, 'Longitud');
  if ((latitud === null) !== (longitud === null)) throw new ErrorHttp(400, 'Indique latitud y longitud juntas');
  const direccion = texto(body.direccion).slice(0, 200) || null;
  return { idSector: entero(body.idSector, 'Sector'), direccion, latitud, longitud };
}

// `ejecutar` es consulta() o tx.consulta() dentro de una transacción
async function guardarUbicacion(ejecutar, u, idExistente = null) {
  if (idExistente) {
    await ejecutar(
      'UPDATE ubicacion SET id_sector = $1, direccion = $2, latitud = $3, longitud = $4 WHERE id_ubicacion = $5',
      [u.idSector, u.direccion, u.latitud, u.longitud, idExistente],
    );
    return idExistente;
  }
  const [fila] = await ejecutar(
    'INSERT INTO ubicacion (id_sector, direccion, latitud, longitud) VALUES ($1, $2, $3, $4) RETURNING id_ubicacion',
    [u.idSector, u.direccion, u.latitud, u.longitud],
  );
  return fila.idUbicacion;
}

// Fragmento SQL que devuelve la ubicación completa como JSON (alias de tabla: ub, s, c, pr)
const JSON_UBICACION = `json_build_object(
  'idSector', s.id_sector, 'sector', s.nombre, 'idCanton', c.id_canton, 'canton', c.nombre,
  'idProvincia', pr.id_provincia, 'provincia', pr.nombre, 'direccion', ub.direccion,
  'latitud', ub.latitud::float, 'longitud', ub.longitud::float)`;

const JOIN_UBICACION = (columna) => `
  LEFT JOIN ubicacion ub ON ub.id_ubicacion = ${columna}
  LEFT JOIN sector s ON s.id_sector = ub.id_sector
  LEFT JOIN canton c ON c.id_canton = s.id_canton
  LEFT JOIN provincia pr ON pr.id_provincia = c.id_provincia`;

module.exports = { leerUbicacion, guardarUbicacion, JSON_UBICACION, JOIN_UBICACION };
