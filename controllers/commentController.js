import Comment from "../models/Comment.js";
import User from "../models/User.js";
import Notification from "../models/notification.model.js"; // ✅ IMPORT ADDED

// Get all comments with user details
export const getAllComments = async (req, res) => {
  try {
    const comments = await Comment.find()
      .populate("userId", "fullName email profilePic")
      .populate("replies.userId", "fullName profilePic")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: comments.length,
      data: comments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: "Failed to fetch comments",
      error: error.message
    });
  }
};

// Create new comment
export const createComment = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        msg: "Comment text is required"
      });
    }

    const comment = await Comment.create({
      userId: req.user._id,
      text: text.trim()
    });

    const populatedComment = await Comment.findById(comment._id)
      .populate("userId", "fullName email profilePic");

    res.status(201).json({
      success: true,
      data: populatedComment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: "Failed to create comment",
      error: error.message
    });
  }
};

// Like/Unlike comment
export const likeComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        msg: "Comment not found"
      });
    }

    const userId = req.user._id;
    const hasLiked = comment.likedBy.includes(userId);

    if (hasLiked) {
      // Unlike
      comment.likes -= 1;
      comment.likedBy = comment.likedBy.filter(
        id => id.toString() !== userId.toString()
      );
    } else {
      // Like
      comment.likes += 1;
      comment.likedBy.push(userId);

      // ✅ CREATE NOTIFICATION FOR COMMENT OWNER (Only if it's not their own comment)
      if (comment.userId.toString() !== userId.toString()) {
        try {
          const liker = await User.findById(userId).select('fullName');
          
          await Notification.create({
            userId: comment.userId, // Send to comment owner
            title: '❤️ New Like on Your Comment',
            message: `${liker.fullName} liked your comment: "${comment.text.substring(0, 50)}${comment.text.length > 50 ? '...' : ''}"`,
            type: 'community',
            icon: '❤️',
            read: false,
            data: {
              commentId: comment._id,
              likerId: userId,
              likerName: liker.fullName
            }
          });
          
          console.log(`🔔 Like notification sent to user ${comment.userId}`);
        } catch (notifError) {
          console.error("❌ Like notification failed:", notifError.message);
        }
      }
    }

    await comment.save();

    const populatedComment = await Comment.findById(comment._id)
      .populate("userId", "fullName email profilePic");

    res.status(200).json({
      success: true,
      data: populatedComment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: "Failed to like comment",
      error: error.message
    });
  }
};

// Add reply to comment
export const addReply = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        msg: "Reply text is required"
      });
    }

    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        msg: "Comment not found"
      });
    }

    comment.replies.push({
      userId: req.user._id,
      text: text.trim()
    });

    await comment.save();

    // ✅ CREATE NOTIFICATION FOR COMMENT OWNER (Only if it's not their own comment)
    if (comment.userId.toString() !== req.user._id.toString()) {
      try {
        const replier = await User.findById(req.user._id).select('fullName');
        
        await Notification.create({
          userId: comment.userId, // Send to comment owner
          title: '💬 New Reply on Your Comment',
          message: `${replier.fullName} replied to your comment: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
          type: 'community',
          icon: '💬',
          read: false,
          data: {
            commentId: comment._id,
            replierId: req.user._id,
            replierName: replier.fullName,
            replyText: text.trim()
          }
        });
        
        console.log(`🔔 Reply notification sent to user ${comment.userId}`);
      } catch (notifError) {
        console.error("❌ Reply notification failed:", notifError.message);
      }
    }

    const populatedComment = await Comment.findById(comment._id)
      .populate("userId", "fullName email profilePic")
      .populate("replies.userId", "fullName profilePic");

    res.status(200).json({
      success: true,
      data: populatedComment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: "Failed to add reply",
      error: error.message
    });
  }
};

// Delete comment
export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        msg: "Comment not found"
      });
    }

    if (comment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        msg: "Not authorized to delete this comment"
      });
    }

    await comment.deleteOne();

    res.status(200).json({
      success: true,
      msg: "Comment deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: "Failed to delete comment",
      error: error.message
    });
  }
};
