import mongoose from "mongoose";

const feesSchema = new mongoose.Schema(
  {
    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      required: true
    },
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
      enum: ["cash", "upi",],
      default: "cash"
    },
    startDate: {
      type: Date,
      default: Date.now
    },

    endDate: {
      type: Date
    },

    receiptNumber: String
  },
  { timestamps: true }
);

feesSchema.pre("save", function () {
  const start = new Date(this.startDate);

  switch (this.planType) {
    case "monthly":
      this.endDate = new Date(start.setMonth(start.getMonth() + 1));
      break;
    case "threeMonths":
      this.endDate = new Date(start.setMonth(start.getMonth() + 3));
      break;
    case "sixMonths":
      this.endDate = new Date(start.setMonth(start.getMonth() + 6));
      break;
    case "yearly":
      this.endDate = new Date(start.setFullYear(start.getFullYear() + 1));
      break;
    default:
      this.endDate = start;
  }
});

export default mongoose.models.Fees || mongoose.model("Fees", feesSchema);
