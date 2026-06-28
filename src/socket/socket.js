import { Server } from "socket.io";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";

let io;

// Is this user one of the conversation's participants? (works on raw ObjectIds)
const isParticipant = (conversation, userId) =>
  conversation.participants.some((p) => p.toString() === userId?.toString());

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
      socket.data.userId = userId; // remember who this socket is (used for membership checks)
      socket.join(`user:${userId}`);
      console.log(`User ${userId} joined their room`);
    });

    // ─── 2. Create conversation ─────────────────────────────────────
    // Client emits: { name, isGroup, participants, createdBy }
    // Server: creates conversation in DB, notifies all participants
    socket.on("createConversation", async (data) => {
      try {
        const { name, isGroup, participants, createdBy } = data;

        // Reuse an existing one-to-one if it already exists, else create.
        let conversation = null;
        if (!isGroup && participants.length === 2) {
          conversation = await Conversation.findOne({
            isGroup: false,
            participants: { $all: participants },
          });
        }
        if (!conversation) {
          conversation = await Conversation.create({
            name,
            isGroup,
            participants,
            createdBy,
          });
        }

        // Send the SAME populated shape the REST API returns, so the frontend
        // never has to resolve participant names itself.
        await conversation.populate("participants", "name");

        // Notify every participant's personal room (works for new + existing).
        participants.forEach((userId) => {
          io.to(`user:${userId}`).emit("conversationCreated", conversation);
        });
      } catch (error) {
        socket.emit("error", { message: error.message });
      }
    });

    // ─── 3. Join a conversation room ────────────────────────────────
    // Client emits: { conversationId }
    // Server: only lets a user into a conversation they actually belong to,
    // then adds the socket to that room so it receives new messages.
    socket.on("joinConversation", async ({ conversationId }) => {
      try {
        const conversation =
          await Conversation.findById(conversationId).select("participants");
        if (!conversation || !isParticipant(conversation, socket.data.userId)) {
          socket.emit("error", {
            message: "Not a participant of this conversation",
          });
          return;
        }
        socket.join(conversationId);
        console.log(
          `Socket ${socket.id} joined conversation ${conversationId}`,
        );
      } catch (error) {
        socket.emit("error", { message: error.message });
      }
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

        // Validate FIRST — make sure the conversation exists and the sender
        // belongs to it BEFORE writing anything (prevents orphan messages and
        // sending into a conversation you're not part of).
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !isParticipant(conversation, senderId)) {
          socket.emit("error", { message: "Cannot send to this conversation" });
          return;
        }

        // Save message. (Read state is tracked per-user on the conversation
        // via lastReadAt, so messages no longer carry a readBy array.)
        const message = await Message.create({
          conversationId,
          senderId,
          type,
          text,
          fileUrl,
          fileName,
          replyTo: replyTo || null,
        });

        // Update conversation last message + bump unread for everyone else
        conversation.lastMessage = type === "text" ? text : `[${type}]`;
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

        // Populate participants so the emitted shape matches the REST API.
        // (Done AFTER the unread loop above, which needs raw ObjectIds.)
        await conversation.populate("participants", "name");

        // Update conversation list for all participants.
        conversation.participants.forEach((p) => {
          io.to(`user:${p._id}`).emit("conversationUpdated", conversation);
        });

        // Populate sender + replied-to message before broadcasting
        await message.populate("senderId", "name");
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
    // Advances this user's read cursor (one write) + resets their unread count.
    socket.on("markAsRead", async ({ conversationId, userId }) => {
      try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;

        const readAt = new Date();
        conversation.lastReadAt.set(userId.toString(), readAt);
        conversation.unreadCounts.set(userId.toString(), 0);
        await conversation.save();

        // Same populated shape as the REST API / other emits.
        await conversation.populate("participants", "name");
        io.to(`user:${userId}`).emit("conversationUpdated", conversation);

        // Notify the room so senders can flip their ✓ to ✓✓. The timestamp
        // lets clients mark every message up to `readAt` as read.
        io.to(conversationId).emit("messagesRead", {
          conversationId,
          userId,
          readAt,
        });
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

        // Same guard as sendMessage: the conversation must exist and the sender
        // must belong to it before we write a reply (no orphan / spoofed replies).
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !isParticipant(conversation, senderId)) {
          socket.emit("error", { message: "Cannot send to this conversation" });
          return;
        }

        const message = await Message.create({
          conversationId,
          senderId,
          type,
          text,
          fileUrl,
          fileName,
          threadId, // links this reply to the parent message
        });

        await message.populate("senderId", "name");

        // Broadcast to everyone viewing this thread
        io.to(`thread:${threadId}`).emit("newThreadMessage", message);

        // Mark the parent so the main chat can show a "thread exists" indicator,
        // and notify the conversation room so it appears live (no refresh).
        await Message.findByIdAndUpdate(threadId, { hasThread: true });
        io.to(conversationId).emit("threadUpdated", { messageId: threadId });
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
