const base = process.env.GATEWAY_URL || "http://localhost:8080";
const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

const llamar = async (metodo, ruta, cuerpo) => {
  const respuesta = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await respuesta.json().catch(() => ({}));
  return { status: respuesta.status, datos };
};

const titulo = (texto) => console.log(`\n=== ${texto} ===`);

const pedido = (nombre, canal, items) => ({
  cliente: { nombre, telefono: "3001234567", canal },
  items,
});

titulo("1. Salud de los servicios (Health Endpoint Monitoring)");
const salud = await llamar("GET", "/api/salud");
console.log(`Estado general: ${salud.datos.estadoGeneral}`);
Object.entries(salud.datos.servicios).forEach(([nombre, s]) => console.log(`  - ${nombre}: ${s.estado}`));

titulo("2. Catálogo consultado a través del API Gateway");
const productos = await llamar("GET", "/api/productos");
productos.datos.forEach((p) => console.log(`  - ${p.sku} ${p.nombre}: stock ${p.stock}`));

titulo("3. Pedido con inventario suficiente");
const ok = await llamar(
  "POST",
  "/api/pedidos",
  pedido("Tienda La Esquina", "whatsapp", [
    { sku: "ARZ-500", cantidad: 20 },
    { sku: "ACT-1000", cantidad: 5 },
  ]),
);
console.log(`HTTP ${ok.status} · ${ok.datos.id} · ${ok.datos.estado} · total ${ok.datos.total}`);

titulo("4. Pedido sin inventario suficiente (error de negocio)");
const rechazado = await llamar(
  "POST",
  "/api/pedidos",
  pedido("Minimercado El Centro", "email", [{ sku: "FRJ-500", cantidad: 500 }]),
);
console.log(`HTTP ${rechazado.status} · ${rechazado.datos.id} · ${rechazado.datos.estado} · ${rechazado.datos.motivo}`);

await esperar(800);
titulo("5. Notificaciones recibidas por eventos (Publicador/Suscriptor + Strategy)");
const notificaciones = await llamar("GET", "/api/notificaciones");
notificaciones.datos.forEach((n) => console.log(`  - [${n.canal}] ${n.pedidoId} → ${n.destino}: ${n.cuerpo.replace(/\n/g, " ")}`));

titulo("6. Caída de inventario: Retry + Circuit Breaker");
await llamar("POST", "/api/admin/inventario/falla", { activa: true });
for (let intento = 1; intento <= 5; intento += 1) {
  const inicio = Date.now();
  const r = await llamar(
    "POST",
    "/api/pedidos",
    pedido("Tienda Norte", "sms", [{ sku: "PAN-500", cantidad: 2 }]),
  );
  const circuito = await llamar("GET", "/api/circuito");
  console.log(
    `  Intento ${intento}: HTTP ${r.status} · ${r.datos.codigo} · ${Date.now() - inicio} ms · circuito ${circuito.datos.estado}`,
  );
}

titulo("7. Recuperación del servicio");
await llamar("POST", "/api/admin/inventario/falla", { activa: false });
const circuitoFinal = await llamar("GET", "/api/circuito");
console.log(
  `Inventario restablecido. El circuito sigue ${circuitoFinal.datos.estado} y deja pasar una prueba tras ${circuitoFinal.datos.tiempoAbiertoMs / 1000} s.`,
);
