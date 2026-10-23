import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const orden = ["broker", "inventario", "pedidos", "notificaciones", "gateway"];
const colores = {
  broker: "\x1b[35m",
  inventario: "\x1b[36m",
  pedidos: "\x1b[33m",
  notificaciones: "\x1b[32m",
  gateway: "\x1b[34m",
};
const reset = "\x1b[0m";

const procesos = orden.map((servicio) => {
  const hijo = spawn(process.execPath, [path.join(raiz, "src", "index.js")], {
    env: { ...process.env, SERVICE: servicio, PORT: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const prefijo = `${colores[servicio]}[${servicio.padEnd(14)}]${reset} `;
  const imprimir = (flujo) => (bloque) =>
    bloque
      .toString()
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((linea) => flujo.write(`${prefijo}${linea}\n`));
  hijo.stdout.on("data", imprimir(process.stdout));
  hijo.stderr.on("data", imprimir(process.stderr));
  hijo.on("exit", (codigo) => {
    process.stdout.write(`${prefijo}finalizó con código ${codigo}\n`);
  });
  return hijo;
});

const detener = () => {
  procesos.forEach((hijo) => hijo.kill());
  process.exit(0);
};
process.on("SIGINT", detener);
process.on("SIGTERM", detener);

console.log("\nMercaOriente en ejecución. Abra http://localhost:8080 (Ctrl+C para detener).\n");
