require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const QRCode = require("qrcode");
const queue = require("./lib/queue");
const auth = require("./middleware/adminAuth");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- HTTP Routes ---

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.post("/admin/login", (req, res) => {
  const { password } = req.body;
  if (!password || !auth.checkPassword(password)) {
    return res.status(401).json({ error: "Invalid password" });
  }
  const token = auth.generateToken();
  res.json({ token });
});

app.get("/api/qr", async (req, res) => {
  const base =
    process.env.BASE_URL ||
    `${req.protocol}://${req.get("host")}`;
  const url = base;
  try {
    const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });
    res.json({ url, qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});

app.get("/api/event", (req, res) => {
  res.json({ name: process.env.EVENT_NAME || "Demo Queue" });
});

// --- Socket.IO ---

function broadcastState() {
  io.emit("queue-state", queue.getState());
}

io.on("connection", (socket) => {
  // Send current state to the newly connected client
  socket.emit("queue-state", queue.getState());

  socket.on("join-queue", ({ name, project }) => {
    if (!name || !name.trim()) {
      return socket.emit("join-result", {
        success: false,
        error: "Name is required",
      });
    }
    if (!project || !project.trim()) {
      return socket.emit("join-result", {
        success: false,
        error: "Project description is required",
      });
    }

    const demoer = queue.addDemoer(name, project);
    if (!demoer) {
      return socket.emit("join-result", {
        success: false,
        error: "Queue is currently paused",
      });
    }

    socket.emit("join-result", { success: true, demoer });
    broadcastState();
  });

  socket.on("admin:advance", ({ token }) => {
    if (!auth.validateToken(token)) {
      return socket.emit("admin:error", { message: "Unauthorized" });
    }
    queue.advanceQueue();
    broadcastState();
  });

  socket.on("admin:remove", ({ token, id }) => {
    if (!auth.validateToken(token)) {
      return socket.emit("admin:error", { message: "Unauthorized" });
    }
    const removed = queue.removeDemoer(id);
    if (!removed) {
      return socket.emit("admin:error", { message: "Demoer not found" });
    }
    broadcastState();
  });

  socket.on("admin:move", ({ token, id, direction }) => {
    if (!auth.validateToken(token)) {
      return socket.emit("admin:error", { message: "Unauthorized" });
    }
    queue.moveDemoer(id, direction);
    broadcastState();
  });

  socket.on("admin:reorder", ({ token, orderedIds }) => {
    if (!auth.validateToken(token)) {
      return socket.emit("admin:error", { message: "Unauthorized" });
    }
    if (!Array.isArray(orderedIds)) {
      return socket.emit("admin:error", { message: "Invalid order" });
    }
    queue.reorderQueue(orderedIds);
    broadcastState();
  });

  socket.on("admin:pause", ({ token, paused }) => {
    if (!auth.validateToken(token)) {
      return socket.emit("admin:error", { message: "Unauthorized" });
    }
    queue.setPaused(paused);
    broadcastState();
  });
});

// --- Start ---

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`InstaDemo running at http://localhost:${PORT}`);
});
