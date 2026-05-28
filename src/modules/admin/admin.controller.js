import Admin from "./admin.model.js";
import Expense from "../commonmodel/expense.model.js";
import Fees from "../fees/fees.model.js"
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1️⃣ Find admin and populate library
    const admin = await Admin.findOne({ email }).populate("libraryId");

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

    const updatedExpense = await Expense.findByIdAndUpdate(
      req.params.id,
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