import Fees from "./fees.model.js";

/* Add Fees Entry */
export const addFees = async (req, res) => {

  try {

    const {

      studentId,

      registrationFees,

      monthlyFees,

      dueAmount,

      planType,

      paymentMode,

      studyHours,

      startDate,

      endDate

    } = req.body;

    if (
      !studentId ||
      !planType ||
      !studyHours ||
      !startDate
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Student, plan type, study hours and start date are required"

      });

    }

    const durationMap = {

      monthly: 1,

      quarterly: 3,

      halfYearly: 6,

      yearly: 12

    };

    const start =
      new Date(startDate);

    let finalEndDate;

    if (planType === "custom") {

      finalEndDate =
        new Date(endDate);

    } else {

      const months =
        durationMap[planType];

      finalEndDate =
        new Date(start);

      finalEndDate.setMonth(
        finalEndDate.getMonth() + months
      );

    }

    const record =
      await Fees.create({

        studentId,

        registrationFees:
          Number(registrationFees || 0),

        monthlyFees:
          Number(monthlyFees || 0),

        totalAmount:

          Number(registrationFees || 0) +

          Number(monthlyFees || 0),

        dueAmount:
          Number(dueAmount || 0),

        planType,

        paymentDate:

          new Date(

            new Date().toLocaleString(

              "en-US",

              {

                timeZone:
                  "Asia/Kolkata"

              }

            )

          ),

        paymentMode,

        studyHours:
          String(studyHours || ""),

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

    const fees =
      await Fees.find({

        libraryId:
          req.user.libraryId

      });

    // ✅ TOTAL REVENUE
    const totalRevenue =
      fees.reduce(

        (sum, f) =>

          sum +
          Number(f.totalAmount || 0),

        0

      );

    // ✅ TODAY REVENUE
    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const tomorrow =
      new Date(today);

    tomorrow.setDate(
      today.getDate() + 1
    );

    const todayRevenue =
      fees

        .filter((f) => {

          if (!f.paymentDate)
            return false;

          const payment =
            new Date(
              f.paymentDate
            );

          return (

            payment >= today &&

            payment < tomorrow

          );

        })

        .reduce(

          (sum, f) =>

            sum +
            Number(f.totalAmount || 0),

          0

        );

    // ✅ PENDING
    const pendingRevenue =
      fees.reduce(

        (sum, f) =>

          sum +
          Number(f.dueAmount || 0),

        0

      );

    // ✅ ACTIVE PLANS
    const activePlans =
      fees.length;

    // ✅ REGISTRATION REVENUE
    const registrationRevenue =
      fees.reduce(

        (sum, f) =>

          sum +
          Number(
            f.registrationFees || 0
          ),

        0

      );

    // ✅ MONTHLY REVENUE
    const monthlyRevenue =
      fees.reduce(

        (sum, f) =>

          sum +
          Number(
            f.monthlyFees || 0
          ),

        0

      );

    res.json({

      success: true,

      totalRevenue,

      todayRevenue,

      pendingRevenue,

      activePlans,

      registrationRevenue,

      monthlyRevenue

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

export const updateFees =
  async (req, res) => {

    try {

      const {
        libraryId
      } = req.user;

      const {
        id
      } = req.params;

      const {

        registrationFees,

        monthlyFees,

        dueAmount,

        studyHours,

        paymentMode,

        planType,

        startDate,

        endDate

      } = req.body;

      const fees =
        await Fees.findOne({

          _id: id,

          libraryId

        });

      if (!fees) {

        return res.status(404).json({

          success: false,

          message:
            "Fees record not found"

        });

      }

      fees.registrationFees =
        Number(
          registrationFees || 0
        );

      fees.monthlyFees =
        Number(
          monthlyFees || 0
        );

      fees.totalAmount =

        Number(
          registrationFees || 0
        ) +

        Number(
          monthlyFees || 0
        );

      fees.dueAmount =
        Number(dueAmount || 0);

      fees.studyHours =
        String(studyHours || "");

      fees.paymentMode =
        paymentMode;

      fees.planType =
        planType;

      fees.startDate =
        startDate;

      if (
        planType === "custom"
      ) {

        fees.endDate =
          endDate;

      }

      await fees.save();

      res.json({

        success: true,

        message:
          "Revenue updated successfully",

        fees

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

    const {
      duration,
      renewType
    } = req.body;

    // ✅ PLAN TYPE MAP
    const planTypeByDuration = {

      1: "monthly",

      3: "quarterly",

      6: "halfYearly",

      12: "yearly"

    };

    const planType =
      planTypeByDuration[
      Number(duration)
      ];

    if (!planType) {

      return res.status(400).json({

        success: false,

        message:
          "Please select a valid renewal duration"

      });

    }

    // ✅ FIND CURRENT FEES
    const currentFees =
      await Fees.findOne({

        _id: id,

        libraryId:
          req.user.libraryId

      })

        .populate({

          path: "studentId",

          match: {
            status: "active"
          },

          select:
            "_id status"

        });

    if (
      !currentFees ||
      !currentFees.studentId
    ) {

      return res.status(404).json({

        success: false,

        message:
          "Active student renewal record not found"

      });

    }

    // ✅ PAYMENT DATE
    const paymentDate =
      new Date(
        new Date().toLocaleString(
          "en-US",
          {
            timeZone:
              "Asia/Kolkata"
          }
        )
      );

    // ✅ RENEW START DATE
    let renewalStartDate;

    if (
      renewType === "continue"
    ) {

      // ✅ SAME DATE CONTINUE
      renewalStartDate =
        new Date(
          currentFees.endDate
        );

    } else {

      // ✅ FRESH START
      renewalStartDate =
        new Date();

    }

    // ✅ CALCULATE RENEWAL AMOUNT
    const renewalAmount =

      Number(
        currentFees.monthlyFees || 0
      ) *

      Number(duration);

    // ✅ CREATE RENEWAL
    const renewedFees =
      await Fees.create({

        studentId:
          currentFees.studentId._id,

        libraryId:
          req.user.libraryId,

        registrationFees: 0,

        monthlyFees:
          renewalAmount,

        totalAmount:
          renewalAmount,

        dueAmount:
          currentFees.dueAmount || 0,

        planType,

        paymentDate,

        paymentMode:
          currentFees.paymentMode,

        startDate:
          renewalStartDate,

        studyHours:
          currentFees.studyHours

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

    console.error(error);

    res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};

export const getRenewalList = async (req, res) => {

  try {

    const { libraryId } =
      req.user;

    // ✅ TODAY
    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    // ✅ GET ALL FEES
    const fees =
      await Fees.find({

        libraryId

      })

        .populate({

          path: "studentId",

          match: {
            status: "active"
          },

          select:
            "enrollmentNumber name phone"

        })

        .sort({

          endDate: -1

        });

    // ✅ REMOVE INVALID RECORDS
    const validFees =
      fees.filter(

        (f) =>

          f.studentId &&

          f.endDate

      );

    // ✅ LATEST RECORD ONLY
    const latestFeesMap = {};

    validFees.forEach((f) => {

      const studentId =
        f.studentId._id.toString();

      if (

        !latestFeesMap[studentId] ||

        new Date(f.endDate) >

        new Date(
          latestFeesMap[studentId].endDate
        )

      ) {

        latestFeesMap[studentId] = f;

      }

    });

    // ✅ FINAL RESULT
    const result =
      Object.values(latestFeesMap)

        .map((f) => {

          const endDate =
            new Date(f.endDate);

          endDate.setHours(
            0,
            0,
            0,
            0
          );

          // ✅ DAYS LEFT
          const diffTime =
            endDate - today;

          const diffDays =
            Math.ceil(

              diffTime /

              (1000 * 60 * 60 * 24)

            );

          // ✅ STATUS
          let status =
            "completed";

          // ❌ EXPIRED
          if (diffDays < 0) {

            status =
              "pending";

          }

          // ⚠ 3 DAYS LEFT
          else if (
            diffDays <= 3
          ) {

            status =
              "warning";

          }

          // ✅ RENEWED
          if (

            f.paymentDate &&

            diffDays > 3

          ) {

            status =
              "completed";

          }

          return {

            _id:
              f._id,

            studentId:
              f.studentId._id,

            enrollmentNumber:
              f.studentId.enrollmentNumber,

            name:
              f.studentId.name,

            phone:
              f.studentId.phone,

            studyHours:
              f.studyHours || "-",

            monthlyFees:
              f.monthlyFees || 0,

            totalAmount:
              f.totalAmount || 0,

            lastRenewalDate:
              f.startDate,

            renewDate:
              f.paymentDate,

            nextRenewDate:
              f.endDate,

            status,

            // ✅ RENEW BUTTON ONLY
            canRenew:

              status === "warning" ||

              status === "pending"

          };

        });

    res.json({

      success: true,

      count:
        result.length,

      data:
        result

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