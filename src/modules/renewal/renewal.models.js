import mongoose from "mongoose";

const renewalSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student"
    },

    amount: Number,
    planDuration: Number,

    lastRenewalDate: Date,
    renewDate: Date,
    nextRenewDate: Date,

    createdAt: {
        type: Date,
        default: Date.now
    }
});
export default mongoose.models.Renewal || mongoose.model("Renewal", renewalSchema);