import Message from "../models/message.model.js";

export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params; // FIX: read from params

    const messages = await Message.find({ conversationId })
      .populate("senderId", "name phoneNumber")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
