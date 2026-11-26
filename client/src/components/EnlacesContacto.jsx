const numeroInternacional = (valor) => /^0\d{9}$/.test(valor) ? `+593${valor.slice(1)}` : valor;
const iconos = { WhatsApp: '💬', Teléfono: '📞', Correo: '✉️' };

function enlaceContacto(c, nombre) {
  if (c.tipo === 'WhatsApp') return `https://wa.me/${numeroInternacional(c.valor).replace(/^\+/, '')}?text=${encodeURIComponent(`Hola, te escribo por ${nombre} que vi en FindMyPet`)}`;
  if (c.tipo === 'Teléfono') return `tel:${numeroInternacional(c.valor)}`;
  return `mailto:${c.valor}`;
}

export default function EnlacesContacto({ contactos, nombre }) {
  return (
    <div className="flex flex-wrap gap-2">
      {contactos?.map((c) => (
        <a key={c.tipo} href={enlaceContacto(c, nombre)} target={c.tipo === 'WhatsApp' ? '_blank' : undefined} rel="noreferrer"
          className={`btn ${c.tipo === 'WhatsApp' ? 'btn-exito' : 'btn-secundario'} max-w-full break-all`}>
          {iconos[c.tipo]} {c.tipo === 'Teléfono' ? `Llamar al ${numeroInternacional(c.valor)}` : c.tipo === 'WhatsApp' ? numeroInternacional(c.valor) : c.valor}
        </a>
      ))}
    </div>
  );
}
