export const solicitarJson = async (
  url,
  { metodo = "GET", cuerpo, timeoutMs = 2000, encabezados = {} } = {},
) => {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), timeoutMs);

  try {
    const respuesta = await fetch(url, {
      method: metodo,
      headers: { "Content-Type": "application/json", ...encabezados },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: controlador.signal,
    });
    const texto = await respuesta.text();
    const datos = texto ? JSON.parse(texto) : null;

    if (!respuesta.ok) {
      const error = new Error(datos?.error || `HTTP ${respuesta.status}`);
      error.status = respuesta.status;
      error.datos = datos;
      // Los 4xx son errores de negocio: no indican que el servicio esté caído.
      if (respuesta.status < 500) {
        error.esErrorNegocio = true;
        error.noReintentar = true;
      }
      throw error;
    }
    return datos;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeout = new Error(`Tiempo de espera agotado (${timeoutMs} ms) en ${url}`);
      timeout.status = 504;
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(temporizador);
  }
};
