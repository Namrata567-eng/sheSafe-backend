import mongoose from "mongoose";


const commentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  likes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  replies: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    text: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // ✅ Add reported count (optional - for tracking)
  reportCount: {
    type: Number,
    default: 0
  },
  // ✅ Add reported flag (optional)
  isReported: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});


// Index for better performance
commentSchema.index({ userId: 1, createdAt: -1 });


export default mongoose.models.Comment || mongoose.model("Comment", commentSchema);
