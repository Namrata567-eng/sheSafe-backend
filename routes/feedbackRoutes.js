const express = require("express");
const {
  createFeedback,
  getAllFeedbacks,
  getMyFeedbacks,
  deleteFeedback,
  updateFeedback,
} = require("../controllers/feedbackControllers");
const { protect } = require("../Middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, createFeedback);        // Submit feedback
router.get("/", getAllFeedbacks);                 // Get all feedbacks
router.get("/my", protect, getMyFeedbacks);       // Get own feedbacks
router.put("/:id", protect, updateFeedback);      // Update feedback
router.delete("/:id", protect, deleteFeedback);   // Delete feedback




module.exports = router;






