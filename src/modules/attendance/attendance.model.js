import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
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

    date: {
      type: Date,
      required: true
    },

    checkInTime: {
      type: Date,
      default: null
    },

    checkOutTime: {
      type: Date,
      default: null
    },

    autoCheckoutTime: {
      type: Date,
      default: null
    },

    totalHours: {
      type: Number,
      default: 0
    },
    markedBy: {
      type: String,
      enum: ["student", "admin"],
      required: true
    }
  },
  { timestamps: true }
);

// Prevent duplicate attendance per day per student
attendanceSchema.index(
  { studentId: 1, date: 1 },
  { unique: true }
);

export default mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);