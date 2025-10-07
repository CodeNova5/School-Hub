import mongoose, { Schema, models, model } from "mongoose";

const StudentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    classLevel: { type: String, required: true }, // e.g. "JSS1", "SS3"
    admissionNumber: { type: String, unique: true },
    dateOfBirth: Date,
    gender: { type: String, enum: ["Male", "Female"] },
    guardian: {
      name: String,
      phone: String,
      email: String,
    },
    address: String,
    attendance: [
      {
        date: Date,
        present: Boolean,
      },
    ],
    subjects: [
      {
        name: String,
        score: Number,
        grade: String,
      },
    ],
  },
  { timestamps: true }
);

export default models.Student || model("Student", StudentSchema);
