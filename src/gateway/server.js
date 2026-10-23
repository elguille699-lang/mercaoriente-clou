import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { obtenerConfig } from "../shared/config.js";
import { crearLogger } from "../shared/logger.js";
import { solicitarJson } from "../shared/httpClient.js";
import {
  asincrono,
  crearServidor,
  escuchar,
  registrarManejoErrores,
} from "../shared/servidor.js";
import { crearLimitador } from "./limitador.js";

const config = obtenerConfig("gateway");
const logger = crearLogger("gateway");
const app = crearServidor();
const carpetaPublica = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");

/**
 * Patrón API Gateway: punto de entrada único. El cliente solo conoce /api/*;
 * el gateway decide a qué servicio interno reenviar cada solicitud.
 */
const rutas = [
  { prefijo: "/api/productos", destino: config.urls.inventario, reescribir: "/productos" },
  { prefijo: "/api/pedidos", destino: config.urls.pedidos, reescribir: "/pedidos" },
  { prefijo: "/api/circuito", destino: config.urls.pedidos, reescribir: "/circuito" },
  { prefijo: "/api/notificaciones", destino: config.urls.notificaciones, reescribir: "/notificaciones" },
  { prefijo: "/api/eventos", destino: config.urls.broker, reescribir: "/eventos" },
  { prefijo: "/api/admin/inventario/falla", destino: config.urls.inventario, reescribir: "/admin/falla" },
];

const servicios = {
  broker: config.urls.broker,
  inventario: config.urls.inventario,
  pedidos: config.urls.pedidos,
  notificaciones: config.urls.notificaciones,
};

app.set("trust proxy", true);
app.use(express.static(carpetaPublica));

app.get(
  "/api/salud",
  asincrono(async (_req, res) => {
    const resultados = await Promise.all(
      Object.entries(servicios).map(async ([nombre, url]) => {
        try {
          const salud = await solicitarJson(`${url}/salud`, { timeoutMs: 1500 });
          return [nombre, salud];
        } catch (error) {
          return [nombre, { servicio: nombre, estado: "DOWN", error: error.message, detalle: error.datos }];
        }
      }),
    );
    const detalle = Object.fromEntries(resultados);
    const disponible = Object.values(detalle).every((s) => s.estado === "UP");
    res.status(disponible ? 200 : 503).json({
      gateway: "UP",
      estadoGeneral: disponible ? "UP" : "DEGRADADO",
      servicios: detalle,
    });
  }),
);

app.use("/api", crearLimitador({ limitePorMinuto: config.limiteSolicitudesMinuto }));

app.use(
  "/api",
  asincrono(async (req, res) => {
    const rutaCompleta = `/api${req.path}`;
    const ruta = rutas.find(
      (r) => rutaCompleta === r.prefijo || rutaCompleta.startsWith(`${r.prefijo}/`),
    );
    if (!ruta) {
      return res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${rutaCompleta}` });
    }

    const resto = rutaCompleta.slice(ruta.prefijo.length);
    const consulta = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
    const url = `${ruta.destino}${ruta.reescribir}${resto}${consulta}`;
    const tieneCuerpo = !["GET", "HEAD"].includes(req.method);

    try {
      const respuesta = await fetch(url, {
        method: req.method,
        headers: {
          "Content-Type": "application/json",
          "x-correlation-id": req.idCorrelacion,
        },
        body: tieneCuerpo ? JSON.stringify(req.body ?? {}) : undefined,
        signal: AbortSignal.timeout(5000),
      });
      const texto = await respuesta.text();
      res.status(respuesta.status);
      res.type("application/json");
      return res.send(texto || "{}");
    } catch (error) {
      logger.error("Servicio interno no disponible", { url, error: error.message });
      return res.status(502).json({
        error: "El servicio solicitado no está disponible",
        servicio: ruta.prefijo,
      });
    }
  }),
);

registrarManejoErrores(app, logger);
escuchar(app, config.puerto, logger);
