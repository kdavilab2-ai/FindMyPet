const { ErrorHttp } = require('../middlewares/errores');

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_TELEFONO = /^0\d{9}$/;

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function requerido(datos, campos) {
  const faltan = campos.filter((c) => !texto(String(datos[c] ?? '')));
  if (faltan.length) throw new ErrorHttp(400, `Campos obligatorios: ${faltan.join(', ')}`);
}

function entero(valor, nombre = 'id') {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new ErrorHttp(400, `${nombre} inválido`);
  return n;
}

function enteroOpcional(valor, nombre) {
  if (valor === undefined || valor === null || valor === '') return null;
  return entero(valor, nombre);
}

// Fecha AAAA-MM-DD que no puede ser futura. Se compara con la fecha UTC, que siempre es igual
// o posterior a la fecha local de Ecuador (UTC-5), para no rechazar reportes del mismo día.
function fechaPasada(valor) {
  const fecha = String(valor).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(new Date(`${fecha}T00:00:00Z`).getTime())) {
    throw new ErrorHttp(400, 'Fecha inválida');
  }
  if (fecha > new Date().toISOString().slice(0, 10)) throw new ErrorHttp(400, 'La fecha no puede ser futura');
  return fecha;
}

function coordenada(valor, min, max, nombre) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < min || n > max) throw new ErrorHttp(400, `${nombre} inválida`);
  return Number(n.toFixed(6));
}

// Acepta un arreglo, un texto "1,2,3" o un valor repetido de FormData
function listaEnteros(valor, nombre) {
  if (valor === undefined || valor === null || valor === '') return [];
  const lista = Array.isArray(valor) ? valor : String(valor).split(',');
  return [...new Set(lista.filter((v) => String(v).trim() !== '').map((v) => entero(v, nombre)))];
}

function contrasenaSegura(valor) {
  const c = String(valor || '');
  if (c.length < 8 || !/[A-Za-z]/.test(c) || !/\d/.test(c)) {
    throw new ErrorHttp(400, 'La contraseña debe tener al menos 8 caracteres, con letras y números');
  }
  return c;
}

module.exports = {
  REGEX_CORREO, REGEX_TELEFONO, texto, requerido, entero, enteroOpcional, fechaPasada, coordenada, listaEnteros, contrasenaSegura,
};
