import mongoose from "mongoose";

const feesSchema = new mongoose.Schema(
  {
    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      required: true,
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    // REGISTRATION FEES
    registrationFees: {
      type: Number,
      default: 0,
      min: 0,
    },

    // MONTHLY / RENEWAL FEES
    monthlyFees: {
      type: Number,
      default: 0,
      min: 0,
    },

    // PAID AMOUNT
    // Always calculated as:
    // cashAmount + onlineAmount
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // CASH PAID AMOUNT
    cashAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ONLINE PAID AMOUNT
    onlineAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // TRANSACTION TYPE
    transactionType: {
      type: String,
      enum: ["new_admission", "renewal"],
      default: "new_admission",
      index: true,
    },

    // Renewal / next membership end date
    renewalDate: {
      type: Date,
      default: null,
    },

    // DUE AMOUNT
    dueAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // PAYMENT STATUS
    paymentStatus: {
      type: String,
      enum: ["paid", "partial", "pending"],
      default: "pending",
    },

    // TOTAL AMOUNT
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // PLAN TYPE
    planType: {
      type: String,
      enum: [
        "monthly",
        "quarterly",
        "halfYearly",
        "yearly",
        "custom",
      ],
      required: true,
    },

    // STUDY HOURS
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
        "Full Day",
      ],
    },

    // PAYMENT DATE
    paymentDate: {
      type: Date,
      default: Date.now,
    },

    // START DATE
    startDate: {
      type: Date,
      required: true,
    },

    // END DATE
    endDate: {
      type: Date,
    },

    // RECEIPT NUMBER
    receiptNumber: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);


// ============================================================
// AUTO CALCULATIONS
// ============================================================
feesSchema.pre("save", function (next) {
  // Total Amount
  this.totalAmount =
    Number(this.registrationFees || 0) +
    Number(this.monthlyFees || 0);

  // Paid Amount
  this.paidAmount =
    Number(this.cashAmount || 0) +
    Number(this.onlineAmount || 0);

  // Due Amount
  this.dueAmount = Math.max(
    Number(this.totalAmount || 0) -
      Number(this.paidAmount || 0),
    0
  );

  // Payment Status
  if (this.dueAmount <= 0) {
    this.paymentStatus = "paid";
  } else if (this.paidAmount > 0) {
    this.paymentStatus = "partial";
  } else {
    this.paymentStatus = "pending";
  }

  if (!this.startDate) {
    return next();
  }

  // Custom Plan => Manual End Date
  if (this.planType === "custom") {
    return next();
  }

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

  next();
});


export default mongoose.models.Fees ||
  mongoose.model("Fees", feesSchema);