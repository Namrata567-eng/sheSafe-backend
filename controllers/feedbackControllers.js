const Feedback = require("../models/Feedback");
const User = require("../models/User");




// Create new feedback
const createFeedback = async (req, res) => {
  try {
    const { rating, selectedFeature, feedbackMessage, email } = req.body;




    if (!rating || !selectedFeature || !feedbackMessage || !email) {
      return res.status(400).json({
        success: false,
        message: "Rating, feature, message & email required",
      });
    }




    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be 1-5",
      });
    }




    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }




    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }




    const feedback = await Feedback.create({
      userId: user._id,
      userEmail: user.email,
      userName: user.fullName,
      rating: parseInt(rating),
      selectedFeature,
      feedbackMessage,
      email,
    });




    res.status(201).json({
      success: true,
      message: "Feedback submitted successfully",
      feedback: {
        id: feedback._id,
        userName: feedback.userName,
        userEmail: feedback.userEmail,
        rating: feedback.rating,
        selectedFeature: feedback.selectedFeature,
        feedbackMessage: feedback.feedbackMessage,
        email: feedback.email,
        createdAt: feedback.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to submit feedback",
      error: error.message,
    });
  }
};




// Get all feedbacks (Admin)
const getAllFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find()
      .populate("userId", "fullName email emergencyContact")
      .sort({ createdAt: -1 })
      .select("-__v");




    res
      .status(200)
      .json({ success: true, count: feedbacks.length, feedbacks });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch feedbacks",
      error: error.message,
    });
  }
};




// Get feedbacks of current user
const getMyFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select("-__v");
    res
      .status(200)
      .json({ success: true, count: feedbacks.length, feedbacks });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch your feedbacks",
      error: error.message,
    });
  }
};




// Delete feedback
const deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const feedback = await Feedback.findById(id);




    if (!feedback) {
      return res
        .status(404)
        .json({ success: false, message: "Feedback not found" });
    }
    if (feedback.userId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "You can only delete your own feedback" });
    }
    await Feedback.findByIdAndDelete(id);
    res
      .status(200)
      .json({ success: true, message: "Feedback deleted successfully" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete feedback",
      error: error.message,
    });
  }
};




// Update feedback
const updateFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, selectedFeature, feedbackMessage, email } = req.body;
    const feedback = await Feedback.findById(id);




    if (!feedback) {
      return res
        .status(404)
        .json({ success: false, message: "Feedback not found" });
    }
    if (feedback.userId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "You can only update your own feedback" });
    }
    if (rating) {
      if (rating < 1 || rating > 5) {
        return res
          .status(400)
          .json({ success: false, message: "Rating must be 1-5" });
      }
      feedback.rating = rating;
    }
    if (selectedFeature) feedback.selectedFeature = selectedFeature;
    if (feedbackMessage) feedback.feedbackMessage = feedbackMessage;
    if (email) feedback.email = email;




    const updatedFeedback = await feedback.save();
    res.status(200).json({
      success: true,
      message: "Feedback updated successfully",
      feedback: updatedFeedback,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update feedback",
      error: error.message,
    });
  }
};




module.exports = {
  createFeedback,
  getAllFeedbacks,
  getMyFeedbacks,
  deleteFeedback,
  updateFeedback,
};
