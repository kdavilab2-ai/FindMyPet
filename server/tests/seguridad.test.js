const jwt = require('jsonwebtoken');
const { app, db, request, limpiarBD, cerrarBD, crearUsuario, publicar, conToken, datosBase } = require('./ayudas');
const { enviados } = require('../src/lib/correo');

const correo = 'seguridad@findmypet.test';
const otroCorreo = 'otra-cuenta@findmypet.test';
const acceso = (email, contrasena = 'Clave1234') => request(app).post('/api/auth/login')
  .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0) Chrome/98.0.0 Safari/537.36')
  .send({ correo: email, contrasena });
const estado = (token) => request(app).get('/api/seguridad').set(conToken(token));

beforeEach(limpiarBD);
afterAll(cerrarBD);

test('lista solo las sesiones propias y revoca una o todas las demás sin cerrar la actual', async () => {
  const propia = await crearUsuario({ correo, avisarAccesos: true });
  const otra = await crearUsuario({ correo: otroCorreo });
  const segunda = (await acceso(correo)).body.token;
  const tercera = (await acceso(correo)).body.token;
  const ajena = (await estado(otra.token)).body.sesiones[0].id;
  const sesiones = await estado(propia.token);
  expect(sesiones.headers['cache-control']).toBe('no-store');
  expect(sesiones.body).toMatchObject({ avisarAccesos: true });
  expect(sesiones.body.sesiones).toHaveLength(3);
  expect(sesiones.body.sesiones[0].actual).toBe(true);
  expect(sesiones.body.sesiones.slice(1)).toEqual(expect.arrayContaining([expect.objectContaining({ navegador: 'Chrome', sistema: 'Windows', iniciadaEn: expect.any(String) })]));
  const revocar = (id) => request(app).delete(`/api/seguridad/sesiones${id ? `/${id}` : ''}`).set(conToken(propia.token));
  expect((await revocar(ajena)).status).toBe(404);
  expect((await estado(otra.token)).status).toBe(200);
  expect((await revocar(sesiones.body.sesiones[0].id)).status).toBe(400);
  const segundaId = (await estado(segunda)).body.sesiones[0].id;
  expect((await revocar(segundaId)).status).toBe(204);
  expect((await request(app).post('/api/auth/renovar').set(conToken(segunda))).status).toBe(401);
  expect((await revocar()).status).toBe(204);
  expect((await estado(tercera)).status).toBe(401);
  expect((await estado(propia.token)).body.sesiones).toHaveLength(1);
  expect((await request(app).post('/api/auth/cerrar').set(conToken(propia.token))).status).toBe(204);
  expect((await estado(propia.token)).status).toBe(401);
});

test('renueva la misma sesión y rechaza sesiones expiradas y JWT anteriores al registro de sesiones', async () => {
  const usuario = await crearUsuario({ correo });
  const original = (await estado(usuario.token)).body.sesiones[0];
  const renovada = await request(app).post('/api/auth/renovar').set(conToken(usuario.token));
  expect((await estado(renovada.body.token)).body.sesiones[0]).toMatchObject({ id: original.id, actual: true, iniciadaEn: original.iniciadaEn });
  await db.consulta("UPDATE sesion_usuario SET expira_en = NOW() - INTERVAL '1 second' WHERE id_sesion = $1", [original.id]);
  expect((await estado(renovada.body.token)).status).toBe(401);
  const anterior = jwt.sign({ id: usuario.id, rol: 1 }, process.env.JWT_SECRET, { expiresIn: '30m' });
  expect((await estado(anterior)).status).toBe(401);
});

test('exige confirmación de contraseña, cierra otras sesiones y conserva los avisos críticos', async () => {
  const usuario = await crearUsuario({ correo, avisarAccesos: true });
  const primeraSesion = conToken(usuario.token);
  expect((await request(app).put('/api/seguridad/notificaciones').set(primeraSesion).send({ avisarAccesos: 'no' })).status).toBe(400);
  expect((await request(app).put('/api/seguridad/notificaciones').set(primeraSesion).send({ avisarAccesos: false })).body.avisarAccesos).toBe(false);
  const segunda = (await acceso(correo)).body.token;
  const cambiar = (nueva, confirmar) => request(app).put('/api/perfil/contrasena').set(primeraSesion)
    .send({ actual: 'Clave1234', nueva, confirmar });
  expect((await cambiar('NuevaSegura123', 'OtraClave123')).status).toBe(400);
  expect((await cambiar('a1'.repeat(37), 'a1'.repeat(37))).status).toBe(400);
  expect((await cambiar('NuevaSegura123', 'NuevaSegura123')).status).toBe(200);
  expect((await estado(segunda)).status).toBe(401);
  expect((await estado(usuario.token)).status).toBe(200);
  expect((await acceso(correo)).status).toBe(401);
  expect((await acceso(correo, 'NuevaSegura123')).status).toBe(200);
  const { body } = await request(app).get('/api/notificaciones').set(primeraSesion);
  expect(body.datos.filter((n) => n.tipo === 'Seguridad' && n.mensaje.startsWith('Nuevo inicio de sesión'))).toHaveLength(1);
  expect(body.datos).toContainEqual(expect.objectContaining({ tipo: 'Seguridad', mensaje: expect.stringContaining('Se cambió la contraseña') }));
});

test('restablecer la contraseña revoca todas las sesiones anteriores y los enlaces pendientes', async () => {
  const usuario = await crearUsuario({ correo });
  const pedir = async () => {
    await request(app).post('/api/auth/olvide').send({ correo });
    return enviados.at(-1).texto.match(/token=([a-f0-9]+)/)[1];
  };
  const token1 = await pedir();
  const token2 = await pedir();
  const restablecer = (token) => request(app).post('/api/auth/restablecer').send({ token, contrasena: 'NuevaSegura123' });
  expect((await restablecer(token2)).status).toBe(200);
  expect((await estado(usuario.token)).status).toBe(401);
  expect((await restablecer(token1)).status).toBe(400);
});

test('respeta la privacidad de los reportes y mantiene un contacto visible al editar', async () => {
  const autor = await crearUsuario({ correo });
  const ajeno = await crearUsuario({ correo: otroCorreo });
  const p = (await publicar(autor.token, { correoContacto: 'canal-propio@findmypet.test' })).body;
  const cambiar = (token, idTipoContactoVisible) => request(app).patch(`/api/seguridad/contactos/${p.id}`).set(conToken(token)).send({ idTipoContactoVisible });
  expect((await request(app).get('/api/seguridad/contactos').set(conToken(autor.token))).body[0].canales).toEqual([{ id: 2, tipo: 'WhatsApp' }, { id: 3, tipo: 'Correo' }]);
  expect((await cambiar(ajeno.token, 3)).status).toBe(404);
  expect((await cambiar(autor.token, 1)).status).toBe(400);
  expect((await cambiar(autor.token, 3)).status).toBe(200);
  const detalle = (token) => {
    const req = request(app).get(`/api/publicaciones/${p.id}`);
    return token ? req.set(conToken(token)) : req;
  };
  expect((await detalle()).body.contactos).toBeNull();
  expect((await detalle(autor.token)).body.contactos).toHaveLength(2);
  expect((await detalle(ajeno.token)).body.contactos).toEqual([{ tipo: 'Correo', valor: 'canal-propio@findmypet.test' }]);
  const editar = request(app).put(`/api/publicaciones/${p.id}`).set(conToken(autor.token));
  for (const [k, v] of Object.entries(await datosBase())) editar.field(k, String(v));
  expect((await editar).status).toBe(400);
  expect((await cambiar(autor.token, null)).status).toBe(200);
  expect((await detalle(ajeno.token)).body.contactos).toHaveLength(2);
});

test('exporta solo datos propios y puede enviar y retirar solicitudes para revisión administrativa', async () => {
  const usuario = await crearUsuario({ correo });
  const ajeno = await crearUsuario({ correo: otroCorreo });
  const admin = await crearUsuario({ correo: 'admin-seguridad@findmypet.test', rol: 3 });
  await publicar(usuario.token, { nombreAnimal: 'Mascota propia' });
  await publicar(ajeno.token, { nombreAnimal: 'Mascota ajena' });
  const solicitar = (actual, confirmar) => request(app).post('/api/seguridad/solicitudes').set(conToken(usuario.token)).send({ actual, confirmar, tipo: 'eliminacion' });
  expect((await solicitar('Clave1234', false)).status).toBe(400);
  expect((await solicitar('Incorrecta123', true)).status).toBe(400);
  expect((await solicitar('Clave1234', true)).status).toBe(202);
  expect((await solicitar('Clave1234', true)).status).toBe(202);
  const rutaAdmin = '/api/admin/solicitudes-cuenta';
  expect((await request(app).get(rutaAdmin).set(conToken(ajeno.token))).status).toBe(403);
  expect((await request(app).get(rutaAdmin).set(conToken(admin.token))).body).toEqual([expect.objectContaining({ correo, tipo: 'eliminacion' })]);
  const rutaDatos = '/api/seguridad/mis-datos';
  expect((await request(app).get(rutaDatos)).status).toBe(401);
  const descarga = await request(app).get(rutaDatos).set(conToken(usuario.token));
  expect(descarga.status).toBe(200);
  expect(descarga.headers['content-disposition']).toContain('findmypet-mis-datos.json');
  expect(descarga.headers['cache-control']).toBe('no-store');
  expect(descarga.body.perfil.correo).toBe(correo);
  expect(descarga.body.publicaciones).toEqual([expect.objectContaining({ nombreAnimal: 'Mascota propia', multimedia: expect.any(Array) })]);
  expect(descarga.body.solicitudesCuenta).toEqual([expect.objectContaining({ tipo: 'eliminacion' })]);
  expect(descarga.text).not.toMatch(/Mascota ajena|otra-cuenta|contrasenaHash|tokenHash|idSesion/);
  expect((await request(app).get('/api/auth/yo').set(conToken(usuario.token))).status).toBe(200);
  expect((await request(app).delete('/api/seguridad/solicitudes/eliminacion').set(conToken(ajeno.token))).status).toBe(204);
  expect((await request(app).get('/api/seguridad/solicitudes').set(conToken(usuario.token))).body).toHaveLength(1);
  expect((await request(app).delete('/api/seguridad/solicitudes/eliminacion').set(conToken(usuario.token))).status).toBe(204);
  expect((await request(app).get(rutaAdmin).set(conToken(admin.token))).body).toHaveLength(0);
});
