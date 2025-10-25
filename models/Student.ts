import { Schema, model, models } from "mongoose";

const StudentSchema = new Schema(
  {
    fullName: { type: String, required: true },
    gender: { type: String, enum: ["Male", "Female"], required: true },
    email: { type: String, unique: true, sparse: true },
    address: { type: String },
    phone: { type: String },
    className: { type: String, required: true },
    admissionNumber: { type: String, unique: true },
    parentName: { type: String },
    parentPhone: { type: String },
    parentEmail: { type: String },
    addedByTeacher: { type: String }, // teacher id or name
    status: { type: String, enum: ["active", "pending"], default: "active" },
  },
  { timestamps: true }
);

export default models.Student || model("Student", StudentSchema);
