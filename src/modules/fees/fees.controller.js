import Fees from "./fees.model.js";

/* Add Fees Entry */
export const addFees = async (req, res) => {

  try {

    const {
      studentId,
      amountPaid,
      dueAmount,
      planType,
      paymentMode,
      studyHours,
      startDate,
      endDate
    } = req.body;

    if (!studentId || !planType || !studyHours) {

      return res.status(400).json({
        success: false,
        message:
          "Student, plan type and study hours are required"
      });

    }

    // ✅ PLAN MONTHS
    const durationMap = {
      monthly: 1,
      quarterly: 3,
      halfYearly: 6,
      yearly: 12
    };

    // ✅ START DATE
    const start =
      new Date(startDate);

    let finalEndDate;

    // ✅ CUSTOM PLAN
    if (planType === "custom") {

      finalEndDate =
        new Date(endDate);

    } else {

      const months =
        durationMap[planType];

      // ✅ CLONE DATE
      finalEndDate =
        new Date(start);

      // ✅ ADD MONTHS
      finalEndDate.setMonth(
        finalEndDate.getMonth() + months
      );

    }

    const record =
      await Fees.create({

        studentId,

        amountPaid:
          Number(amountPaid || 0),

        dueAmount:
          Number(dueAmount || 0),

        planType,

        paymentDate:
          new Date(),

        paymentMode,

        studyHours:
          String(studyHours || 0),

        libraryId:
          req.user.libraryId,

        startDate:
          start,

        endDate:
          finalEndDate

      });

    res.status(201).json({

      success: true,

      record

    });

  } catch (error) {

    console.error(error);

    res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};
/* Student Fees History */
export const getStudentFees = async (req, res) => {

  try {

    const { studentId } = req.params;

    const history =
      await Fees.find({ studentId })

        .populate(
          "studentId",
          "name phone"
        )

        .sort({
          paymentDate: -1
        });

    // ✅ FORMAT DATES
    const formattedHistory =
      history.map((item) => ({

        ...item._doc,

        startDate:
          item.startDate
            ? String(item.startDate)
              .split("T")[0]
            : "",

        endDate:
          item.endDate
            ? String(item.endDate)
              .split("T")[0]
            : "",

        paymentDate:
          item.paymentDate
            ? String(item.paymentDate)
              .split("T")[0]
            : ""

      }));

    res.json(
      formattedHistory
    );

  } catch (error) {

    res.status(500).json({
      message:
        error.message
    });

  }

};

export const getFees = async (req, res) => {
  try {

    const { libraryId } = req.user;

    const { month, year } = req.query;

    let filter = {
      libraryId
    };

    // ✅ MONTH FILTER
    if (month && year) {

      const monthString =
        String(month).padStart(2, "0");

      // ✅ Proper date range filter
      const startOfMonth =
        new Date(`${year}-${monthString}-01`);

      const endOfMonth =
        new Date(
          Number(year),
          Number(monthString),
          0,
          23,
          59,
          59,
          999
        );

      filter.createdAt = {
        $gte: startOfMonth,
        $lte: endOfMonth
      };
    }

    const fees = await Fees.find(filter)

      .populate("studentId")

      .sort({
        createdAt: -1
      });

    // ✅ FORMAT DATES
    const formattedFees = fees.map((fee) => ({

      ...fee._doc,

      startDate:
        fee.startDate
          ? new Date(fee.startDate)
            .toISOString()
            .split("T")[0]
          : "",

      endDate:
        fee.endDate
          ? new Date(fee.endDate)
            .toISOString()
            .split("T")[0]
          : "",

      paymentDate:
        fee.paymentDate
          ? new Date(fee.paymentDate)
            .toISOString()
            .split("T")[0]
          : ""

    }));

    res.json({

      success: true,

      count: formattedFees.length,

      fees: formattedFees

    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message
    });

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
  3: "quarterly",
  6: "halfYearly",
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