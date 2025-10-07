import mongoose, { Schema, models, model } from "mongoose";

const TeacherSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    subject: { type: String, required: true },
    phone: String,
    address: String,
    classes: [String], // e.g. ["JSS1", "SS2"]
  },
  { timestamps: true }
);

export default models.Teacher || model("Teacher", TeacherSchema);
