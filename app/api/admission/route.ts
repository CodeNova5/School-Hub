import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import Admission from "@/lib/models/Admission";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const data = await req.json();

    const newAdmission = await Admission.create(data);

    return NextResponse.json(
      { success: true, message: "Application submitted successfully", admission: newAdmission },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admission error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to submit application" },
      { status: 500 }
    );
  }
}

// (Optional) add GET handler to avoid 405 on accidental GET requests
export async function GET() {
  return NextResponse.json({ message: "Admissions API ready" });
}
