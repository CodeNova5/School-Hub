import { Schema, model, models } from "mongoose";

const StudentSchema = new Schema(
  {
    fullName: { type: String, required: true },
    gender: { type: String, enum: ["Male", "Female"], required: true },
    email: { type: String, required: true, unique: true },
    address: { type: String },
    phone: { type: String },
    className: { type: String, required: true },
    admissionNumber: { type: String, unique: true },
    parentName: { type: String },
    parentEmail: { type: String },
    parentPhone: { type: String },
    status: {
      type: String,
      enum: ["active", "graduated", "pending"],
      default: "active",
    },
    password: { type: String }, // optional for portal login later
  },
  { timestamps: true }
);

export default models.Student || model("Student", StudentSchema);
