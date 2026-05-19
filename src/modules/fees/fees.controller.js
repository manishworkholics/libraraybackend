import Fees from "./fees.model.js";

/* Add Fees Entry */
export const addFees = async (req, res) => {

  try {

    const {
      studentId,
      amountPaid,
      dueAmount,
      planType,
      paymentDate,
      paymentMode,
      hours,
      startDate,
      endDate
    } = req.body;
    console.log("BODY:", req.body);
    // ✅ VALIDATION
    if (!studentId || !planType || !hours) {
      return res.status(400).json({
        message:
          "Student, plan type and hours are required"
      });
    }

    // ✅ START DATE
    let start;

    if (startDate) {

      // 🔥 TIMEZONE SAFE
      start = new Date(
        `${startDate}T00:00:00`
      );

    } else {

      start = new Date();

    }

    start.setHours(0, 0, 0, 0);

    // ✅ PLAN DURATION MAP
    const durationMap = {
      monthly: 1,
      threeMonths: 3,
      sixMonths: 6,
      yearly: 12
    };

    let finalEndDate;

    // 🔥 CUSTOM PLAN
    if (planType === "custom") {

      if (!endDate) {
        return res.status(400).json({
          message:
            "End date is required for custom plan"
        });
      }

      // 🔥 TIMEZONE SAFE
      finalEndDate = new Date(endDate);

      finalEndDate.setDate(
        finalEndDate.getDate() + 1
      );

    }

    // 🔥 NORMAL PLANS
    else {

      const months =
        durationMap[planType];

      if (!months) {
        return res.status(400).json({
          message:
            "Invalid plan type"
        });
      }

      finalEndDate =
        new Date(start);

      finalEndDate.setMonth(
        finalEndDate.getMonth() + months
      );

      // 🔥 31st EDGE CASE FIX
      if (
        finalEndDate.getDate() !==
        start.getDate()
      ) {
        finalEndDate.setDate(0);
      }

    }

    finalEndDate.setHours(
      0,
      0,
      0,
      0
    );

    // ✅ PAYMENT DATE
    let payment;

    if (paymentDate) {

      // 🔥 TIMEZONE SAFE
      payment = new Date(
        `${paymentDate}T00:00:00`
      );

    } else {

      payment = new Date(start);

    }

    payment.setHours(
      0,
      0,
      0,
      0
    );

    // ✅ CREATE FEES RECORD
    const record =
      await Fees.create({

        studentId,

        amountPaid:
          Number(amountPaid || 0),

        dueAmount:
          Number(dueAmount || 0),

        planType,

        paymentDate: payment,

        paymentMode,

        hours:
          Number(hours || 0),

        libraryId:
          req.user.libraryId,

        startDate: start,

        endDate: finalEndDate

      });

    res.status(201).json({
      message:
        "Fees added successfully",

      record
    });

  } catch (error) {

    console.error(
      "ERROR:",
      error
    );

    res.status(500).json({
      message:
        error.message
    });

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
    const { libraryId } = req.user;
    const { month, year } = req.query;

    let filter = { libraryId };

    // 🔥 Apply month filter (timezone safe)
    if (month && year) {
      const m = Number(month);
      const y = Number(year);

      const startOfMonth = new Date(Date.UTC(y, m - 1, 1));
      const endOfMonth = new Date(Date.UTC(y, m, 1));

      filter.startDate = {
        $gte: startOfMonth,
        $lt: endOfMonth
      };
    }

    const fees = await Fees.find(filter)
      .populate("studentId")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: fees.length,
      fees
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getRevenueStats = async (req, res) => {
  try {

    const fees = await Fees.find({
      libraryId: req.user.libraryId
    });

    // ✅ TOTAL REVENUE
    const totalRevenue = fees.reduce(
      (sum, f) =>
        sum + Number(f.amountPaid || 0),
      0
    );

    // ✅ TODAY REVENUE
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);

    tomorrow.setDate(
      today.getDate() + 1
    );

    const todayRevenue = fees
      .filter((f) => {

        if (!f.paymentDate)
          return false;

        const payment =
          new Date(f.paymentDate);

        return (
          payment >= today &&
          payment < tomorrow
        );

      })

      .reduce(
        (sum, f) =>
          sum + Number(f.amountPaid || 0),
        0
      );

    // ✅ PENDING REVENUE
    const pendingRevenue = fees.reduce(
      (sum, f) =>
        sum + Number(f.dueAmount || 0),
      0
    );

    // ✅ ACTIVE PLANS
    const activePlans = fees.length;

    res.json({
      totalRevenue,
      todayRevenue,
      pendingRevenue,
      activePlans
    });

  } catch (error) {

    console.error(
      "🔥 STATS ERROR:",
      error
    );

    res.status(500).json({
      message: error.message
    });

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

    // 🔥 NEW
    const {
      duration,
      renewType
    } = req.body;

    const planType =
      planTypeByDuration[
      Number(duration)
      ];

    if (!planType) {

      return res.status(400).json({
        message:
          "Please select a valid renewal duration"
      });
    }

    const currentFees =
      await Fees.findOne({
        _id: id,
        libraryId:
          req.user.libraryId
      }).populate({
        path: "studentId",
        match: {
          status: "active"
        },
        select: "_id status"
      });

    if (
      !currentFees ||
      !currentFees.studentId
    ) {

      return res.status(404).json({
        message:
          "Active student renewal record not found"
      });
    }

    const today = new Date();

    const paymentDate =
      formatLocalDate(today);

    // 🔥 BOTH OPTIONS
    let renewalStartDate;

    // 🔥 FINAL FIX

    if (renewType === "continue") {

      // old expiry date
      renewalStartDate = new Date(
        currentFees.endDate
      );

    } else {

      // today date
      renewalStartDate = new Date();
    }

    const renewedFees =
      await Fees.create({

        studentId:
          currentFees.studentId._id,

        libraryId:
          req.user.libraryId,

        amountPaid:
          currentFees.amountPaid,

        planType,

        paymentDate,

        paymentMode:
          currentFees.paymentMode,

        // 🔥 UPDATED
        startDate:
          renewalStartDate,

        hours:
          currentFees.hours
      });

    res.json({
      success: true,

      message:
        "Renewal updated successfully",

      data: {

        _id:
          renewedFees._id,

        studentId:
          renewedFees.studentId,

        renewDate:
          renewedFees.paymentDate,

        nextRenewDate:
          renewedFees.endDate,

        status:
          "completed"
      }
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });
  }
};

export const getRenewalList = async (req, res) => {
  try {

    const { libraryId } = req.user;
    const { month, year } = req.query;

    const today = new Date();

    const selectedMonth = month
      ? Number(month)
      : today.getMonth() + 1;

    const selectedYear = year
      ? Number(year)
      : today.getFullYear();

    const startOfMonth = new Date(
      selectedYear,
      selectedMonth - 1,
      1
    );

    const endOfMonth = new Date(
      selectedYear,
      selectedMonth,
      0,
      23,
      59,
      59,
      999
    );

    const fees = await Fees.find({
      libraryId
    })
      .populate({
        path: "studentId",
        match: {
          status: "active"
        },
        select:
          "enrollmentNumber name phone studyHours status"
      })
      .sort({ createdAt: -1 });

    // 🔥 GROUP BY STUDENT
    const grouped = {};

    fees.forEach(item => {

      if (!item.studentId) return;

      const id =
        item.studentId._id.toString();

      if (!grouped[id])
        grouped[id] = [];

      grouped[id].push(item);
    });

    // 🔥 FINAL LOGIC
    const result =
      Object.values(grouped)
        .flatMap(records => {

          // latest first
          records.sort(
            (a, b) =>
              new Date(b.createdAt) -
              new Date(a.createdAt)
          );

          const latest =
            records[0];

          const previous =
            records[1];

          const student =
            latest.studentId;

          const rows = [];

          // 🔥 OLD EXPIRY
          const expiryDate =
            previous
              ? new Date(
                previous.endDate
              )
              : new Date(
                latest.endDate
              );

          // ✅ CURRENT MONTH COMPLETED
          if (
            previous &&
            expiryDate >= startOfMonth &&
            expiryDate <= endOfMonth
          ) {

            rows.push({

              _id:
                previous._id,

              studentId:
                student._id,

              enrollmentNumber:
                student.enrollmentNumber,

              name:
                student.name,

              phone:
                student.phone,

              studyHours:
                latest.hours,

              lastRenewalDate:
                expiryDate,

              renewDate:
                latest.paymentDate,

              nextRenewDate:
                latest.endDate,

              status:
                "completed",

              canRenew:
                false
            });
          }

          // ✅ NEXT MONTH WARNING/PENDING
          if (
            latest.endDate &&
            new Date(latest.endDate) >= startOfMonth &&
            new Date(latest.endDate) <= endOfMonth
          ) {

            rows.push({

              _id:
                latest._id,

              studentId:
                student._id,

              enrollmentNumber:
                student.enrollmentNumber,

              name:
                student.name,

              phone:
                student.phone,

              studyHours:
                latest.hours,

              lastRenewalDate:
                latest.endDate,

              renewDate:
                latest.paymentDate,

              nextRenewDate:
                latest.endDate,

              status:
                new Date(latest.endDate) < today
                  ? "pending"
                  : "warning",

              canRenew:
                true
            });
          }

          return rows;
        });

    res.json({
      success: true,
      count: result.length,
      data: result
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });
  }
};