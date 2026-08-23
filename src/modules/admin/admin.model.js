import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    email: {
      type: String,
      required: function () { return this.role !== "branchAdmin"; },
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    // 🔥 Connect Admin to Library
    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      required: true
    },

    // Present only for branch admins. A branch is always owned by libraryId.
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      index: true
    },

    // 🔥 Role-based system
    role: {
      type: String,
      enum: ["superAdmin", "owner", "branchAdmin", "staff", "accountant"],
      default: "owner"
    },

    isActive: {
      type: Boolean,
      default: true
    },
    resetPasswordToken: String,

    resetPasswordExpire: Date,

    resetOtp: Number,

    resetOtpExpire: Date,
  },
  { timestamps: true }
);

export default mongoose.models.Admin || mongoose.model("Admin", adminSchema);
