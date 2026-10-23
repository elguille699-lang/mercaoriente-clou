export const estadosCircuito = Object.freeze({
  cerrado: "CERRADO",
  abierto: "ABIERTO",
  semiAbierto: "SEMI_ABIERTO",
});

/**
 * Patrón Circuit Breaker.
 * Tras `umbralFallos` fallos seguidos abre el circuito y responde de inmediato
 * sin llamar al servicio remoto. Pasado `tiempoAbiertoMs` deja pasar una prueba
 * (semiabierto): si funciona se cierra, si falla vuelve a abrirse.
 */
export class CircuitBreaker {
  constructor({
    nombre,
    umbralFallos = 3,
    tiempoAbiertoMs = 15000,
    ahora = () => Date.now(),
    alCambiarEstado,
  } = {}) {
    this.nombre = nombre;
    this.umbralFallos = umbralFallos;
    this.tiempoAbiertoMs = tiempoAbiertoMs;
    this.ahora = ahora;
    this.alCambiarEstado = alCambiarEstado;
    this.estado = estadosCircuito.cerrado;
    this.fallosConsecutivos = 0;
    this.abiertoDesde = null;
  }

  async ejecutar(operacion) {
    if (this.estado === estadosCircuito.abierto) {
      if (this.ahora() - this.abiertoDesde >= this.tiempoAbiertoMs) {
        this.cambiarEstado(estadosCircuito.semiAbierto);
      } else {
        const error = new Error(`El circuito "${this.nombre}" está abierto`);
        error.codigo = "CIRCUITO_ABIERTO";
        error.status = 503;
        error.noReintentar = true;
        throw error;
      }
    }

    try {
      const resultado = await operacion();
      this.registrarExito();
      return resultado;
    } catch (error) {
      if (!error.esErrorNegocio) {
        this.registrarFallo();
      }
      throw error;
    }
  }

  registrarExito() {
    this.fallosConsecutivos = 0;
    this.abiertoDesde = null;
    this.cambiarEstado(estadosCircuito.cerrado);
  }

  registrarFallo() {
    this.fallosConsecutivos += 1;
    const debeAbrir =
      this.estado === estadosCircuito.semiAbierto ||
      this.fallosConsecutivos >= this.umbralFallos;
    if (debeAbrir) {
      this.abiertoDesde = this.ahora();
      this.cambiarEstado(estadosCircuito.abierto);
    }
  }

  cambiarEstado(nuevoEstado) {
    if (this.estado === nuevoEstado) return;
    const anterior = this.estado;
    this.estado = nuevoEstado;
    this.alCambiarEstado?.(anterior, nuevoEstado);
  }

  resumen() {
    return {
      nombre: this.nombre,
      estado: this.estado,
      fallosConsecutivos: this.fallosConsecutivos,
      umbralFallos: this.umbralFallos,
      tiempoAbiertoMs: this.tiempoAbiertoMs,
    };
  }
}
