const usuarios = {
  sofia: ['Sofía', 'Cedeño'], mateo: ['Mateo', 'Vera'], camila: ['Camila', 'Paz'], daniel: ['Daniel', 'Núñez'],
  julia: ['Julia', 'Mora'], andres: ['Andrés', 'Cruz'], valeria: ['Valeria', 'Ríos'], elena: ['Elena', 'Arias'],
};

const ubicaciones = {
  centro: ['Milagro', 'Centro', 'Alrededores del parque central', -2.1342, -79.5939],
  pinas: ['Milagro', 'Las Piñas', 'Parque del sector', -2.1415, -79.6013],
  chirijos: ['Milagro', 'Los Chirijos', 'Cancha del sector', -2.1271, -79.5986],
  pinos: ['Milagro', 'Los Pinos', 'Alrededores del área verde', -2.1189, -79.5872],
  unemi: ['Milagro', 'Ciudadela Universitaria', 'Acera de la avenida universitaria', -2.1495, -79.6031],
  naranjito: ['Naranjito', 'Centro', 'Alrededores del parque del centro', -2.1684, -79.4654],
  durán: ['Durán', 'Centro', 'Acera del sector céntrico', -2.1766, -79.8488],
  urdesa: ['Guayaquil', 'Urdesa', 'Parque del barrio', -2.1705, -79.9151],
  yaguachi: ['Yaguachi', 'Centro', 'Alrededores de la plaza del centro', -2.0963, -79.6934],
  quito: ['Quito', 'La Carolina', 'Sendero del parque La Carolina', -0.1851, -78.4830],
  babahoyo: ['Babahoyo', 'Centro', 'Paseo del centro', -1.8012, -79.5352],
};

const refugios = [
  { clave: 'huellitas', nombre: 'Fundación Huellitas Milagro', persona: ['María', 'Vera'], lugar: 'pinos', autorizado: true },
  { clave: 'patitas', nombre: 'Refugio Patitas Naranjito', persona: ['Jorge', 'Castro'], lugar: 'naranjito', autorizado: true },
  { clave: 'nido', nombre: 'Fundación Nido y Patas', persona: ['Inés', 'Solís'], lugar: 'urdesa', autorizado: true },
  { clave: 'valle', nombre: 'Refugio Sendero del Valle', persona: ['Pablo', 'Reyes'], lugar: 'yaguachi', autorizado: true },
  { clave: 'ribera', nombre: 'Red de Rescate La Ribera', persona: ['Lucía', 'Ruiz'], lugar: 'babahoyo', autorizado: false },
];

// Las claves también son los nombres de las fotos. Los hallazgos con origen se muestran en Avistamientos.
const perdidas = [
  ['bruno', 'sofia', 'Bruno', 'Perro', 'Labrador', 'Grande', ['Dorado'], 'pinas', 1, 'Lleva collar rojo y suele acercarse cuando oye su nombre. Salió por el portón al abrirlo para entrar el auto.'],
  ['oliva', 'camila', 'Oliva', 'Perro', 'Beagle', 'Mediano', ['Negro', 'Café', 'Blanco'], 'naranjito', 2, 'Pecho blanco y punta de la cola clara. Se asustó con el ruido de una moto durante el paseo.'],
  ['nube', 'julia', 'Nube', 'Gato', 'Persa', 'Pequeño', ['Gris'], 'chirijos', 4, 'Pelaje gris largo y ojos cobrizos. Se esconde en lugares bajos cuando hay ruido.'],
  ['lima', 'sofia', 'Lima', 'Ave', 'Perico', 'Pequeño', [], 'centro', 2, 'Periquito verde y amarillo con anilla azul. Se posaba en los alambres del patio antes de alejarse.'],
  ['mota', 'daniel', 'Mota', 'Conejo', 'Mestizo', 'Pequeño', ['Gris', 'Blanco'], 'yaguachi', 3, 'Coneja de orejas caídas y nariz blanca. Salió al jardín cuando se abrió la malla del corral.'],
  ['canela', 'valeria', 'Canela', 'Otro', 'No aplica', 'Pequeño', ['Crema', 'Café'], 'durán', 5, 'Cobaya de pelo corto con una franja café junto al ojo. Puede haberse escondido en un rincón oscuro del patio.'],
  ['sombra', 'elena', 'Sombra', 'Gato', 'Mestizo', 'Pequeño', ['Negro'], 'quito', 3, 'Gata negra de ojos amarillos; tiene un maullido corto. Se escapó del transportín al volver a casa.'],
  ['kira', 'andres', 'Kira', 'Perro', 'Husky', 'Grande', ['Gris', 'Blanco'], 'unemi', 8, 'Kira regresó tras dos días. Su familia comprobó la placa antes de recogerla en la zona universitaria.', true],
  ['milo', 'julia', 'Milo', 'Gato', 'Mestizo', 'Pequeño', ['Naranja'], 'chirijos', 11, 'Una vecina lo encontró cerca de la ventana del patio y avisó a su dueña. La familia confirmó que Milo está en casa.', true],
  ['nina', 'mateo', 'Nina', 'Perro', 'Chihuahua', 'Pequeño', ['Blanco'], 'pinos', 12, 'La familia la recogió después de reconocerla por su tamaño y por las orejas. Nina volvió a su casa esa tarde.', true],
  ['cobre', 'elena', 'Cobre', 'Gato', 'Bengalí', 'Pequeño', ['Café', 'Manchado'], 'quito', 4, 'El pelaje tiene rosetas oscuras y el vientre claro. Se perdió al anochecer tras entrar por un pasillo lateral.'],
  ['luci', 'andres', 'Luci', 'Ave', 'Canario', 'Pequeño', [], 'unemi', 5, 'Canaria amarilla de canto suave. La vieron por última vez en la terraza y podría seguir cerca de los techos.'],
  ['bimba', 'valeria', 'Bimba', 'Perro', 'Pug', 'Pequeño', ['Beige'], 'durán', 2, 'Tiene el hocico oscuro y camina despacio. Se apartó de la acera durante una descarga de cajas.'],
  ['michi', 'sofia', 'Michi', 'Gato', 'Siamés', 'Pequeño', ['Crema', 'Café'], 'centro', 4, 'Gata de ojos azules con cara y orejas oscuras. Salió por la ventana y suele esconderse arriba de los muros.'],
].map(([clave, autor, nombre, especie, raza, tamano, colores, lugar, dias, descripcion, recuperada]) =>
  ({ clave, autor, nombre, especie, raza, tamano, colores, lugar, dias, descripcion, recuperada }));

const hallazgos = [
  ['pastor', 'mateo', 'Perro', 'Pastor Alemán', 'Grande', ['Negro', 'Café'], 'unemi', 1, '07:50', 'Perro adulto junto a la cerca de la cancha. Caminaba sin cojear y se apartó al pasar un grupo de estudiantes.'],
  ['rizo', 'valeria', 'Perro', 'Poodle', 'Pequeño', ['Blanco', 'Café'], 'durán', 2, '16:20', 'Perro pequeño de pelo rizado bajo una banca. Aceptó agua, pero se alejó cuando intentaron tocarlo.'],
  ['atigrado', 'elena', 'Gato', 'Mestizo', 'Pequeño', ['Atigrado', 'Café'], 'quito', 1, '08:40', 'Gato atigrado visto cerca de unas escaleras, buscando comida. Tiene la punta de la cola oscura.'],
  ['loro', 'valeria', 'Ave', 'Loro', 'Pequeño', [], 'durán', 1, '10:30', 'Loro verde que se posó varias veces sobre el mismo pasamanos. Estaba alerta y voló al árbol de la vereda.'],
  ['schnauzer', 'mateo', 'Perro', 'Schnauzer', 'Pequeño', ['Gris'], 'centro', 2, '12:15', 'Perro gris con barba marcada, observado cerca de las jardineras al mediodía. Se dejó fotografiar desde la acera.'],
  ['avila', 'julia', 'Gato', 'Mestizo', 'Pequeño', ['Naranja', 'Blanco'], 'pinos', 2, '07:20', 'Gato naranja de patas blancas que se refugió entre unas plantas al pasar el recolector. No llevaba collar.'],
  ['av-bruno', 'mateo', 'Perro', 'Labrador', 'Grande', ['Dorado'], 'pinas', 0, '07:15', 'Vi un labrador de collar rojo cruzar el sendero. Tomé la foto desde el parque y se alejó hacia la cancha.', 'bruno'],
  ['av-oliva', 'andres', 'Perro', 'Beagle', 'Mediano', ['Negro', 'Café', 'Blanco'], 'naranjito', 1, '16:35', 'El perro tenía el pecho blanco y olfateaba junto a la acera. Lo acompañé hasta el refugio, donde lo dejaron a resguardo.', 'oliva', 'patitas'],
  ['av-lima', 'camila', 'Ave', 'Perico', 'Pequeño', [], 'centro', 1, '06:50', 'Vi un periquito verde y amarillo con una anilla azul sobre un cable entre dos techos. Voló cuando pasó el bus.', 'lima'],
  ['av-mota', 'julia', 'Conejo', 'Mestizo', 'Pequeño', ['Gris', 'Blanco'], 'yaguachi', 2, '15:45', 'Coneja gris de orejas caídas y nariz blanca debajo de un seto. La recogimos con un transportín y quedó en el refugio.', 'mota', 'valle'],
  ['av-michi', 'daniel', 'Gato', 'Siamés', 'Pequeño', ['Crema', 'Café'], 'centro', 2, '07:40', 'Después de la lluvia vi una gata crema de cara oscura y ojos azules, agachada sobre un muro junto a un portón azul.', 'michi'],
].map(([clave, autor, especie, raza, tamano, colores, lugar, dias, hora, descripcion, origen, refugio]) =>
  ({ clave, autor, especie, raza, tamano, colores, lugar, dias, hora, descripcion, origen, refugio }));

const adopciones = [
  ['max', 'huellitas', 'Max', 'Perro', 'Mestizo', 'Mediano', ['Café', 'Crema'], 'Se sienta antes de salir al patio y disfruta de paseos cortos.', 'Vacunado y desparasitado.'],
  ['pixel', 'patitas', 'Píxel', 'Perro', 'Mestizo', 'Mediano', ['Negro', 'Blanco'], 'Le gustan los juegos de olfato. Se adapta mejor con paseos diarios.', 'Vacunas al día y esterilizado.'],
  ['plata', 'huellitas', 'Plata', 'Gato', 'Mestizo', 'Pequeño', ['Gris'], 'Le gusta mirar por la ventana. Se acerca cuando el espacio está tranquilo.', 'Esterilizada y con control veterinario reciente.'],
  ['trigo', 'valle', 'Trigo', 'Conejo', 'Mestizo', 'Pequeño', ['Naranja', 'Blanco'], 'Curioso y tranquilo con adultos. Necesita un espacio interior amplio y heno disponible.', 'Revisión reciente y buen apetito.'],
  ['chifle', 'nido', 'Chifle', 'Ave', null, 'Pequeño', ['Gris'], 'Ninfa que reconoce rutinas de alimentación. Busca un hogar con experiencia en aves.', 'Come con normalidad. Tiene seguimiento veterinario.'],
  ['frijol', 'patitas', 'Frijol', 'Otro', 'No aplica', 'Pequeño', ['Negro', 'Blanco'], 'Cobaya que se anima al escuchar la bolsa de heno. Agradece escondites y movimientos suaves.', 'Revisión veterinaria y peso estable.'],
  ['sol', 'valle', 'Sol', 'Perro', 'Golden Retriever', 'Grande', ['Dorado'], 'Perra adulta tranquila que disfruta sentarse cerca de su familia temporal.', 'Vacunada y esterilizada.'],
  ['algodon', 'nido', 'Algodón', 'Conejo', 'Mestizo', 'Pequeño', ['Crema', 'Blanco'], 'Se acerca a olfatear cuando el cuarto está en silencio. Tolera bien su transportín.', 'Control veterinario reciente.'],
  ['gala', 'huellitas', 'Gala', 'Perro', 'Bulldog', 'Mediano', ['Café', 'Blanco'], 'Le gusta descansar cerca de las personas y caminar en horas frescas.', 'Esterilizada. Requiere sus controles habituales.'],
  ['robles', 'patitas', 'Robles', 'Perro', 'Pitbull', 'Mediano', ['Café', 'Blanco'], 'Responde a la correa y vive en acogida. El refugio ofrece una primera visita guiada.', 'Vacunado y esterilizado.'],
  ['vera', 'valle', 'Vera', 'Perro', 'Shih Tzu', 'Pequeño', ['Blanco', 'Café'], 'Le gustan las mantas suaves y se deja peinar después de ganar confianza.', 'Al día en sus controles.'],
  ['clara', 'nido', 'Clara', 'Gato', 'Angora', 'Pequeño', ['Blanco'], 'Prefiere las repisas altas y se acerca cuando le hablan en voz baja.', 'Vacunada y esterilizada.'],
  ['miel', 'valle', 'Miel', 'Conejo', 'Cabeza de león', 'Pequeño', ['Café'], 'Explora túneles de cartón y requiere cepillado frecuente por su pelaje.', 'Revisión reciente y buen estado general.'],
].map(([clave, autor, nombre, especie, raza, tamano, colores, descripcion, salud], i) =>
  ({ clave, autor, nombre, especie, raza, tamano, colores, descripcion, salud, dias: 1 + i % 6 }));

const valoraciones = [
  ['huellitas', 'mateo', 5, 'Me indicaron dónde esperar y revisaron si el perro tenía placa antes de moverlo.'],
  ['huellitas', 'julia', 4, 'La primera visita fue tranquila. Me dieron tiempo para conocer a la gata y explicaron su rutina.'],
  ['patitas', 'andres', 5, 'Recibieron a la perrita al final de la tarde y dejaron anotadas las señas del collar.'],
  ['patitas', 'camila', 4, 'Encontré los horarios claros. Me explicaron qué fotos y datos podían servir para identificarla.'],
  ['nido', 'elena', 5, 'Explicaron con detalle cómo preparar un espacio seguro para un ave antes de visitar.'],
  ['nido', 'valeria', 4, 'Respondieron mi consulta sobre el conejo y sugirieron una visita en un horario más tranquilo.'],
  ['valle', 'julia', 5, 'Nos orientaron para trasladar a la coneja en su caja y mantenerla tranquila durante el camino.'],
  ['valle', 'daniel', 4, 'El equipo anotó las señas que les compartí y me indicó cómo actualizar el reporte.'],
];

module.exports = { usuarios, ubicaciones, refugios, perdidas, hallazgos, adopciones, valoraciones };
