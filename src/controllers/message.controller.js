import Message from "../models/message.model.js";

export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params; // FIX: read from params

    // ── Cursor pagination (WhatsApp-style: newest first, scroll up for older) ──
    // limit  → page size (default 50)
    // before → ISO date cursor; return messages OLDER than this. Omit for newest.
    const limit = Number(req.query.limit) || 50;

    // Only top-level messages — thread replies are loaded separately.
    // { threadId: null } matches both null and missing (older messages).
    const filter = { conversationId, threadId: null };
    if (req.query.before) {
      filter.createdAt = { $lt: new Date(req.query.before) };
    }

    // Fetch the newest `limit` (descending), then reverse to ascending so the
    // frontend can render oldest → newest in the page it just received.
    const messages = await Message.find(filter)
      .populate("senderId", "name")
      .populate({
        path: "replyTo",
        populate: { path: "senderId", select: "name" },
      })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/messages/:messageId/thread — replies belonging to a thread
export const getThreadMessages = async (req, res) => {
  try {
    const { messageId } = req.params;

    const messages = await Message.find({ threadId: messageId })
      .populate("senderId", "name")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
