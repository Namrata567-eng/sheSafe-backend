import Friend from "../models/Friend.js";
import User from "../models/User.js";
import Notification from "../models/notification.model.js"; // ✅ ADD THIS LINE
import mongoose from "mongoose";
import nodemailer from "nodemailer";

// ✅ GET ALL ACCEPTED FRIENDS
export const getFriends = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("📡 Fetching friends for user:", userId);

    const friends = await Friend.find({
      $or: [
        { senderId: userId, status: "accepted" },
        { receiverId: userId, status: "accepted" }
      ]
    }).sort({ createdAt: -1 });

    console.log(`✅ Found ${friends.length} accepted friends`);

    const formattedFriends = await Promise.all(
      friends.map(async (friend) => {
        const isSender = friend.senderId.toString() === userId.toString();
        const friendUserId = isSender ? friend.receiverId : friend.senderId;
        
        const friendUser = await User.findById(friendUserId).select('fullName email emergencyContact');
        
        return {
          _id: friend._id,
          name: friendUser?.fullName || (isSender ? friend.receiverName : friend.senderName),
          email: friendUser?.email || (isSender ? friend.receiverEmail : friend.senderEmail),
          userId: friendUserId,
          phone: friendUser?.emergencyContact || friend.phone || "",
          city: friend.city || "Mumbai",
          isSOSContact: friend.isSOSContact || false,
          createdAt: friend.createdAt
        };
      })
    );

    res.json({ success: true, data: formattedFriends });
  } catch (error) {
    console.error("❌ Get Friends Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch friends" });
  }
};

// ✅ SEND FRIEND REQUEST
export const sendFriendRequest = async (req, res) => {
  try {
    const senderId = req.user._id;
    const senderEmail = req.user.email;
    const senderName = req.user.fullName;
    
    const { email, phone, name, city } = req.body;

    console.log("📤 Sending friend request from:", senderName);
    console.log("📝 Request data:", { email, phone, name, city });

    if (!phone && !email) {
      return res.status(400).json({ 
        success: false, 
        message: "Phone number or email is required" 
      });
    }

    let receiverPhone = phone?.trim() || "";
    let receiverName = name?.trim() || "Unknown";
    let receiverEmail = email?.toLowerCase().trim() || "";
    let receiver = null;
    let receiverId;

    if (phone && !email) {
      receiver = await User.findOne({ emergencyContact: receiverPhone });
      
      if (!receiver) {
        return res.status(404).json({ 
          success: false, 
          message: "This phone number is not registered in our app. Please ask them to sign up first." 
        });
      }
      
      receiverId = receiver._id;
      receiverName = receiver.fullName;
      receiverEmail = receiver.email;
      
      console.log("✅ Found registered user by phone:", receiverName);
    }

    if (email) {
      receiver = await User.findOne({ email: receiverEmail });
      if (!receiver) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found with this email" 
        });
      }
      receiverId = receiver._id;
      receiverName = receiver.fullName;
      receiverEmail = receiver.email;
    }

    if (receiver && receiver._id.toString() === senderId.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: "You cannot send friend request to yourself" 
      });
    }

    const existingRequest = await Friend.findOne({
      $or: [
        { senderId: senderId, receiverId: receiverId },
        { senderId: receiverId, receiverId: senderId }
      ]
    });

    if (existingRequest) {
      console.log("⚠️ Existing request found with status:", existingRequest.status);
      
      if (existingRequest.status === "pending") {
        return res.status(400).json({ 
          success: false, 
          message: "Friend request already sent or pending" 
        });
      }
      if (existingRequest.status === "accepted") {
        return res.status(400).json({ 
          success: false, 
          message: "You are already friends" 
        });
      }
      if (existingRequest.status === "rejected") {
        existingRequest.status = "pending";
        existingRequest.createdAt = new Date();
        await existingRequest.save();
        console.log("✅ Re-sent friend request after rejection");
        return res.status(200).json({ 
          success: true, 
          message: "Friend request sent again",
          data: existingRequest 
        });
      }
    }

    const friendRequest = new Friend({
      senderId: senderId,
      senderEmail: senderEmail,
      senderName: senderName,
      receiverId: receiverId,
      receiverEmail: receiverEmail,
      receiverName: receiverName,
      phone: receiverPhone,
      city: city || "Mumbai",
      status: "pending"
    });

    await friendRequest.save();

    console.log("✅ Friend request created with PENDING status");
    console.log("📋 Request ID:", friendRequest._id);

    // ✅ CREATE NOTIFICATION FOR RECEIVER
    try {
      await Notification.create({
        userId: receiverId,
        title: '👥 New Friend Request',
        message: `${senderName} wants to add you as a friend`,
        type: 'friend',
        icon: '👥',
        read: false
      });
      console.log("🔔 Notification created for receiver");
    } catch (notifError) {
      console.error("❌ Notification creation failed:", notifError.message);
    }

    // 📧 Send email notification
    // 📧 Send email notification
try {
  console.log("📧 Attempting to send email...");
  console.log("EMAIL_USER:", process.env.EMAIL_USER ? "✅ Set" : "❌ Not Set");
  console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "✅ Set" : "❌ Not Set");
  
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: { rejectUnauthorized: false },
  });

  // Test connection
  await transporter.verify();
  console.log("✅ SMTP connection verified");

  await transporter.sendMail({
    from: `"SheSafe App" <${process.env.EMAIL_USER}>`,
    to: receiverEmail,
    subject: '🔔 New Friend Request on SheSafe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: #e91e63; padding: 20px; border-radius: 10px 10px 0 0;">
          <h2 style="color: white; margin: 0;">New Friend Request 👋</h2>
        </div>
        <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333;">
            <strong style="color: #e91e63;">${senderName}</strong> wants to add you as a friend on SheSafe.
          </p>
          <div style="background-color: #f8f8f8; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>📧 Email:</strong> ${senderEmail}</p>
            <p style="margin: 5px 0;"><strong>📱 Phone:</strong> ${receiverPhone || 'Not provided'}</p>
          </div>
          <p style="font-size: 14px; color: #666;">
            Please open the <strong>SheSafe app</strong> to accept or reject this request.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #e91e63; font-weight: bold; text-align: center;">Stay Safe! 💕</p>
        </div>
      </div>
    `,
  });

  console.log("✅ Email notification sent to:", receiverEmail);
} catch (emailError) {
  console.error("❌ Email notification failed:", emailError.message);
  console.error("Full error:", emailError);
}

    res.status(201).json({ 
      success: true, 
      message: "Friend request sent successfully. Waiting for acceptance.",
      data: friendRequest 
    });

  } catch (error) {
    console.error("❌ Send Friend Request Error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: "Friend request already exists" 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: "Failed to send friend request",
      error: error.message 
    });
  }
};

// ✅ GET INCOMING REQUESTS
export const getIncomingRequests = async (req, res) => {
  try {
    const userId = req.user._id;

    console.log("📥 Fetching incoming requests for user:", userId);

    const requests = await Friend.find({
      receiverId: userId,
      status: "pending"
    }).sort({ createdAt: -1 });

    console.log(`✅ Found ${requests.length} incoming requests`);

    const formattedRequests = requests.map(req => ({
      _id: req._id,
      name: req.senderName,
      email: req.senderEmail,
      userId: req.senderId,
      phone: req.phone || "",
      city: req.city || "Mumbai",
      createdAt: req.createdAt
    }));

    res.json({ success: true, data: formattedRequests });
  } catch (error) {
    console.error("❌ Get Incoming Requests Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch requests" 
    });
  }
};

// ✅ GET OUTGOING REQUESTS
export const getOutgoingRequests = async (req, res) => {
  try {
    const userId = req.user._id;

    console.log("📤 Fetching outgoing requests for user:", userId);

    const requests = await Friend.find({
      senderId: userId,
      status: "pending"
    }).sort({ createdAt: -1 });

    console.log(`✅ Found ${requests.length} outgoing requests`);

    const formattedRequests = requests.map(req => ({
      _id: req._id,
      name: req.receiverName,
      email: req.receiverEmail,
      userId: req.receiverId,
      phone: req.phone || "",
      city: req.city || "Mumbai",
      createdAt: req.createdAt
    }));

    res.json({ success: true, data: formattedRequests });
  } catch (error) {
    console.error("❌ Get Outgoing Requests Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch sent requests" 
    });
  }
};

// ✅ ACCEPT FRIEND REQUEST
export const acceptFriendRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    console.log("✅ User", userId, "accepting request", id);

    const request = await Friend.findOne({
      _id: id,
      receiverId: userId,
      status: "pending"
    });

    if (!request) {
      console.log("❌ Request not found or already processed");
      return res.status(404).json({ 
        success: false, 
        message: "Friend request not found or already processed" 
      });
    }

    console.log("📝 Current status:", request.status);

    request.status = "accepted";
    await request.save();

    console.log("🎉 Status changed to ACCEPTED");

    // ✅ CREATE NOTIFICATIONS FOR BOTH USERS
    try {
      // Notification for sender (who sent the request)
      await Notification.create({
        userId: request.senderId,
        title: '🎉 Friend Request Accepted!',
        message: `${request.receiverName} accepted your friend request`,
        type: 'friend',
        icon: '🎉',
        read: false
      });

      // Notification for receiver (who accepted)
      await Notification.create({
        userId: request.receiverId,
        title: '✅ Friend Added',
        message: `You are now friends with ${request.senderName}`,
        type: 'friend',
        icon: '✅',
        read: false
      });

      console.log("🔔 Notifications created for both users");
    } catch (notifError) {
      console.error("❌ Notification creation failed:", notifError.message);
    }

    // 📧 Send email
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: { rejectUnauthorized: false },
      });

      await transporter.sendMail({
        from: `"SheSafe App" <${process.env.EMAIL_USER}>`,
        to: request.senderEmail,
        subject: '🎉 Friend Request Accepted!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background-color: #10B981; padding: 20px; border-radius: 10px 10px 0 0;">
              <h2 style="color: white; margin: 0;">Friend Request Accepted! 🎉</h2>
            </div>
            <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; color: #333;">
                <strong style="color: #e91e63;">${request.receiverName}</strong> has accepted your friend request!
              </p>
              <p style="font-size: 14px; color: #666;">
                You are now connected and can share your location during emergencies.
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #e91e63; font-weight: bold; text-align: center;">Stay Safe Together! 💕</p>
            </div>
          </div>
        `,
      });

      console.log("📧 Acceptance notification sent to:", request.senderEmail);
    } catch (emailError) {
      console.error("❌ Email notification failed:", emailError.message);
    }

    res.json({ 
      success: true, 
      message: "Friend request accepted! You are now friends.",
      data: request 
    });

  } catch (error) {
    console.error("❌ Accept Request Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to accept friend request" 
    });
  }
};

// ✅ REJECT FRIEND REQUEST
export const rejectFriendRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    console.log("❌ User", userId, "rejecting request", id);

    const request = await Friend.findOne({
      _id: id,
      receiverId: userId,
      status: "pending"
    });

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: "Friend request not found" 
      });
    }

    request.status = "rejected";
    await request.save();

    console.log("✅ Request rejected");

    // ✅ CREATE NOTIFICATION FOR SENDER
    try {
      await Notification.create({
        userId: request.senderId,
        title: '❌ Friend Request Declined',
        message: `${request.receiverName} declined your friend request`,
        type: 'friend',
        icon: '❌',
        read: false
      });
      console.log("🔔 Rejection notification created");
    } catch (notifError) {
      console.error("❌ Notification creation failed:", notifError.message);
    }

    res.json({ 
      success: true, 
      message: "Friend request rejected",
      data: request 
    });

  } catch (error) {
    console.error("❌ Reject Request Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to reject friend request" 
    });
  }
};

// ✅ CANCEL SENT FRIEND REQUEST
export const cancelFriendRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    console.log("🗑️ User", userId, "cancelling request", id);

    const request = await Friend.findOne({
      _id: id,
      senderId: userId,
      status: "pending"
    });

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: "Friend request not found" 
      });
    }

    await Friend.findByIdAndDelete(id);

    console.log("✅ Request cancelled and deleted");

    res.json({ 
      success: true, 
      message: "Friend request cancelled" 
    });

  } catch (error) {
    console.error("❌ Cancel Request Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to cancel friend request" 
    });
  }
};

// ✅ UPDATE FRIEND INFO
export const updateFriend = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { name, phone, city, isSOSContact } = req.body;

    console.log("✏️ Updating friend:", id);
    console.log("📝 Update data:", { name, phone, city, isSOSContact });

    const friend = await Friend.findOne({
      _id: id,
      $or: [
        { senderId: userId },
        { receiverId: userId }
      ],
      status: "accepted"
    });

    if (!friend) {
      return res.status(404).json({ 
        success: false, 
        message: "Friend not found or not yet accepted" 
      });
    }

    if (phone !== undefined) friend.phone = phone.trim();
    if (city !== undefined) friend.city = city;
    if (isSOSContact !== undefined) friend.isSOSContact = isSOSContact;

    if (name !== undefined) {
      const isSender = friend.senderId.toString() === userId.toString();
      if (isSender) {
        friend.receiverName = name.trim();
      } else {
        friend.senderName = name.trim();
      }
    }

    await friend.save();

    console.log("✅ Friend updated successfully");

    res.json({ success: true, data: friend });

  } catch (error) {
    console.error("❌ Update Friend Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update friend" 
    });
  }
};

// ✅ DELETE FRIEND
export const deleteFriend = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    console.log("🗑️ Deleting friend:", id);

    const friend = await Friend.findOneAndDelete({
      _id: id,
      $or: [
        { senderId: userId },
        { receiverId: userId }
      ]
    });

    if (!friend) {
      return res.status(404).json({ 
        success: false, 
        message: "Friend not found" 
      });
    }

    console.log("✅ Friend removed successfully");

    res.json({ 
      success: true, 
      message: "Friend removed successfully" 
    });

  } catch (error) {
    console.error("❌ Delete Friend Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to remove friend" 
    });
  }
};

// ✅ SEARCH USERS BY EMAIL
export const searchUsers = async (req, res) => {
  try {
    const { email } = req.query;
    const userId = req.user._id;

    console.log("🔍 Searching users with email:", email);

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: "Email is required" 
      });
    }

    const users = await User.find({
      email: { $regex: email, $options: "i" },
      _id: { $ne: userId }
    })
    .select("_id fullName email")
    .limit(10);

    console.log(`✅ Found ${users.length} users`);

    res.json({ success: true, data: users });

  } catch (error) {
    console.error("❌ Search Users Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to search users" 
    });
  }
};