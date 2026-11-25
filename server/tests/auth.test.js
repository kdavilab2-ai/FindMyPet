const { app, db, request, limpiarBD, cerrarBD, idSector, conToken } = require('./ayudas');
const { enviados } = require('../src/lib/correo');

beforeAll(limpiarBD);
afterAll(cerrarBD);

const ciudadano = {
  nombres: 'Ciudadana Demo', apellidos: 'Prueba', correo: 'CIUDADANA-DEMO@findmypet.test', contrasena: 'Segura123', telefono: '0000000001', aceptaPolitica: true,
};

describe('Salud y catálogos', () => {
  test('GET /api/salud', async () => {
    const res = await request(app).get('/api/salud');
    expect(res.body).toEqual({ ok: true });
  });

  test('GET /api/catalogos trae especies, estados y sectores', async () => {
    const res = await request(app).get('/api/catalogos');
    expect(res.status).toBe(200);
    expect(res.body.especies.map((e) => e.nombre)).toContain('Perro');
    expect(res.body.estados).toHaveLength(6);
    expect(res.body.sectores.length).toBeGreaterThan(10);
  });
});

describe('RF-01, RF-19, RNF-21: registro', () => {
  test('registra un ciudadano con consentimiento y contraseña cifrada', async () => {
    const res = await request(app).post('/api/auth/registro').send(ciudadano);
    expect(res.status).toBe(201);
    expect(res.body.usuario.rol).toBe('Ciudadano');
    expect(res.body.usuario.correo).toBe('ciudadana-demo@findmypet.test');
    const u = await db.una('SELECT contrasena_hash FROM usuario WHERE correo = $1', ['ciudadana-demo@findmypet.test']);
    expect(u.contrasenaHash).not.toContain('Segura123');
    const c = await db.una('SELECT version_politica FROM consentimiento c JOIN usuario u USING (id_usuario) WHERE u.correo = $1', ['ciudadana-demo@findmypet.test']);
    expect(c.versionPolitica).toBe('1.0');
  });

  test('registra un refugio pendiente de autorización', async () => {
    const res = await request(app).post('/api/auth/registro').send({
      ...ciudadano, correo: 'refugio@findmypet.test', tipoCuenta: 'REFUGIO', nombreRefugio: 'Huellitas', idSector: await idSector('Milagro', 'Centro'),
    });
    expect(res.status).toBe(201);
    expect(res.body.usuario.rol).toBe('Refugio');
    expect(res.body.usuario.refugio).toMatchObject({ nombre: 'Huellitas', autorizado: false });
  });

  test('rechaza sin consentimiento, correo duplicado y contraseña débil', async () => {
    expect((await request(app).post('/api/auth/registro').send({ ...ciudadano, correo: 'x@findmypet.test', aceptaPolitica: false })).status).toBe(400);
    expect((await request(app).post('/api/auth/registro').send(ciudadano)).status).toBe(409);
    expect((await request(app).post('/api/auth/registro').send({ ...ciudadano, correo: 'y@findmypet.test', contrasena: 'abcdefgh' })).status).toBe(400);
    expect((await request(app).post('/api/auth/registro').send({ ...ciudadano, correo: 'z@findmypet.test', telefono: '123' })).status).toBe(400);
  });
});

describe('RF-02, RNF-19: inicio de sesión', () => {
  test('login correcto y renovación del token', async () => {
    const res = await request(app).post('/api/auth/login').send({ correo: 'ciudadana-demo@findmypet.test', contrasena: 'Segura123' });
    expect(res.status).toBe(200);
    const renovado = await request(app).post('/api/auth/renovar').set(conToken(res.body.token));
    expect(renovado.status).toBe(200);
    expect(renovado.body.token).toBeDefined();
  });

  test('login fallido con contraseña incorrecta', async () => {
    const res = await request(app).post('/api/auth/login').send({ correo: 'ciudadana-demo@findmypet.test', contrasena: 'Otra12345' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Correo o contraseña incorrectos');
  });

  test('rutas privadas exigen token válido', async () => {
    expect((await request(app).get('/api/auth/yo')).status).toBe(401);
    expect((await request(app).get('/api/auth/yo').set(conToken('token-falso'))).status).toBe(401);
  });
});

describe('RF-18: recuperación de contraseña', () => {
  test('correo inexistente muestra error de cuenta no encontrada (CU-12)', async () => {
    const res = await request(app).post('/api/auth/olvide').send({ correo: 'nadie@findmypet.test' });
    expect(res.status).toBe(404);
  });

  test('envía el enlace, restablece la contraseña y el enlace no se puede reutilizar', async () => {
    const res = await request(app).post('/api/auth/olvide').send({ correo: 'ciudadana-demo@findmypet.test' });
    expect(res.status).toBe(200);
    const correo = enviados.at(-1);
    expect(correo.para).toBe('ciudadana-demo@findmypet.test');
    const token = correo.texto.match(/token=([a-f0-9]+)/)[1];

    const cambio = await request(app).post('/api/auth/restablecer').send({ token, contrasena: 'Nueva12345' });
    expect(cambio.status).toBe(200);
    const login = await request(app).post('/api/auth/login').send({ correo: 'ciudadana-demo@findmypet.test', contrasena: 'Nueva12345' });
    expect(login.status).toBe(200);
    const reuso = await request(app).post('/api/auth/restablecer').send({ token, contrasena: 'Otra12345' });
    expect(reuso.status).toBe(400);
  });
});

describe('RF-03: perfil', () => {
  test('ver y actualizar datos personales, cambiar contraseña', async () => {
    const { body } = await request(app).post('/api/auth/login').send({ correo: 'ciudadana-demo@findmypet.test', contrasena: 'Nueva12345' });
    const auth = conToken(body.token);
    const perfil = await request(app).get('/api/perfil').set(auth);
    expect(perfil.body.nombres).toBe('Ciudadana Demo');
    const upd = await request(app).put('/api/perfil').set(auth).send({ nombres: 'Ciudadana Actualizada', apellidos: 'Prueba Actualizada', telefono: '0000000002' });
    expect(upd.status).toBe(200);
    expect(upd.body.usuario.nombres).toBe('Ciudadana Actualizada');
    const mal = await request(app).put('/api/perfil/contrasena').set(auth).send({ actual: 'incorrecta1', nueva: 'Clave98765', confirmar: 'Clave98765' });
    expect(mal.status).toBe(400);
    const bien = await request(app).put('/api/perfil/contrasena').set(auth).send({ actual: 'Nueva12345', nueva: 'Clave98765', confirmar: 'Clave98765' });
    expect(bien.status).toBe(200);
  });
});
