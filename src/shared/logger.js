export const crearLogger = (servicio) => {
  const escribir = (nivel, mensaje, extra = {}) => {
    const registro = {
      fecha: new Date().toISOString(),
      servicio,
      nivel,
      mensaje,
      ...extra,
    };
    console.log(JSON.stringify(registro));
  };

  return {
    info: (mensaje, extra) => escribir("info", mensaje, extra),
    warn: (mensaje, extra) => escribir("warn", mensaje, extra),
    error: (mensaje, extra) => escribir("error", mensaje, extra),
  };
};
