import Report from "../models/Report.js";
import Comment from "../models/Comment.js";
import Notification from "../models/notification.model.js"; // ✅ IMPORT ADDED

// Create a new report
export const createReport = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { reason, details } = req.body;

    // Validation
    if (!reason || !details) {
      const msg = "Reason and details are required";
      console.log("Report submission failed:", msg);
      return res.status(400).json({ success: false, msg });
    }

    if (!details.trim() || details.trim().length < 10) {
      const msg = "Please provide detailed information (minimum 10 characters)";
      console.log("Report submission failed:", msg);
      return res.status(400).json({ success: false, msg });
    }

    // Check if comment exists
    const comment = await Comment.findById(commentId).populate("userId", "fullName");
    if (!comment) {
      const msg = "Comment not found";
      console.log("Report submission failed:", msg);
      return res.status(404).json({ success: false, msg });
    }

    // Check if user already reported this comment
    const existingReport = await Report.findOne({
      commentId,
      reportedBy: req.user._id
    });

    if (existingReport) {
      const msg = "You have already reported this comment";
      console.log("Report submission failed:", msg);
      return res.status(400).json({ success: false, msg });
    }

    // Create report
    const report = await Report.create({
      commentId,
      reportedBy: req.user._id,
      reason,
      details: details.trim()
    });

    const populatedReport = await Report.findById(report._id)
      .populate("reportedBy", "fullName email")
      .populate("commentId");

    // ✅ CREATE NOTIFICATION FOR COMMENT OWNER (Someone reported their comment)
    if (comment.userId && comment.userId._id.toString() !== req.user._id.toString()) {
      try {
        await Notification.create({
          userId: comment.userId._id, // Send to comment owner
          title: '⚠️ Your Comment Was Reported',
          message: `Your comment has been reported for: ${reason}. Our team will review it.`,
          type: 'report',
          icon: '⚠️',
          read: false,
          data: {
            commentId: commentId,
            reportId: report._id,
            reason: reason
          }
        });
        
        console.log(`🔔 Report notification sent to comment owner ${comment.userId._id}`);
      } catch (notifError) {
        console.error("❌ Report notification failed:", notifError.message);
      }
    }

    // ✅ CREATE CONFIRMATION NOTIFICATION FOR REPORTER
    try {
      await Notification.create({
        userId: req.user._id, // Send to reporter
        title: '✅ Report Submitted',
        message: `Your report has been submitted successfully. We'll review the comment and take appropriate action.`,
        type: 'report',
        icon: '✅',
        read: false,
        data: {
          commentId: commentId,
          reportId: report._id,
          reason: reason
        }
      });
      
      console.log(`🔔 Confirmation notification sent to reporter ${req.user._id}`);
    } catch (notifError) {
      console.error("❌ Confirmation notification failed:", notifError.message);
    }

    const successMsg = "Report submitted successfully. We'll review it soon.";
    console.log("Report submission success:", successMsg);

    res.status(201).json({
      success: true,
      msg: successMsg,
      data: populatedReport
    });
  } catch (error) {
    console.error("❌ Create Report Error:", error.message);
    res.status(500).json({
      success: false,
      msg: "Failed to submit report",
      error: error.message
    });
  }
};

// Get all reports (Admin only - you can add admin middleware)
export const getAllReports = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};

    const reports = await Report.find(filter)
      .populate("reportedBy", "fullName email profilePic")
      .populate({
        path: "commentId",
        populate: {
          path: "userId",
          select: "fullName email"
        }
      })
      .sort({ createdAt: -1 });

    console.log(`Fetched all reports. Count: ${reports.length}`);

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    console.error("❌ Get Reports Error:", error.message);
    res.status(500).json({
      success: false,
      msg: "Failed to fetch reports",
      error: error.message
    });
  }
};

// Get reports by user (My reports)
export const getMyReports = async (req, res) => {
  try {
    const reports = await Report.find({ reportedBy: req.user._id })
      .populate({
        path: "commentId",
        populate: {
          path: "userId",
          select: "fullName email"
        }
      })
      .sort({ createdAt: -1 });

    console.log(`Fetched reports for user ${req.user._id}. Count: ${reports.length}`);

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    console.error("❌ Get My Reports Error:", error.message);
    res.status(500).json({
      success: false,
      msg: "Failed to fetch your reports",
      error: error.message
    });
  }
};

// Update report status (Admin only)
export const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["pending", "reviewed", "resolved", "dismissed"];
    if (!validStatuses.includes(status)) {
      const msg = "Invalid status";
      console.log("Update report status failed:", msg);
      return res.status(400).json({ success: false, msg });
    }

    const report = await Report.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    )
      .populate("reportedBy", "fullName email")
      .populate({
        path: "commentId",
        populate: {
          path: "userId",
          select: "fullName email"
        }
      });

    if (!report) {
      const msg = "Report not found";
      console.log("Update report status failed:", msg);
      return res.status(404).json({ success: false, msg });
    }

    console.log(`Report status updated. Report ID: ${id}, New status: ${status}`);

    // ✅ NOTIFY REPORTER ABOUT STATUS CHANGE
    try {
      let notificationMessage = '';
      let notificationIcon = '📋';

      switch(status) {
        case 'reviewed':
          notificationMessage = 'Your report is being reviewed by our team.';
          notificationIcon = '👀';
          break;
        case 'resolved':
          notificationMessage = 'Your report has been resolved. Thank you for helping keep our community safe!';
          notificationIcon = '✅';
          break;
        case 'dismissed':
          notificationMessage = 'Your report has been reviewed and dismissed as it did not violate our guidelines.';
          notificationIcon = 'ℹ️';
          break;
      }

      if (notificationMessage) {
        await Notification.create({
          userId: report.reportedBy._id,
          title: `📋 Report Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          message: notificationMessage,
          type: 'report',
          icon: notificationIcon,
          read: false,
          data: {
            reportId: report._id,
            status: status
          }
        });
        
        console.log(`🔔 Status update notification sent to reporter ${report.reportedBy._id}`);
      }

      // ✅ NOTIFY COMMENT OWNER IF RESOLVED (Action taken)
      if (status === 'resolved' && report.commentId && report.commentId.userId) {
        await Notification.create({
          userId: report.commentId.userId._id,
          title: '⚠️ Action Taken on Your Comment',
          message: 'A report against your comment has been reviewed and action has been taken. Please ensure your future comments follow our community guidelines.',
          type: 'report',
          icon: '⚠️',
          read: false,
          data: {
            reportId: report._id,
            commentId: report.commentId._id,
            status: status
          }
        });
        
        console.log(`🔔 Action notification sent to comment owner ${report.commentId.userId._id}`);
      }
    } catch (notifError) {
      console.error("❌ Status update notification failed:", notifError.message);
    }

    res.status(200).json({
      success: true,
      msg: "Report status updated successfully",
      data: report
    });
  } catch (error) {
    console.error("❌ Update Report Status Error:", error.message);
    res.status(500).json({
      success: false,
      msg: "Failed to update report status",
      error: error.message
    });
  }
};

// Delete report
export const deleteReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      const msg = "Report not found";
      console.log("Delete report failed:", msg);
      return res.status(404).json({ success: false, msg });
    }

    // Only allow user to delete their own reports
    if (report.reportedBy.toString() !== req.user._id.toString()) {
      const msg = "Not authorized to delete this report";
      console.log("Delete report failed:", msg);
      return res.status(403).json({ success: false, msg });
    }

    await Report.findByIdAndDelete(req.params.id);

    console.log(`Report deleted successfully. Report ID: ${req.params.id}`);

    res.status(200).json({
      success: true,
      msg: "Report deleted successfully"
    });
  } catch (error) {
    console.error("❌ Delete Report Error:", error.message);
    res.status(500).json({
      success: false,
      msg: "Failed to delete report",
      error: error.message
    });
  }
};
