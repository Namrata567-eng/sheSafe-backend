// models/User.js - FIXED VERSION (No Double Hashing)
import mongoose from "mongoose";
import bcrypt from "bcryptjs";


const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  emergencyContact: { type: String, required: true },
  age: { type: Number, required: false },
  bio: { type: String, required: false },
  profilePic: { type: String },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
}, { timestamps: true });




// ✅ FIXED: Hash password before saving (with double-hash prevention)
userSchema.pre("save", async function (next) {
  // Skip if password is not modified
  if (!this.isModified("password")) {
    console.log("⏭️  Password not modified, skipping hash");
    return next();
  }
 
  // ✅ CRITICAL FIX: Check if password is already hashed
  // Bcrypt hashes always start with $2a$ or $2b$
  if (this.password && (this.password.startsWith("$2b$") || this.password.startsWith("$2a$"))) {
    console.log("⚠️  Password already hashed, skipping re-hash");
    return next();
  }
 
  try {
    console.log(`🔐 Hashing new password for: ${this.email}`);
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    console.log(`✅ Password hashed successfully (length: ${this.password.length})`);
    next();
  } catch (error) {
    console.error("❌ Error hashing password:", error);
    next(error);
  }
});


// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  try {
    console.log(`🔍 Comparing password for: ${this.email}`);
    console.log(`   Entered: "${enteredPassword}" (length: ${enteredPassword.length})`);
    console.log(`   Stored hash: ${this.password.substring(0, 29)}...`);
   
    const isMatch = await bcrypt.compare(enteredPassword, this.password);
   
    console.log(`   Result: ${isMatch ? "✅ MATCH" : "❌ NO MATCH"}`);
    return isMatch;
  } catch (error) {
    console.error("❌ Error comparing password:", error);
    return false;
  }
};


export default mongoose.models.User || mongoose.model("User", userSchema);
