import mongoose, { Schema, models, model } from "mongoose";

const AdmissionSchema = new Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    gender: { type: String, enum: ["Male", "Female"], required: true },
    address: { type: String, required: true },
    previousSchool: { type: String },
    classApplyingFor: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    guardianName: { type: String },
    guardianPhone: { type: String },
  },
  { timestamps: true }
);

export default models.Admission || model("Admission", AdmissionSchema);
