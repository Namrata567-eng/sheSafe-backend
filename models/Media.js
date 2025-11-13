import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Index for faster queries
    },
    mediaType: {
      type: String,
      enum: ["photo", "video", "audio"],
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number, // Size in bytes
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    duration: {
      type: Number, // For video/audio in seconds
      default: null,
    },
    thumbnail: {
      type: String, // For video thumbnails
      default: null,
    },
    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      address: { type: String, default: null },
    },
    metadata: {
      deviceInfo: { type: String },
      capturedAt: { type: Date, default: Date.now },
      emergency: { type: Boolean, default: false }, // If captured during SOS
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
mediaSchema.index({ userId: 1, createdAt: -1 });
mediaSchema.index({ userId: 1, mediaType: 1 });

const Media = mongoose.model("Media", mediaSchema);

export default Media;