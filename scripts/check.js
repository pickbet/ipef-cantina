const { spawnSync } = require("child_process");

const files = [
  "app.js",
  "server.js",
  "api/orders/index.js",
  "api/orders/[id].js",
  "api/print-order.js",
  "lib/orders-store.js",
];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
