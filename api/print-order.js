const { randomUUID } = require("crypto");
const { loadOrders, saveOrders, isVercelRuntime } = require("../lib/orders-store");

function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { ok: false, message: "Metodo no permitido" });
    return;
  }

  try {
    const orders = loadOrders();
    const order = req.body || {};
    const orderId =
      typeof order.orderId === "string" && order.orderId.trim()
        ? order.orderId.trim()
        : `IPEF-${randomUUID().slice(0, 8).toUpperCase()}`;

    const storedOrder = {
      ...order,
      orderId,
      createdAt: order.createdAt || new Date().toLocaleString("es-AR"),
      status: isVercelRuntime() ? "RECEIVED" : "PRINTED",
      receivedAt: new Date().toLocaleString("es-AR"),
    };

    orders.set(orderId, storedOrder);
    saveOrders(orders);

    sendJson(res, 201, {
      ok: true,
      orderId,
      printed: false,
      message:
        "Pedido recibido. La impresion directa en una comandera USB solo funciona con el servidor local de la PC.",
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      message: "No se pudo recibir el pedido",
      detail: error.message,
    });
  }
};
