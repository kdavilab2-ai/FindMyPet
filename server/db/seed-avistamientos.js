// Agrega avistamientos ficticios a los reportes de demostración existentes.
require('dotenv').config({ quiet: true });
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { pool, transaccion } = require('../src/lib/db');
const { TIPO, ESTADO, TIPO_CONTACTO, TIPO_MULTIMEDIA } = require('../src/lib/constantes');

const EJEMPLOS = [
  {
    mascota: 'Rocky', autor: 'ana@findmypet.test', testigo: 'luis@findmypet.test',
    imagen: 'rocky-avistamiento.webp', dias: 2, hora: '17:25', referencia: 'Entrada del parque de Las Piñas',
    comentario: 'Vi un perro café con blanco y collar rojo junto a la entrada del parque de Las Piñas. Se quedó mirando hacia la calle y luego siguió por la acera. Parecía alerta y no se dejó acercar.',
  },
  {
    mascota: 'Michi', autor: 'luis@findmypet.test', testigo: 'ana@findmypet.test',
    imagen: 'michi-avistamiento.webp', dias: 3, hora: '07:40', referencia: 'Acera del Centro de Milagro',
    comentario: 'Después de la lluvia vi una gata crema de cara oscura y ojos azules, agachada sobre un muro junto a un portón azul. Tomé la foto desde la acera y la perdí de vista cuando se escondió.',
  },
];

function cargarAvistamientosDemo() {
  return Promise.all(EJEMPLOS.map(async (ejemplo) => ({
    ...ejemplo, foto: await readFile(join(__dirname, 'fotos-demo', ejemplo.imagen)),
  })));
}

function agregarAvistamientosDemo(ejemplos) {
  return transaccion(async (tx) => {
    let agregados = 0;
    for (const ejemplo of ejemplos) {
      const [origen] = await tx.consulta(
        `SELECT p.id_publicacion, p.id_estado, ub.id_sector, testigo.id_usuario, testigo.telefono
         FROM publicacion p JOIN reporte r USING (id_publicacion) JOIN ubicacion ub USING (id_ubicacion)
         JOIN usuario autor ON autor.id_usuario = p.id_usuario JOIN usuario testigo ON testigo.correo = $3
         WHERE p.nombre_animal = $1 AND autor.correo = $2 AND p.id_tipo = $4 AND testigo.telefono IS NOT NULL
         ORDER BY p.id_publicacion LIMIT 1 FOR UPDATE OF p`,
        [ejemplo.mascota, ejemplo.autor, ejemplo.testigo, TIPO.DESAPARECIDA],
      );
      if (!origen) continue;
      const descripcion = ejemplo.comentario;
      const descripcionAnterior = `Ejemplo de demostración. ${descripcion}`;
      const [existente] = await tx.consulta(
        `SELECT p.id_publicacion, p.descripcion FROM reporte r JOIN publicacion p USING (id_publicacion)
         WHERE r.id_desaparicion_origen = $1 AND p.id_usuario = $2 AND p.descripcion IN ($3, $4)
         ORDER BY p.id_publicacion LIMIT 1 FOR UPDATE OF p`,
        [origen.idPublicacion, origen.idUsuario, descripcion, descripcionAnterior],
      );
      if (existente?.descripcion === descripcionAnterior) {
        await tx.consulta('UPDATE publicacion SET descripcion = $1 WHERE id_publicacion = $2',
          [descripcion, existente.idPublicacion]);
      }
      if (existente || origen.idEstado !== ESTADO.DESAPARECIDA_PENDIENTE) continue;
      const [pub] = await tx.consulta(
        `INSERT INTO publicacion (id_usuario, id_tipo, id_estado, id_especie, id_raza, id_tamano, descripcion)
         SELECT $2, $3, $4, id_especie, id_raza, id_tamano, $5 FROM publicacion WHERE id_publicacion = $1
         RETURNING id_publicacion`,
        [origen.idPublicacion, origen.idUsuario, TIPO.ENCONTRADA, ESTADO.ENCONTRADA_PENDIENTE, descripcion],
      );
      const [ubicacion] = await tx.consulta(
        'INSERT INTO ubicacion (id_sector, direccion) VALUES ($1, $2) RETURNING id_ubicacion',
        [origen.idSector, ejemplo.referencia],
      );
      await tx.consulta(
        `INSERT INTO reporte (id_publicacion, id_ubicacion, fecha_evento, hora_evento, id_desaparicion_origen)
         SELECT $1, $2, LEAST(CURRENT_DATE, fecha_evento + $3::int), $4, id_publicacion FROM reporte WHERE id_publicacion = $5`,
        [pub.idPublicacion, ubicacion.idUbicacion, ejemplo.dias, ejemplo.hora, origen.idPublicacion],
      );
      await tx.consulta(
        'INSERT INTO publicacion_color SELECT $1, id_color FROM publicacion_color WHERE id_publicacion = $2',
        [pub.idPublicacion, origen.idPublicacion],
      );
      await tx.consulta(
        'INSERT INTO contacto_publicacion (id_publicacion, id_tipo_contacto, valor) VALUES ($1, $2, $3)',
        [pub.idPublicacion, TIPO_CONTACTO.WHATSAPP, origen.telefono],
      );
      const [foto] = await tx.consulta(
        "INSERT INTO multimedia (id_publicacion, id_tipo_multimedia, url) VALUES ($1, $2, '') RETURNING id_multimedia",
        [pub.idPublicacion, TIPO_MULTIMEDIA.IMAGEN],
      );
      await tx.consulta('UPDATE multimedia SET url = $1 WHERE id_multimedia = $2', [`/api/multimedia/${foto.idMultimedia}`, foto.idMultimedia]);
      await tx.consulta(
        "INSERT INTO multimedia_archivo (id_multimedia, mime, datos) VALUES ($1, 'image/webp', $2)",
        [foto.idMultimedia, ejemplo.foto],
      );
      agregados += 1;
    }
    return agregados;
  });
}

if (require.main === module) {
  cargarAvistamientosDemo().then(agregarAvistamientosDemo)
    .then((total) => console.log(`Avistamientos de demostración agregados: ${total}`))
    .catch((e) => { console.error(e.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { cargarAvistamientosDemo, agregarAvistamientosDemo };
