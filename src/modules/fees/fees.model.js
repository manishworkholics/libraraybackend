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

    paymentDate: {
      type: String, // YYYY-MM-DD
      default: () => new Date().toISOString().split("T")[0]
    },

    month: String, // example: "Jan-2026"

    note: String
  },
  { timestamps: true }
);

export default mongoose.models.Fees || mongoose.model("Fees", feesSchema);
