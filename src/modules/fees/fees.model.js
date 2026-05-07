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
    hours: {
      type: Number,
      required: true
    },
    paymentDate: {
      type: Date,
      default: Date.now
    },

    paymentMode: {
      type: String,
      enum: ["cash", "upi",],
      default: "cash"
    },
    startDate: {
      type: Date,
      required: true
    },

    endDate: {
      type: Date
    },

    receiptNumber: String
  },
  { timestamps: true }
);

feesSchema.pre("save", function (next) { 
  const start = new Date(this.startDate);
  const end = new Date(start);

  switch (this.planType) {
    case "monthly":
      end.setMonth(end.getMonth() + 1);
      break;
    case "threeMonths":
      end.setMonth(end.getMonth() + 3);
      break;
    case "sixMonths":
      end.setMonth(end.getMonth() + 6);
      break;
    case "yearly":
      end.setFullYear(end.getFullYear() + 1);
      break;
    default:
      break;
  }

  this.endDate = end;
});

export default mongoose.models.Fees || mongoose.model("Fees", feesSchema);
