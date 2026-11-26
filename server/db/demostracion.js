const { randomBytes } = require('node:crypto');
const { readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const { ROL, TIPO, ESTADO, ESTADO_INICIAL, TIPO_CONTACTO, TIPO_MULTIMEDIA, TIPO_NOTIFICACION, VERSION_POLITICA } = require('../src/lib/constantes');
const { usuarios, ubicaciones, refugios, perdidas, hallazgos, adopciones, valoraciones } = require('./demostracion-datos');

const baseDemo = 'findmypet_demostracion';
const firma = 'findmypet-presentacion-unemi';
const fotosExistentes = { michi: 'michi.webp', 'av-michi': 'michi-avistamiento.webp' };
const correoDemo = (clave) => `${clave}@presentacion.findmypet.test`;
const cuentasClasicas = [
  ['admin', 'admin'], ['sofia', 'ana', 'Ana', 'Torres'], ['mateo', 'luis', 'Luis', 'Mendoza'],
  ['huellitas', 'huellitas'], ['patitas', 'patitas'],
];
const esLocal = (url) => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  && ['postgres:', 'postgresql:'].includes(url.protocol);

async function prepararBase(base) {
  if (!esLocal(base) || base.pathname === `/${baseDemo}`) throw new Error('La demostración requiere una conexión local separada de la instalación habitual.');
  const url = new URL(base);
  url.pathname = '/postgres';
  url.search = '';
  const cliente = new Client({ connectionString: url.href, connectionTimeoutMillis: 5000 });
  try {
    await cliente.connect();
    if (!(await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [baseDemo])).rowCount) {
      await cliente.query('CREATE DATABASE findmypet_demostracion');
    }
  } catch (e) {
    if (e.code === '42501') throw new Error('El usuario local de PostgreSQL necesita permiso para crear la base findmypet_demostracion.');
    if (e.code !== '42P04') throw e;
  } finally {
    await cliente.end();
  }
  url.pathname = `/${baseDemo}`;
  return url.href;
}

async function claveLocal(archivo) {
  try {
    await writeFile(archivo, `${randomBytes(18).toString('base64url')}\n`, { flag: 'wx', mode: 0o600 });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  return (await readFile(archivo, 'utf8')).trim();
}

async function crearUbicacion(consultar, clave) {
  const [canton, sector, referencia, latitud, longitud] = ubicaciones[clave];
  const [ubicacion] = await consultar(`INSERT INTO ubicacion (id_sector, direccion, latitud, longitud)
    SELECT s.id_sector, $3, $4, $5 FROM sector s JOIN canton c USING (id_canton)
    WHERE c.nombre = $1 AND s.nombre = $2 RETURNING id_ubicacion`, [canton, sector, referencia, latitud, longitud]);
  return ubicacion.idUbicacion;
}

async function crearCuenta(consultar, clave, [nombres, apellidos], rol, hash) {
  const [usuario] = await consultar(`INSERT INTO usuario (id_rol, nombres, apellidos, correo, contrasena_hash, fecha_verificacion)
    VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id_usuario`, [rol, nombres, apellidos, correoDemo(clave), hash]);
  await consultar('INSERT INTO consentimiento (id_usuario, version_politica) VALUES ($1, $2)', [usuario.idUsuario, VERSION_POLITICA]);
  return usuario.idUsuario;
}

async function crearPublicacion(consultar, tipo, p, autor, foto, origen) {
  const [animal] = await consultar(`SELECT e.id_especie, rz.id_raza, t.id_tamano FROM especie e
    LEFT JOIN raza rz ON rz.id_especie = e.id_especie AND rz.nombre = $2
    JOIN tamano t ON t.nombre = $3 WHERE e.nombre = $1`, [p.especie, p.raza, p.tamano]);
  if (!animal || (p.raza && !animal.idRaza)) throw new Error(`Catálogo de especie, raza o tamaño inválido para ${p.clave}.`);
  const [publicacion] = await consultar(`INSERT INTO publicacion
    (id_usuario, id_tipo, id_estado, id_especie, id_raza, id_tamano, nombre_animal, descripcion, fecha_creacion)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() - $9::int * INTERVAL '4 hours') RETURNING id_publicacion`,
  [autor, tipo, ESTADO_INICIAL[tipo], animal.idEspecie, animal.idRaza, animal.idTamano, p.nombre || null, p.descripcion, p.dias]);
  const id = publicacion.idPublicacion;
  await consultar(`INSERT INTO publicacion_color (id_publicacion, id_color)
    SELECT $1, id_color FROM color WHERE nombre = ANY($2::text[])`, [id, p.colores]);
  await consultar('INSERT INTO contacto_publicacion (id_publicacion, id_tipo_contacto, valor) VALUES ($1, $2, $3)',
    [id, TIPO_CONTACTO.CORREO, correoDemo(p.autor)]);
  if (tipo === TIPO.ADOPCION) {
    await consultar('INSERT INTO adopcion (id_publicacion, estado_salud) VALUES ($1, $2)', [id, p.salud]);
  } else {
    const ubicacion = await crearUbicacion(consultar, p.lugar);
    await consultar(`INSERT INTO reporte (id_publicacion, id_ubicacion, fecha_evento, hora_evento, id_desaparicion_origen)
      VALUES ($1, $2, (NOW() AT TIME ZONE 'America/Guayaquil')::date - $3::int, $4, $5)`, [id, ubicacion, p.dias, p.hora || null, origen]);
  }
  const [m] = await consultar(`INSERT INTO multimedia (id_publicacion, id_tipo_multimedia, url)
    VALUES ($1, $2, '') RETURNING id_multimedia`, [id, TIPO_MULTIMEDIA.IMAGEN]);
  await consultar('UPDATE multimedia SET url = $1 WHERE id_multimedia = $2', [`/api/multimedia/${m.idMultimedia}`, m.idMultimedia]);
  await consultar('INSERT INTO multimedia_archivo (id_multimedia, mime, datos) VALUES ($1, $2, $3)', [m.idMultimedia, 'image/webp', foto]);
  return id;
}

async function inicializar(consultar, hash, fotos) {
  const { guardarCustodia, confirmarRecuperacion } = require('../src/services/avistamientos.service');
  const cuentas = {};
  const idsRefugios = {};
  const idsPublicaciones = {};
  for (const [clave, persona] of Object.entries(usuarios)) {
    cuentas[clave] = await crearCuenta(consultar, clave, persona, ROL.CIUDADANO, hash);
  }
  await crearCuenta(consultar, 'admin', ['Administración', 'de muestra'], ROL.ADMIN, hash);
  for (const r of refugios) {
    cuentas[r.clave] = await crearCuenta(consultar, r.clave, r.persona, ROL.REFUGIO, hash);
    const [refugio] = await consultar(`INSERT INTO refugio (id_usuario, id_ubicacion, nombre, autorizado)
      VALUES ($1, $2, $3, $4) RETURNING id_refugio`, [cuentas[r.clave], await crearUbicacion(consultar, r.lugar), r.nombre, r.autorizado]);
    idsRefugios[r.clave] = refugio.idRefugio;
  }
  for (const [vecino, zona] of [['mateo', 'centro'], ['camila', 'naranjito'], ['daniel', 'yaguachi']]) {
    await consultar('INSERT INTO preferencia_alerta (id_usuario, id_ubicacion, radio_km) VALUES ($1, $2, 4)',
      [cuentas[vecino], await crearUbicacion(consultar, zona)]);
  }
  for (const [tipo, ejemplos] of [[TIPO.DESAPARECIDA, perdidas], [TIPO.ENCONTRADA, hallazgos], [TIPO.ADOPCION, adopciones]]) {
    for (const p of ejemplos) {
      const autor = cuentas[p.autor];
      const id = await crearPublicacion(consultar, tipo, p, autor, fotos[p.clave], idsPublicaciones[p.origen] || null);
      idsPublicaciones[p.clave] = id;
      if (p.refugio) {
        await guardarCustodia(consultar, id, autor, {
          situacionTraslado: 'realizado', idRefugioCustodia: idsRefugios[p.refugio],
          notasCustodia: 'Avisé al equipo durante la entrega. La identidad del animal está por verificar.',
        });
      }
      // Solo historias en las que la familia ya confirmó el regreso. Los traslados siguen pendientes.
      if (p.recuperada) await confirmarRecuperacion(consultar, id);
    }
  }
  for (const [refugio, autor, calificacion, comentario] of valoraciones) {
    await consultar('INSERT INTO valoracion (id_refugio, id_usuario, calificacion, comentario) VALUES ($1, $2, $3, $4)',
      [idsRefugios[refugio], cuentas[autor], calificacion, comentario]);
  }
  return perdidas.filter((p) => !p.recuperada).map((p) => idsPublicaciones[p.clave]);
}

async function restaurarAccesosClasicos({ consulta, ejecutar }) {
  await ejecutar('ALTER TABLE demo_lote ADD COLUMN IF NOT EXISTS accesos_clasicos BOOLEAN NOT NULL DEFAULT FALSE');
  const [lote] = await consulta('SELECT accesos_clasicos FROM demo_lote WHERE firma = $1', [firma]);
  if (lote.accesosClasicos) return;

  // Contraseña pública solicitada para estas cinco cuentas de la base de presentación aislada.
  const hash = await bcrypt.hash('Clave1234', 10);
  for (const [anterior, local, nombres, apellidos] of cuentasClasicas) {
    const origen = correoDemo(anterior);
    const destino = `${local}@findmypet.test`;
    const [cuenta] = await consulta('SELECT id_usuario FROM usuario WHERE correo = $1', [origen]);
    if (!cuenta) continue;
    if ((await consulta('SELECT 1 FROM usuario WHERE correo = $1', [destino])).length) {
      throw new Error(`La demostración ya tiene otra cuenta con ${destino}. Se conservaron ambas cuentas.`);
    }
    const { idUsuario } = cuenta;
    await consulta(`UPDATE usuario SET correo = $1, contrasena_hash = $2, nombres = COALESCE($4, nombres),
      apellidos = COALESCE($5, apellidos) WHERE id_usuario = $3`, [destino, hash, idUsuario, nombres, apellidos]);
    await consulta(`UPDATE contacto_publicacion cp SET valor = $1 FROM publicacion p
      WHERE cp.id_publicacion = p.id_publicacion AND p.id_usuario = $2 AND cp.id_tipo_contacto = $3 AND cp.valor = $4`,
    [destino, idUsuario, TIPO_CONTACTO.CORREO, origen]);
    await consulta('DELETE FROM sesion_usuario WHERE id_usuario = $1', [idUsuario]);
    await consulta('DELETE FROM token_usuario WHERE id_usuario = $1', [idUsuario]);
  }
  await consulta('UPDATE demo_lote SET accesos_clasicos = TRUE WHERE firma = $1', [firma]);
}

async function poblar(archivoClave) {
  const url = new URL(process.env.DATABASE_URL);
  if (!esLocal(url) || url.pathname !== `/${baseDemo}`) throw new Error('La carga de demostración solo funciona en su base PostgreSQL local dedicada.');
  const db = require('../src/lib/db');
  const { analizarReporte } = require('../src/services/coincidencias.service');
  const { enviarAlertasProximidad } = require('../src/services/alertas.service');
  const candado = await db.pool.connect();
  try {
    await candado.query('SELECT pg_advisory_lock(117793108, 1)');
    const destino = await db.una(`SELECT current_database() AS nombre, to_regclass('public.demo_lote') AS lote,
      EXISTS (SELECT 1 FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')) AS tiene_tablas`);
    if (destino.nombre !== baseDemo) throw new Error('La conexión no apunta a la base de demostración.');
    let lote = destino.lote && await db.una('SELECT * FROM demo_lote WHERE firma = $1', [firma]);
    const esquema = await readFile(join(__dirname, 'schema.sql'), 'utf8');
    if (!lote) {
      if (destino.tieneTablas) {
        throw new Error('La base asignada contiene datos que no reconoce el generador. Se rechazó la carga.');
      }
      const ejemplos = [...perdidas, ...hallazgos, ...adopciones];
      const fotos = Object.fromEntries(await Promise.all(ejemplos.map(async ({ clave }) => {
        const archivo = fotosExistentes[clave];
        const ruta = archivo ? join(__dirname, 'fotos-demo', archivo) : join(__dirname, 'fotos-presentacion', `${clave}.webp`);
        return [clave, await readFile(ruta)];
      })));
      const hash = await bcrypt.hash(await claveLocal(archivoClave), 10);
      await db.transaccion(async ({ consulta, ejecutar }) => {
        await ejecutar(esquema);
        await consulta(`CREATE TABLE demo_lote (
          firma TEXT PRIMARY KEY, perdidas INTEGER[] NOT NULL, terminada BOOLEAN NOT NULL DEFAULT FALSE)`);
        const pendientes = await inicializar(consulta, hash, fotos);
        [lote] = await consulta('INSERT INTO demo_lote (firma, perdidas) VALUES ($1, $2) RETURNING *', [firma, pendientes]);
      });
    } else {
      await candado.query(esquema);
    }
    if (!lote.accesosClasicos) await db.transaccion(restaurarAccesosClasicos);
    if (!lote.terminada) {
      for (const id of lote.perdidas) {
        const pendiente = await db.una('SELECT 1 FROM publicacion WHERE id_publicacion = $1 AND id_estado = $2', [id, ESTADO.DESAPARECIDA_PENDIENTE]);
        if (!pendiente) continue;
        await analizarReporte(id);
        if (!(await db.una('SELECT 1 FROM notificacion WHERE id_publicacion = $1 AND id_tipo_notificacion = $2 LIMIT 1',
          [id, TIPO_NOTIFICACION.PROXIMIDAD]))) {
          await enviarAlertasProximidad(id);
        }
      }
      await db.consulta('UPDATE demo_lote SET terminada = TRUE WHERE firma = $1', [firma]);
    }
  } finally {
    await candado.query('SELECT pg_advisory_unlock(117793108, 1)').finally(() => candado.release());
  }
}

module.exports = { prepararBase, poblar };
