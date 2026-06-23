import User from "../models/user.model.js";

export const createUser = async (req, res) => {
  try {
    const { name, phoneNumber } = req.body;
    const newUser = new User({ name, phoneNumber });
    await newUser.save();
    res.status(201).json(newUser);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getUsers = async (req, res) => {
  try {
    // Only the fields the frontend needs (id is included by default).
    const users = await User.find().select("name phoneNumber");
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
