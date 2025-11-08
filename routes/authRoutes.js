// backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();


const { protect } = require("../Middleware/authMiddleware");


// Controller functions import
const {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  updateUser,      // ✅ ye add karna hoga
  getUserById      // ✅ agar profile get karna hai to ye bhi add karo
} = require("../controllers/authController");




// Register Route
router.post("/register", registerUser);




// Login Route
router.post("/login", loginUser);


// ✅ Forgot Password Route (Public - anyone can request)
router.post("/forgot-password", forgotPassword);




// ✅ Reset Password Route (Public - uses token validation)
router.post("/reset-password/:token", resetPassword);




// ===== Protected Routes (Require Authentication) =====




// Get user by ID
router.get("/user/:id", protect, getUserById);




// Update user profile
router.put("/user/:id", protect, updateUser);




module.exports = router;
