const state = {
  queue: [],
  paused: false,
  nextId: 1,
  demoStartedAt: null,
  demoCap: null, // null = unlimited, number = max demoers allowed in session
};

function getState() {
  const current = getCurrentDemoer();
  return {
    queue: state.queue.filter((d) => d.status !== "done"),
    paused: state.paused,
    demoCap: state.demoCap,
    totalDemoers: state.queue.length,
    currentDemoer: current
      ? { ...current, demoStartedAt: state.demoStartedAt }
      : null,
  };
}

function addDemoer(name, project) {
  if (state.paused) return null;
  if (state.demoCap !== null && state.queue.length >= state.demoCap) {
    return { capReached: true };
  }

  const demoer = {
    id: state.nextId++,
    name: name.trim().slice(0, 50),
    project: project.trim().slice(0, 140),
    joinedAt: new Date().toISOString(),
    status: "waiting",
  };

  state.queue.push(demoer);
  return demoer;
}

function getCurrentDemoer() {
  return state.queue.find((d) => d.status === "demoing") || null;
}

function advanceQueue() {
  const current = getCurrentDemoer();
  if (current) {
    current.status = "done";
    state.demoStartedAt = null;
  }

  const next = state.queue.find((d) => d.status === "waiting");
  if (next) {
    next.status = "demoing";
    state.demoStartedAt = new Date().toISOString();
    return next;
  }
  return null;
}

function removeDemoer(id) {
  const idx = state.queue.findIndex((d) => d.id === id);
  if (idx === -1) return false;

  const wasDemoing = state.queue[idx].status === "demoing";
  state.queue.splice(idx, 1);

  if (wasDemoing) {
    state.demoStartedAt = null;
  }
  return true;
}

function moveDemoer(id, direction) {
  const waiting = state.queue.filter((d) => d.status === "waiting");
  const wIdx = waiting.findIndex((d) => d.id === id);
  if (wIdx === -1) return false;

  const swapIdx = direction === "up" ? wIdx - 1 : wIdx + 1;
  if (swapIdx < 0 || swapIdx >= waiting.length) return false;

  // Find their actual indices in the full queue
  const aIdx = state.queue.indexOf(waiting[wIdx]);
  const bIdx = state.queue.indexOf(waiting[swapIdx]);

  [state.queue[aIdx], state.queue[bIdx]] = [state.queue[bIdx], state.queue[aIdx]];
  return true;
}

function reorderQueue(orderedIds) {
  // Build a map of id -> demoer for waiting entries
  const waitingMap = new Map();
  state.queue.forEach((d) => {
    if (d.status === "waiting") waitingMap.set(d.id, d);
  });

  // Rebuild queue: non-waiting first (demoing), then waiting in the new order
  const nonWaiting = state.queue.filter((d) => d.status !== "waiting");
  const reordered = orderedIds
    .filter((id) => waitingMap.has(id))
    .map((id) => waitingMap.get(id));

  // Append any waiting demoers not in orderedIds (shouldn't happen, but safe)
  waitingMap.forEach((d, id) => {
    if (!orderedIds.includes(id)) reordered.push(d);
  });

  state.queue = [...nonWaiting, ...reordered];
}

function setPaused(paused) {
  state.paused = !!paused;
}

function setDemoCap(cap) {
  if (cap === null || cap === 0) {
    state.demoCap = null;
  } else {
    const n = Math.max(1, Math.floor(Number(cap)));
    state.demoCap = isNaN(n) ? null : n;
  }
}

module.exports = {
  getState,
  addDemoer,
  advanceQueue,
  removeDemoer,
  moveDemoer,
  reorderQueue,
  setPaused,
  setDemoCap,
  getCurrentDemoer,
};
