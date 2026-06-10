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
    // Client emits: { conversationId, senderId, type, text?, fileUrl?,
    //                 fileName?, replyTo? }
    // Server: saves message, updates conversation, broadcasts to room
    socket.on("sendMessage", async (data) => {
      try {
        const {
          conversationId,
          senderId,
          type,
          text,
          fileUrl,
          fileName,
          replyTo, // _id of message being replied to (optional)
        } = data;

        // Save message — sender has implicitly read their own message
        const message = await Message.create({
          conversationId,
          senderId,
          type,
          text,
          fileUrl,
          fileName,
          replyTo: replyTo || null,
          readBy: [senderId],
        });

        // Update conversation last message + bump unread for everyone else
        const preview = type === "text" ? text : `[${type}]`;
        const conversation = await Conversation.findById(conversationId);
        if (conversation) {
          conversation.lastMessage = preview;
          conversation.lastMessageAt = new Date();

          conversation.participants.forEach((participantId) => {
            if (participantId.toString() !== senderId.toString()) {
              const current =
                conversation.unreadCounts.get(participantId.toString()) || 0;
              conversation.unreadCounts.set(
                participantId.toString(),
                current + 1,
              );
            }
          });

          await conversation.save();

          // Update conversation list for all participants
          conversation.participants.forEach((userId) => {
            io.to(`user:${userId}`).emit("conversationUpdated", conversation);
          });
        }

        // Populate sender + replied-to message before broadcasting
        await message.populate("senderId", "name phoneNumber");
        await message.populate({
          path: "replyTo",
          populate: { path: "senderId", select: "name" },
        });

        // Broadcast to everyone in the conversation room
        io.to(conversationId).emit("newMessage", message);
      } catch (error) {
        socket.emit("error", { message: error.message });
      }
    });

    // ─── 6. Mark conversation as read ───────────────────────────────
    // Client emits: { conversationId, userId }
    // Resets unread count + marks all messages read for this user
    socket.on("markAsRead", async ({ conversationId, userId }) => {
      try {
        // Reset this user's unread count
        const conversation = await Conversation.findById(conversationId);
        if (conversation) {
          conversation.unreadCounts.set(userId.toString(), 0);
          await conversation.save();
          io.to(`user:${userId}`).emit("conversationUpdated", conversation);
        }

        // Add userId to readBy for every message they hadn't read yet
        await Message.updateMany(
          { conversationId, readBy: { $nin: [userId] } },
          { $addToSet: { readBy: userId } },
        );

        // Notify the room so others can update tick status
        io.to(conversationId).emit("messagesRead", { conversationId, userId });
      } catch (error) {
        socket.emit("error", { message: error.message });
      }
    });

    // ─── 7. Join / leave a thread room ──────────────────────────────
    // Client emits: { messageId }  (the parent message _id)
    socket.on("joinThread", ({ messageId }) => {
      socket.join(`thread:${messageId}`);
    });

    socket.on("leaveThread", ({ messageId }) => {
      socket.leave(`thread:${messageId}`);
    });

    // ─── 8. Send thread message ─────────────────────────────────────
    // Client emits: { threadId, conversationId, senderId, type, text?,
    //                 fileUrl?, fileName? }   threadId = parent message _id
    socket.on("sendThreadMessage", async (data) => {
      try {
        const {
          threadId,
          conversationId,
          senderId,
          type,
          text,
          fileUrl,
          fileName,
        } = data;

        const message = await Message.create({
          conversationId,
          senderId,
          type,
          text,
          fileUrl,
          fileName,
          threadId, // links this reply to the parent message
          readBy: [senderId],
        });

        await message.populate("senderId", "name phoneNumber");

        // Broadcast to everyone viewing this thread
        io.to(`thread:${threadId}`).emit("newThreadMessage", message);
      } catch (error) {
        socket.emit("error", { message: error.message });
      }
    });

    // ─── 9. Disconnect ──────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  return io;
}

export { io };
