import Media from "../models/Media.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== Upload Media =====
export const uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const { mediaType, duration, latitude, longitude, address, deviceInfo, emergency } = req.body;

    // Get file details
    const fileName = req.file.filename;
    const filePath = req.file.path;
    const fileSize = req.file.size;
    const mimeType = req.file.mimetype;

    // Construct file URL using public URL
    const baseUrl = process.env.PUBLIC_URL || `http://${process.env.SERVER_IP || "localhost"}:${process.env.PORT || 5000}`;
    const fileUrl = `${baseUrl}/uploads/${mediaType}s/${fileName}`;

    // Create media document
    const media = await Media.create({
      userId: req.user._id,
      mediaType,
      fileName,
      filePath,
      fileUrl,
      fileSize,
      mimeType,
      duration: duration ? parseFloat(duration) : null,
      location: {
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        address: address || null,
      },
      metadata: {
        deviceInfo: deviceInfo || null,
        capturedAt: new Date(),
        emergency: emergency === "true" || emergency === true,
      },
    });

    res.status(201).json({
      success: true,
      message: `${mediaType} uploaded successfully`,
      media: {
        _id: media._id,
        mediaType: media.mediaType,
        fileUrl: media.fileUrl,
        fileName: media.fileName,
        fileSize: media.fileSize,
        duration: media.duration,
        location: media.location,
        createdAt: media.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Upload media error:", error);
    
    // Delete uploaded file if database save fails
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error("Failed to delete file after error:", unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to upload media",
      error: error.message,
    });
  }
};

// ===== Get User's Media (Only their own) =====
export const getUserMedia = async (req, res) => {
  try {
    const { mediaType, page = 1, limit = 20 } = req.query;

    const query = {
      userId: req.user._id, // Only fetch current user's media
      isDeleted: false,
    };

    if (mediaType && ["photo", "video", "audio"].includes(mediaType)) {
      query.mediaType = mediaType;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const mediaList = await Media.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("-filePath"); // Don't send file path for security

    const total = await Media.countDocuments(query);

    res.status(200).json({
      success: true,
      count: mediaList.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      media: mediaList,
    });
  } catch (error) {
    console.error("❌ Get user media error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch media",
      error: error.message,
    });
  }
};

// ===== Get Single Media by ID =====
export const getMediaById = async (req, res) => {
  try {
    const media = await Media.findOne({
      _id: req.params.id,
      userId: req.user._id, // Ensure user can only access their own media
      isDeleted: false,
    });

    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Media not found or you don't have permission to access it",
      });
    }

    res.status(200).json({
      success: true,
      media,
    });
  } catch (error) {
    console.error("❌ Get media by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch media",
      error: error.message,
    });
  }
};

// ===== Delete Media =====
export const deleteMedia = async (req, res) => {
  try {
    const media = await Media.findOne({
      _id: req.params.id,
      userId: req.user._id, // Ensure user can only delete their own media
    });

    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Media not found or you don't have permission to delete it",
      });
    }

    // Soft delete (mark as deleted)
    media.isDeleted = true;
    await media.save();

    // Optional: Delete physical file (uncomment if you want hard delete)
    /*
    try {
      if (fs.existsSync(media.filePath)) {
        fs.unlinkSync(media.filePath);
      }
      await Media.findByIdAndDelete(req.params.id);
    } catch (fileError) {
      console.error("File deletion error:", fileError);
    }
    */

    res.status(200).json({
      success: true,
      message: "Media deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete media error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete media",
      error: error.message,
    });
  }
};

// ===== Get Media Statistics =====
export const getMediaStats = async (req, res) => {
  try {
    const stats = await Media.aggregate([
      {
        $match: {
          userId: req.user._id,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: "$mediaType",
          count: { $sum: 1 },
          totalSize: { $sum: "$fileSize" },
        },
      },
    ]);

    const formattedStats = {
      photo: { count: 0, totalSize: 0 },
      video: { count: 0, totalSize: 0 },
      audio: { count: 0, totalSize: 0 },
    };

    stats.forEach((stat) => {
      formattedStats[stat._id] = {
        count: stat.count,
        totalSize: stat.totalSize,
        totalSizeMB: (stat.totalSize / (1024 * 1024)).toFixed(2),
      };
    });

    res.status(200).json({
      success: true,
      stats: formattedStats,
    });
  } catch (error) {
    console.error("❌ Get media stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch media statistics",
      error: error.message,
    });
  }
};

// ===== Delete Multiple Media =====
export const deleteMultipleMedia = async (req, res) => {
  try {
    const { mediaIds } = req.body;

    if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of media IDs",
      });
    }

    const result = await Media.updateMany(
      {
        _id: { $in: mediaIds },
        userId: req.user._id, // Ensure user can only delete their own media
      },
      {
        $set: { isDeleted: true },
      }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} media items deleted successfully`,
      deletedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("❌ Delete multiple media error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete media",
      error: error.message,
    });
  }
};