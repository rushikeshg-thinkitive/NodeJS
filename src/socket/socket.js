import { Server } from "socket.io";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";

let io;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      // origin: "*", // In production: replace with your frontend URL
      origin: [
        "https://nodejs-production-d170.up.railway.app",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://192.168.1.11:5173",
        "http://192.168.1.11:5174",
      ],
    },
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // ─── 1. Register user ───────────────────────────────────────────
    // Client emits: { userId }
    // Server: joins the user's personal room so we can send them notifications
    socket.on("registerUser", ({ userId }) => {
      socket.join(`user:${userId}`);
      console.log(`User ${userId} joined their room`);
    });

    // ─── 2. Create conversation ─────────────────────────────────────
    // Client emits: { name, isGroup, participants, createdBy }
    // Server: creates conversation in DB, notifies all participants
    socket.on("createConversation", async (data) => {
      try {
        const { name, isGroup, participants, createdBy } = data;

        // Prevent duplicate one-to-one
        if (!isGroup && participants.length === 2) {
          const existing = await Conversation.findOne({
            isGroup: false,
            participants: { $all: participants },
          });
          if (existing) {
            socket.emit("conversationCreated", existing);
            return;
          }
        }

        const conversation = await Conversation.create({
          name,
          isGroup,
          participants,
          createdBy,
        });

        // Notify every participant's personal room
        participants.forEach((userId) => {
          io.to(`user:${userId}`).emit("conversationCreated", conversation);
        });
      } catch (error) {
        socket.emit("error", { message: error.message });
      }
    });

    // ─── 3. Join a conversation room ────────────────────────────────
    // Client emits: { conversationId }
    // Server: adds socket to that room so it receives new messages
    socket.on("joinConversation", ({ conversationId }) => {
      socket.join(conversationId);
      console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
    });

    // ─── 4. Leave a conversation room ──────────────────────────────
    // Client emits: { conversationId }
    // Call this before joining a new conversation
    socket.on("leaveConversation", ({ conversationId }) => {
      socket.leave(conversationId);
      console.log(`Socket ${socket.id} left conversation ${conversationId}`);
    });

    // ─── 5. Send message ────────────────────────────────────────────
    // Client emits: { conversationId, senderId, type, text?, fileUrl?, fileName? }
    // Server: saves message, updates conversation, broadcasts to room
    socket.on("sendMessage", async (data) => {
      try {
        const { conversationId, senderId, type, text, fileUrl, fileName } =
          data;

        // Save message
        const message = await Message.create({
          conversationId,
          senderId,
          type,
          text,
          fileUrl,
          fileName,
        });

        // Update conversation's last message + timestamp
        const preview = type === "text" ? text : `[${type}]`;
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: preview,
          lastMessageAt: new Date(),
        });

        // Populate sender info before broadcasting
        await message.populate("senderId", "name phoneNumber");

        // Broadcast to everyone in the conversation room
        io.to(conversationId).emit("newMessage", message);

        // Also update conversation list for all participants
        const conversation = await Conversation.findById(conversationId);
        if (conversation) {
          conversation.participants.forEach((userId) => {
            io.to(`user:${userId}`).emit("conversationUpdated", conversation);
          });
        }
      } catch (error) {
        socket.emit("error", { message: error.message });
      }
    });

    // ─── 6. Disconnect ──────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  return io;
}

export { io };
