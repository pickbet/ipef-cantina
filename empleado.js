const employeeContent = document.getElementById("employeeContent");
const employeeHistory = document.getElementById("employeeHistory");
let activeEmployeeOrderId = "";

function formatCurrency(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function getProductCatalog() {
  return MENU_FAMILIES.flatMap((family) =>
    family.items.map((item) => ({
      ...item,
      familyName: family.name,
    }))
  );
}

function findProductByName(productName) {
  return getProductCatalog().find((item) => item.name === productName) || null;
}

function getEmployeeProductLabel(item) {
  if (/promo 3 emp/i.test(item.name)) {
    return item.name;
  }

  const product = findProductByName(item.name);
  if (product?.familyName === "Empanadas") {
    return `Empanadas: ${item.name}`;
  }

  return item.name;
}

function getPluForItem(item) {
  return findProductByName(item.name)?.plu || "";
}

function buildUnitBarcodeValue(pluCode, quantity) {
  const normalizedPlu = String(pluCode).padStart(4, "0").slice(-4);
  const normalizedQuantity = String(Math.round(Number(quantity) * 1000))
    .padStart(5, "0")
    .slice(-5);
  return `20${normalizedPlu}${normalizedQuantity}`;
}

function renderItemBarcodes() {
  if (typeof window.JsBarcode !== "function") {
    return;
  }

  document.querySelectorAll("[data-plu-code]").forEach((element) => {
    const pluCode = element.dataset.pluCode;
    const quantity = Number(element.dataset.quantity || "0");
    if (!pluCode) {
      return;
    }

    window.JsBarcode(element, buildUnitBarcodeValue(pluCode, quantity), {
      displayValue: true,
      font: "monospace",
      fontSize: 12,
      height: 42,
      margin: 4,
      width: 1.45,
      format: "CODE128",
    });
  });
}

function parseOrderPayload(rawData) {
  if (!rawData) {
    return null;
  }

  try {
    return JSON.parse(rawData);
  } catch (error) {
    try {
      return JSON.parse(decodeURIComponent(escape(atob(rawData))));
    } catch (nestedError) {
      return null;
    }
  }
}

function decodeOrderFromLocation() {
  const params = new URLSearchParams(window.location.search);
  return parseOrderPayload(params.get("data"));
}

async function fetchOrderFromServer() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("order");

  if (!orderId) {
    return null;
  }

  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return payload.order || null;
  } catch (error) {
    return null;
  }
}

async function fetchCompletedOrders() {
  try {
    const response = await fetch("/api/orders");
    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    return Array.isArray(payload.orders) ? payload.orders : [];
  } catch (error) {
    return [];
  }
}

async function updateOrderStatus(orderId, status) {
  const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error("No se pudo actualizar el pedido");
  }

  return response.json();
}

function renderOrder(order) {
  if (!order) {
    employeeContent.innerHTML = `
      <div class="empty-state">
        <p>No se pudo cargar la comanda.</p>
        <span>Abre nuevamente el pedido desde el QR del cliente.</span>
      </div>
    `;
    return;
  }

  const paymentClass =
    order.paymentMethod === "Efectivo"
      ? "payment-effective"
      : order.paymentMethod === "Transferencia"
        ? "payment-transfer"
        : order.paymentMethod === "QR"
          ? "payment-qr"
          : "";

  const itemsMarkup = order.items
    .map(
      (item) => {
        const detail = item.detail ? `<p>${item.detail}</p>` : "";
        const productLabel = getEmployeeProductLabel(item);
        const pluCode = getPluForItem(item);
        const barcodeMarkup = pluCode
          ? `
            <div class="employee-barcode-block">
              <svg class="employee-barcode" data-plu-code="${pluCode}" data-quantity="${item.quantity}"></svg>
              <small>PLU ${pluCode} | Cantidad ${item.quantity}</small>
            </div>
          `
          : `<small class="employee-barcode-missing">Sin PLU cargado</small>`;

        return `
        <li>
          <div>
            <span>${item.quantity} x ${productLabel}</span>
            ${detail}
            ${barcodeMarkup}
          </div>
          <strong>${formatCurrency(item.subtotal)}</strong>
        </li>
      `;
      }
    )
    .join("");

  employeeContent.innerHTML = `
    <div class="employee-metadata">
      <div>
        <span>Pedido</span>
          <strong>${order.orderId}</strong>
      </div>
      <div class="payment-highlight ${paymentClass}">
        <span>Tipo de Pago</span>
        <strong>${order.paymentMethod}</strong>
      </div>
    </div>

    <div class="employee-order-list">
      <h2>Productos</h2>
      <ul>${itemsMarkup}</ul>
    </div>

    <div class="employee-total">
      <span>Total a cobrar</span>
      <strong>${formatCurrency(order.total)}</strong>
    </div>

    <div class="employee-finish-box">
      <button id="completeOrderBtn" class="primary-btn" type="button">
        Finalizar pedido
      </button>
    </div>
  `;

  activeEmployeeOrderId = order.orderId;
  renderItemBarcodes();
  document.getElementById("completeOrderBtn")?.addEventListener("click", handleCompleteOrder);
}

function renderHistory(orders) {
  if (!orders.length) {
    employeeHistory.innerHTML = "";
    return;
  }

  const historyMarkup = orders
    .map(
      (order) => `
        <li>
          <div>
            <strong>${order.orderId}</strong>
            <p>${order.paymentMethod} | ${order.completedAt || order.createdAt || ""}</p>
          </div>
          <span>${formatCurrency(order.total || 0)}</span>
        </li>
      `
    )
    .join("");

  employeeHistory.innerHTML = `
    <section class="employee-history">
      <div class="section-heading">
        <p class="eyebrow">Historial</p>
        <h2>Pedidos finalizados</h2>
      </div>
      <ul>${historyMarkup}</ul>
    </section>
  `;
}

async function handleCompleteOrder() {
  if (!activeEmployeeOrderId) {
    return;
  }

  try {
    await updateOrderStatus(activeEmployeeOrderId, "COMPLETED");
    employeeContent.innerHTML = `
      <div class="empty-state">
        <p>Pedido finalizado correctamente.</p>
        <span>La comanda fue cerrada y el cliente ya puede iniciar uno nuevo.</span>
      </div>
    `;
    activeEmployeeOrderId = "";
    const history = await fetchCompletedOrders();
    renderHistory(history);
  } catch (error) {
    window.alert("No se pudo finalizar el pedido.");
  }
}

async function initEmployeePage() {
  const orderFromServer = await fetchOrderFromServer();
  const orderFromLegacyData = orderFromServer || decodeOrderFromLocation();
  const history = await fetchCompletedOrders();
  renderOrder(orderFromLegacyData);
  renderHistory(history);
}

initEmployeePage();
