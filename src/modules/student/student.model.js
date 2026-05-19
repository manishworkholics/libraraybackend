import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    fathername: {
      type: String,
      trim: true
    },

    email: {
      type: String,
      lowercase: true,
      trim: true
    },

    phone: {
      type: String,
      required: true,
      trim: true
    },

    address: {
      type: String,
      required: true,
      trim: true
    },

    dob: {
      type: Date
    },

    gender: {
      type: String,
      enum: ["Male", "Female", "Other"]
    },

    documentNumber: {
      type: String,
      required: true,
      trim: true
    },

    referralCode: {
      type: String,
      trim: true,
      default: null
    },
    documentPhoto: {
      type: String
    },

    passportPhoto: {
      type: String
    },

    enrollmentNumber: {
      type: String,
      required: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    timeSlot: {
      type: String,
      required: true
    },

    course: {
      type: String,
      required: true
    },

    studyHours: {
      type: String,
      required: true,
      enum: [
        "3 Hours",
        "4 Hours",
        "5 Hours",
        "6 Hours",
        "7 Hours",
        "8 Hours",
        "9 Hours",
        "10 Hours",
        "11 Hours",
        "12 Hours",
        "Full Day"
      ]
    },

    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Slot",
      default: null
    },

    status: {
      type: String,
      enum: ["active", "inactive",],
      default: "active"
    },

    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

/* 🔥 SaaS Safe Unique Index */
studentSchema.index(
  { enrollmentNumber: 1, libraryId: 1 },
  { unique: true }
);

/* 🔥 Email unique per library */
studentSchema.index(
  { email: 1, libraryId: 1 },
  { unique: true, sparse: true }
);

export default mongoose.models.Student || mongoose.model("Student", studentSchema);