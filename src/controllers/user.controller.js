import User from "../models/user.model.js";

export const createUser = async (req, res) => {
  try {
    const { name, phoneNumber } = req.body;

    // One account per phone. (phoneNumber is also `unique` in the model — the
    // E11000 catch below covers the race where two creates land at once.)
    const existing = await User.findOne({ phoneNumber });
    if (existing) {
      return res.status(409).json({
        message: "Phone number already registered — pick your name and log in.",
      });
    }

    const newUser = new User({ name, phoneNumber });
    await newUser.save();
    res.status(201).json(newUser);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Phone number already registered — pick your name and log in.",
      });
    }
    res.status(400).json({ error: error.message });
  }
};

// Lightweight login: the phone number is the secret. The client picks a name
// (we have their _id) and types the phone; we only let them in if it matches.
export const loginUser = async (req, res) => {
  try {
    const { userId, phoneNumber } = req.body;

    const user = await User.findById(userId);
    if (!user || user.phoneNumber !== (phoneNumber || "").trim()) {
      return res.status(401).json({ message: "Incorrect phone number." });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUsers = async (req, res) => {
  try {
    // Names only (id is included by default). The phone number is a secret
    // used for login, so it is never sent to the client.
    const users = await User.find().select("name");
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
