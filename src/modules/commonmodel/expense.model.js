import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },

    amount: {
      type: Number,
      required: true
    },

    category: {
      type: String,
      enum: ["hosting", "marketing", "salary", "maintenance", "other"],
      default: "other"
    },

    mode: {
      type: String,
      enum: ["cash", "upi", "card", "bankTransfer"],
      default: "cash"
    },

    status: {
      type: String,
      enum: ["Paid", "Pending"],
      default: "Paid"
    },

    date: {
      type: Date,
      default: Date.now
    },

    notes: String,
    // 🔥 IMPORTANT FIELDS
    type: {
      type: String,
      enum: ["platform", "library"],
      required: true
    },
    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      default: null
    },
    // 🔥 ADD THIS
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
  },
  { timestamps: true }
);

export default mongoose.models.Expense || mongoose.model("Expense", expenseSchema);