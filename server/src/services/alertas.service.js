// RF-26: alertas por proximidad cuando se publica una mascota desaparecida
const { consulta, una } = require('../lib/db');
const { distanciaKm, tieneCoordenadas } = require('../lib/geo');
const { TIPO, TIPO_NOTIFICACION } = require('../lib/constantes');

async function enviarAlertasProximidad(idPublicacion) {
  const reporte = await una(
    `SELECT p.id_publicacion, p.id_usuario, p.id_tipo, p.nombre_animal, e.nombre AS especie,
            u.latitud, u.longitud, u.id_sector, s.nombre AS sector
     FROM publicacion p
     JOIN especie e ON e.id_especie = p.id_especie
     JOIN reporte r ON r.id_publicacion = p.id_publicacion
     JOIN ubicacion u ON u.id_ubicacion = r.id_ubicacion
     JOIN sector s ON s.id_sector = u.id_sector
     WHERE p.id_publicacion = $1`,
    [idPublicacion],
  );
  if (!reporte || reporte.idTipo !== TIPO.DESAPARECIDA) return 0;

  const suscriptores = await consulta(
    `SELECT pa.id_usuario, pa.radio_km, u.latitud, u.longitud, u.id_sector
     FROM preferencia_alerta pa
     JOIN ubicacion u ON u.id_ubicacion = pa.id_ubicacion
     JOIN usuario us ON us.id_usuario = pa.id_usuario AND us.id_estado_cuenta = 1
     WHERE pa.id_usuario <> $1`,
    [reporte.idUsuario],
  );

  let enviadas = 0;
  for (const s of suscriptores) {
    // Con coordenadas se usa la distancia real; sin ellas, se alerta a quienes están en el mismo sector
    const cerca = tieneCoordenadas(reporte) && tieneCoordenadas(s)
      ? distanciaKm(reporte.latitud, reporte.longitud, s.latitud, s.longitud) <= s.radioKm
      : reporte.idSector === s.idSector;
    if (!cerca) continue;
    await consulta(
      'INSERT INTO notificacion (id_usuario, id_publicacion, id_tipo_notificacion, mensaje) VALUES ($1, $2, $3, $4)',
      [
        s.idUsuario, reporte.idPublicacion, TIPO_NOTIFICACION.PROXIMIDAD,
        `Se perdió un ${reporte.especie.toLowerCase()} cerca de ti (${reporte.sector}): ${reporte.nombreAnimal || 'sin nombre'}`,
      ],
    );
    enviadas += 1;
  }
  return enviadas;
}

module.exports = { enviarAlertasProximidad };
