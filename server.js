// COMPLETE UPDATED SERVER.JS WITH FIXED REGISTRATION:
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
import friendRoutes from "./routes/friendRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import User from "./models/User.js";  
import liveLocationRoutes from './routes/LiveLocation.js';
import notificationRoutes from "./routes/notification.routes.js";

dotenv.config();

const app = express();

// ===== Middleware =====
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Routes
app.use('/api/live-location', liveLocationRoutes);

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

// ===== Friend Routes (Protected) =====
app.use("/api/friends", protect, friendRoutes);
app.use('/api/notifications', notificationRoutes);

// ===== ✅ FIXED Registration - No Double Hashing =====
app.post("/api/register", async (req, res) => {
  try {
    let { fullName, email, password, emergencyContact, age, bio } = req.body;
    
    if (!fullName || !email || !password || !emergencyContact)
      return res.status(400).json({ message: "All fields are required" });

    email = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email });
    
    if (existingUser)
      return res.status(400).json({ message: "Email already registered" });

    // ✅ CRITICAL FIX: Don't hash manually - let pre-save hook do it
    const newUser = new User({
      fullName,
      email,
      password,  // ✅ Plain password - pre-save hook will hash it automatically
      emergencyContact,
      age,
      bio,
    });

    await newUser.save();  // Pre-save hook will hash password here

    const token = jwt.sign(
      { id: newUser._id },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" }
    );

    console.log(`✅ New user registered: ${newUser.email}`);

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

// ===== Login =====
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

// ===== Get Single User (Protected) =====
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

// ===== Update Profile (Protected) =====
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

// ===== Update User (Admin) - No More Double Hashing =====
app.put("/api/users/:id", async (req, res) => {
  try {
    let { fullName, email, emergencyContact, password } = req.body;
   
    console.log(`\n${"=".repeat(50)}`);
    console.log(`🔧 ADMIN UPDATE USER`);
    console.log(`${"=".repeat(50)}`);
    console.log(`User ID: ${req.params.id}`);
    console.log(`Fields to update:`, {
      fullName: !!fullName,
      email: !!email,
      emergencyContact: !!emergencyContact,
      password: password ? `"${password}" (length: ${password.length})` : 'No change'
    });

    const user = await User.findById(req.params.id);
    if (!user) {
      console.log(`❌ User not found`);
      return res.status(404).json({ message: "User not found" });
    }

    console.log(`✅ User found: ${user.email}`);

    if (fullName !== undefined) user.fullName = fullName;
    if (email !== undefined) user.email = email;
    if (emergencyContact !== undefined) user.emergencyContact = emergencyContact;
   
    if (password && password.trim() !== "") {
      console.log(`🔐 Setting new password (plain text)`);
      console.log(`   Password: "${password}"`);
      user.password = password;
    } else {
      console.log(`⏭️  No password change requested`);
    }

    const updatedUser = await user.save();

    console.log(`✅ User updated successfully`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Password hash: ${updatedUser.password.substring(0, 29)}...`);
    console.log(`${"=".repeat(50)}\n`);

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
    console.error(error.stack);
    res.status(500).json({
      message: "Update failed",
      error: error.message
    });
  }
});

// ===== Delete User (Admin) =====
app.delete("/api/users/:id", async (req, res) => {
  try {
    console.log(`🗑️  Delete request for user: ${req.params.id}`);
   
    const deletedUser = await User.findByIdAndDelete(req.params.id);
   
    if (!deletedUser) {
      console.log(`❌ User not found`);
      return res.status(404).json({ message: "User not found" });
    }
   
    console.log(`✅ User deleted: ${deletedUser.email}`);
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

    console.log(`✅ Token generated for ${user.email}: ${resetToken.substring(0, 10)}...`);

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
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #e91e8c; text-align: center;">🔐 sheSafe Password Reset</h2>
            <p style="font-size: 16px;">Hello <strong>${user.fullName}</strong>,</p>
            <p style="font-size: 14px; color: #555;">You requested to reset your password.</p>
           
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border: 2px dashed #dee2e6;">
              <p style="margin: 0 0 12px 0; color: #495057; font-weight: bold; font-size: 14px; text-align: center;">
                📱 Your Password Reset Token
              </p>
              <div style="background: white; padding: 15px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 13px; word-break: break-all; border: 1px solid #dee2e6; text-align: center; line-height: 1.8;">
                ${resetToken}
              </div>
              <div style="background: #fff3cd; padding: 12px; margin-top: 15px; border-radius: 6px; border-left: 4px solid #ffc107;">
                <p style="margin: 0; color: #856404; font-size: 12px; line-height: 1.6;">
                  <strong>📋 How to use:</strong><br>
                  1. Open sheSafe app<br>
                  2. Go to "Forgot Password" → "Already have token?"<br>
                  3. Copy & paste the token above<br>
                  4. Create your new password
                </p>
              </div>
            </div>
           
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="display: inline-block; padding: 15px 40px; background-color: #e91e8c; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Or Click Here to Reset
              </a>
              <p style="margin: 10px 0 0 0; color: #999; font-size: 11px;">
                (This link works when app is installed)
              </p>
            </div>
           
            <div style="background: #ffebee; padding: 12px; margin: 20px 0; border-radius: 4px; border-left: 4px solid #f44336;">
              <p style="margin: 0; color: #c62828; font-size: 13px;">
                <strong>⏰ Important:</strong> This token expires in 1 hour
              </p>
            </div>
           
            <p style="color: #666; font-size: 13px;">If you didn't request this, please ignore this email.</p>
           
            <hr style="margin: 25px 0; border: none; border-top: 1px solid #eee;"/>
            <div style="text-align: center;">
              <p style="color: #999; font-size: 12px;">sheSafe - Women's Security App</p>
              <p style="color: #999; font-size: 11px; margin-top: 5px;">This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </div>
      `,
    });

    console.log(`✅ Reset email sent to: ${user.email}`);
   
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
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invalid Link</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              background: linear-gradient(135deg, #ffe6f0 0%, #ffc0d9 100%);
              margin: 0;
            }
            .container {
              text-align: center;
              background: white;
              padding: 40px;
              border-radius: 15px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            }
            h1 { color: #e91e8c; }
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
 
  console.log(`🔗 Generating deep links for token: ${token.substring(0, 10)}...`);
 
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Opening sheSafe App...</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #ffe6f0 0%, #ffc0d9 100%);
            padding: 20px;
          }
          .container {
            text-align: center;
            background: white;
            padding: 40px 30px;
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(233, 30, 140, 0.2);
            max-width: 450px;
            width: 100%;
          }
          h1 { color: #e91e8c; margin-bottom: 15px; font-size: 24px; }
          .status { color: #666; font-size: 14px; margin-bottom: 25px; }
          .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #e91e8c;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            animation: spin 1s linear infinite;
            margin: 25px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .button-group { display: flex; flex-direction: column; gap: 12px; margin-top: 25px; }
          button {
            background: #e91e8c;
            color: white;
            border: none;
            padding: 16px 30px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          button:hover { background: #d1177a; transform: translateY(-2px); }
          .secondary-btn { background: white; color: #e91e8c; border: 2px solid #e91e8c; }
          .secondary-btn:hover { background: #fff5fa; }
          .info { color: #999; font-size: 13px; margin-top: 20px; }
          .success-icon { font-size: 48px; margin-bottom: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">🔐</div>
          <h1>Opening sheSafe App...</h1>
          <p class="status" id="status">Attempting to open the app...</p>
          <div class="spinner" id="spinner"></div>
         
          <div class="button-group" id="buttonGroup" style="display: none;">
            <button onclick="openApp('primary')">📱 Open sheSafe App</button>
            <button onclick="openApp('alternative')" class="secondary-btn">🔄 Try Alternative Method</button>
            <button onclick="openApp('intent')" class="secondary-btn">🔗 Use Intent (Android)</button>
          </div>
         
          <p class="info">
            Can't open app? Copy this token and paste in the app manually:<br>
            <code style="font-size: 10px; word-break: break-all;">${token.substring(0, 20)}...</code>
          </p>
        </div>

        <script>
          const deepLinks = {
            primary: "${deepLinks.primary}",
            alternative: "${deepLinks.alternative}",
            intent: "${deepLinks.intent}"
          };
         
          function openApp(method = 'primary') {
            const link = deepLinks[method];
            try {
              const iframe = document.createElement('iframe');
              iframe.style.display = 'none';
              iframe.src = link;
              document.body.appendChild(iframe);
              setTimeout(() => document.body.removeChild(iframe), 1000);
              setTimeout(() => { window.location.href = link; }, 100);
              setTimeout(() => {
                document.getElementById('spinner').style.display = 'none';
                document.getElementById('buttonGroup').style.display = 'flex';
                document.getElementById('status').textContent = 'Click a button if app didn\\'t open:';
              }, 3000);
            } catch (error) {
              console.error('Error:', error);
            }
          }
         
          window.addEventListener('load', () => {
            setTimeout(() => openApp('primary'), 500);
          });
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

    console.log(`\n${"=".repeat(50)}`);
    console.log(`🔑 PASSWORD RESET ATTEMPT`);
    console.log(`${"=".repeat(50)}`);
    console.log(`Token: ${token.substring(0, 15)}...`);
    console.log(`New Password: "${password}" (length: ${password?.length})`);

    if (!password || password.length < 6) {
      console.log(`❌ Password validation failed`);
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });
   
    if (!user) {
      console.log(`❌ Invalid or expired token`);
      return res.status(400).json({
        message: "Invalid or expired reset token"
      });
    }

    console.log(`✅ User found: ${user.email}`);
    console.log(`📝 Old password hash: ${user.password.substring(0, 29)}...`);

    user.password = password;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
   
    await user.save();

    console.log(`📝 New password hash: ${user.password.substring(0, 29)}...`);
    console.log(`✅ Password reset successful!`);
    console.log(`${"=".repeat(50)}\n`);

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

    console.log(`✅ Feedback saved: ${feedback._id}`);

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
      .populate("userId", "fullName email emergencyContact")
      .sort({ createdAt: -1 })
      .select("-__v");
    res.status(200).json({ success: true, count: feedbacks.length, feedbacks });
  } catch (error) {
    console.error("❌ Error in GET /api/feedback:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch feedbacks" });
  }
});

app.get("/api/feedback/my", protect, async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select("-__v");
    res.status(200).json({ success: true, count: feedbacks.length, feedbacks });
  } catch (error) {
    console.error("❌ Error in GET /api/feedback/my:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch your feedbacks" });
  }
});

app.put("/api/feedback/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const feedback = await Feedback.findById(id);
    if (!feedback)
      return res.status(404).json({ success: false, message: "Feedback not found" });
    if (feedback.userId.toString() !== req.user._id.toString())
      return res
        .status(403)
        .json({ success: false, message: "You can only update your own feedback" });

    Object.assign(feedback, req.body);
    const updatedFeedback = await feedback.save();
    res.json({ success: true, message: "Feedback updated successfully", updatedFeedback });
  } catch (error) {
    console.error("❌ Error in PUT /api/feedback/:id:", error.message);
    res.status(500).json({ success: false, message: "Failed to update feedback" });
  }
});

app.delete("/api/feedback/:id", protect, async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback)
      return res.status(404).json({ success: false, message: "Feedback not found" });
    if (feedback.userId.toString() !== req.user._id.toString())
      return res
        .status(403)
        .json({ success: false, message: "You can only delete your own feedback" });

    await Feedback.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Feedback deleted successfully" });
  } catch (error) {
    console.error("❌ Error in DELETE /api/feedback/:id:", error.message);
    res.status(500).json({ success: false, message: "Failed to delete feedback" });
  }
});

// ===== Comment Routes =====
app.use("/api/comments", commentRoutes);

// ===== Report Routes =====
app.use("/api", reportRoutes);

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