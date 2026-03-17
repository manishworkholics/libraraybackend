import mongoose from "mongoose";

const librarySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    ownerName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    ownerEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },

    phone: String,
    address: String,

    subscriptionPlan: {
      type: String,
      enum: ["free", "monthly", "threeMonths", "sixMonths", "yearly", "custom"],
      default: "free"
    },

    subscriptionStartDate: {
      type: Date,
      default: null
    },

    subscriptionExpiresAt: {
      type: Date,
      default: null
    },

    isActive: {
      type: Boolean,
      default: true
    },

    libraryCode: {
      type: String,
      unique: true
    },
  },
  { timestamps: true }
);

// Optional index for faster email search
librarySchema.index({ email: 1 });

export default mongoose.models.Library || mongoose.model("Library", librarySchema);