import mongoose from "mongoose";

const friendSchema = new mongoose.Schema(
  {
    // ✅ User who sent the request
    senderId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true 
    },
    senderEmail: { 
      type: String, 
      required: true,
      index: true 
    },
    senderName: { 
      type: String, 
      required: true 
    },

    // ✅ User who receives the request
    receiverId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true 
    },
    receiverEmail: { 
      type: String, 
      required: true,
      index: true 
    },
    receiverName: { 
      type: String, 
      required: true 
    },

    // ✅ Friend request status
    status: { 
      type: String, 
      enum: ["pending", "accepted", "rejected"], 
      default: "pending",
      index: true 
    },

    // ✅ Additional contact info (for accepted friends)
    phone: { type: String },
    city: { type: String, default: "Mumbai" },
    isSOSContact: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ✅ Compound indexes for faster queries
friendSchema.index({ senderId: 1, receiverId: 1 });
friendSchema.index({ senderEmail: 1, receiverEmail: 1 });
friendSchema.index({ status: 1, createdAt: -1 });

// ✅ Prevent duplicate friend requests
friendSchema.index(
  { senderId: 1, receiverId: 1 }, 
  { unique: true }
);

export default mongoose.model("Friend", friendSchema);


