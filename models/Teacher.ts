import { Schema, models, model } from "mongoose";

const TeacherSchema = new Schema(
  {
    fullName: { type: String, required: true },
    username: { type: String, required: true, unique: true, minlength: 6 },
    gender: { type: String, enum: ["Male", "Female"], required: true },
    email: { type: String, required: true, unique: true },
    address: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    assignedClass: { type: String }, // optional
    status: { type: String, enum: ["active", "inactive", "pending"], default: "pending" },
    activationToken: { type: String }, // for email verification
    password: { type: String, required: true }, // will be auto-generated or set later
  },
  { timestamps: true }
);

export default models.Teacher || model("Teacher", TeacherSchema);
