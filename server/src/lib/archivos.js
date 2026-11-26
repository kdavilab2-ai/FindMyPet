const multer = require('multer');
const sharp = require('sharp');
const { ErrorHttp } = require('../middlewares/errores');
const { TIPO_MULTIMEDIA, MAX_ARCHIVOS } = require('./constantes');

const MAX_IMAGEN = 5 * 1024 * 1024; // RNF-11
const MAX_VIDEO = 20 * 1024 * 1024;

// Los archivos se reciben en memoria para validarlos y optimizarlos antes de guardarlos
const recibirArchivos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO, files: MAX_ARCHIVOS },
}).array('archivos', MAX_ARCHIVOS);

// RNF-18: se valida el contenido real del archivo, no solo su extensión
function esVideo(buffer) {
  const mp4 = buffer.length > 12 && buffer.toString('ascii', 4, 8) === 'ftyp';
  const webm = buffer.length > 4 && buffer.readUInt32BE(0) === 0x1a45dfa3;
  if (mp4) return 'video/mp4';
  if (webm) return 'video/webm';
  return null;
}

/**
 * Valida y procesa un archivo subido.
 * Imágenes: JPG, PNG o WEBP de hasta 5 MB, redimensionadas a 1280 px y comprimidas (RNF-23).
 * Videos: MP4 o WEBM de hasta 20 MB (RF-21).
 */
async function procesarArchivo(archivo, indice) {
  const n = indice + 1;
  if (archivo.mimetype.startsWith('video/')) {
    const mime = esVideo(archivo.buffer);
    if (!mime) throw new ErrorHttp(400, `El archivo ${n} no es un video MP4 o WEBM válido`);
    return { tipo: TIPO_MULTIMEDIA.VIDEO, mime, buffer: archivo.buffer };
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.mimetype)) {
    throw new ErrorHttp(400, `El archivo ${n} debe ser una imagen JPG, PNG o WEBP, o un video MP4`);
  }
  if (archivo.size > MAX_IMAGEN) throw new ErrorHttp(400, `La imagen ${n} supera los 5 MB`);
  let metadatos;
  try {
    metadatos = await sharp(archivo.buffer).metadata();
  } catch {
    throw new ErrorHttp(400, `El archivo ${n} no es una imagen válida`);
  }
  if (!['jpeg', 'png', 'webp'].includes(metadatos.format)) {
    throw new ErrorHttp(400, `El archivo ${n} no es una imagen JPG, PNG o WEBP válida`);
  }
  const buffer = await sharp(archivo.buffer)
    .rotate()
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  return { tipo: TIPO_MULTIMEDIA.IMAGEN, mime: 'image/webp', buffer };
}

module.exports = { recibirArchivos, procesarArchivo };
