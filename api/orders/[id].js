const { loadOrders, saveOrders, isVercelRuntime } = require("../../lib/orders-store");

function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

function addRuntimeWarning(payload) {
  if (!isVercelRuntime()) {
    return payload;
  }

  return {
    ...payload,
    warning:
      "En Vercel sin base de datos los pedidos se guardan de forma temporal. Para historial permanente hace falta Vercel KV, Postgres o similar.",
  };
}

module.exports = async function handler(req, res) {
  const orders = loadOrders();
  const orderId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const order = orders.get(orderId);

  if (!order) {
    sendJson(res, 404, { ok: false, message: "Pedido no encontrado" });
    return;
  }

  if (req.method === "GET") {
    sendJson(res, 200, addRuntimeWarning({ ok: true, order }));
    return;
  }

  if (req.method === "PATCH") {
    try {
      const updates = req.body || {};
      const updatedOrder = {
        ...order,
        ...updates,
        completedAt:
          updates.status === "COMPLETED" ? new Date().toLocaleString("es-AR") : order.completedAt,
      };

      orders.set(orderId, updatedOrder);
      saveOrders(orders);
      sendJson(res, 200, addRuntimeWarning({ ok: true, order: updatedOrder }));
      return;
    } catch (error) {
      sendJson(res, 400, { ok: false, message: "Actualizacion invalida" });
      return;
    }
  }

  res.setHeader("Allow", "GET, PATCH");
  sendJson(res, 405, { ok: false, message: "Metodo no permitido" });
};
