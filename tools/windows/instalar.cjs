const { readFile, writeFile, appendFile } = require('node:fs/promises');
const { randomBytes } = require('node:crypto');
const { resolve, join } = require('node:path');
const { createRequire } = require('node:module');
const iniciarPostgresPortatil = require('./postgres-portatil.cjs');

const servidor = resolve(__dirname, '../../server');
const rutaEnv = join(servidor, '.env');
const cargarServidor = createRequire(join(servidor, 'package.json'));
const local = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

class ErrorInstalacion extends Error {
  constructor(mensaje, codigo = 1) {
    super(mensaje);
    this.codigo = codigo;
  }
}

function urlLocal(valor) {
  let url;
  try { url = new URL(valor); } catch { throw new ErrorInstalacion('Hay una URL de base de datos inválida en server/.env. Se conservó ese archivo.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !local.has(url.hostname)) {
    throw new ErrorInstalacion('El instalador prepara bases de PostgreSQL en este equipo. La conexión configurada en server/.env se conservó.');
  }
  if (!url.pathname.slice(1)) throw new ErrorInstalacion('La URL de PostgreSQL debe indicar el nombre de la base.');
  return url;
}

function nombreBase(url) {
  const nombre = decodeURIComponent(url.pathname.slice(1));
  if (['postgres', 'template0', 'template1'].includes(nombre.toLowerCase()) || nombre.includes('\0') || Buffer.byteLength(nombre) > 63) {
    throw new ErrorInstalacion('Selecciona una base destinada a FindMyPet. La configuración se conservó.');
  }
  return nombre;
}

async function datosIntroducidos() {
  if (!process.argv.includes('--credenciales')) return null;
  let entrada = '';
  process.stdin.setEncoding('utf8');
  for await (const parte of process.stdin) entrada += parte;
  const datos = JSON.parse(entrada);
  if (!local.has(datos.host) || !/^\d{1,5}$/.test(datos.port) || Number(datos.port) < 1 || Number(datos.port) > 65535 || !datos.user) {
    throw new ErrorInstalacion('Revisa el servidor local, el puerto y el usuario de PostgreSQL.');
  }
  const host = datos.host === '::1' ? '[::1]' : datos.host;
  const credenciales = encodeURIComponent(datos.user) + (datos.password ? `:${encodeURIComponent(datos.password)}` : '');
  return new URL(`postgresql://${credenciales}@${host}:${datos.port}/findmypet`);
}

async function conBase(url, ejecutar) {
  const { Client } = cargarServidor('pg');
  const cliente = new Client({ connectionString: url.href, connectionTimeoutMillis: 4500 });
  try {
    await cliente.connect();
    return await ejecutar(cliente);
  } finally {
    await cliente.end();
  }
}

async function asegurarBase(url, nombre) {
  const version = async (cliente) => (await cliente.query("SELECT current_setting('server_version_num')::int AS version")).rows[0].version;
  try {
    return await conBase(url, version);
  } catch (e) {
    if (e.code !== '3D000') throw e;
  }
  const mantenimiento = new URL(url);
  mantenimiento.pathname = '/postgres';
  await conBase(mantenimiento, async (cliente) => {
    const instalada = await version(cliente);
    if (instalada < 140000) throw new ErrorInstalacion('FindMyPet requiere PostgreSQL 14 o posterior.');
    // PostgreSQL admite parámetros para valores. CREATE DATABASE requiere un identificador entre comillas.
    const identificador = '"' + nombre.replaceAll('"', '""') + '"';
    try { await cliente.query(`CREATE DATABASE ${identificador}`); }
    catch (e) { if (e.code !== '42P04') throw e; }
  });
  return conBase(url, version);
}

async function guardarEnv(original, nuevos) {
  if (!Object.keys(nuevos).length) return;
  const texto = Object.entries(nuevos).map(([campo, valor]) => `${campo}=${JSON.stringify(valor)}\n`).join('');
  if (original === null) {
    await writeFile(rutaEnv, texto, { flag: 'wx' });
  } else {
    if (await readFile(rutaEnv, 'utf8') !== original) {
      throw new ErrorInstalacion('server/.env cambió mientras se instalaba. Vuelve a ejecutar el instalador.');
    }
    await appendFile(rutaEnv, original.endsWith('\n') || !original ? texto : '\n' + texto, { flag: 'a' });
  }
  console.log('Configuración local guardada en server/.env.');
}

async function instalar() {
  const dotenv = cargarServidor('dotenv');
  const original = await readFile(rutaEnv, 'utf8').catch((e) => {
    if (e.code === 'ENOENT') return null;
    throw e;
  });
  const actual = dotenv.parse(original || '');
  const nuevaConexion = !actual.DATABASE_URL;
  const desarrollo = nuevaConexion ? await datosIntroducidos() : urlLocal(actual.DATABASE_URL);
  if (!desarrollo) return 10;
  const pruebas = actual.TEST_DATABASE_URL ? urlLocal(actual.TEST_DATABASE_URL) : new URL(desarrollo);
  if (!actual.TEST_DATABASE_URL) pruebas.pathname = '/findmypet_test';
  const bdAplicacion = nombreBase(desarrollo);
  const bdPruebas = nombreBase(pruebas);
  if (bdAplicacion === bdPruebas) {
    throw new ErrorInstalacion('La base de pruebas debe tener un nombre diferente de la base de la aplicación. Se conservó server/.env.');
  }

  try { iniciarPostgresPortatil(desarrollo); }
  catch (e) { throw new ErrorInstalacion(e.message); }
  try {
    const version = await asegurarBase(desarrollo, bdAplicacion);
    if (version < 140000 || await asegurarBase(pruebas, bdPruebas) < 140000) {
      throw new ErrorInstalacion('FindMyPet requiere PostgreSQL 14 o posterior.');
    }
    console.log(`PostgreSQL ${Math.floor(version / 10000)} conectado. Bases de aplicación y de pruebas verificadas.`);
  } catch (e) {
    if (e.code === '28P01' || /password must be a string/i.test(e.message)) {
      if (nuevaConexion && !desarrollo.password) return 11;
      throw new ErrorInstalacion(nuevaConexion ? 'La contraseña o el usuario de PostgreSQL no son válidos. Abre de nuevo el instalador e inténtalo.' :
        'PostgreSQL rechazó las credenciales guardadas en server/.env. Se conservó el archivo. Verifica esa cuenta y su contraseña con quien administra PostgreSQL.');
    }
    if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH'].includes(e.code) || /timeout/i.test(e.message)) {
      throw new ErrorInstalacion('No se pudo conectar a PostgreSQL. Comprueba que esté iniciado y que el puerto sea correcto.', 12);
    }
    if (e.code === '42501') throw new ErrorInstalacion('El usuario de PostgreSQL no tiene permiso para preparar las bases. Pide a su administrador que cree las bases y te dé acceso.');
    throw e;
  }

  const valores = {
    DATABASE_URL: desarrollo.href,
    TEST_DATABASE_URL: pruebas.href,
    JWT_SECRET: actual.JWT_SECRET || randomBytes(48).toString('hex'),
    PORT: '4000',
    FRONTEND_URL: 'http://localhost:5173',
    CORS_ORIGIN: 'http://localhost:5173',
  };
  Object.assign(process.env, actual, { DATABASE_URL: desarrollo.href });
  const migrar = cargarServidor('./db/migrar');
  const { pool } = cargarServidor('./src/lib/db');
  try {
    console.log('Aplicando migraciones y catálogos iniciales...');
    await migrar();
  } finally {
    await pool.end();
  }
  await guardarEnv(original, Object.fromEntries(Object.entries(valores).filter(([campo]) => !actual[campo])));
  console.log('Tablas y catálogos preparados. La base de pruebas queda separada.');
  return 0;
}

instalar().then((codigo) => { process.exitCode = codigo; }).catch((e) => {
  console.error(e instanceof ErrorInstalacion ? e.message : `No se pudo preparar FindMyPet (${e.code || 'error de configuración'}). Revisa permisos de PostgreSQL y acceso a la carpeta del proyecto.`);
  process.exitCode = e.codigo || 1;
});
