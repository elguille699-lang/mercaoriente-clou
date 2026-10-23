import { obtenerConfig } from "../shared/config.js";
import { crearLogger } from "../shared/logger.js";
import { crearEventBus } from "../shared/eventBus.js";
import {
  crearServidor,
  escuchar,
  registrarManejoErrores,
  registrarSalud,
} from "../shared/servidor.js";
import {
  EstrategiaEmail,
  EstrategiaSms,
  EstrategiaWhatsApp,
  Notificador,
  construirMensaje,
} from "./canales.js";

const config = obtenerConfig("notificaciones");
const logger = crearLogger("notificaciones");
const app = crearServidor();

const notificador = new Notificador([
  new EstrategiaEmail(),
  new EstrategiaSms(),
  new EstrategiaWhatsApp(),
]);
const enviadas = [];
const eventosProcesados = new Set();
const temas = ["pedido.confirmado", "pedido.rechazado"];
let suscrito = false;

app.post("/eventos", (req, res) => {
  const evento = req.body ?? {};
  // El broker puede reintentar la entrega: se ignoran eventos ya procesados.
  if (eventosProcesados.has(evento.id)) {
    return res.status(200).json({ duplicado: true });
  }
  const mensaje = construirMensaje(evento.tema, evento.datos);
  if (!mensaje) {
    return res.status(202).json({ ignorado: true });
  }
  eventosProcesados.add(evento.id);
  const notificacion = {
    pedidoId: evento.datos.id,
    tema: evento.tema,
    ...notificador.notificar(evento.datos.cliente, mensaje),
  };
  enviadas.unshift(notificacion);
  logger.info("Notificación enviada", {
    pedidoId: notificacion.pedidoId,
    canal: notificacion.canal,
    idCorrelacion: evento.idCorrelacion,
  });
  return res.status(201).json(notificacion);
});

app.get("/notificaciones", (_req, res) => {
  res.json(enviadas);
});

registrarSalud(app, "notificaciones", {
  suscripcion: async () => {
    if (!suscrito) throw new Error("Aún no está suscrito al broker");
    return { temas };
  },
});
registrarManejoErrores(app, logger);
escuchar(app, config.puerto, logger);

const eventBus = crearEventBus({ brokerUrl: config.urls.broker, servicio: "notificaciones", logger });
Promise.all(temas.map((tema) => eventBus.suscribir(tema, config.notificacionesCallbackUrl)))
  .then(() => {
    suscrito = true;
    logger.info("Suscrito a los eventos de pedidos", { temas });
  })
  .catch((error) => logger.error("No fue posible suscribirse al broker", { error: error.message }));
