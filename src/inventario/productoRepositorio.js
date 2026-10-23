/**
 * Patrón Repository: aísla el almacenamiento de los productos.
 * El prototipo guarda en memoria; en producción se reemplaza por una base de
 * datos propia del servicio (Database per Service) sin tocar la lógica de negocio.
 */
export class ProductoRepositorioMemoria {
  constructor(semilla = []) {
    this.productos = new Map(semilla.map((p) => [p.sku, { ...p }]));
  }

  listar() {
    return [...this.productos.values()].map((p) => ({ ...p }));
  }

  buscarPorSku(sku) {
    const producto = this.productos.get(sku);
    return producto ? { ...producto } : null;
  }

  guardar(producto) {
    this.productos.set(producto.sku, { ...producto });
    return { ...producto };
  }
}

export const productosIniciales = [
  { sku: "ARZ-500", nombre: "Arroz blanco x 500 g", precio: 2900, stock: 400 },
  { sku: "ACT-1000", nombre: "Aceite vegetal x 1 L", precio: 11500, stock: 150 },
  { sku: "CAF-250", nombre: "Café molido x 250 g", precio: 9800, stock: 120 },
  { sku: "PAN-500", nombre: "Panela x 500 g", precio: 3200, stock: 300 },
  { sku: "FRJ-500", nombre: "Fríjol rojo x 500 g", precio: 6900, stock: 80 },
  { sku: "AZC-1000", nombre: "Azúcar x 1 kg", precio: 4600, stock: 250 },
];
