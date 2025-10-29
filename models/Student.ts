// models/Student.ts
import mongoose from "mongoose";

const AttendanceSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  status: { type: String, enum: ["Present", "Absent", "Late"], default: "Present" },
});

const StudentSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    gender: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    address: { type: String },
    phone: { type: String },
    className: { type: String, required: true },
    admissionNumber: { type: String, unique: true },
    parentName: { type: String },
    parentPhone: { type: String },
    parentEmail: { type: String },
    addedByTeacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },

    // New fields 👇
    attendance: [AttendanceSchema],
    averageAttendance: { type: Number, default: 0 },
    results: [
      {
        subject: String,
        testScore: Number,
        examScore: Number,
        total: Number,
        grade: String,
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.models.Student ||
  mongoose.model("Student", StudentSchema);
