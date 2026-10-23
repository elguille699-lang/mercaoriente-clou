import { conReintentos } from "../shared/retry.js";

export const estadosPedido = Object.freeze({
  confirmado: "CONFIRMADO",
  rechazado: "RECHAZADO",
});

export const temasPedido = Object.freeze({
  confirmado: "pedido.confirmado",
  rechazado: "pedido.rechazado",
});

const canalesValidos = ["email", "sms", "whatsapp"];

const errorValidacion = (mensaje) => {
  const error = new Error(mensaje);
  error.status = 400;
  return error;
};

export class PedidoServicio {
  constructor({ repositorio, clienteInventario, circuitBreaker, eventBus, logger, reintentos = 3 }) {
    this.repositorio = repositorio;
    this.clienteInventario = clienteInventario;
    this.circuitBreaker = circuitBreaker;
    this.eventBus = eventBus;
    this.logger = logger;
    this.reintentos = reintentos;
  }

  validar({ cliente, items }) {
    if (!cliente?.nombre) {
      throw errorValidacion("El nombre del cliente es obligatorio");
    }
    const canal = cliente.canal ?? "email";
    if (!canalesValidos.includes(canal)) {
      throw errorValidacion(`Canal de notificación no soportado: ${canal}`);
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw errorValidacion("El pedido debe tener al menos un producto");
    }
    return { ...cliente, canal };
  }

  async crearPedido(solicitud, idCorrelacion) {
    const cliente = this.validar(solicitud);
    const id = this.repositorio.siguienteId();
    const items = solicitud.items.map(({ sku, cantidad }) => ({ sku, cantidad: Number(cantidad) }));

    let reserva;
    try {
      reserva = await this.circuitBreaker.ejecutar(() =>
        conReintentos(() => this.clienteInventario.reservar(id, items, idCorrelacion), {
          intentos: this.reintentos,
          esperaMs: 150,
          alReintentar: (intento, error) =>
            this.logger.warn("Reintentando reserva en inventario", {
              pedidoId: id,
              intento,
              error: error.message,
            }),
        }),
      );
    } catch (error) {
      if (!error.esErrorNegocio) {
        const noDisponible = new Error(
          "El inventario no está disponible en este momento. Intente de nuevo en unos segundos.",
        );
        noDisponible.status = 503;
        noDisponible.codigo = error.codigo ?? "INVENTARIO_NO_DISPONIBLE";
        noDisponible.datos = { circuito: this.circuitBreaker.resumen() };
        throw noDisponible;
      }
      const rechazado = this.repositorio.guardar({
        id,
        cliente,
        items,
        estado: estadosPedido.rechazado,
        motivo: error.message,
        faltantes: error.datos?.detalle?.faltantes ?? [],
        fecha: new Date().toISOString(),
      });
      await this.eventBus.publicar(temasPedido.rechazado, rechazado, idCorrelacion);
      return rechazado;
    }

    const confirmado = this.repositorio.guardar({
      id,
      cliente,
      items: reserva.detalle,
      total: reserva.total,
      estado: estadosPedido.confirmado,
      fecha: new Date().toISOString(),
    });
    await this.eventBus.publicar(temasPedido.confirmado, confirmado, idCorrelacion);
    return confirmado;
  }

  listar() {
    return this.repositorio.listar();
  }

  obtener(id) {
    const pedido = this.repositorio.buscarPorId(id);
    if (!pedido) {
      const error = new Error(`No existe el pedido ${id}`);
      error.status = 404;
      throw error;
    }
    return pedido;
  }
}
