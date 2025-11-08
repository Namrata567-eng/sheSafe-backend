import mongoose from "mongoose";


const reportSchema = new mongoose.Schema({
  commentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Comment",
    required: true
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: [
      "spam",
      "harassment",
      "hate_speech",
      "violence",
      "inappropriate_content",
      "misinformation",
      "other"
    ]
  },
  details: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ["pending", "reviewed", "resolved", "dismissed"],
    default: "pending"
  }
}, {
  timestamps: true
});


// Index for faster queries
reportSchema.index({ commentId: 1, reportedBy: 1 });
reportSchema.index({ status: 1, createdAt: -1 });


export default mongoose.models.Report || mongoose.model("Report", reportSchema);