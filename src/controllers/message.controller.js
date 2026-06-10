import Message from "../models/message.model.js";

export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params; // FIX: read from params

    // Only top-level messages — thread replies are loaded separately.
    // { threadId: null } matches both null and missing (older messages).
    const messages = await Message.find({ conversationId, threadId: null })
      .populate("senderId", "name phoneNumber")
      .populate({
        path: "replyTo",
        populate: { path: "senderId", select: "name" },
      })
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/messages/:messageId/thread — replies belonging to a thread
export const getThreadMessages = async (req, res) => {
  try {
    const { messageId } = req.params;

    const messages = await Message.find({ threadId: messageId })
      .populate("senderId", "name phoneNumber")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
