import { obtenerConfig } from "../shared/config.js";
import { crearLogger } from "../shared/logger.js";
import { solicitarJson } from "../shared/httpClient.js";
import { CircuitBreaker } from "../shared/circuitBreaker.js";
import { crearEventBus } from "../shared/eventBus.js";
import {
  asincrono,
  crearServidor,
  escuchar,
  registrarManejoErrores,
  registrarSalud,
} from "../shared/servidor.js";
import { PedidoRepositorioMemoria } from "./pedidoRepositorio.js";
import { PedidoServicio, estadosPedido } from "./pedidoServicio.js";

const config = obtenerConfig("pedidos");
const logger = crearLogger("pedidos");
const app = crearServidor();

const circuitBreaker = new CircuitBreaker({
  nombre: "inventario",
  umbralFallos: config.resiliencia.umbralFallos,
  tiempoAbiertoMs: config.resiliencia.tiempoAbiertoMs,
  alCambiarEstado: (anterior, nuevo) =>
    logger.warn("Cambio de estado del circuito", { circuito: "inventario", anterior, nuevo }),
});

const clienteInventario = {
  reservar: (pedidoId, items, idCorrelacion) =>
    solicitarJson(`${config.urls.inventario}/reservas`, {
      metodo: "POST",
      cuerpo: { pedidoId, items },
      timeoutMs: 1500,
      encabezados: { "x-correlation-id": idCorrelacion },
    }),
};

const servicio = new PedidoServicio({
  repositorio: new PedidoRepositorioMemoria(),
  clienteInventario,
  circuitBreaker,
  eventBus: crearEventBus({ brokerUrl: config.urls.broker, servicio: "pedidos", logger }),
  logger,
  reintentos: config.resiliencia.reintentos,
});

app.post(
  "/pedidos",
  asincrono(async (req, res) => {
    const pedido = await servicio.crearPedido(req.body ?? {}, req.idCorrelacion);
    logger.info("Pedido procesado", {
      pedidoId: pedido.id,
      estado: pedido.estado,
      idCorrelacion: req.idCorrelacion,
    });
    res.status(pedido.estado === estadosPedido.confirmado ? 201 : 409).json(pedido);
  }),
);

app.get("/pedidos", (_req, res) => {
  res.json(servicio.listar());
});

app.get("/pedidos/:id", (req, res) => {
  res.json(servicio.obtener(req.params.id));
});

app.get("/circuito", (_req, res) => {
  res.json(circuitBreaker.resumen());
});

registrarSalud(app, "pedidos", {
  circuitoInventario: async () => circuitBreaker.resumen(),
});
registrarManejoErrores(app, logger);
escuchar(app, config.puerto, logger);
