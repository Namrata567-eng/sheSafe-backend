import express from "express";
import {
  getAllComments,
  createComment,
  likeComment,
  addReply,
  deleteComment
} from "../controllers/commentController.js";
import { protect } from "../Middleware/authMiddleware.js";


const router = express.Router();


// Public route - get all comments
router.get("/", getAllComments);


// Protected routes - require authentication
router.post("/", protect, createComment);
router.put("/:id/like", protect, likeComment);
router.post("/:id/reply", protect, addReply);
router.delete("/:id", protect, deleteComment);


export default router;
