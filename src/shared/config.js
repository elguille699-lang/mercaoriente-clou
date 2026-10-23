const numero = (valor, porDefecto) => {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
};

const puertosPorDefecto = {
  gateway: 8080,
  broker: 4000,
  inventario: 4001,
  pedidos: 4002,
  notificaciones: 4003,
};

export const obtenerConfig = (servicio) => {
  const env = process.env;
  return {
    servicio,
    puerto: numero(env.PORT, puertosPorDefecto[servicio] ?? 3000),
    urls: {
      broker: env.BROKER_URL || "http://localhost:4000",
      inventario: env.INVENTARIO_URL || "http://localhost:4001",
      pedidos: env.PEDIDOS_URL || "http://localhost:4002",
      notificaciones: env.NOTIFICACIONES_URL || "http://localhost:4003",
    },
    notificacionesCallbackUrl:
      env.NOTIFICACIONES_CALLBACK_URL || "http://localhost:4003/eventos",
    resiliencia: {
      umbralFallos: numero(env.CB_UMBRAL_FALLOS, 3),
      tiempoAbiertoMs: numero(env.CB_TIEMPO_ABIERTO_MS, 15000),
      reintentos: numero(env.REINTENTOS_INVENTARIO, 3),
    },
    limiteSolicitudesMinuto: numero(env.LIMITE_SOLICITUDES_MINUTO, 120),
  };
};
