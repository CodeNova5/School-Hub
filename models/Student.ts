// models/Student.ts
import mongoose from "mongoose";

const resultSchema = new mongoose.Schema({
  subject: String,
  welcomeTest: { type: Number, default: 0 },
  midTerm: { type: Number, default: 0 },
  vetting: { type: Number, default: 0 },
  exam: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  grade: { type: String, default: "" },
});

const studentSchema = new mongoose.Schema({
  fullName: String,
  gender: String,
  admissionNumber: String,
  className: String,
  department: {
    type: String,
    enum: ["Science", "Arts", "Commercial"],
    required: true,
  },
  attendance: [
    {
      date: Date,
      status: String,
    },
  ],
  averageAttendance: { type: Number, default: 0 },
  results: [resultSchema],
});

export default mongoose.models.Student ||
  mongoose.model("Student", studentSchema);
