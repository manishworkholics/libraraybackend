import Admin from "./admin.model.js";
import Expense from "../commonmodel/expense.model.js";
import Fees from "../fees/fees.model.js"
import Student from "../student/student.model.js";
import Seat from "../seat/seat.model.js";
import SeatBooking from "../commonmodel/seatBooking.model.js";
import Enquiry from "../enquiry/enquiry.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Library from "../commonmodel/Library.model.js";
import Branch from "../commonmodel/Branch.model.js";
import Attendance from "../attendance/attendance.model.js";
import Complaint from "../complaint/complaint.model.js";

const branchDataModels = [Seat, SeatBooking, Fees, Expense, Enquiry, Attendance, Complaint];

const migrateLegacyDataToMainBranch = async (parentLibraryId, branchId) => {
  // Students have a unique { enrollmentNumber, libraryId } index, so migrate
  // them one by one and preserve both records if historical duplicate IDs exist.
  const legacyStudents = await Student.find({ libraryId: parentLibraryId })
    .select("_id enrollmentNumber");

  for (const student of legacyStudents) {
    let enrollmentNumber = student.enrollmentNumber;
    const duplicate = await Student.exists({
      _id: { $ne: student._id },
      libraryId: branchId,
      enrollmentNumber
    });

    if (duplicate) {
      enrollmentNumber = `${enrollmentNumber}-OLD-${String(student._id).slice(-4)}`;
    }

    await Student.updateOne(
      { _id: student._id },
      { $set: { libraryId: branchId, enrollmentNumber } }
    );
  }

  await Promise.all(branchDataModels.map((Model) => Model.updateMany(
    { libraryId: parentLibraryId },
    { $set: { libraryId: branchId } }
  )));
};

const requireOwner = (req, res) => {
  if (req.user.role !== "owner") {
    res.status(403).json({ message: "Only the main admin can manage branches" });
    return false;
  }
  return true;
};

const getBranchPrefix = (libraryName = "") => {
  const firstWord = libraryName.trim().split(/\s+/)[0] || "BRANCH";
  return firstWord.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "BRN";
};

const getNextBranchLoginId = async (library) => {
  const prefix = getBranchPrefix(library.name);
  let number = (await Branch.countDocuments({ libraryId: library._id })) + 1;
  let branchId = `${prefix}-${number}`;
  while (await Branch.exists({ branchId })) {
    number += 1;
    branchId = `${prefix}-${number}`;
  }
  return branchId;
};

const ensureDefaultBranch = async (library) => {
  let branch = await Branch.findOne({ libraryId: library._id }).sort({ createdAt: 1 });
  if (branch) {
    // Old initial branches included the library name. Keep dropdown labels
    // branch-focused instead of showing the parent library name.
    if (branch.name === `${library.name} - Main Branch`) {
      branch.name = "Main Branch";
      await branch.save();
    }
    // Idempotent legacy migration: records created before branches existed
    // still point to the parent library. They always belong to Main Branch.
    await migrateLegacyDataToMainBranch(library._id, branch._id);
    const existingBranchAdmin = await Admin.findOne({ branchId: branch._id, role: "branchAdmin" });
    if (!existingBranchAdmin) {
      const owner = await Admin.findOne({ libraryId: library._id, role: "owner" });
      if (owner) {
        await Admin.create({
          name: `${branch.name} Admin`,
          email: `branch-${branch._id}@internal.local`,
          password: owner.password,
          libraryId: library._id,
          branchId: branch._id,
          role: "branchAdmin",
          isActive: true
        });
      }
    }
    return branch;
  }

  branch = await Branch.create({
    libraryId: library._id,
    name: "Main Branch",
    branchId: await getNextBranchLoginId(library),
    phone: library.phone || "",
    address: library.address || ""
  });
  // Existing data becomes Main Branch data exactly once. This preserves it
  // while letting unchanged operational controllers scope by branch ID.
  await migrateLegacyDataToMainBranch(library._id, branch._id);
  // The initial branch can be accessed immediately using its generated Branch
  // ID and the current owner's password. No admin email is needed.
  const owner = await Admin.findOne({ libraryId: library._id, role: "owner" });
  if (owner) {
    await Admin.create({
      name: `${branch.name} Admin`,
      // Legacy deployments have a unique email index. This internal value
      // preserves that constraint; branch login never uses email.
      email: `branch-${branch._id}@internal.local`,
      password: owner.password,
      libraryId: library._id,
      branchId: branch._id,
      role: "branchAdmin",
      isActive: true
    });
  }
  return branch;
};

const getOwnerBranches = async (libraryId) => {
  const library = await Library.findById(libraryId);
  if (!library) return [];
  await ensureDefaultBranch(library);
  return Branch.find({ libraryId: library._id, isActive: true })
    .select("name branchId address phone isActive")
    .sort({ createdAt: 1 });
};

export const getBranches = async (req, res) => {
  try {
    if (req.user.role !== "owner") {
      const branch = await Branch.findById(req.user.branchId)
        .select("name branchId address phone isActive");
      return res.json({ branches: branch ? [branch] : [] });
    }

    const branches = await getOwnerBranches(req.user.libraryId);
    res.json({ branches });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createBranch = async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

    const { name, phone, address, adminName, password } = req.body;
    if (!name || !password) {
      return res.status(400).json({ message: "Branch name and password are required" });
    }

    const library = await Library.findById(req.user.libraryId);
    if (!library) return res.status(404).json({ message: "Library not found" });
    const generatedBranchId = await getNextBranchLoginId(library);

    const branch = await Branch.create({
      libraryId: library._id, name: name.trim(), branchId: generatedBranchId,
      phone: phone?.trim() || "", address: address?.trim() || "", isActive: true
    });
    const branchAdmin = await Admin.create({
      name: adminName?.trim() || `${branch.name} Admin`,
      // Internal-only unique email for the existing Admin.email unique index.
      // The branch admin signs in only with Branch ID + password.
      email: `branch-${branch._id}@internal.local`,
      password: await bcrypt.hash(password, 10), libraryId: req.user.libraryId,
      branchId: branch._id, role: "branchAdmin", isActive: true
    });

    res.status(201).json({ message: "Branch and branch login created successfully", branch, branchAdmin: { id: branchAdmin._id, name: branchAdmin.name } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const setBranchLogin = async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const branch = await Branch.findOne({
      _id: req.params.branchId,
      libraryId: req.user.libraryId,
      isActive: true
    });
    if (!branch) return res.status(404).json({ message: "Branch not found" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const branchAdmin = await Admin.findOneAndUpdate(
      { branchId: branch._id, role: "branchAdmin" },
      {
        $set: {
          name: `${branch.name} Admin`,
          email: `branch-${branch._id}@internal.local`,
          password: hashedPassword,
          libraryId: req.user.libraryId,
          isActive: true
        },
        $setOnInsert: { branchId: branch._id, role: "branchAdmin" }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ message: `Login password saved for ${branch.branchId}`, branchAdmin: { id: branchAdmin._id } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getOwnerBranchDashboard = async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;
    const branches = await getOwnerBranches(req.user.libraryId);
    const branchIds = branches.map((branch) => branch._id);

    const [revenue, expenses, totalStudents, totalSeats, occupiedSeatIds, totalEnquiries] = await Promise.all([
      Fees.aggregate([{ $match: { libraryId: { $in: branchIds } } }, { $group: { _id: "$libraryId", total: { $sum: "$totalAmount" } } }]),
      Expense.aggregate([{ $match: { libraryId: { $in: branchIds } } }, { $group: { _id: "$libraryId", total: { $sum: "$amount" } } }]),
      Student.countDocuments({ libraryId: { $in: branchIds }, status: "active" }),
      Seat.countDocuments({ libraryId: { $in: branchIds } }),
      SeatBooking.distinct("seatId", { libraryId: { $in: branchIds }, status: "active" }),
      Enquiry.countDocuments({ libraryId: { $in: branchIds } })
    ]);
    const revenueByBranch = new Map(revenue.map((item) => [String(item._id), item.total]));
    const expenseByBranch = new Map(expenses.map((item) => [String(item._id), item.total]));
    const comparison = branches.map((branch) => {
      const totalRevenue = revenueByBranch.get(String(branch._id)) || 0;
      const totalExpense = expenseByBranch.get(String(branch._id)) || 0;
      return { id: branch._id, name: branch.name, branchId: branch.branchId, totalRevenue, totalExpense, profit: totalRevenue - totalExpense };
    });
    const totals = comparison.reduce((sum, branch) => ({ totalRevenue: sum.totalRevenue + branch.totalRevenue, totalExpense: sum.totalExpense + branch.totalExpense, profit: sum.profit + branch.profit }), { totalRevenue: 0, totalExpense: 0, profit: 0 });
    res.json({
      totals,
      overview: {
        totalBranches: branches.length,
        totalStudents,
        totalSeats,
        occupiedSeats: occupiedSeatIds.length,
        availableSeats: Math.max(0, totalSeats - occupiedSeatIds.length),
        totalEnquiries
      },
      branches: comparison
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const adminLogin = async (req, res) => {
  try {
    const { email, password, branchId } = req.body;

    // 1️⃣ Find admin and populate library
    let branch = null;
    let admin;
    if (branchId) {
      branch = await Branch.findOne({ branchId: branchId.trim().toUpperCase(), isActive: true });
      if (!branch) return res.status(404).json({ message: "Branch ID not found" });
      admin = await Admin.findOne({ branchId: branch._id, role: "branchAdmin", isActive: true }).populate("libraryId");
    } else {
      admin = await Admin.findOne({ email: email?.toLowerCase().trim() }).populate("libraryId");
    }

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // 2️⃣ Check library active status
    if (!admin.libraryId.isActive) {
      return res.status(403).json({
        message: "Library account is deactivated. Contact support."
      });
    }

    // 3️⃣ Check subscription expiry
    if (
      admin.libraryId.subscriptionExpiresAt &&
      new Date(admin.libraryId.subscriptionExpiresAt) < new Date()
    ) {
      return res.status(403).json({
        message: "Subscription expired. Please renew plan."
      });
    }

    // 4️⃣ Check password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // 5️⃣ Generate SaaS-ready JWT
    const token = jwt.sign(
      {
        userId: admin._id,
        libraryId: admin.libraryId._id,
        branchId: branch?._id || null,
        role: admin.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 6️⃣ Send safe response (no password)
    res.json({
      message: "Login successful",
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        branch: branch ? { id: branch._id, branchId: branch.branchId, name: branch.name } : null,
        library: {
          id: admin.libraryId._id,
          name: admin.libraryId.name,
          logo: admin.libraryId.logo || "",
          subscriptionPlan: admin.libraryId.subscriptionPlan
        }
      }
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
      status,

      type: "library",
      createdBy: req.user.userId,     // 🔥 FIXED
      libraryId: req.user.libraryId   // already correct
    });

    res.json({
      message: "Expense added successfully",
      expense
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

export const getExpenses = async (req, res) => {
  try {

    const expenses = await Expense.find({
      libraryId: req.user.libraryId   // 🔥 FILTER
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
      libraryId: req.user.libraryId  // 🔥 SECURITY CHECK
    });

    if (!expense) {
      return res.status(404).json({
        message: "Expense not found or unauthorized"
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

export const updateExpense = async (req, res) => {
  try {

    const updatedExpense = await Expense.findOneAndUpdate(
      { _id: req.params.id, libraryId: req.user.libraryId },
      req.body,
      { new: true }
    );

    if (!updatedExpense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      expense: updatedExpense
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

export const getAdminProfitDashboard = async (req, res) => {
  try {

    // ✅ TOTAL REVENUE
    const revenueAgg =
      await Fees.aggregate([

        {
          $match: {
            libraryId:
              req.user.libraryId
          }
        },

        {
          $group: {
            _id: null,

            totalRevenue: {
              $sum: "$totalAmount"
            }
          }
        }

      ]);

    // ✅ TOTAL EXPENSE
    const expenseAgg =
      await Expense.aggregate([

        {
          $match: {
            libraryId:
              req.user.libraryId
          }
        },

        {
          $group: {
            _id: null,

            totalExpense: {
              $sum: "$amount"
            }
          }
        }

      ]);

    const totalRevenue =
      revenueAgg.length
        ? revenueAgg[0]
          .totalRevenue
        : 0;

    const totalExpense =
      expenseAgg.length
        ? expenseAgg[0]
          .totalExpense
        : 0;

    const profit =
      totalRevenue -
      totalExpense;

    res.json({

      totalRevenue,

      totalExpense,

      profit

    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message:
        error.message
    });

  }
};

export const getAdminMonthlyProfitGraph =
  async (req, res) => {

    try {

      // ✅ YEAR FILTER
      const year =
        req.query.year
          ? Number(req.query.year)
          : new Date()
            .getFullYear();

      const startDate =
        new Date(
          `${year}-01-01`
        );

      const endDate =
        new Date(
          `${year}-12-31`
        );

      // ✅ REVENUE GRAPH
      const revenue =
        await Fees.aggregate([

          {
            $match: {

              libraryId:
                req.user.libraryId,

              paymentDate: {

                $gte:
                  startDate,

                $lte:
                  endDate

              }

            }
          },

          {
            $group: {

              _id: {

                month: {
                  $month:
                    "$paymentDate"
                },

                year: {
                  $year:
                    "$paymentDate"
                }

              },

              total: {
                $sum:
                  "$totalAmount"
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

      // ✅ EXPENSE GRAPH
      const expense =
        await Expense.aggregate([

          {
            $match: {

              libraryId:
                req.user.libraryId,

              createdAt: {

                $gte:
                  startDate,

                $lte:
                  endDate

              }

            }
          },

          {
            $group: {

              _id: {

                month: {
                  $month:
                    "$createdAt"
                },

                year: {
                  $year:
                    "$createdAt"
                }

              },

              total: {
                $sum:
                  "$amount"
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

      // ✅ RESPONSE
      res.status(200).json({

        success: true,

        revenue,

        expense

      });

    } catch (error) {

      console.error(
        "Profit Graph Error:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          error.message

      });

    }

  };
