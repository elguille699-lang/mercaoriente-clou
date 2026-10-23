/**
 * Patrón Rate Limiting (Throttling) con ventana fija por IP.
 * Protege a los servicios internos de picos o abusos que llegan desde internet.
 */
export const crearLimitador = ({ limitePorMinuto, ahora = () => Date.now() }) => {
  const ventanas = new Map();

  return (req, res, next) => {
    const clave = req.ip;
    const momento = ahora();
    const ventana = ventanas.get(clave);

    if (!ventana || momento - ventana.inicio >= 60000) {
      ventanas.set(clave, { inicio: momento, cuenta: 1 });
      return next();
    }

    ventana.cuenta += 1;
    if (ventana.cuenta > limitePorMinuto) {
      const reintentarEn = Math.ceil((60000 - (momento - ventana.inicio)) / 1000);
      res.set("Retry-After", String(reintentarEn));
      return res.status(429).json({
        error: "Demasiadas solicitudes. Intente de nuevo más tarde.",
        reintentarEnSegundos: reintentarEn,
      });
    }
    return next();
  };
};
