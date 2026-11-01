import mongoose from "mongoose";

// A receipt is intentionally separate from Fees. Fees represents the
// membership charge and its current balance; a receipt represents money
// actually received on one particular day.
const feePaymentSchema = new mongoose.Schema(
  {
    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      required: true,
      index: true,
    },
    feeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fees",
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    cashAmount: { type: Number, default: 0, min: 0 },
    onlineAmount: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    // Snapshot values make historical receipts stable even after a later
    // payment clears the balance on the parent fee.
    totalAmount: { type: Number, default: 0, min: 0 },
    dueAmount: { type: Number, default: 0, min: 0 },
    paymentDate: { type: Date, required: true, index: true },
    transactionType: {
      type: String,
      enum: ["new_admission", "renewal", "due_payment"],
      required: true,
    },
    idempotencyKey: { type: String, default: null },
  },
  { timestamps: true }
);

feePaymentSchema.pre("validate", function (next) {
  this.paidAmount = Number(this.cashAmount || 0) + Number(this.onlineAmount || 0);
  next();
});

feePaymentSchema.index(
  { libraryId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  }
);

export default mongoose.models.FeePayment ||
  mongoose.model("FeePayment", feePaymentSchema);
