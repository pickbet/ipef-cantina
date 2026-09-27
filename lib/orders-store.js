const fs = require("fs");
const path = require("path");

const baseDir = path.join(__dirname, "..");
const ordersFile = path.join(baseDir, "orders-history.json");

function isVercelRuntime() {
  return Boolean(process.env.VERCEL);
}

function readOrdersFromDisk() {
  try {
    if (!fs.existsSync(ordersFile)) {
      return [];
    }

    const raw = fs.readFileSync(ordersFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeOrdersToDisk(orders) {
  fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2), "utf8");
}

function getMemoryStore() {
  if (!globalThis.__cantinaOrdersStore) {
    globalThis.__cantinaOrdersStore = new Map();
  }

  return globalThis.__cantinaOrdersStore;
}

function loadOrders() {
  if (isVercelRuntime()) {
    return getMemoryStore();
  }

  return new Map(readOrdersFromDisk().map((order) => [order.orderId, order]));
}

function saveOrders(orders) {
  if (isVercelRuntime()) {
    globalThis.__cantinaOrdersStore = new Map(orders);
    return;
  }

  writeOrdersToDisk([...orders.values()]);
}

function listCompletedOrders(orders) {
  return [...orders.values()]
    .filter((order) => order.status === "COMPLETED")
    .sort((left, right) => String(right.completedAt || "").localeCompare(String(left.completedAt || "")));
}

module.exports = {
  loadOrders,
  saveOrders,
  listCompletedOrders,
  isVercelRuntime,
};
