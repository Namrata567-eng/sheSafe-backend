// middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Main auth middleware (named export)
export const auth = async (req, res, next) => {
  try {
    console.log('🔐 Auth middleware called');
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer")) {
      console.error('❌ No token provided');
      return res.status(401).json({ 
        success: false,
        message: "Not authorized, no token" 
      });
    }

    const token = authHeader.split(" ")[1];
    console.log('Token received:', token.substring(0, 20) + '...');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token decoded:', decoded);
    
    const user = await User.findById(decoded.id).select("-password");
    
    if (!user) {
      console.error('❌ User not found');
      return res.status(401).json({ 
        success: false,
        message: "User not found" 
      });
    }
    
    console.log('✅ User authenticated:', user.email);
    req.user = user;
    next();
    
  } catch (error) {
    console.error('❌ Auth error:', error.message);
    return res.status(401).json({ 
      success: false,
      message: "Not authorized, token failed",
      error: error.message 
    });
  }
};

// Alias for compatibility (same function, different name)
export const protect = auth;

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    console.log("\n" + "🔐".repeat(25));
    console.log("AUTH MIDDLEWARE CHECK");
    console.log("🔐".repeat(25));
    console.log("📝 Auth Header:", authHeader);

    if (!authHeader) {
      console.log("❌ No authorization header");
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    console.log("🎫 Token:", token.substring(0, 20) + "...");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    console.log("✅ Token Decoded Successfully!");
    console.log("📦 Decoded Payload:", decoded);
    console.log("🆔 User ID:", decoded.id || decoded._id || decoded.userId);
    console.log("📧 Email:", decoded.email);

    // ✅ Attach user to request with BOTH id formats
    req.user = {
      _id: decoded.id || decoded._id || decoded.userId,
      id: decoded.id || decoded._id || decoded.userId,
      email: decoded.email,
      fullName: decoded.fullName
    };

    console.log("✅ req.user set:", req.user);
    console.log("🔐".repeat(25) + "\n");

    next();
  } catch (error) {
    console.error("❌ Auth Middleware Error:", error.message);
    console.log("🔐".repeat(25) + "\n");
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};
// Default export
export default auth;
