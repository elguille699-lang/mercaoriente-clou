import { solicitarJson } from "./httpClient.js";
import { conReintentos } from "./retry.js";

/**
 * Cliente del patrón Publicador/Suscriptor.
 * Los servicios publican eventos en el broker sin conocer a los suscriptores.
 */
export const crearEventBus = ({ brokerUrl, servicio, logger }) => ({
  publicar: async (tema, datos, idCorrelacion) => {
    try {
      return await conReintentos(
        () =>
          solicitarJson(`${brokerUrl}/publicar`, {
            metodo: "POST",
            cuerpo: { tema, origen: servicio, datos },
            encabezados: idCorrelacion ? { "x-correlation-id": idCorrelacion } : {},
          }),
        { intentos: 3, esperaMs: 200 },
      );
    } catch (error) {
      logger.warn("No se pudo publicar el evento", { tema, error: error.message });
      return null;
    }
  },

  suscribir: (tema, urlCallback) =>
    conReintentos(
      () =>
        solicitarJson(`${brokerUrl}/suscripciones`, {
          metodo: "POST",
          cuerpo: { tema, url: urlCallback, servicio },
        }),
      {
        intentos: 15,
        esperaMs: 500,
        factor: 1.5,
        alReintentar: (intento) =>
          logger.warn("Broker no disponible, reintentando suscripción", { tema, intento }),
      },
    ),
});
