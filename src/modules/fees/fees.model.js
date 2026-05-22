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
        "quarterly",
        "halfYearly",
        "yearly",
        "custom"
      ],
      required: true
    },
    studyHours: {
      type: String,
      required: true,
      enum: [
        "3 Hours",
        "4 Hours",
        "5 Hours",
        "6 Hours",
        "7 Hours",
        "8 Hours",
        "9 Hours",
        "10 Hours",
        "11 Hours",
        "12 Hours",
        "Full Day"
      ]
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
    dueAmount: {
      type: Number,
      default: 0
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
    case "quarterly":
      end.setMonth(end.getMonth() + 3);
      break;
    case "halfYearly":
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
