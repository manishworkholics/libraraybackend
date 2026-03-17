import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      required: true,
      unique: true
    },

    seq: {
      type: Number,
      default: 1000
    }
  },
  { timestamps: true }
);

export default mongoose.models.Counter || mongoose.model("Counter", counterSchema);