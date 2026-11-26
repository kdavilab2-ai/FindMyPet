const { spawnSync } = require('node:child_process');
const { existsSync, mkdirSync, readFileSync } = require('node:fs');
const { resolve, join } = require('node:path');

const raiz = resolve(__dirname, '../..');

// La distribución portátil opcional de esta copia mantiene sus datos dentro de .tools.
function iniciarPostgresPortatil(url) {
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) return;
  const pgCtl = join(raiz, '.tools', 'pg-portable', 'pgsql', 'bin', 'pg_ctl.exe');
  const datos = join(raiz, '.tools', 'findmypet-local', 'postgres');
  const configuracion = join(datos, 'postgresql.conf');
  if (!existsSync(pgCtl) || !existsSync(join(datos, 'PG_VERSION')) || !existsSync(configuracion)) return;

  const puertos = [...readFileSync(configuracion, 'utf8').matchAll(/^\s*port\s*=\s*(\d+)\s*(?:#.*)?$/gm)];
  const puerto = puertos.at(-1)?.[1];
  if (puerto !== (url.port || '5432')) return;

  const ejecutar = (comando, ...args) => spawnSync(pgCtl, [comando, '-D', datos, ...args], {
    windowsHide: true, stdio: 'ignore', timeout: 18_000,
  }).status;
  if (ejecutar('status') === 0) return;
  const runtime = join(raiz, '.runtime', 'windows');
  mkdirSync(runtime, { recursive: true });
  const log = join(runtime, 'postgres.log');
  if (ejecutar('start', '-l', log, '-w', '-t', '15', '-o', '-h 127.0.0.1') !== 0 && ejecutar('status') !== 0) {
    throw new Error('No se pudo iniciar PostgreSQL portátil. Revisa .runtime/windows/postgres.log.');
  }
  console.log('PostgreSQL portátil está en ejecución.');
}

module.exports = iniciarPostgresPortatil;
