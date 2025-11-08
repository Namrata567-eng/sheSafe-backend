const mongoose = require("mongoose");




const feedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    selectedFeature: {
      type: String,
      required: true,
    },
    feedbackMessage: {
      type: String,
      required: true,
      maxlength: 500,
    },
    email: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);




module.exports = mongoose.model("Feedback", feedbackSchema);