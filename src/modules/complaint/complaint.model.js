import mongoose from "mongoose";

const complaintSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true
    },

    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      required: true,
      index: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      required: true
    },

    status: {
      type: String,
      enum: ["pending", "inProgress", "resolved"],
      default: "pending"
    }
  },
  { timestamps: true }
);

export default mongoose.models.Complaint || mongoose.model("Complaint", complaintSchema);