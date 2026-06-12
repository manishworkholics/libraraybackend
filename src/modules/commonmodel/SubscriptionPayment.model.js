import mongoose from "mongoose";

const subscriptionPaymentSchema = new mongoose.Schema(
  {
    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      required: true
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

    amount: {
      type: Number,
      required: true
    },

    paymentMode: {
      type: String,
      enum: [
        "cash",
        "upi",
        "bankTransfer",
        "card"
      ],
      default: "cash"
    },

    status: {
      type: String,
      enum: [
        "Active",
        "Expired",
      ],
      default: "Active"
    },

    receivedBy: {
      type: String,
      default: "superAdmin"
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model(
  "SubscriptionPayment",
  subscriptionPaymentSchema
);