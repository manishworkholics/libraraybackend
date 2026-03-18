import mongoose from "mongoose";

const gallerySchema = new mongoose.Schema(
  {
    title: String,
    image: String,
    category: String,
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("Gallery", gallerySchema);