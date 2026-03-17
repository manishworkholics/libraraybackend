import SupportComplaint from "./supportComplaint.model.js";

// Library create complaint
export const createComplaint = async (req, res) => {
  try {

    const { subject, category, priority, description, attachment } = req.body;

    const lastComplaint = await SupportComplaint
      .findOne({ complaintNumber: { $exists: true } })
      .sort({ complaintNumber: -1 });

    const complaintNumber = lastComplaint
      ? lastComplaint.complaintNumber + 1
      : 1;

    const complaint = await SupportComplaint.create({
      libraryId: req.user.libraryId,
      adminId: req.user.userId,
      complaintNumber,
      subject,
      category,
      priority,
      description,
      attachment
    });

    res.status(201).json({
      success: true,
      message: "Complaint submitted",
      data: complaint
    });

  } catch (error) {

    res.status(500).json({
      success:false,
      message:error.message
    });

  }
};


// Get complaints of library
export const getLibraryComplaints = async (req, res) => {
  try {

    const complaints = await SupportComplaint.find({
      libraryId: req.user.libraryId
    })
      .populate("adminId", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: complaints.length,
      data: complaints
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};