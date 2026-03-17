import mongoose from "mongoose";

const platformSubscriptionSchema = new mongoose.Schema(
  {
    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      required: true,
      index: true
    },

    planType: {
      type: String,
      enum: ["monthly", "threeMonths", "sixMonths", "yearly", "custom"],
      required: true
    },

    amount: {
      type: Number,
      required: true
    },

    paymentMode: {
      type: String,
      enum: ["cash", "upi", "bankTransfer", "card"],
      default: "cash"
    },

    status: {
      type: String,
      enum: ["Success", "Pending"],
      default: "Success"
    },
    startDate: {
      type: Date,
      required: true
    },

    endDate: {
      type: Date,
      required: true
    },

    receivedBy: {
      type: String,
      default: "superAdmin"
    }
  },
  { timestamps: true }
);

export default mongoose.models.PlatformSubscription || mongoose.model(
  "PlatformSubscription",
  platformSubscriptionSchema
);