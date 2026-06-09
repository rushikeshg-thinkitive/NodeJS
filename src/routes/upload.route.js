import { Router } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// Configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Store directly to Cloudinary instead of local disk
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "chat-app",
    resource_type: "auto", // ← add this line
    allowed_formats: ["jpg", "jpeg", "png", "gif", "pdf", "doc", "docx"],
  },
});

const upload = multer({ storage });

const uploadRouter = Router();

// POST /api/upload  →  returns { url: "https://cloudinary.com/..." }
uploadRouter.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  res.json({ url: req.file.path });
});

export default uploadRouter;
