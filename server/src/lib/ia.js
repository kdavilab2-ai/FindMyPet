// Servicio de IA (Google Gemini) para validar imágenes y comparar fotos de mascotas.
// RNF-17: solo se envían imágenes y atributos del animal, nunca datos personales.
// RNF-08 / RNF-16: tiempo máximo de 30 s; si falla, el sistema sigue funcionando sin IA.

const TIEMPO_MAXIMO_MS = 30000;
const modelo = () => process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const disponible = () => Boolean(process.env.GEMINI_API_KEY) && process.env.NODE_ENV !== 'test';

async function consultarGemini(partes) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo()}:generateContent`,
      {
        method: 'POST',
        signal: controlador.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: partes }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0 },
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini respondió ${res.status}`);
    const json = await res.json();
    const textoRespuesta = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '{}';
    return JSON.parse(textoRespuesta);
  } finally {
    clearTimeout(temporizador);
  }
}

const imagen = (buffer, mime) => ({ inline_data: { mime_type: mime, data: buffer.toString('base64') } });

/**
 * RF-22: verifica que la imagen contenga un animal y sea apta.
 * Devuelve { valida: true|false|null, motivo }. null = no se pudo verificar (sin IA o error).
 */
async function validarImagen(buffer, mime) {
  if (!disponible()) return { valida: null, motivo: 'IA no configurada' };
  try {
    const r = await consultarGemini([
      imagen(buffer, mime),
      {
        text: 'Analiza la imagen para una plataforma de mascotas perdidas y en adopción. '
          + 'Responde solo JSON con la forma {"contiene_animal": boolean, "apta": boolean, "motivo": string}. '
          + '"apta" es false si la imagen es violenta, sexual, ofensiva o si el animal no se distingue. '
          + 'El motivo debe estar en español y tener menos de 15 palabras.',
      },
    ]);
    const valida = Boolean(r.contiene_animal) && Boolean(r.apta);
    return { valida, motivo: r.motivo || '' };
  } catch (err) {
    console.warn('[IA] No se pudo validar la imagen:', err.message);
    return { valida: null, motivo: 'Servicio de IA no disponible' };
  }
}

/**
 * Parte de RF-09: compara la foto de una mascota desaparecida con la de un animal encontrado.
 * Devuelve un puntaje de 0 a 100, o null si no hay IA disponible.
 */
async function compararImagenes(a, b) {
  if (!disponible()) return null;
  try {
    const r = await consultarGemini([
      imagen(a.buffer, a.mime),
      imagen(b.buffer, b.mime),
      {
        text: 'Las dos fotos muestran animales. Estima la probabilidad (0 a 100) de que sean el MISMO animal '
          + 'según especie, color, manchas, forma de orejas, tamaño y rasgos visibles. '
          + 'Responde solo JSON: {"similitud": number}.',
      },
    ]);
    const s = Number(r.similitud);
    return Number.isFinite(s) ? Math.max(0, Math.min(100, s)) : null;
  } catch (err) {
    console.warn('[IA] No se pudieron comparar las imágenes:', err.message);
    return null;
  }
}

module.exports = { validarImagen, compararImagenes, disponible };
