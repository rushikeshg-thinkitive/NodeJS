import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    // Group name — null for one-to-one chat
    name: {
      type: String,
      default: null,
    },
    isGroup: {
      type: Boolean,
      default: false,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    // Shown on conversation list screen
    lastMessage: {
      type: String,
      default: "",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    // Unread message count per user — { userId: count }
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
    // Read cursor per user — { userId: lastReadTimestamp }. A message is "read
    // by user X" when its createdAt <= lastReadAt[X]. One write per chat-open
    // instead of touching every message (drives the ✓✓ read receipts).
    lastReadAt: {
      type: Map,
      of: Date,
      default: {},
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

// Matches the list query: find({ participants }).sort({ lastMessageAt: -1 }).
// The leading `participants` field also serves plain participant lookups.
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;
