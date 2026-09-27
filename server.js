const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const os = require("os");
const { execFile } = require("child_process");

const host = "0.0.0.0";
const port = 8080;
const baseDir = __dirname;
const ordersFile = path.join(baseDir, "orders-history.json");
const preferredPrinterName = process.env.CANTINA_PRINTER_NAME || "POS-80";
const orders = loadOrders();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

function loadOrders() {
  try {
    if (!fs.existsSync(ordersFile)) {
      return new Map();
    }

    const raw = fs.readFileSync(ordersFile, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Map();
    }

    return new Map(parsed.map((order) => [order.orderId, order]));
  } catch (error) {
    return new Map();
  }
}

function saveOrders() {
  const serializedOrders = JSON.stringify([...orders.values()], null, 2);
  fs.writeFileSync(ordersFile, serializedOrders, "utf8");
}

function collectJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function toPrintText(order) {
  const lines = [
    "CANTINA IPEF",
    "COMANDA",
    "--------------------------------",
    `PEDIDO: ${order.orderId}`,
    `PAGO: ${order.paymentMethod}`,
    `HORA: ${order.createdAt || new Date().toLocaleString("es-AR")}`,
    "--------------------------------",
  ];

  order.items.forEach((item) => {
    lines.push(`${item.quantity} x ${item.name}`);
    if (item.detail) {
      lines.push(`  ${item.detail}`);
    }
    lines.push(`  ${formatCurrency(item.subtotal)}`);
    lines.push("");
  });

  lines.push("--------------------------------");
  lines.push(`TOTAL: ${formatCurrency(order.total || 0)}`);
  lines.push("");
  lines.push("");

  return `${lines.join(os.EOL)}${os.EOL}`;
}

function printTextSilently(text) {
  return new Promise((resolve, reject) => {
    const tempFilePath = path.join(os.tmpdir(), `cantina-ipef-${Date.now()}.txt`);
    fs.writeFileSync(tempFilePath, text, "utf8");

    const script = `
      $printerName = ${JSON.stringify(preferredPrinterName)};
      $filePath = ${JSON.stringify(tempFilePath)};
      Get-Content -LiteralPath $filePath -Raw | Out-Printer -Name $printerName;
    `;

    execFile(
      "powershell.exe",
      ["-NoLogo", "-NonInteractive", "-Command", script],
      (error) => {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          // Ignore temp cleanup errors.
        }

        if (error) {
          reject(error);
          return;
        }

        resolve();
      }
    );
  });
}

http
  .createServer(async (req, res) => {
    const method = req.method || "GET";
    const rawPath = (req.url || "/").split("?")[0];

    if (method === "POST" && rawPath === "/api/orders") {
      try {
        const order = await collectJsonBody(req);
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
        saveOrders();
        sendJson(res, 201, { ok: true, orderId });
      } catch (error) {
        sendJson(res, 400, { ok: false, message: "Pedido invalido" });
      }
      return;
    }

    if (method === "POST" && rawPath === "/api/print-order") {
      try {
        const order = await collectJsonBody(req);
        const orderId =
          typeof order.orderId === "string" && order.orderId.trim()
            ? order.orderId.trim()
            : `IPEF-${randomUUID().slice(0, 8).toUpperCase()}`;

        const storedOrder = {
          ...order,
          orderId,
          createdAt: order.createdAt || new Date().toLocaleString("es-AR"),
          status: "PRINTED",
          printedAt: new Date().toLocaleString("es-AR"),
        };

        orders.set(orderId, storedOrder);
        saveOrders();
        await printTextSilently(toPrintText(storedOrder));
        sendJson(res, 201, { ok: true, orderId, printed: true });
      } catch (error) {
        sendJson(res, 500, {
          ok: false,
          message: "No se pudo imprimir el pedido",
          detail: error.message,
        });
      }
      return;
    }

    if (method === "GET" && rawPath.startsWith("/api/orders/")) {
      const orderId = decodeURIComponent(rawPath.replace("/api/orders/", ""));
      const order = orders.get(orderId);

      if (!order) {
        sendJson(res, 404, { ok: false, message: "Pedido no encontrado" });
        return;
      }

      sendJson(res, 200, { ok: true, order });
      return;
    }

    if (method === "GET" && rawPath === "/api/orders") {
      const completedOrders = [...orders.values()]
        .filter((order) => order.status === "COMPLETED")
        .sort((left, right) => String(right.completedAt || "").localeCompare(String(left.completedAt || "")));

      sendJson(res, 200, { ok: true, orders: completedOrders });
      return;
    }

    if (method === "PATCH" && rawPath.startsWith("/api/orders/")) {
      const orderId = decodeURIComponent(rawPath.replace("/api/orders/", ""));
      const order = orders.get(orderId);

      if (!order) {
        sendJson(res, 404, { ok: false, message: "Pedido no encontrado" });
        return;
      }

      try {
        const updates = await collectJsonBody(req);
        const updatedOrder = {
          ...order,
          ...updates,
          completedAt:
            updates.status === "COMPLETED" ? new Date().toLocaleString("es-AR") : order.completedAt,
        };

        orders.set(orderId, updatedOrder);
        saveOrders();
        sendJson(res, 200, { ok: true, order: updatedOrder });
      } catch (error) {
        sendJson(res, 400, { ok: false, message: "Actualizacion invalida" });
      }
      return;
    }

    const requestedPath = decodeURIComponent(rawPath === "/" ? "/index.html" : rawPath);
    const filePath = path.normalize(path.join(baseDir, requestedPath));

    if (!filePath.startsWith(baseDir)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
      });
      res.end(content);
    });
  })
  .listen(port, host, () => {
    console.log(`Servidor local listo en http://${host}:${port}`);
  });
