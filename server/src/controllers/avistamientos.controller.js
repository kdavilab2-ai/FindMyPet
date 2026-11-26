const { consulta, transaccion } = require('../lib/db');
const { ErrorHttp } = require('../middlewares/errores');
const { entero, texto } = require('../lib/validar');
const { TIPO, ESTADO, ESTADO_CUENTA, ESTADO_COINCIDENCIA } = require('../lib/constantes');
const { propietarios, avisarCaso } = require('../services/avistamientos.service');
const { contactosPublicacion } = require('../lib/contactos');

async function cargarCaso(consultar, id, bloqueo = '') {
  const [caso] = await consultar(`SELECT cr.notas, cr.informada_en, cr.confirmada_en, p.id_usuario AS autor, rf.id_usuario AS refugio,
    a.nombres || ' ' || LEFT(a.apellidos, 1) || '.' AS nombre_autor,
    rf.autorizado AND r.id_estado_cuenta = $3 AS refugio_activo, a.id_estado_cuenta = $3 AS autor_activo, rf.nombre
    FROM custodia_refugio cr JOIN publicacion p USING (id_publicacion) JOIN refugio rf USING (id_refugio)
    JOIN usuario r ON r.id_usuario = rf.id_usuario JOIN usuario a ON a.id_usuario = p.id_usuario
    WHERE p.id_publicacion = $1 AND p.id_tipo = $2 ${bloqueo}`, [id, TIPO.ENCONTRADA, ESTADO_CUENTA.ACTIVA]);
  if (!caso) throw new ErrorHttp(404, 'No hay un traslado asociado a este avistamiento');
  return caso;
}

// RF-10, RF-11 y RNF-05: coordina el traslado entre las cuentas vinculadas, sin compartir datos del perfil.
async function destinosCaso(consultar, id, usuario, caso) {
  const esAutor = usuario === caso.autor;
  const esRefugio = usuario === caso.refugio && caso.refugioActivo;
  const matches = await consultar(`SELECT d.id_usuario, bool_or(co.id_estado = $3) AS confirmada,
    string_agg(DISTINCT d.nombre_animal, ', ') AS mascotas
    FROM coincidencia co JOIN publicacion d ON d.id_publicacion = co.id_desaparecida JOIN usuario u ON u.id_usuario = d.id_usuario
    WHERE co.id_encontrada = $1 AND co.id_estado IN ($2, $3) AND u.id_estado_cuenta = $4 GROUP BY d.id_usuario`,
  [id, ESTADO_COINCIDENCIA.SUGERIDA, ESTADO_COINCIDENCIA.CONFIRMADA, ESTADO_CUENTA.ACTIVA]);
  const propia = matches.find((c) => c.idUsuario === usuario);
  if (!esAutor && !esRefugio && !propia) throw new ErrorHttp(403, 'La coordinación es privada para las cuentas vinculadas');
  const destinos = new Map();
  if (caso.refugioActivo && !esRefugio) destinos.set(caso.refugio, caso.nombre);
  if (caso.autorActivo && !esAutor && (esRefugio || propia?.confirmada)) destinos.set(caso.autor, 'Persona que reportó el avistamiento');
  for (const c of matches) {
    if ((esRefugio || (esAutor && c.confirmada)) && !destinos.has(c.idUsuario)) {
      destinos.set(c.idUsuario, c.mascotas ? `Propietario de ${c.mascotas}` : 'Propietario de una posible coincidencia');
    }
  }
  destinos.delete(usuario);
  return { destinos, esRefugio, esAutor, puedeConfirmar: esRefugio && !caso.confirmadaEn };
}

async function coordinacion(req, res) {
  const id = entero(req.params.id);
  const usuario = req.usuario.id;
  const resultado = await transaccion(async (tx) => {
    const caso = await cargarCaso(tx.consulta, id, 'FOR SHARE OF cr');
    const { destinos, esRefugio, esAutor, puedeConfirmar } = await destinosCaso(tx.consulta, id, usuario, caso);
    const mensajes = await tx.consulta(`SELECT id_mensaje AS id, contenido, fecha, id_remitente = $2 AS mio,
      CASE WHEN id_remitente = $2 THEN id_destinatario ELSE id_remitente END AS interlocutor
      FROM mensaje_avistamiento WHERE id_publicacion = $1 AND (
        (id_remitente = $2 AND id_destinatario = ANY($3::int[])) OR (id_destinatario = $2 AND id_remitente = ANY($3::int[])))
      ORDER BY id_mensaje DESC LIMIT 50`, [id, usuario, [...destinos.keys()]]);
    const coincidencias = await tx.consulta(`SELECT d.id_publicacion AS id, d.nombre_animal AS mascota,
      d.id_usuario, co.porcentaje::float, co.id_estado = $3 AS identificada, d.id_estado = $4 AS recuperada
      FROM coincidencia co JOIN publicacion d ON d.id_publicacion = co.id_desaparecida
      WHERE co.id_encontrada = $1 AND co.id_estado IN ($2, $3)
        AND ($5::boolean OR d.id_usuario = $6 OR ($7::boolean AND co.id_estado = $3))
      ORDER BY identificada DESC, co.porcentaje DESC`,
    [id, ESTADO_COINCIDENCIA.SUGERIDA, ESTADO_COINCIDENCIA.CONFIRMADA, ESTADO.RECUPERADA, esRefugio, usuario, esAutor]);
    const autor = esRefugio ? { nombre: caso.nombreAutor, contactos: await contactosPublicacion(tx.consulta, id) } : null;
    return { notas: caso.notas, puedeConfirmar, esRefugio, autor,
      refugio: { nombre: caso.nombre, informadaEn: caso.informadaEn, confirmadaEn: caso.confirmadaEn },
      coincidencias: coincidencias.map(({ idUsuario, ...c }) => ({ ...c, destino: destinos.has(idUsuario) ? idUsuario : null })),
      destinos: [...destinos].map(([id, etiqueta]) => ({ id, etiqueta })),
      mensajes: mensajes.reverse().map(({ interlocutor, ...m }) => ({ ...m, interlocutor: destinos.get(interlocutor) })) };
  });
  res.set('Cache-Control', 'no-store').json(resultado);
}

async function enviar(req, res) {
  const id = entero(req.params.id);
  const destino = entero(req.body.destino, 'Destinatario');
  const contenido = texto(req.body.contenido);
  if (!contenido || contenido.length > 500) throw new ErrorHttp(400, 'Escribe un mensaje de 1 a 500 caracteres');
  await transaccion(async (tx) => {
    const caso = await cargarCaso(tx.consulta, id, 'FOR SHARE OF cr');
    const { destinos } = await destinosCaso(tx.consulta, id, req.usuario.id, caso);
    if (!destinos.has(destino)) throw new ErrorHttp(403, 'Este destinatario no está disponible para tu cuenta');
    await tx.consulta('INSERT INTO mensaje_avistamiento (id_publicacion, id_remitente, id_destinatario, contenido) VALUES ($1, $2, $3, $4)',
      [id, req.usuario.id, destino, contenido]);
    await avisarCaso(tx.consulta, id, [destino], 'Tienes un mensaje de coordinación en un avistamiento con traslado a refugio.');
  });
  res.status(201).json({ mensaje: 'Mensaje enviado' });
}

// La recepción solo la confirma la cuenta del refugio asignado. El estado del reporte sigue su flujo independiente.
async function confirmar(req, res) {
  const id = entero(req.params.id);
  await transaccion(async (tx) => {
    const caso = await cargarCaso(tx.consulta, id, 'FOR UPDATE OF cr');
    if (req.usuario.id !== caso.refugio || !caso.refugioActivo) throw new ErrorHttp(403, 'Solo el refugio asignado puede confirmar la recepción');
    if (caso.confirmadaEn) return;
    await tx.consulta('UPDATE custodia_refugio SET confirmada_en = NOW() WHERE id_publicacion = $1', [id]);
    const posibles = await propietarios(tx.consulta, id);
    await avisarCaso(tx.consulta, id, [caso.autor, ...posibles.map((p) => p.idUsuario)].filter((u) => u !== caso.refugio),
      `${caso.nombre} confirmó la recepción del animal avistado. Consulta el reporte para coordinar.`);
  });
  res.status(204).end();
}

async function delRefugio(req, res) {
  if (!req.usuario.refugioAutorizado) throw new ErrorHttp(403, 'El refugio debe estar autorizado');
  const datos = await consulta(`SELECT p.id_publicacion AS id, p.nombre_animal, e.nombre AS especie, cr.informada_en, cr.confirmada_en,
      (SELECT COUNT(*)::int FROM coincidencia co WHERE co.id_encontrada = p.id_publicacion AND co.id_estado IN ($2, $3)) AS coincidencias,
      EXISTS (SELECT 1 FROM coincidencia co JOIN publicacion d ON d.id_publicacion = co.id_desaparecida
        WHERE co.id_encontrada = p.id_publicacion AND co.id_estado = $3 AND d.id_estado = $4) AS recuperacion_confirmada
    FROM custodia_refugio cr JOIN publicacion p USING (id_publicacion) JOIN especie e USING (id_especie)
    WHERE cr.id_refugio = $1 ORDER BY cr.informada_en DESC`,
  [req.usuario.idRefugio, ESTADO_COINCIDENCIA.SUGERIDA, ESTADO_COINCIDENCIA.CONFIRMADA, ESTADO.RECUPERADA]);
  res.set('Cache-Control', 'no-store').json(datos);
}

module.exports = { coordinacion, enviar, confirmar, delRefugio };
