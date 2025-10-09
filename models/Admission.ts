import { Schema, models, model } from "mongoose";

const AdmissionSchema = new Schema(
  {
    // --- Student Info ---
    studentFirstName: { type: String, required: true },
    studentLastName: { type: String, required: true },
    studentMiddleName: { type: String },

    gender: { type: String, enum: ["Male", "Female"], required: true },
    dateOfBirth: { type: Date, required: true },
    address: { type: String, required: true },

    classApplyingFor: { type: String, required: true },

    // --- Parent / Guardian Info ---
    parentFirstName: { type: String, required: true },
    parentLastName: { type: String, required: true },
    parentMiddleName: { type: String },
    parentEmail: { type: String, required: true },
    parentPhone: { type: String, required: true },
    parentAddress: { type: String, required: true },

    // --- Application Status ---
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export default models.Admission || model("Admission", AdmissionSchema);
