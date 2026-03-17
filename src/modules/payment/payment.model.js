import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
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

    amount: {
      type: Number,
      required: true
    },

    planType: {
      type: String,
      enum: [
        "monthly",
        "threeMonths",
        "sixMonths",
        "yearly",
        "custom"
      ],
      required: true
    },

    startDate: {
      type: Date,
    },

    endDate: {
      type: Date,
    },

    paymentMode: {
      type: String,
      enum: ["cash", "upi", "card", "bankTransfer"],
      default: "cash"
    },

    receiptNumber: {
      type: String,
    },

    addedBy: {
      type: String,
      enum: ["admin"],
      default: "admin"
    }
  },
  { timestamps: true }
);

// Fast lookup
paymentSchema.index({ studentId: 1 });

export default mongoose.models.Payment || mongoose.model("Payment", paymentSchema);