const sharp = require('sharp');
const { app, db, request, limpiarBD, cerrarBD, crearUsuario, publicar, conToken, idSector } = require('./ayudas');

let ana;
let luis;
let refugio;
let refugioPendiente;

beforeAll(async () => {
  await limpiarBD();
  ana = await crearUsuario({ correo: 'ana@findmypet.test', nombres: 'Ana' });
  luis = await crearUsuario({ correo: 'luis@findmypet.test', nombres: 'Luis' });
  refugio = await crearUsuario({ correo: 'refugio@findmypet.test', rol: 2, nombres: 'Huellitas' });
  refugioPendiente = await crearUsuario({ correo: 'pendiente@findmypet.test', rol: 2, nombres: 'Nuevo', refugioAutorizado: false });
});
afterAll(cerrarBD);

describe('RF-04, RF-07, RF-20, RF-21: registrar reportes', () => {
  test('exige sesión', async () => {
    const res = await request(app).post('/api/publicaciones').field('tipo', '1');
    expect(res.status).toBe(401);
  });

  test('publica una mascota desaparecida con 2 fotos optimizadas a 1280 px (RNF-23)', async () => {
    const res = await publicar(ana.token, {}, { fotos: 2 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ tipo: 'Desaparecida', estado: 'Pendiente', especie: 'Perro', nombreAnimal: 'Rocky' });
    expect(res.body.ubicacion).toMatchObject({ sector: 'Las Piñas', canton: 'Milagro', provincia: 'Guayas' });
    expect(res.body.colores.map((c) => c.nombre).sort()).toEqual(['Blanco', 'Café']);
    const foto = await request(app).get(res.body.foto);
    expect(foto.status).toBe(200);
    expect(foto.headers['content-type']).toBe('image/webp');
    const meta = await sharp(foto.body).metadata();
    expect(meta.width).toBe(1280);
  });

  test('publica un animal encontrado sin nombre', async () => {
    const res = await publicar(luis.token, { tipo: 2, nombreAnimal: '' });
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('Pendiente');
    expect(res.body.nombreAnimal).toBeNull();
  });

  test('valida fotos (mínimo 1, máximo 5, contenido real), contacto, fecha y ubicación (RNF-12, RNF-18)', async () => {
    expect((await publicar(ana.token, {}, { fotos: 0 })).status).toBe(400);
    expect((await publicar(ana.token, {}, { fotos: 6 })).status).toBe(400);
    expect((await publicar(ana.token, { whatsapp: '' })).status).toBe(400);
    expect((await publicar(ana.token, { fechaEvento: '2999-01-01' })).status).toBe(400);
    expect((await publicar(ana.token, { idSector: '' })).status).toBe(400);
    expect((await publicar(ana.token, { idRaza: 999 })).status).toBe(400);
    const falsa = await request(app).post('/api/publicaciones').set(conToken(ana.token))
      .field('tipo', '1').attach('archivos', Buffer.from('no soy una imagen'), { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(falsa.status).toBe(400);
  });
});

describe('RF-12: adopciones solo por refugios autorizados', () => {
  test('un ciudadano y un refugio pendiente no pueden publicar adopciones', async () => {
    expect((await publicar(ana.token, { tipo: 3, estadoSalud: 'Vacunado' })).status).toBe(403);
    expect((await publicar(refugioPendiente.token, { tipo: 3, estadoSalud: 'Vacunado' })).status).toBe(403);
  });

  test('un refugio autorizado publica con estado de salud', async () => {
    const res = await publicar(refugio.token, { tipo: 3, nombreAnimal: 'Pelusa', idEspecie: 2, idRaza: '', estadoSalud: 'Vacunada y esterilizada' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ tipo: 'Adopción', estado: 'Disponible', estadoSalud: 'Vacunada y esterilizada', refugio: 'Refugio Huellitas' });
    expect(res.body.ubicacion.canton).toBe('Milagro');
  });
});

describe('RF-08, RF-13, RF-16: consulta, búsqueda y filtros', () => {
  test('resumen por tipo', async () => {
    const res = await request(app).get('/api/publicaciones/resumen');
    expect(res.body).toMatchObject({ desaparecidas: 1, encontradas: 1, adopcion: 1 });
  });

  test('filtra por tipo, especie, color, sector y texto', async () => {
    const tipo = await request(app).get('/api/publicaciones?tipo=2');
    expect(tipo.body.total).toBe(1);
    const especie = await request(app).get('/api/publicaciones?especie=2');
    expect(especie.body.datos[0].nombreAnimal).toBe('Pelusa');
    const color = await request(app).get('/api/publicaciones?color=3');
    expect(color.body.total).toBe(3);
    const sector = await request(app).get(`/api/publicaciones?sector=${await idSector('Milagro', 'Las Piñas')}`);
    expect(sector.body.total).toBe(2);
    const texto = await request(app).get('/api/publicaciones?q=esterilizada');
    expect(texto.body.total).toBe(0);
    const texto2 = await request(app).get('/api/publicaciones?q=collar');
    expect(texto2.body.total).toBe(3);
    expect(tipo.body.datos[0].idUsuario).toBeUndefined();
  });

  test('RNF-05: el contacto solo se muestra con sesión iniciada', async () => {
    const [p] = (await request(app).get('/api/publicaciones?tipo=1')).body.datos;
    const anonimo = await request(app).get(`/api/publicaciones/${p.id}`);
    expect(anonimo.body.contactos).toBeNull();
    expect(anonimo.body.multimedia).toHaveLength(2);
    const conSesion = await request(app).get(`/api/publicaciones/${p.id}`).set(conToken(luis.token));
    expect(conSesion.body.contactos).toEqual([{ tipo: 'WhatsApp', valor: '0000000004' }]);
    expect(conSesion.body.autor).toBe('Ana P.');
  });
});

describe('RF-05, RF-06, RF-14, RNF-13: gestión por el autor', () => {
  let id;
  beforeAll(async () => { id = (await publicar(ana.token, { nombreAnimal: 'Firulais' })).body.id; });

  test('solo el autor puede editar, cambiar estado o eliminar', async () => {
    expect((await request(app).patch(`/api/publicaciones/${id}/estado`).set(conToken(luis.token)).send({ idEstado: 2 })).status).toBe(403);
    expect((await request(app).delete(`/api/publicaciones/${id}`).set(conToken(luis.token))).status).toBe(403);
  });

  test('cambia a Recuperada y rechaza estados de otro tipo', async () => {
    const ok = await request(app).patch(`/api/publicaciones/${id}/estado`).set(conToken(ana.token)).send({ idEstado: 2 });
    expect(ok.body.estado).toBe('Recuperada');
    const mal = await request(app).patch(`/api/publicaciones/${id}/estado`).set(conToken(ana.token)).send({ idEstado: 6 });
    expect(mal.status).toBe(400);
  });

  test('edita datos, agrega una foto y quita otra', async () => {
    const actual = (await request(app).get(`/api/publicaciones/${id}`)).body;
    const img = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#fff' } }).png().toBuffer();
    const res = await request(app).put(`/api/publicaciones/${id}`).set(conToken(ana.token))
      .field('nombreAnimal', 'Firulais II').field('idEspecie', '1').field('descripcion', 'Descripción actualizada del perro')
      .field('idSector', String(actual.ubicacion.idSector)).field('fechaEvento', actual.fechaEvento).field('whatsapp', '0000000004')
      .field('quitarArchivos', String(actual.multimedia[0].id))
      .attach('archivos', img, { filename: 'nueva.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.nombreAnimal).toBe('Firulais II');
    const despues = (await request(app).get(`/api/publicaciones/${id}`)).body;
    expect(despues.multimedia).toHaveLength(1);
    expect(despues.multimedia[0].id).not.toBe(actual.multimedia[0].id);
  });

  test('mis publicaciones y eliminación', async () => {
    const mias = await request(app).get('/api/publicaciones/mias').set(conToken(ana.token));
    expect(mias.body.length).toBe(2);
    expect((await request(app).delete(`/api/publicaciones/${id}`).set(conToken(ana.token))).status).toBe(204);
    expect((await request(app).get(`/api/publicaciones/${id}`)).status).toBe(404);
  });
});

describe('RF-15: contacto para adopción notifica al refugio', () => {
  test('el interesado obtiene el contacto y el refugio recibe una notificación', async () => {
    const [pelusa] = (await request(app).get('/api/publicaciones?tipo=3')).body.datos;
    const res = await request(app).post(`/api/publicaciones/${pelusa.id}/interes`).set(conToken(luis.token));
    expect(res.status).toBe(200);
    expect(res.body.contactos[0].valor).toBe('0000000004');
    const notif = await request(app).get('/api/notificaciones').set(conToken(refugio.token));
    expect(notif.body.noLeidas).toBe(1);
    expect(notif.body.datos[0].mensaje).toContain('interesado en adoptar a Pelusa');
    const propia = await request(app).post(`/api/publicaciones/${pelusa.id}/interes`).set(conToken(refugio.token));
    expect(propia.status).toBe(400);
    await request(app).patch(`/api/publicaciones/${pelusa.id}/estado`).set(conToken(refugio.token)).send({ idEstado: 6 });
    const adoptado = await request(app).post(`/api/publicaciones/${pelusa.id}/interes`).set(conToken(ana.token));
    expect(adoptado.status).toBe(400);
  });

  test('marcar notificaciones como leídas', async () => {
    await request(app).patch('/api/notificaciones/leidas').set(conToken(refugio.token));
    const notif = await request(app).get('/api/notificaciones').set(conToken(refugio.token));
    expect(notif.body.noLeidas).toBe(0);
  });
});

test('RNF-18: no se puede inyectar SQL en los filtros', async () => {
  const res = await request(app).get("/api/publicaciones?q=' OR 1=1; DROP TABLE usuario; --");
  expect(res.status).toBe(200);
  expect(res.body.total).toBe(0);
  const u = await db.una('SELECT COUNT(*)::int AS n FROM usuario');
  expect(u.n).toBeGreaterThan(0);
  expect((await request(app).get('/api/publicaciones?especie=1 OR 1=1')).status).toBe(400);
});
