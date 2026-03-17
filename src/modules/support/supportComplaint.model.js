import mongoose from "mongoose";

const supportComplaintSchema = new mongoose.Schema(
  {
    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      required: true
    },

    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true
    },

    subject: {
      type: String,
      required: true
    },

    category: {
      type: String
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Low"
    },

    description: {
      type: String
    },

    attachment: {
      type: String
    },

    status: {
      type: String,
      enum: ["Pending", "In Progress", "Resolved"],
      default: "Pending"
    },
    complaintNumber: {
      type: Number,
      unique: true
    },
  },
  { timestamps: true }
);

export default mongoose.models.SupportComplaint || mongoose.model(
  "SupportComplaint",
  supportComplaintSchema
);