import mongoose from "mongoose";

const librarySubscriptionSchema = new mongoose.Schema(
  {
    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      required: true,
    },

    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    activatedBy: {
      type: String,
      enum: ["library", "superadmin"],
      default: "library",
    },

    status: {
      type: String,
      enum: ["active", "expired"],
      default: "active",
    },
  },
  { timestamps: true }
);

export default mongoose.model(
  "LibrarySubscription",
  librarySubscriptionSchema
);