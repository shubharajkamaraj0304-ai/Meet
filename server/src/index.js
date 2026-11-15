
import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";

import { config } from "./config.js";
import User from "./models/User.js";
import Meeting from "./models/Meeting.js";

import authRoutes from "./routes/auth.js";
import meetingRoutes from "./routes/meetings.js";
import taskRoutes from "./routes/tasks.js";
import aiRoutes from "./routes/ai.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  path: "/api/socket.io",
  transports: ["websocket"],
  cors: {
    origin: config.clientUrl,
    methods: ["GET", "POST"]
  }
});

app.use(helmet());
app.use(cors({ origin: config.clientUrl }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "intellmeet-api"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/ai", aiRoutes);

// Authenticate every Socket.IO connection.
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required."));
    }

    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.sub);

    if (!user) {
      return next(new Error("User not found."));
    }

    socket.data.user = {
      id: user._id.toString(),
      name: user.name
    };

    next();
  } catch {
    next(new Error("Invalid or expired token."));
  }
});

io.on("connection", socket => {
  console.log("Authenticated socket connected:", socket.id);

  // Join only meetings the authenticated user belongs to.
  socket.on("room:join", async (roomId, callback) => {
    try {
      if (
        typeof roomId !== "string" ||
        roomId.length > 100
      ) {
        throw new Error("Invalid meeting room.");
      }

      const meeting = await Meeting.findOne({
        roomId,
        $or: [
          { host: socket.data.user.id },
          { participants: socket.data.user.id }
        ]
      });

      if (!meeting) {
        throw new Error("You are not authorized to join this room.");
      }

      if (socket.data.roomId) {
        const previousRoom = socket.data.roomId;
        socket.leave(previousRoom);

        socket.to(previousRoom).emit("participant:left", {
          socketId: socket.id
        });
      }

      const existingPeers = [
        ...(io.sockets.adapter.rooms.get(roomId) || [])
      ].filter(id => id !== socket.id).map(id => ({
        socketId: id
      }));

      socket.join(roomId);
      socket.data.roomId = roomId;

      socket.emit("room:peers", existingPeers);

      socket.to(roomId).emit("participant:joined", {
        socketId: socket.id,
        name: socket.data.user.name
      });

      if (typeof callback === "function") {
        callback({
          success: true,
          peers: existingPeers
        });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({
          success: false,
          message: error.message
        });
      }
    }
  });

  // Real-time chat restricted to the joined room.
  socket.on("chat:message", ({ roomId, message }) => {
    if (
      roomId !== socket.data.roomId ||
      typeof message !== "string" ||
      !message.trim()
    ) return;

    io.to(roomId).emit("chat:message", {
      message: message.trim().slice(0, 2000),
      sender: socket.data.user.name,
      sentAt: new Date().toISOString()
    });
  });

  // WebRTC offer, answer and ICE candidate relay.
  socket.on("webrtc:signal", ({ roomId, to, signal }) => {
    if (
      roomId !== socket.data.roomId ||
      typeof to !== "string" ||
      !signal ||
      typeof signal !== "object"
    ) return;

    const target = io.sockets.sockets.get(to);

    if (!target || target.data.roomId !== roomId) {
      return;
    }

    io.to(to).emit("webrtc:signal", {
      from: socket.id,
      signal
    });
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;

    if (roomId) {
      socket.to(roomId).emit("participant:left", {
        socketId: socket.id
      });
    }

    console.log("Socket disconnected:", socket.id);
  });
});

// Error handling.
app.use((err, _req, res, _next) => {
  console.error(err);

  res.status(err.status || 500).json({
    message:
      config.nodeEnv === "production"
        ? "Server error."
        : err.message
  });
});

// Connect to MongoDB.
await mongoose.connect(config.mongoUri);

// Export the HTTP server for deployment.
export default server;

// Start the server only when running locally.
if (process.env.VERCEL !== "1") {
  server.listen(config.port, () => {
    console.log(`IntellMeet API listening on ${config.port}`);
  });
}
