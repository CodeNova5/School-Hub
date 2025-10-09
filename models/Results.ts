import { Schema, models, model } from "mongoose";

const AnnouncementSchema = new Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    author: { type: String, required: true },
    targetGroup: {
      type: String,
      enum: ["all", "students", "teachers", "parents"],
      default: "all",
    },
  },
  { timestamps: true }
);

export default models.Announcement || model("Announcement", AnnouncementSchema);
