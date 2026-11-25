// Crea las tablas y catálogos definidos en db/schema.sql. Uso: npm run db:migrate
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/lib/db');

async function migrar({ reiniciar = false } = {}) {
  if (reiniciar) {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

if (require.main === module) {
  migrar({ reiniciar: process.argv.includes('--reiniciar') })
    .then(() => console.log('Base de datos lista'))
    .catch((e) => { console.error(e.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = migrar;
