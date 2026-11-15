import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { config } from "./config.js";
import authRoutes from "./routes/auth.js";
import meetingRoutes from "./routes/meetings.js";
import taskRoutes from "./routes/tasks.js";
import aiRoutes from "./routes/ai.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: config.clientUrl, methods: ["GET", "POST"] } });

app.use(helmet());
app.use(cors({ origin: config.clientUrl }));
app.use(express.json({ limit: "1mb" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "intellmeet-api" }));
app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/ai", aiRoutes);

io.on("connection", socket => {
  socket.on("room:join", roomId => {
    if (typeof roomId !== "string" || roomId.length > 100) return;
    socket.join(roomId);
    socket.to(roomId).emit("participant:joined", { socketId: socket.id });
  });
  socket.on("chat:message", ({ roomId, message, sender }) => {
    if (typeof roomId !== "string" || typeof message !== "string" || !message.trim()) return;
    io.to(roomId).emit("chat:message", { message: message.slice(0, 2000), sender: String(sender || "Participant").slice(0, 80), sentAt: new Date().toISOString() });
  });
  // WebRTC signaling relay. Authenticate and authorize room membership before production use.
  socket.on("webrtc:signal", ({ roomId, signal }) => {
    if (typeof roomId === "string" && signal && typeof signal === "object") socket.to(roomId).emit("webrtc:signal", { from: socket.id, signal });
  });
  socket.on("disconnect", () => {});
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: config.nodeEnv === "production" ? "Server error." : err.message });
});

await mongoose.connect(config.mongoUri);
server.listen(config.port, () => console.log(`IntellMeet API listening on ${config.port}`));
