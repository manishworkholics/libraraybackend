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

    logo: {
      type: String,
      default: ""
    },

    isActive: {
      type: Boolean,
      default: true
    },

    libraryCode: {
      type: String,
      unique: true
    },

    // The owner account that manages this branch. The first library of an
    // owner is also treated as that owner's primary branch.
    ownerAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null
    }
  },
  { timestamps: true }
);

librarySchema.index({ email: 1 });
librarySchema.index({ ownerAdminId: 1 });

export default mongoose.models.Library ||
mongoose.model("Library", librarySchema);
