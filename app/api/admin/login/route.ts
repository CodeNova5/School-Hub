import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import Admin from "@/models/Admin";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { email, password } = await req.json();

    console.log("🔍 Checking admin for email:", email);
    const admin = await Admin.findOne({ email });
    if (!admin) {
      console.log("❌ No admin found");
      return NextResponse.json({ message: "Invalid email" }, { status: 401 });
    }

    console.log("✅ Admin found:", admin.email);

    const valid = await bcrypt.compare(password, admin.password);
    console.log("🔐 Password valid?", valid);

    if (!valid) {
      return NextResponse.json({ message: "Invalid password" }, { status: 401 });
    }

    if (!process.env.JWT_SECRET) {
      console.error("⚠️ JWT_SECRET not defined in .env.local");
      return NextResponse.json({ message: "Server configuration error" }, { status: 500 });
    }

    const token = jwt.sign(
      { id: admin._id, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    const response = NextResponse.json({ success: true, token });
    response.cookies.set("admin_token", token, { httpOnly: true, path: "/" });

    console.log("✅ Login successful, token generated");
    return response;
  } catch (error) {
    console.error("💥 Login error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
