(() => {
  const socket = io();
  let myId = sessionStorage.getItem("demoerId")
    ? Number(sessionStorage.getItem("demoerId"))
    : null;

  const els = {
    eventName: document.getElementById("event-name"),
    statusBanner: document.getElementById("status-banner"),
    yourPosition: document.getElementById("your-position"),
    joinSection: document.getElementById("join-section"),
    joinForm: document.getElementById("join-form"),
    joinBtn: document.getElementById("join-btn"),
    nameInput: document.getElementById("name"),
    projectInput: document.getElementById("project"),
    queueHeader: document.getElementById("queue-header"),
    queueList: document.getElementById("queue-list"),
  };

  // Load event name
  fetch("/api/event")
    .then((r) => r.json())
    .then((data) => {
      els.eventName.textContent = data.name;
      document.title = data.name;
    })
    .catch(() => {});

  // Join form submit
  els.joinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = els.nameInput.value.trim();
    const project = els.projectInput.value.trim();
    if (!name || !project) return;

    els.joinBtn.disabled = true;
    socket.emit("join-queue", { name, project });
  });

  // Join result
  socket.on("join-result", ({ success, error, demoer }) => {
    els.joinBtn.disabled = false;
    if (success) {
      myId = demoer.id;
      sessionStorage.setItem("demoerId", myId);
    } else {
      showToast(error || "Could not join queue");
    }
  });

  // Queue state update
  socket.on("queue-state", (state) => {
    renderStatus(state);
    renderPosition(state);
    renderJoinSection(state);
    renderQueue(state);
  });

  function renderStatus(state) {
    const { currentDemoer, paused } = state;

    if (paused) {
      els.statusBanner.innerHTML = `
        <div class="banner banner--paused">
          <div class="banner__label">Queue Paused</div>
          <div>Not accepting signups right now</div>
        </div>`;
    } else if (currentDemoer) {
      els.statusBanner.innerHTML = `
        <div class="banner banner--active">
          <div class="banner__label">Now Demoing</div>
          <div class="banner__name">${esc(currentDemoer.name)}</div>
          <div class="banner__project">${esc(currentDemoer.project)}</div>
        </div>`;
    } else {
      els.statusBanner.innerHTML = `
        <div class="banner banner--empty">No one is demoing yet. Be the first!</div>`;
    }
  }

  function renderPosition(state) {
    const waiting = state.queue.filter((d) => d.status === "waiting");
    const myEntry = state.queue.find((d) => d.id === myId);

    if (!myEntry) {
      // Check if we had an ID but are no longer in queue (completed or removed)
      if (myId) {
        // Clear the stored ID so they can rejoin
        myId = null;
        sessionStorage.removeItem("demoerId");
        els.yourPosition.innerHTML = `
          <div class="banner banner--empty">Your demo is done! Thanks for presenting. You can join again anytime.</div>`;
        els.yourPosition.classList.remove("hidden");
      } else {
        els.yourPosition.classList.add("hidden");
      }
      return;
    }

    if (myEntry.status === "demoing") {
      els.yourPosition.innerHTML = `
        <div class="banner banner--active">
          <div class="banner__label">You're Up!</div>
          <div>It's your turn to demo!</div>
        </div>`;
    } else {
      const pos = waiting.findIndex((d) => d.id === myId) + 1;
      els.yourPosition.innerHTML = `
        <div class="banner banner--you">
          <div class="banner__label">Your Position</div>
          <div>You are <strong>#${pos}</strong> in line</div>
        </div>`;
    }
    els.yourPosition.classList.remove("hidden");
  }

  function renderJoinSection(state) {
    const inQueue = state.queue.some((d) => d.id === myId);
    if (inQueue) {
      els.joinSection.classList.add("hidden");
    } else if (state.paused) {
      // Show form but disabled when paused
      els.joinSection.classList.remove("hidden");
      els.joinBtn.disabled = true;
    } else {
      // Show form — either first time or after completing a demo
      els.joinSection.classList.remove("hidden");
      els.joinBtn.disabled = false;
    }
  }

  function renderQueue(state) {
    const waiting = state.queue.filter((d) => d.status === "waiting");
    els.queueHeader.textContent = `Queue (${waiting.length} waiting)`;

    if (waiting.length === 0) {
      els.queueList.innerHTML = `<div class="empty">No one in the queue yet.</div>`;
      return;
    }

    els.queueList.innerHTML = waiting
      .map(
        (d, i) => `
      <div class="card card--enter ${d.id === myId ? "card--you" : ""}">
        <div class="queue-item">
          <div class="queue-item__num">${i + 1}.</div>
          <div class="queue-item__info">
            <div class="queue-item__name">${esc(d.name)}${d.id === myId ? " (You)" : ""}</div>
            <div class="queue-item__project">${esc(d.project)}</div>
          </div>
        </div>
      </div>`
      )
      .join("");
  }

  function esc(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(msg) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
})();
