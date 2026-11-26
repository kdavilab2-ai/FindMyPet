const net = require('node:net');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { existsSync, realpathSync, mkdirSync, openSync, closeSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');
const iniciarPostgresPortatil = require('./postgres-portatil.cjs');

const raiz = realpathSync(resolve(__dirname, '../..'));
const carpetaApi = join(raiz, 'server');
const carpetaWeb = join(raiz, 'client');
const rutaEnv = join(carpetaApi, '.env');
const runtime = join(raiz, '.runtime', 'windows');
const enlace = 'http://localhost:5173';
const id = createHash('sha256').update(raiz.toLowerCase()).digest('hex').slice(0, 24);
const canal = String.raw`\\.\pipe\findmypet-${id}`;
const cargarApi = createRequire(join(carpetaApi, 'package.json'));
const cargarWeb = createRequire(join(carpetaWeb, 'package.json'));
const esperar = (ms) => new Promise((fin) => setTimeout(fin, ms));

function control(orden) {
  return new Promise((fin) => {
    const socket = net.createConnection(canal, () => socket.end(orden));
    let respuesta = '';
    socket.setTimeout(1500, () => socket.destroy());
    socket.on('data', (parte) => { respuesta += parte; });
    socket.on('error', () => socket.destroy());
    socket.on('close', () => fin(respuesta || null));
  });
}

function escuchar(servidor, ...opciones) {
  return new Promise((fin, fallo) => {
    servidor.once('error', fallo);
    servidor.listen(...opciones, () => {
      servidor.removeListener('error', fallo);
      fin();
    });
  });
}

function puertoOcupado(puerto, host) {
  return new Promise((fin) => {
    const socket = net.createConnection({ port: puerto, host }, () => { socket.destroy(); fin(true); });
    socket.setTimeout(1200, () => socket.destroy());
    socket.on('error', () => socket.destroy());
    socket.on('close', () => fin(false));
  });
}

function configuracion() {
  if (!existsSync(rutaEnv)) throw new Error('Primero ejecuta Instalar FindMyPet.bat.');
  const actual = cargarApi('dotenv').config({ path: rutaEnv, quiet: true, override: true }).parsed || {};
  if (!actual.JWT_SECRET || !actual.DATABASE_URL) throw new Error('Falta la configuración local. Abre Instalar FindMyPet.bat.');
  const base = new URL(actual.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(base.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) {
    throw new Error('Este lanzador utiliza PostgreSQL local. Comprueba la configuración de esta copia de FindMyPet.');
  }
  const puerto = Number(actual.PORT || 4000);
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535 || puerto === 5173) {
    throw new Error('El puerto del backend en server/.env es inválido o coincide con el del frontend.');
  }
  return puerto;
}

async function iniciar() {
  const previo = await control('estado');
  if (previo === 'listo') { console.log(`FindMyPet ya está en ejecución en ${enlace}.`); return; }
  if (!previo) {
    let puerto;
    try { puerto = configuracion(); cargarWeb.resolve('vite'); }
    catch (e) {
      if (e.code === 'MODULE_NOT_FOUND') throw new Error('Faltan dependencias. Abre Instalar FindMyPet.bat.');
      throw e;
    }
    for (const ocupado of [puerto, 5173]) {
      const resultados = await Promise.all(['127.0.0.1', '::1'].map((host) => puertoOcupado(ocupado, host)));
      if (resultados.includes(true) && !(await control('estado'))) {
        throw new Error(`El puerto ${ocupado} ya está en uso por otro proceso. Ciérralo desde donde lo iniciaste y vuelve a probar.`);
      }
    }
    mkdirSync(runtime, { recursive: true });
    const log = openSync(join(runtime, 'servidores.log'), 'a');
    try {
      const hijo = spawn(process.execPath, [__filename, 'servir'], {
        cwd: carpetaApi, detached: true, windowsHide: true, stdio: ['ignore', log, log],
      });
      hijo.once('error', (e) => console.error(`No se pudo abrir el proceso de FindMyPet (${e.code || 'error'}).`));
      hijo.unref();
    } finally {
      closeSync(log);
    }
  }
  for (let i = 0; i < 120; i += 1) {
    const estado = await control('estado');
    if (estado === 'listo') { console.log(`FindMyPet está listo en ${enlace}.`); return; }
    if (!estado && i >= 12) break;
    await esperar(250);
  }
  throw new Error('No se pudo iniciar FindMyPet. Comprueba que PostgreSQL esté iniciado. Los detalles están en .runtime/windows/servidores.log.');
}

async function detener() {
  let estado = await control('estado');
  if (!estado) { console.log('No hay servidores iniciados por este lanzador de FindMyPet.'); return; }
  for (let i = 0; i < 120; i += 1) {
    if (estado === 'listo') estado = await control('detener');
    await esperar(250);
    estado = await control('estado');
    if (!estado) { console.log('FindMyPet se detuvo.'); return; }
  }
  throw new Error('FindMyPet todavía está cerrando sus servidores. Intenta de nuevo en unos segundos.');
}

async function servir() {
  let estado = 'iniciando';
  let api;
  let web;
  let pool;
  const coordinador = net.createServer((socket) => {
    socket.setTimeout(1500, () => socket.destroy());
    socket.on('error', () => socket.destroy());
    socket.once('data', (datos) => {
      if (datos.toString() === 'detener' && estado === 'listo') {
        estado = 'deteniendo';
        socket.end(estado);
        void cerrar();
      } else {
        socket.end(estado);
      }
    });
  });

  async function cerrar() {
    const limite = setTimeout(() => process.exit(1), 12_000);
    limite.unref();
    const cierreApi = api?.listening && new Promise((fin) => {
      const pendientes = setTimeout(() => api.closeAllConnections(), 5000);
      pendientes.unref();
      api.close(() => { clearTimeout(pendientes); fin(); });
    });
    await Promise.allSettled([
      web?.close(),
      cierreApi,
    ]);
    if (pool) await pool.end();
    coordinador.close();
  }

  try {
    await escuchar(coordinador, canal);
  } catch (e) {
    if (e.code === 'EADDRINUSE') return; // Otra instancia obtuvo el canal primero.
    throw e;
  }

  try {
    process.chdir(carpetaApi);
    const puerto = configuracion();
    process.env.VITE_API_URL = '';
    iniciarPostgresPortatil(new URL(process.env.DATABASE_URL));
    ({ pool } = cargarApi('./src/lib/db'));
    const { rows: [fila] } = await pool.query("SELECT to_regclass('public.usuario') AS tabla");
    if (!fila.tabla) throw new Error('Faltan tablas en PostgreSQL. Ejecuta el instalador.');
    const app = cargarApi('./src/app');
    api = require('node:http').createServer(app);
    await escuchar(api, puerto, '127.0.0.1');

    const { createServer } = await import(pathToFileURL(cargarWeb.resolve('vite')));
    const destino = `http://127.0.0.1:${puerto}`;
    web = await createServer({
      root: carpetaWeb,
      server: {
        host: '127.0.0.1', port: 5173, strictPort: true,
        proxy: { '/api': destino, '/uploads': destino },
      },
    });
    await web.listen();
    estado = 'listo';
    console.log(`FindMyPet listo en ${enlace}.`);
  } catch (e) {
    console.error(`Inicio fallido: ${e.code || e.message}`);
    process.exitCode = 1;
    await cerrar();
  }
}

const accion = { iniciar, detener, servir }[process.argv[2]];
accion().catch((e) => { console.error(e.message); process.exitCode = 1; });
