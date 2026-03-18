import mongoose from "mongoose";
import Library from "../commonmodel/Library.model.js";
import Student from "../student/student.model.js";

import bcrypt from "bcryptjs";
import Admin from "../admin/admin.model.js";
import PlatformSubscription from "../commonmodel/platformSubscription.model.js";
import Expense from "../commonmodel/expense.model.js";
import SuperAdmin from "../superadmin/superAdmin.model.js";
import SupportComplaint from "../support/supportComplaint.model.js";
import SuccessStory from "../commonmodel/SuccessStory.model.js";
import Gallery from "../commonmodel/Gallery.model.js";
import jwt from "jsonwebtoken";

/* ================= SUPER ADMIN LOGIN ================= */

export const superAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password required"
      });
    }

    const superAdmin = await SuperAdmin.findOne({ email });

    if (!superAdmin) {
      return res.status(404).json({
        message: "Super Admin not found"
      });
    }

    const isMatch = await bcrypt.compare(password, superAdmin.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid password"
      });
    }

    const token = jwt.sign(
      {
        userId: superAdmin._id,
        role: "superAdmin"
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


/* ================= DASHBOARD ================= */

export const getSuperAdminDashboard = async (req, res) => {
  try {

    const totalLibraries = await Library.countDocuments();

    const activeLibraries = await Library.countDocuments({
      isActive: true
    });

    const expiredLibraries = await Library.countDocuments({
      subscriptionExpiresAt: { $lt: new Date() }
    });

    const totalStudents = await Student.countDocuments();

    const revenueAgg = await PlatformSubscription.aggregate([
      {
        $match: { status: "Success" }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" }
        }
      }
    ]);

    const totalRevenue = revenueAgg?.[0]?.totalRevenue || 0;

    const pendingRenewals = await Library.countDocuments({
      subscriptionExpiresAt: {
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      },
      isActive: true
    });

    res.json({
      totalLibraries,
      activeLibraries,
      expiredLibraries,
      totalStudents,
      totalRevenue,
      pendingRenewals
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ================= CREATE LIBRARY ================= */

export const createLibrary = async (req, res) => {
  try {

    const {
      name,
      email,
      ownerName,
      ownerEmail,
      address,
      phone,
      password
    } = req.body;

    /* 🔎 Check Required Fields */
    if (!name || !email || !ownerName || !ownerEmail || !phone || !password) {
      return res.status(400).json({
        message: "Please fill all required fields"
      });
    }

    /* 📧 Library Email Duplicate Check */
    const existingLibrary = await Library.findOne({ email });

    if (existingLibrary) {
      return res.status(400).json({
        message: "Library already exists with this email"
      });
    }

    /* 🔢 Generate Library Code */
    const lastLibrary = await Library.findOne({
      libraryCode: { $exists: true }
    }).sort({ libraryCode: -1 });

    let libraryCode = "LIB-0001";

    if (lastLibrary) {

      const lastNumber = parseInt(lastLibrary.libraryCode.split("-")[1]);

      const nextNumber = lastNumber + 1;

      libraryCode = `LIB-${String(nextNumber).padStart(4, "0")}`;

    }

    /* 🏫 Create Library */
    const library = await Library.create({
      libraryCode,
      name,
      email,
      ownerName,
      ownerEmail,
      address,
      phone
    });

    /* 🔐 Hash Password */
    const hashedPassword = await bcrypt.hash(password, 10);

    /* 👤 Create Owner Admin */
    const owner = await Admin.create({
      name: ownerName,
      email: ownerEmail,
      password: hashedPassword,
      libraryId: library._id,
      role: "owner"
    });

    res.status(201).json({
      message: "Library created successfully",
      library,
      owner
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }
};

/* ================= GET ALL LIBRARIES ================= */

export const getAllLibrary = async (req, res) => {
  try {

    const libraries = await Library.find().sort({ createdAt: -1 });

    res.json({
      message: "Libraries fetched successfully",
      libraries
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ================= TOGGLE LIBRARY STATUS ================= */

export const toggleLibraryStatus = async (req, res) => {
  try {

    const { libraryId } = req.params;

    const library = await Library.findById(libraryId);

    if (!library) {
      return res.status(404).json({
        message: "Library not found"
      });
    }

    library.isActive = !library.isActive;
    await library.save();

    res.json({
      message: "Library status updated",
      library
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ================= RECORD PLATFORM PAYMENT ================= */

export const recordPlatformPayment = async (req, res) => {
  try {

    const { libraryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(libraryId)) {
      return res.status(400).json({
        message: "Invalid library ID"
      });
    }

    const library = await Library.findById(libraryId);

    if (!library) {
      return res.status(404).json({
        message: "Library not found"
      });
    }

    const { planType, amount, paymentMode, startDate, endDate, status } = req.body;

    const subscription = await PlatformSubscription.create({
      libraryId,
      planType,
      amount: Number(amount),
      paymentMode,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : new Date(),
      paymentDate: new Date(),
      status: status || "Success"
    });

    // Update library subscription
    library.subscriptionPlan = planType;
    library.subscriptionStartDate = subscription.startDate;
    library.subscriptionExpiresAt = subscription.endDate;
    library.isActive = true;

    await library.save();

    res.status(201).json({
      message: "Platform payment recorded successfully",
      subscription
    });

  } catch (error) {

    console.log("Platform Payment Error:", error);

    res.status(500).json({
      message: "Server error"
    });
  }
};
/* ================= PLATFORM REVENUE HISTORY ================= */

export const getPlatformRevenueHistory = async (req, res) => {
  try {

    const { page = 1, limit = 10 } = req.query;

    const data = await PlatformSubscription.find()
      .populate("libraryId", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await PlatformSubscription.countDocuments();

    res.json({
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ================= DELETE PLATFORM PAYMENT ================= */

export const deletePlatformRevenue = async (req, res) => {
  try {

    const { id } = req.params;

    const subscription = await PlatformSubscription.findById(id);

    if (!subscription) {
      return res.status(404).json({
        message: "Record not found"
      });
    }

    await subscription.deleteOne();

    res.json({
      message: "Deleted successfully"
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ================= PLATFORM REVENUE DASHBOARD ================= */

export const getPlatformRevenueDashboard = async (req, res) => {
  try {

    const totalAgg = await PlatformSubscription.aggregate([
      { $match: { status: "Success" } },
      { $group: { _id: null, totalRevenue: { $sum: "$amount" } } }
    ]);

    const totalRevenue = totalAgg?.[0]?.totalRevenue || 0;

    const pendingAgg = await PlatformSubscription.aggregate([
      { $match: { status: "Pending" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const pendingRevenue = pendingAgg?.[0]?.total || 0;

    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );

    const monthlyAgg = await PlatformSubscription.aggregate([
      {
        $match: {
          status: "Success",
          createdAt: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const monthlyRevenue = monthlyAgg?.[0]?.total || 0;

    const activeSubscriptions = await PlatformSubscription.countDocuments({
      endDate: { $gte: new Date() },
      status: "Success"
    });

    res.json({
      totalRevenue,
      pendingRevenue,
      monthlyRevenue,
      activeSubscriptions
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ================= EXPENSE ================= */

export const addExpense = async (req, res) => {
  try {

    const { title, amount, category, mode, date, status } = req.body;

    const expense = await Expense.create({
      title,
      amount,
      category,
      mode,
      date: date ? new Date(date) : new Date(),
      status
    });

    res.json({
      message: "Expense added successfully",
      expense
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getExpenses = async (req, res) => {
  try {

    const expenses = await Expense.find().sort({ createdAt: -1 });

    res.json({
      expenses
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteExpense = async (req, res) => {
  try {

    const { id } = req.params;

    await Expense.findByIdAndDelete(id);

    res.json({
      message: "Expense deleted"
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
/* ================= PROFIT DASHBOARD ================= */
export const getProfitDashboard = async (req, res) => {
  try {

    const revenueAgg = await PlatformSubscription.aggregate([
      {
        $match: { status: "Success" }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" }
        }
      }
    ]);

    const expenseAgg = await Expense.aggregate([
      {
        $group: {
          _id: null,
          totalExpense: { $sum: "$amount" }
        }
      }
    ]);

    const totalRevenue = revenueAgg.length ? revenueAgg[0].totalRevenue : 0;
    const totalExpense = expenseAgg.length ? expenseAgg[0].totalExpense : 0;

    const profit = totalRevenue - totalExpense;

    res.json({
      totalRevenue,
      totalExpense,
      profit
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

export const getMonthlyProfitGraph = async (req, res) => {
  try {

    const revenue = await PlatformSubscription.aggregate([
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" }
          },
          total: { $sum: "$amount" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const expense = await Expense.aggregate([
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" }
          },
          total: { $sum: "$amount" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    res.json({
      revenue,
      expense
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getLast12MonthsRevenue = async (req, res) => {
  try {

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);

    const revenue = await PlatformSubscription.aggregate([
      {
        $match: {
          createdAt: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          total: { $sum: "$amount" }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }
      }
    ]);

    const formatted = revenue.map(r => ({
      year: r._id.year,
      month: r._id.month,
      revenue: r.total
    }));

    res.json(formatted);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const getLibraryWiseRevenue = async (req, res) => {
  try {

    const revenue = await PlatformSubscription.aggregate([
      {
        $group: {
          _id: "$libraryId",
          totalRevenue: { $sum: "$amount" }
        }
      },
      {
        $lookup: {
          from: "libraries",
          localField: "_id",
          foreignField: "_id",
          as: "library"
        }
      },
      { $unwind: "$library" },
      {
        $project: {
          libraryName: "$library.name",
          totalRevenue: 1
        }
      }
    ]);

    res.json(revenue);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const renewSubscription = async (req, res) => {
  try {

    const { libraryId } = req.params;

    const library = await Library.findById(libraryId);

    if (!library) {
      return res.status(404).json({
        message: "Library not found"
      });
    }

    const now = new Date();
    let newExpiry = new Date();

    switch (library.subscriptionPlan) {
      case "monthly":
        newExpiry.setMonth(newExpiry.getMonth() + 1);
        break;

      case "threeMonths":
        newExpiry.setMonth(newExpiry.getMonth() + 3);
        break;

      case "sixMonths":
        newExpiry.setMonth(newExpiry.getMonth() + 6);
        break;

      case "yearly":
        newExpiry.setFullYear(newExpiry.getFullYear() + 1);
        break;

      default:
        return res.status(400).json({
          message: "Invalid subscription plan"
        });
    }

    library.subscriptionStartDate = now;
    library.subscriptionExpiresAt = newExpiry;
    library.isActive = true;

    await library.save();

    res.json({
      message: "Subscription renewed successfully",
      library
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};
export const setManualSubscription = async (req, res) => {
  try {

    const { libraryId } = req.params;

    const {
      planType,
      amount,
      startDate,
      endDate,
      paymentMode
    } = req.body;

    if (!libraryId) {
      return res.status(400).json({
        message: "Library ID is required"
      });
    }

    if (!planType || !startDate || !endDate) {
      return res.status(400).json({
        message: "Plan type, start date and end date are required"
      });
    }

    // Find library
    const library = await Library.findById(libraryId);

    if (!library) {
      return res.status(404).json({
        message: "Library not found"
      });
    }

    // Update subscription
    library.subscription = {
      planType,
      amount,
      startDate,
      endDate,
      paymentMode: paymentMode || "manual",
      status: "active"
    };

    await library.save();

    res.json({
      message: "Manual subscription set successfully",
      subscription: library.subscription
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server error"
    });
  }
};


// super admin get all complaints
export const getAllComplaints = async (req, res) => {
  try {

    const complaints = await SupportComplaint.find()
      .populate("libraryId", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: complaints.length,
      data: complaints,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// super admin resolve complaint
export const resolveComplaint = async (req, res) => {
  try {

    const complaint = await SupportComplaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    complaint.adminReply = req.body.adminReply;
    complaint.status = "Resolved";
    complaint.resolvedAt = new Date();

    await complaint.save();

    res.json({
      success: true,
      message: "Complaint resolved successfully",
      data: complaint,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};




// CREATE
export const createSuccessStory = async (req, res) => {
  try {
    const story = await SuccessStory.create(req.body);
    res.json({ message: "Story created", story });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET ALL
export const getSuccessStories = async (req, res) => {
  const stories = await SuccessStory.find().sort({ createdAt: -1 });
  res.json(stories);
};

// UPDATE
export const updateSuccessStory = async (req, res) => {
  const story = await SuccessStory.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json({ message: "Updated", story });
};

// DELETE
export const deleteSuccessStory = async (req, res) => {
  await SuccessStory.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
};



// CREATE
export const createGallery = async (req, res) => {
  const item = await Gallery.create(req.body);
  res.json({ message: "Created", item });
};

// GET
export const getGallery = async (req, res) => {
  const data = await Gallery.find().sort({ createdAt: -1 });
  res.json(data);
};

// UPDATE
export const updateGallery = async (req, res) => {
  const item = await Gallery.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(item);
};

// DELETE
export const deleteGallery = async (req, res) => {
  await Gallery.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
};