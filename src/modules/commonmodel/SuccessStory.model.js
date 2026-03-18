import mongoose from "mongoose";

const successStorySchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    image: String,
    coupleName: String,
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("SuccessStory", successStorySchema);