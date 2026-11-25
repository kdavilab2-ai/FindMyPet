// Crea tablas limpias en la base de datos de pruebas antes de ejecutar Jest
require('dotenv').config({ quiet: true });

module.exports = async () => {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error('Defina TEST_DATABASE_URL en .env para ejecutar las pruebas');
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const migrar = require('../db/migrar');
  const { pool } = require('../src/lib/db');
  await migrar({ reiniciar: true });
  await pool.end();
};
