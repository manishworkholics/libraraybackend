import Enquiry from "./enquiry.model.js";

/* =========================================
   ➕ CREATE ENQUIRY
========================================= */
export const createEnquiry = async (req, res) => {
  try {
    const { name, contact, address, slot, course } = req.body;
    const { libraryId } = req.user;

    if (!name || !contact || !address || !slot || !course) {
      return res.status(400).json({
        message: "Please fill all required fields"
      });
    }

    const enquiry = await Enquiry.create({
      name,
      contact,
      address,
      slot,
      course,
      libraryId
    });

    res.status(201).json({
      message: "Enquiry added successfully",
      enquiry
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



/* =========================================
   📋 GET ALL ENQUIRIES (Pagination + Search)
========================================= */
export const getAllEnquiries = async (req, res) => {
  try {
    const { libraryId } = req.user;
    const { page = 1, limit = 10, search = "" } = req.query;

    const query = {
      libraryId,
      $or: [
        { name: { $regex: search, $options: "i" } },
        { contact: { $regex: search, $options: "i" } }
      ]
    };

    const enquiries = await Enquiry.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Enquiry.countDocuments(query);

    res.json({
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      enquiries
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



/* =========================================
   🔍 GET SINGLE ENQUIRY
========================================= */
export const getSingleEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const { libraryId } = req.user;

    const enquiry = await Enquiry.findOne({
      _id: id,
      libraryId
    });

    if (!enquiry) {
      return res.status(404).json({
        message: "Enquiry not found"
      });
    }

    res.json(enquiry);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



/* =========================================
   ✏️ UPDATE ENQUIRY
========================================= */
export const updateEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const { libraryId } = req.user;

    const enquiry = await Enquiry.findOneAndUpdate(
      { _id: id, libraryId },
      req.body,
      { new: true }
    );

    if (!enquiry) {
      return res.status(404).json({
        message: "Enquiry not found"
      });
    }

    res.json({
      message: "Enquiry updated successfully",
      enquiry
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



/* =========================================
   ❌ DELETE ENQUIRY
========================================= */
export const deleteEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const { libraryId } = req.user;

    const enquiry = await Enquiry.findOneAndDelete({
      _id: id,
      libraryId
    });

    if (!enquiry) {
      return res.status(404).json({
        message: "Enquiry not found"
      });
    }

    res.json({
      message: "Enquiry deleted successfully"
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================================
   🌐 WEBSITE ENQUIRY (PUBLIC)
========================================= */
export const createWebsiteEnquiry = async (req, res) => {
  try {

    const { name, contact, address, slot, course, libraryId } = req.body;

    if (!name || !contact || !address || !slot || !course || !libraryId) {
      return res.status(400).json({
        message: "Please fill all required fields"
      });
    }

    const enquiry = await Enquiry.create({
      name,
      contact,
      address,
      slot,
      course,
      libraryId,
      source: "website"
    });

    res.status(201).json({
      message: "Enquiry submitted successfully",
      enquiry
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};