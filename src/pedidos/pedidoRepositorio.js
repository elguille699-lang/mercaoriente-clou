/** Patrón Repository para los pedidos (almacenamiento propio del servicio). */
export class PedidoRepositorioMemoria {
  constructor() {
    this.pedidos = new Map();
    this.secuencia = 0;
  }

  siguienteId() {
    this.secuencia += 1;
    return `PED-${String(this.secuencia).padStart(5, "0")}`;
  }

  guardar(pedido) {
    this.pedidos.set(pedido.id, { ...pedido });
    return { ...pedido };
  }

  buscarPorId(id) {
    const pedido = this.pedidos.get(id);
    return pedido ? { ...pedido } : null;
  }

  listar() {
    return [...this.pedidos.values()]
      .map((p) => ({ ...p }))
      .sort((a, b) => b.id.localeCompare(a.id));
  }
}
