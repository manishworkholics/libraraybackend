import mongoose from "mongoose";

const seatSchema = new mongoose.Schema(
  {
    seatNumber: {
      type: String,
      required: true,
      trim: true
    },

    floor: {
      type: String,
      default: "Ground",
      trim: true
    },

    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

// ✅ Unique seat per library
seatSchema.index(
  { seatNumber: 1, libraryId: 1 },
  { unique: true }
);

export default mongoose.models.Seat || mongoose.model("Seat", seatSchema);