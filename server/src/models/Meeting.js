import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: "", maxlength: 2000 },
  host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  scheduledAt: { type: Date },
  status: { type: String, enum: ["scheduled", "live", "completed"], default: "scheduled" },
  roomId: { type: String, required: true, unique: true },
  transcript: { type: String, default: "" },
  summary: { type: String, default: "" },
  actionItems: [{
    text: { type: String, required: true },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    done: { type: Boolean, default: false }
  }]
}, { timestamps: true });

export default mongoose.model("Meeting", meetingSchema);
