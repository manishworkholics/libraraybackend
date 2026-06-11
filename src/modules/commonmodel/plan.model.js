import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    maxSeats: {
      type: Number,
      required: true,
      min: 1,
    },

    monthlyPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    quarterlyPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    
    halfYearlyPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    yearlyPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Plan", planSchema);