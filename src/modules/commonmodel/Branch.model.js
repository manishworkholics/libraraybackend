import mongoose from "mongoose";

const branchSchema = new mongoose.Schema(
  {
    libraryId: { type: mongoose.Schema.Types.ObjectId, ref: "Library", required: true, index: true },
    name: { type: String, required: true, trim: true },
    // Human-readable credential used by the branch login, e.g. BR-0001.
    branchId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

branchSchema.index({ libraryId: 1, name: 1 }, { unique: true });

export default mongoose.models.Branch || mongoose.model("Branch", branchSchema);
