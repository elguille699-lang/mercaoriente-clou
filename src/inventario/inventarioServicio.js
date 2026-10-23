const errorNegocio = (mensaje, status, datos) => {
  const error = new Error(mensaje);
  error.status = status;
  error.datos = datos;
  return error;
};

export class InventarioServicio {
  constructor(repositorio) {
    this.repositorio = repositorio;
    this.reservas = new Map();
  }

  listarProductos() {
    return this.repositorio.listar();
  }

  obtenerProducto(sku) {
    const producto = this.repositorio.buscarPorSku(sku);
    if (!producto) {
      throw errorNegocio(`No existe el producto ${sku}`, 404);
    }
    return producto;
  }

  reservar(pedidoId, items) {
    if (!pedidoId || !Array.isArray(items) || items.length === 0) {
      throw errorNegocio("La reserva requiere pedidoId y al menos un ítem", 400);
    }

    const faltantes = [];
    const lineas = items.map(({ sku, cantidad }) => {
      const producto = this.repositorio.buscarPorSku(sku);
      if (!producto) {
        faltantes.push({ sku, motivo: "PRODUCTO_INEXISTENTE" });
        return null;
      }
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        faltantes.push({ sku, motivo: "CANTIDAD_INVALIDA" });
        return null;
      }
      if (producto.stock < cantidad) {
        faltantes.push({ sku, motivo: "STOCK_INSUFICIENTE", disponible: producto.stock });
        return null;
      }
      return { producto, cantidad };
    });

    if (faltantes.length > 0) {
      throw errorNegocio("No hay inventario suficiente para el pedido", 409, { faltantes });
    }

    const detalle = lineas.map(({ producto, cantidad }) => {
      this.repositorio.guardar({ ...producto, stock: producto.stock - cantidad });
      return {
        sku: producto.sku,
        nombre: producto.nombre,
        cantidad,
        precioUnitario: producto.precio,
        subtotal: producto.precio * cantidad,
      };
    });
    const reserva = {
      pedidoId,
      detalle,
      total: detalle.reduce((suma, linea) => suma + linea.subtotal, 0),
      fecha: new Date().toISOString(),
    };
    this.reservas.set(pedidoId, reserva);
    return reserva;
  }
}
