import mongoose from "mongoose";

const enquirySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    contact: {
      type: String, // Always string for phone numbers
      required: true,
      trim: true
    },

    address: {
      type: String,
      required: true,
      trim: true
    },

    slot: {
      type: String,
      required: true
    },

    course: {
      type: String,
      required: true
    },

    status: {
      type: String,
      enum: ["new", "contacted", "converted", "rejected"],
      default: "new"
    },

    source: {
      type: String,
      enum: ["website", "manual"],
      default: "website"
    },

    notes: {
      type: String,
      trim: true
    },
    
    /* NEW FIELD - DEMO DATE */
    demoDate: {
      type: Date,
      default: null
    },

    /* NEW FIELD - REMARK */
    remark: {
      type: String,
      trim: true,
      default: ""
    },

    libraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Library",
      required: true,
      index: true
    },

    date: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

/* Index for faster search in SaaS */
enquirySchema.index({ libraryId: 1, contact: 1 });

export default mongoose.models.Enquiry || mongoose.model("Enquiry", enquirySchema);