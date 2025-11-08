import express from "express";
import {
  createReport,
  getAllReports,
  getMyReports,
  updateReportStatus,
  deleteReport
} from "../controllers/reportController.js";
import { protect } from "../Middleware/authMiddleware.js";


const router = express.Router();


// ✅ CORRECTED ROUTES
router.post("/comments/:commentId/report", protect, createReport);
router.get("/reports", protect, getAllReports);
router.get("/reports/my", protect, getMyReports);
router.patch("/reports/:id/status", protect, updateReportStatus);
router.delete("/reports/:id", protect, deleteReport);


export default router;