import Fees from "./fees.model.js";
import Student from "../student/student.model.js";
import XLSX from "xlsx";

const parsePaymentDate = (value) => {
  if (!value) return new Date();

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

// ============================================================
// ADD REVENUE / ADD FEES
// ============================================================
export const addFees = async (req, res) => {
  try {
    console.log("🔥 ADD FEES API HIT");
    console.log("🔥 REQUEST BODY:", req.body);
    const {
      studentId,
      registrationFees = 0,
      monthlyFees = 0,
      cashAmount = 0,
      onlineAmount = 0,
      paymentDate,
      planType,
      studyHours,
      startDate,
      endDate,
    } = req.body;

    const libraryId = req.user?.libraryId;

    if (!libraryId) {
      return res.status(400).json({
        success: false,
        message: "Library ID is required",
      });
    }

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required",
      });
    }

    const student = await Student.findOne({
      _id: studentId,
      libraryId,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const durationMap = {
      monthly: 1,
      quarterly: 3,
      halfYearly: 6,
      yearly: 12,
    };

    const durationMonths = durationMap[planType] || 1;

    const registration = Number(registrationFees) || 0;
    const monthly = Number(monthlyFees) || 0;

    const totalAmount = registration + monthly;

    const finalCashAmount = Number(cashAmount) || 0;
    const finalOnlineAmount = Number(onlineAmount) || 0;

    const paidAmount =
      finalCashAmount + finalOnlineAmount;

    const dueAmount =
      Math.max(totalAmount - paidAmount, 0);

    if (paidAmount > totalAmount) {
      return res.status(400).json({
        success: false,
        message:
          "Cash Amount + Online Amount cannot be greater than Total Amount",
      });
    }

    const finalPaymentDate = parsePaymentDate(paymentDate);

    if (!finalPaymentDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment date",
      });
    }

    let finalStartDate = startDate
      ? new Date(startDate)
      : new Date();

    if (Number.isNaN(finalStartDate.getTime())) {
      finalStartDate = new Date();
    }

    let finalEndDate = endDate
      ? new Date(endDate)
      : new Date(finalStartDate);

    if (!endDate) {
      finalEndDate.setMonth(
        finalEndDate.getMonth() + durationMonths
      );
    }

    const paymentStatus =
      dueAmount <= 0 ? "paid" : "partial";

    const fees = await Fees.create({
      studentId,

      registrationFees: registration,
      monthlyFees: monthly,

      totalAmount,

      cashAmount: finalCashAmount,
      onlineAmount: finalOnlineAmount,

      paidAmount,
      dueAmount,

      paymentStatus,

      planType,

      paymentDate: finalPaymentDate,

      transactionType: "new_admission",

      studyHours,

      libraryId,

      startDate: finalStartDate,
      endDate: finalEndDate,
    });
    console.log("SAVED FEES:", {
      totalAmount: fees.totalAmount,
      cashAmount: fees.cashAmount,
      onlineAmount: fees.onlineAmount,
      paidAmount: fees.paidAmount,
      dueAmount: fees.dueAmount,
    });
    return res.status(201).json({
      success: true,
      message: "Revenue added successfully",
      data: fees,
    });
  } catch (error) {
    console.error("Add Fees Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add revenue",
      error: error.message,
    });
  }
};


// ============================================================
// GET STUDENT FEES
// ============================================================
export const getStudentFees = async (req, res) => {
  try {
    const { studentId } = req.params;
    const libraryId = req.user?.libraryId;

    const fees = await Fees.find({
      studentId,
      libraryId,
    })
      .sort({ paymentDate: -1 })
      .lean();

    const formattedFees = fees.map((fee) => ({
      ...fee,

      paymentDate: fee.paymentDate
        ? new Date(fee.paymentDate).toISOString().split("T")[0]
        : null,

      startDate: fee.startDate
        ? new Date(fee.startDate).toISOString().split("T")[0]
        : null,

      endDate: fee.endDate
        ? new Date(fee.endDate).toISOString().split("T")[0]
        : null,

      renewalDate: fee.renewalDate
        ? new Date(fee.renewalDate).toISOString().split("T")[0]
        : null,
    }));

    return res.status(200).json({
      success: true,
      data: formattedFees,
    });
  } catch (error) {
    console.error("Get Student Fees Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch student fees",
      error: error.message,
    });
  }
};


// ============================================================
// GET FEES / PAYMENT HISTORY
// ============================================================
export const getFees = async (req, res) => {
  try {
    const libraryId = req.user?.libraryId;

    const { month, year } = req.query;

    const filter = {
      libraryId,
    };

    // Month/year filter based on PAYMENT DATE
    if (month && year) {
      const startDate = new Date(
        Number(year),
        Number(month) - 1,
        1
      );

      const endDate = new Date(
        Number(year),
        Number(month),
        1
      );

      filter.paymentDate = {
        $gte: startDate,
        $lt: endDate,
      };
    }

    const fees = await Fees.find(filter)
      .populate("studentId", "name enrollmentNumber")
      .sort({ paymentDate: -1 })
      .lean();

    const formattedFees = fees.map((fee) => ({
      ...fee,

      paymentDate: fee.paymentDate
        ? new Date(fee.paymentDate).toISOString().split("T")[0]
        : null,

      startDate: fee.startDate
        ? new Date(fee.startDate).toISOString().split("T")[0]
        : null,

      endDate: fee.endDate
        ? new Date(fee.endDate).toISOString().split("T")[0]
        : null,

      renewalDate: fee.renewalDate
        ? new Date(fee.renewalDate).toISOString().split("T")[0]
        : null,

      // Backward compatibility for old records
      cashAmount: Number(fee.cashAmount) || 0,
      onlineAmount: Number(fee.onlineAmount) || 0,
      paidAmount: Number(fee.paidAmount) || 0,
      dueAmount: Number(fee.dueAmount) || 0,

      remark:
        fee.transactionType === "renewal"
          ? "Renewal"
          : "New Admission",
    }));

    return res.status(200).json({
      success: true,
      data: formattedFees,
    });
  } catch (error) {
    console.error("Get Fees Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment history",
      error: error.message,
    });
  }
};


// ============================================================
// REVENUE STATS
// ============================================================
export const getRevenueStats = async (req, res) => {
  try {
    const libraryId = req.user?.libraryId;

    const { month, year } = req.query;

    if (!libraryId) {
      return res.status(400).json({
        success: false,
        message: "Library ID is required",
      });
    }

    // --------------------------------------------------------
    // FILTER
    // --------------------------------------------------------

    const filter = {
      libraryId,
    };

    // Selected month/year ke according Payment Date filter
    if (month && year) {
      const startDate = new Date(
        Number(year),
        Number(month) - 1,
        1
      );

      const endDate = new Date(
        Number(year),
        Number(month),
        1
      );

      filter.paymentDate = {
        $gte: startDate,
        $lt: endDate,
      };
    }

    // --------------------------------------------------------
    // GET FEES
    // --------------------------------------------------------

    const fees = await Fees.find(filter).lean();

    // --------------------------------------------------------
    // CALCULATE REVENUE
    // --------------------------------------------------------

    let totalCashRevenue = 0;
    let totalOnlineRevenue = 0;
    let totalDueAmount = 0;

    fees.forEach((fee) => {
      const cash =
        Number(fee.cashAmount) || 0;

      const online =
        Number(fee.onlineAmount) || 0;

      const due =
        Number(fee.dueAmount) || 0;

      totalCashRevenue += cash;
      totalOnlineRevenue += online;
      totalDueAmount += due;
    });

    // Actual received revenue
    const totalRevenue =
      totalCashRevenue +
      totalOnlineRevenue;

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,

      data: {
        totalCashRevenue,
        totalOnlineRevenue,
        totalRevenue,
        totalDueAmount,
      },
    });

  } catch (error) {
    console.error(
      "Revenue Stats Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch revenue statistics",
      error: error.message,
    });
  }
};

// ============================================================
// UPDATE FEES / EDIT REVENUE
// ============================================================
export const updateFees = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      registrationFees,
      monthlyFees,
      cashAmount,
      onlineAmount,
      paymentDate,
      studyHours,
      planType,
      startDate,
      endDate,
    } = req.body;

    const libraryId = req.user?.libraryId;

    const fees = await Fees.findOne({
      _id: id,
      libraryId,
    });

    if (!fees) {
      return res.status(404).json({
        success: false,
        message: "Revenue record not found",
      });
    }

    const registration =
      registrationFees !== undefined
        ? Number(registrationFees) || 0
        : Number(fees.registrationFees) || 0;

    const monthly =
      monthlyFees !== undefined
        ? Number(monthlyFees) || 0
        : Number(fees.monthlyFees) || 0;

    const totalAmount =
      registration + monthly;

    const finalCashAmount =
      cashAmount !== undefined
        ? Number(cashAmount) || 0
        : Number(fees.cashAmount) || 0;

    const finalOnlineAmount =
      onlineAmount !== undefined
        ? Number(onlineAmount) || 0
        : Number(fees.onlineAmount) || 0;

    const paidAmount =
      finalCashAmount + finalOnlineAmount;

    if (paidAmount > totalAmount) {
      return res.status(400).json({
        success: false,
        message:
          "Cash Amount + Online Amount cannot be greater than Total Amount",
      });
    }

    const dueAmount =
      Math.max(totalAmount - paidAmount, 0);

    fees.registrationFees = registration;
    fees.monthlyFees = monthly;

    fees.totalAmount = totalAmount;

    fees.cashAmount = finalCashAmount;
    fees.onlineAmount = finalOnlineAmount;

    fees.paidAmount = paidAmount;
    fees.dueAmount = dueAmount;

    fees.paymentStatus =
      dueAmount <= 0 ? "paid" : "partial";

    if (paymentDate !== undefined) {
      const parsedPaymentDate =
        parsePaymentDate(paymentDate);

      if (!parsedPaymentDate) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment date",
        });
      }

      fees.paymentDate = parsedPaymentDate;
    }

    if (studyHours !== undefined) {
      fees.studyHours = studyHours;
    }

    if (planType !== undefined) {
      fees.planType = planType;
    }

    if (startDate !== undefined) {
      fees.startDate = new Date(startDate);
    }

    if (endDate !== undefined) {
      fees.endDate = new Date(endDate);
    }

    await fees.save();

    return res.status(200).json({
      success: true,
      message: "Revenue updated successfully",
      data: fees,
    });
  } catch (error) {
    console.error("Update Fees Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update revenue",
      error: error.message,
    });
  }
};

// ============================================================
// DELETE FEES
// ============================================================
export const deleteFees = async (req, res) => {
  try {
    const { id } = req.params;
    const libraryId = req.user?.libraryId;

    const fees = await Fees.findOneAndDelete({
      _id: id,
      libraryId,
    });

    if (!fees) {
      return res.status(404).json({
        success: false,
        message: "Revenue record not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Revenue deleted successfully",
    });
  } catch (error) {
    console.error("Delete Fees Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete revenue",
      error: error.message,
    });
  }
};

// ============================================================
// RENEW FEES
// ============================================================
export const renewFees = async (req, res) => {
  try {
    // ========================================================
    // IMPORTANT:
    // ID route params se aayegi
    // PUT /fees/renew/:id
    // ========================================================

    const { id } = req.params;

    const {
      duration,
      renewType = "continue",
      studyHours,
      amount,
      cashAmount = 0,
      onlineAmount = 0,
      paymentDate,
    } = req.body;

    const libraryId = req.user?.libraryId;

    // ========================================================
    // VALIDATION
    // ========================================================

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Fee record ID is required",
      });
    }

    if (!libraryId) {
      return res.status(400).json({
        success: false,
        message: "Library ID is required",
      });
    }

    if (!duration) {
      return res.status(400).json({
        success: false,
        message: "Renewal duration is required",
      });
    }

    // ========================================================
    // DURATION MAP
    // ========================================================

    const durationMap = {
      1: "monthly",
      3: "quarterly",
      6: "halfYearly",
      12: "yearly",
    };

    const planType =
      durationMap[Number(duration)];

    if (!planType) {
      return res.status(400).json({
        success: false,
        message: "Invalid renewal duration",
      });
    }

    // ========================================================
    // FIND CURRENT FEE RECORD
    // ========================================================

    const currentFees =
      await Fees.findOne({
        _id: id,
        libraryId,
      });

    if (!currentFees) {
      return res.status(404).json({
        success: false,
        message: "Fee record not found",
      });
    }

    // ========================================================
    // FIND STUDENT
    // ========================================================

    const student =
      await Student.findOne({
        _id: currentFees.studentId,
        libraryId,
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // ========================================================
    // UPDATE STUDY HOURS
    // ========================================================

    if (
      studyHours !== undefined &&
      studyHours !== null &&
      studyHours !== ""
    ) {
      student.studyHours =
        studyHours;

      await student.save();
    }

    // ========================================================
    // PAYMENT DATE
    // ========================================================

    const finalPaymentDate =
      parsePaymentDate(paymentDate);

    if (!finalPaymentDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment date",
      });
    }

    // ========================================================
    // RENEWAL START DATE
    // ========================================================

    let renewalStartDate;

    if (renewType === "continue") {
      renewalStartDate =
        currentFees.endDate
          ? new Date(
            currentFees.endDate
          )
          : new Date();
    } else {
      renewalStartDate =
        new Date();
    }

    // ========================================================
    // RENEWAL END DATE
    // ========================================================

    const renewalEndDate =
      new Date(
        renewalStartDate
      );

    renewalEndDate.setMonth(
      renewalEndDate.getMonth() +
      Number(duration)
    );

    // ========================================================
    // RENEWAL AMOUNT
    // ========================================================

    const renewalAmount =
      Number(amount) || 0;

    if (renewalAmount < 0) {
      return res.status(400).json({
        success: false,
        message:
          "Renewal amount cannot be negative",
      });
    }

    // ========================================================
    // PREVIOUS DUE
    // ========================================================

    const oldDueAmount =
      Number(
        currentFees.dueAmount
      ) || 0;

    // ========================================================
    // TOTAL AMOUNT
    //
    // Renewal amount + previous due
    // ========================================================

    const totalAmount =
      renewalAmount +
      oldDueAmount;

    // ========================================================
    // CASH + ONLINE
    // ========================================================

    const finalCashAmount =
      Number(cashAmount) || 0;

    const finalOnlineAmount =
      Number(onlineAmount) || 0;

    const paidAmount =
      finalCashAmount +
      finalOnlineAmount;

    // ========================================================
    // PAYMENT VALIDATION
    // ========================================================

    if (paidAmount > totalAmount) {
      return res.status(400).json({
        success: false,
        message:
          "Cash Amount + Online Amount cannot be greater than Total Amount",
      });
    }

    // ========================================================
    // DUE
    // ========================================================

    const dueAmount =
      Math.max(
        totalAmount -
        paidAmount,
        0
      );

    // ========================================================
    // PAYMENT STATUS
    // ========================================================

    let paymentStatus = "partial";

    if (paidAmount >= totalAmount) {
      paymentStatus = "paid";
    } else if (paidAmount <= 0) {
      paymentStatus = "pending";
    }

    // ========================================================
    // CREATE NEW RENEWAL RECORD
    //
    // IMPORTANT:
    // Normal Renewal creates a new transaction.
    // Existing old record remains unchanged.
    // ========================================================

    const renewedFees =
      await Fees.create({
        studentId:
          currentFees.studentId,

        registrationFees: 0,

        monthlyFees:
          renewalAmount,

        totalAmount,

        cashAmount:
          finalCashAmount,

        onlineAmount:
          finalOnlineAmount,

        paidAmount,

        dueAmount,

        paymentStatus,

        planType,

        paymentDate:
          finalPaymentDate,

        transactionType:
          "renewal",

        studyHours:
          studyHours !== undefined
            ? studyHours
            : currentFees.studyHours,

        libraryId,

        startDate:
          renewalStartDate,

        endDate:
          renewalEndDate,

        renewalDate:
          renewalEndDate,
      });

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(201).json({
      success: true,
      message:
        "Membership renewed successfully",

      data: renewedFees,
    });

  } catch (error) {
    console.error(
      "Renew Fees Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to renew membership",
      error: error.message,
    });
  }
};

// ============================================================
// CHANGE EXISTING RENEWAL
// ============================================================
export const changeRenewal = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      duration,
      amount,
      cashAmount,
      onlineAmount,
      paymentDate,
    } = req.body;

    const libraryId = req.user?.libraryId;

    const fees = await Fees.findOne({
      _id: id,
      libraryId,
    });

    if (!fees) {
      return res.status(404).json({
        success: false,
        message: "Renewal record not found",
      });
    }

    if (fees.transactionType !== "renewal") {
      return res.status(400).json({
        success: false,
        message:
          "Only renewal transactions can be changed using Change Renewal",
      });
    }

    const durationMap = {
      1: "monthly",
      3: "quarterly",
      6: "halfYearly",
      12: "yearly",
    };

    const planType =
      durationMap[Number(duration)];

    if (!planType) {
      return res.status(400).json({
        success: false,
        message: "Invalid renewal duration",
      });
    }

    const renewalAmount =
      Number(amount) || 0;

    if (renewalAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid renewal amount",
      });
    }

    const finalCashAmount =
      cashAmount !== undefined
        ? Number(cashAmount) || 0
        : Number(fees.cashAmount) || 0;

    const finalOnlineAmount =
      onlineAmount !== undefined
        ? Number(onlineAmount) || 0
        : Number(fees.onlineAmount) || 0;

    const paidAmount =
      finalCashAmount + finalOnlineAmount;

    const totalAmount =
      renewalAmount;

    if (paidAmount > totalAmount) {
      return res.status(400).json({
        success: false,
        message:
          "Cash Amount + Online Amount cannot be greater than Total Amount",
      });
    }

    const dueAmount =
      Math.max(totalAmount - paidAmount, 0);

    const paymentStatus =
      dueAmount <= 0 ? "paid" : "partial";

    let finalPaymentDate =
      fees.paymentDate || new Date();

    if (paymentDate !== undefined) {
      finalPaymentDate =
        parsePaymentDate(paymentDate);

      if (!finalPaymentDate) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment date",
        });
      }
    }

    const renewalStartDate =
      fees.startDate
        ? new Date(fees.startDate)
        : new Date();

    const newRenewalDate =
      new Date(renewalStartDate);

    newRenewalDate.setMonth(
      newRenewalDate.getMonth() + Number(duration)
    );

    fees.planType = planType;

    fees.monthlyFees = renewalAmount;

    fees.totalAmount = totalAmount;

    fees.cashAmount = finalCashAmount;

    fees.onlineAmount = finalOnlineAmount;

    fees.paidAmount = paidAmount;

    fees.dueAmount = dueAmount;

    fees.paymentStatus = paymentStatus;

    fees.paymentDate = finalPaymentDate;

    fees.renewalDate = newRenewalDate;

    fees.endDate = newRenewalDate;

    fees.transactionType = "renewal";

    await fees.save();

    return res.status(200).json({
      success: true,
      message: "Renewal plan changed successfully",
      data: fees,
    });
  } catch (error) {
    console.error("Change Renewal Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to change renewal",
      error: error.message,
    });
  }
};

// ============================================================
// GET RENEWAL LIST
// ============================================================
export const getRenewalList = async (req, res) => {
  try {
    const libraryId = req.user?.libraryId;

    const { month, year } = req.query;

    // ==========================================================
    // VALIDATION
    // ==========================================================

    if (!libraryId) {
      return res.status(400).json({
        success: false,
        message: "Library ID is required",
      });
    }

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: "Month and year are required",
      });
    }

    const selectedMonth = Number(month);
    const selectedYear = Number(year);

    if (
      Number.isNaN(selectedMonth) ||
      Number.isNaN(selectedYear) ||
      selectedMonth < 1 ||
      selectedMonth > 12
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid month or year",
      });
    }

    // ==========================================================
    // SELECTED MONTH START / END
    // ==========================================================

    const startDate = new Date(
      selectedYear,
      selectedMonth - 1,
      1
    );

    const endDate = new Date(
      selectedYear,
      selectedMonth,
      1
    );

    // ==========================================================
    // HELPER: DATE KEY
    //
    // This converts a date into:
    // YYYY-MM-DD
    //
    // We use this to compare:
    //
    // Old membership endDate
    // with
    // New renewal startDate
    // ==========================================================

    const getDateKey = (value) => {
      if (!value) {
        return null;
      }

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return null;
      }

      return date.toISOString().split("T")[0];
    };

    // ==========================================================
    // GET ALL FEE RECORDS
    //
    // IMPORTANT:
    // We are NOT filtering by transactionType.
    //
    // New Admission records are required because their
    // membership can expire in a future month.
    //
    // Renewal records are also required because they become
    // the next membership and can expire in another month.
    // ==========================================================

    const fees = await Fees.find({
      libraryId,
    })
      .populate(
        "studentId",
        "name enrollmentNumber phone"
      )
      .sort({
        studentId: 1,
        endDate: 1,
        paymentDate: 1,
        createdAt: 1,
      })
      .lean();

    // ==========================================================
    // BUILD RENEWAL MAP
    //
    // A renewal record is connected to the previous membership
    // through:
    //
    // renewal.studentId === oldRecord.studentId
    //
    // AND
    //
    // renewal.startDate === oldRecord.endDate
    //
    // Example:
    //
    // Old:
    // 16 Aug -> 16 Sep
    //
    // Renewal:
    // 16 Sep -> 16 Oct
    //
    // Therefore old record is COMPLETED.
    // ==========================================================

    const renewalMap = new Map();

    for (const fee of fees) {
      if (
        fee.transactionType !==
        "renewal"
      ) {
        continue;
      }

      const studentId =
        fee.studentId?._id?.toString();

      if (!studentId) {
        continue;
      }

      const renewalStartDate =
        getDateKey(
          fee.startDate
        );

      if (!renewalStartDate) {
        continue;
      }

      const mapKey =
        `${studentId}_${renewalStartDate}`;

      /*
       * If multiple renewal records somehow exist
       * for the same student and same start date,
       * keep the latest one.
       */

      const existing =
        renewalMap.get(mapKey);

      if (!existing) {
        renewalMap.set(
          mapKey,
          fee
        );
        continue;
      }

      const existingCreatedAt =
        existing.createdAt
          ? new Date(
            existing.createdAt
          ).getTime()
          : 0;

      const currentCreatedAt =
        fee.createdAt
          ? new Date(
            fee.createdAt
          ).getTime()
          : 0;

      if (
        currentCreatedAt >
        existingCreatedAt
      ) {
        renewalMap.set(
          mapKey,
          fee
        );
      }
    }

    // ==========================================================
    // FIND MEMBERSHIPS EXPIRING IN SELECTED MONTH
    //
    // IMPORTANT:
    //
    // Renewal List is based ONLY on endDate.
    //
    // Payment Date is NOT used here.
    // ==========================================================

    const renewalFees = [];

    for (const fee of fees) {
      if (!fee.endDate) {
        continue;
      }

      const membershipEndDate =
        new Date(fee.endDate);

      if (
        Number.isNaN(
          membershipEndDate.getTime()
        )
      ) {
        continue;
      }

      // --------------------------------------------------------
      // Only records whose membership expires in selected month
      // --------------------------------------------------------

      if (
        membershipEndDate >= startDate &&
        membershipEndDate < endDate
      ) {
        renewalFees.push(fee);
      }
    }

    // ==========================================================
    // FORMAT RESPONSE
    // ==========================================================

    const formattedFees =
      renewalFees.map((fee) => {
        // ------------------------------------------------------
        // STUDENT DETAILS
        // ------------------------------------------------------

        const studentId =
          fee.studentId?._id?.toString();

        const name =
          fee.studentId?.name || "-";

        const enrollmentNumber =
          fee.studentId?.enrollmentNumber || "-";

        const phone =
          fee.studentId?.phone || "-";

        // ------------------------------------------------------
        // CURRENT MEMBERSHIP END DATE
        // ------------------------------------------------------

        const currentEndDateKey =
          getDateKey(
            fee.endDate
          );

        // ------------------------------------------------------
        // FIND NEXT RENEWAL FOR THIS MEMBERSHIP
        //
        // Example:
        //
        // Old record:
        // endDate = 2026-09-16
        //
        // Renewal record:
        // startDate = 2026-09-16
        //
        // => Renewal completed
        // ------------------------------------------------------

        const renewalMapKey =
          studentId &&
            currentEndDateKey
            ? `${studentId}_${currentEndDateKey}`
            : null;

        const completedRenewal =
          renewalMapKey
            ? renewalMap.get(
              renewalMapKey
            )
            : null;

        // ------------------------------------------------------
        // RENEWAL STATUS
        // ------------------------------------------------------

        const isRenewed =
          Boolean(
            completedRenewal
          );

        const status =
          isRenewed
            ? "completed"
            : "pending";

        // ------------------------------------------------------
        // PAYMENT DETAILS OF CURRENT RECORD
        // ------------------------------------------------------

        const cashAmount =
          Number(
            fee.cashAmount
          ) || 0;

        const onlineAmount =
          Number(
            fee.onlineAmount
          ) || 0;

        const paidAmount =
          Number(
            fee.paidAmount
          ) ||
          cashAmount +
          onlineAmount;

        const dueAmount =
          Number(
            fee.dueAmount
          ) || 0;

        // ------------------------------------------------------
        // DATES OF CURRENT MEMBERSHIP
        // ------------------------------------------------------

        const paymentDate =
          fee.paymentDate
            ? new Date(
              fee.paymentDate
            )
              .toISOString()
              .split("T")[0]
            : null;

        const renewalDate =
          fee.renewalDate
            ? new Date(
              fee.renewalDate
            )
              .toISOString()
              .split("T")[0]
            : null;

        const startDateFormatted =
          fee.startDate
            ? new Date(
              fee.startDate
            )
              .toISOString()
              .split("T")[0]
            : null;

        const endDateFormatted =
          fee.endDate
            ? new Date(
              fee.endDate
            )
              .toISOString()
              .split("T")[0]
            : null;

        // ------------------------------------------------------
        // NEXT RENEWAL INFORMATION
        //
        // If current membership has already been renewed,
        // use the new renewal record's endDate as the next
        // renewal date.
        // ------------------------------------------------------

        const completedRenewalPaymentDate =
          completedRenewal?.paymentDate
            ? new Date(
              completedRenewal.paymentDate
            )
              .toISOString()
              .split("T")[0]
            : null;

        const completedRenewalEndDate =
          completedRenewal?.endDate
            ? new Date(
              completedRenewal.endDate
            )
              .toISOString()
              .split("T")[0]
            : null;

        // ------------------------------------------------------
        // RETURN OBJECT
        // ------------------------------------------------------

        return {
          ...fee,

          // ====================================================
          // STUDENT
          // ====================================================

          name,

          enrollmentNumber,

          phone,

          // ====================================================
          // PAYMENT
          // ====================================================

          cashAmount,

          onlineAmount,

          paidAmount,

          dueAmount,

          paymentStatus:
            fee.paymentStatus ||
            (
              dueAmount <= 0
                ? "paid"
                : paidAmount > 0
                  ? "partial"
                  : "pending"
            ),

          // ====================================================
          // RENEWAL STATUS
          // ====================================================

          status,

          isRenewed,

          // ====================================================
          // CURRENT MEMBERSHIP DATES
          // ====================================================

          paymentDate,

          renewalDate,

          startDate:
            startDateFormatted,

          endDate:
            endDateFormatted,

          // ====================================================
          // EXISTING FRONTEND COMPATIBILITY
          // ====================================================

          lastRenewalDate:
            startDateFormatted,

          renewDate:
            paymentDate,

          /*
           * IMPORTANT:
           *
           * For the current renewal list row,
           * this is the membership expiry date.
           *
           * If renewal has already happened,
           * the next renewal date becomes the new
           * renewal record's endDate.
           */

          nextRenewDate:
            isRenewed
              ? completedRenewalEndDate
              : endDateFormatted,

          // ====================================================
          // COMPLETED RENEWAL INFO
          // ====================================================

          completedRenewalId:
            completedRenewal?._id ||
            null,

          completedRenewalPaymentDate:
            completedRenewalPaymentDate,

          completedRenewalEndDate:
            completedRenewalEndDate,

          // ====================================================
          // TRANSACTION
          // ====================================================

          transactionType:
            fee.transactionType ||
            "new_admission",

          remark:
            fee.transactionType ===
              "renewal"
              ? "Renewal"
              : "New Admission",

          // ====================================================
          // ACTION
          //
          // Keep true so existing frontend still shows
          // Update/Edit buttons.
          //
          // Later we can make Update disabled/hidden
          // when isRenewed === true if required.
          // ====================================================

          canRenew: true,
        };
      });

    // ==========================================================
    // RESPONSE
    // ==========================================================

    return res.status(200).json({
      success: true,
      data: formattedFees,
    });

  } catch (error) {
    console.error(
      "Get Renewal List Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch renewal list",
      error: error.message,
    });
  }
};

// ============================================================
// IMPORT REVENUE / FEES FROM EXCEL
// ============================================================
export const importFeesFromExcel = async (req, res) => {
  try {
    const libraryId = req.user?.libraryId;

    if (!libraryId) {
      return res.status(400).json({
        success: false,
        message: "Library ID is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Excel file is required",
      });
    }

    // --------------------------------------------------------
    // READ EXCEL FILE
    // --------------------------------------------------------

    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
      cellDates: true,
    });

    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return res.status(400).json({
        success: false,
        message: "Excel sheet not found",
      });
    }

    const worksheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
      raw: true,
    });

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "Excel file is empty",
      });
    }

    // --------------------------------------------------------
    // HELPERS
    // --------------------------------------------------------

    const parseNumber = (value) => {
      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return 0;
      }

      const number = Number(
        String(value)
          .replace(/,/g, "")
          .replace(/₹/g, "")
          .trim()
      );

      return Number.isFinite(number) ? number : 0;
    };

    const parseExcelDate = (value) => {
      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return null;
      }

      // Already a JS Date
      if (value instanceof Date) {
        return Number.isNaN(value.getTime())
          ? null
          : value;
      }

      // Excel serial date
      if (
        typeof value === "number" &&
        Number.isFinite(value)
      ) {
        const excelDate =
          XLSX.SSF.parse_date_code(value);

        if (!excelDate) {
          return null;
        }

        return new Date(
          excelDate.y,
          excelDate.m - 1,
          excelDate.d
        );
      }

      const stringValue = String(value).trim();

      // DD/MM/YYYY or DD-MM-YYYY
      const ddmmyyyy =
        stringValue.match(
          /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/
        );

      if (ddmmyyyy) {
        const day = Number(ddmmyyyy[1]);
        const month = Number(ddmmyyyy[2]);
        const year = Number(ddmmyyyy[3]);

        const date = new Date(
          year,
          month - 1,
          day
        );

        return Number.isNaN(date.getTime())
          ? null
          : date;
      }

      // YYYY-MM-DD
      const yyyymmdd =
        stringValue.match(
          /^(\d{4})-(\d{1,2})-(\d{1,2})$/
        );

      if (yyyymmdd) {
        const year = Number(yyyymmdd[1]);
        const month = Number(yyyymmdd[2]);
        const day = Number(yyyymmdd[3]);

        const date = new Date(
          year,
          month - 1,
          day
        );

        return Number.isNaN(date.getTime())
          ? null
          : date;
      }

      // Normal JS date string
      const parsed = new Date(stringValue);

      return Number.isNaN(parsed.getTime())
        ? null
        : parsed;
    };

    const normalizeTransactionType = (value) => {
      const type = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");

      if (
        type === "renewal" ||
        type === "renew"
      ) {
        return "renewal";
      }

      if (
        type === "new_admission" ||
        type === "new admission" ||
        type === "admission"
      ) {
        return "new_admission";
      }

      return null;
    };

    const normalizePlanType = (value) => {
      const plan = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");

      const planMap = {
        monthly: "monthly",
        month: "monthly",

        quarterly: "quarterly",
        quarter: "quarterly",

        halfyearly: "halfYearly",
        halfyear: "halfYearly",
        halfyear: "halfYearly",

        yearly: "yearly",
        year: "yearly",

        custom: "custom",
        custom: "custom",
      };

      return planMap[plan] || null;
    };

    // Escape special regex characters
    const escapeRegex = (value) => {
      return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
    };

    // --------------------------------------------------------
    // IMPORT
    // --------------------------------------------------------

    const importedRecords = [];
    const errors = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];

      // Excel header = row 1
      // Data starts = row 2
      const excelRowNumber = index + 2;

      try {
        // ----------------------------------------------------
        // STUDENT NAME
        // ----------------------------------------------------

        const studentName = String(
          row.studentName ??
          row["Student Name"] ??
          row.name ??
          row["Name"] ??
          ""
        ).trim();

        if (!studentName) {
          throw new Error(
            "Student Name is required"
          );
        }

        // ----------------------------------------------------
        // ENROLLMENT NUMBER
        // ----------------------------------------------------

        const enrollmentNumber = String(
          row.enrollmentNumber ??
          row["Enrollment Number"] ??
          row.enrollmentNo ??
          row["Enrollment No"] ??
          ""
        ).trim();

        if (!enrollmentNumber) {
          throw new Error(
            "Enrollment Number is required"
          );
        }

        // ----------------------------------------------------
        // FIND STUDENT
        //
        // Student must belong to current library
        // AND both name + enrollment number must match
        // ----------------------------------------------------

        const student = await Student.findOne({
          libraryId,
          enrollmentNumber,
          name: {
            $regex: `^${escapeRegex(studentName)}$`,
            $options: "i",
          },
        }).select(
          "_id name enrollmentNumber libraryId"
        );

        if (!student) {
          throw new Error(
            `Student not found with Name "${studentName}" and Enrollment Number "${enrollmentNumber}"`
          );
        }

        const studentId = student._id;

        // ----------------------------------------------------
        // FEES
        // ----------------------------------------------------

        const registrationFees = parseNumber(
          row.registrationFees ??
          row["Registration Fees"]
        );

        const monthlyFees = parseNumber(
          row.monthlyFees ??
          row["Monthly Fees"]
        );

        // Total amount is calculated by backend
        const totalAmount =
          registrationFees + monthlyFees;

        // ----------------------------------------------------
        // PAYMENT
        // ----------------------------------------------------

        const cashAmount = parseNumber(
          row.cashAmount ??
          row["Cash Amount"] ??
          row["Cash"]
        );

        const onlineAmount = parseNumber(
          row.onlineAmount ??
          row["Online Amount"] ??
          row["Online"]
        );

        // Paid amount = Cash + Online
        const paidAmount =
          cashAmount + onlineAmount;

        // ----------------------------------------------------
        // OVERPAYMENT VALIDATION
        // ----------------------------------------------------

        if (paidAmount > totalAmount) {
          throw new Error(
            `Cash + Online (${paidAmount}) cannot be greater than Total (${totalAmount})`
          );
        }

        // ----------------------------------------------------
        // DUE AMOUNT
        // ----------------------------------------------------

        const dueAmount = Math.max(
          totalAmount - paidAmount,
          0
        );

        // ----------------------------------------------------
        // PAYMENT STATUS
        // ----------------------------------------------------

        let paymentStatus = "partial";

        if (paidAmount >= totalAmount) {
          paymentStatus = "paid";
        } else if (paidAmount <= 0) {
          paymentStatus = "pending";
        }

        // ----------------------------------------------------
        // TRANSACTION TYPE
        // ----------------------------------------------------

        const transactionType =
          normalizeTransactionType(
            row.transactionType ??
            row["Transaction Type"] ??
            row.type ??
            row["Type"]
          );

        if (!transactionType) {
          throw new Error(
            "Transaction Type must be new_admission or renewal"
          );
        }

        // ----------------------------------------------------
        // PLAN TYPE
        // ----------------------------------------------------

        const planType =
          normalizePlanType(
            row.planType ??
            row["Plan Type"] ??
            row["Plan"]
          );

        if (!planType) {
          throw new Error(
            "Invalid Plan. Use monthly, quarterly, halfYearly, yearly or custom"
          );
        }

        // ----------------------------------------------------
        // DATES
        // ----------------------------------------------------

        const paymentDate =
          parseExcelDate(
            row.paymentDate ??
            row["Payment Date"]
          );

        const startDate =
          parseExcelDate(
            row.startDate ??
            row["Start Date"]
          );

        const endDate =
          parseExcelDate(
            row.endDate ??
            row["End Date"]
          );

        const renewalDate =
          parseExcelDate(
            row.renewalDate ??
            row["Renewal Date"]
          );

        if (!paymentDate) {
          throw new Error(
            "Invalid Payment Date"
          );
        }

        if (!startDate) {
          throw new Error(
            "Invalid Start Date"
          );
        }

        if (!endDate) {
          throw new Error(
            "Invalid End Date"
          );
        }

        // ----------------------------------------------------
        // STUDY HOURS
        // ----------------------------------------------------

        const studyHours = String(
          row.studyHours ??
          row["Study Hours"] ??
          row["Hours"] ??
          ""
        ).trim();

        // ----------------------------------------------------
        // CREATE FEES
        // ----------------------------------------------------

        const fees = await Fees.create({
          libraryId,

          studentId,

          registrationFees,

          monthlyFees,

          totalAmount,

          cashAmount,

          onlineAmount,

          paidAmount,

          dueAmount,

          paymentStatus,

          planType,

          studyHours,

          paymentDate,

          startDate,

          endDate,

          renewalDate:
            renewalDate || null,

          transactionType,
        });

        importedRecords.push({
          ...fees.toObject(),
          studentName: student.name,
          enrollmentNumber:
            student.enrollmentNumber,
        });

      } catch (error) {
        errors.push({
          row: excelRowNumber,

          studentName:
            row.studentName ??
            row["Student Name"] ??
            "",

          enrollmentNumber:
            row.enrollmentNumber ??
            row["Enrollment Number"] ??
            row.enrollmentNo ??
            row["Enrollment No"] ??
            "",

          message: error.message,
        });
      }
    }

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "Revenue Excel import completed",

      importedCount:
        importedRecords.length,

      skippedCount:
        errors.length,

      errors,

      data: importedRecords,
    });

  } catch (error) {
    console.error(
      "Revenue Excel Import Error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to import revenue Excel",

      error: error.message,
    });
  }
};