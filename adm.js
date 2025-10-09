import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGO_URI = "mongodb+srv://teshor09:43r2xAfVfFBmJbG@cluster0.gcfnryp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"; // <-- Replace this with your actual MongoDB URI

// Define admin schema
const adminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

// Create model
const Admin = mongoose.models.Admin || mongoose.model("Admin", adminSchema);

async function seedAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const name = "CodeNovaX";
    const email = "codenova02@gmail.com";
    const plainPassword = "admin123"; // <-- Change this before running

    // Check if admin already exists
    const existing = await Admin.findOne({ email });
    if (existing) {
      console.log("⚠️ Admin already exists!");
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // Create new admin
    const newAdmin = new Admin({
      name,
      email,
      password: hashedPassword,
    });

    await newAdmin.save();
    console.log("🎉 Admin created successfully!");
    console.log({
      name,
      email,
      password: plainPassword,
    });

    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding admin:", err);
    process.exit(1);
  }
}

seedAdmin();
