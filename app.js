const familyList = document.getElementById("familyList");
const floatingCartBtn = document.getElementById("floatingCartBtn");
const floatingCartCount = document.getElementById("floatingCartCount");
const cartDrawer = document.getElementById("cartDrawer");
const cartBackdrop = document.getElementById("cartBackdrop");
const closeCartBtn = document.getElementById("closeCartBtn");
const continueShoppingBtn = document.getElementById("continueShoppingBtn");
const checkoutBtn = document.getElementById("checkoutBtn");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const promoModal = document.getElementById("promoModal");
const closePromoBtn = document.getElementById("closePromoBtn");
const confirmPromoBtn = document.getElementById("confirmPromoBtn");
const promoSelectors = document.getElementById("promoSelectors");
const shareQrImage = document.getElementById("shareQrImage");
const productModal = document.getElementById("productModal");
const closeProductBtn = document.getElementById("closeProductBtn");
const productModalFamily = document.getElementById("productModalFamily");
const productModalTitle = document.getElementById("productModalTitle");
const productModalDescription = document.getElementById("productModalDescription");
const productModalPrice = document.getElementById("productModalPrice");
const productModalHint = document.getElementById("productModalHint");
const productModalActions = document.getElementById("productModalActions");
const paymentModal = document.getElementById("paymentModal");
const closePaymentBtn = document.getElementById("closePaymentBtn");
const printTicket = document.getElementById("printTicket");
const printOrderCode = document.getElementById("printOrderCode");
const printPaymentMethod = document.getElementById("printPaymentMethod");
const printCreatedAt = document.getElementById("printCreatedAt");
const printItems = document.getElementById("printItems");
const printOrderTotal = document.getElementById("printOrderTotal");

const CART_STORAGE_KEY = "cantina-ipef-cart";
const cart = loadCart();
let activeProduct = null;
let lockedScrollY = 0;
const allProducts = MENU_FAMILIES.flatMap((family) => family.items);
const promoProduct = allProducts.find((item) => item.id === "promo-empanadas");

function loadCart() {
  try {
    const savedCart = window.localStorage.getItem(CART_STORAGE_KEY);
    const parsedCart = savedCart ? JSON.parse(savedCart) : [];
    return Array.isArray(parsedCart) ? parsedCart : [];
  } catch (error) {
    return [];
  }
}

function persistCart() {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function clearCart() {
  cart.splice(0, cart.length);
  persistCart();
  syncUi();
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function createCartKey(item, selections) {
  if (item.type === "combo") {
    return `${item.id}:${selections.join("|")}`;
  }

  return item.id;
}

function getProductCount(itemId) {
  return cart
    .filter((item) => item.productId === itemId)
    .reduce((sum, item) => sum + item.quantity, 0);
}

function findProductById(productId) {
  return allProducts.find((product) => product.id === productId);
}

function findFamilyByProductId(productId) {
  return MENU_FAMILIES.find((family) => family.items.some((item) => item.id === productId));
}

function renderFamilies() {
  familyList.innerHTML = "";

  MENU_FAMILIES.forEach((family) => {
    const section = document.createElement("section");
    section.className = `family-section accent-${family.accent}`;

    const cards = family.items
      .map((item) => {
        const count = getProductCount(item.id);
        const detail =
          item.type === "combo" ? "Elegi las variedades al agregarla" : "Disponible ahora";
        const promoClass = item.type === "combo" ? " product-card-promo" : "";

        return `
          <article class="product-card${promoClass}" role="button" tabindex="0" data-card-id="${item.id}">
            <div class="product-topline">
              <span class="family-icon">${family.icon}</span>
              <span class="product-badge${item.type === "combo" ? " product-badge-promo" : ""}">
                ${item.type === "combo" ? "Promo" : family.name}
              </span>
            </div>
            <h3>${item.name}</h3>
            <p class="product-note">${detail}</p>
            <div class="product-footer">
              <strong class="${item.type === "combo" ? "product-price-promo" : ""}">${formatCurrency(item.price)}</strong>
              <div class="qty-controls">
                <button type="button" class="qty-btn" data-action="decrease" data-id="${item.id}">-</button>
                <span class="qty-count">${count}</span>
                <button type="button" class="qty-btn" data-action="increase" data-id="${item.id}">+</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    section.innerHTML = `
      <div class="family-header">
        <div class="family-title">
          <span class="family-icon family-icon-large">${family.icon}</span>
          <div>
            <p class="eyebrow">${family.name}</p>
            <h2>${family.name}</h2>
          </div>
        </div>
      </div>
      <div class="product-grid">${cards}</div>
    `;

    familyList.appendChild(section);
  });
}

function handleQuantityAction(event) {
  const { action, id } = event.currentTarget.dataset;
  const item = findProductById(id);

  if (!item) {
    return;
  }

  if (action === "increase") {
    if (item.type === "combo") {
      openPromoModal();
    } else {
      addItemToCart(item);
    }
    return;
  }

  removeItemFromCart(item.id);
}

function handleCardOpen(event) {
  const card = event.currentTarget;
  const itemId = card.dataset.cardId;
  const family = findFamilyByProductId(itemId);
  const item = findProductById(itemId);

  if (!item || !family) {
    return;
  }

  openProductModal(item, family);
}

function addItemToCart(item, selections = []) {
  const key = createCartKey(item, selections);
  const existing = cart.find((cartItem) => cartItem.key === key);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      key,
      productId: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      selections,
    });
  }

  persistCart();
  syncUi();
}

function removeItemFromCart(productId) {
  const index = [...cart].reverse().findIndex((item) => item.productId === productId);

  if (index === -1) {
    return;
  }

  const actualIndex = cart.length - 1 - index;
  cart[actualIndex].quantity -= 1;

  if (cart[actualIndex].quantity <= 0) {
    cart.splice(actualIndex, 1);
  }

  persistCart();
  syncUi();
}

function renderCart() {
  cartItems.innerHTML = "";
  const hasItems = cart.length > 0;

  continueShoppingBtn.disabled = !hasItems;
  checkoutBtn.disabled = !hasItems;

  if (!hasItems) {
    cartItems.innerHTML = `
      <div class="empty-cart">
        <p>Tu carrito esta vacio.</p>
        <span>Suma productos desde las tarjetas del kiosko.</span>
      </div>
    `;
  } else {
    cart.forEach((item) => {
      const row = document.createElement("article");
      row.className = "cart-item";

      const extra = item.selections.length
        ? `<p class="cart-item-detail">${item.selections.join(" | ")}</p>`
        : "";

      row.innerHTML = `
        <div class="cart-item-copy">
          <h3>${item.name}</h3>
          ${extra}
          <strong class="cart-item-price">${formatCurrency(item.price * item.quantity)}</strong>
        </div>
        <div class="cart-actions">
          <button type="button" class="cart-step-btn" data-key="${item.key}" data-action="decrease">-</button>
          <span>${item.quantity}</span>
          <button type="button" class="cart-step-btn" data-key="${item.key}" data-action="increase">+</button>
        </div>
      `;

      cartItems.appendChild(row);
    });
  }
}

function handleCartStepAction(event) {
  const { key, action } = event.currentTarget.dataset;
  const item = cart.find((cartEntry) => cartEntry.key === key);

  if (!item) {
    return;
  }

  if (action === "increase") {
    const product = findProductById(item.productId);
    if (product) {
      addItemToCart(product, item.selections);
    }
    return;
  }

  item.quantity -= 1;
  if (item.quantity <= 0) {
    const index = cart.findIndex((entry) => entry.key === key);
    cart.splice(index, 1);
  }
  persistCart();
  syncUi();
}

function updateCartTotals() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  floatingCartCount.textContent = totalItems;
  cartTotal.textContent = formatCurrency(totalPrice);
}

function syncUi() {
  renderFamilies();
  renderCart();
  updateCartTotals();
}

function openCart() {
  const isOpen = !cartDrawer.classList.contains("hidden");
  cartDrawer.classList.toggle("hidden", isOpen);
  cartBackdrop.classList.toggle("hidden", isOpen);
  syncBodyLock();
}

function closeCart() {
  cartDrawer.classList.add("hidden");
  cartBackdrop.classList.add("hidden");
  syncBodyLock();
}

function openPromoModal() {
  promoSelectors.innerHTML = "";

  for (let index = 0; index < promoProduct.comboSize; index += 1) {
    const wrapper = document.createElement("label");
    wrapper.className = "promo-select";
    wrapper.innerHTML = `
      <span>Empanada ${index + 1}</span>
      <select>
        ${promoProduct.options
          .map((option) => `<option value="${option}">${option}</option>`)
          .join("")}
      </select>
    `;
    promoSelectors.appendChild(wrapper);
  }

  promoModal.classList.remove("hidden");
  syncBodyLock();
}

function closePromoModal() {
  promoModal.classList.add("hidden");
  syncBodyLock();
}

function openProductModal(item, family) {
  activeProduct = { item, family };
  const count = getProductCount(item.id);

  productModalFamily.textContent = family.name;
  productModalTitle.textContent = item.name;
  productModalDescription.textContent = item.description || "Producto disponible en cantina.";
  productModalPrice.textContent = formatCurrency(item.price);
  productModalHint.textContent =
    item.type === "combo"
      ? "La promo se agrega eligiendo las variedades."
      : `${count} en tu pedido`;

  if (item.type === "combo") {
    productModalActions.innerHTML = `
      <button type="button" class="primary-btn" data-modal-action="configure-promo">Elegir promo</button>
      <button type="button" class="secondary-btn" data-modal-action="remove-promo"${count === 0 ? " disabled" : ""}>
        Quitar una promo
      </button>
    `;
  } else {
    productModalActions.innerHTML = `
      <div class="detail-qty-controls">
        <button type="button" class="detail-qty-btn" data-modal-action="decrease">-</button>
        <span>${count}</span>
        <button type="button" class="detail-qty-btn" data-modal-action="increase">+</button>
      </div>
    `;
  }

  productModalActions.querySelectorAll("[data-modal-action]").forEach((button) => {
    button.addEventListener("click", handleProductModalAction);
  });

  productModal.classList.remove("hidden");
  syncBodyLock();
}

function closeProductModal() {
  productModal.classList.add("hidden");
  activeProduct = null;
  syncBodyLock();
}

function handleProductModalAction(event) {
  const action = event.currentTarget.dataset.modalAction;

  if (!activeProduct) {
    return;
  }

  if (action === "increase") {
    addItemToCart(activeProduct.item);
    openProductModal(activeProduct.item, activeProduct.family);
    return;
  }

  if (action === "decrease") {
    removeItemFromCart(activeProduct.item.id);
    openProductModal(activeProduct.item, activeProduct.family);
    return;
  }

  if (action === "configure-promo") {
    closeProductModal();
    openPromoModal();
    return;
  }

  if (action === "remove-promo") {
    removeItemFromCart(activeProduct.item.id);
    openProductModal(activeProduct.item, activeProduct.family);
  }
}

function confirmPromoSelection() {
  const selections = [...promoSelectors.querySelectorAll("select")].map((select) => select.value);
  addItemToCart(promoProduct, selections);
  closePromoModal();
}

function syncBodyLock() {
  const hasVisibleLayer =
    !cartDrawer.classList.contains("hidden") ||
    !promoModal.classList.contains("hidden") ||
    !productModal.classList.contains("hidden") ||
    !paymentModal.classList.contains("hidden");

  if (hasVisibleLayer) {
    if (!document.body.classList.contains("drawer-open")) {
      lockedScrollY = window.scrollY;
      document.body.style.top = `-${lockedScrollY}px`;
    }
    document.body.classList.add("drawer-open");
    return;
  }

  if (document.body.classList.contains("drawer-open")) {
    document.body.classList.remove("drawer-open");
    document.body.style.top = "";
    window.scrollTo(0, lockedScrollY);
  }
}

function renderShareQr() {
  if (!shareQrImage) {
    return;
  }

  const shareUrl = new URL(window.location.href);
  shareUrl.hash = "";
  shareQrImage.src = `https://quickchart.io/qr?text=${encodeURIComponent(shareUrl.toString())}&size=220`;
}

function handleFamilyListClick(event) {
  const qtyButton = event.target.closest(".qty-btn");
  if (qtyButton) {
    handleQuantityAction({ currentTarget: qtyButton });
    return;
  }

  const card = event.target.closest("[data-card-id]");
  if (card) {
    handleCardOpen({ currentTarget: card });
  }
}

function handleFamilyListKeydown(event) {
  const card = event.target.closest("[data-card-id]");
  if (!card) {
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    handleCardOpen({ currentTarget: card });
  }
}

function handleCartItemsClick(event) {
  const cartButton = event.target.closest(".cart-step-btn");
  if (!cartButton) {
    return;
  }

  handleCartStepAction({ currentTarget: cartButton });
}

function handleCheckout() {
  if (cart.length === 0) {
    return;
  }

  closeCart();
  paymentModal.classList.remove("hidden");
  syncBodyLock();
}

function closePaymentModal() {
  paymentModal.classList.add("hidden");
  syncBodyLock();
}

function generateOrderPayload(paymentMethod) {
  return {
    orderId: `IPEF-${Date.now().toString(36).toUpperCase()}`,
    paymentMethod,
    total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    createdAt: new Date().toLocaleString("es-AR"),
    items: cart.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      subtotal: item.price * item.quantity,
      detail: item.selections.join(" | "),
    })),
  };
}

async function sendOrderToPrinter(order) {
  const response = await fetch("/api/print-order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(order),
  });

  if (!response.ok) {
    throw new Error("No se pudo enviar el pedido a la impresora");
  }

  return response.json();
}

async function handlePaymentOption(event) {
  const paymentMethod = event.currentTarget.dataset.paymentOption;
  if (!paymentMethod) {
    return;
  }

  closePaymentModal();
  try {
    const result = await sendOrderToPrinter(generateOrderPayload(paymentMethod));
    clearCart();
    window.alert(
      result.printed
        ? "Pedido enviado a la impresora."
        : "Pedido recibido. En la web publicada no se puede imprimir directo en la comandera USB de la PC."
    );
  } catch (error) {
    window.alert("No se pudo enviar el pedido a la impresora.");
  }
}

floatingCartBtn.addEventListener("click", openCart);
closeCartBtn.addEventListener("click", closeCart);
continueShoppingBtn.addEventListener("click", closeCart);
checkoutBtn.addEventListener("click", handleCheckout);
cartBackdrop.addEventListener("click", closeCart);
closePromoBtn.addEventListener("click", closePromoModal);
closeProductBtn.addEventListener("click", closeProductModal);
closePaymentBtn.addEventListener("click", closePaymentModal);
familyList.addEventListener("click", handleFamilyListClick);
familyList.addEventListener("keydown", handleFamilyListKeydown);
cartItems.addEventListener("click", handleCartItemsClick);
promoModal.addEventListener("click", (event) => {
  if (event.target === promoModal) {
    closePromoModal();
  }
});
productModal.addEventListener("click", (event) => {
  if (event.target === productModal) {
    closeProductModal();
  }
});
paymentModal.addEventListener("click", (event) => {
  if (event.target === paymentModal) {
    closePaymentModal();
  }
});
paymentModal.querySelectorAll("[data-payment-option]").forEach((button) => {
  button.addEventListener("click", handlePaymentOption);
});
confirmPromoBtn.addEventListener("click", confirmPromoSelection);

renderShareQr();
syncUi();
