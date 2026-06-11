import mongoose from "mongoose";

const librarySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    ownerName: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    ownerEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },

    phone: String,

    address: String,

    isActive: {
      type: Boolean,
      default: true
    },

    libraryCode: {
      type: String,
      unique: true
    }
  },
  { timestamps: true }
);

librarySchema.index({ email: 1 });

export default mongoose.models.Library ||
mongoose.model("Library", librarySchema);