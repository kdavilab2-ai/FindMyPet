const { consulta, una, transaccion } = require('../lib/db');
const { ErrorHttp } = require('../middlewares/errores');
const ia = require('../lib/ia');
const { procesarArchivo } = require('../lib/archivos');
const { leerUbicacion, guardarUbicacion, JSON_UBICACION, JOIN_UBICACION } = require('../lib/ubicacion');
const {
  REGEX_CORREO, REGEX_TELEFONO, texto, entero, enteroOpcional, fechaPasada, listaEnteros,
} = require('../lib/validar');
const {
  TIPO, ESTADO, ESTADO_INICIAL, ESTADOS_POR_TIPO, TIPO_CONTACTO, TIPO_MULTIMEDIA, TIPO_NOTIFICACION, ROL, MAX_ARCHIVOS,
} = require('../lib/constantes');
const coincidencias = require('../services/coincidencias.service');
const alertas = require('../services/alertas.service');
const { leerHora, guardarCustodia, confirmarRecuperacion } = require('../services/avistamientos.service');
const { contactosPublicacion } = require('../lib/contactos');

const POR_PAGINA = 12;

// Consulta base: una publicación con sus catálogos, ubicación, colores y foto principal
const SELECT_PUBLICACION = `
  SELECT p.id_publicacion AS id, p.id_usuario, p.id_tipo, tp.nombre AS tipo, p.id_estado, ep.nombre AS estado,
         p.id_especie, e.nombre AS especie, p.id_raza, rz.nombre AS raza, p.id_tamano, t.nombre AS tamano,
         p.nombre_animal, p.descripcion, p.fecha_creacion, r.fecha_evento, to_char(r.hora_evento, 'HH24:MI') AS hora_evento,
         r.id_desaparicion_origen, a.estado_salud,
         p.id_tipo = ${TIPO.DESAPARECIDA} AND EXISTS (
           SELECT 1 FROM reporte av WHERE av.id_desaparicion_origen = p.id_publicacion
         ) AS tiene_avistamientos,
         rf.id_refugio, rf.nombre AS refugio,
         CASE WHEN cr.id_refugio IS NOT NULL THEN json_build_object('idRefugio', cr.id_refugio, 'nombre', rc.nombre,
           'informadaEn', cr.informada_en, 'confirmadaEn', cr.confirmada_en) END AS custodia,
         ${JSON_UBICACION} AS ubicacion,
         COALESCE((SELECT json_agg(json_build_object('id', co.id_color, 'nombre', co.nombre) ORDER BY co.nombre)
                   FROM publicacion_color pc JOIN color co ON co.id_color = pc.id_color
                   WHERE pc.id_publicacion = p.id_publicacion), '[]') AS colores,
         (SELECT m.url FROM multimedia m WHERE m.id_publicacion = p.id_publicacion AND m.id_tipo_multimedia = 1
          ORDER BY m.id_multimedia LIMIT 1) AS foto
  FROM publicacion p
  JOIN tipo_publicacion tp ON tp.id_tipo = p.id_tipo
  JOIN estado_publicacion ep ON ep.id_estado = p.id_estado
  JOIN especie e ON e.id_especie = p.id_especie
  LEFT JOIN raza rz ON rz.id_raza = p.id_raza
  LEFT JOIN tamano t ON t.id_tamano = p.id_tamano
  LEFT JOIN reporte r ON r.id_publicacion = p.id_publicacion
  LEFT JOIN custodia_refugio cr ON cr.id_publicacion = p.id_publicacion
  LEFT JOIN refugio rc ON rc.id_refugio = cr.id_refugio
  LEFT JOIN adopcion a ON a.id_publicacion = p.id_publicacion
  LEFT JOIN refugio rf ON rf.id_usuario = p.id_usuario AND p.id_tipo = ${TIPO.ADOPCION}
  ${JOIN_UBICACION('COALESCE(r.id_ubicacion, rf.id_ubicacion)')}`;

const obtenerPorId = (id) => una(`${SELECT_PUBLICACION} WHERE p.id_publicacion = $1`, [id]);

// ---------- Validación de datos del formulario ----------
function leerContactos(b) {
  const contactos = [];
  const telefono = texto(b.telefono);
  const whatsapp = texto(b.whatsapp).replace(/[ -]/g, '').replace(/^\+593(?=[1-9]\d{8}$)/, '0');
  const correo = texto(b.correoContacto).toLowerCase();
  if (telefono) {
    if (!REGEX_TELEFONO.test(telefono)) throw new ErrorHttp(400, 'El teléfono de contacto debe tener 10 dígitos y empezar con 0');
    contactos.push([TIPO_CONTACTO.TELEFONO, telefono]);
  }
  if (whatsapp) {
    if (!REGEX_TELEFONO.test(whatsapp)) throw new ErrorHttp(400, 'Ingrese un WhatsApp ecuatoriano de 10 dígitos o use +593 sin el cero inicial');
    contactos.push([TIPO_CONTACTO.WHATSAPP, whatsapp]);
  }
  if (correo) {
    if (!REGEX_CORREO.test(correo)) throw new ErrorHttp(400, 'El correo de contacto no es válido');
    contactos.push([TIPO_CONTACTO.CORREO, correo]);
  }
  if (!contactos.length) throw new ErrorHttp(400, 'Ingrese al menos un dato de contacto (teléfono, WhatsApp o correo)');
  return contactos;
}

async function leerDatosAnimal(b, idTipo) {
  const idEspecie = entero(b.idEspecie, 'Especie');
  const idRaza = enteroOpcional(b.idRaza, 'Raza');
  if (idRaza && !(await una('SELECT 1 FROM raza WHERE id_raza = $1 AND id_especie = $2', [idRaza, idEspecie]))) {
    throw new ErrorHttp(400, 'La raza no corresponde a la especie');
  }
  const descripcion = texto(b.descripcion);
  if (descripcion.length < 10) throw new ErrorHttp(400, 'La descripción debe tener al menos 10 caracteres');
  const nombreAnimal = texto(b.nombreAnimal).slice(0, 60) || null;
  if (idTipo !== TIPO.ENCONTRADA && !nombreAnimal) throw new ErrorHttp(400, 'Ingrese el nombre de la mascota');
  return {
    idEspecie,
    idRaza,
    idTamano: enteroOpcional(b.idTamano, 'Tamaño'),
    colores: listaEnteros(b.colores, 'Color'),
    descripcion: descripcion.slice(0, 2000),
    nombreAnimal,
  };
}

// RF-21 y RF-22: procesa los archivos y valida las imágenes con IA antes de guardar nada
async function prepararArchivos(archivos) {
  const procesados = [];
  for (const [i, archivo] of archivos.entries()) {
    const p = await procesarArchivo(archivo, i);
    if (p.tipo === TIPO_MULTIMEDIA.IMAGEN) {
      const resultado = await ia.validarImagen(p.buffer, p.mime);
      if (resultado.valida === false) {
        throw new ErrorHttp(422, `La imagen ${i + 1} no fue aceptada: ${resultado.motivo || 'no se reconoce un animal'}. Reemplácela`);
      }
      p.esValidaIa = resultado.valida;
    } else {
      p.esValidaIa = null;
    }
    procesados.push(p);
  }
  return procesados;
}

async function guardarArchivos(tx, idPublicacion, archivos) {
  for (const a of archivos) {
    const [m] = await tx.consulta(
      `INSERT INTO multimedia (id_publicacion, id_tipo_multimedia, url, es_valida_ia) VALUES ($1, $2, '', $3)
       RETURNING id_multimedia`,
      [idPublicacion, a.tipo, a.esValidaIa],
    );
    await tx.consulta('UPDATE multimedia SET url = $1 WHERE id_multimedia = $2', [`/api/multimedia/${m.idMultimedia}`, m.idMultimedia]);
    await tx.consulta('INSERT INTO multimedia_archivo (id_multimedia, mime, datos) VALUES ($1, $2, $3)', [m.idMultimedia, a.mime, a.buffer]);
  }
}

async function guardarColoresYContactos(tx, idPublicacion, colores, contactos) {
  await tx.consulta('DELETE FROM publicacion_color WHERE id_publicacion = $1', [idPublicacion]);
  for (const idColor of colores) {
    await tx.consulta('INSERT INTO publicacion_color (id_publicacion, id_color) VALUES ($1, $2)', [idPublicacion, idColor]);
  }
  await tx.consulta('DELETE FROM contacto_publicacion WHERE id_publicacion = $1', [idPublicacion]);
  for (const [tipo, valor] of contactos) {
    await tx.consulta(
      'INSERT INTO contacto_publicacion (id_publicacion, id_tipo_contacto, valor) VALUES ($1, $2, $3)',
      [idPublicacion, tipo, valor],
    );
  }
}

async function buscarPropia(req) {
  const id = entero(req.params.id);
  const p = await una('SELECT id_publicacion, id_usuario, id_tipo, id_estado FROM publicacion WHERE id_publicacion = $1', [id]);
  if (!p) throw new ErrorHttp(404, 'Publicación no encontrada');
  // RNF-13: solo el autor o el administrador pueden modificar o eliminar
  if (p.idUsuario !== req.usuario.id && !req.usuario.esAdmin) {
    throw new ErrorHttp(403, 'Solo el autor de la publicación puede modificarla');
  }
  return p;
}

// ---------- Endpoints ----------

// RF-16: búsqueda y filtros
async function listar(req, res) {
  const f = req.query;
  const pagina = Math.max(1, Number(f.pagina) || 1);
  const condiciones = [];
  const params = [];
  const agregar = (sql, valor) => { params.push(valor); condiciones.push(sql.replaceAll('?', `$${params.length}`)); };

  if (f.tipo) agregar('p.id_tipo = ?', entero(f.tipo, 'Tipo'));
  if (f.sinAvistamientos === 'true') agregar('p.id_tipo <> ?', TIPO.ENCONTRADA);
  if (f.estado) agregar('p.id_estado = ?', entero(f.estado, 'Estado'));
  if (f.activas === 'true') condiciones.push('p.id_estado IN (1, 3, 5)');
  if (f.especie) agregar('p.id_especie = ?', entero(f.especie, 'Especie'));
  if (f.raza) agregar('p.id_raza = ?', entero(f.raza, 'Raza'));
  if (f.tamano) agregar('p.id_tamano = ?', entero(f.tamano, 'Tamaño'));
  if (f.color) agregar('EXISTS (SELECT 1 FROM publicacion_color pc WHERE pc.id_publicacion = p.id_publicacion AND pc.id_color = ?)', entero(f.color, 'Color'));
  if (f.provincia) agregar('pr.id_provincia = ?', entero(f.provincia, 'Provincia'));
  if (f.canton) agregar('c.id_canton = ?', entero(f.canton, 'Cantón'));
  if (f.sector) agregar('s.id_sector = ?', entero(f.sector, 'Sector'));
  if (f.refugio) agregar('rf.id_refugio = ?', entero(f.refugio, 'Refugio'));
  if (texto(f.q)) {
    agregar("CONCAT_WS(' ', p.nombre_animal, p.descripcion, rz.nombre, e.nombre, s.nombre, c.nombre, ub.direccion, rf.nombre) ILIKE ?", `%${texto(f.q)}%`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const datos = await consulta(
    `SELECT *, COUNT(*) OVER()::int AS total_filas FROM (${SELECT_PUBLICACION} ${where}) x
     ORDER BY fecha_creacion DESC, id DESC LIMIT ${POR_PAGINA} OFFSET ${(pagina - 1) * POR_PAGINA}`,
    params,
  );
  let total = datos[0]?.totalFilas;
  if (total === undefined) {
    // Página vacía: se cuenta aparte para informar el total real
    const [fila] = await consulta(`SELECT COUNT(*)::int AS total FROM (${SELECT_PUBLICACION} ${where}) x`, params);
    total = fila.total;
  }
  datos.forEach((d) => { delete d.totalFilas; delete d.idUsuario; });
  res.json({ datos, total, pagina, paginas: Math.max(1, Math.ceil(total / POR_PAGINA)) });
}

// Totales para las tarjetas de la página de inicio
async function resumen(req, res) {
  const filas = await consulta(
    'SELECT id_tipo, COUNT(*)::int AS total FROM publicacion WHERE id_estado IN (1, 3, 5) GROUP BY id_tipo',
  );
  const r = { desaparecidas: 0, encontradas: 0, adopcion: 0 };
  for (const f of filas) r[{ 1: 'desaparecidas', 2: 'encontradas', 3: 'adopcion' }[f.idTipo]] = f.total;
  const [{ reunidas, recuperadas }] = await consulta(
    `SELECT COUNT(*)::int AS reunidas, (COUNT(*) FILTER (WHERE id_tipo = $1 AND id_estado = $2))::int AS recuperadas
     FROM publicacion WHERE id_estado IN (2, 4, 6)`,
    [TIPO.DESAPARECIDA, ESTADO.RECUPERADA],
  );
  res.json({ ...r, recuperadas, resueltas: reunidas });
}

// Detalle. RNF-05: el contacto solo se muestra a usuarios con sesión iniciada
async function obtener(req, res) {
  res.set('Cache-Control', 'no-store');
  const id = entero(req.params.id);
  const p = await obtenerPorId(id);
  if (!p) throw new ErrorHttp(404, 'Publicación no encontrada');
  p.multimedia = await consulta(
    `SELECT m.id_multimedia AS id, m.url, tm.nombre AS tipo, m.es_valida_ia
     FROM multimedia m JOIN tipo_multimedia tm ON tm.id_tipo_multimedia = m.id_tipo_multimedia
     WHERE m.id_publicacion = $1 ORDER BY m.id_multimedia`,
    [id],
  );
  const esAutor = req.usuario && req.usuario.id === p.idUsuario;
  p.esAutor = Boolean(esAutor);
  if (esAutor && p.custodia) {
    p.notasCustodia = (await una('SELECT notas FROM custodia_refugio WHERE id_publicacion = $1', [id]))?.notas || null;
  }
  if (req.usuario) {
    p.contactos = await contactosPublicacion(consulta, id, Boolean(esAutor));
    const autor = await una('SELECT nombres, apellidos FROM usuario WHERE id_usuario = $1', [p.idUsuario]);
    p.autor = `${autor.nombres} ${autor.apellidos.charAt(0)}.`;
  } else {
    p.contactos = null;
  }
  if (!esAutor && !req.usuario?.esAdmin) delete p.idUsuario;
  res.json(p);
}

async function misPublicaciones(req, res) {
  const datos = await consulta(
    `SELECT x.*,
       (SELECT COUNT(*)::int FROM coincidencia co WHERE co.id_estado = 1
          AND (co.id_desaparecida = x.id OR co.id_encontrada = x.id)) AS coincidencias
     FROM (${SELECT_PUBLICACION} WHERE p.id_usuario = $1) x ORDER BY fecha_creacion DESC, id DESC`,
    [req.usuario.id],
  );
  res.json(datos);
}

// RF-07 y RNF-05: muestra avistamientos vinculados desde la ficha con sus fotos y observaciones públicas.
async function listarAvistamientos(req, res) {
  const id = entero(req.params.id);
  const antesDe = enteroOpcional(req.query.antesDe, 'Avistamiento anterior');
  if (!(await una('SELECT 1 FROM publicacion WHERE id_publicacion = $1 AND id_tipo = $2', [id, TIPO.DESAPARECIDA]))) {
    throw new ErrorHttp(404, 'Reporte de desaparición no encontrado');
  }
  const datos = await consulta(
    `SELECT p.id_publicacion AS id, p.descripcion, r.fecha_evento, to_char(r.hora_evento, 'HH24:MI') AS hora_evento,
            s.nombre AS sector, c.nombre AS canton,
            CASE WHEN $5::boolean THEN u.nombres || ' ' || LEFT(u.apellidos, 1) || '.' END AS autor,
            COALESCE((SELECT json_agg(json_build_object('id', m.id_multimedia, 'url', m.url) ORDER BY m.id_multimedia)
                      FROM multimedia m WHERE m.id_publicacion = p.id_publicacion AND m.id_tipo_multimedia = $4), '[]') AS fotos
     FROM reporte r JOIN publicacion p USING (id_publicacion) JOIN usuario u ON u.id_usuario = p.id_usuario
     JOIN ubicacion ub ON ub.id_ubicacion = r.id_ubicacion JOIN sector s USING (id_sector) JOIN canton c USING (id_canton)
     WHERE r.id_desaparicion_origen = $1 AND p.id_tipo = $2 AND ($3::int IS NULL OR r.id_publicacion < $3)
     ORDER BY r.id_publicacion DESC LIMIT $6`,
    [id, TIPO.ENCONTRADA, antesDe, TIPO_MULTIMEDIA.IMAGEN, Boolean(req.usuario), POR_PAGINA + 1],
  );
  const siguiente = datos.length > POR_PAGINA ? datos[POR_PAGINA - 1].id : null;
  res.set('Cache-Control', 'no-store').json({ datos: datos.slice(0, POR_PAGINA), siguiente });
}

// RF-04, RF-07, RF-12: crear reporte de desaparecida, encontrado o publicación de adopción
async function crear(req, res) {
  const b = req.body;
  const idTipo = entero(b.tipo, 'Tipo de publicación');
  if (!Object.values(TIPO).includes(idTipo)) throw new ErrorHttp(400, 'Tipo de publicación inválido');
  const idDesaparicionOrigen = enteroOpcional(b.idDesaparicionOrigen, 'Publicación de origen');
  if (idDesaparicionOrigen && idTipo !== TIPO.ENCONTRADA) {
    throw new ErrorHttp(400, 'Solo los avistamientos se pueden vincular a una desaparición');
  }
  if (idTipo === TIPO.ADOPCION && !req.usuario.esAdmin) {
    if (req.usuario.rol !== ROL.REFUGIO) throw new ErrorHttp(403, 'Solo los refugios pueden publicar animales en adopción');
    if (!req.usuario.refugioAutorizado) throw new ErrorHttp(403, 'Su refugio aún no ha sido autorizado por el administrador');
  }
  const archivos = req.files || [];
  if (archivos.length < 1) throw new ErrorHttp(400, 'Agregue al menos una foto (máximo 5)');

  const animal = await leerDatosAnimal(b, idTipo);
  const hora = idTipo === TIPO.ENCONTRADA ? leerHora(b.horaEvento) : null;
  if (idTipo !== TIPO.ENCONTRADA && (b.idRefugioCustodia || b.situacionTraslado !== undefined)) throw new ErrorHttp(400, 'Solo los avistamientos admiten traslados a refugios');
  const contactos = leerContactos(b);
  let ubicacion;
  let fechaEvento;
  let estadoSalud;
  if (idTipo === TIPO.ADOPCION) {
    estadoSalud = texto(b.estadoSalud);
    if (!estadoSalud) throw new ErrorHttp(400, 'Describa el estado de salud del animal');
  } else {
    ubicacion = leerUbicacion(b);
    if (!b.fechaEvento) throw new ErrorHttp(400, 'Ingrese la fecha');
    fechaEvento = fechaPasada(b.fechaEvento);
  }
  const procesados = await prepararArchivos(archivos);
  if (!procesados.some((a) => a.tipo === TIPO_MULTIMEDIA.IMAGEN)) {
    throw new ErrorHttp(400, 'Agregue al menos una foto. Los videos son opcionales');
  }

  const id = await transaccion(async (tx) => {
    if (idDesaparicionOrigen) {
      const [origen] = await tx.consulta(`SELECT p.id_estado, p.id_especie FROM publicacion p JOIN reporte r USING (id_publicacion)
        WHERE p.id_publicacion = $1 AND p.id_tipo = $2 FOR SHARE OF p`, [idDesaparicionOrigen, TIPO.DESAPARECIDA]);
      if (!origen) throw new ErrorHttp(404, 'Reporte de desaparición no encontrado');
      if (origen.idEstado !== ESTADO.DESAPARECIDA_PENDIENTE) throw new ErrorHttp(409, 'El reporte de desaparición ya está cerrado');
      if (origen.idEspecie !== animal.idEspecie) throw new ErrorHttp(400, 'El avistamiento debe corresponder a la especie de la mascota perdida');
    }
    const [pub] = await tx.consulta(
      `INSERT INTO publicacion (id_usuario, id_tipo, id_estado, id_especie, id_raza, id_tamano, nombre_animal, descripcion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_publicacion`,
      [req.usuario.id, idTipo, ESTADO_INICIAL[idTipo], animal.idEspecie, animal.idRaza, animal.idTamano, animal.nombreAnimal, animal.descripcion],
    );
    const idPub = pub.idPublicacion;
    if (idTipo === TIPO.ADOPCION) {
      await tx.consulta('INSERT INTO adopcion (id_publicacion, estado_salud) VALUES ($1, $2)', [idPub, estadoSalud.slice(0, 200)]);
    } else {
      const idUbicacion = await guardarUbicacion(tx.consulta, ubicacion);
      await tx.consulta(`INSERT INTO reporte (id_publicacion, id_ubicacion, fecha_evento, hora_evento, id_desaparicion_origen)
        VALUES ($1, $2, $3, $4, $5)`, [idPub, idUbicacion, fechaEvento, hora, idDesaparicionOrigen]);
      if (idTipo === TIPO.ENCONTRADA) await guardarCustodia(tx.consulta, idPub, req.usuario.id, b);
    }
    await guardarColoresYContactos(tx, idPub, animal.colores, contactos);
    await guardarArchivos(tx, idPub, procesados);
    return idPub;
  });

  if (idTipo !== TIPO.ADOPCION) coincidencias.analizarEnSegundoPlano(id);
  if (idTipo === TIPO.DESAPARECIDA) {
    alertas.enviarAlertasProximidad(id).catch((err) => console.error('[alertas]', err.message));
  }
  res.status(201).json(await obtenerPorId(id));
}

// RF-05 y RF-21: al editar debe quedar al menos una foto y un máximo de cinco archivos.
async function actualizar(req, res) {
  const actual = await buscarPropia(req);
  const b = req.body;
  const hora = actual.idTipo === TIPO.ENCONTRADA ? leerHora(b.horaEvento) : null;
  const informaTraslado = b.idRefugioCustodia !== undefined || b.situacionTraslado !== undefined;
  if (actual.idTipo !== TIPO.ENCONTRADA && (b.idRefugioCustodia || b.situacionTraslado !== undefined)) throw new ErrorHttp(400, 'Solo los avistamientos admiten traslados a refugios');
  if (informaTraslado && req.usuario.id !== actual.idUsuario) throw new ErrorHttp(403, 'Solo el autor puede informar un traslado');
  const animal = await leerDatosAnimal(b, actual.idTipo);
  const contactos = leerContactos(b);
  const quitar = listaEnteros(b.quitarArchivos, 'Archivo');
  const procesados = await prepararArchivos(req.files || []);

  let ubicacion;
  let fechaEvento;
  let estadoSalud;
  if (actual.idTipo === TIPO.ADOPCION) {
    estadoSalud = texto(b.estadoSalud);
    if (!estadoSalud) throw new ErrorHttp(400, 'Describa el estado de salud del animal');
  } else {
    ubicacion = leerUbicacion(b);
    fechaEvento = fechaPasada(b.fechaEvento);
  }

  await transaccion(async (tx) => {
    // El UPDATE bloquea la publicación hasta confirmar el total de archivos de esta edición.
    const [publicacion] = await tx.consulta(
      `UPDATE publicacion SET id_especie = $1, id_raza = $2, id_tamano = $3, nombre_animal = $4, descripcion = $5
       WHERE id_publicacion = $6 RETURNING id_publicacion, id_tipo_contacto_visible`,
      [animal.idEspecie, animal.idRaza, animal.idTamano, animal.nombreAnimal, animal.descripcion, actual.idPublicacion],
    );
    if (!publicacion) throw new ErrorHttp(404, 'Publicación no encontrada');
    const visible = publicacion.idTipoContactoVisible;
    if (visible && !contactos.some(([tipo]) => tipo === visible)) {
      throw new ErrorHttp(400, 'Elige otro contacto visible en Seguridad y privacidad antes de quitar el actual');
    }
    const [{ total, fotos }] = await tx.consulta(
      `SELECT COUNT(*)::int AS total, (COUNT(*) FILTER (WHERE id_tipo_multimedia = $3))::int AS fotos
       FROM multimedia WHERE id_publicacion = $1 AND NOT (id_multimedia = ANY($2::int[]))`,
      [actual.idPublicacion, quitar, TIPO_MULTIMEDIA.IMAGEN],
    );
    if (!fotos && !procesados.some((a) => a.tipo === TIPO_MULTIMEDIA.IMAGEN)) {
      throw new ErrorHttp(400, 'La publicación debe tener al menos una foto');
    }
    if (total + procesados.length > MAX_ARCHIVOS) throw new ErrorHttp(400, 'Puede tener como máximo 5 fotos o videos');
    if (actual.idTipo === TIPO.ADOPCION) {
      await tx.consulta('UPDATE adopcion SET estado_salud = $1 WHERE id_publicacion = $2', [estadoSalud.slice(0, 200), actual.idPublicacion]);
    } else {
      const [rep] = await tx.consulta('SELECT id_ubicacion FROM reporte WHERE id_publicacion = $1', [actual.idPublicacion]);
      await guardarUbicacion(tx.consulta, ubicacion, rep.idUbicacion);
      await tx.consulta('UPDATE reporte SET fecha_evento = $1 WHERE id_publicacion = $2', [fechaEvento, actual.idPublicacion]);
      if (actual.idTipo === TIPO.ENCONTRADA) {
        if (b.horaEvento !== undefined) await tx.consulta('UPDATE reporte SET hora_evento = $1 WHERE id_publicacion = $2', [hora, actual.idPublicacion]);
        await guardarCustodia(tx.consulta, actual.idPublicacion, actual.idUsuario, b);
      }
    }
    if (quitar.length) {
      await tx.consulta('DELETE FROM multimedia WHERE id_publicacion = $1 AND id_multimedia = ANY($2::int[])', [actual.idPublicacion, quitar]);
    }
    await guardarColoresYContactos(tx, actual.idPublicacion, animal.colores, contactos);
    await guardarArchivos(tx, actual.idPublicacion, procesados);
  });

  if (actual.idTipo !== TIPO.ADOPCION) coincidencias.analizarEnSegundoPlano(actual.idPublicacion);
  res.json(await obtenerPorId(actual.idPublicacion));
}

// RF-06 y RF-14: cambiar el estado (Pendiente/Recuperada, Pendiente/Entregada, Disponible/Adoptado)
async function cambiarEstado(req, res) {
  const actual = await buscarPropia(req);
  const idEstado = entero(req.body.idEstado, 'Estado');
  if (!ESTADOS_POR_TIPO[actual.idTipo].includes(idEstado)) throw new ErrorHttp(400, 'Estado no válido para este tipo de publicación');
  if (idEstado === ESTADO.RECUPERADA && actual.idUsuario !== req.usuario.id) throw new ErrorHttp(403, 'Solo el propietario puede confirmar la recuperación');
  if (idEstado === ESTADO.RECUPERADA) {
    await transaccion((tx) => confirmarRecuperacion(tx.consulta, actual.idPublicacion));
  } else {
    await una('UPDATE publicacion SET id_estado = $1 WHERE id_publicacion = $2', [idEstado, actual.idPublicacion]);
  }
  if (idEstado === ESTADO_INICIAL[actual.idTipo] && actual.idTipo !== TIPO.ADOPCION) {
    coincidencias.analizarEnSegundoPlano(actual.idPublicacion);
  }
  res.json(await obtenerPorId(actual.idPublicacion));
}

// RF-05: eliminar
async function eliminar(req, res) {
  const actual = await buscarPropia(req);
  await consulta('DELETE FROM publicacion WHERE id_publicacion = $1', [actual.idPublicacion]);
  res.status(204).end();
}

// RF-15 / CU-11: el interesado obtiene el contacto y se notifica al refugio
async function interesAdopcion(req, res) {
  const id = entero(req.params.id);
  const p = await una('SELECT id_usuario, id_tipo, id_estado, nombre_animal FROM publicacion WHERE id_publicacion = $1', [id]);
  if (!p || p.idTipo !== TIPO.ADOPCION) throw new ErrorHttp(404, 'Publicación de adopción no encontrada');
  if (p.idEstado !== 5) throw new ErrorHttp(400, 'Este animal ya fue adoptado');
  if (p.idUsuario === req.usuario.id) throw new ErrorHttp(400, 'Esta es su propia publicación');
  const yaAviso = await una(
    `SELECT 1 FROM notificacion WHERE id_usuario = $1 AND id_publicacion = $2 AND id_tipo_notificacion = $3 AND mensaje LIKE $4`,
    [p.idUsuario, id, TIPO_NOTIFICACION.ADOPCION, `%${req.usuario.correo}%`],
  );
  if (!yaAviso) {
    await consulta(
      'INSERT INTO notificacion (id_usuario, id_publicacion, id_tipo_notificacion, mensaje) VALUES ($1, $2, $3, $4)',
      [p.idUsuario, id, TIPO_NOTIFICACION.ADOPCION,
        `${req.usuario.nombres} ${req.usuario.apellidos} (${req.usuario.correo}) está interesado en adoptar a ${p.nombreAnimal}`.slice(0, 255)],
    );
  }
  const contactos = await consulta(
    `SELECT tc.nombre AS tipo, cp.valor FROM contacto_publicacion cp
     JOIN tipo_contacto tc ON tc.id_tipo_contacto = cp.id_tipo_contacto WHERE cp.id_publicacion = $1 ORDER BY cp.id_tipo_contacto`,
    [id],
  );
  res.json({ contactos, mensaje: 'Notificamos al refugio de tu interés' });
}

module.exports = {
  listar, resumen, obtener, misPublicaciones, listarAvistamientos, crear, actualizar, cambiarEstado, eliminar, interesAdopcion, SELECT_PUBLICACION,
};
