import { randomUUID } from "node:crypto";
import { obtenerConfig } from "../shared/config.js";
import { crearLogger } from "../shared/logger.js";
import { solicitarJson } from "../shared/httpClient.js";
import { conReintentos } from "../shared/retry.js";
import {
  crearServidor,
  escuchar,
  registrarManejoErrores,
  registrarSalud,
} from "../shared/servidor.js";

const config = obtenerConfig("broker");
const logger = crearLogger("broker");
const app = crearServidor();

const suscripciones = new Map();
const historial = [];
const maxHistorial = 100;

const entregar = async (evento, url) => {
  try {
    await conReintentos(
      () => solicitarJson(url, { metodo: "POST", cuerpo: evento, timeoutMs: 3000 }),
      { intentos: 4, esperaMs: 300 },
    );
    evento.entregas.push({ url, estado: "ENTREGADO" });
  } catch (error) {
    evento.entregas.push({ url, estado: "FALLIDO", error: error.message });
    logger.error("No se pudo entregar el evento", { tema: evento.tema, url, error: error.message });
  }
};

app.post("/suscripciones", (req, res) => {
  const { tema, url, servicio } = req.body ?? {};
  if (!tema || !url) {
    return res.status(400).json({ error: "Los campos tema y url son obligatorios" });
  }
  if (!suscripciones.has(tema)) {
    suscripciones.set(tema, new Map());
  }
  suscripciones.get(tema).set(url, { url, servicio, desde: new Date().toISOString() });
  logger.info("Suscripción registrada", { tema, url, servicio });
  return res.status(201).json({ tema, url });
});

app.get("/suscripciones", (_req, res) => {
  const listado = [...suscripciones.entries()].map(([tema, suscriptores]) => ({
    tema,
    suscriptores: [...suscriptores.values()],
  }));
  res.json(listado);
});

app.post("/publicar", (req, res) => {
  const { tema, origen, datos } = req.body ?? {};
  if (!tema) {
    return res.status(400).json({ error: "El campo tema es obligatorio" });
  }
  const evento = {
    id: randomUUID(),
    tema,
    origen,
    datos,
    fecha: new Date().toISOString(),
    idCorrelacion: req.idCorrelacion,
    entregas: [],
  };
  historial.unshift(evento);
  historial.length = Math.min(historial.length, maxHistorial);

  const destinos = [...(suscripciones.get(tema)?.keys() ?? [])];
  destinos.forEach((url) => entregar(evento, url));
  logger.info("Evento publicado", { tema, origen, destinos: destinos.length });
  return res.status(202).json({ id: evento.id, tema, destinos: destinos.length });
});

app.get("/eventos", (_req, res) => {
  res.json(historial);
});

registrarSalud(app, "broker", {
  suscripciones: async () => ({ temas: suscripciones.size }),
  eventos: async () => ({ enHistorial: historial.length }),
});
registrarManejoErrores(app, logger);
escuchar(app, config.puerto, logger);
