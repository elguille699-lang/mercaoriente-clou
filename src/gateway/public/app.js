const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const $ = (selector) => document.querySelector(selector);

const pedirJson = async (url, opciones = {}) => {
  const respuesta = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opciones,
  });
  const datos = await respuesta.json().catch(() => ({}));
  return { ok: respuesta.ok, status: respuesta.status, datos };
};

const escapar = (texto) =>
  String(texto ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);

const pintarSalud = async () => {
  const { datos } = await pedirJson("/api/salud");
  $("#estado-general").textContent = `Estado general: ${datos.estadoGeneral ?? "DESCONOCIDO"}`;
  $("#salud").innerHTML = Object.entries(datos.servicios ?? {})
    .map(([nombre, s]) => `
      <div class="servicio ${s.estado === "UP" ? "up" : "down"}">
        <strong>${escapar(nombre)}</strong>
        ${escapar(s.estado)}${s.activoDesdeSegundos != null ? ` · ${s.activoDesdeSegundos} s` : ""}
      </div>`)
    .join("");
};

const pintarProductos = async () => {
  if ($("#productos").contains(document.activeElement)) return;
  const { ok, datos } = await pedirJson("/api/productos");
  if (!ok) {
    $("#productos").innerHTML = `<tr><td colspan="5">${escapar(datos.error)}</td></tr>`;
    return;
  }
  const cantidades = Object.fromEntries(
    [...document.querySelectorAll("#productos input")].map((i) => [i.name, i.value]),
  );
  $("#productos").innerHTML = datos
    .map((p) => `
      <tr>
        <td>${escapar(p.sku)}</td>
        <td>${escapar(p.nombre)}</td>
        <td class="num">${pesos.format(p.precio)}</td>
        <td class="num">${p.stock}</td>
        <td class="num"><input type="number" min="0" name="${escapar(p.sku)}" value="${cantidades[p.sku] ?? 0}"></td>
      </tr>`)
    .join("");
};

const pintarPedidos = async () => {
  const { datos } = await pedirJson("/api/pedidos");
  $("#pedidos").innerHTML = (Array.isArray(datos) ? datos : [])
    .map((p) => `
      <li>
        <span class="etiqueta ${p.estado}">${p.estado}</span>
        <strong>${escapar(p.id)}</strong> · ${escapar(p.cliente.nombre)}
        ${p.total ? ` · ${pesos.format(p.total)}` : ""}
        ${p.motivo ? `<br><small>${escapar(p.motivo)}</small>` : ""}
      </li>`)
    .join("") || "<li>Sin pedidos todavía.</li>";
};

const pintarNotificaciones = async () => {
  const { datos } = await pedirJson("/api/notificaciones");
  $("#notificaciones").innerHTML = (Array.isArray(datos) ? datos : [])
    .map((n) => `
      <li>
        <span class="etiqueta canal">${escapar(n.canal)}</span>
        <strong>${escapar(n.pedidoId)}</strong> → ${escapar(n.destino)}<br>
        <small>${escapar(n.cuerpo)}</small>
      </li>`)
    .join("") || "<li>Sin notificaciones todavía.</li>";
};

const pintarCircuito = async () => {
  const { datos } = await pedirJson("/api/circuito");
  const elemento = $("#circuito");
  elemento.className = `circuito ${datos.estado ?? ""}`;
  elemento.textContent = datos.estado
    ? `${datos.estado} · fallos consecutivos: ${datos.fallosConsecutivos}/${datos.umbralFallos}`
    : "No disponible";
};

const refrescar = () =>
  Promise.allSettled([
    pintarSalud(),
    pintarProductos(),
    pintarPedidos(),
    pintarNotificaciones(),
    pintarCircuito(),
  ]);

$("#form-pedido").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const formulario = new FormData(evento.target);
  const items = [...document.querySelectorAll("#productos input")]
    .map((i) => ({ sku: i.name, cantidad: Number(i.value) }))
    .filter((i) => i.cantidad > 0);

  const resultado = $("#resultado");
  if (items.length === 0) {
    resultado.className = "resultado error";
    resultado.textContent = "Indique la cantidad de al menos un producto.";
    return;
  }

  const { ok, datos } = await pedirJson("/api/pedidos", {
    method: "POST",
    body: JSON.stringify({
      cliente: {
        nombre: formulario.get("nombre"),
        telefono: formulario.get("telefono"),
        canal: formulario.get("canal"),
      },
      items,
    }),
  });

  resultado.className = `resultado ${ok ? "ok" : "error"}`;
  resultado.textContent = ok
    ? `Pedido ${datos.id} confirmado por ${pesos.format(datos.total)}.`
    : datos.estado === "RECHAZADO"
      ? `Pedido ${datos.id} rechazado: ${datos.motivo}`
      : `${datos.error ?? "Error inesperado"}${datos.codigo ? ` (${datos.codigo})` : ""}`;

  if (ok) {
    document.querySelectorAll("#productos input").forEach((i) => { i.value = 0; });
  }
  setTimeout(refrescar, 400);
});

document.querySelectorAll("[data-falla]").forEach((boton) => {
  boton.addEventListener("click", async () => {
    await pedirJson("/api/admin/inventario/falla", {
      method: "POST",
      body: JSON.stringify({ activa: boton.dataset.falla === "true" }),
    });
    refrescar();
  });
});

refrescar();
setInterval(refrescar, 3000);
