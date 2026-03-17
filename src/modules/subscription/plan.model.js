import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    price: {
      type: Number,
      required: true,
    },

    durationDays: {
      type: Number,
      required: true,
    },

    maxStudents: {
      type: Number,
      default: 0,
    },

    maxSeats: {
      type: Number,
      default: 0,
    },

    features: [
      {
        type: String,
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Plan", planSchema);