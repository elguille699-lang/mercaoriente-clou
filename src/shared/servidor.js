import { randomUUID } from "node:crypto";
import express from "express";

export const asincrono = (manejador) => (req, res, next) =>
  Promise.resolve(manejador(req, res, next)).catch(next);

export const crearServidor = () => {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use((req, res, next) => {
    req.idCorrelacion = req.get("x-correlation-id") || randomUUID();
    res.set("x-correlation-id", req.idCorrelacion);
    next();
  });
  return app;
};

/** Patrón Health Endpoint Monitoring: expone el estado del servicio en /salud. */
export const registrarSalud = (app, servicio, verificaciones = {}) => {
  const inicio = Date.now();
  app.get("/salud", async (_req, res) => {
    const detalle = {};
    let disponible = true;
    for (const [nombre, verificar] of Object.entries(verificaciones)) {
      try {
        detalle[nombre] = await verificar();
      } catch (error) {
        disponible = false;
        detalle[nombre] = { error: error.message };
      }
    }
    res.status(disponible ? 200 : 503).json({
      servicio,
      estado: disponible ? "UP" : "DOWN",
      activoDesdeSegundos: Math.round((Date.now() - inicio) / 1000),
      detalle,
    });
  });
};

export const registrarManejoErrores = (app, logger) => {
  app.use((req, res) => {
    res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
  });
  // Express identifica el manejador de errores por sus cuatro parámetros.
  app.use((error, req, res, _next) => {
    const status = error.status || 500;
    if (status >= 500) {
      logger.error("Error no controlado", {
        ruta: req.path,
        error: error.message,
        idCorrelacion: req.idCorrelacion,
      });
    }
    res.status(status).json({
      error: error.message,
      codigo: error.codigo,
      detalle: error.datos,
    });
  });
};

export const escuchar = (app, puerto, logger) =>
  app.listen(puerto, () => logger.info(`Servicio escuchando en el puerto ${puerto}`));
