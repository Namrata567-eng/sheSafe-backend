import express from "express";
import {
  getFriends,
  sendFriendRequest,
  getIncomingRequests,
  getOutgoingRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  updateFriend,
  deleteFriend,
  searchUsers
} from "../controllers/friendController.js";


const router = express.Router();


// ========================================
// ✅ FRIEND ROUTES
// ========================================


// Get all accepted friends
router.get("/", getFriends);


// Send friend request (creates with PENDING status)
router.post("/request", sendFriendRequest);


// Get incoming friend requests (received)
router.get("/requests/incoming", getIncomingRequests);


// Get outgoing friend requests (sent)
router.get("/requests/outgoing", getOutgoingRequests);


// Accept friend request (changes status to ACCEPTED)
router.put("/request/:id/accept", acceptFriendRequest);


// Reject friend request
router.put("/request/:id/reject", rejectFriendRequest);


// Cancel sent friend request
router.delete("/request/:id/cancel", cancelFriendRequest);


// Update friend info (for accepted friends only)
router.put("/:id", updateFriend);


// Remove friend (delete friendship)
router.delete("/:id", deleteFriend);


// Search users by email
router.get("/search", searchUsers);


export default router;
