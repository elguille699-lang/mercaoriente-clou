const serviciosDisponibles = ["gateway", "broker", "inventario", "pedidos", "notificaciones"];
const servicio = process.env.SERVICE;

if (!serviciosDisponibles.includes(servicio)) {
  console.error(
    `Defina la variable SERVICE con uno de estos valores: ${serviciosDisponibles.join(", ")}`,
  );
  process.exit(1);
}

await import(`./${servicio}/server.js`);
