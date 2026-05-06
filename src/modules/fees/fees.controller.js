import Fees from "./fees.model.js";

/* Add Fees Entry */
export const addFees = async (req, res) => {
  try {
    const {
      studentId,
      amountPaid,
      planType,
      paymentDate,
      paymentMode,
      hours,
      startDate
    } = req.body;

    // ✅ validation
    if (!studentId || !planType || !hours) {
      return res.status(400).json({
        message: "Student, plan type and hours are required"
      });
    }

    // 🔥 FIX: ISO DATE SAFE PARSE
    let start;

    if (startDate) {
      start = new Date(startDate); // ✅ direct parse
    } else {
      start = new Date();
    }

    // normalize time (important)
    start.setHours(0, 0, 0, 0);

    // ✅ plan duration map
    const durationMap = {
      monthly: 1,
      threeMonths: 3,
      sixMonths: 6,
      yearly: 12
    };

    const months = durationMap[planType];

    if (!months) {
      return res.status(400).json({
        message: "Invalid plan type"
      });
    }

    // 🔥 END DATE CALCULATION
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);

    // edge case fix (31st issues)
    if (end.getDate() !== start.getDate()) {
      end.setDate(0);
    }

    // 🔥 FIX: PAYMENT DATE LOGIC
    let payment;

    if (paymentDate) {
      payment = new Date(paymentDate);
    } else {
      payment = start; // ✅ IMPORTANT (old entry fix)
    }

    payment.setHours(0, 0, 0, 0);

    // ✅ create record
    const record = await Fees.create({
      studentId,
      amountPaid,
      planType,
      paymentDate: payment,
      paymentMode,
      hours,
      libraryId: req.user.libraryId,
      startDate: start,
      endDate: end
    });

    res.status(201).json({
      message: "Fees added successfully",
      record
    });

  } catch (error) {
    console.error("ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};
/* Student Fees History */
export const getStudentFees = async (req, res) => {
  try {
    const { studentId } = req.params;

    const history = await Fees.find({ studentId })
      .populate("studentId", "name phone") // 🔥 important
      .sort({ paymentDate: -1 });

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getFees = async (req, res) => {
  try {
    const fees = await Fees.find()
      .populate("studentId", "name phone") // 🔥 YE ADD KARO
      .sort({ createdAt: -1 });

    res.json(fees);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRevenueStats = async (req, res) => {
  try {
    const fees = await Fees.find();

    const totalRevenue = fees.reduce(
      (sum, f) => sum + Number(f.amountPaid || 0),
      0
    );

    // 🔥 FIX START
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayRevenue = fees
      .filter(f => {
        if (!f.paymentDate) return false;

        const payment = new Date(f.paymentDate);

        return payment >= today && payment < tomorrow;
      })
      .reduce((sum, f) => sum + Number(f.amountPaid || 0), 0);
    // 🔥 FIX END

    const activePlans = fees.length;

    res.json({
      totalRevenue,
      todayRevenue,
      activePlans,
      pendingRevenue: 0
    });

  } catch (error) {
    console.error("🔥 STATS ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteFees = async (req, res) => {
  try {
    const { id } = req.params;

    await Fees.findByIdAndDelete(id);

    res.json({ message: "Fees deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const planTypeByDuration = {
  1: "monthly",
  3: "threeMonths",
  6: "sixMonths",
  12: "yearly"
};

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const renewFees = async (req, res) => {
  try {
    const { id } = req.params;
    const { duration } = req.body;
    const planType = planTypeByDuration[Number(duration)];

    if (!planType) {
      return res.status(400).json({
        message: "Please select a valid renewal duration"
      });
    }

    const currentFees = await Fees.findOne({
      _id: id,
      libraryId: req.user.libraryId
    }).populate({
      path: "studentId",
      match: { status: "active" },
      select: "_id status"
    });

    if (!currentFees || !currentFees.studentId) {
      return res.status(404).json({
        message: "Active student renewal record not found"
      });
    }

    const today = new Date();
    const paymentDate = formatLocalDate(today);

    const renewedFees = await Fees.create({
      studentId: currentFees.studentId._id,
      libraryId: req.user.libraryId,
      amountPaid: currentFees.amountPaid,
      planType,
      paymentDate,
      paymentMode: currentFees.paymentMode,
      startDate: today,

      hours: currentFees.hours   // 🔥 IMPORTANT FIX
    });

    res.json({
      success: true,
      message: "Renewal updated successfully",
      data: {
        _id: renewedFees._id,
        studentId: renewedFees.studentId,
        renewDate: renewedFees.paymentDate,
        nextRenewDate: renewedFees.endDate,
        status: "completed"
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRenewalList = async (req, res) => {
  try {
    const { libraryId } = req.user;

    const { month, year } = req.query;

    const today = new Date();

    const selectedMonth = month ? Number(month) : today.getMonth() + 1;
    const selectedYear = year ? Number(year) : today.getFullYear();

    const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
    const endOfMonth = new Date(selectedYear, selectedMonth, 0);

    const fees = await Fees.find({ libraryId })
      .populate({
        path: "studentId",
        match: { status: "active" },
        select: "enrollmentNumber name phone studyHours status"
      })
      .sort({ createdAt: -1 }); // 🔥 important

    const filtered = fees
      .filter(item => {
        if (!item.studentId || !item.endDate) return false;

        const endDate = new Date(item.endDate);

        return endDate >= startOfMonth && endDate <= endOfMonth;
      })
      .map(item => {
        const student = item.studentId;

        const isExpired = new Date(item.endDate) < today;

        const renewedAfter =
          new Date(item.paymentDate) > new Date(item.endDate);

        let status = "warning";

        if (isExpired && !renewedAfter) status = "pending";
        else if (renewedAfter) status = "completed";

        return {
          _id: item._id,
          studentId: student._id,
          enrollmentNumber: student.enrollmentNumber,
          name: student.name,
          phone: student.phone,

          // 🔥 FIX HERE (IMPORTANT)
          studyHours: item.hours,  

          lastRenewalDate: item.endDate,
          renewDate: item.paymentDate,
          nextRenewDate: item.endDate,

          status,
          canRenew: !renewedAfter
        };
      });

    res.json({
      success: true,
      count: filtered.length,
      data: filtered
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};