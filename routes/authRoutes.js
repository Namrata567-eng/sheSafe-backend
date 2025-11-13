import express from "express";
import { protect } from "../server.js";
import { 
  registerUser, 
  loginUser, 
  forgotPassword,
  resetPassword,
  updateUser,
  getUserById
} from "../controllers/authController.js";  // ✅ Correct path

const router = express.Router();

// Public routes
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// Protected routes
router.get("/auth/user/:id", protect, getUserById);
router.put("/auth/update/:id", protect, updateUser);

export default router;