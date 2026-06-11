import mongoose from "mongoose";

const librarySubscriptionSchema = new mongoose.Schema(
  {
    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      required: true,
      index: true
    },

    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true
    },

    durationType: {
      type: String,
      enum: [
        "Monthly",
        "Quarterly",
        "HalfYearly",
        "Yearly"
      ],
      required: true
    },

    startDate: {
      type: Date,
      required: true
    },

    endDate: {
      type: Date,
      required: true
    },

    activatedBy: {
      type: String,
      enum: ["library", "superadmin"],
      default: "superadmin"
    },

    status: {
      type: String,
      enum: ["active", "expired"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model(
  "LibrarySubscription",
  librarySubscriptionSchema
);