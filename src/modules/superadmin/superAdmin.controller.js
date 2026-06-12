import mongoose from "mongoose";
import Library from "../commonmodel/Library.model.js";
import Student from "../student/student.model.js";
import LibrarySubscription from "../commonmodel/librarySubscription.model.js";
import SubscriptionPayment from "../commonmodel/SubscriptionPayment.model.js";
import bcrypt from "bcryptjs";
import Admin from "../admin/admin.model.js";
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

    const activeLibraries =
      await Library.countDocuments({
        isActive: true
      });

    const totalStudents =
      await Student.countDocuments();

    const expiredLibraries =
      await LibrarySubscription.countDocuments({
        status: "expired"
      });

    const revenueAgg =
      await SubscriptionPayment.aggregate([
        {
          $match: {
            status: "Success"
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: "$amount"
            }
          }
        }
      ]);

    const totalRevenue =
      revenueAgg?.[0]?.totalRevenue || 0;

    const next7Days = new Date();
    next7Days.setDate(
      next7Days.getDate() + 7
    );

    const pendingRenewals =
      await LibrarySubscription.countDocuments({
        status: "active",
        endDate: {
          $lte: next7Days
        }
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
    console.log(error);

    res.status(500).json({
      message: error.message
    });
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
      password,
    } = req.body;

    // Required Fields Check
    if (
      !name ||
      !email ||
      !ownerName ||
      !ownerEmail ||
      !phone ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields",
      });
    }

    // Email Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid library email format",
      });
    }

    if (!emailRegex.test(ownerEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid owner email format",
      });
    }

    // Phone Validation
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Mobile number must be 10 digits",
      });
    }

    // Password Validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // Check Library Email
    const existingLibrary = await Library.findOne({
      email: email.toLowerCase(),
    });

    if (existingLibrary) {
      return res.status(400).json({
        success: false,
        message: "Library already exists with this email",
      });
    }

    // Check Owner Email
    const existingOwner = await Admin.findOne({
      email: ownerEmail.toLowerCase(),
    });

    if (existingOwner) {
      return res.status(400).json({
        success: false,
        message: "Owner email already registered",
      });
    }

    // Generate Library Code
    const lastLibrary = await Library.findOne({
      libraryCode: { $exists: true },
    }).sort({ createdAt: -1 });

    let libraryCode = "LIB-0001";

    if (lastLibrary?.libraryCode) {
      const lastNumber = parseInt(
        lastLibrary.libraryCode.split("-")[1]
      );

      const nextNumber = lastNumber + 1;

      libraryCode = `LIB-${String(nextNumber).padStart(4, "0")}`;
    }

    // Create Library
    const library = await Library.create({
      libraryCode,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      ownerName: ownerName.trim(),
      ownerEmail: ownerEmail.toLowerCase().trim(),
      address: address?.trim() || "",
      phone,
      isActive: true,
    });

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create Owner Admin
    const owner = await Admin.create({
      name: ownerName.trim(),
      email: ownerEmail.toLowerCase().trim(),
      password: hashedPassword,
      libraryId: library._id,
      role: "owner",
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Library created successfully",
      library,
      owner: {
        _id: owner._id,
        name: owner.name,
        email: owner.email,
        role: owner.role,
      },
    });
  } catch (error) {
    console.error("Create Library Error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
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

export const getLibraryById = async (req, res) => {
  try {

    const library = await Library.findById(
      req.params.libraryId
    );

    if (!library) {
      return res.status(404).json({
        success: false,
        message: "Library not found"
      });
    }

    res.status(200).json({
      success: true,
      data: library
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateLibrary = async (req, res) => {
  try {
    const { libraryId } = req.params;

    const {
      name,
      email,
      ownerName,
      ownerEmail,
      address,
      phone,
      password,
    } = req.body;

    // Find Library
    const library = await Library.findById(libraryId);

    if (!library) {
      return res.status(404).json({
        success: false,
        message: "Library not found",
      });
    }

    // Email Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (email && !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid library email format",
      });
    }

    if (ownerEmail && !emailRegex.test(ownerEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid owner email format",
      });
    }

    // Phone Validation
    if (phone && !/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Mobile number must be 10 digits",
      });
    }

    // Duplicate Library Email Check
    if (email) {
      const existingLibrary = await Library.findOne({
        email: email.toLowerCase(),
        _id: { $ne: libraryId },
      });

      if (existingLibrary) {
        return res.status(400).json({
          success: false,
          message: "Library email already exists",
        });
      }
    }

    // Find Owner Admin
    const owner = await Admin.findOne({
      libraryId,
      role: "owner",
    });

    // Duplicate Owner Email Check
    if (ownerEmail) {
      const existingOwner = await Admin.findOne({
        email: ownerEmail.toLowerCase(),
        _id: { $ne: owner?._id },
      });

      if (existingOwner) {
        return res.status(400).json({
          success: false,
          message: "Owner email already exists",
        });
      }
    }

    // Update Library
    library.name = name || library.name;
    library.email = email
      ? email.toLowerCase()
      : library.email;
    library.ownerName =
      ownerName || library.ownerName;
    library.ownerEmail = ownerEmail
      ? ownerEmail.toLowerCase()
      : library.ownerEmail;
    library.address =
      address !== undefined
        ? address
        : library.address;
    library.phone = phone || library.phone;

    await library.save();

    // Update Owner Admin
    if (owner) {
      owner.name =
        ownerName || owner.name;

      owner.email = ownerEmail
        ? ownerEmail.toLowerCase()
        : owner.email;

      // Update Password Only If Provided
      if (
        password &&
        password.trim() !== ""
      ) {
        owner.password =
          await bcrypt.hash(
            password,
            10
          );
      }

      await owner.save();
    }

    res.status(200).json({
      success: true,
      message:
        "Library updated successfully",
      data: library,
    });
  } catch (error) {
    console.error(
      "Update Library Error:",
      error
    );

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    res.status(500).json({
      success: false,
      message:
        error.message ||
        "Internal Server Error",
    });
  }
};

export const deleteLibrary = async (req, res) => {
  try {
    const library = await Library.findByIdAndDelete(
      req.params.libraryId
    );

    if (!library) {
      return res.status(404).json({
        success: false,
        message: "Library not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Library deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
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

/* ================= PLATFORM REVENUE DASHBOARD ================= */
export const getPlatformRevenueDashboard = async (req, res) => {
  try {

    const totalAgg = await SubscriptionPayment.aggregate([
      {
        $match: { status: "Success" }
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: "$amount"
          }
        }
      }
    ]);

    const pendingAgg = await SubscriptionPayment.aggregate([
      {
        $match: { status: "Pending" }
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$amount"
          }
        }
      }
    ]);

    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );

    const monthlyAgg = await SubscriptionPayment.aggregate([
      {
        $match: {
          status: "Success",
          createdAt: {
            $gte: startOfMonth
          }
        }
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$amount"
          }
        }
      }
    ]);

    const activeSubscriptions =
      await LibrarySubscription.countDocuments({
        status: "active",
        endDate: {
          $gte: new Date()
        }
      });

    res.json({
      totalRevenue:
        totalAgg?.[0]?.totalRevenue || 0,

      pendingRevenue:
        pendingAgg?.[0]?.total || 0,

      monthlyRevenue:
        monthlyAgg?.[0]?.total || 0,

      activeSubscriptions
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const getRevenueHistory = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await SubscriptionPayment.countDocuments();

    const revenues = await SubscriptionPayment.find()
      .populate("libraryId", "name libraryCode")
      .populate(
        "planId",
        "name maxSeats monthlyPrice quarterlyPrice halfYearlyPrice yearlyPrice"
      )
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      data: revenues,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getRevenueById = async (req, res) => {
  try {
    const revenue = await SubscriptionPayment.findById(
      req.params.id
    )
      .populate("libraryId")
      .populate("planId");

    if (!revenue) {
      return res.status(404).json({
        success: false,
        message: "Revenue not found",
      });
    }

    res.status(200).json({
      success: true,
      data: revenue,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateRevenue = async (req, res) => {
  try {

    const revenue =
      await SubscriptionPayment.findByIdAndUpdate(
        req.params.id,
        {
          amount: req.body.amount,
          paymentMode: req.body.paymentMode,
          status: req.body.status,
          durationType: req.body.durationType
        },
        {
          new: true,
          runValidators: true
        }
      );

    if (!revenue) {
      return res.status(404).json({
        success: false,
        message: "Revenue not found"
      });
    }

    const subscription =
      await LibrarySubscription.findOne({
        libraryId: revenue.libraryId,
        status: "active"
      });

    if (subscription && req.body.durationType) {

      subscription.durationType =
        req.body.durationType;

      let durationDays = 0;

      switch (req.body.durationType) {

        case "Monthly":
          durationDays = 30;
          break;

        case "Quarterly":
          durationDays = 90;
          break;

        case "HalfYearly":
          durationDays = 180;
          break;

        case "Yearly":
          durationDays = 365;
          break;

        default:
          durationDays = 30;
      }

      // Recalculate end date from start date
      const newEndDate = new Date(
        subscription.startDate
      );

      newEndDate.setDate(
        newEndDate.getDate() + durationDays
      );

      subscription.endDate = newEndDate;

      await subscription.save();
    }

    return res.status(200).json({
      success: true,
      message: "Revenue updated successfully",
      data: revenue
    });

  } catch (error) {

    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
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
      status,

      // 🔥 REQUIRED FIELDS
      type: "platform",
      libraryId: null,
      createdBy: req.user.userId   // ✅ FIX
    });

    res.json({
      message: "Expense added successfully",
      expense
    });

  } catch (error) {
    console.log("ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getExpenses = async (req, res) => {
  try {

    const expenses = await Expense.find({
      type: "platform"   // 🔥 only platform expenses
    }).sort({ createdAt: -1 });

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

    const expense = await Expense.findOne({
      _id: id,
      type: "platform"   // 🔥 safety check
    });

    if (!expense) {
      return res.status(404).json({
        message: "Expense not found"
      });
    }

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

    // ✅ TOTAL REVENUE (subscription)
    const revenueAgg = await SubscriptionPayment.aggregate([
      {
        $match: {
          status: "Success"
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: "$amount"
          }
        }
      }
    ]);

    // ✅ ONLY PLATFORM EXPENSE
    const expenseAgg = await Expense.aggregate([
      {
        $match: { type: "platform" }   // 🔥 FIX
      },
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

    const revenue = await SubscriptionPayment.aggregate([
      {
        $match: {
          status: "Success",
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          total: { $sum: "$amount" },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },
    ]);

    const expense = await Expense.aggregate([
      {
        $match: {
          type: "platform"
        }
      },
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

    const revenue = await SubscriptionPayment.aggregate([
      {
        $match: {
          createdAt: {
            $gte: twelveMonthsAgo
          },
          status: "Success"
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          total: {
            $sum: "$amount"
          }
        }
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1
        }
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
export const getLibraryWiseRevenue = async (
  req,
  res
) => {
  try {

    const data =
      await SubscriptionPayment.aggregate([
        {
          $match: {
            status: "Success"
          }
        },
        {
          $group: {
            _id: "$libraryId",
            totalRevenue: {
              $sum: "$amount"
            }
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
        {
          $unwind: "$library"
        },
        {
          $project: {
            libraryName:
              "$library.name",
            libraryCode:
              "$library.libraryCode",
            totalRevenue: 1
          }
        }
      ]);

    res.json(data);

  } catch (error) {
    res.status(500).json({
      message: error.message
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
  try {
    console.log("BODY:", req.body); // 👈 MOST IMPORTANT

    const item = await Gallery.create(req.body);

    res.json({ message: "Created", item });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
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