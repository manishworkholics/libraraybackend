import mongoose from "mongoose";

const successStorySchema = new mongoose.Schema(
  {
    name: String,
    exam: String,
    message: String,
    image: String,
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("SuccessStory", successStorySchema);