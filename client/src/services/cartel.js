// RF-23: cartel de búsqueda descargable en PDF con los datos y la foto de la mascota desaparecida
import { jsPDF } from 'jspdf';
import { urlArchivo } from './api';

// Convierte la foto (WEBP) a JPEG mediante un canvas para poder insertarla en el PDF
async function fotoComoJpeg(url) {
  const res = await fetch(url);
  const bitmap = await createImageBitmap(await res.blob());
  const canvas = document.createElement('canvas');
  const escala = Math.min(1, 1200 / bitmap.width);
  canvas.width = bitmap.width * escala;
  canvas.height = bitmap.height * escala;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return { datos: canvas.toDataURL('image/jpeg', 0.9), ancho: canvas.width, alto: canvas.height };
}

export async function generarCartel(p) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ancho = 210;
  const margen = 15;

  doc.setFillColor(240, 90, 90);
  doc.rect(0, 0, ancho, 38, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(40);
  doc.text('SE BUSCA', ancho / 2, 22, { align: 'center' });
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text(`${p.especie} perdido${p.especie === 'Gata' ? 'a' : ''} · Ayúdanos a encontrarlo`, ancho / 2, 31, { align: 'center' });

  let y = 46;
  const foto = p.multimedia?.find((m) => m.tipo === 'Imagen');
  if (foto) {
    try {
      const img = await fotoComoJpeg(urlArchivo(foto.url));
      const maxAncho = ancho - margen * 2;
      const maxAlto = 105;
      const escala = Math.min(maxAncho / img.ancho, maxAlto / img.alto);
      const w = img.ancho * escala;
      const h = img.alto * escala;
      doc.addImage(img.datos, 'JPEG', (ancho - w) / 2, y, w, h);
      y += h + 8;
    } catch {
      y += 4;
    }
  }

  doc.setTextColor(20, 18, 43);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.text(p.nombreAnimal || 'Sin nombre', ancho / 2, y + 6, { align: 'center' });
  y += 16;

  doc.setFontSize(12);
  const filas = [
    ['Especie / raza', [p.especie, p.raza].filter(Boolean).join(' · ')],
    ['Tamaño', p.tamano || 'No indicado'],
    ['Color', p.colores?.map((c) => c.nombre).join(', ') || 'No indicado'],
    ['Visto por última vez', `${p.ubicacion?.sector}, ${p.ubicacion?.canton}${p.ubicacion?.direccion ? ` (${p.ubicacion.direccion})` : ''}`],
    ['Fecha', new Date(`${p.fechaEvento}T12:00:00`).toLocaleDateString('es-EC', { dateStyle: 'long' })],
  ];
  for (const [etiqueta, valor] of filas) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${etiqueta}:`, margen, y);
    doc.setFont('helvetica', 'normal');
    const lineas = doc.splitTextToSize(valor, 120);
    doc.text(lineas, margen + 50, y);
    y += 7 * lineas.length;
  }
  y += 2;
  doc.setFont('helvetica', 'normal');
  const descripcion = doc.splitTextToSize(p.descripcion, ancho - margen * 2);
  doc.text(descripcion.slice(0, 5), margen, y);
  y += 6 * Math.min(descripcion.length, 5) + 4;

  const contactos = (p.contactos || []).map((c) => `${c.tipo}: ${c.valor}`).join('     ');
  doc.setFillColor(124, 58, 237);
  doc.roundedRect(margen, Math.min(y, 255), ancho - margen * 2, 22, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Si lo has visto, comunícate:', ancho / 2, Math.min(y, 255) + 8, { align: 'center' });
  doc.setFontSize(15);
  doc.text(contactos || 'Ver publicación en FindMyPet', ancho / 2, Math.min(y, 255) + 16, { align: 'center' });

  doc.setTextColor(120, 120, 140);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Publicado en FindMyPet · ${window.location.origin}/publicaciones/${p.id}`, ancho / 2, 290, { align: 'center' });

  doc.save(`cartel-${(p.nombreAnimal || 'mascota').toLowerCase().replace(/\s+/g, '-')}.pdf`);
}
