import { test } from "node:test";
import assert from "node:assert/strict";
import { InventarioServicio } from "../src/inventario/inventarioServicio.js";
import { ProductoRepositorioMemoria } from "../src/inventario/productoRepositorio.js";
import { PedidoServicio, estadosPedido, temasPedido } from "../src/pedidos/pedidoServicio.js";
import { PedidoRepositorioMemoria } from "../src/pedidos/pedidoRepositorio.js";
import { CircuitBreaker } from "../src/shared/circuitBreaker.js";
import {
  EstrategiaEmail,
  EstrategiaSms,
  EstrategiaWhatsApp,
  Notificador,
} from "../src/notificaciones/canales.js";

const crearInventario = () =>
  new InventarioServicio(
    new ProductoRepositorioMemoria([{ sku: "ARZ", nombre: "Arroz", precio: 1000, stock: 10 }]),
  );

test("inventario descuenta stock al reservar", () => {
  const inventario = crearInventario();
  const reserva = inventario.reservar("PED-1", [{ sku: "ARZ", cantidad: 4 }]);
  assert.equal(reserva.total, 4000);
  assert.equal(inventario.obtenerProducto("ARZ").stock, 6);
});

test("inventario rechaza la reserva sin stock y no descuenta nada", () => {
  const inventario = crearInventario();
  assert.throws(() => inventario.reservar("PED-1", [{ sku: "ARZ", cantidad: 50 }]), { status: 409 });
  assert.equal(inventario.obtenerProducto("ARZ").stock, 10);
});

test("el pedido confirmado publica el evento pedido.confirmado", async () => {
  const inventario = crearInventario();
  const eventos = [];
  const servicio = new PedidoServicio({
    repositorio: new PedidoRepositorioMemoria(),
    clienteInventario: { reservar: async (id, items) => inventario.reservar(id, items) },
    circuitBreaker: new CircuitBreaker({ nombre: "inventario" }),
    eventBus: { publicar: async (tema, datos) => eventos.push({ tema, datos }) },
    logger: { warn: () => {} },
  });

  const pedido = await servicio.crearPedido({
    cliente: { nombre: "Tienda", canal: "sms" },
    items: [{ sku: "ARZ", cantidad: 2 }],
  });

  assert.equal(pedido.estado, estadosPedido.confirmado);
  assert.equal(eventos[0].tema, temasPedido.confirmado);
});

test("el notificador elige la estrategia según el canal del cliente", () => {
  const notificador = new Notificador([
    new EstrategiaEmail(),
    new EstrategiaSms(),
    new EstrategiaWhatsApp(),
  ]);
  const mensaje = { titulo: "Pedido", texto: "Confirmado" };

  assert.equal(notificador.notificar({ nombre: "A", canal: "whatsapp", telefono: "300" }, mensaje).canal, "whatsapp");
  assert.equal(notificador.notificar({ nombre: "B", canal: "sms", telefono: "301" }, mensaje).canal, "sms");
  assert.equal(notificador.notificar({ nombre: "C", canal: "otro" }, mensaje).canal, "email");
});
