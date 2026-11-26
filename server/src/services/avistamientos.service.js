const { ErrorHttp } = require('../middlewares/errores');
const { enteroOpcional, texto } = require('../lib/validar');
const { TIPO_NOTIFICACION, ESTADO_COINCIDENCIA, ESTADO, ESTADO_CUENTA } = require('../lib/constantes');

function leerHora(valor) {
  if (valor === '' || valor === null || valor === undefined) return null;
  if (typeof valor !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) throw new ErrorHttp(400, 'Indique una hora válida (HH:MM)');
  return valor;
}

async function avisarCaso(consultar, id, usuarios, mensaje) {
  await consultar(`INSERT INTO notificacion (id_usuario, id_publicacion, id_tipo_notificacion, mensaje)
    SELECT id_usuario, $1, $2, $3 FROM usuario WHERE id_usuario = ANY($4::int[]) AND id_estado_cuenta = $5`,
  [id, TIPO_NOTIFICACION.AVISTAMIENTO, mensaje.slice(0, 255), usuarios, ESTADO_CUENTA.ACTIVA]);
}

async function avisarRefugio(consultar, id, mensaje) {
  const [refugio] = await consultar(`SELECT r.id_usuario FROM custodia_refugio c JOIN refugio r USING (id_refugio)
    WHERE c.id_publicacion = $1 AND r.autorizado`, [id]);
  if (refugio) await avisarCaso(consultar, id, [refugio.idUsuario], mensaje);
}

async function confirmarRecuperacion(consultar, id) {
  const [recuperada] = await consultar(`UPDATE publicacion SET id_estado = $2 WHERE id_publicacion = $1
    AND id_estado <> $2 RETURNING nombre_animal`, [id, ESTADO.RECUPERADA]);
  if (!recuperada) return;
  const casos = await consultar(`SELECT c.id_encontrada FROM coincidencia c JOIN custodia_refugio cr ON cr.id_publicacion = c.id_encontrada
    WHERE c.id_desaparecida = $1 AND c.id_estado = $2`, [id, ESTADO_COINCIDENCIA.CONFIRMADA]);
  for (const caso of casos) {
    await avisarRefugio(consultar, caso.idEncontrada, `El propietario confirmó que recuperó a ${recuperada.nombreAnimal || 'su mascota'}. Revisa el seguimiento del traslado.`);
  }
}

function propietarios(consultar, id) {
  return consultar(`SELECT DISTINCT d.id_usuario, d.nombre_animal FROM coincidencia c JOIN publicacion d ON d.id_publicacion = c.id_desaparecida
    WHERE c.id_encontrada = $1 AND c.id_estado IN ($2, $3) AND d.id_estado = $4`,
  [id, ESTADO_COINCIDENCIA.SUGERIDA, ESTADO_COINCIDENCIA.CONFIRMADA, ESTADO.DESAPARECIDA_PENDIENTE]);
}

async function guardarCustodia(consultar, id, idAutor, datos) {
  const situacion = datos.situacionTraslado;
  if (situacion === undefined && datos.idRefugioCustodia === undefined) return;
  if (situacion !== undefined && !['sin_traslado', 'realizado'].includes(situacion)) {
    throw new ErrorHttp(400, 'Indica qué ocurrió con el animal');
  }
  const idRefugio = enteroOpcional(datos.idRefugioCustodia, 'Refugio');
  if (situacion === 'realizado' && !idRefugio) throw new ErrorHttp(400, 'Selecciona el refugio al que ya fue trasladado el animal');
  if (situacion === 'sin_traslado' && idRefugio) throw new ErrorHttp(400, 'Solo selecciona un refugio si el traslado ya ocurrió');
  const notas = texto(datos.notasCustodia);
  if (notas.length > 500) throw new ErrorHttp(400, 'Las notas de entrega admiten hasta 500 caracteres');
  if (!idRefugio && notas) throw new ErrorHttp(400, 'Selecciona un refugio para registrar las notas de entrega');
  const [actual] = await consultar('SELECT id_refugio, confirmada_en, entregada_en FROM custodia_refugio WHERE id_publicacion = $1 FOR UPDATE', [id]);
  if (actual?.idRefugio === idRefugio) {
    await consultar('UPDATE custodia_refugio SET notas = $1 WHERE id_publicacion = $2', [notas || null, id]);
    return;
  }
  if (actual?.confirmadaEn) throw new ErrorHttp(400, 'La recepción ya fue confirmada por el refugio');
  if (actual?.entregadaEn) throw new ErrorHttp(409, 'El avistamiento ya tiene una entrega registrada');
  if (actual) {
    const [conMensajes] = await consultar('SELECT 1 FROM mensaje_avistamiento WHERE id_publicacion = $1 LIMIT 1', [id]);
    if (conMensajes) throw new ErrorHttp(400, 'El traslado ya tiene mensajes de coordinación. Conserva el refugio asociado');
    await consultar('DELETE FROM custodia_refugio WHERE id_publicacion = $1', [id]);
  }
  if (!idRefugio) return;
  const [refugio] = await consultar(`SELECT rf.id_usuario, rf.nombre FROM refugio rf JOIN usuario u USING (id_usuario)
    WHERE rf.id_refugio = $1 AND rf.autorizado AND u.id_estado_cuenta = $2`, [idRefugio, ESTADO_CUENTA.ACTIVA]);
  if (!refugio) throw new ErrorHttp(400, 'Selecciona un refugio autorizado y activo');
  await consultar('INSERT INTO custodia_refugio (id_publicacion, id_refugio, notas) VALUES ($1, $2, $3)', [id, idRefugio, notas || null]);
  const posibles = await propietarios(consultar, id);
  await avisarCaso(consultar, id, [refugio.idUsuario, ...posibles.map((p) => p.idUsuario)].filter((u) => u !== idAutor),
    `Se informó el traslado de un animal avistado a ${refugio.nombre}. Consulta el reporte para coordinar.`);
}

module.exports = { leerHora, guardarCustodia, propietarios, avisarCaso, avisarRefugio, confirmarRecuperacion };
