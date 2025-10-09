import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import Admin from "@/models/Admin";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { email, password } = await req.json();

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return NextResponse.json({ message: "Invalid email" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return NextResponse.json({ message: "Invalid password" }, { status: 401 });
    }

    const token = jwt.sign(
      { id: admin._id, email: admin.email },
      process.env.JWT_SECRET!,
      { expiresIn: "1d" }
    );

    // send token as cookie
    const response = NextResponse.json({ success: true, token });
    response.cookies.set("admin_token", token, { httpOnly: true, path: "/" });
    return response;

  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
