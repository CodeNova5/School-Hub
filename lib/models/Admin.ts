import { Schema, models, model } from "mongoose";

const AdminSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, default: "admin" },
  },
  { timestamps: true }
);

export default models.Admin || model("Admin", AdminSchema);
