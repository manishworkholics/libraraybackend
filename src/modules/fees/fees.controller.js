import Fees from "./fees.model.js";
import FeePayment from "./feePayment.model.js";
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

const toDateOnly = (value) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const createReceipt = async (fee, values) => {
  const cashAmount = Number(values.cashAmount) || 0;
  const onlineAmount = Number(values.onlineAmount) || 0;

  return FeePayment.create({
    libraryId: fee.libraryId,
    feeId: fee._id,
    studentId: fee.studentId,
    cashAmount,
    onlineAmount,
    paidAmount: cashAmount + onlineAmount,
    totalAmount: Number(values.totalAmount ?? fee.totalAmount) || 0,
    dueAmount: Math.max(Number(values.dueAmount) || 0, 0),
    paymentDate: values.paymentDate || fee.paymentDate || new Date(),
    transactionType: values.transactionType || fee.transactionType || "new_admission",
    idempotencyKey: values.idempotencyKey || null,
  });
};

// Existing database records have no receipt documents. Their current fee row
// is their original receipt until a later due payment is recorded.
const ensureOriginalReceipt = async (fee) => {
  const existing = await FeePayment.findOne({ feeId: fee._id }).lean();
  if (existing) {
    if (!fee.hasPaymentReceipts) {
      fee.hasPaymentReceipts = true;
      await fee.save();
    }
    return;
  }

  await createReceipt(fee, {
    cashAmount: fee.cashAmount,
    onlineAmount: fee.onlineAmount,
    totalAmount: fee.totalAmount,
    dueAmount: fee.dueAmount,
    paymentDate: fee.paymentDate,
    transactionType: fee.transactionType || "new_admission",
  });
  fee.hasPaymentReceipts = true;
  await fee.save();
};

const recalculateFeeBalance = async (fee) => {
  const [totals] = await FeePayment.aggregate([
    { $match: { feeId: fee._id } },
    {
      $group: {
        _id: null,
        cashAmount: { $sum: "$cashAmount" },
        onlineAmount: { $sum: "$onlineAmount" },
        paidAmount: { $sum: "$paidAmount" },
      },
    },
  ]);

  fee.cashAmount = Number(totals?.cashAmount) || 0;
  fee.onlineAmount = Number(totals?.onlineAmount) || 0;
  fee.paidAmount = Number(totals?.paidAmount) || 0;
  fee.dueAmount = Math.max(Number(fee.totalAmount || 0) - fee.paidAmount, 0);
  fee.paymentStatus = fee.dueAmount <= 0 ? "paid" : fee.paidAmount > 0 ? "partial" : "pending";
  fee.hasPaymentReceipts = true;
  await fee.save();

  const receipts = await FeePayment.find({ feeId: fee._id }).sort({ paymentDate: 1, createdAt: 1 });
  let runningPaid = 0;
  for (const receipt of receipts) {
    runningPaid += Number(receipt.paidAmount) || 0;
    const dueAfterPayment = Math.max(Number(fee.totalAmount || 0) - runningPaid, 0);
    if (receipt.dueAmount !== dueAfterPayment || receipt.totalAmount !== fee.totalAmount) {
      receipt.totalAmount = fee.totalAmount;
      receipt.dueAmount = dueAfterPayment;
      await receipt.save();
    }
  }
  return fee;
};

const formatReceipt = (payment, fee, student) => ({
  ...payment,
  _id: payment._id,
  receiptId: payment._id,
  feeId: fee._id,
  recordType: "payment",
  studentId: student || fee.studentId,
  totalAmount: Number(payment.totalAmount) || 0,
  cashAmount: Number(payment.cashAmount) || 0,
  onlineAmount: Number(payment.onlineAmount) || 0,
  paidAmount: Number(payment.paidAmount) || 0,
  dueAmount: Number(payment.dueAmount) || 0,
  currentDueAmount: Number(fee.dueAmount) || 0,
  paymentDate: toDateOnly(payment.paymentDate),
  startDate: toDateOnly(fee.startDate),
  endDate: toDateOnly(fee.endDate),
  renewalDate: toDateOnly(fee.renewalDate),
  planType: fee.planType,
  studyHours: fee.studyHours,
  remark: payment.transactionType === "due_payment" ? "Remaining Payment" : payment.transactionType === "renewal" ? "Renewal" : "New Admission",
});

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

    await createReceipt(fees, {
      cashAmount: finalCashAmount,
      onlineAmount: finalOnlineAmount,
      totalAmount,
      dueAmount,
      paymentDate: finalPaymentDate,
      transactionType: "new_admission",
    });
    fees.hasPaymentReceipts = true;
    await fees.save();
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
      .lean();

    const feeIds = fees.map((fee) => fee._id);
    const payments = await FeePayment.find({ libraryId, studentId, feeId: { $in: feeIds } })
      .sort({ paymentDate: -1 })
      .lean();
    const feeById = new Map(fees.map((fee) => [String(fee._id), fee]));
    const receiptFeeIds = new Set(payments.map((payment) => String(payment.feeId)));
    const legacy = fees.filter((fee) => !receiptFeeIds.has(String(fee._id)));

    const formattedFees = [
      ...payments.map((payment) => formatReceipt(payment, feeById.get(String(payment.feeId)), null)),
      ...legacy.map((fee) => ({
        ...fee,
        recordType: "legacy-fee",
        feeId: fee._id,
        currentDueAmount: Number(fee.dueAmount) || 0,
        paymentDate: toDateOnly(fee.paymentDate),
        startDate: toDateOnly(fee.startDate),
        endDate: toDateOnly(fee.endDate),
        renewalDate: toDateOnly(fee.renewalDate),
        remark: fee.transactionType === "renewal" ? "Renewal" : "New Admission",
      })),
    ].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

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

    const fees = await Fees.find({ libraryId })
      .populate("studentId", "name enrollmentNumber")
      .lean();

    const feeIds = fees.map((fee) => fee._id);
    const paymentFilter = { libraryId, feeId: { $in: feeIds } };
    if (month && year) {
      paymentFilter.paymentDate = filter.paymentDate;
    }
    const payments = await FeePayment.find(paymentFilter).sort({ paymentDate: -1 }).lean();
    const receiptFeeIds = new Set(payments.map((payment) => String(payment.feeId)));
    const formattedFees = [
      ...payments.map((payment) => {
        const fee = fees.find((item) => String(item._id) === String(payment.feeId));
        return formatReceipt(payment, fee, fee.studentId);
      }),
      ...fees
        .filter((fee) => !fee.hasPaymentReceipts && (!filter.paymentDate || (fee.paymentDate >= filter.paymentDate.$gte && fee.paymentDate < filter.paymentDate.$lt)))
        .map((fee) => ({
          ...fee,
          recordType: "legacy-fee",
          feeId: fee._id,
          currentDueAmount: Number(fee.dueAmount) || 0,
          paymentDate: toDateOnly(fee.paymentDate),
          startDate: toDateOnly(fee.startDate),
          endDate: toDateOnly(fee.endDate),
          renewalDate: toDateOnly(fee.renewalDate),
          remark: fee.transactionType === "renewal" ? "Renewal" : "New Admission",
        })),
    ].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

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

    // Receipt documents are the source of truth for money received. Legacy
    // fee rows (created before receipts were introduced) are retained as-is.
    const allFees = await Fees.find({ libraryId }).lean();
    const feeIds = allFees.map((fee) => fee._id);
    const receiptFilter = { libraryId, feeId: { $in: feeIds } };
    if (filter.paymentDate) receiptFilter.paymentDate = filter.paymentDate;
    const receipts = await FeePayment.find(receiptFilter).lean();

    const legacyFees = allFees.filter((fee) =>
      !fee.hasPaymentReceipts &&
      (!filter.paymentDate || (fee.paymentDate >= filter.paymentDate.$gte && fee.paymentDate < filter.paymentDate.$lt))
    );

    const totalCashRevenue = [...receipts, ...legacyFees]
      .reduce((sum, item) => sum + (Number(item.cashAmount) || 0), 0);
    const totalOnlineRevenue = [...receipts, ...legacyFees]
      .reduce((sum, item) => sum + (Number(item.onlineAmount) || 0), 0);

    // Outstanding balance is a live balance, so it must not be double-counted
    // per receipt or disappear merely because the payment happened next month.
    const totalDueAmount = allFees
      .reduce((sum, fee) => sum + (Number(fee.dueAmount) || 0), 0);

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

    if (fees.hasPaymentReceipts) {
      return res.status(400).json({
        success: false,
        message: "Edit the individual payment receipt instead of overwriting this membership record",
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
// RECORD / EDIT / DELETE INDIVIDUAL PAYMENT RECEIPTS
// ============================================================
export const addDuePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { cashAmount = 0, onlineAmount = 0, paymentDate, idempotencyKey } = req.body;
    const libraryId = req.user?.libraryId;
    const fee = await Fees.findOne({ _id: id, libraryId });

    if (!fee) {
      return res.status(404).json({ success: false, message: "Revenue record not found" });
    }

    const cash = Number(cashAmount);
    const online = Number(onlineAmount);
    const paid = cash + online;
    const finalPaymentDate = parsePaymentDate(paymentDate);
    if (!Number.isFinite(cash) || !Number.isFinite(online) || cash < 0 || online < 0 || paid <= 0) {
      return res.status(400).json({ success: false, message: "Enter a valid due payment amount" });
    }
    if (!finalPaymentDate) {
      return res.status(400).json({ success: false, message: "Invalid payment date" });
    }
    if (idempotencyKey) {
      const duplicate = await FeePayment.findOne({ libraryId, idempotencyKey });
      if (duplicate) {
        return res.status(409).json({ success: false, message: "This due payment was already recorded" });
      }
    }

    // Converts an old fee row into an original receipt only when it first
    // receives a later payment; no existing document is deleted.
    await ensureOriginalReceipt(fee);
    await recalculateFeeBalance(fee);
    if (paid > Number(fee.dueAmount || 0)) {
      return res.status(400).json({ success: false, message: "Due payment cannot exceed the outstanding amount" });
    }

    const receipt = await createReceipt(fee, {
      cashAmount: cash,
      onlineAmount: online,
      totalAmount: fee.totalAmount,
      dueAmount: Math.max(Number(fee.dueAmount) - paid, 0),
      paymentDate: finalPaymentDate,
      transactionType: "due_payment",
      idempotencyKey,
    });
    await recalculateFeeBalance(fee);

    return res.status(201).json({ success: true, message: "Due payment recorded successfully", data: receipt });
  } catch (error) {
    console.error("Add Due Payment Error:", error);
    return res.status(500).json({ success: false, message: "Failed to record due payment", error: error.message });
  }
};

export const updateFeePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const libraryId = req.user?.libraryId;
    const receipt = await FeePayment.findOne({ _id: id, libraryId });
    if (!receipt) return res.status(404).json({ success: false, message: "Payment receipt not found" });

    const fee = await Fees.findOne({ _id: receipt.feeId, libraryId });
    if (!fee) return res.status(404).json({ success: false, message: "Revenue record not found" });

    const cash = req.body.cashAmount === undefined ? receipt.cashAmount : Number(req.body.cashAmount);
    const online = req.body.onlineAmount === undefined ? receipt.onlineAmount : Number(req.body.onlineAmount);
    const paid = cash + online;
    const otherPaid = await FeePayment.aggregate([
      { $match: { feeId: fee._id, _id: { $ne: receipt._id } } },
      { $group: { _id: null, paid: { $sum: "$paidAmount" } } },
    ]);
    if (!Number.isFinite(cash) || !Number.isFinite(online) || cash < 0 || online < 0 || paid + (Number(otherPaid[0]?.paid) || 0) > Number(fee.totalAmount || 0)) {
      return res.status(400).json({ success: false, message: "Payment amount cannot exceed the membership fee" });
    }
    if (req.body.paymentDate !== undefined) {
      const date = parsePaymentDate(req.body.paymentDate);
      if (!date) return res.status(400).json({ success: false, message: "Invalid payment date" });
      receipt.paymentDate = date;
    }
    receipt.cashAmount = cash;
    receipt.onlineAmount = online;
    receipt.paidAmount = paid;
    await receipt.save();
    await recalculateFeeBalance(fee);
    return res.status(200).json({ success: true, message: "Payment receipt updated successfully", data: receipt });
  } catch (error) {
    console.error("Update Fee Payment Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update payment receipt", error: error.message });
  }
};

export const deleteFeePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const libraryId = req.user?.libraryId;

    // 1. Find the payment receipt
    const receipt = await FeePayment.findOne({
      _id: id,
      libraryId,
    });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: "Payment receipt not found",
      });
    }

    // 2. Find the membership record linked to this receipt
    const fee = await Fees.findOne({
      _id: receipt.feeId,
      libraryId,
    });

    if (!fee) {
      // Delete only the selected receipt if its fee record
      // no longer exists.
      await FeePayment.findOneAndDelete({
        _id: id,
        libraryId,
      });

      return res.status(200).json({
        success: true,
        message: "Payment receipt deleted successfully",
      });
    }

    // 3. If this is a renewal transaction, delete the renewal
    // record and all receipts belonging to that renewal.
    if (fee.transactionType === "renewal") {
      await FeePayment.deleteMany({
        feeId: fee._id,
        libraryId,
      });

      await Fees.findOneAndDelete({
        _id: fee._id,
        libraryId,
        transactionType: "renewal",
      });

      return res.status(200).json({
        success: true,
        message: "Renewal transaction deleted successfully",
      });
    }

    // 4. For normal payments and due payments,
    // preserve the existing deletion behaviour.
    await FeePayment.findOneAndDelete({
      _id: id,
      libraryId,
    });

    // 5. Recalculate the remaining balance
    await recalculateFeeBalance(fee);

    return res.status(200).json({
      success: true,
      message: "Payment receipt deleted successfully",
    });
  } catch (error) {
    console.error("Delete Fee Payment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete payment receipt",
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

    await FeePayment.deleteMany({ feeId: fees._id, libraryId });

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
    const { id } = req.params;

    const {
      duration,
      renewType = "continue",
      studyHours,
      renewalDate,
      nextRenewalDate,
      amount,
      cashAmount = 0,
      onlineAmount = 0,
      paymentDate,
    } = req.body;

    const libraryId = req.user?.libraryId;

    if (!libraryId) {
      return res.status(401).json({
        success: false,
        message: "Library access denied",
      });
    }

    const isCustomDuration =
      String(duration).toLowerCase() === "custom";

    if (
      !duration ||
      (!isCustomDuration &&
        ![1, 3, 6, 12].includes(Number(duration)))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid membership duration",
      });
    }

    if (!["continue", "fresh"].includes(renewType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid renewal type",
      });
    }

    const currentFees = await Fees.findOne({
      _id: id,
      libraryId,
    });

    if (!currentFees) {
      return res.status(404).json({
        success: false,
        message: "Fee record not found",
      });
    }

    const student = await Student.findOne({
      _id: currentFees.studentId,
      libraryId,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const durationMap = {
      1: "monthly",
      3: "quarterly",
      6: "halfYearly",
      12: "yearly",
    };

    const planType = isCustomDuration
      ? currentFees.planType || "monthly"
      : durationMap[Number(duration)];

    const finalStudyHours =
      studyHours !== undefined &&
        studyHours !== null &&
        studyHours !== ""
        ? String(studyHours)
        : String(
          currentFees.studyHours ??
          student.studyHours ??
          ""
        );

    const existingStudyHours = String(
      currentFees.studyHours ??
      student.studyHours ??
      ""
    );

    const studyHoursChanged =
      finalStudyHours !== existingStudyHours;

    const finalPaymentDate = parsePaymentDate(paymentDate);

    // Parse YYYY-MM-DD without timezone date shifting
    const parseDateOnly = (dateValue) => {
      if (!dateValue) return null;

      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
        String(dateValue)
      );

      if (!match) return null;

      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);

      const parsedDate = new Date(
        Date.UTC(year, month - 1, day)
      );

      if (
        parsedDate.getUTCFullYear() !== year ||
        parsedDate.getUTCMonth() !== month - 1 ||
        parsedDate.getUTCDate() !== day
      ) {
        return null;
      }

      return parsedDate;
    };

    // Determine membership start date
    let renewalStartDate;

    if (renewalDate) {
      renewalStartDate = parseDateOnly(renewalDate);

      if (!renewalStartDate) {
        return res.status(400).json({
          success: false,
          message: "Invalid renewal date",
        });
      }
    } else if (studyHoursChanged) {
      return res.status(400).json({
        success: false,
        message:
          "Renewal date is required when changing study hours",
      });
    } else if (renewType === "continue") {
      renewalStartDate = currentFees.endDate
        ? new Date(currentFees.endDate)
        : new Date();
    } else {
      renewalStartDate = new Date();
    }

    if (
      !renewalStartDate ||
      Number.isNaN(renewalStartDate.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid membership start date",
      });
    }

    // Calculate membership end date
    let renewalEndDate;

    if (isCustomDuration) {
      if (!renewalDate || !nextRenewalDate) {
        return res.status(400).json({
          success: false,
          message:
            "Renewal date and next renewal date are required for custom duration",
        });
      }

      // Preserve the exact date selected in the frontend
      renewalEndDate = parseDateOnly(nextRenewalDate);

      if (!renewalEndDate) {
        return res.status(400).json({
          success: false,
          message: "Invalid next renewal date",
        });
      }

      if (
        renewalEndDate.getTime() <=
        renewalStartDate.getTime()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Next renewal date must be after the renewal date",
        });
      }
    } else {
      // Existing duration calculation
      renewalEndDate = new Date(renewalStartDate);

      renewalEndDate.setMonth(
        renewalEndDate.getMonth() + Number(duration)
      );
    }

    // Validate new renewal amount
    const renewalAmount = Number(amount);

    if (
      !Number.isFinite(renewalAmount) ||
      renewalAmount < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid renewal amount",
      });
    }

    const finalCashAmount = Number(cashAmount);
    const finalOnlineAmount = Number(onlineAmount);

    if (
      !Number.isFinite(finalCashAmount) ||
      !Number.isFinite(finalOnlineAmount) ||
      finalCashAmount < 0 ||
      finalOnlineAmount < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amounts",
      });
    }

    // --------------------------------------------------
    // PREVIOUS DUE + NEW RENEWAL PAYMENT CALCULATION
    // --------------------------------------------------

    // Ensure existing fee has a receipt before changing its balance.
    // These helpers must already exist in your controller.
    await ensureOriginalReceipt(currentFees);
    await recalculateFeeBalance(currentFees);

    // Outstanding amount from the previous fee transaction
    const previousDue = Math.max(
      Number(currentFees.dueAmount) || 0,
      0
    );

    // Total amount payable = previous due + new renewal amount
    const totalPayable = previousDue + renewalAmount;

    // Total cash and online payment collected from the student
    const totalCollected =
      finalCashAmount + finalOnlineAmount;

    // Prevent overpayment
    if (totalCollected > totalPayable) {
      return res.status(400).json({
        success: false,
        message:
          "Paid amount cannot exceed the total payable amount",
      });
    }

    // Allocate payment to the previous due first.
    // Cash is allocated first, followed by online payment.
    const cashToPreviousDue = Math.min(
      finalCashAmount,
      previousDue
    );

    const remainingPreviousDueAfterCash = Math.max(
      previousDue - cashToPreviousDue,
      0
    );

    const onlineToPreviousDue = Math.min(
      finalOnlineAmount,
      remainingPreviousDueAfterCash
    );

    const previousDuePayment =
      cashToPreviousDue + onlineToPreviousDue;

    // Remaining payment belongs to the new renewal
    const renewalCashAmount = Math.max(
      finalCashAmount - cashToPreviousDue,
      0
    );

    const renewalOnlineAmount = Math.max(
      finalOnlineAmount - onlineToPreviousDue,
      0
    );

    const renewalPaidAmount =
      renewalCashAmount + renewalOnlineAmount;

    // Calculate balances separately
    const remainingPreviousDue = Math.max(
      previousDue - previousDuePayment,
      0
    );

    const renewalDueAmount = Math.max(
      renewalAmount - renewalPaidAmount,
      0
    );

    // --------------------------------------------------
    // RECORD PAYMENT AGAINST THE ORIGINAL FEE
    // --------------------------------------------------

    // This payment is linked to the original fee transaction.
    // It will reduce the previous fee's outstanding balance.
    if (previousDuePayment > 0) {
      await createReceipt(currentFees, {
        cashAmount: cashToPreviousDue,
        onlineAmount: onlineToPreviousDue,
        totalAmount: Number(
          currentFees.totalAmount
        ) || 0,
        dueAmount: remainingPreviousDue,
        paymentDate: finalPaymentDate,
        transactionType: "due_payment",
      });

      // Recalculate the original fee using its receipts.
      await recalculateFeeBalance(currentFees);
    }

    // --------------------------------------------------
    // NEW RENEWAL PAYMENT STATUS
    // --------------------------------------------------

    let paymentStatus = "partial";

    if (renewalPaidAmount >= renewalAmount) {
      paymentStatus = "paid";
    } else if (renewalPaidAmount <= 0) {
      paymentStatus = "pending";
    }

    // --------------------------------------------------
    // CREATE NEW RENEWAL TRANSACTION
    // --------------------------------------------------

    const renewedFees = await Fees.create({
      studentId: currentFees.studentId,

      registrationFees: 0,
      monthlyFees: renewalAmount,

      // The new renewal contains only its own amount.
      // Previous due is not added to this transaction.
      totalAmount: renewalAmount,

      cashAmount: renewalCashAmount,
      onlineAmount: renewalOnlineAmount,
      paidAmount: renewalPaidAmount,
      dueAmount: renewalDueAmount,
      paymentStatus,

      planType,
      paymentDate: finalPaymentDate,

      transactionType: "renewal",
      studyHours: finalStudyHours,

      libraryId,
      renewedFromFeeId: currentFees._id,

      startDate: renewalStartDate,
      endDate: renewalEndDate,
      renewalDate: renewalEndDate,
    });

    console.log(
      "Selected next renewal date:",
      nextRenewalDate
    );

    console.log(
      "Calculated end date ISO:",
      renewalEndDate.toISOString()
    );

    console.log(
      "Saved end date ISO:",
      renewedFees.endDate?.toISOString()
    );

    // --------------------------------------------------
    // CREATE RECEIPT FOR THE NEW RENEWAL ONLY
    // --------------------------------------------------

    await createReceipt(renewedFees, {
      cashAmount: renewalCashAmount,
      onlineAmount: renewalOnlineAmount,
      totalAmount: renewalAmount,
      dueAmount: renewalDueAmount,
      paymentDate: finalPaymentDate,
      transactionType: "renewal",
    });

    renewedFees.hasPaymentReceipts = true;
    await renewedFees.save();

    // --------------------------------------------------
    // UPDATE STUDY HOURS
    // --------------------------------------------------

    if (finalStudyHours !== "") {
      currentFees.studyHours = finalStudyHours;
      await currentFees.save();

      student.studyHours = finalStudyHours;
      await student.save();
    }

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(201).json({
      success: true,
      message: "Membership renewed successfully",

      data: {
        ...renewedFees.toObject(),

        studyHours: finalStudyHours,
        renewedFromFeeId: currentFees._id,

        // Additional payment summary
        previousDueAmount: previousDue,
        previousDuePaidAmount: previousDuePayment,
        remainingPreviousDue,
        renewalAmount,
        renewalPaidAmount,
        renewalDueAmount,
        totalPayable,
        totalCollected,
      },
    });
  } catch (error) {
    console.error("Renew fees error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to renew membership",
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

    const existingReceipts = fees.hasPaymentReceipts
      ? await FeePayment.find({ feeId: fees._id }).sort({ paymentDate: 1, createdAt: 1 })
      : [];
    const originalReceipt = existingReceipts.find(
      (receipt) => receipt.transactionType === "renewal"
    );

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

    const otherReceiptPaid = existingReceipts
      .filter((receipt) => String(receipt._id) !== String(originalReceipt?._id))
      .reduce((sum, receipt) => sum + (Number(receipt.paidAmount) || 0), 0);

    if (paidAmount + otherReceiptPaid > totalAmount) {
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

    const otherCash = existingReceipts
      .filter((receipt) => String(receipt._id) !== String(originalReceipt?._id))
      .reduce((sum, receipt) => sum + (Number(receipt.cashAmount) || 0), 0);
    const otherOnline = existingReceipts
      .filter((receipt) => String(receipt._id) !== String(originalReceipt?._id))
      .reduce((sum, receipt) => sum + (Number(receipt.onlineAmount) || 0), 0);

    fees.cashAmount = finalCashAmount + otherCash;

    fees.onlineAmount = finalOnlineAmount + otherOnline;

    fees.paidAmount = paidAmount + otherReceiptPaid;

    fees.dueAmount = Math.max(totalAmount - fees.paidAmount, 0);

    fees.paymentStatus = paymentStatus;

    fees.paymentDate = finalPaymentDate;

    fees.renewalDate = newRenewalDate;

    fees.endDate = newRenewalDate;

    fees.transactionType = "renewal";

    await fees.save();

    if (originalReceipt) {
      originalReceipt.cashAmount = finalCashAmount;
      originalReceipt.onlineAmount = finalOnlineAmount;
      originalReceipt.paidAmount = paidAmount;
      originalReceipt.paymentDate = finalPaymentDate;
      await originalReceipt.save();
      await recalculateFeeBalance(fees);
    }

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

    // VALIDATION
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

    // SELECTED MONTH START / END
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

    // HELPER FUNCTIONS
    const getDateKey = (value) => {
      if (!value) return null;

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return null;
      }

      return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");
    };

    const getTime = (value) => {
      if (!value) return 0;

      const time = new Date(value).getTime();

      return Number.isNaN(time) ? 0 : time;
    };

    // GET ALL FEE RECORDS
    const fees = await Fees.find({
      libraryId,
    })

      .populate(
        "studentId",
        "name enrollmentNumber phone status"
      )
      .sort({
        endDate: 1,
        createdAt: 1,
      })
      .lean();

    // ==========================================================
    // BUILD RENEWAL MAP
    // ==========================================================

    const renewalMap = new Map();
    const renewalsByStudent = new Map();

    for (const fee of fees) {
      if (fee.transactionType !== "renewal") {
        continue;
      }

      const studentId = fee.studentId?._id?.toString();

      if (!studentId) {
        continue;
      }

      const renewalStartDate = getDateKey(fee.startDate);

      if (!renewalStartDate) {
        continue;
      }

      const mapKey = `${studentId}_${renewalStartDate}`;

      const existing = renewalMap.get(mapKey);

      if (
        !existing ||
        getTime(fee.createdAt) > getTime(existing.createdAt)
      ) {
        renewalMap.set(mapKey, fee);
      }

      if (!renewalsByStudent.has(studentId)) {
        renewalsByStudent.set(studentId, []);
      }

      renewalsByStudent.get(studentId).push(fee);
    }

    // ==========================================================
    // FIND RENEWAL RECORDS
    // ==========================================================

    const renewalFees = [];

    for (const fee of fees) {
      if (!fee.endDate) {
        continue;
      }

      const membershipEndDate = new Date(fee.endDate);

      if (Number.isNaN(membershipEndDate.getTime())) {
        continue;
      }

      if (fee.studentId?.status === "inactive") {
        continue;
      }

      const studentId = fee.studentId?._id?.toString();

      const endDateKey = getDateKey(fee.endDate);

      const expiresInSelectedMonth =
        membershipEndDate >= startDate &&
        membershipEndDate < endDate;

      const exactRenewalKey =
        studentId && endDateKey
          ? `${studentId}_${endDateKey}`
          : null;

      // Find renewal linked to this exact original fee record
      const linkedRenewals = fees
        .filter(
          (renewal) =>
            renewal.transactionType === "renewal" &&
            String(renewal.renewedFromFeeId || "") ===
            String(fee._id)
        )
        .sort(
          (a, b) =>
            getTime(b.createdAt) - getTime(a.createdAt)
        );

      let completedRenewal =
        linkedRenewals[0] ||
        (exactRenewalKey
          ? renewalMap.get(exactRenewalKey) || null
          : null);
      // SUPPORT EARLY RENEWALS
      if (!completedRenewal && studentId) {
        const studentRenewals =
          renewalsByStudent.get(studentId) || [];

        const eligibleRenewals = studentRenewals.filter(
          (renewal) => {
            if (!renewal.startDate) {
              return false;
            }

            const renewalStart = new Date(renewal.startDate);

            if (Number.isNaN(renewalStart.getTime())) {
              return false;
            }

            if (renewalStart > membershipEndDate) {
              return false;
            }

            if (
              getTime(renewal.createdAt) <
              getTime(fee.createdAt)
            ) {
              return false;
            }

            if (
              renewal._id?.toString() === fee._id?.toString()
            ) {
              return false;
            }

            return true;
          }
        );

        if (eligibleRenewals.length > 0) {
          eligibleRenewals.sort(
            (a, b) =>
              getTime(b.createdAt) - getTime(a.createdAt)
          );

          completedRenewal = eligibleRenewals[0];
        }
      }

      const previousPending =
        membershipEndDate < startDate &&
        !completedRenewal;

      if (expiresInSelectedMonth || previousPending) {
        renewalFees.push({
          fee,
          completedRenewal,
        });
      }
    }


    // ==========================================================
    // FORMAT RESPONSE
    // ==========================================================

    const formattedFees = renewalFees.map(
      ({ fee, completedRenewal }) => {
        const studentId = fee.studentId?._id?.toString();

        const name = fee.studentId?.name || "-";

        const enrollmentNumber =
          fee.studentId?.enrollmentNumber || "-";

        const phone = fee.studentId?.phone || "-";

        const completedRenewalPayment =
          completedRenewal?.paymentDate
            ? new Date(completedRenewal.paymentDate)
            : null;

        // A renewal record by itself is not proof of a completed renewal.
        // If its payment receipt was deleted (or it still has a balance), the
        // renewal must return to Pending in the renewal list.
        const completedRenewalIsSettled = Boolean(
          completedRenewal &&
          Number(completedRenewal.dueAmount || 0) <= 0 &&
          (!completedRenewal.paymentStatus ||
            String(completedRenewal.paymentStatus).toLowerCase() === "paid")
        );

        const isRenewed = Boolean(
          completedRenewalPayment &&
          completedRenewalIsSettled &&
          completedRenewalPayment >= startDate &&
          completedRenewalPayment < endDate
        );

        const status = isRenewed
          ? "completed"
          : "pending";

        // EXISTING TABLE PAYMENT DETAILS
        const cashAmount = Number(fee.cashAmount) || 0;

        const onlineAmount = Number(fee.onlineAmount) || 0;

        const paidAmount =
          Number(fee.paidAmount) ||
          cashAmount + onlineAmount;

        const dueAmount = Number(fee.dueAmount) || 0;
        const previousDueAmount = dueAmount;

        let finalPaymentStatus = String(
          fee.paymentStatus || ""
        ).toLowerCase();

        if (!finalPaymentStatus) {
          if (dueAmount <= 0) {
            finalPaymentStatus = "paid";
          } else if (paidAmount > 0) {
            finalPaymentStatus = "partial";
          } else {
            finalPaymentStatus = "pending";
          }
        }

        // EXISTING DATES
        const paymentDate = fee.paymentDate
          ? getDateKey(fee.paymentDate)
          : null;

        const renewalDate = fee.renewalDate
          ? getDateKey(fee.renewalDate)
          : null;

        const startDateFormatted = fee.startDate
          ? getDateKey(fee.startDate)
          : null;

        const endDateFormatted = fee.endDate
          ? getDateKey(fee.endDate)
          : null;

        const completedRenewalPaymentDate =
          completedRenewal?.paymentDate
            ? getDateKey(completedRenewal.paymentDate)
            : null;

        const displayPaymentDate = isRenewed
          ? completedRenewalPaymentDate
          : paymentDate;

        const completedRenewalEndDate =
          completedRenewal?.endDate
            ? getDateKey(completedRenewal.endDate)
            : null;

        return {
          ...fee,

          // Student
          name,
          enrollmentNumber,
          phone,

          // EXISTING TABLE PAYMENT FIELDS
          cashAmount,
          onlineAmount,
          paidAmount,
          dueAmount,
          paymentStatus: finalPaymentStatus,
          previousDueAmount,
          // Renewal status
          status,
          isRenewed,

          // EXISTING TABLE DATES
          paymentDate: displayPaymentDate,
          renewalDate,
          startDate: startDateFormatted,
          endDate: endDateFormatted,

          lastRenewalDate: startDateFormatted,
          renewDate: displayPaymentDate,

          nextRenewDate: isRenewed
            ? completedRenewalEndDate
            : endDateFormatted,

          completedRenewalId:
            isRenewed ? completedRenewal?._id || null : null,

          completedRenewalPaymentDate,
          completedRenewalEndDate,

          // LATEST RENEWAL DATA FOR EDIT / UPDATE FORMS
          formRenewalId: completedRenewal?._id || fee._id,

          formStudyHours:
            completedRenewal?.studyHours ??
            fee.studyHours ??
            "",

          formAmount:
            completedRenewal?.monthlyFees ??
            completedRenewal?.amount ??
            fee.monthlyFees ??
            fee.amount ??
            0,

          formCashAmount:
            completedRenewal?.cashAmount ??
            fee.cashAmount ??
            0,

          formOnlineAmount:
            completedRenewal?.onlineAmount ??
            fee.onlineAmount ??
            0,

          formPaidAmount:
            completedRenewal?.paidAmount ??
            fee.paidAmount ??
            0,

          formDueAmount:
            completedRenewal?.dueAmount ??
            fee.dueAmount ??
            0,

          formPaymentDate:
            completedRenewal?.paymentDate
              ? getDateKey(completedRenewal.paymentDate)
              : paymentDate,

          formStartDate:
            completedRenewal?.startDate
              ? getDateKey(completedRenewal.startDate)
              : startDateFormatted,

          formEndDate:
            completedRenewal?.endDate
              ? getDateKey(completedRenewal.endDate)
              : endDateFormatted,

          formPlanType:
            completedRenewal?.planType ??
            fee.planType ??
            "",

          // Transaction
          transactionType:
            fee.transactionType || "new_admission",

          remark:
            fee.transactionType === "renewal"
              ? "Renewal"
              : "New Admission",

          // Action
          canRenew: true,
        };
      }
    );

    // SORT BY MEMBERSHIP END DATE
    formattedFees.sort((a, b) => {
      const dateA = a.endDate
        ? new Date(a.endDate).getTime()
        : Infinity;

      const dateB = b.endDate
        ? new Date(b.endDate).getTime()
        : Infinity;

      return dateA - dateB;
    });

    // RESPONSE
    return res.status(200).json({
      success: true,
      data: formattedFees,
    });
  } catch (error) {
    console.error("Get Renewal List Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch renewal list",
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
