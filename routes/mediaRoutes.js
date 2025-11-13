import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  uploadMedia,
  getUserMedia,
  getMediaById,
  deleteMedia,
  getMediaStats,
  deleteMultipleMedia,
} from "../controllers/mediaController.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directories if they don't exist
const createUploadDirs = () => {
  const dirs = ["photos", "videos", "audios"];
  dirs.forEach((dir) => {
    const dirPath = path.join(__dirname, "..", "uploads", dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
};

createUploadDirs();

// ===== Multer Configuration =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const mediaType = req.body.mediaType || "photo";
    const uploadPath = path.join(__dirname, "..", "uploads", `${mediaType}s`);
    
    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const userId = req.user?._id || "unknown";
    cb(null, `${userId}-${uniqueSuffix}${ext}`);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
  const allowedVideoTypes = ["video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo", "video/webm"];
  const allowedAudioTypes = ["audio/mpeg", "audio/wav", "audio/mp3", "audio/m4a", "audio/aac", "audio/ogg"];

  const mediaType = req.body.mediaType;

  if (mediaType === "photo" && allowedImageTypes.includes(file.mimetype)) {
    cb(null, true);
  } else if (mediaType === "video" && allowedVideoTypes.includes(file.mimetype)) {
    cb(null, true);
  } else if (mediaType === "audio" && allowedAudioTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${mediaType}. Allowed: ${
      mediaType === "photo" ? "images" : 
      mediaType === "video" ? "videos" : "audio files"
    }`), false);
  }
};

// Multer upload configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
});

// ===== Routes =====

// Upload media (POST /api/media/upload)
router.post("/upload", upload.single("file"), uploadMedia);

// Get user's media with filters (GET /api/media)
router.get("/", getUserMedia);

// Get media statistics (GET /api/media/stats)
router.get("/stats", getMediaStats);

// Get single media by ID (GET /api/media/:id)
router.get("/:id", getMediaById);

// Delete single media (DELETE /api/media/:id)
router.delete("/:id", deleteMedia);

// Delete multiple media (POST /api/media/delete-multiple)
router.post("/delete-multiple", deleteMultipleMedia);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size is too large. Maximum size is 100MB",
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  
  next();
});

export default router;