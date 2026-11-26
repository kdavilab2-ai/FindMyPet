const whatsappInternacional = (valor) => `+593${valor.replace(/^0/, '')}`;
const iconos = { WhatsApp: '💬', Teléfono: '📞', Correo: '✉️' };

function enlaceContacto(c, nombre) {
  if (c.tipo === 'WhatsApp') return `https://wa.me/${whatsappInternacional(c.valor).slice(1)}?text=${encodeURIComponent(`Hola, te escribo por ${nombre} que vi en FindMyPet`)}`;
  if (c.tipo === 'Teléfono') return `tel:${c.valor}`;
  return `mailto:${c.valor}`;
}

export default function EnlacesContacto({ contactos, nombre }) {
  return (
    <div className="flex flex-wrap gap-2">
      {contactos?.map((c) => (
        <a key={c.tipo} href={enlaceContacto(c, nombre)} target="_blank" rel="noreferrer"
          className={`btn ${c.tipo === 'WhatsApp' ? 'btn-exito' : 'btn-secundario'} max-w-full break-all`}>
          {iconos[c.tipo]} {c.tipo === 'WhatsApp' ? whatsappInternacional(c.valor) : c.valor}
        </a>
      ))}
    </div>
  );
}
