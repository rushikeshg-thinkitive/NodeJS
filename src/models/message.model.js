import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "file"],
      default: "text",
    },
    text: {
      type: String,
      default: "",
    },
    fileUrl: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    // Inline reply — references the quoted message (stays in main list)
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    // Thread parent — set when this message belongs to a thread
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    // True once this message has at least one thread reply.
    // Lets the frontend show a "thread exists" indicator without a count.
    hasThread: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// Matches the main message query:
//   find({ conversationId, threadId: null }).sort({ createdAt: -1 })
messageSchema.index({ conversationId: 1, threadId: 1, createdAt: -1 });
// Matches the thread query: find({ threadId }).sort({ createdAt: 1 })
messageSchema.index({ threadId: 1, createdAt: 1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;
