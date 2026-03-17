



import mongoose from "mongoose";

const seatBookingSchema = new mongoose.Schema(
  {
    seatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seat",
      required: true
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true
    },

    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      required: true,
      index: true
    },

    shift: {
      type: String,
      enum: ["morning", "evening", "fullDay"],
      default: "fullDay"
    },

    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active"
    },

    checkIn: {
      type: Date,
      default: Date.now
    },

    checkOut: {
      type: Date
    }

  },
  { timestamps: true }
);


// prevent duplicate seat booking
seatBookingSchema.index(
  { seatId: 1, shift: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);


// prevent student multiple seats
seatBookingSchema.index(
  { studentId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

export default mongoose.models.SeatBooking || mongoose.model("SeatBooking", seatBookingSchema);