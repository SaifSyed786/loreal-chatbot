const categoryFilter = document.getElementById("categoryFilter");
const searchInput = document.getElementById("searchInput");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectionsBtn = document.getElementById("clearSelectionsBtn");
const generateRoutineBtn = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

/*
  Replace this later with your deployed Cloudflare Worker URL.
  Leave as empty string for now if you do not have it yet.
*/
const WORKER_URL = "https://loreal-routine-worker.tahooranai20.workers.dev/";

/*
  Conversation history for the chatbot.
  The system prompt keeps the AI focused on selected products and beauty topics.
*/
let conversationMessages = [
  {
    role: "system",
    content:
      "You are a helpful L'Oréal beauty advisor. Create personalized beauty routines using only the selected products the user provides. Use the product name, brand, category, and description to explain how each item fits into a routine. Do not invent products that were not selected. Keep responses practical, friendly, and focused on skincare, haircare, makeup, fragrance, and beauty routines. For follow-up questions, use the prior conversation history so your answers stay relevant and consistent.",
  },
];

let allProducts = [];
let filteredProducts = [];
let selectedProducts = [];
let searchTerm = "";
let currentCategory = "all";

const LOCAL_STORAGE_KEY = "loreal-selected-products";

function addMessage(role, text) {
  const messageEl = document.createElement("div");
  messageEl.className = `message ${role}`;
  messageEl.textContent = text;
  chatWindow.appendChild(messageEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function initializeChat() {
  chatWindow.innerHTML = "";
  addMessage(
    "system",
    "Select products, generate a routine, then ask follow-up questions about order of use, skin concerns, or how the products fit together.",
  );
}

function updateGenerateButtonState() {
  generateRoutineBtn.disabled = selectedProducts.length === 0;
}

async function loadProducts() {
  try {
    const response = await fetch("products.json");

    if (!response.ok) {
      throw new Error("Could not load products.json");
    }

    const data = await response.json();
    allProducts = data.products || [];
    applyFilters();
  } catch (error) {
    console.error("Error loading products:", error);
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Could not load products. Check that products.json is in the correct folder and properly formatted.
      </div>
    `;
  }
}

function saveSelections() {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(selectedProducts));
}

function loadSelections() {
  const savedSelections = localStorage.getItem(LOCAL_STORAGE_KEY);

  if (savedSelections) {
    try {
      selectedProducts = JSON.parse(savedSelections);
    } catch (error) {
      console.error("Error reading saved selections:", error);
      selectedProducts = [];
    }
  }
}

function isProductSelected(product) {
  return selectedProducts.some((item) => item.name === product.name);
}

function toggleProductSelection(product) {
  if (isProductSelected(product)) {
    selectedProducts = selectedProducts.filter(
      (item) => item.name !== product.name,
    );
  } else {
    selectedProducts.push(product);
  }

  saveSelections();
  renderProducts(filteredProducts);
  renderSelectedProducts();
  updateGenerateButtonState();
}

function removeSelectedProduct(productName) {
  selectedProducts = selectedProducts.filter(
    (item) => item.name !== productName,
  );
  saveSelections();
  renderProducts(filteredProducts);
  renderSelectedProducts();
  updateGenerateButtonState();
}

function clearSelections() {
  selectedProducts = [];
  saveSelections();
  renderProducts(filteredProducts);
  renderSelectedProducts();
  updateGenerateButtonState();
}

function applyFilters() {
  filteredProducts = allProducts.filter((product) => {
    const matchesCategory =
      currentCategory === "all" || product.category === currentCategory;

    const searchableText = `
      ${product.name || ""}
      ${product.brand || ""}
      ${product.category || ""}
      ${product.description || ""}
    `.toLowerCase();

    const matchesSearch = searchableText.includes(searchTerm.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  renderProducts(filteredProducts);
}

function renderProducts(products) {
  if (!products.length) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products match that category or search.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = "";

  products.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";

    if (isProductSelected(product)) {
      card.classList.add("selected");
    }

    const safeImage = product.image || "";
    const safeName = product.name || "Unnamed Product";
    const safeBrand = product.brand || "L'Oréal Brand";
    const safeCategory = product.category || "Beauty";
    const safeDescription = product.description || "No description available.";

    card.innerHTML = `
      <div class="product-image-wrap">
        <img src="${safeImage}" alt="${safeName}" />
      </div>

      <div class="product-info">
        <p class="product-brand">${safeBrand}</p>
        <h3>${safeName}</h3>
        <p class="product-category">${safeCategory}</p>

        <div class="card-actions">
          <button type="button" class="desc-btn">Show Description</button>
          <button type="button" class="select-btn ${
            isProductSelected(product) ? "selected-btn" : ""
          }">
            ${isProductSelected(product) ? "Selected" : "Select"}
          </button>
        </div>

        <div class="product-description hidden">${safeDescription}</div>
      </div>
    `;

    const descBtn = card.querySelector(".desc-btn");
    const selectBtn = card.querySelector(".select-btn");
    const descriptionEl = card.querySelector(".product-description");

    descBtn.addEventListener("click", (event) => {
      event.stopPropagation();

      descriptionEl.classList.toggle("hidden");
      descBtn.textContent = descriptionEl.classList.contains("hidden")
        ? "Show Description"
        : "Hide Description";
    });

    selectBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleProductSelection(product);
    });

    card.addEventListener("click", () => {
      toggleProductSelection(product);
    });

    productsContainer.appendChild(card);
  });
}

function renderSelectedProducts() {
  selectedProductsList.innerHTML = "";

  if (!selectedProducts.length) {
    selectedProductsList.innerHTML = `
      <p class="placeholder-message">No products selected yet.</p>
    `;
    return;
  }

  selectedProducts.forEach((product) => {
    const chip = document.createElement("div");
    chip.className = "selected-chip";

    chip.innerHTML = `
      <span>${product.name}</span>
      <button
        type="button"
        class="remove-chip-btn"
        aria-label="Remove ${product.name}"
      >
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;

    const removeBtn = chip.querySelector(".remove-chip-btn");
    removeBtn.addEventListener("click", () =>
      removeSelectedProduct(product.name),
    );

    selectedProductsList.appendChild(chip);
  });
}

async function callWorker(messages) {
  if (!WORKER_URL) {
    return {
      ok: false,
      error:
        "Your Cloudflare Worker URL has not been added yet. For now, the app structure is complete, but AI responses cannot run until you paste that URL into script.js.",
    };
  }

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        error: data.error || "The Worker returned an error.",
      };
    }

    const reply =
      data.choices?.[0]?.message?.content ||
      data.reply ||
      "The AI response came back empty.";

    return { ok: true, reply };
  } catch (error) {
    console.error("Worker call failed:", error);
    return {
      ok: false,
      error:
        "Could not reach the Worker. Check your deployed Worker URL later.",
    };
  }
}

async function generateRoutine() {
  if (!selectedProducts.length) {
    addMessage("assistant", "Please select at least one product first.");
    return;
  }

  addMessage("user", "Generate a routine with my selected products.");

  const routinePrompt = `
Create a personalized beauty routine using only these selected products:

${JSON.stringify(selectedProducts, null, 2)}

Explain:
1. The best order to use the products
2. Why each product belongs in the routine
3. Any useful practical tips

Do not include products that are not listed above.
`;

  conversationMessages.push({
    role: "user",
    content: routinePrompt,
  });

  generateRoutineBtn.disabled = true;
  generateRoutineBtn.textContent = "Generating...";

  const result = await callWorker(conversationMessages);

  if (result.ok) {
    addMessage("assistant", result.reply);
    conversationMessages.push({
      role: "assistant",
      content: result.reply,
    });
  } else {
    addMessage("assistant", result.error);
  }

  generateRoutineBtn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Routine`;
  updateGenerateButtonState();
}

async function handleFollowUpQuestion(event) {
  event.preventDefault();

  const question = userInput.value.trim();

  if (!question) {
    return;
  }

  addMessage("user", question);

  conversationMessages.push({
    role: "user",
    content: question,
  });

  userInput.value = "";

  const result = await callWorker(conversationMessages);

  if (result.ok) {
    addMessage("assistant", result.reply);
    conversationMessages.push({
      role: "assistant",
      content: result.reply,
    });
  } else {
    addMessage("assistant", result.error);
  }
}

categoryFilter.addEventListener("change", (event) => {
  currentCategory = event.target.value;
  applyFilters();
});

searchInput.addEventListener("input", (event) => {
  searchTerm = event.target.value.trim();
  applyFilters();
});

clearSelectionsBtn.addEventListener("click", clearSelections);
generateRoutineBtn.addEventListener("click", generateRoutine);
chatForm.addEventListener("submit", handleFollowUpQuestion);

function init() {
  initializeChat();
  loadSelections();
  renderSelectedProducts();
  updateGenerateButtonState();
  loadProducts();
}

init();
