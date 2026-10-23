const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

/**
 * Patrón Retry con espera exponencial.
 * Reintenta fallos transitorios y respeta los errores marcados con `noReintentar`.
 */
export const conReintentos = async (
  operacion,
  { intentos = 3, esperaMs = 200, factor = 2, alReintentar } = {},
) => {
  let ultimoError;
  for (let intento = 1; intento <= intentos; intento += 1) {
    try {
      return await operacion(intento);
    } catch (error) {
      ultimoError = error;
      if (error.noReintentar || intento === intentos) {
        break;
      }
      alReintentar?.(intento, error);
      await esperar(esperaMs * factor ** (intento - 1));
    }
  }
  throw ultimoError;
};
