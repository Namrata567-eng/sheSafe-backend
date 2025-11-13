import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import commentRoutes from "./routes/commentRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";
import friendRoutes from "./routes/friendRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import User from "./models/User.js";  
import liveLocationRoutes from './routes/LiveLocation.js';
import notificationRoutes from "./routes/notification.routes.js";


dotenv.config();


const app = express();


// ===== Middleware =====
app.use(cors({
  origin: '*', // Allow all origins for now
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use('/uploads', express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), 'uploads')));

// ===== Debug Middleware - ADD THIS AFTER LINE 32 =====



// ===== MongoDB Connection =====
mongoose.set("strictQuery", false);


console.log("Loaded MONGO_URI =", process.env.MONGO_URI);


mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => {
    console.error("❌ MongoDB connection ERROR");
    console.error(err);
  });


// ===== Feedback Schema & Model =====
const feedbackSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userEmail: { type: String, required: true },
    userName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    selectedFeature: { type: String, required: true },
    feedbackMessage: { type: String, required: true, maxlength: 500 },
    email: { type: String, required: true },
  },
  { timestamps: true }
);


const Feedback = mongoose.model("Feedback", feedbackSchema);


// ===== Auth Middleware =====
export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
      req.user = await User.findById(decoded.id).select("-password");


      if (!req.user)
        return res.status(401).json({ success: false, message: "User not found" });


      next();
    } catch (error) {
      console.error("❌ Token verification failed:", error.message);
      return res
        .status(401)
        .json({ success: false, message: "Not authorized, token failed" });
    }
  } else {
    return res
      .status(401)
      .json({ success: false, message: "Not authorized, no token" });
  }
};


// ===== Root Route =====
app.get("/", (req, res) => {
  res.send("🚀 Women Security API is running...");
});


// ===== Routes =====
app.use('/api/live-location', liveLocationRoutes);
app.use("/api/friends", protect, friendRoutes);
app.use('/api/notifications', notificationRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api", reportRoutes)
app.use("/api/media", protect, mediaRoutes);

// ===== ✅ REGISTRATION - No Double Hashing =====
app.post("/api/register", async (req, res) => {
  try {
    let { fullName, email, password, emergencyContact, age, bio } = req.body;
   
    if (!fullName || !email || !password || !emergencyContact)
      return res.status(400).json({ message: "All fields are required" });


    email = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email });
   
    if (existingUser)
      return res.status(400).json({ message: "Email already registered" });


    // ✅ Create user with plain password - pre-save hook will hash it
    const newUser = new User({
      fullName,
      email,
      password,
      emergencyContact,
      age,
      bio,
    });


    await newUser.save();


    const token = jwt.sign(
      { id: newUser._id },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" }
    );


    res.status(201).json({
      message: "✅ User registered successfully",
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        emergencyContact: newUser.emergencyContact,
        age: newUser.age,
        bio: newUser.bio,
      },
      token,
    });
  } catch (error) {
    console.error("❌ Error in /api/register:", error.message);
    res.status(500).json({ message: "Registration failed", error: error.message });
  }
});


// ===== LOGIN =====
app.post("/api/login", async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });


    email = email.trim().toLowerCase();
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "User not found" });


    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });


    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" }
    );


    res.status(200).json({
      message: "✅ Login successful",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        emergencyContact: user.emergencyContact,
        age: user.age,
        bio: user.bio,
        profilePic: user.profilePic,
      },
      token,
    });
  } catch (error) {
    console.error("❌ Error in /api/login:", error.message);
    res.status(500).json({ message: "Login failed", error: error.message });
  }
});


// ===== Get All Users =====
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find();
    const safeUsers = users.map((u) => ({
      _id: u._id,
      fullName: u.fullName,
      email: u.email,
      emergencyContact: u.emergencyContact,
      age: u.age,
      bio: u.bio,
      profilePic: u.profilePic,
      password: "••••••",
    }));


    res.status(200).json(safeUsers);
  } catch (error) {
    console.error("❌ Error in /api/users:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});


// ===== ✅ Get Single User (Protected) =====
app.get("/api/auth/user/:id", protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });


    res.json({
      data: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        emergencyContact: user.emergencyContact,
        age: user.age,
        bio: user.bio,
        profilePic: user.profilePic,
      }
    });
  } catch (error) {
    console.error("❌ Error in /api/auth/user/:id:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});


// ===== ✅ Update Profile (Protected) - WORKING =====
app.put("/api/auth/update/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, emergencyContact, age, bio, profilePic } = req.body;
   
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });


    console.log(`🔧 Profile Update for: ${user.email}`);


    if (fullName !== undefined) user.fullName = fullName;
    if (email !== undefined) user.email = email;
    if (emergencyContact !== undefined) user.emergencyContact = emergencyContact;
    if (age !== undefined) user.age = age;
    if (bio !== undefined) user.bio = bio;
    if (profilePic !== undefined) user.profilePic = profilePic;


    const updatedUser = await user.save();
   
    console.log(`✅ Profile updated successfully`);


    res.json({
      message: "Profile updated successfully",
      data: {
        _id: updatedUser._id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        emergencyContact: updatedUser.emergencyContact,
        age: updatedUser.age,
        bio: updatedUser.bio,
        profilePic: updatedUser.profilePic,
      }
    });
  } catch (error) {
    console.error("❌ Update User Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


// ===== Update User (Admin) =====
app.put("/api/users/:id", async (req, res) => {
  try {
    let { fullName, email, emergencyContact, password } = req.body;
   
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }


    if (fullName !== undefined) user.fullName = fullName;
    if (email !== undefined) user.email = email;
    if (emergencyContact !== undefined) user.emergencyContact = emergencyContact;
   
    if (password && password.trim() !== "") {
      user.password = password;
    }


    const updatedUser = await user.save();


    const safeUser = {
      _id: updatedUser._id,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      emergencyContact: updatedUser.emergencyContact,
      age: updatedUser.age,
      bio: updatedUser.bio,
      profilePic: updatedUser.profilePic,
    };


    res.status(200).json({
      message: "✅ User updated successfully",
      user: safeUser
    });


  } catch (error) {
    console.error("❌ Error in /api/users/:id (update):", error.message);
    res.status(500).json({
      message: "Update failed",
      error: error.message
    });
  }
});


// ===== Delete User (Admin) =====
app.delete("/api/users/:id", async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
   
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }
   
    res.status(200).json({
      message: "✅ User deleted successfully",
      deletedUser: {
        _id: deletedUser._id,
        email: deletedUser.email,
        fullName: deletedUser.fullName
      }
    });
  } catch (error) {
    console.error("❌ Error in /api/users/:id (delete):", error.message);
    res.status(500).json({ message: "Delete failed", error: error.message });
  }
});


// ===== FORGOT PASSWORD =====
app.post("/api/forgot-password", async (req, res) => {
  try {
    let { email } = req.body;
   
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }


    email = email.trim().toLowerCase();
    const user = await User.findOne({ email });
   
    if (!user) {
      return res.status(404).json({
        message: "No account found with this email address"
      });
    }


    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000;
    await user.save();


    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: { rejectUnauthorized: false },
    });


    const SERVER_IP = process.env.SERVER_IP || "192.168.43.216";
    const PORT = process.env.PORT || 5000;
    const resetUrl = `http://${SERVER_IP}:${PORT}/reset-password-page?token=${resetToken}`;


    await transporter.sendMail({
      from: `"sheSafe App" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "🔐 Password Reset Request - sheSafe",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #ffe6f0;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
            <h2 style="color: #e91e8c; text-align: center;">🔐 sheSafe Password Reset</h2>
            <p>Hello <strong>${user.fullName}</strong>,</p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <p style="font-weight: bold; text-align: center;">📱 Your Password Reset Token</p>
              <div style="background: white; padding: 15px; font-family: monospace; word-break: break-all; text-align: center;">
                ${resetToken}
              </div>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="display: inline-block; padding: 15px 40px; background-color: #e91e8c; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Or Click Here to Reset
              </a>
            </div>
            <p style="color: #c62828; font-size: 13px;">⏰ This token expires in 1 hour</p>
          </div>
        </div>
      `,
    });
   
    res.json({
      message: `Password reset link sent to ${user.email}`
    });


  } catch (error) {
    console.error("❌ Forgot password error:", error);
    res.status(500).json({
      message: "Failed to send reset email",
      error: error.message
    });
  }
});


// ===== Reset Password Page =====
app.get("/reset-password-page", (req, res) => {
  const { token } = req.query;
 
  if (!token) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invalid Link</title>
          <style>
            body { font-family: Arial; display: flex; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(135deg, #ffe6f0 0%, #ffc0d9 100%); }
            .container { text-align: center; background: white; padding: 40px; border-radius: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Invalid Reset Link</h1>
            <p>Please request a new password reset link from the app.</p>
          </div>
        </body>
      </html>
    `);
  }


  const deepLinks = {
    primary: `womensafetyapp://reset-password?token=${token}`,
    alternative: `shesafe://reset-password?token=${token}`,
    intent: `intent://reset-password?token=${token}#Intent;scheme=womensafetyapp;package=com.sandhyamaurya.WomenSafetyApp;end`
  };
 
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Opening sheSafe App...</title>
        <style>
          body { font-family: Arial; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: linear-gradient(135deg, #ffe6f0 0%, #ffc0d9 100%); }
          .container { text-align: center; background: white; padding: 40px; border-radius: 20px; max-width: 450px; width: 100%; }
          .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #e91e8c; border-radius: 50%; width: 60px; height: 60px; animation: spin 1s linear infinite; margin: 25px auto; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          button { background: #e91e8c; color: white; border: none; padding: 16px 30px; border-radius: 12px; font-size: 16px; cursor: pointer; width: 100%; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔐 Opening sheSafe App...</h1>
          <div class="spinner" id="spinner"></div>
          <div id="buttonGroup" style="display: none;">
            <button onclick="openApp('primary')">📱 Open sheSafe App</button>
            <button onclick="openApp('alternative')">🔄 Try Alternative</button>
            <button onclick="openApp('intent')">🔗 Use Intent (Android)</button>
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">Token: ${token.substring(0, 20)}...</p>
        </div>
        <script>
          const deepLinks = ${JSON.stringify(deepLinks)};
          function openApp(method = 'primary') {
            window.location.href = deepLinks[method];
            setTimeout(() => {
              document.getElementById('spinner').style.display = 'none';
              document.getElementById('buttonGroup').style.display = 'block';
            }, 3000);
          }
          setTimeout(() => openApp('primary'), 500);
        </script>
      </body>
    </html>
  `);
});


// ===== RESET PASSWORD API =====
app.post("/api/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;


    if (!password || password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }


    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });
   
    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset token"
      });
    }


    user.password = password;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
   
    await user.save();


    res.json({
      message: "Password reset successfully! You can now login."
    });


  } catch (error) {
    console.error("❌ Reset password error:", error);
    res.status(500).json({
      message: "Password reset failed",
      error: error.message
    });
  }
});


// ===== Feedback Routes =====
app.post("/api/feedback", protect, async (req, res) => {
  try {
    const { rating, selectedFeature, feedbackMessage, email } = req.body;
    if (!rating || !selectedFeature || !feedbackMessage || !email)
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });


    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });


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
      feedback,
    });
  } catch (error) {
    console.error("❌ Error in POST /api/feedback:", error.message);
    res.status(500).json({ success: false, message: "Failed to submit feedback" });
  }
});


app.get("/api/feedback", async (req, res) => {
  try {
    const feedbacks = await Feedback.find()
      .populate("userId", "fullName email")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: feedbacks.length, feedbacks });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch feedbacks" });
  }
});


app.get("/api/feedback/my", protect, async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: feedbacks.length, feedbacks });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch your feedbacks" });
  }
});


app.put("/api/feedback/:id", protect, async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback)
      return res.status(404).json({ success: false, message: "Feedback not found" });
    if (feedback.userId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: "You can only update your own feedback" });


    Object.assign(feedback, req.body);
    const updatedFeedback = await feedback.save();
    res.json({ success: true, message: "Feedback updated successfully", updatedFeedback });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update feedback" });
  }
});


app.delete("/api/feedback/:id", protect, async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback)
      return res.status(404).json({ success: false, message: "Feedback not found" });
    if (feedback.userId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: "You can only delete your own feedback" });


    await Feedback.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Feedback deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete feedback" });
  }
});


// ===== Start Server =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log("💚 CURRENT MONGO_URI =", process.env.MONGO_URI);
  console.log(`🚀 sheSafe Backend Server Started Successfully!`);
  console.log(`${"=".repeat(60)}`);
  console.log(`📍 Local Access:     http://localhost:${PORT}`);
  console.log(`🌐 Network Access:   http://${process.env.SERVER_IP || "192.168.43.216"}:${PORT}`);
  console.log(`📱 Mobile Access:    http://${process.env.SERVER_IP || "192.168.43.216"}:${PORT}/api`);
  console.log(`${"=".repeat(60)}`);
  console.log(`📧 Email Service:    ${process.env.EMAIL_USER || "Not configured"}`);
  console.log(`🔗 Deep Link Scheme: womensafetyapp://`);
  console.log(`${"=".repeat(60)}\n`);
});
