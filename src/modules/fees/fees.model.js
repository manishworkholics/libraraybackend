import mongoose from "mongoose";

const feesSchema = new mongoose.Schema(

  {

    libraryId: {

      type:
        mongoose.Schema.Types.ObjectId,

      ref:
        "Library",

      required:
        true

    },

    studentId: {

      type:
        mongoose.Schema.Types.ObjectId,

      ref:
        "Student",

      required:
        true

    },

    // ✅ REGISTRATION FEES
    registrationFees: {

      type:
        Number,

      default:
        0

    },

    // ✅ MONTHLY FEES
    monthlyFees: {

      type:
        Number,

      default:
        0

    },

    // ✅ TOTAL AMOUNT
    totalAmount: {

      type:
        Number,

      default:
        0

    },

    // ✅ PLAN TYPE
    planType: {

      type:
        String,

      enum: [

        "monthly",

        "quarterly",

        "halfYearly",

        "yearly",

        "custom"

      ],

      required:
        true

    },

    // ✅ STUDY HOURS
    studyHours: {

      type:
        String,

      required:
        true,

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

    // ✅ PAYMENT DATE
    paymentDate: {

      type:
        Date,

      default:
        Date.now

    },

    // ✅ PAYMENT MODE
    paymentMode: {

      type:
        String,

      enum: [

        "cash",

        "upi"

      ],

      default:
        "cash"

    },

    // ✅ START DATE
    startDate: {

      type:
        Date,

      required:
        true

    },

    // ✅ END DATE
    endDate: {

      type:
        Date

    },

    // ✅ DUE AMOUNT
    dueAmount: {

      type:
        Number,

      default:
        0

    },

    // ✅ RECEIPT NUMBER
    receiptNumber: {

      type:
        String

    },


  },

  {

    timestamps:
      true

  }

);

// ✅ AUTO CALCULATIONS
feesSchema.pre(
  "save",
  function (next) {

    // TOTAL AMOUNT
    this.totalAmount =
      Number(this.registrationFees || 0) +
      Number(this.monthlyFees || 0);

    if (!this.startDate) {
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

    // ✅ IMPORTANT
    next();
  }
);

export default

  mongoose.models.Fees ||

  mongoose.model(
    "Fees",
    feesSchema
  );