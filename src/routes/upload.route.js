import { Router } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Store in memory instead of disk
const upload = multer({ storage: multer.memoryStorage() });

const uploadRouter = Router();

uploadRouter.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "chat-app",
          resource_type: "auto",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );

      Readable.from(req.file.buffer).pipe(uploadStream);
    });

    // Fix URL for non-image files (pdf, doc etc)
    // Cloudinary returns /image/upload/ even for raw files — replace it
    let url = result.secure_url;
    if (result.resource_type === "raw") {
      url = url.replace("/image/upload/", "/raw/upload/");
    }

    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default uploadRouter;
