(() => {
  let token = sessionStorage.getItem("adminToken") || null;
  let socket;
  let currentState = null;
  let timerInterval = null;
  let sortableInstance = null;

  const els = {
    loginOverlay: document.getElementById("login-overlay"),
    loginForm: document.getElementById("login-form"),
    loginError: document.getElementById("login-error"),
    passwordInput: document.getElementById("password"),
    dashboard: document.getElementById("dashboard"),
    eventName: document.getElementById("event-name"),
    statusDot: document.getElementById("status-dot"),
    statusText: document.getElementById("status-text"),
    queueCount: document.getElementById("queue-count"),
    pauseBtn: document.getElementById("pause-btn"),
    seedBtn: document.getElementById("seed-btn"),
    resetBtn: document.getElementById("reset-btn"),
    capInput: document.getElementById("cap-input"),
    capBtn: document.getElementById("cap-btn"),
    capClearBtn: document.getElementById("cap-clear-btn"),
    capStatus: document.getElementById("cap-status"),
    currentSection: document.getElementById("current-section"),
    queueList: document.getElementById("queue-list"),
    qrSection: document.getElementById("qr-section"),
  };

  // If we already have a token, try to go straight to dashboard
  if (token) {
    showDashboard();
  }

  // Login form
  els.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.loginError.classList.add("hidden");
    const password = els.passwordInput.value;

    try {
      const res = await fetch("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json();
        els.loginError.textContent = data.error || "Login failed";
        els.loginError.classList.remove("hidden");
        return;
      }

      const data = await res.json();
      token = data.token;
      sessionStorage.setItem("adminToken", token);
      showDashboard();
    } catch {
      els.loginError.textContent = "Connection error";
      els.loginError.classList.remove("hidden");
    }
  });

  function showDashboard() {
    els.loginOverlay.classList.add("hidden");
    els.dashboard.classList.remove("hidden");
    connectSocket();
    loadEventInfo();
    loadQR();
  }

  function connectSocket() {
    if (socket) return;
    socket = io();

    socket.on("queue-state", (state) => {
      currentState = state;
      render(state);
    });

    socket.on("admin:error", ({ message }) => {
      if (message === "Unauthorized") {
        // Token expired / invalid — force re-login
        sessionStorage.removeItem("adminToken");
        token = null;
        els.loginOverlay.classList.remove("hidden");
        els.dashboard.classList.add("hidden");
        showToast("Session expired. Please log in again.");
        return;
      }
      showToast(message);
    });
  }

  function loadEventInfo() {
    fetch("/api/event")
      .then((r) => r.json())
      .then((data) => {
        els.eventName.textContent = `${data.name} — Admin`;
        document.title = `Admin — ${data.name}`;
      })
      .catch(() => {});
  }

  function loadQR() {
    fetch("/api/qr")
      .then((r) => r.json())
      .then((data) => {
        els.qrSection.innerHTML = `
          <img src="${data.qrDataUrl}" alt="QR Code" id="qr-img">
          <div class="qr-section__url">${esc(data.url)}</div>
          <button class="btn btn--small" id="copy-qr-btn">Copy QR + URL</button>`;

        document.getElementById("copy-qr-btn").onclick = async () => {
          try {
            const img = document.getElementById("qr-img");
            // Draw QR image to a canvas to get a blob
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));

            await navigator.clipboard.write([
              new ClipboardItem({
                "image/png": blob,
                "text/plain": new Blob([data.url], { type: "text/plain" }),
              }),
            ]);
            showToast("QR code and URL copied!");
          } catch {
            // Fallback: copy just the URL if clipboard image API isn't supported
            try {
              await navigator.clipboard.writeText(data.url);
              showToast("URL copied (image copy not supported in this browser)");
            } catch {
              showToast("Could not copy to clipboard");
            }
          }
        };
      })
      .catch(() => {
        els.qrSection.innerHTML = `<p class="empty">Could not load QR code</p>`;
      });
  }

  // Cap controls
  els.capBtn.addEventListener("click", () => {
    const val = parseInt(els.capInput.value, 10);
    if (!val || val < 1) {
      showToast("Enter a number greater than 0");
      return;
    }
    socket.emit("admin:set-cap", { token, cap: val });
  });

  els.capClearBtn.addEventListener("click", () => {
    els.capInput.value = "";
    socket.emit("admin:set-cap", { token, cap: null });
  });

  els.seedBtn.addEventListener("click", () => {
    socket.emit("admin:seed", { token });
  });

  els.resetBtn.addEventListener("click", () => {
    if (confirm("Reset the queue? This wipes all demoers, the cap, and pause state.")) {
      socket.emit("admin:reset", { token });
    }
  });

  function render(state) {
    renderStatusBar(state);
    renderCapBar(state);
    renderCurrent(state);
    renderQueue(state);
  }

  function renderStatusBar(state) {
    const waiting = state.queue.filter((d) => d.status === "waiting");

    if (state.paused) {
      els.statusDot.className = "status-dot status-dot--paused";
      els.statusText.textContent = "Paused";
      els.pauseBtn.textContent = "Resume";
      els.pauseBtn.className = "btn btn--small btn--green";
    } else {
      els.statusDot.className = "status-dot status-dot--active";
      els.statusText.textContent = "Active";
      els.pauseBtn.textContent = "Pause";
      els.pauseBtn.className = "btn btn--small btn--amber";
    }

    els.queueCount.textContent = `${waiting.length} waiting`;

    els.pauseBtn.onclick = () => {
      socket.emit("admin:pause", { token, paused: !state.paused });
    };
  }

  function renderCapBar(state) {
    if (state.demoCap !== null) {
      const remaining = Math.max(0, state.demoCap - state.totalDemoers);
      els.capStatus.textContent = `${state.totalDemoers} / ${state.demoCap} spots used (${remaining} left)`;
      els.capInput.placeholder = String(state.demoCap);
    } else {
      els.capStatus.textContent = "No limit set";
      els.capInput.placeholder = "No limit";
    }
  }

  function renderCurrent(state) {
    const { currentDemoer } = state;
    const waiting = state.queue.filter((d) => d.status === "waiting");

    // Clear old timer
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    if (currentDemoer) {
      const timerId = "demo-timer";
      els.currentSection.innerHTML = `
        <div class="card banner--active" style="border: 1px solid var(--green);">
          <div class="banner__label">Now Demoing</div>
          <div class="banner__name">${esc(currentDemoer.name)}</div>
          <div class="banner__project">${esc(currentDemoer.project)}</div>
          <div class="timer" id="${timerId}"></div>
          <div style="margin-top: 12px;">
            <button class="btn btn--green" id="next-btn">Next &rarr;</button>
          </div>
        </div>`;

      // Timer
      if (currentDemoer.demoStartedAt) {
        const startTime = new Date(currentDemoer.demoStartedAt).getTime();
        const timerEl = document.getElementById(timerId);
        const updateTimer = () => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const mins = Math.floor(elapsed / 60);
          const secs = elapsed % 60;
          timerEl.textContent = `${mins}:${String(secs).padStart(2, "0")} elapsed`;
        };
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
      }

      document.getElementById("next-btn").onclick = () => {
        socket.emit("admin:advance", { token });
      };
    } else if (waiting.length > 0) {
      els.currentSection.innerHTML = `
        <div class="card banner--empty">
          <div>No one is demoing. Ready to start?</div>
          <div style="margin-top: 12px;">
            <button class="btn btn--green" id="start-btn">Start First Demo &rarr;</button>
          </div>
        </div>`;

      document.getElementById("start-btn").onclick = () => {
        socket.emit("admin:advance", { token });
      };
    } else {
      els.currentSection.innerHTML = `
        <div class="card banner--empty">
          <div>Queue is empty. Waiting for demoers to join...</div>
        </div>`;
    }
  }

  function renderQueue(state) {
    const waiting = state.queue.filter((d) => d.status === "waiting");

    if (waiting.length === 0) {
      els.queueList.innerHTML = `<div class="empty">No one waiting.</div>`;
      return;
    }

    els.queueList.innerHTML = waiting
      .map(
        (d, i) => `
      <div class="card card--enter card--draggable" data-id="${d.id}">
        <div class="queue-item">
          <div class="drag-handle">&#9776;</div>
          <div class="queue-item__num">${i + 1}.</div>
          <div class="queue-item__info">
            <div class="queue-item__name">${esc(d.name)}</div>
            <div class="queue-item__project">${esc(d.project)}</div>
          </div>
          <button class="btn btn--danger" data-remove="${d.id}">Remove</button>
        </div>
      </div>`
      )
      .join("");

    // Init drag-and-drop
    if (sortableInstance) sortableInstance.destroy();
    sortableInstance = new Sortable(els.queueList, {
      animation: 150,
      handle: ".drag-handle",
      ghostClass: "card--ghost",
      onEnd: () => {
        const orderedIds = Array.from(els.queueList.children)
          .map((el) => Number(el.dataset.id))
          .filter((id) => !isNaN(id));
        socket.emit("admin:reorder", { token, orderedIds });
      },
    });

    // Event delegation for remove buttons
    els.queueList.onclick = (e) => {
      const btn = e.target.closest("[data-remove]");
      if (!btn) return;
      const removeId = btn.dataset.remove;
      if (confirm("Remove this demoer from the queue?")) {
        socket.emit("admin:remove", { token, id: Number(removeId) });
      }
    };
  }

  function esc(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(msg) {
    // Remove existing toasts
    document.querySelectorAll(".toast").forEach((t) => t.remove());
    const toast = document.createElement("div");
    toast.className = "toast";
    // Use green for success messages
    if (msg.includes("copied")) {
      toast.style.background = "var(--green)";
    }
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
})();
