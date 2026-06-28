import Conversation from "../models/conversation.model.js";

export const createConversation = async (req, res) => {
  try {
    const { name, isGroup, participants, createdBy } = req.body;

    // Prevent duplicate one-to-one conversations
    if (!isGroup && participants.length === 2) {
      const existing = await Conversation.findOne({
        isGroup: false,
        participants: { $all: participants },
      });

      if (existing) {
        return res.json(existing);
      }
    }

    const conversation = await Conversation.create({
      name,
      isGroup,
      participants,
      createdBy,
    });

    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getConversations = async (req, res) => {
  try {
    const { userId } = req.params; // FIX: read from params (route must have :userId)

    // ── Cursor pagination (newest on top, scroll down for older) ──
    // limit  → page size (default 20)
    // before → ISO date cursor; return conversations OLDER than this.
    const limit = Number(req.query.limit) || 20;

    const filter = { participants: userId };
    if (req.query.before) {
      filter.lastMessageAt = { $lt: new Date(req.query.before) };
    }

    const conversations = await Conversation.find(filter)
      .populate("participants", "name")
      .sort({ lastMessageAt: -1 })
      .limit(limit);

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
