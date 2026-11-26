const { app, db, request, limpiarBD, cerrarBD, crearUsuario, publicar, conToken, idSector } = require('./ayudas');
const { analizarReporte, puntuarAtributos, porcentajeTotal } = require('../src/services/coincidencias.service');
const { enviarAlertasProximidad } = require('../src/services/alertas.service');
const ia = require('../src/lib/ia');

let ana;
let luis;
let vecino;

beforeAll(async () => {
  await limpiarBD();
  ana = await crearUsuario({ correo: 'ana@findmypet.test', nombres: 'Ana' });
  luis = await crearUsuario({ correo: 'luis@findmypet.test', nombres: 'Luis' });
  vecino = await crearUsuario({ correo: 'vecino@findmypet.test', nombres: 'Vecino' });
});
afterAll(cerrarBD);

describe('Puntaje por atributos', () => {
  const base = {
    idEspecie: 1, idRaza: 1, raza: 'Mestizo', idTamano: 2, colores: [3, 2], latitud: -2.14, longitud: -79.60,
    idSector: 1, idCanton: 1, idProvincia: 1, fechaEvento: '2026-11-10',
  };

  test('especies distintas nunca coinciden', () => {
    expect(puntuarAtributos(base, { ...base, idEspecie: 2 })).toBeNull();
  });

  test('animal muy parecido, cercano y encontrado después tiene puntaje alto', () => {
    const p = puntuarAtributos(base, { ...base, fechaEvento: '2026-11-11', latitud: -2.141, longitud: -79.601 });
    expect(porcentajeTotal(p)).toBeGreaterThanOrEqual(90);
  });

  test('un animal encontrado ANTES de perderse no coincide por fecha', () => {
    const p = puntuarAtributos(base, { ...base, fechaEvento: '2026-11-01' });
    expect(p[6]).toBe(0);
  });

  test('colores y lugar distintos bajan el porcentaje', () => {
    const p = puntuarAtributos(base, { ...base, colores: [1], latitud: -0.18, longitud: -78.48, idTamano: 3 });
    expect(porcentajeTotal(p)).toBeLessThan(60);
  });
});

describe('RF-09, RF-10, RF-11: coincidencias sugeridas', () => {
  let perdido;
  let encontrado;

  test('el análisis sugiere la coincidencia y notifica al propietario', async () => {
    perdido = (await publicar(ana.token, { nombreAnimal: 'Rocky' })).body;
    encontrado = (await publicar(luis.token, { tipo: 2, nombreAnimal: '', latitud: -2.1420, longitud: -79.6020, fechaEvento: new Date().toISOString().slice(0, 10) })).body;
    await publicar(luis.token, { tipo: 2, nombreAnimal: '', idEspecie: 2, idRaza: '' }); // gato: no debe coincidir

    const nuevas = await analizarReporte(encontrado.id);
    expect(nuevas).toBe(1);
    const res = await request(app).get('/api/coincidencias').set(conToken(ana.token));
    expect(res.body).toHaveLength(1);
    expect(res.body[0].porcentaje).toBeGreaterThanOrEqual(60);
    expect(res.body[0].estado).toBe('Sugerida');
    expect(res.body[0].criterios.map((c) => c.criterio)).toEqual(['Especie', 'Raza', 'Color', 'Tamaño', 'Ubicación', 'Fecha', 'Señas particulares']);
    const notif = await request(app).get('/api/notificaciones').set(conToken(ana.token));
    expect(notif.body.datos[0].tipo).toBe('Coincidencia IA');
  });

  test('analizar de nuevo no duplica la coincidencia', async () => {
    expect(await analizarReporte(perdido.id)).toBe(0);
    const { n } = await db.una('SELECT COUNT(*)::int AS n FROM coincidencia');
    expect(n).toBe(1);
  });

  test('solo el propietario confirma; al confirmar se notifica a quien lo encontró', async () => {
    const [co] = (await request(app).get('/api/coincidencias').set(conToken(ana.token))).body;
    expect((await request(app).patch(`/api/coincidencias/${co.id}`).set(conToken(luis.token)).send({ idEstado: 2 })).status).toBe(403);
    expect((await request(app).patch(`/api/coincidencias/${co.id}`).set(conToken(ana.token)).send({ idEstado: 2 })).status).toBe(200);
    const deLuis = await request(app).get('/api/coincidencias').set(conToken(luis.token));
    expect(deLuis.body[0].estado).toBe('Confirmada');
    const notif = await request(app).get('/api/notificaciones').set(conToken(luis.token));
    expect(notif.body.datos[0].mensaje).toContain('cree que el animal que encontraste es suyo');
  });

  test('una coincidencia descartada no vuelve a sugerirse', async () => {
    const otro = (await publicar(luis.token, { tipo: 2, nombreAnimal: '', fechaEvento: new Date().toISOString().slice(0, 10) })).body;
    await analizarReporte(otro.id);
    const lista = (await request(app).get('/api/coincidencias').set(conToken(ana.token))).body;
    const nueva = lista.find((c) => c.encontrada.id === otro.id);
    await request(app).patch(`/api/coincidencias/${nueva.id}`).set(conToken(ana.token)).send({ idEstado: 3 });
    await request(app).post(`/api/coincidencias/analizar/${perdido.id}`).set(conToken(ana.token));
    const despues = (await request(app).get('/api/coincidencias').set(conToken(ana.token))).body.find((c) => c.id === nueva.id);
    expect(despues.estado).toBe('Descartada');
  });

  test('RNF-16: sin IA configurada la validación de imágenes no bloquea la publicación', async () => {
    expect(ia.disponible()).toBe(false);
    expect(await ia.validarImagen(Buffer.from('x'), 'image/webp')).toEqual({ valida: null, motivo: 'IA no configurada' });
    const m = await db.una('SELECT es_valida_ia FROM multimedia LIMIT 1');
    expect(m.esValidaIa).toBeNull();
  });

  test('RF-22: si la IA rechaza una imagen, la publicación no se guarda', async () => {
    const espia = jest.spyOn(ia, 'validarImagen').mockResolvedValue({ valida: false, motivo: 'No se reconoce un animal' });
    const antes = (await db.una('SELECT COUNT(*)::int AS n FROM publicacion')).n;
    const res = await publicar(ana.token);
    expect(res.status).toBe(422);
    expect(res.body.error).toContain('No se reconoce un animal');
    expect((await db.una('SELECT COUNT(*)::int AS n FROM publicacion')).n).toBe(antes);
    espia.mockRestore();
  });
});

describe('RF-26: alertas por proximidad', () => {
  test('notifica a usuarios dentro del radio, no a los lejanos ni al autor', async () => {
    await request(app).put('/api/perfil/alertas').set(conToken(vecino.token))
      .send({ idSector: await idSector('Milagro', 'Centro'), latitud: -2.1342, longitud: -79.5939, radioKm: 5 });
    await request(app).put('/api/perfil/alertas').set(conToken(luis.token))
      .send({ idSector: await idSector('Quito', 'La Carolina'), latitud: -0.1807, longitud: -78.4678, radioKm: 5 });

    const p = (await publicar(ana.token, { nombreAnimal: 'Canela' })).body;
    expect(await enviarAlertasProximidad(p.id)).toBe(1);
    const notif = await request(app).get('/api/notificaciones').set(conToken(vecino.token));
    expect(notif.body.datos[0]).toMatchObject({ tipo: 'Alerta de proximidad' });
    expect(notif.body.datos[0].mensaje).toContain('Canela');
  });
});
