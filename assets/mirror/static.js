(() => {
  const cartKey = "moleculla_static_cart_v1";
  const legacyCountKey = "moleculla_snapshot_cart_count";
  const pendingCheckoutKey = "moleculla_pending_checkout";
  const supportEmail = "moleculla.info@gmail.com";
  const defaultCommerceConfig = {
    checkoutProvider: "woocommerce",
    commerceOrigin: "https://moleculla.com",
    functionsBaseUrl: "",
    supabaseAnonKey: "",
  };
  const commerceConfig = {
    ...defaultCommerceConfig,
    ...(window.MOLECULLA_COMMERCE_CONFIG || {}),
  };
  const mentoringProductId = "825";
  const checkoutProvider = String(commerceConfig.checkoutProvider || defaultCommerceConfig.checkoutProvider).toLowerCase();
  const commerceOrigin = commerceConfig.commerceOrigin || defaultCommerceConfig.commerceOrigin;
  const useStripeCheckout = ["stripe", "supabase-stripe", "supabase"].includes(checkoutProvider);
  const useWooCommerceBackend = checkoutProvider === "woocommerce";
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "AUD" });
  const originalCommerceBlocks = new WeakMap();

  const products = {
    736: {
      id: "736",
      name: "Hydrogen Water Generator",
      price: 199,
      regularPrice: 229,
      image: "/assets/mirror/uploads/2025/12/Generated-Image-December-11-2025-3_26PM-1-e1765428901128-300x300.jpeg",
      url: "/product/hydrogen-water-generator/",
      maxQty: 5,
    },
    825: {
      id: "825",
      name: "Integrative nutrition and wellness mentoring session",
      price: 130,
      image: "/assets/mirror/uploads/2025/09/Moleculla_Lifestyle_Wellness_Nutrition_Email_3-300x300.webp",
      url: "/product/integrative-nutrition-and-wellness-mentoring-session/",
      maxQty: 20,
    },
    177: {
      id: "177",
      name: "Copper bristle dry body brush",
      price: 69,
      image: "/assets/mirror/uploads/2025/09/Body_Brush_Lifestyle_Wellness_Nutrition_1-300x300.webp",
      url: "/product/copper-dry-body-brush/",
      maxQty: 10,
    },
  };

  const productIds = new Set(Object.keys(products));

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (match) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[match]);
  }

  function commerceUrl(path = "/") {
    return new URL(path, commerceOrigin).toString();
  }

  function functionsBaseUrl() {
    return String(commerceConfig.functionsBaseUrl || "").replace(/\/+$/, "");
  }

  function functionUrl(name) {
    const base = functionsBaseUrl();
    return base ? `${base}/${name}` : "";
  }

  function functionHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (commerceConfig.supabaseAnonKey) {
      headers.apikey = commerceConfig.supabaseAnonKey;
      headers.Authorization = `Bearer ${commerceConfig.supabaseAnonKey}`;
    }
    return headers;
  }

  function supabaseBaseUrl() {
    const explicit = commerceConfig.supabaseUrl || commerceConfig.supabaseProjectUrl || "";
    if (explicit) return String(explicit).replace(/\/+$/, "");
    return functionsBaseUrl().replace(/\/functions\/v1\/?$/, "");
  }

  function authUrl(path, params = {}) {
    const base = supabaseBaseUrl();
    if (!base || !commerceConfig.supabaseAnonKey) return "";
    const url = new URL(`/auth/v1/${path.replace(/^\/+/, "")}`, base);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    });
    return url.toString();
  }

  function authRedirectUrl(path = "/my-account/") {
    return new URL(path, window.location.origin).toString();
  }

  function authHeaders(token = "") {
    const headers = functionHeaders();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async function authRequest(path, body = null, options = {}) {
    const url = authUrl(path, options.params || {});
    if (!url) throw new Error("Account service is not configured yet.");

    const response = await fetch(url, {
      method: options.method || "POST",
      headers: authHeaders(options.token || ""),
      body: body === null ? undefined : JSON.stringify(body),
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(payload?.error_description || payload?.msg || payload?.message || response.statusText || "Account request failed.");
    }

    return payload || {};
  }

  const authSessionKey = "moleculla_auth_session_v1";

  function sessionExpiresAt(payload) {
    if (payload?.expires_at) return Number(payload.expires_at) * 1000;
    if (payload?.expires_in) return Date.now() + (Number(payload.expires_in) * 1000);
    return Date.now() + (60 * 60 * 1000);
  }

  function saveAuthSession(payload, remember = true) {
    if (!payload?.access_token) return;
    const session = {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token || "",
      expires_at: sessionExpiresAt(payload),
      user: payload.user || null,
    };
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(authSessionKey, JSON.stringify(session));
    if (remember) sessionStorage.removeItem(authSessionKey);
    else localStorage.removeItem(authSessionKey);
  }

  function readAuthSession() {
    for (const storage of [sessionStorage, localStorage]) {
      try {
        const session = JSON.parse(storage.getItem(authSessionKey) || "null");
        if (!session?.access_token) continue;
        if (Number(session.expires_at || 0) <= Date.now() + 5000) {
          storage.removeItem(authSessionKey);
          continue;
        }
        return session;
      } catch {
        storage.removeItem(authSessionKey);
      }
    }
    return null;
  }

  function clearAuthSession() {
    localStorage.removeItem(authSessionKey);
    sessionStorage.removeItem(authSessionKey);
  }

  function authEmailFromSession(session = readAuthSession()) {
    return session?.user?.email || session?.user?.user_metadata?.email || "";
  }

  function guideDownloadConfig(key = "copperDryBodyBrushing") {
    const downloads = commerceConfig.guideDownloads || {};
    return downloads[key] || {};
  }

  function guideCaptureEndpoint(config) {
    const functionName = config.functionName || "capture-guide-lead";
    return functionUrl(functionName);
  }

  function sameCommerceOrigin() {
    return window.location.origin === commerceOrigin;
  }

  function shouldRedirectCommercePage() {
    if (!useWooCommerceBackend || sameCommerceOrigin()) return false;
    return ["/cart", "/checkout", "/my-account"].includes(window.location.pathname.replace(/\/+$/, ""));
  }

  function redirectToWooCommercePage() {
    if (!shouldRedirectCommercePage()) return false;
    window.location.replace(commerceUrl(`${window.location.pathname}${window.location.search}${window.location.hash}`));
    return true;
  }

  function wireWooCommerceBackend() {
    if (!useWooCommerceBackend) return;
    document.documentElement.classList.add("m-woocommerce-backend");

    document.querySelectorAll('a[href^="/cart"], a[href^="/checkout"], a[href^="/my-account"]').forEach((link) => {
      const href = link.getAttribute("href");
      if (href) link.href = commerceUrl(href);
    });

    document.querySelectorAll(".wc-block-mini-cart__button").forEach((button) => {
      button.disabled = false;
      button.setAttribute("aria-label", "View cart");
    });

    document.querySelectorAll("form.cart").forEach((form) => {
      const action = form.getAttribute("action") || window.location.pathname;
      form.action = commerceUrl(action);
      form.method = "post";
    });

    document.querySelectorAll("a.ajax_add_to_cart[data-product_id]").forEach((link) => {
      const productId = link.dataset.product_id;
      if (!productId || !productIds.has(String(productId))) return;
      const quantity = link.dataset.quantity || "1";
      link.href = commerceUrl(`/cart/?add-to-cart=${encodeURIComponent(productId)}&quantity=${encodeURIComponent(quantity)}`);
    });
  }

  function wireStaticCommerceLinks() {
    document.documentElement.classList.add(useStripeCheckout ? "m-stripe-checkout" : "m-static-checkout");

    document.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href");
      if (!href) return;

      let url;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      const path = url.pathname.replace(/\/+$/, "") || "/";
      const isCommercePath = ["/cart", "/checkout", "/my-account"].includes(path);
      const isCommerceOrigin = url.origin === commerceOrigin;
      if (isCommerceOrigin && (isCommercePath || url.searchParams.has("add-to-cart"))) {
        link.href = `${url.pathname}${url.search}${url.hash}`;
      }
    });

    document.querySelectorAll("form.cart").forEach((form) => {
      form.action = window.location.pathname;
      form.method = "post";
    });
  }

  function clampQuantity(value, maxQty = 99) {
    const parsed = Number.parseInt(value, 10);
    const safe = Number.isFinite(parsed) ? parsed : 1;
    return Math.max(1, Math.min(maxQty || 99, safe));
  }

  function normalizedOptions(options = {}) {
    return Object.fromEntries(Object.entries(options).filter((entry) => entry[1]).sort(([a], [b]) => a.localeCompare(b)));
  }

  function cartItemKey(productId, options = {}) {
    return `${productId}:${JSON.stringify(normalizedOptions(options))}`;
  }

  function readCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(cartKey) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => products[item.productId])
        .map((item) => {
          const product = products[item.productId];
          const options = normalizedOptions(item.options || {});
          return {
            key: item.key || cartItemKey(item.productId, options),
            productId: item.productId,
            quantity: clampQuantity(item.quantity, product.maxQty),
            options,
          };
        });
    } catch {
      return [];
    }
  }

  function saveCart(items) {
    localStorage.setItem(cartKey, JSON.stringify(items));
    localStorage.removeItem(legacyCountKey);
    renderCartCount();
    renderCurrentCommercePage();
    refreshMiniCart();
  }

  function cartCount(items = readCart()) {
    return items.reduce((total, item) => total + item.quantity, 0);
  }

  function lineTotal(item) {
    return products[item.productId].price * item.quantity;
  }

  function cartTotal(items = readCart()) {
    return items.reduce((total, item) => total + lineTotal(item), 0);
  }

  function optionText(options = {}) {
    const entries = Object.entries(options);
    if (entries.length === 0) return "";
    return entries.map(([key, value]) => `${key}: ${value}`).join(", ");
  }

  function optionValue(options = {}, key = "") {
    return Object.entries(options).find(([name]) => name.toLowerCase() === key.toLowerCase())?.[1] || "";
  }

  function checkoutPrefillFromItems(items = []) {
    const appointment = items.find((item) => item.productId === mentoringProductId && item.options);
    const options = appointment?.options || {};
    return {
      email: optionValue(options, "Email"),
      firstName: optionValue(options, "First name"),
      lastName: optionValue(options, "Last name"),
      phone: optionValue(options, "Phone"),
      notes: optionValue(options, "Session goal"),
    };
  }

  function noticeContainer() {
    const host = document.querySelector(".woocommerce-notices-wrapper")
      || document.querySelector(".wc-block-store-notices")
      || document.querySelector("main")
      || document.body;
    let container = host.querySelector?.(".m-static-notices");
    if (!container) {
      container = document.createElement("div");
      container.className = "m-static-notices";
      host.prepend(container);
    }
    return container;
  }

  function showNotice(html, type = "success") {
    const container = noticeContainer();
    const notice = document.createElement("div");
    notice.className = `m-notice m-notice--${type}`;
    notice.setAttribute("role", type === "error" ? "alert" : "status");
    notice.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
    notice.innerHTML = `<span>${html}</span><button type="button" class="m-notice-close" aria-label="Dismiss notice">x</button>`;
    container.replaceChildren(notice);
  }

  function addToCart(productId, quantity = 1, options = {}) {
    const id = String(productId);
    const product = products[id];
    if (!product) return false;

    const cart = readCart();
    const normalized = normalizedOptions(options);
    const key = cartItemKey(id, normalized);
    const existing = cart.find((item) => item.key === key);
    const requestedQuantity = clampQuantity(quantity, product.maxQty);

    if (existing) {
      existing.quantity = clampQuantity(existing.quantity + requestedQuantity, product.maxQty);
    } else {
      cart.push({ key, productId: id, quantity: requestedQuantity, options: normalized });
    }

    saveCart(cart);
    showNotice(`${escapeHtml(product.name)} has been added to your cart. <a href="/cart/">View cart</a>`);
    return true;
  }

  function updateCartItem(key, quantity) {
    const cart = readCart();
    const index = cart.findIndex((item) => item.key === key);
    if (index === -1) return;

    const product = products[cart[index].productId];
    const nextQuantity = Number.parseInt(quantity, 10);
    if (!Number.isFinite(nextQuantity) || nextQuantity < 1) {
      cart.splice(index, 1);
    } else {
      cart[index].quantity = clampQuantity(nextQuantity, product.maxQty);
    }
    saveCart(cart);
  }

  function removeCartItem(key) {
    saveCart(readCart().filter((item) => item.key !== key));
  }

  function formProductId(form, submitter) {
    return form?.dataset.product_id
      || form?.getAttribute("data-product_id")
      || form?.querySelector('input[name="product_id"]')?.value
      || submitter?.value
      || form?.querySelector('input[name="add-to-cart"]')?.value
      || submitter?.dataset.product_id
      || submitter?.getAttribute("data-product_id")
      || form?.querySelector(".single_add_to_cart_button")?.value
      || form?.querySelector(".single_add_to_cart_button")?.dataset.product_id
      || "";
  }

  function productFormOptions(form) {
    const options = {};
    const missing = [];
    form.querySelectorAll(".variations select").forEach((select) => {
      const label = form.querySelector(`label[for="${CSS.escape(select.id)}"]`)?.textContent?.trim()
        || select.name.replace(/^attribute_/, "").replace(/^pa_/, "").replace(/[-_]+/g, " ");
      const option = select.options[select.selectedIndex];
      if (!select.value) {
        missing.push(label);
        return;
      }
      options[label] = option?.textContent?.trim() || select.value;
    });
    return { options, missing };
  }

  function formQuantity(form, product) {
    const input = form.querySelector('input[name="quantity"], input.qty');
    return clampQuantity(input?.value || 1, product.maxQty);
  }

  function addFromForm(form, submitter) {
    const productId = String(formProductId(form, submitter));
    const product = products[productId];
    if (!product) return false;

    const { options, missing } = productFormOptions(form);
    if (missing.length > 0) {
      showNotice(`Please choose ${escapeHtml(missing.join(", "))} before adding this product to your cart.`, "error");
      return true;
    }

    addToCart(productId, formQuantity(form, product), options);
    return true;
  }

  function addFromButton(button) {
    const productId = String(button.dataset.product_id || button.value || "");
    if (!productIds.has(productId)) return false;
    if (!button.classList.contains("ajax_add_to_cart") && !button.classList.contains("single_add_to_cart_button")) {
      return false;
    }
    const product = products[productId];
    addToCart(productId, button.dataset.quantity || 1, {});
    button.closest(".wp-block-button, .wc-block-grid__product-add-to-cart")?.querySelector(".added_to_cart")?.removeAttribute("hidden");
    button.setAttribute("aria-label", `${product.name} has been added to your cart`);
    return true;
  }

  function checkoutAddToCartUrl(productId, quantity = 1, form = null) {
    const params = new URLSearchParams();
    params.set("add-to-cart", productId);
    params.set("quantity", String(quantity || 1));

    const variationId = form?.querySelector('input[name="variation_id"]')?.value;
    if (variationId && variationId !== "0") params.set("variation_id", variationId);

    form?.querySelectorAll(".variations select").forEach((select) => {
      if (select.value) params.set(select.name, select.value);
    });

    return commerceUrl(`/checkout/?${params.toString()}`);
  }

  function localCheckoutUrl() {
    return "/checkout/";
  }

  function buyNowFromForm(form, submitter) {
    const productId = String(formProductId(form, submitter));
    if (!productId) return false;

    const { options, missing } = productFormOptions(form);
    if (missing.length > 0) {
      showNotice(`Please choose ${escapeHtml(missing.join(", "))} before buying this product.`, "error");
      return true;
    }

    const product = products[productId] || { maxQty: 99 };
    const quantity = formQuantity(form, product);
    if (useWooCommerceBackend) {
      window.location.href = checkoutAddToCartUrl(productId, quantity, form);
      return true;
    }

    addToCart(productId, quantity, options);
    window.location.href = localCheckoutUrl();
    return true;
  }

  function buyNowFromButton(button) {
    const productId = String(button.dataset.product_id || button.value || "");
    if (!productId) return false;
    const quantity = button.dataset.quantity || "1";
    if (useWooCommerceBackend) {
      window.location.href = checkoutAddToCartUrl(productId, quantity);
      return true;
    }

    if (!products[productId]) return false;
    addToCart(productId, quantity);
    window.location.href = localCheckoutUrl();
    return true;
  }

  function renderCartCount() {
    const value = cartCount();
    document.querySelectorAll(".wc-block-mini-cart__badge").forEach((badge) => {
      badge.textContent = String(value);
      badge.hidden = value === 0;
    });
    document.querySelectorAll(".wc-block-mini-cart__button").forEach((button) => {
      button.setAttribute("aria-label", `Number of items in the cart: ${value}`);
    });
  }

  function cartRows(items) {
    return items.map((item) => {
      const product = products[item.productId];
      const options = optionText(item.options);
      return `<tr class="m-cart-row">
        <td class="m-cart-product">
          <a href="${product.url}" class="m-cart-image"><img src="${product.image}" alt="${escapeHtml(product.name)}"></a>
          <div>
            <a href="${product.url}" class="m-cart-name">${escapeHtml(product.name)}</a>
            ${options ? `<div class="m-cart-options">${escapeHtml(options)}</div>` : ""}
            <button type="button" class="m-text-button" data-cart-remove="${escapeHtml(item.key)}">Remove item</button>
          </div>
        </td>
        <td>${money.format(product.price)}</td>
        <td>
          <div class="m-cart-quantity">
            <button type="button" data-cart-adjust="${escapeHtml(item.key)}" data-delta="-1" aria-label="Reduce quantity">-</button>
            <input type="number" min="1" max="${product.maxQty}" value="${item.quantity}" data-cart-qty="${escapeHtml(item.key)}" aria-label="${escapeHtml(product.name)} quantity">
            <button type="button" data-cart-adjust="${escapeHtml(item.key)}" data-delta="1" aria-label="Increase quantity">+</button>
          </div>
        </td>
        <td class="m-cart-line-total">${money.format(lineTotal(item))}</td>
      </tr>`;
    }).join("");
  }

  function cartSummary(items, checkout = false) {
    const shippingText = useStripeCheckout ? "Calculated during secure checkout" : "Calculated after order review";
    const checkoutLabel = useStripeCheckout ? "Continue to secure checkout" : "Proceed to checkout";
    return `<section class="m-cart-summary" aria-label="Cart totals">
      <h3>${checkout ? "Order summary" : "Cart totals"}</h3>
      <div class="m-total-line"><span>Subtotal</span><strong>${money.format(cartTotal(items))}</strong></div>
      <div class="m-total-line"><span>Shipping</span><span>${shippingText}</span></div>
      <div class="m-total-line m-total-line--grand"><span>Total</span><strong>${money.format(cartTotal(items))}</strong></div>
      ${checkout ? "" : `<a class="wp-element-button m-primary-action" href="/checkout/">${checkoutLabel}</a>`}
      <a class="m-secondary-action" href="/shop/">Continue shopping</a>
    </section>`;
  }

  function emptyCartMarkup() {
    return `<div class="m-empty-cart">
      <h2>Your cart is currently empty!</h2>
      <p>Browse the store to add Moleculla products to your cart.</p>
      <a class="wp-element-button m-primary-action" href="/shop/">Go to shop</a>
    </div>`;
  }

  function rememberCommerceBlock(block) {
    if (block && !originalCommerceBlocks.has(block)) {
      originalCommerceBlocks.set(block, block.innerHTML);
    }
  }

  function restoreCommerceBlock(block) {
    const original = originalCommerceBlocks.get(block);
    if (original) block.innerHTML = original;
  }

  function renderCartPage() {
    const block = document.querySelector(".wp-block-woocommerce-cart");
    if (!block) return;
    rememberCommerceBlock(block);
    const items = readCart();
    block.classList.remove("is-loading");

    if (items.length === 0) {
      block.classList.add("m-cart-empty");
      block.classList.remove("m-cart-filled");
      restoreCommerceBlock(block);
      return;
    }

    block.classList.add("m-cart-filled");
    block.classList.remove("m-cart-empty");
    block.innerHTML = `<div class="m-cart-layout">
      <section class="m-cart-items" aria-label="Shopping cart">
        <table class="m-cart-table">
          <thead>
            <tr><th>Product</th><th>Price</th><th>Quantity</th><th>Subtotal</th></tr>
          </thead>
          <tbody>${cartRows(items)}</tbody>
        </table>
      </section>
      ${cartSummary(items)}
    </div>`;
  }

  function checkoutFormMarkup(items) {
    const buttonText = useStripeCheckout ? "Continue to secure payment" : "Place order";
    const prefill = checkoutPrefillFromItems(items);
    const note = useStripeCheckout
      ? '<p class="m-checkout-note">Payment opens in Stripe Checkout. Inventory is reserved only after the secure checkout session is created.</p>'
      : '<p class="m-checkout-note">This static checkout creates an order request for manual review.</p>';
    return `<div class="m-checkout-layout">
      <form class="m-checkout-form">
        <h3>Contact information</h3>
        ${note}
        <label>Email address <input name="email" type="text" inputmode="email" autocomplete="email" value="${escapeHtml(prefill.email)}" required></label>
        <h3>Billing and shipping details</h3>
        <div class="m-field-grid">
          <label>First name <input name="firstName" autocomplete="given-name" value="${escapeHtml(prefill.firstName)}" required></label>
          <label>Last name <input name="lastName" autocomplete="family-name" value="${escapeHtml(prefill.lastName)}" required></label>
        </div>
        <label>Country / Region <input name="country" autocomplete="country-name" value="Australia" required></label>
        <label>Street address <input name="address" autocomplete="address-line1" required></label>
        <label>Apartment, suite, unit, etc. <input name="address2" autocomplete="address-line2"></label>
        <div class="m-field-grid">
          <label>Town / City <input name="city" autocomplete="address-level2" required></label>
          <label>State <input name="state" autocomplete="address-level1"></label>
          <label>Postcode <input name="postcode" autocomplete="postal-code"></label>
        </div>
        <label>Phone <input name="phone" type="tel" autocomplete="tel" value="${escapeHtml(prefill.phone)}"></label>
        <label>Order notes <textarea name="notes" rows="4">${escapeHtml(prefill.notes)}</textarea></label>
        <button type="submit" class="wp-element-button m-primary-action">${buttonText}</button>
      </form>
      ${cartSummary(items, true)}
    </div>`;
  }

  function renderStripeReturn(params) {
    const block = document.querySelector(".wp-block-woocommerce-cart") || document.querySelector(".entry-content");
    if (!block) return;

    let pending = {};
    let lastStripeOrder = {};
    try {
      pending = JSON.parse(localStorage.getItem(pendingCheckoutKey) || "{}");
    } catch {
      pending = {};
    }
    try {
      lastStripeOrder = JSON.parse(localStorage.getItem("moleculla_last_stripe_order") || "{}");
    } catch {
      lastStripeOrder = {};
    }

    const sessionId = params.get("session_id") || pending.sessionId || lastStripeOrder.sessionId || "";
    const savedTotal = lastStripeOrder.sessionId === sessionId && lastStripeOrder.total != null ? Number(lastStripeOrder.total) : NaN;
    const total = Number.isFinite(pending.total) ? pending.total : savedTotal;
    const completedAt = pending.createdAt || (lastStripeOrder.sessionId === sessionId ? lastStripeOrder.completedAt : "") || new Date().toISOString();
    const reference = sessionId ? `...${sessionId.slice(-10)}` : "Pending";
    const orderDate = new Intl.DateTimeFormat("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(completedAt));
    const totalLabel = Number.isFinite(total) ? money.format(total) : "Paid";

    localStorage.setItem("moleculla_last_stripe_order", JSON.stringify({
      sessionId,
      total: Number.isFinite(total) ? total : null,
      completedAt,
    }));
    localStorage.setItem(cartKey, "[]");
    localStorage.removeItem(legacyCountKey);
    localStorage.removeItem(pendingCheckoutKey);
    renderCartCount();
    closeMiniCart();

    document.title = document.title.replace(/^Cart\b/, "Checkout");
    const title = document.querySelector(".wp-block-post-title");
    if (title) title.textContent = "Checkout";

    block.classList.remove("is-loading");
    block.classList.add("m-cart-filled");
    block.classList.remove("m-cart-empty");
    block.innerHTML = `<div class="m-order-received">
      <p class="m-order-kicker">Payment received</p>
      <h2>Thank you. Your order is confirmed.</h2>
      <div class="m-order-meta">
        <span><em>Reference</em> <strong title="${escapeHtml(sessionId)}">${escapeHtml(reference)}</strong></span>
        <span><em>Date</em> <strong>${orderDate}</strong></span>
        <span><em>Total</em> <strong>${escapeHtml(totalLabel)}</strong></span>
      </div>
      <p>Your payment was accepted and your order is now in our system. We will prepare the next steps and contact you if anything else is needed.</p>
      <a class="wp-element-button m-primary-action" href="/shop/">Continue shopping</a>
    </div>`;
  }

  function renderCheckoutPage() {
    const block = document.querySelector(".wp-block-woocommerce-cart") || document.querySelector(".entry-content");
    if (!block) return;
    rememberCommerceBlock(block);

    const params = new URLSearchParams(window.location.search);
    if (useStripeCheckout && (params.get("checkout") === "success" || params.has("session_id"))) {
      renderStripeReturn(params);
      return;
    }

    const items = readCart();

    if (items.length === 0) {
      if (window.location.pathname.replace(/\/+$/, "") === "/checkout") {
        window.location.replace("/cart/");
      } else {
        block.classList.remove("is-loading");
        block.classList.add("m-cart-empty");
        block.classList.remove("m-cart-filled");
        restoreCommerceBlock(block);
      }
      return;
    }

    document.title = document.title.replace(/^Cart\b/, "Checkout");
    const title = document.querySelector(".wp-block-post-title");
    if (title) title.textContent = "Checkout";

    block.classList.remove("is-loading");
    block.classList.add("m-cart-filled");
    block.classList.remove("m-cart-empty");
    block.innerHTML = checkoutFormMarkup(items);
  }

  function renderOrderReceived(order) {
    const block = document.querySelector(".wp-block-woocommerce-cart") || document.querySelector(".entry-content");
    if (!block) return;
    block.innerHTML = `<div class="m-order-received">
      <p class="m-order-kicker">Order received</p>
      <h2>Thank you. Your order has been received.</h2>
      <div class="m-order-meta">
        <span>Order number <strong>${escapeHtml(order.number)}</strong></span>
        <span>Date <strong>${new Date(order.createdAt).toLocaleDateString()}</strong></span>
        <span>Total <strong>${money.format(order.total)}</strong></span>
      </div>
      <p>This static checkout saved the order details in this browser. Email the order request to Moleculla to complete review, shipping, and payment.</p>
      <a class="wp-element-button m-primary-action" href="${buildMailto(order)}">Email order details</a>
      <a class="m-secondary-action" href="/shop/">Continue shopping</a>
    </div>`;
  }

  function buildMailto(order) {
    const lines = [
      `Order number: ${order.number}`,
      `Date: ${new Date(order.createdAt).toLocaleString()}`,
      "",
      "Items:",
      ...order.items.map((item) => {
        const product = products[item.productId];
        const options = optionText(item.options);
        return `- ${product.name}${options ? ` (${options})` : ""} x ${item.quantity}: ${money.format(lineTotal(item))}`;
      }),
      "",
      `Total: ${money.format(order.total)}`,
      "",
      "Customer:",
      `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim(),
      order.customer.email || "",
      order.customer.phone || "",
      order.customer.address || "",
      order.customer.address2 || "",
      [order.customer.city, order.customer.state, order.customer.postcode].filter(Boolean).join(", "),
      order.customer.country || "",
      "",
      "Order notes:",
      order.customer.notes || "",
    ];
    return `mailto:${supportEmail}?subject=${encodeURIComponent(`Moleculla order ${order.number}`)}&body=${encodeURIComponent(lines.join("\n"))}`;
  }

  function checkoutReturnUrl(path, query = "") {
    return `${window.location.origin}${path}${query}`;
  }

  function setCheckoutBusy(form, busy) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    if (busy) {
      button.dataset.originalText = button.textContent || "";
      button.disabled = true;
      button.textContent = "Opening secure checkout...";
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || (useStripeCheckout ? "Continue to secure payment" : "Place order");
    }
  }

  async function startStripeCheckout(form, customer, items) {
    const endpoint = functionUrl("create-checkout-session");
    if (!endpoint) {
      showNotice("Supabase Stripe checkout is selected, but the Supabase Functions URL is not configured yet.", "error");
      return;
    }

    setCheckoutBusy(form, true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: functionHeaders(),
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            options: item.options,
          })),
          customer,
          successUrl: checkoutReturnUrl("/checkout/", "?checkout=success&session_id={CHECKOUT_SESSION_ID}"),
          cancelUrl: checkoutReturnUrl("/cart/", "?checkout=cancelled"),
          sourceUrl: window.location.href,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not create a Stripe Checkout session.");
      }

      if (!payload.url) {
        throw new Error("Stripe did not return a Checkout URL.");
      }

      localStorage.setItem(pendingCheckoutKey, JSON.stringify({
        sessionId: payload.sessionId || "",
        reservationId: payload.reservationId || "",
        createdAt: new Date().toISOString(),
        items,
        total: cartTotal(items),
      }));

      window.location.href = payload.url;
    } catch (error) {
      showNotice(escapeHtml(error.message || "Could not open secure checkout."), "error");
      setCheckoutBusy(form, false);
    }
  }

  function setGuideLeadStatus(form, message, type = "") {
    const status = form.querySelector("[data-guide-lead-status]");
    if (!status) return;
    status.classList.toggle("is-error", type === "error");
    status.classList.toggle("is-success", type === "success");
    status.textContent = message;
  }

  function setGuideLeadBusy(form, busy) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    if (busy) {
      button.dataset.originalText = button.textContent || "";
      button.disabled = true;
      button.textContent = "Preparing download...";
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || "Download";
    }
  }

  function setGuideDownloadLink(form, url) {
    let link = form.querySelector(".m-guide-download-link");
    if (!link) {
      link = document.createElement("a");
      link.className = "m-guide-download-link";
      link.target = "_blank";
      link.rel = "noopener";
      form.querySelector("[data-guide-lead-status]")?.before(link);
    }

    link.href = url;
    link.textContent = "Download guide";
    link.hidden = false;
    setTimeout(() => link.click(), 50);
  }

  async function handleGuideLeadSubmit(form) {
    const config = guideDownloadConfig();
    const email = String(new FormData(form).get("email") || "").trim();
    const guideSlug = form.dataset.guideSlug || config.guideSlug || "copper-dry-body-brushing";
    const fallbackUrl = String(config.fallbackUrl || "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setGuideLeadStatus(form, "Please enter a valid email address.", "error");
      return;
    }

    const endpoint = guideCaptureEndpoint(config);
    if (!endpoint) {
      if (fallbackUrl) {
        setGuideLeadStatus(form, "Supabase is not connected yet. Opening the guide directly.", "success");
        setGuideDownloadLink(form, fallbackUrl);
      } else {
        setGuideLeadStatus(form, "Supabase is not connected yet. Add the Functions URL in commerce-config.js.", "error");
      }
      return;
    }

    setGuideLeadBusy(form, true);
    setGuideLeadStatus(form, "");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: functionHeaders(),
        body: JSON.stringify({
          email,
          guideSlug,
          sourceUrl: window.location.href,
          referrer: document.referrer || "",
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Could not prepare the guide.");
      }

      form.reset();
      const downloadUrl = payload.guideUrl || fallbackUrl;
      if (downloadUrl) {
        setGuideLeadStatus(form, "Thank you. Your guide is ready.", "success");
        setGuideDownloadLink(form, downloadUrl);
      } else {
        setGuideLeadStatus(form, "Thank you. Your email was saved; connect the guide file in Supabase Storage to enable downloads.", "success");
      }
    } catch (error) {
      setGuideLeadStatus(form, error.message || "Could not prepare the guide.", "error");
    } finally {
      setGuideLeadBusy(form, false);
    }
  }

  async function handleCheckoutSubmit(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const missing = ["email", "firstName", "lastName", "country", "address", "city"].filter((name) => !String(data[name] || "").trim());
    if (missing.length > 0) {
      showNotice("Please complete the required checkout fields.", "error");
      return;
    }

    const items = readCart();
    if (items.length === 0) {
      renderCheckoutPage();
      return;
    }

    if (useStripeCheckout) {
      await startStripeCheckout(form, data, items);
      return;
    }

    const order = {
      number: `MOL-${Date.now().toString().slice(-8)}`,
      createdAt: new Date().toISOString(),
      customer: data,
      items,
      total: cartTotal(items),
    };

    localStorage.setItem("moleculla_last_order", JSON.stringify(order));
    localStorage.setItem(cartKey, "[]");
    renderCartCount();
    closeMiniCart();
    renderOrderReceived(order);
  }

  function renderCurrentCommercePage() {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/cart") renderCartPage();
    if (path === "/checkout") renderCheckoutPage();
  }

  function accountPath() {
    return window.location.pathname.replace(/\/+$/, "") || "/";
  }

  function setAuthButtonLoading(button, loading, label = "") {
    if (!button) return;
    if (loading) {
      button.dataset.originalText = button.textContent;
      button.textContent = label || "Please wait...";
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
      button.removeAttribute("aria-busy");
      delete button.dataset.originalText;
    }
  }

  function enhanceRegisterForm() {
    const form = document.querySelector(".woocommerce-form-register.register");
    if (!form || form.querySelector("#reg_password")) return;
    const emailRow = form.querySelector("#reg_email")?.closest(".form-row");
    if (!emailRow) return;
    emailRow.insertAdjacentHTML("afterend", `
      <p class="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide">
        <label for="reg_password">Password&nbsp;<span class="required" aria-hidden="true">*</span><span class="screen-reader-text">Required</span></label>
        <input class="woocommerce-Input woocommerce-Input--text input-text" type="password" name="password" id="reg_password" autocomplete="new-password" minlength="8" required aria-required="true">
      </p>
      <p class="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide">
        <label for="reg_password_confirm">Confirm password&nbsp;<span class="required" aria-hidden="true">*</span><span class="screen-reader-text">Required</span></label>
        <input class="woocommerce-Input woocommerce-Input--text input-text" type="password" name="password_confirm" id="reg_password_confirm" autocomplete="new-password" minlength="8" required aria-required="true">
      </p>
    `);
  }

  function renderAccountDashboard() {
    if (accountPath() !== "/my-account") return;
    enhanceRegisterForm();
    const customerLogin = document.getElementById("customer_login");
    if (!customerLogin) return;
    const session = readAuthSession();
    let dashboard = document.querySelector(".m-account-dashboard");

    if (!session) {
      dashboard?.remove();
      customerLogin.hidden = false;
      return;
    }

    if (!dashboard) {
      dashboard = document.createElement("section");
      dashboard.className = "m-account-dashboard";
      customerLogin.before(dashboard);
    }

    const email = authEmailFromSession(session);
    dashboard.innerHTML = `
      <p class="m-account-dashboard__kicker">Signed in</p>
      <h2>Account</h2>
      <p>${email ? `You are signed in as <strong>${escapeHtml(email)}</strong>.` : "You are signed in."}</p>
      <div class="m-account-dashboard__actions">
        <a class="m-primary-action" href="/shop/">Shop</a>
        <div class="m-secondary-row">
          <a class="m-secondary-action" href="/cart/">View cart</a>
          <a class="m-secondary-action" href="/my-account/lost-password/">Change password</a>
        </div>
        <button type="button" class="m-secondary-action" data-auth-signout>Sign out</button>
      </div>
    `;
    customerLogin.hidden = true;
  }

  async function handleLoginSubmit(form) {
    const email = String(form.querySelector("#username, input[name='username']")?.value || "").trim();
    const password = String(form.querySelector("#password, input[name='password']")?.value || "");
    const remember = Boolean(form.querySelector("#rememberme")?.checked);
    const button = form.querySelector("button[type='submit']");

    if (!email || !password) {
      showNotice("Enter your email address and password.", "error");
      return;
    }
    if (!email.includes("@")) {
      showNotice("Please log in with your email address.", "error");
      return;
    }

    setAuthButtonLoading(button, true, "Logging in...");
    try {
      const payload = await authRequest("token", { email, password }, {
        params: { grant_type: "password" },
      });
      saveAuthSession(payload, remember);
      showNotice("You are now logged in.");
      renderAccountDashboard();
    } catch (error) {
      showNotice(escapeHtml(error.message || "Login failed."), "error");
    } finally {
      setAuthButtonLoading(button, false);
    }
  }

  async function handleRegisterSubmit(form) {
    const email = String(form.querySelector("#reg_email, input[name='email']")?.value || "").trim();
    const password = String(form.querySelector("#reg_password, input[name='password']")?.value || "");
    const confirm = String(form.querySelector("#reg_password_confirm, input[name='password_confirm']")?.value || "");
    const button = form.querySelector("button[type='submit']");

    if (!email || !password || !confirm) {
      showNotice("Enter your email address and choose a password.", "error");
      return;
    }
    if (password.length < 8) {
      showNotice("Use at least 8 characters for your password.", "error");
      return;
    }
    if (password !== confirm) {
      showNotice("The password confirmation does not match.", "error");
      return;
    }

    setAuthButtonLoading(button, true, "Registering...");
    try {
      const payload = await authRequest("signup", {
        email,
        password,
        data: { source: "moleculla_static_site" },
      }, {
        params: { redirect_to: authRedirectUrl("/my-account/") },
      });

      if (payload?.access_token) {
        saveAuthSession(payload, true);
        showNotice("Your account has been created and you are logged in.");
        renderAccountDashboard();
      } else {
        showNotice("Registration started. Check your email to confirm your account, then log in.");
        form.reset();
      }
    } catch (error) {
      showNotice(escapeHtml(error.message || "Registration failed."), "error");
    } finally {
      setAuthButtonLoading(button, false);
    }
  }

  function recoveryAccessToken() {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return params.get("type") === "recovery" ? params.get("access_token") || "" : "";
  }

  async function captureAuthSessionFromHash() {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = params.get("access_token") || "";
    const type = params.get("type") || "";
    if (!token || type === "recovery") return;

    const payload = {
      access_token: token,
      refresh_token: params.get("refresh_token") || "",
      expires_in: Number(params.get("expires_in") || 3600),
      user: null,
    };

    try {
      payload.user = await authRequest("user", null, {
        method: "GET",
        token,
      });
    } catch {
      payload.user = null;
    }

    saveAuthSession(payload, true);
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    showNotice("Your account is confirmed and you are signed in.");
    renderAccountDashboard();
  }

  function renderPasswordRecoveryPage() {
    if (accountPath() !== "/my-account/lost-password") return;
    const card = document.querySelector(".m-account-help-card");
    if (!card) return;

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const hashError = hashParams.get("error_description") || hashParams.get("error");
    const token = recoveryAccessToken();

    if (hashError) {
      showNotice(escapeHtml(hashError), "error");
    }

    if (token) {
      card.innerHTML = `
        <p class="m-account-help-kicker">Account security</p>
        <h1 id="password-reset-title">Set a new password</h1>
        <p>Choose a new password for your Moleculla account.</p>
        <form class="m-auth-form" data-auth-update-form>
          <p class="m-auth-form-row">
            <label for="new_password">New password</label>
            <input id="new_password" name="password" type="password" minlength="8" autocomplete="new-password" required>
          </p>
          <p class="m-auth-form-row">
            <label for="new_password_confirm">Confirm new password</label>
            <input id="new_password_confirm" name="password_confirm" type="password" minlength="8" autocomplete="new-password" required>
          </p>
          <button class="m-primary-action" type="submit">Update password</button>
        </form>
        <div class="m-account-help__actions">
          <a class="m-account-help__secondary" href="/my-account/">Back to account</a>
        </div>
      `;
      return;
    }

    if (!card.querySelector("[data-auth-reset-form]")) {
      card.innerHTML = `
        <p class="m-account-help-kicker">Account support</p>
        <h1 id="password-reset-title">Password reset</h1>
        <p>Enter your account email and we will send a secure password reset link.</p>
        <form class="m-auth-form" data-auth-reset-form>
          <p class="m-auth-form-row">
            <label for="reset_email">Email address</label>
            <input id="reset_email" name="email" type="email" autocomplete="email" required>
          </p>
          <button class="m-primary-action" type="submit">Send reset link</button>
        </form>
        <div class="m-account-help-note">
          <strong>Need an order update?</strong>
          <span>Use the same email address you entered during checkout.</span>
        </div>
        <div class="m-account-help__actions">
          <a class="m-account-help__secondary" href="/my-account/">Back to account</a>
        </div>
      `;
    }
  }

  async function handlePasswordRecoverySubmit(form) {
    const email = String(form.querySelector("input[name='email']")?.value || "").trim();
    const button = form.querySelector("button[type='submit']");
    if (!email) {
      showNotice("Enter the email address for your account.", "error");
      return;
    }

    setAuthButtonLoading(button, true, "Sending...");
    try {
      await authRequest("recover", { email }, {
        params: { redirect_to: authRedirectUrl("/my-account/lost-password/") },
      });
      showNotice("If an account exists for that email, a password reset link has been sent.");
      form.reset();
    } catch (error) {
      showNotice(escapeHtml(error.message || "Password reset failed."), "error");
    } finally {
      setAuthButtonLoading(button, false);
    }
  }

  async function handlePasswordUpdateSubmit(form) {
    const password = String(form.querySelector("input[name='password']")?.value || "");
    const confirm = String(form.querySelector("input[name='password_confirm']")?.value || "");
    const token = recoveryAccessToken() || readAuthSession()?.access_token || "";
    const button = form.querySelector("button[type='submit']");

    if (!password || password.length < 8) {
      showNotice("Use at least 8 characters for your password.", "error");
      return;
    }
    if (password !== confirm) {
      showNotice("The password confirmation does not match.", "error");
      return;
    }
    if (!token) {
      showNotice("This reset link is missing or expired. Request a new one.", "error");
      return;
    }

    setAuthButtonLoading(button, true, "Updating...");
    try {
      await authRequest("user", { password }, {
        method: "PUT",
        token,
      });
      window.history.replaceState({}, document.title, "/my-account/lost-password/");
      showNotice("Your password has been updated. You can now log in.");
      window.setTimeout(() => {
        window.location.href = "/my-account/";
      }, 1400);
    } catch (error) {
      showNotice(escapeHtml(error.message || "Password update failed."), "error");
    } finally {
      setAuthButtonLoading(button, false);
    }
  }

  async function handleSignOut(button) {
    const session = readAuthSession();
    button.disabled = true;
    try {
      if (session?.access_token) {
        await authRequest("logout", null, {
          method: "POST",
          token: session.access_token,
        });
      }
    } catch {
      // Local sign-out still removes access on this browser.
    } finally {
      clearAuthSession();
      showNotice("You have been signed out.");
      renderAccountDashboard();
    }
  }

  function miniCartMarkup() {
    const items = readCart();
    const body = items.length === 0
      ? `<div class="m-mini-cart-empty"><p>Your cart is currently empty.</p><a href="/shop/">Go to shop</a></div>`
      : `<div class="m-mini-cart-items">${items.map((item) => {
        const product = products[item.productId];
        const options = optionText(item.options);
        return `<div class="m-mini-cart-item">
          <img src="${product.image}" alt="${escapeHtml(product.name)}">
          <div>
            <a href="${product.url}">${escapeHtml(product.name)}</a>
            ${options ? `<small>${escapeHtml(options)}</small>` : ""}
            <span>${item.quantity} x ${money.format(product.price)}</span>
          </div>
          <button type="button" data-cart-remove="${escapeHtml(item.key)}" aria-label="Remove ${escapeHtml(product.name)}">x</button>
        </div>`;
      }).join("")}</div>
      <div class="m-mini-cart-total"><span>Subtotal</span><strong>${money.format(cartTotal(items))}</strong></div>
      <a class="wp-element-button m-primary-action" href="/checkout/">Checkout</a>
      <a class="m-secondary-action" href="/cart/">View cart</a>`;

    return `<div class="m-mini-cart-backdrop" data-mini-cart-close></div>
      <aside class="m-mini-cart-panel" role="dialog" aria-modal="true" aria-labelledby="m-mini-cart-title">
        <header><h2 id="m-mini-cart-title">Cart</h2><button type="button" data-mini-cart-close aria-label="Close cart">x</button></header>
        ${body}
      </aside>`;
  }

  function miniCartElement() {
    let element = document.querySelector(".m-mini-cart");
    if (!element) {
      element = document.createElement("div");
      element.className = "m-mini-cart";
      element.hidden = true;
      document.body.append(element);
    }
    return element;
  }

  function openMiniCart() {
    const element = miniCartElement();
    element.innerHTML = miniCartMarkup();
    element.hidden = false;
    document.body.classList.add("m-mini-cart-open");
  }

  function closeMiniCart() {
    const element = document.querySelector(".m-mini-cart");
    if (element) element.hidden = true;
    document.body.classList.remove("m-mini-cart-open");
  }

  function refreshMiniCart() {
    const element = document.querySelector(".m-mini-cart:not([hidden])");
    if (element) element.innerHTML = miniCartMarkup();
  }

  function updateVariationForm(form) {
    const selectValues = Array.from(form.querySelectorAll(".variations select"));
    const button = form.querySelector(".single_add_to_cart_button");
    const setButtonEnabled = (enabled) => {
      if (!button) return;
      button.disabled = !enabled;
      button.setAttribute("aria-disabled", enabled ? "false" : "true");
      button.classList.toggle("disabled", !enabled);
      button.classList.toggle("wc-variation-selection-needed", !enabled);
    };

    if (selectValues.some((select) => !select.value)) {
      form.querySelector(".variation_id")?.setAttribute("value", "0");
      form.querySelector(".single_variation")?.replaceChildren();
      setButtonEnabled(false);
      return;
    }

    try {
      const variations = JSON.parse(form.getAttribute("data-product_variations") || "[]");
      const match = variations.find((variation) => selectValues.every((select) => variation.attributes?.[select.name] === select.value));
      if (!match) {
        setButtonEnabled(false);
        return;
      }
      form.querySelector(".variation_id")?.setAttribute("value", String(match.variation_id || 0));
      const target = form.querySelector(".single_variation");
      if (target) target.innerHTML = match.availability_html || "";
      setButtonEnabled(Boolean(match.is_in_stock && match.is_purchasable));
    } catch {
      // The form still works through the static cart catalog.
      setButtonEnabled(true);
    }
  }

  function updateNativeQuantityButton(button) {
    if (button.closest(".m-cart-quantity")) return;
    const wrapper = button.closest(".wc-block-components-quantity-selector, .quantity");
    const input = wrapper?.querySelector('input[type="number"], input.qty');
    if (!input) return;
    const max = Number.parseInt(input.max || "99", 10);
    const current = clampQuantity(input.value || 1, Number.isFinite(max) ? max : 99);
    const next = button.classList.contains("wc-block-components-quantity-selector__button--plus") ? current + 1 : current - 1;
    input.value = String(clampQuantity(next, Number.isFinite(max) ? max : 99));
  }

  function enhanceBuyNowButtons() {
    document.querySelectorAll("form.cart").forEach((form) => {
      if (form.querySelector(".m-buy-now-button")) return;
      const addButton = form.querySelector(".single_add_to_cart_button");
      if (!addButton) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "m-buy-now-button wp-element-button";
      button.dataset.product_id = formProductId(form, addButton);
      button.textContent = "Buy now";
      addButton.after(button);
    });

    document.querySelectorAll("a.ajax_add_to_cart[data-product_id], button.ajax_add_to_cart[data-product_id]").forEach((addButton) => {
      const productId = addButton.dataset.product_id;
      if (!productId || !productIds.has(String(productId))) return;

      const host = addButton.closest(".wp-block-button, .wc-block-grid__product-add-to-cart") || addButton.parentElement;
      if (!host || host.querySelector(".m-buy-now-link")) return;

      const link = document.createElement("a");
      link.className = "m-buy-now-link wp-element-button";
      link.href = useWooCommerceBackend ? checkoutAddToCartUrl(productId, addButton.dataset.quantity || "1") : localCheckoutUrl();
      link.dataset.product_id = productId;
      link.dataset.quantity = addButton.dataset.quantity || "1";
      link.textContent = "BUY NOW";
      host.append(link);
    });
  }

  function enhanceProductImageButtons() {
    document.querySelectorAll(".woocommerce-product-gallery").forEach((gallery) => {
      if (gallery.closest(".wp-block-column")?.querySelector(".m-product-image-buttons")) return;
      const column = gallery.closest(".wp-block-column");
      const form = gallery.closest(".wp-block-columns")?.querySelector("form.cart");
      if (!form || !column) return;

      const addButton = form.querySelector(".single_add_to_cart_button");
      if (!addButton) return;
      const productId = addButton.value || formProductId(form, addButton);
      const product = products[String(productId)];
      if (!product) return;

      const container = document.createElement("div");
      container.className = "m-product-image-buttons";

      const cartBtn = document.createElement("button");
      cartBtn.type = "button";
      cartBtn.className = "m-product-image-buttons__cart wp-element-button";
      cartBtn.dataset.product_id = productId;
      cartBtn.textContent = "ADD TO CART";
      cartBtn.addEventListener("click", () => {
        const handled = addFromForm(form, cartBtn);
        if (!handled) addToCart(productId);
      });
      container.appendChild(cartBtn);

      const buyBtn = document.createElement("button");
      buyBtn.type = "button";
      buyBtn.className = "m-product-image-buttons__buy wp-element-button";
      buyBtn.dataset.product_id = productId;
      buyBtn.textContent = "BUY NOW";
      buyBtn.addEventListener("click", () => {
        const handled = buyNowFromForm(form, buyBtn);
        if (!handled) {
          addToCart(productId);
          window.location.href = localCheckoutUrl();
        }
      });
      container.appendChild(buyBtn);

      column.style.position = "relative";
      column.appendChild(container);
    });
  }

  function enhanceMentoringPageButtons() {
    const container = document.querySelector(".m-training-opening__media .m-product-image-buttons");
    if (!container) return;
    const cartBtn = container.querySelector(".m-product-image-buttons__cart");
    const buyBtn = container.querySelector(".m-product-image-buttons__buy");
    if (cartBtn) {
      cartBtn.addEventListener("click", () => {
        addToCart(825);
      });
    }
    if (buyBtn) {
      buyBtn.addEventListener("click", () => {
        addToCart(825);
        window.location.href = localCheckoutUrl();
      });
    }
  }

  function enhanceProductGalleries() {
    document.querySelectorAll(".woocommerce-product-gallery").forEach((gallery) => {
      if (gallery.querySelector(".m-static-gallery-thumbs")) return;
      const wrapper = gallery.querySelector(".woocommerce-product-gallery__wrapper");
      const items = Array.from(wrapper?.querySelectorAll(".woocommerce-product-gallery__image") || []);
      if (items.length <= 1) return;

      const mainLink = items[0].querySelector("a");
      const mainImage = items[0].querySelector("img");
      if (!mainImage) return;

      const trigger = document.createElement("a");
      trigger.className = "m-static-gallery-trigger";
      trigger.href = mainLink?.href || mainImage.dataset.large_image || mainImage.src;
      trigger.target = "_blank";
      trigger.rel = "noopener";
      trigger.textContent = "View full-size image";
      gallery.prepend(trigger);

      const thumbs = document.createElement("div");
      thumbs.className = "m-static-gallery-thumbs";

      items.forEach((item, index) => {
        const image = item.querySelector("img");
        if (!image) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = `m-static-gallery-thumb${index === 0 ? " is-active" : ""}`;
        button.setAttribute("aria-label", image.alt || `Product image ${index + 1}`);

        const thumb = document.createElement("img");
        thumb.src = item.dataset.thumb || image.currentSrc || image.src;
        thumb.alt = "";
        thumb.loading = "lazy";
        button.append(thumb);

        button.addEventListener("click", () => {
          const fullImage = item.querySelector("a")?.href || image.dataset.large_image || image.src;
          if (mainLink) mainLink.href = fullImage;
          trigger.href = fullImage;
          mainImage.src = image.src;
          mainImage.srcset = image.srcset || "";
          mainImage.alt = image.alt || mainImage.alt;
          thumbs.querySelectorAll(".m-static-gallery-thumb").forEach((control) => control.classList.remove("is-active"));
          button.classList.add("is-active");
        });

        thumbs.append(button);
      });

      wrapper.after(thumbs);
    });
  }

  function configureRouletteCarousel(container) {
    const track = container.querySelector(".ia-roulette-track");
    if (!track) return;

    track.querySelectorAll('[data-m-ia-clone="true"]').forEach((clone) => clone.remove());
    const originals = Array.from(track.children).filter((item) => item.classList.contains("ia-item"));
    if (originals.length === 0) return;

    const originalWidth = track.scrollWidth;
    const containerWidth = container.clientWidth || window.innerWidth || originalWidth;
    if (!originalWidth || !containerWidth) return;

    let guard = 0;
    while (track.scrollWidth < originalWidth + (containerWidth * 2) && guard < 24) {
      originals.forEach((item) => {
        const clone = item.cloneNode(true);
        clone.dataset.mIaClone = "true";
        clone.setAttribute("aria-hidden", "true");
        track.append(clone);
      });
      guard += 1;
    }

    const duration = Math.max(24, originalWidth / 72);
    track.style.setProperty("--m-ia-loop-width", `${Math.round(originalWidth)}px`);
    track.style.setProperty("--m-ia-duration", `${duration.toFixed(2)}s`);
    track.classList.add("m-ia-ready");
  }

  function enhanceRouletteCarousels() {
    const containers = Array.from(document.querySelectorAll(".ia-roulette-container"));
    if (containers.length === 0) return;

    const configureAll = () => {
      containers.forEach((container) => {
        window.requestAnimationFrame(() => configureRouletteCarousel(container));
      });
    };

    containers.forEach((container) => {
      if (container.dataset.mIaBound === "true") return;
      container.dataset.mIaBound = "true";
      container.querySelectorAll("img").forEach((image) => {
        if (!image.complete) image.addEventListener("load", configureAll, { once: true });
      });
    });

    configureAll();

    if (window.__molecullaRouletteResizeBound) return;
    window.__molecullaRouletteResizeBound = true;
    let resizeFrame = 0;
    window.addEventListener("resize", () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        document.querySelectorAll(".ia-roulette-container").forEach(configureRouletteCarousel);
      });
    });
  }

  function enhanceHeaderLogoFallback() {
    document.querySelectorAll(".custom-logo-link").forEach((link) => {
      const image = link.querySelector("img.custom-logo");
      if (!image) return;

      const showFallback = () => {
        link.classList.add("m-logo-link--fallback");
        image.hidden = true;
        image.setAttribute("aria-hidden", "true");
        if (!link.querySelector(".m-logo-fallback")) {
          const fallback = document.createElement("span");
          fallback.className = "m-logo-fallback";
          fallback.textContent = "Moleculla";
          link.append(fallback);
        }
      };

      image.addEventListener("error", showFallback, { once: true });
      if (image.complete && image.naturalWidth === 0) showFallback();
    });
  }

  function bookingDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function bookingDateLabel(date) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "2-digit",
    }).format(date);
  }

  function bookingDates(count = 9) {
    const dates = [];
    const next = new Date();
    next.setHours(12, 0, 0, 0);
    let daysUntilWednesday = (3 - next.getDay() + 7) % 7 || 7;
    if (daysUntilWednesday < 7) daysUntilWednesday += 7;
    next.setDate(next.getDate() + daysUntilWednesday);

    for (let index = 0; index < count; index += 1) {
      const date = new Date(next);
      date.setDate(next.getDate() + (index * 7));
      dates.push(date);
    }

    return dates;
  }

  function bookingSlotsMarkup() {
    const times = ["11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
    return bookingDates().map((date) => {
      const key = bookingDateKey(date);
      const label = bookingDateLabel(date);
      return `<div class="m-booking-day">
        <h3>${escapeHtml(label)}</h3>
        <div class="m-booking-times">
          ${times.map((time) => `<button type="button" data-booking-slot data-date="${escapeHtml(key)}" data-date-label="${escapeHtml(label)}" data-time="${escapeHtml(time)}"><span></span>${escapeHtml(time)}</button>`).join("")}
        </div>
      </div>`;
    }).join("");
  }

  function bookingFlowMarkup() {
    return `<section class="m-booking-flow" data-booking-step="1" aria-label="Mentoring session booking">
      <div class="m-booking-steps" aria-label="Booking progress">
        <div data-booking-step-indicator="1"><span>1. Date and time</span><i></i></div>
        <div data-booking-step-indicator="2"><span>2. Client information</span><i></i></div>
        <div data-booking-step-indicator="3"><span>3. Payment</span><i></i></div>
        <div data-booking-step-indicator="4"><span>4. Confirmation</span><i></i></div>
      </div>

      <div class="m-booking-panel" data-booking-panel="1">
        <p class="m-booking-instruction">To continue your reservation, choose a time interval from the list.</p>
        <div class="m-booking-slot-grid">${bookingSlotsMarkup()}</div>
      </div>

      <form class="m-booking-panel m-booking-client-form" data-booking-panel="2">
        <p class="m-booking-instruction">Add the client details for this mentoring session.</p>
        <div class="m-booking-fields">
          <label>First name <input name="firstName" autocomplete="given-name" required></label>
          <label>Last name <input name="lastName" autocomplete="family-name" required></label>
          <label>Email <input name="email" type="email" autocomplete="email" required></label>
          <label>Phone <input name="phone" type="tel" autocomplete="tel"></label>
          <label class="m-booking-field-wide">Session goal <textarea name="goal" rows="4" placeholder="Briefly describe what you want to work on"></textarea></label>
        </div>
      </form>

      <div class="m-booking-panel" data-booking-panel="3">
        <p class="m-booking-instruction">Review your selected session before continuing to checkout.</p>
        <div class="m-booking-summary">
          <div><span>Date</span><strong data-booking-summary="date">Not selected</strong></div>
          <div><span>Time</span><strong data-booking-summary="time">Not selected</strong></div>
          <div><span>Client</span><strong data-booking-summary="client">Not added</strong></div>
          <div><span>Total</span><strong>${money.format(products[mentoringProductId].price)}</strong></div>
        </div>
      </div>

      <div class="m-booking-panel" data-booking-panel="4">
        <div class="m-booking-confirmation">
          <p class="m-booking-kicker">Reservation prepared</p>
          <h3>Your mentoring session is in the cart.</h3>
          <p>Checkout is the next step to complete payment and reserve the selected time.</p>
          <a class="wp-element-button m-primary-action" href="/checkout/">Go to checkout</a>
        </div>
      </div>

      <div class="m-booking-actions">
        <button type="button" class="m-booking-back" data-booking-back hidden>Back</button>
        <button type="button" class="m-booking-next" data-booking-next disabled>Continue</button>
      </div>
    </section>`;
  }

  function bookingClientData(flow) {
    const form = flow.querySelector(".m-booking-client-form");
    const data = Object.fromEntries(new FormData(form).entries());
    return {
      firstName: String(data.firstName || "").trim(),
      lastName: String(data.lastName || "").trim(),
      email: String(data.email || "").trim(),
      phone: String(data.phone || "").trim(),
      goal: String(data.goal || "").trim(),
    };
  }

  function bookingOptions(flow) {
    const client = bookingClientData(flow);
    return {
      "Appointment": `${flow.dataset.dateLabel || ""} at ${flow.dataset.time || ""}`.trim(),
      "Date": flow.dataset.dateLabel || "",
      "Time": flow.dataset.time || "",
      "First name": client.firstName,
      "Last name": client.lastName,
      "Email": client.email,
      "Phone": client.phone,
      "Session goal": client.goal,
    };
  }

  function updateBookingFlow(flow) {
    const step = Number.parseInt(flow.dataset.bookingStep || "1", 10);
    const hasSlot = Boolean(flow.dataset.date && flow.dataset.time);
    const client = bookingClientData(flow);
    const hasClient = Boolean(client.firstName && client.lastName && client.email);

    flow.querySelectorAll("[data-booking-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.bookingPanel !== String(step);
    });

    flow.querySelectorAll("[data-booking-step-indicator]").forEach((indicator) => {
      const indicatorStep = Number.parseInt(indicator.dataset.bookingStepIndicator, 10);
      indicator.classList.toggle("is-active", indicatorStep === step);
      indicator.classList.toggle("is-complete", indicatorStep < step);
    });

    flow.querySelectorAll("[data-booking-slot]").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.date === flow.dataset.date && button.dataset.time === flow.dataset.time);
    });

    const summaryDate = flow.querySelector('[data-booking-summary="date"]');
    const summaryTime = flow.querySelector('[data-booking-summary="time"]');
    const summaryClient = flow.querySelector('[data-booking-summary="client"]');
    if (summaryDate) summaryDate.textContent = flow.dataset.dateLabel || "Not selected";
    if (summaryTime) summaryTime.textContent = flow.dataset.time || "Not selected";
    if (summaryClient) summaryClient.textContent = hasClient ? `${client.firstName} ${client.lastName}` : "Not added";

    const back = flow.querySelector("[data-booking-back]");
    const next = flow.querySelector("[data-booking-next]");
    if (back) back.hidden = step <= 1 || step >= 4;
    if (next) {
      next.hidden = step >= 4;
      next.textContent = step === 3 ? "Continue to checkout" : "Continue";
      next.disabled = (step === 1 && !hasSlot) || (step === 2 && !hasClient);
    }
  }

  function setBookingStep(flow, step) {
    flow.dataset.bookingStep = String(Math.max(1, Math.min(4, step)));
    updateBookingFlow(flow);
  }

  function continueBooking(flow) {
    const step = Number.parseInt(flow.dataset.bookingStep || "1", 10);
    if (step === 2) {
      const form = flow.querySelector(".m-booking-client-form");
      if (form && !form.reportValidity()) return;
    }

    if (step === 3) {
      addToCart(mentoringProductId, 1, bookingOptions(flow));
      setBookingStep(flow, 4);
      return;
    }

    setBookingStep(flow, step + 1);
  }

  function enhanceMentoringBooking() {
    const form = Array.from(document.querySelectorAll("form.cart")).find((cartForm) => formProductId(cartForm, cartForm.querySelector(".single_add_to_cart_button")) === mentoringProductId);
    if (!form || document.querySelector(".m-booking-flow")) return;

    document.body.classList.add("m-booking-active");
    const flow = document.createElement("div");
    flow.innerHTML = bookingFlowMarkup();
    const booking = flow.firstElementChild;
    const formBlock = form.closest(".wp-block-add-to-cart-form");
    const productColumns = form.closest(".wp-block-columns");
    const productSummaryColumn = form.closest(".wp-block-column");
    const placeholder = document.querySelector("#amelia-v2-booking-1000");
    const placeholderTarget = placeholder?.closest("p") && placeholder.closest("p").textContent.trim() === ""
      ? placeholder.closest("p")
      : placeholder;

    if (productSummaryColumn && productColumns) {
      productSummaryColumn.appendChild(booking);
      placeholderTarget?.remove();
    } else if (formBlock) {
      formBlock.after(booking);
      placeholderTarget?.remove();
    } else if (placeholderTarget) {
      placeholderTarget.replaceWith(booking);
    } else {
      document.querySelector("main")?.prepend(booking);
    }

    booking.addEventListener("click", (event) => {
      const slot = event.target.closest("[data-booking-slot]");
      if (slot) {
        booking.dataset.date = slot.dataset.date || "";
        booking.dataset.dateLabel = slot.dataset.dateLabel || "";
        booking.dataset.time = slot.dataset.time || "";
        updateBookingFlow(booking);
        return;
      }

      if (event.target.closest("[data-booking-back]")) {
        const step = Number.parseInt(booking.dataset.bookingStep || "1", 10);
        setBookingStep(booking, step - 1);
        return;
      }

      if (event.target.closest("[data-booking-next]")) {
        continueBooking(booking);
      }
    });

    booking.querySelector(".m-booking-client-form")?.addEventListener("input", () => updateBookingFlow(booking));
    booking.querySelector(".m-booking-client-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      continueBooking(booking);
    });
    updateBookingFlow(booking);
  }

  function openModal(modal) {
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("custom-modal-open");
  }

  function closeModal(modal) {
    modal.classList.remove("active", "closing");
    modal.setAttribute("aria-hidden", "true");
    if (!document.querySelector(".custom-modal.active")) {
      document.body.classList.remove("custom-modal-open");
    }
  }

  function openModalFromRequest() {
    const params = new URLSearchParams(window.location.search);
    const modalAliases = {
      privacy: "custom-modal-4",
      shipping: "custom-modal-3",
      refund: "custom-modal-5",
      terms: "custom-modal-4",
    };
    const requested = params.get("modal") || window.location.hash.replace(/^#/, "");
    const modalId = modalAliases[requested] || requested;
    if (!modalId) return;
    const modal = document.getElementById(modalId);
    if (modal?.classList.contains("custom-modal")) openModal(modal);
  }

  function footerMarkup() {
    const year = new Date().getFullYear();
    return `<div class="m-site-footer__inner">
      <div class="m-site-footer__brand">
        <a class="m-site-footer__logo" href="/" aria-label="Moleculla home">
          <img src="/assets/mirror/uploads/2025/09/Moleculla_Lifestyle_Wellness_Nutrition_Main_Logo-edited-300x37.webp" alt="Moleculla" loading="lazy">
        </a>
        <p>Wellness begins at the molecular level</p>
      </div>
      <nav class="m-site-footer__nav" aria-label="Footer shop navigation">
        <h2 class="m-site-footer__heading">Explore</h2>
        <a href="/shop/">Shop</a>
        <a href="/mentoring/">Mentoring</a>
        <a href="/cart/">Cart</a>
      </nav>
      <nav class="m-site-footer__links" aria-label="Footer support navigation">
        <h2 class="m-site-footer__heading">Support</h2>
        <a href="mailto:${supportEmail}">Contact</a>
        <a href="#custom-modal-3" class="custom-modal-trigger" data-modal="custom-modal-3">Shipping</a>
        <a href="#custom-modal-4" class="custom-modal-trigger" data-modal="custom-modal-4">Privacy</a>
        <a href="#custom-modal-5" class="custom-modal-trigger" data-modal="custom-modal-5">Refunds</a>
      </nav>
      <div class="m-site-footer__social">
        <h2 class="m-site-footer__heading">Social</h2>
        <a href="https://www.instagram.com/moleculla/" target="_blank" rel="noopener nofollow">Instagram</a>
      </div>
      <p class="m-site-footer__copy">&copy; ${year} Moleculla. All rights reserved.</p>
    </div>`;
  }

  function modalMarkup(id, title, body) {
    return `<div id="${id}" class="custom-modal custom-modal-medium" aria-hidden="true">
      <div class="custom-modal-content">
        <button type="button" class="custom-modal-close" aria-label="Close">&times;</button>
        <div class="custom-modal-header"><h2>${title}</h2></div>
        <div class="custom-modal-body">${body}</div>
        <div class="custom-modal-footer"><button type="button" class="custom-modal-button">Close</button></div>
      </div>
    </div>`;
  }

  function ensurePolicyModals() {
    const modals = {
      "custom-modal-3": modalMarkup("custom-modal-3", "Shipping Policy", `
        <p>At Moleculla, we are dedicated to getting your wellness products to you in a timely and efficient manner.</p>
        <p><strong>Order processing:</strong> Orders are processed within 1-2 business days. We do not ship or deliver on weekends or holidays.</p>
        <p><strong>Domestic shipping:</strong> Standard shipping usually arrives within 3-5 business days. Expedited shipping usually arrives within 2-3 business days.</p>
        <p>Moleculla is not responsible for delays, damaged parcels, or lost parcels caused by Australia Post, but we will do our best to assist with follow-up if there is an issue.</p>
        <p>Please ensure delivery details are correct at checkout. We cannot guarantee order changes after an order joins the processing queue.</p>
      `),
      "custom-modal-4": modalMarkup("custom-modal-4", "Privacy Policy", `
        <p>Moleculla respects your privacy. We collect the information needed to process orders, respond to enquiries, provide downloads or mentoring bookings, and improve the website experience.</p>
        <p>This may include your name, email address, phone number, billing and shipping details, order details, and information you submit through forms on the site.</p>
        <p>We use trusted service providers for payments, hosting, email, analytics, order handling, and related website operations. We do not sell your personal information.</p>
        <p>You can contact us at <a href="mailto:moleculla.info@gmail.com">moleculla.info@gmail.com</a> to ask about your personal information or request an update.</p>
      `),
      "custom-modal-5": modalMarkup("custom-modal-5", "Refund Policy", `
        <p>At Moleculla, we want you to love your purchase. If something is not quite right, contact us and we will help.</p>
        <p><strong>Change of mind:</strong> We offer refunds or store credit on unused and unopened items returned within 14 days of delivery.</p>
        <ul><li>Items must be in original condition and packaging.</li><li>Return shipping costs are the responsibility of the customer.</li><li>We recommend using a tracked service.</li></ul>
        <p><strong>Damaged or faulty items:</strong> If your item arrives damaged, faulty, or not as described, contact us within 7 days of delivery with your order number, a clear photo, and a brief description of the issue.</p>
        <p>Email <a href="mailto:moleculla.info@gmail.com">moleculla.info@gmail.com</a> to request a refund or return instructions.</p>
      `),
    };

    Object.entries(modals).forEach(([id, markup]) => {
      if (document.getElementById(id)) return;
      const container = document.createElement("div");
      container.innerHTML = markup;
      document.body.appendChild(container.firstElementChild);
    });
  }

  function moveFooterModals(footer) {
    footer.querySelectorAll(".custom-modal").forEach((modal) => {
      document.body.appendChild(modal);
    });
  }

  function enhanceSiteFooters() {
    const footers = Array.from(document.querySelectorAll("footer.wp-block-template-part"));
    if (!footers.length) {
      const footer = document.createElement("footer");
      footer.className = "wp-block-template-part m-site-footer";
      footer.innerHTML = footerMarkup();
      (document.querySelector(".wp-site-blocks") || document.body).appendChild(footer);
      ensurePolicyModals();
      return;
    }

    const primary = footers[0];
    footers.forEach(moveFooterModals);
    primary.className = "wp-block-template-part m-site-footer";
    primary.removeAttribute("style");
    primary.innerHTML = footerMarkup();

    footers.slice(1).forEach((footer) => {
      footer.remove();
    });

    ensurePolicyModals();
  }

  document.addEventListener("click", (event) => {
    const noticeClose = event.target.closest(".m-notice-close");
    if (noticeClose) {
      noticeClose.closest(".m-notice")?.remove();
      return;
    }

    const modalTrigger = event.target.closest(".custom-modal-trigger[data-modal]");
    if (modalTrigger) {
      event.preventDefault();
      const modal = document.getElementById(modalTrigger.dataset.modal);
      if (modal) openModal(modal);
      return;
    }

    const modalClose = event.target.closest(".custom-modal-close, .custom-modal-button");
    if (modalClose) {
      event.preventDefault();
      const modal = modalClose.closest(".custom-modal");
      if (modal) closeModal(modal);
      return;
    }

    if (event.target.classList?.contains("custom-modal")) {
      closeModal(event.target);
      return;
    }

    const authSignOut = event.target.closest("[data-auth-signout]");
    if (authSignOut) {
      event.preventDefault();
      handleSignOut(authSignOut);
      return;
    }

    if (event.target.closest("[data-mini-cart-close]")) {
      event.preventDefault();
      closeMiniCart();
      return;
    }

    const cartButton = event.target.closest(".wc-block-mini-cart__button");
    if (cartButton) {
      event.preventDefault();
      if (useWooCommerceBackend) {
        window.location.href = commerceUrl("/cart/");
        return;
      }
      openMiniCart();
      return;
    }

    const buyNow = event.target.closest(".m-buy-now-button, .m-buy-now-link");
    if (buyNow) {
      event.preventDefault();
      const form = buyNow.closest("form.cart");
      const handled = form ? buyNowFromForm(form, buyNow) : buyNowFromButton(buyNow);
      if (!handled && buyNow.href) window.location.href = buyNow.href;
      return;
    }

    const remove = event.target.closest("[data-cart-remove]");
    if (remove) {
      event.preventDefault();
      removeCartItem(remove.dataset.cartRemove);
      return;
    }

    const adjust = event.target.closest("[data-cart-adjust]");
    if (adjust) {
      event.preventDefault();
      const item = readCart().find((entry) => entry.key === adjust.dataset.cartAdjust);
      if (item) updateCartItem(item.key, item.quantity + Number.parseInt(adjust.dataset.delta, 10));
      return;
    }

    const resetVariation = event.target.closest(".reset_variations");
    if (resetVariation) {
      event.preventDefault();
      const form = resetVariation.closest("form.variations_form");
      form?.querySelectorAll(".variations select").forEach((select) => {
        select.value = "";
      });
      if (form) updateVariationForm(form);
      return;
    }

    const nativeQuantityButton = event.target.closest(".wc-block-components-quantity-selector__button");
    if (nativeQuantityButton) {
      event.preventDefault();
      updateNativeQuantityButton(nativeQuantityButton);
      return;
    }

    const addButton = event.target.closest(".ajax_add_to_cart, .single_add_to_cart_button");
    if (addButton) {
      if (useWooCommerceBackend) {
        if (addButton.matches("button.ajax_add_to_cart")) {
          event.preventDefault();
          const productId = addButton.dataset.product_id || addButton.value || "";
          const quantity = addButton.dataset.quantity || "1";
          if (productId) {
            window.location.href = commerceUrl(`/cart/?add-to-cart=${encodeURIComponent(productId)}&quantity=${encodeURIComponent(quantity)}`);
          }
        }
        return;
      }
      const form = addButton.closest("form.cart");
      const handled = form ? addFromForm(form, addButton) : addFromButton(addButton);
      if (handled) event.preventDefault();
    }
  });

  document.addEventListener("change", (event) => {
    const quantity = event.target.closest("[data-cart-qty]");
    if (quantity) {
      updateCartItem(quantity.dataset.cartQty, quantity.value);
      return;
    }

    const variationSelect = event.target.closest("form.variations_form .variations select");
    if (variationSelect) updateVariationForm(variationSelect.closest("form.variations_form"));
  });

  document.addEventListener("submit", (event) => {
    const loginForm = event.target.closest(".woocommerce-form-login.login");
    if (loginForm) {
      event.preventDefault();
      handleLoginSubmit(loginForm);
      return;
    }

    const registerForm = event.target.closest(".woocommerce-form-register.register");
    if (registerForm) {
      event.preventDefault();
      handleRegisterSubmit(registerForm);
      return;
    }

    const passwordRecoveryForm = event.target.closest("[data-auth-reset-form]");
    if (passwordRecoveryForm) {
      event.preventDefault();
      handlePasswordRecoverySubmit(passwordRecoveryForm);
      return;
    }

    const passwordUpdateForm = event.target.closest("[data-auth-update-form]");
    if (passwordUpdateForm) {
      event.preventDefault();
      handlePasswordUpdateSubmit(passwordUpdateForm);
      return;
    }

    const guideLeadForm = event.target.closest("[data-guide-lead-form]");
    if (guideLeadForm) {
      event.preventDefault();
      handleGuideLeadSubmit(guideLeadForm);
      return;
    }

    const checkoutForm = event.target.closest(".m-checkout-form");
    if (checkoutForm) {
      event.preventDefault();
      handleCheckoutSubmit(checkoutForm);
      return;
    }

    const cartForm = event.target.closest("form.cart");
    if (cartForm) {
      if (useWooCommerceBackend) return;
      const handled = addFromForm(cartForm, event.submitter);
      if (handled) event.preventDefault();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll(".custom-modal.active").forEach(closeModal);
    closeMiniCart();
  });

  window.addEventListener("hashchange", () => {
    captureAuthSessionFromHash();
    renderPasswordRecoveryPage();
  });

  enhanceSiteFooters();
  document.querySelectorAll(".custom-modal").forEach((modal) => {
    modal.setAttribute("aria-hidden", modal.classList.contains("active") ? "false" : "true");
  });
  openModalFromRequest();
  if (useWooCommerceBackend) {
    wireWooCommerceBackend();
  } else {
    wireStaticCommerceLinks();
  }
  if (redirectToWooCommercePage()) return;
  if (useStripeCheckout && new URLSearchParams(window.location.search).get("checkout") === "cancelled") {
    showNotice("Checkout was cancelled. Your cart is still saved.", "error");
  }
  document.querySelectorAll("form.variations_form").forEach(updateVariationForm);
  enhanceHeaderLogoFallback();
  enhanceMentoringBooking();
  enhanceBuyNowButtons();
  enhanceProductImageButtons();
  enhanceMentoringPageButtons();
  enhanceProductGalleries();
  enhanceRouletteCarousels();
  renderCartCount();
  renderCurrentCommercePage();
  captureAuthSessionFromHash();
  renderAccountDashboard();
  renderPasswordRecoveryPage();
})();
