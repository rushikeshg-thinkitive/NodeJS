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

    const conversations = await Conversation.find({ participants: userId })
      .populate("participants", "name phoneNumber")
      .sort({ lastMessageAt: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
