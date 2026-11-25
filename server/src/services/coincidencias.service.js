// RF-09, RF-10: análisis de coincidencias entre mascotas desaparecidas y animales encontrados.
// Combina puntajes por atributos (especie, raza, color, tamaño, ubicación, fecha) con la
// comparación de fotos por IA cuando está disponible. Si la IA falla, se usan solo los atributos (RNF-16).

const { consulta, una, transaccion } = require('../lib/db');
const ia = require('../lib/ia');
const { distanciaKm, tieneCoordenadas } = require('../lib/geo');
const { TIPO, ESTADO, CRITERIO, ESTADO_COINCIDENCIA, TIPO_NOTIFICACION } = require('../lib/constantes');

const UMBRAL = 60; // porcentaje mínimo para sugerir una coincidencia
const PESOS = { [CRITERIO.RAZA]: 15, [CRITERIO.COLOR]: 25, [CRITERIO.TAMANO]: 10, [CRITERIO.UBICACION]: 25, [CRITERIO.FECHA]: 25 };
const PESO_IMAGEN = 40;

const DATOS_REPORTE = `
  SELECT p.id_publicacion, p.id_usuario, p.id_tipo, p.id_estado, p.id_especie, p.id_raza, p.id_tamano,
         p.nombre_animal, rz.nombre AS raza, r.fecha_evento,
         u.latitud, u.longitud, u.id_sector, s.id_canton, c.id_provincia,
         COALESCE((SELECT array_agg(pc.id_color) FROM publicacion_color pc WHERE pc.id_publicacion = p.id_publicacion), '{}') AS colores
  FROM publicacion p
  JOIN reporte r ON r.id_publicacion = p.id_publicacion
  JOIN ubicacion u ON u.id_ubicacion = r.id_ubicacion
  JOIN sector s ON s.id_sector = u.id_sector
  JOIN canton c ON c.id_canton = s.id_canton
  LEFT JOIN raza rz ON rz.id_raza = p.id_raza`;

const esMestizo = (raza) => !raza || /mestizo|no aplica/i.test(raza);
const dias = (a, b) => (new Date(b) - new Date(a)) / 86400000;

// Devuelve los puntajes (0-100) de cada criterio, o null si no puede ser la misma mascota
function puntuarAtributos(perdida, hallada) {
  if (perdida.idEspecie !== hallada.idEspecie) return null;
  const p = { [CRITERIO.ESPECIE]: 100 };

  if (perdida.idRaza && perdida.idRaza === hallada.idRaza) p[CRITERIO.RAZA] = 100;
  else if (esMestizo(perdida.raza) || esMestizo(hallada.raza)) p[CRITERIO.RAZA] = 50;
  else p[CRITERIO.RAZA] = 0;

  const a = new Set(perdida.colores);
  const b = new Set(hallada.colores);
  const union = new Set([...a, ...b]);
  const comunes = [...a].filter((x) => b.has(x)).length;
  p[CRITERIO.COLOR] = union.size ? Math.round((comunes / union.size) * 100) : 50;

  if (!perdida.idTamano || !hallada.idTamano) p[CRITERIO.TAMANO] = 50;
  else p[CRITERIO.TAMANO] = { 0: 100, 1: 40 }[Math.abs(perdida.idTamano - hallada.idTamano)] ?? 0;

  if (tieneCoordenadas(perdida) && tieneCoordenadas(hallada)) {
    const km = distanciaKm(perdida.latitud, perdida.longitud, hallada.latitud, hallada.longitud);
    p[CRITERIO.UBICACION] = km <= 1 ? 100 : Math.max(0, Math.round(100 - ((km - 1) / 14) * 100));
  } else if (perdida.idSector === hallada.idSector) p[CRITERIO.UBICACION] = 100;
  else if (perdida.idCanton === hallada.idCanton) p[CRITERIO.UBICACION] = 70;
  else if (perdida.idProvincia === hallada.idProvincia) p[CRITERIO.UBICACION] = 25;
  else p[CRITERIO.UBICACION] = 0;

  // El animal debe haberse encontrado después de la desaparición (1 día de tolerancia)
  const diferencia = dias(perdida.fechaEvento, hallada.fechaEvento);
  if (diferencia < -1) p[CRITERIO.FECHA] = 0;
  else if (diferencia <= 3) p[CRITERIO.FECHA] = 100;
  else p[CRITERIO.FECHA] = Math.max(0, Math.round(100 - ((diferencia - 3) / 57) * 100));

  return p;
}

function porcentajeTotal(puntajes) {
  let suma = 0;
  let pesos = 0;
  for (const [criterio, peso] of Object.entries(PESOS)) {
    suma += puntajes[criterio] * peso;
    pesos += peso;
  }
  if (puntajes[CRITERIO.IMAGEN] !== undefined) {
    suma += puntajes[CRITERIO.IMAGEN] * PESO_IMAGEN;
    pesos += PESO_IMAGEN;
  }
  return Math.round((suma / pesos) * 100) / 100;
}

async function primeraImagen(idPublicacion) {
  const fila = await una(
    `SELECT ma.mime, ma.datos FROM multimedia m JOIN multimedia_archivo ma ON ma.id_multimedia = m.id_multimedia
     WHERE m.id_publicacion = $1 AND m.id_tipo_multimedia = 1 ORDER BY m.id_multimedia LIMIT 1`,
    [idPublicacion],
  );
  return fila ? { mime: fila.mime, buffer: fila.datos } : null;
}

/**
 * Analiza un reporte contra los reportes del tipo opuesto que siguen pendientes.
 * Devuelve la cantidad de coincidencias nuevas sugeridas.
 */
async function analizarReporte(idPublicacion) {
  const reporte = await una(`${DATOS_REPORTE} WHERE p.id_publicacion = $1`, [idPublicacion]);
  if (!reporte || ![TIPO.DESAPARECIDA, TIPO.ENCONTRADA].includes(reporte.idTipo)) return 0;
  const esPerdida = reporte.idTipo === TIPO.DESAPARECIDA;
  if (reporte.idEstado !== (esPerdida ? ESTADO.DESAPARECIDA_PENDIENTE : ESTADO.ENCONTRADA_PENDIENTE)) return 0;

  const candidatos = await consulta(
    `${DATOS_REPORTE} WHERE p.id_tipo = $1 AND p.id_estado = $2 AND p.id_especie = $3 AND p.id_usuario <> $4`,
    [
      esPerdida ? TIPO.ENCONTRADA : TIPO.DESAPARECIDA,
      esPerdida ? ESTADO.ENCONTRADA_PENDIENTE : ESTADO.DESAPARECIDA_PENDIENTE,
      reporte.idEspecie,
      reporte.idUsuario,
    ],
  );

  const fotoReporte = ia.disponible() ? await primeraImagen(idPublicacion) : null;
  let nuevas = 0;

  for (const candidato of candidatos) {
    const perdida = esPerdida ? reporte : candidato;
    const hallada = esPerdida ? candidato : reporte;
    const puntajes = puntuarAtributos(perdida, hallada);
    if (!puntajes) continue;

    // Solo se compara con IA si los atributos ya son razonablemente parecidos (ahorra consultas)
    if (fotoReporte && porcentajeTotal(puntajes) >= 45) {
      const fotoCandidato = await primeraImagen(candidato.idPublicacion);
      if (fotoCandidato) {
        const similitud = await ia.compararImagenes(
          esPerdida ? fotoReporte : fotoCandidato,
          esPerdida ? fotoCandidato : fotoReporte,
        );
        if (similitud !== null) puntajes[CRITERIO.IMAGEN] = similitud;
      }
    }

    const porcentaje = porcentajeTotal(puntajes);
    if (porcentaje < UMBRAL) continue;

    const creada = await transaccion(async (tx) => {
      const [fila] = await tx.consulta(
        `INSERT INTO coincidencia (id_desaparecida, id_encontrada, porcentaje) VALUES ($1, $2, $3)
         ON CONFLICT (id_desaparecida, id_encontrada) DO UPDATE
           SET porcentaje = EXCLUDED.porcentaje, fecha_analisis = NOW()
           WHERE coincidencia.id_estado = ${ESTADO_COINCIDENCIA.SUGERIDA}
         RETURNING id_coincidencia, (xmax = 0) AS es_nueva`,
        [perdida.idPublicacion, hallada.idPublicacion, porcentaje],
      );
      if (!fila) return null; // ya confirmada o descartada: se respeta la decisión del propietario
      await tx.consulta('DELETE FROM coincidencia_criterio WHERE id_coincidencia = $1', [fila.idCoincidencia]);
      for (const [criterio, puntaje] of Object.entries(puntajes)) {
        await tx.consulta(
          'INSERT INTO coincidencia_criterio (id_coincidencia, id_criterio, puntaje) VALUES ($1, $2, $3)',
          [fila.idCoincidencia, Number(criterio), puntaje],
        );
      }
      if (fila.esNueva) {
        await tx.consulta(
          `INSERT INTO notificacion (id_usuario, id_publicacion, id_tipo_notificacion, mensaje) VALUES ($1, $2, $3, $4)`,
          [
            perdida.idUsuario, perdida.idPublicacion, TIPO_NOTIFICACION.COINCIDENCIA,
            `La IA encontró un animal parecido a ${perdida.nombreAnimal || 'tu mascota'} (${Math.round(porcentaje)} % de similitud)`,
          ],
        );
      }
      return fila.esNueva;
    });
    if (creada) nuevas += 1;
  }
  return nuevas;
}

// RNF-15: el análisis se ejecuta en segundo plano, sin bloquear la respuesta al usuario
function analizarEnSegundoPlano(idPublicacion) {
  if (process.env.NODE_ENV === 'test') return;
  setImmediate(() => {
    analizarReporte(idPublicacion).catch((err) => console.error('[IA] Error en el análisis:', err.message));
  });
}

module.exports = { analizarReporte, analizarEnSegundoPlano, puntuarAtributos, porcentajeTotal, UMBRAL };
