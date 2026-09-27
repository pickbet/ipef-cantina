const { randomUUID } = require("crypto");
const { listCompletedOrders, loadOrders, saveOrders, isVercelRuntime } = require("../../lib/orders-store");

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

  if (req.method === "POST") {
    try {
      const order = req.body || {};
      const orderId =
        typeof order.orderId === "string" && order.orderId.trim()
          ? order.orderId.trim()
          : `IPEF-${randomUUID().slice(0, 8).toUpperCase()}`;

      const storedOrder = {
        ...order,
        orderId,
        createdAt: order.createdAt || new Date().toLocaleString("es-AR"),
        status: order.status || "OPEN",
      };

      orders.set(orderId, storedOrder);
      saveOrders(orders);
      sendJson(res, 201, addRuntimeWarning({ ok: true, orderId }));
      return;
    } catch (error) {
      sendJson(res, 400, { ok: false, message: "Pedido invalido" });
      return;
    }
  }

  if (req.method === "GET") {
    sendJson(res, 200, addRuntimeWarning({ ok: true, orders: listCompletedOrders(orders) }));
    return;
  }

  res.setHeader("Allow", "GET, POST");
  sendJson(res, 405, { ok: false, message: "Metodo no permitido" });
};
