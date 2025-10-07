import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import Admission from "@/lib/models/Admission";

export async function POST(req) {
  try {
    // Connect to MongoDB
    await dbConnect();

    // Parse JSON body
    const data = await req.json();

    // Save to DB
    const newAdmission = await Admission.create(data);

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: "Application submitted successfully",
        admission: newAdmission,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admission error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to submit application",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
