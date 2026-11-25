const { Pool, types } = require('pg');

// Devolver las fechas tipo DATE como texto 'AAAA-MM-DD' (sin desfase de zona horaria)
types.setTypeParser(1082, (valor) => valor);

// Neon, Supabase y Render exigen SSL: se activa con ?sslmode=require en la URL o DB_SSL=true
const conexion = process.env.DATABASE_URL || '';
const usaSSL = /sslmode=(require|verify)/.test(conexion) || process.env.DB_SSL === 'true';

const pool = new Pool({
  connectionString: usaSSL ? conexion.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '') : conexion,
  ssl: usaSSL ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

// Convierte claves snake_case de PostgreSQL a camelCase para la API
function aCamel(fila) {
  if (!fila) return fila;
  const salida = {};
  for (const [clave, valor] of Object.entries(fila)) {
    salida[clave.replace(/_([a-z])/g, (_, l) => l.toUpperCase())] = valor;
  }
  return salida;
}

async function consulta(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows.map(aCamel);
}

async function una(sql, params = []) {
  const filas = await consulta(sql, params);
  return filas[0] || null;
}

// Ejecuta varias consultas dentro de una transacción
async function transaccion(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await fn({
      consulta: async (sql, params = []) => (await cliente.query(sql, params)).rows.map(aCamel),
    });
    await cliente.query('COMMIT');
    return resultado;
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
}

module.exports = { pool, consulta, una, transaccion };
