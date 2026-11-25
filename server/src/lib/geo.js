// Distancia en kilómetros entre dos coordenadas (fórmula de Haversine)
function distanciaKm(lat1, lon1, lat2, lon2) {
  const rad = (g) => (Number(g) * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const tieneCoordenadas = (u) => u && u.latitud !== null && u.latitud !== undefined && u.longitud !== null && u.longitud !== undefined;

module.exports = { distanciaKm, tieneCoordenadas };
