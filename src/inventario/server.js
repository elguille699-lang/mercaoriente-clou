import { obtenerConfig } from "../shared/config.js";
import { crearLogger } from "../shared/logger.js";
import {
  crearServidor,
  escuchar,
  registrarManejoErrores,
  registrarSalud,
} from "../shared/servidor.js";
import { InventarioServicio } from "./inventarioServicio.js";
import { ProductoRepositorioMemoria, productosIniciales } from "./productoRepositorio.js";

const config = obtenerConfig("inventario");
const logger = crearLogger("inventario");
const app = crearServidor();
const servicio = new InventarioServicio(new ProductoRepositorioMemoria(productosIniciales));

// Permite simular una caída del servicio para demostrar el Circuit Breaker.
let fallaSimulada = false;

app.post("/admin/falla", (req, res) => {
  fallaSimulada = Boolean(req.body?.activa);
  logger.warn("Cambio de falla simulada", { fallaSimulada });
  res.json({ fallaSimulada });
});

app.use((req, res, next) => {
  if (fallaSimulada && req.path !== "/salud" && !req.path.startsWith("/admin")) {
    return res.status(503).json({ error: "Inventario no disponible (falla simulada)" });
  }
  return next();
});

app.get("/productos", (_req, res) => {
  res.json(servicio.listarProductos());
});

app.get("/productos/:sku", (req, res) => {
  res.json(servicio.obtenerProducto(req.params.sku));
});

app.post("/reservas", (req, res) => {
  const { pedidoId, items } = req.body ?? {};
  const reserva = servicio.reservar(pedidoId, items);
  logger.info("Reserva creada", { pedidoId, total: reserva.total, idCorrelacion: req.idCorrelacion });
  res.status(201).json(reserva);
});

registrarSalud(app, "inventario", {
  catalogo: async () => ({ productos: servicio.listarProductos().length }),
  fallaSimulada: async () => {
    if (fallaSimulada) throw new Error("Falla simulada activa");
    return { activa: false };
  },
});
registrarManejoErrores(app, logger);
escuchar(app, config.puerto, logger);
