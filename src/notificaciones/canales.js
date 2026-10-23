/**
 * Patrón Strategy: cada canal implementa la misma operación `enviar`.
 * Agregar un canal nuevo (por ejemplo push) no obliga a cambiar el notificador.
 * En el prototipo el envío es simulado; en producción cada estrategia llamaría
 * a su proveedor (correo, SMS o WhatsApp Business).
 */
export class EstrategiaEmail {
  canal = "email";

  enviar(cliente, mensaje) {
    const destino = cliente.email || `${cliente.nombre.toLowerCase().replace(/\s+/g, ".")}@cliente.co`;
    return { canal: this.canal, destino, asunto: mensaje.titulo, cuerpo: mensaje.texto };
  }
}

export class EstrategiaSms {
  canal = "sms";

  enviar(cliente, mensaje) {
    return {
      canal: this.canal,
      destino: cliente.telefono || "sin teléfono",
      cuerpo: `${mensaje.titulo}. ${mensaje.texto}`.slice(0, 160),
    };
  }
}

export class EstrategiaWhatsApp {
  canal = "whatsapp";

  enviar(cliente, mensaje) {
    return {
      canal: this.canal,
      destino: cliente.telefono || "sin teléfono",
      cuerpo: `*${mensaje.titulo}*\n${mensaje.texto}`,
    };
  }
}

export class Notificador {
  constructor(estrategias, canalPorDefecto = "email") {
    this.estrategias = new Map(estrategias.map((e) => [e.canal, e]));
    this.canalPorDefecto = canalPorDefecto;
  }

  notificar(cliente, mensaje) {
    const estrategia =
      this.estrategias.get(cliente.canal) ?? this.estrategias.get(this.canalPorDefecto);
    return {
      ...estrategia.enviar(cliente, mensaje),
      fecha: new Date().toISOString(),
    };
  }
}

const formatoPesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export const construirMensaje = (tema, pedido) => {
  if (tema === "pedido.confirmado") {
    return {
      titulo: `Pedido ${pedido.id} confirmado`,
      texto: `Hola ${pedido.cliente.nombre}, su pedido por ${formatoPesos.format(pedido.total)} fue confirmado y se encuentra en alistamiento.`,
    };
  }
  if (tema === "pedido.rechazado") {
    const skus = (pedido.faltantes ?? []).map((f) => f.sku).join(", ");
    return {
      titulo: `Pedido ${pedido.id} no pudo procesarse`,
      texto: `Hola ${pedido.cliente.nombre}, no hay inventario suficiente para: ${skus || "algunos productos"}. Un asesor lo contactará.`,
    };
  }
  return null;
};
