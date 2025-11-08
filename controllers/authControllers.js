const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");




// Helper function to create JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1d" });
};




// 📌 Register
const registerUser = async (req, res) => {
  try {
    let { fullName, email, password, emergencyContact, age, bio } = req.body;




    // Clean and normalize email
    email = email.trim().toLowerCase();




    // Check if user already exists
    let userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ msg: "User already exists" });
    }




    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);




    // Create new user
    const user = await User.create({
      fullName,
      email,
      password: hashedPassword,
      emergencyContact,
      age,
      bio,
    });




    res.status(201).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      emergencyContact: user.emergencyContact,
      age: user.age,
      bio: user.bio,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ msg: "Server Error", error: error.message });
  }
};




// 📌 Login
const loginUser = async (req, res) => {
  try {
    let { email, password } = req.body;




    // Clean and normalize email
    email = email.trim().toLowerCase();




    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }




    // Match password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }




    res.json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      emergencyContact: user.emergencyContact,
      age: user.age,
      bio: user.bio,
      profilePic: user.profilePic,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ msg: "Server Error", error: error.message });
  }
};




// 📌 ✅ FORGOT PASSWORD - FIXED VERSION
const forgotPassword = async (req, res) => {
  try {
    let { email } = req.body;




    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }




    // Clean and normalize email
    email = email.trim().toLowerCase();




    // ✅ Check if user exists in database
    const user = await User.findOne({ email });




    if (!user) {
      return res.status(404).json({
        message: "No account found with this email address",
      });
    }




    // ✅ Generate unique reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
    await user.save();




    console.log(`✅ Token generated for ${user.email}: ${resetToken.substring(0, 10)}...`);




    // ✅ Email transporter setup
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // Sender email
        pass: process.env.EMAIL_PASS, // App password
      },
      tls: { rejectUnauthorized: false },
    });




    // ✅ Get server IP
    const SERVER_IP = process.env.SERVER_IP || "192.168.1.101";
    const PORT = process.env.PORT || 5000;




    // ✅✅✅ CRITICAL FIX: Use HTTP URL that redirects to deep link
    // The /reset-password-page endpoint in server.js handles the deep linking
    const resetUrl = `http://${SERVER_IP}:${PORT}/reset-password-page?token=${resetToken}`;




    console.log(`📧 Sending reset link: ${resetUrl}`);




    // ✅ Send email to USER'S registered email
    await transporter.sendMail({
      from: `"sheSafe App" <${process.env.EMAIL_USER}>`,
      to: user.email, // ✅ User's registered email
      subject: "🔐 Password Reset Request - sheSafe",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #ffe6f0;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #e91e8c; text-align: center;">🔐 sheSafe Password Reset</h2>
            <p style="font-size: 16px;">Hello <strong>${user.fullName}</strong>,</p>
            <p style="font-size: 14px; color: #555;">You requested to reset your password. Click the button below to open the app:</p>
           
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="display: inline-block; padding: 15px 40px; background-color: #e91e8c; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Reset Password in App
              </a>
            </div>
           
            <div style="background: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ffc107;">
              <p style="margin: 0 0 10px 0; color: #856404; font-weight: bold;">📱 Instructions:</p>
              <ol style="margin: 0; padding-left: 20px; color: #856404; font-size: 13px;">
                <li>Make sure sheSafe app is <strong>installed</strong> on your device</li>
                <li>Click the button above</li>
                <li>A page will open and redirect to the app</li>
                <li>If app doesn't open automatically, click the manual buttons</li>
              </ol>
            </div>
           
            <p style="color: #666; font-size: 13px; margin-top: 20px;">Or copy this link:</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; word-break: break-all; font-size: 12px;">
              ${resetUrl}
            </div>
           
            <div style="background: #ffebee; padding: 12px; margin: 20px 0; border-radius: 4px; border-left: 4px solid #f44336;">
              <p style="margin: 0; color: #c62828; font-size: 13px;">
                <strong>⏰ Important:</strong> This link expires in 1 hour
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




    console.log(`✅ Reset email sent successfully to: ${user.email}`);




    res.json({
      message: `Password reset link has been sent to ${user.email}. Please check your inbox and spam folder.`,
      success: true,
    });




  } catch (error) {
    console.error("❌ Forgot password error:", error);
    res.status(500).json({
      message: "Failed to send reset email",
      error: error.message,
    });
  }
};




// 📌 ✅ RESET PASSWORD
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;




    console.log(`🔑 Reset password request - Token: ${token.substring(0, 10)}...`);




    if (!password || password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }




    // Find user with valid token
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });




    if (!user) {
      console.log(`❌ Invalid or expired token: ${token.substring(0, 10)}...`);
      return res.status(400).json({
        message: "Invalid or expired reset token",
      });
    }




    console.log(`✅ Valid token found for user: ${user.email}`);




    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);




    // Clear reset token
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;




    await user.save();




    console.log(`✅ Password reset successful for: ${user.email}`);




    res.json({
      message: "Password reset successfully! You can now login.",
      success: true,
    });




  } catch (error) {
    console.error("❌ Reset password error:", error);
    res.status(500).json({
      message: "Password reset failed",
      error: error.message,
    });
  }
};




// 📌 Update user profile
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, emergencyContact, age, bio, profilePic } = req.body;




    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }




    if (fullName !== undefined) user.fullName = fullName;
    if (email !== undefined) user.email = email;
    if (emergencyContact !== undefined) user.emergencyContact = emergencyContact;
    if (age !== undefined) user.age = age;
    if (bio !== undefined) user.bio = bio;
    if (profilePic !== undefined) user.profilePic = profilePic;




    const updatedUser = await user.save();




    res.json({
      message: "Profile updated successfully",
      user: {
        _id: updatedUser._id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        emergencyContact: updatedUser.emergencyContact,
        age: updatedUser.age,
        bio: updatedUser.bio,
        profilePic: updatedUser.profilePic,
      },
    });
  } catch (error) {
    console.error("Update User Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};




// 📌 Get User by ID
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      data: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        emergencyContact: user.emergencyContact,
        age: user.age,
        bio: user.bio,
        profilePic: user.profilePic,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};




// ✅ Export all functions
module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  updateUser,
  getUserById,
};



