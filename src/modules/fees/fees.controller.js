import Fees from "./fees.model.js";

/* Add Fees Entry */
export const addFees = async (req, res) => {
  try {
    const { studentId, amountPaid, planType, paymentDate, paymentMode } = req.body;

    const record = await Fees.create({
      studentId,
      amountPaid,
      planType,
      paymentDate,
      paymentMode,
      libraryId: req.user.libraryId
    });

    res.status(201).json({
      message: "Fees added successfully",
      record
    });
  } catch (error) {
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

    const today = new Date().toISOString().split("T")[0];

    const todayRevenue = fees
      .filter(f => f.paymentDate && f.paymentDate.startsWith(today))
      .reduce((sum, f) => sum + Number(f.amountPaid || 0), 0);

    const activePlans = fees.length;

    res.json({
      totalRevenue,
      todayRevenue,
      activePlans,
      pendingRevenue: 0 // (optional)
    });

  } catch (error) {
    console.error("🔥 STATS ERROR:", error); // 👈 MUST ADD
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
      startDate: today
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

    const today = new Date();

    const fees = await Fees.find({ libraryId })
      .populate({
        path: "studentId",
        match: { status: "active" },
        select: "enrollmentNumber name phone studyHours status"
      })
      .sort({ createdAt: -1 });

    // ✅ Group records by student
    const grouped = {};

    fees.forEach(item => {
      if (!item.studentId) return;

      const studentId = item.studentId._id.toString();

      if (!grouped[studentId]) {
        grouped[studentId] = [];
      }

      grouped[studentId].push(item);
    });

    const result = Object.values(grouped).map(records => {
      // ✅ sort latest first
      records.sort(
        (a, b) => new Date(b.endDate) - new Date(a.endDate)
      );

      const latest = records[0];     // current
      const previous = records[1];   // last

      const student = latest.studentId;

      const isExpired = latest.endDate && latest.endDate < today;

      const isRecentlyRenewed =
        new Date(latest.paymentDate).toDateString() === today.toDateString();

      let status = "warning";

      if (isExpired) {
        status = "pending";
      } else if (isRecentlyRenewed) {
        status = "completed";
      }

      return {
        _id: latest._id,
        studentId: student._id,
        enrollmentNumber: student.enrollmentNumber,
        name: student.name,
        phone: student.phone,
        studyHours: student.studyHours,

        // ✅ correct last renewal
        lastRenewalDate: previous
  ? previous.endDate
  : latest.endDate,

        renewDate: latest.paymentDate,
        nextRenewDate: latest.endDate,

        status,
        canRenew: status !== "completed"
      };
    });

    // ✅ RESPONSE (missing tha)
    res.json({
      success: true,
      count: result.length,
      data: result
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
