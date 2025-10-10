import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import Admission from "@/models/Admission";

export async function PUT(req: Request) {
  try {
    await dbConnect();

    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json(
        { success: false, message: "ID and status are required" },
        { status: 400 }
      );
    }

    const updatedAdmission = await Admission.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedAdmission) {
      return NextResponse.json(
        { success: false, message: "Admission not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Admission status updated successfully",
      data: updatedAdmission,
    });
  } catch (error) {
    console.error("Error updating admission:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
