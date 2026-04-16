const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

// Replace with your deployed Cloudflare Worker URL
const WORKER_URL = "https://loreal-routine-worker.tahooranai20.workers.dev/";

// Conversation history — system prompt keeps AI focused on L'Oréal topics only
let conversationMessages = [
  {
    role: "system",
    content:
      "You are a helpful L'Oréal beauty advisor. Only answer questions about L'Oréal products, skincare, haircare, makeup, fragrance, and beauty routines. If a question is unrelated, politely refuse and guide the user back to beauty-related topics. Keep answers clear and relevant.",
  },
];

// Add a message bubble to the chat window
function addMessage(role, text) {
  const messageEl = document.createElement("div");
  messageEl.className = `message ${role}`;
  messageEl.textContent = text;
  chatWindow.appendChild(messageEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Send the full messages array to the Cloudflare Worker and return the reply
async function callWorker(messages) {
  if (!WORKER_URL) {
    return { ok: false, error: "No Worker URL set. Add your Cloudflare Worker URL to script.js." };
  }

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { ok: false, error: data.error || "The Worker returned an error." };
    }

    const reply =
      data.choices?.[0]?.message?.content ||
      data.reply ||
      "The AI response came back empty.";

    return { ok: true, reply };
  } catch (error) {
    console.error("Worker call failed:", error);
    return { ok: false, error: "Could not reach the Worker. Check your URL." };
  }
}

// Handle form submission — capture input, send to Worker, display response
async function handleSubmit(event) {
  event.preventDefault();

  const question = userInput.value.trim();
  if (!question) return;

  // Show user message and add to history
  addMessage("user", question);
  conversationMessages.push({ role: "user", content: question });
  userInput.value = "";

  // Get and display AI response
  const result = await callWorker(conversationMessages);

  if (result.ok) {
    addMessage("assistant", result.reply);
    conversationMessages.push({ role: "assistant", content: result.reply });
  } else {
    addMessage("assistant", result.error);
  }
}

// Kick off with a welcome message
function init() {
  addMessage(
    "system",
    "👋 Hello! I'm your L'Oréal beauty advisor. Ask me about skincare routines, product recommendations, haircare tips, makeup, and more!"
  );
}

chatForm.addEventListener("submit", handleSubmit);
init();
