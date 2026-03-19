import mongoose from "mongoose";

const feesSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true
    },

    amountPaid: {
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
    paymentDate: {
      type: String, // YYYY-MM-DD
      default: () => new Date().toISOString().split("T")[0]
    },

    paymentMode: {
      type: String,
      enum: ["cash", "upi", "card", "bankTransfer"],
      default: "cash"
    },
  },
  { timestamps: true }
);

export default mongoose.models.Fees || mongoose.model("Fees", feesSchema);
