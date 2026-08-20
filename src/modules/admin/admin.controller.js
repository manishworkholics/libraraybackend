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

const requireOwner = (req, res) => {
  if (req.user.role !== "owner") {
    res.status(403).json({ message: "Only the main admin can manage branches" });
    return false;
  }
  return true;
};

const getOwnerBranches = async (ownerId, primaryLibraryId) => {
  // Backwards compatibility: existing owner accounts keep their current
  // library as their first branch without any data migration.
  await Library.updateOne(
    { _id: primaryLibraryId, ownerAdminId: null },
    { $set: { ownerAdminId: ownerId } }
  );

  return Library.find({ ownerAdminId: ownerId, isActive: true })
    .select("name libraryCode address phone email isActive")
    .sort({ createdAt: 1 });
};

export const getBranches = async (req, res) => {
  try {
    if (req.user.role !== "owner") {
      const branch = await Library.findById(req.user.libraryId)
        .select("name libraryCode address phone email isActive");
      return res.json({ branches: branch ? [branch] : [] });
    }

    const branches = await getOwnerBranches(req.user.userId, req.user.libraryId);
    res.json({ branches });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createBranch = async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

    const { name, email, phone, address, adminName, adminEmail, adminPassword } = req.body;
    if (!name || !email || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({ message: "Branch and branch-admin details are required" });
    }

    const [existingLibrary, existingAdmin] = await Promise.all([
      Library.findOne({ email: email.toLowerCase().trim() }),
      Admin.findOne({ email: adminEmail.toLowerCase().trim() })
    ]);
    if (existingLibrary) return res.status(400).json({ message: "A branch already uses this email" });
    if (existingAdmin) return res.status(400).json({ message: "An admin already uses this email" });

    const lastLibrary = await Library.findOne({ libraryCode: { $exists: true } })
      .sort({ createdAt: -1 });
    const lastNumber = Number.parseInt(lastLibrary?.libraryCode?.split("-")[1], 10) || 0;
    const libraryCode = `LIB-${String(lastNumber + 1).padStart(4, "0")}`;

    const branch = await Library.create({
      name: name.trim(), email: email.toLowerCase().trim(), phone: phone?.trim() || "",
      address: address?.trim() || "", ownerName: adminName.trim(),
      ownerEmail: adminEmail.toLowerCase().trim(), libraryCode,
      ownerAdminId: req.user.userId, isActive: true
    });
    const branchAdmin = await Admin.create({
      name: adminName.trim(), email: adminEmail.toLowerCase().trim(),
      password: await bcrypt.hash(adminPassword, 10), libraryId: branch._id,
      role: "branchAdmin", isActive: true
    });

    res.status(201).json({ message: "Branch and branch admin created successfully", branch, branchAdmin: { id: branchAdmin._id, name: branchAdmin.name, email: branchAdmin.email } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getOwnerBranchDashboard = async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;
    const branches = await getOwnerBranches(req.user.userId, req.user.libraryId);
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
      return { id: branch._id, name: branch.name, libraryCode: branch.libraryCode, totalRevenue, totalExpense, profit: totalRevenue - totalExpense };
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
    const admin = await Admin.findOne({ email }).populate("libraryId");

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // When a branch is selected from the owner dashboard, credentials must
    // belong to that exact branch; direct branch switching is not permitted.
    if (branchId && String(admin.libraryId._id) !== String(branchId)) {
      return res.status(403).json({ message: "These credentials do not belong to the selected branch" });
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
        library: {
          id: admin.libraryId._id,
          name: admin.libraryId.name,
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
