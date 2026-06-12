(() => {
  const products = JSON.parse(document.getElementById("product-data").textContent);
  const productMap = new Map(products.map((product) => [product.id, product]));
  const cartKey = "moleculla_cart_v1";
  const email = "moleculla.info@gmail.com";
  const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(cartKey)) || [];
    } catch {
      return [];
    }
  }

  function setCart(cart) {
    localStorage.setItem(cartKey, JSON.stringify(cart));
    renderCartCount();
  }

  function cartCount(cart = getCart()) {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }

  function cartTotal(cart = getCart()) {
    return cart.reduce((total, item) => {
      const product = productMap.get(item.id);
      return product ? total + product.price * item.quantity : total;
    }, 0);
  }

  function renderCartCount() {
    const count = cartCount();
    document.querySelectorAll("[data-cart-count]").forEach((node) => {
      node.textContent = String(count);
      node.hidden = count === 0;
    });
  }

  function addToCart(id) {
    const product = productMap.get(id);
    if (!product || !product.purchasable) return;
    const cart = getCart();
    const existing = cart.find((item) => item.id === id);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({ id, quantity: 1 });
    }
    setCart(cart);
    renderCartPage();
    renderCheckoutSummary();
  }

  function updateQuantity(id, delta) {
    const cart = getCart().map((item) =>
      item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item,
    ).filter((item) => item.quantity > 0);
    setCart(cart);
    renderCartPage();
    renderCheckoutSummary();
  }

  function removeItem(id) {
    setCart(getCart().filter((item) => item.id !== id));
    renderCartPage();
    renderCheckoutSummary();
  }

  function summaryHtml(cart) {
    return `
      <h2>Summary</h2>
      <div class="summary-row"><span>Items</span><span>${cartCount(cart)}</span></div>
      <div class="summary-row"><span>Subtotal</span><span>${currency.format(cartTotal(cart))}</span></div>
      <div class="summary-row"><span>Shipping</span><span>Calculated after request</span></div>
      <div class="summary-row total"><span>Total</span><span>${currency.format(cartTotal(cart))}</span></div>
      <p>Shipping, payment, and digital delivery details are confirmed by email.</p>
      <a class="button wide" href="/checkout/">Continue to checkout</a>
    `;
  }

  function renderCartPage() {
    const panel = document.querySelector("[data-cart-page]");
    const summary = document.querySelector("[data-cart-summary]");
    if (!panel || !summary) return;
    const cart = getCart();
    if (!cart.length) {
      panel.innerHTML = `<div class="empty-state"><h2>Your cart is empty</h2><p>Explore the shop to add wellness products and guides.</p><a class="button" href="/shop/">Start shopping</a></div>`;
      summary.innerHTML = summaryHtml(cart);
      return;
    }
    panel.innerHTML = cart.map((item) => {
      const product = productMap.get(item.id);
      if (!product) return "";
      return `
        <article class="cart-item">
          <img src="${product.image}" alt="${product.title}">
          <div>
            <h3>${product.title}</h3>
            <p>${product.category} / SKU ${product.sku}</p>
            <p>${currency.format(product.price)} each</p>
          </div>
          <div class="cart-item-actions">
            <div class="qty-control" aria-label="Quantity for ${product.title}">
              <button type="button" data-qty-dec="${product.id}">-</button>
              <span>${item.quantity}</span>
              <button type="button" data-qty-inc="${product.id}">+</button>
            </div>
            <button class="remove-button" type="button" data-remove="${product.id}">Remove</button>
          </div>
        </article>
      `;
    }).join("");
    summary.innerHTML = summaryHtml(cart);
  }

  function renderCheckoutSummary() {
    const summary = document.querySelector("[data-checkout-summary]");
    if (!summary) return;
    const cart = getCart();
    if (!cart.length) {
      summary.innerHTML = `<div class="empty-state"><h2>Your cart is empty</h2><p>Add items before sending an order request.</p><a class="button" href="/shop/">Go to shop</a></div>`;
      return;
    }
    summary.innerHTML = `
      <h2>Order</h2>
      ${cart.map((item) => {
        const product = productMap.get(item.id);
        if (!product) return "";
        return `<div class="summary-row"><span>${product.title} x ${item.quantity}</span><span>${currency.format(product.price * item.quantity)}</span></div>`;
      }).join("")}
      <div class="summary-row total"><span>Total</span><span>${currency.format(cartTotal(cart))}</span></div>
    `;
  }

  function bindCheckoutForm() {
    const form = document.querySelector("[data-checkout-form]");
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const cart = getCart();
      if (!cart.length) {
        location.href = "/shop/";
        return;
      }
      const formData = new FormData(form);
      const lines = [
        "Moleculla order request",
        "",
        ...cart.flatMap((item) => {
          const product = productMap.get(item.id);
          return product ? [`${product.title} x ${item.quantity} - ${currency.format(product.price * item.quantity)}`] : [];
        }),
        "",
        `Total: ${currency.format(cartTotal(cart))}`,
        "",
        `Name: ${formData.get("name") || ""}`,
        `Email: ${formData.get("email") || ""}`,
        `Phone: ${formData.get("phone") || ""}`,
        `Address: ${formData.get("address") || ""}`,
        `Notes: ${formData.get("notes") || ""}`,
      ];
      const subject = encodeURIComponent("Moleculla order request");
      const body = encodeURIComponent(lines.join("\n"));
      location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    });
  }

  function bindShopControls() {
    const grid = document.querySelector(".product-grid");
    if (!grid) return;
    document.querySelectorAll("[data-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        const filter = button.dataset.filter;
        document.querySelectorAll("[data-product-card]").forEach((card) => {
          card.hidden = filter !== "all" && card.dataset.category !== filter;
        });
      });
    });
    const sort = document.querySelector("[data-sort-products]");
    if (!sort) return;
    sort.addEventListener("change", () => {
      const cards = Array.from(grid.querySelectorAll("[data-product-card]"));
      cards.sort((a, b) => {
        if (sort.value === "price-high") return Number(b.dataset.price) - Number(a.dataset.price);
        if (sort.value === "price-low") return Number(a.dataset.price) - Number(b.dataset.price);
        if (sort.value === "name") return a.dataset.title.localeCompare(b.dataset.title);
        return 0;
      });
      cards.forEach((card) => grid.appendChild(card));
    });
  }

  function bindGallery() {
    document.querySelectorAll("[data-gallery]").forEach((gallery) => {
      const main = gallery.querySelector("[data-gallery-main]");
      gallery.querySelectorAll("[data-gallery-thumb]").forEach((button) => {
        button.addEventListener("click", () => {
          main.src = button.dataset.galleryThumb;
          gallery.querySelectorAll("[data-gallery-thumb]").forEach((item) => item.classList.remove("active"));
          button.classList.add("active");
        });
      });
    });
  }

  function bindNavigation() {
    const toggle = document.querySelector("[data-nav-toggle]");
    const nav = document.querySelector("[data-nav]");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  document.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add-to-cart]");
    if (add) addToCart(add.dataset.addToCart);
    const inc = event.target.closest("[data-qty-inc]");
    if (inc) updateQuantity(inc.dataset.qtyInc, 1);
    const dec = event.target.closest("[data-qty-dec]");
    if (dec) updateQuantity(dec.dataset.qtyDec, -1);
    const remove = event.target.closest("[data-remove]");
    if (remove) removeItem(remove.dataset.remove);
  });

  renderCartCount();
  renderCartPage();
  renderCheckoutSummary();
  bindCheckoutForm();
  bindShopControls();
  bindGallery();
  bindNavigation();
})();