const { app, db, request, limpiarBD, cerrarBD, crearUsuario, publicar, conToken, datosBase } = require('./ayudas');
const { analizarReporte } = require('../src/services/coincidencias.service');
const ia = require('../src/lib/ia');

let propietario;
let testigo;
let refugio;
let otroRefugio;
let visitante;
let perdida;
let hallada;

beforeAll(async () => {
  await limpiarBD();
  propietario = await crearUsuario({ correo: 'propietario@findmypet.test' });
  testigo = await crearUsuario({ correo: 'testigo@findmypet.test' });
  refugio = await crearUsuario({ correo: 'refugio@findmypet.test', rol: 2, nombres: 'Traslado' });
  otroRefugio = await crearUsuario({ correo: 'otro-refugio@findmypet.test', rol: 2, refugioAutorizado: false });
  visitante = await crearUsuario({ correo: 'visitante@findmypet.test' });
  perdida = (await publicar(propietario.token)).body;
});
afterAll(cerrarBD);
afterEach(() => jest.restoreAllMocks());

const publicarAvistamiento = (datos) => publicar(testigo.token, { tipo: 2, nombreAnimal: '', ...datos });
const detalle = (id) => request(app).get(`/api/publicaciones/${id}`);
const notificaciones = (u) => request(app).get('/api/notificaciones').set(conToken(u.token));
const coincidencias = (u) => request(app).get(`/api/coincidencias?publicacion=${perdida.id}`).set(conToken(u.token));
const coordinar = (u) => request(app).get(`/api/publicaciones/${hallada.id}/coordinacion`).set(conToken(u.token));
const mensaje = (u, destino, contenido) => request(app).post(`/api/publicaciones/${hallada.id}/coordinacion`).set(conToken(u.token)).send({ destino, contenido });
const recibir = (u) => request(app).patch(`/api/publicaciones/${hallada.id}/custodia/confirmar`).set(conToken(u.token));
const responder = (u, id, idEstado) => request(app).patch(`/api/coincidencias/${id}`).set(conToken(u.token)).send({ idEstado });

test('registra un avistamiento sin similitudes y mantiene vigente la desaparición', async () => {
  const r = await publicarAvistamiento({ idEspecie: 2, idRaza: '', horaEvento: '16:45' });
  expect(r.status).toBe(201);
  expect(r.body).toMatchObject({ idTipo: 2, idEstado: 3, horaEvento: '16:45', custodia: null });
  expect(await analizarReporte(r.body.id)).toBe(0);
  expect((await detalle(perdida.id)).body.idEstado).toBe(1);
  expect((await notificaciones(propietario)).body.datos).toHaveLength(0);
  expect((await detalle(r.body.id)).status).toBe(200);
  expect((await publicarAvistamiento({ horaEvento: '26:01' })).status).toBe(400);
  expect((await publicarAvistamiento({ idRefugioCustodia: otroRefugio.usuario.refugio.id })).status).toBe(400);
  expect((await publicarAvistamiento({ notasCustodia: 'Sin refugio asignado', idRefugioCustodia: '' })).status).toBe(400);
});

test('analiza fotos si el servicio está disponible, registra la similitud y avisa al propietario', async () => {
  const r = await publicarAvistamiento({ horaEvento: '09:15', idRefugioCustodia: refugio.usuario.refugio.id, notasCustodia: 'Recepción en el área de cuarentena' });
  expect(r.status).toBe(201);
  hallada = r.body;
  expect(hallada.custodia).toMatchObject({ nombre: 'Refugio Traslado', confirmadaEn: null });
  expect((await notificaciones(refugio)).body.datos).toContainEqual(expect.objectContaining({ tipo: 'Avistamiento', idPublicacion: hallada.id }));
  jest.spyOn(ia, 'disponible').mockReturnValue(true);
  const comparar = jest.spyOn(ia, 'compararImagenes').mockResolvedValue(81);
  expect(await analizarReporte(hallada.id)).toBe(1);
  expect(comparar).toHaveBeenCalledWith(expect.objectContaining({ mime: 'image/webp', buffer: expect.any(Buffer) }), expect.objectContaining({ buffer: expect.any(Buffer) }));
  const [sugerencia] = (await coincidencias(propietario)).body;
  expect(sugerencia).toMatchObject({ idEstado: 1, encontrada: { id: hallada.id, horaEvento: '09:15', custodia: { nombre: 'Refugio Traslado' } } });
  expect(sugerencia.criterios).toContainEqual({ criterio: 'Imagen', puntaje: 81 });
  expect((await notificaciones(propietario)).body.datos).toContainEqual(expect.objectContaining({ tipo: 'Coincidencia IA', idPublicacion: perdida.id, mensaje: expect.stringContaining('09:15') }));
  expect((await detalle(perdida.id)).body.idEstado).toBe(1);
});

test('restringe coordinación y notas a las partes vinculadas y habilita el contacto autorizado', async () => {
  const listado = await request(app).get('/api/refugios/mis-avistamientos').set(conToken(refugio.token));
  expect(listado.body).toEqual([expect.objectContaining({ id: hallada.id, confirmadaEn: null })]);
  expect((await request(app).get('/api/refugios/mis-avistamientos').set(conToken(otroRefugio.token))).status).toBe(403);
  const anonimo = await detalle(hallada.id);
  expect(anonimo.body.contactos).toBeNull();
  expect(anonimo.body.notasCustodia).toBeUndefined();
  expect(anonimo.body.multimedia).toHaveLength(1);
  const paraPropietario = await detalle(hallada.id).set(conToken(propietario.token));
  expect(paraPropietario.body.contactos).toContainEqual({ tipo: 'WhatsApp', valor: '0900000004' });
  expect(paraPropietario.body.ubicacion.sector).toBe('Las Piñas');
  expect((await coordinar(visitante)).status).toBe(403);
  expect((await coordinar(propietario)).body.notas).toBe('Recepción en el área de cuarentena');
  expect((await mensaje(propietario, visitante.id, 'Prueba de permiso')).status).toBe(403);
  expect((await mensaje(propietario, refugio.id, '¿Puedo acercarme a comprobar el parecido?')).status).toBe(201);
  expect((await coordinar(refugio)).body.mensajes[0]).toMatchObject({ mio: false, contenido: '¿Puedo acercarme a comprobar el parecido?' });
  expect((await coordinar(testigo)).body.mensajes).toHaveLength(0);
  expect((await mensaje(refugio, testigo.id, 'Gracias por traer al animal')).status).toBe(201);
  expect((await coordinar(testigo)).body.mensajes[0].contenido).toBe('Gracias por traer al animal');
  expect((await coordinar(propietario)).body.mensajes).toHaveLength(1);
  expect((await recibir(testigo)).status).toBe(403);
  expect((await recibir(otroRefugio)).status).toBe(403);
  expect((await recibir(refugio)).status).toBe(204);
  expect((await recibir(refugio)).status).toBe(204);
  expect((await detalle(hallada.id)).body.custodia.confirmadaEn).toBeTruthy();
  expect((await notificaciones(propietario)).body.datos.filter((n) => n.mensaje.includes('confirmó la recepción'))).toHaveLength(1);
  expect((await detalle(perdida.id)).body.idEstado).toBe(1);
});

test('confirma o descarta similitud sin modificar el estado de la desaparición', async () => {
  const [sugerencia] = (await coincidencias(propietario)).body;
  expect((await responder(visitante, sugerencia.id, 2)).status).toBe(403);
  expect((await responder(propietario, sugerencia.id, 2)).status).toBe(200);
  expect((await responder(propietario, sugerencia.id, 2)).status).toBe(200);
  expect((await notificaciones(testigo)).body.datos.filter((n) => n.mensaje.includes('cree que el animal'))).toHaveLength(1);
  expect((await coordinar(propietario)).body.destinos).toContainEqual(expect.objectContaining({ id: testigo.id }));
  expect((await detalle(perdida.id)).body.idEstado).toBe(1);
  const otro = (await publicarAvistamiento({})).body;
  expect(await analizarReporte(otro.id)).toBe(1);
  const descartada = (await coincidencias(propietario)).body.find((c) => c.encontrada.id === otro.id);
  expect((await responder(propietario, descartada.id, 3)).status).toBe(200);
  expect(await analizarReporte(otro.id)).toBe(0);
  expect((await detalle(perdida.id)).body.idEstado).toBe(1);
});

test('solo el propietario confirma la recuperación y un tercero no edita el traslado', async () => {
  const editar = request(app).put(`/api/publicaciones/${hallada.id}`).set(conToken(visitante.token));
  for (const [k, v] of Object.entries(await datosBase({ idRefugioCustodia: '' }))) editar.field(k, String(v));
  expect((await editar).status).toBe(403);
  const retirar = request(app).put(`/api/publicaciones/${hallada.id}`).set(conToken(testigo.token));
  for (const [k, v] of Object.entries(await datosBase({ tipo: 2, nombreAnimal: '', idRefugioCustodia: '' }))) retirar.field(k, String(v));
  expect((await retirar).status).toBe(400);
  const recuperar = (u) => request(app).patch(`/api/publicaciones/${perdida.id}/estado`).set(conToken(u.token)).send({ idEstado: 2 });
  expect((await recuperar(refugio)).status).toBe(403);
  expect((await recuperar(propietario)).status).toBe(200);
  expect((await detalle(perdida.id)).body.estado).toBe('Recuperada');
  expect((await detalle(hallada.id)).body.idEstado).toBe(3);
  expect((await request(app).get('/api/publicaciones?tipo=1&activas=true')).body.datos).toHaveLength(0);
  expect(await analizarReporte(hallada.id)).toBe(0);
  expect((await db.una('SELECT COUNT(*)::int AS n FROM mensaje_avistamiento')).n).toBe(2);
});

test('permite informar un traslado después de publicar y descarta avistamientos anteriores a la pérdida', async () => {
  const segundoPerdido = (await publicar(propietario.token, { nombreAnimal: 'Mascota del segundo reporte' })).body;
  const fechaAnterior = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
  const anterior = (await publicarAvistamiento({ fechaEvento: fechaAnterior })).body;
  expect(await analizarReporte(anterior.id)).toBe(0);
  const visto = (await publicarAvistamiento({ nombreAnimal: 'Avistado sin traslado', horaEvento: '11:30' })).body;
  expect(visto.custodia).toBeNull();
  expect(await analizarReporte(visto.id)).toBe(1);
  const actualizar = request(app).put(`/api/publicaciones/${visto.id}`).set(conToken(testigo.token));
  for (const [k, v] of Object.entries(await datosBase({ tipo: 2, idRefugioCustodia: refugio.usuario.refugio.id }))) actualizar.field(k, String(v));
  const traslado = await actualizar;
  expect(traslado.body).toMatchObject({ horaEvento: '11:30', custodia: { idRefugio: refugio.usuario.refugio.id, confirmadaEn: null } });
  expect((await notificaciones(propietario)).body.datos).toContainEqual(expect.objectContaining({ tipo: 'Avistamiento', idPublicacion: visto.id }));
  expect((await detalle(segundoPerdido.id)).body.idEstado).toBe(1);
});
