import Complaint from "./complaint.model.js";


// 1️⃣ Student Create Complaint
export const createComplaint = async (req, res) => {
  try {
    const { title, description } = req.body;
    const { userId: studentId, libraryId } = req.user;

    const complaint = await Complaint.create({
      studentId,
      libraryId,
      title,
      description
    });

    res.status(201).json({
      message: "Complaint submitted successfully",
      complaint
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2️⃣ Student View Own Complaints
export const getMyComplaints = async (req, res) => {
  try {
    const { userId: studentId } = req.user;

    const complaints = await Complaint.find({
      studentId
    }).sort({ createdAt: -1 });

    res.json(complaints);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3️⃣ Admin View All Complaints
export const getAllComplaints = async (req, res) => {
  try {
    const { libraryId } = req.user;

    const complaints = await Complaint.find({
      libraryId
    })
      .populate("studentId", "name enrollmentNumber")
      .sort({ createdAt: -1 });

    res.json(complaints);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4️⃣ Admin Update Complaint Status
export const updateComplaintStatus = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { status } = req.body;
    const { libraryId } = req.user;

    const complaint = await Complaint.findOne({
      _id: complaintId,
      libraryId
    });

    if (!complaint) {
      return res.status(404).json({
        message: "Complaint not found"
      });
    }

    complaint.status = status;
    await complaint.save();

    res.json({
      message: "Complaint status updated",
      complaint
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
