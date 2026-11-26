const { app, db, request, limpiarBD, cerrarBD, crearUsuario, publicar, conToken } = require('./ayudas');

let admin;
let ana;
let refugio;
let luis;

beforeAll(async () => {
  await limpiarBD();
  admin = await crearUsuario({ correo: 'admin@findmypet.test', rol: 3, nombres: 'Admin' });
  ana = await crearUsuario({ correo: 'ana@findmypet.test', nombres: 'Ana' });
  luis = await crearUsuario({ correo: 'luis@findmypet.test', nombres: 'Luis' });
  refugio = await crearUsuario({ correo: 'refugio@findmypet.test', rol: 2, nombres: 'Huellitas', refugioAutorizado: false });
});
afterAll(cerrarBD);

describe('RF-19: control de acceso por roles', () => {
  test('ciudadanos y refugios no entran al panel de administración', async () => {
    expect((await request(app).get('/api/admin/estadisticas').set(conToken(ana.token))).status).toBe(403);
    expect((await request(app).get('/api/admin/usuarios').set(conToken(refugio.token))).status).toBe(403);
    expect((await request(app).get('/api/admin/estadisticas').set(conToken(admin.token))).status).toBe(200);
  });
});

describe('Autorización de refugios', () => {
  test('el admin autoriza el refugio y este recibe una notificación', async () => {
    const res = await request(app).patch(`/api/admin/refugios/${refugio.usuario.refugio.id}`).set(conToken(admin.token)).send({ autorizado: true });
    expect(res.status).toBe(200);
    const notif = await request(app).get('/api/notificaciones').set(conToken(refugio.token));
    expect(notif.body.datos[0].mensaje).toContain('fue autorizado');
    expect((await publicar(refugio.token, { tipo: 3, estadoSalud: 'Sano' })).status).toBe(201);
  });
});

describe('RF-17, CU-14: moderación de publicaciones', () => {
  let id;
  beforeAll(async () => { id = (await publicar(ana.token)).body.id; });

  test('advertencia y cambio de estado requieren motivo', async () => {
    expect((await request(app).post(`/api/admin/publicaciones/${id}/advertencia`).set(conToken(admin.token)).send({})).status).toBe(400);
    expect((await request(app).post(`/api/admin/publicaciones/${id}/advertencia`).set(conToken(admin.token)).send({ motivo: 'Foto poco clara' })).status).toBe(201);
    const confirmarAjena = await request(app).patch(`/api/admin/publicaciones/${id}/estado`).set(conToken(admin.token)).send({ idEstado: 2, motivo: 'El dueño avisó que apareció' });
    expect(confirmarAjena.status).toBe(403);
    expect((await request(app).patch(`/api/publicaciones/${id}/estado`).set(conToken(ana.token)).send({ idEstado: 2 })).status).toBe(200);
    const est = await request(app).patch(`/api/admin/publicaciones/${id}/estado`).set(conToken(admin.token)).send({ idEstado: 1, motivo: 'Reapertura revisada' });
    expect(est.status).toBe(200);
  });

  test('elimina la publicación, notifica al autor y deja registro', async () => {
    const res = await request(app).delete(`/api/admin/publicaciones/${id}`).set(conToken(admin.token)).send({ motivo: 'Contenido inapropiado' });
    expect(res.status).toBe(204);
    expect((await request(app).get(`/api/publicaciones/${id}`)).status).toBe(404);
    const notif = await request(app).get('/api/notificaciones').set(conToken(ana.token));
    expect(notif.body.datos[0].mensaje).toContain('Contenido inapropiado');
    const { n } = await db.una('SELECT COUNT(*)::int AS n FROM moderacion');
    expect(n).toBe(3);
  });
});

describe('CU-13: control de cuentas', () => {
  test('suspende una cuenta: no puede iniciar sesión y su token deja de servir', async () => {
    const res = await request(app).patch(`/api/admin/usuarios/${luis.id}/estado`).set(conToken(admin.token)).send({ idEstado: 2, motivo: 'Publicaciones falsas' });
    expect(res.status).toBe(200);
    const login = await request(app).post('/api/auth/login').send({ correo: 'luis@findmypet.test', contrasena: 'Clave1234' });
    expect(login.status).toBe(403);
    expect(login.body.error).toContain('suspendida');
    expect((await request(app).get('/api/auth/yo').set(conToken(luis.token))).status).toBe(401);
  });

  test('reactiva la cuenta y no permite cambiar la propia', async () => {
    await request(app).patch(`/api/admin/usuarios/${luis.id}/estado`).set(conToken(admin.token)).send({ idEstado: 1, motivo: 'Revisión completada' });
    expect((await request(app).get('/api/auth/yo').set(conToken(luis.token))).status).toBe(401);
    const nuevoAcceso = await request(app).post('/api/auth/login').send({ correo: 'luis@findmypet.test', contrasena: 'Clave1234' });
    expect(nuevoAcceso.status).toBe(200);
    luis.token = nuevoAcceso.body.token;
    expect((await request(app).patch(`/api/admin/usuarios/${admin.id}/estado`).set(conToken(admin.token)).send({ idEstado: 3, motivo: 'prueba' })).status).toBe(400);
  });
});

describe('RNF-22: auditoría', () => {
  test('registra acciones con responsable, fecha y detalle', async () => {
    const res = await request(app).get('/api/admin/auditoria').set(conToken(admin.token));
    expect(res.status).toBe(200);
    const categorias = new Set(res.body.map((r) => r.categoria));
    expect(categorias).toEqual(new Set(['Moderación', 'Cuenta']));
    expect(res.body[0].responsable).toBe('Admin Prueba');
  });
});

describe('RF-24: valoraciones de refugios', () => {
  test('un ciudadano califica de 1 a 5 y puede actualizar su reseña', async () => {
    const idRefugio = refugio.usuario.refugio.id;
    expect((await request(app).post(`/api/refugios/${idRefugio}/valoraciones`).set(conToken(ana.token)).send({ calificacion: 6 })).status).toBe(400);
    expect((await request(app).post(`/api/refugios/${idRefugio}/valoraciones`).set(conToken(ana.token)).send({ calificacion: 4, comentario: 'Buena atención' })).status).toBe(201);
    await request(app).post(`/api/refugios/${idRefugio}/valoraciones`).set(conToken(ana.token)).send({ calificacion: 5, comentario: 'Excelente' });
    await request(app).post(`/api/refugios/${idRefugio}/valoraciones`).set(conToken(luis.token)).send({ calificacion: 3 });
    const detalle = await request(app).get(`/api/refugios/${idRefugio}`);
    expect(detalle.body.promedio).toBe(4);
    expect(detalle.body.resenas).toHaveLength(2);
    expect((await request(app).post(`/api/refugios/${idRefugio}/valoraciones`).set(conToken(refugio.token)).send({ calificacion: 5 })).status).toBe(403);
  });
});

describe('RF-25: donaciones o insumos', () => {
  let idSolicitud;
  test('el refugio publica una solicitud y los usuarios registran aportes', async () => {
    expect((await request(app).post('/api/donaciones').set(conToken(ana.token)).send({ titulo: 'Comida', descripcion: 'Necesitamos comida' })).status).toBe(403);
    const s = await request(app).post('/api/donaciones').set(conToken(refugio.token)).send({ titulo: 'Alimento para cachorros', descripcion: 'Tres sacos de balanceado' });
    expect(s.status).toBe(201);
    idSolicitud = s.body.id;
    expect((await request(app).post(`/api/donaciones/${idSolicitud}/aportes`).set(conToken(ana.token)).send({})).status).toBe(400);
    expect((await request(app).post(`/api/donaciones/${idSolicitud}/aportes`).set(conToken(ana.token)).send({ monto: 20 })).status).toBe(201);
    expect((await request(app).post(`/api/donaciones/${idSolicitud}/aportes`).set(conToken(luis.token)).send({ detalle: '1 saco de 15 kg' })).status).toBe(201);
    const mias = await request(app).get('/api/donaciones/mias').set(conToken(refugio.token));
    expect(mias.body[0]).toMatchObject({ aportes: 2, totalMonto: 20 });
    expect(mias.body[0].detalleAportes.map((a) => a.donante).sort()).toEqual(['Ana Prueba', 'Luis Prueba']);
  });

  test('al cerrarla ya no recibe aportes ni aparece en la lista pública', async () => {
    await request(app).patch(`/api/donaciones/${idSolicitud}`).set(conToken(refugio.token)).send({ idEstado: 2 });
    expect((await request(app).post(`/api/donaciones/${idSolicitud}/aportes`).set(conToken(ana.token)).send({ monto: 5 })).status).toBe(400);
    expect((await request(app).get('/api/donaciones')).body).toHaveLength(0);
  });
});
