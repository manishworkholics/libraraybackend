import Student from "../student/student.model.js";
import Seat from "../seat/seat.model.js";
import SeatBooking from "../commonmodel/seatBooking.model.js";
import Attendance from "../attendance/attendance.model.js";
import Fees from "../fees/fees.model.js";
import Complaint from "../complaint/complaint.model.js";

export const getDashboardStats = async (req, res) => {
  try {

    const { libraryId } = req.user;

    // 🔥 Local date range
    const now = new Date();

    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );

    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );

    // 🔥 YYYY-MM-DD for paymentDate
    const today = now.toISOString().split("T")[0];

    // 🔥 Total Active Students
    const totalStudents = await Student.countDocuments({
      libraryId,
      status: "active"
    });

    // 🔥 Today's Attendance
    const todayAttendance = await Attendance.countDocuments({
      libraryId,

      checkInTime: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    // 🔥 Today's Revenue
    const todayFeesRecords = await Fees.find({
      libraryId,
      paymentDate: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    const todayCollection = todayFeesRecords.reduce(
      (sum, item) => sum + Number(item.amountPaid || 0),
      0
    );

    // 🔥 Total Fees Entries
    const totalFeesEntries = await Fees.countDocuments({
      libraryId
    });

    res.json({
      totalStudents,
      todayAttendance,
      todayCollection,
      totalFeesEntries
    });

  } catch (error) {

    console.error("DASHBOARD STATS ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getAdminDashboard = async (req, res) => {

  try {

    const { libraryId } =
      req.user;

    // ✅ TODAY RANGE
    const now =
      new Date();

    const startOfDay =
      new Date(

        now.getFullYear(),

        now.getMonth(),

        now.getDate(),

        0,
        0,
        0,
        0

      );

    const endOfDay =
      new Date(

        now.getFullYear(),

        now.getMonth(),

        now.getDate(),

        23,
        59,
        59,
        999

      );

    // 1️⃣ TOTAL ACTIVE STUDENTS
    const totalStudents =
      await Student.countDocuments({

        libraryId,

        status:
          "active"

      });

    // 2️⃣ TOTAL SEATS
    const totalSeats =
      await Seat.countDocuments({

        libraryId

      });

    // 3️⃣ OCCUPIED SEATS
    const occupiedSeats =
      await SeatBooking.distinct(

        "seatId",

        {

          libraryId,

          status:
            "active"

        }

      );

    const occupiedCount =
      occupiedSeats.length;

    // 4️⃣ AVAILABLE SEATS
    const availableSeats =

      totalSeats -

      occupiedCount;

    // 5️⃣ TODAY ATTENDANCE
    const todayAttendance =
      await Attendance.countDocuments({

        libraryId,

        checkInTime: {

          $gte:
            startOfDay,

          $lte:
            endOfDay

        }

      });

    // 6️⃣ TODAY REVENUE
    const todayFeesRecords =
      await Fees.find({

        libraryId,

        paymentDate: {

          $gte:
            startOfDay,

          $lte:
            endOfDay

        }

      });

    const todayRevenue =
      todayFeesRecords.reduce(

        (sum, item) =>

          sum +

          Number(
            item.totalAmount || 0
          ),

        0

      );

    // 7️⃣ PENDING RENEWALS
    const currentMonth =
      new Date().getMonth();

    const currentYear =
      new Date().getFullYear();

    const activeStudents =
      await Student.find({

        libraryId,

        status:
          "active"

      });

    let pendingBills = 0;

    for (const student of activeStudents) {

      // ✅ LATEST FEES
      const latestFees =
        await Fees.findOne({

          libraryId,

          studentId:
            student._id

        }).sort({

          createdAt:
            -1

        });

      // ❌ NO FEES
      if (!latestFees)
        continue;

      // ❌ NO END DATE
      if (!latestFees.endDate)
        continue;

      const expiryDate =
        new Date(
          latestFees.endDate
        );

      const expiryMonth =
        expiryDate.getMonth();

      const expiryYear =
        expiryDate.getFullYear();

      // ✅ CURRENT MONTH EXPIRED
      if (

        expiryMonth === currentMonth &&

        expiryYear === currentYear &&

        expiryDate < new Date()

      ) {

        pendingBills++;

      }

    }

    // 8️⃣ PENDING COMPLAINTS
    let pendingComplaints = 0;

    try {

      if (Complaint) {

        pendingComplaints =
          await Complaint.countDocuments({

            libraryId,

            status:
              "pending"

          });

      }

    } catch (err) {

      console.log(

        "Complaint fetch error:",

        err.message

      );

    }

    res.json({

      totalStudents,

      totalSeats,

      occupiedSeats:
        occupiedCount,

      availableSeats,

      todayAttendance,

      todayRevenue,

      pendingBills,

      pendingComplaints

    });

  } catch (error) {

    console.error(

      "ADMIN DASHBOARD ERROR:",

      error

    );

    res.status(500).json({

      message:
        error.message

    });

  }

};

export const getLast7DaysRevenue = async (req, res) => {
  const { libraryId } = req.user;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const revenue = await Payment.aggregate([
    {
      $match: {
        libraryId,
        createdAt: { $gte: sevenDaysAgo }
      }
    },
    {
      $group: {
        _id: {
          $dayOfMonth: "$createdAt"
        },
        total: { $sum: "$amount" }
      }
    },
    { $sort: { "_id": 1 } }
  ]);

  res.json(revenue);
};

export const getGraphData = async (req, res) => {

  try {

    const { libraryId } =
      req.user;

    const {
      type,
      range
    } = req.query;

    const now =
      new Date();

    let labels = [];

    // 🔥 7 DAYS
    if (range === "7days") {

      for (let i = 6; i >= 0; i--) {

        const d =
          new Date();

        d.setDate(
          now.getDate() - i
        );

        labels.push({

          label:
            d.toLocaleDateString(
              "en-US",
              {
                weekday:
                  "short"
              }
            ),

          start:
            new Date(
              d.setHours(
                0,
                0,
                0,
                0
              )
            ),

          end:
            new Date(
              d.setHours(
                23,
                59,
                59,
                999
              )
            )

        });

      }

    }

    // 🔥 30 DAYS
    else if (range === "30days") {

      for (let i = 29; i >= 0; i--) {

        const d =
          new Date();

        d.setDate(
          now.getDate() - i
        );

        labels.push({

          label:
            d.getDate().toString(),

          start:
            new Date(
              d.setHours(
                0,
                0,
                0,
                0
              )
            ),

          end:
            new Date(
              d.setHours(
                23,
                59,
                59,
                999
              )
            )

        });

      }

    }

    // 🔥 MONTHLY
    else if (range === "monthly") {

      const daysInMonth =
        new Date(

          now.getFullYear(),

          now.getMonth() + 1,

          0

        ).getDate();

      for (
        let i = 1;
        i <= daysInMonth;
        i++
      ) {

        const d =
          new Date(

            now.getFullYear(),

            now.getMonth(),

            i

          );

        labels.push({

          label:
            i.toString(),

          start:
            new Date(
              d.setHours(
                0,
                0,
                0,
                0
              )
            ),

          end:
            new Date(
              d.setHours(
                23,
                59,
                59,
                999
              )
            )

        });

      }

    }

    // 🔥 YEARLY
    else if (range === "yearly") {

      for (let i = 0; i < 12; i++) {

        const start =
          new Date(

            now.getFullYear(),

            i,

            1

          );

        const end =
          new Date(

            now.getFullYear(),

            i + 1,

            0,

            23,
            59,
            59,
            999

          );

        labels.push({

          label:
            start.toLocaleString(
              "default",
              {
                month:
                  "short"
              }
            ),

          start,

          end

        });

      }

    }

    // 🔥 DEFAULT 7 DAYS
    else {

      for (let i = 6; i >= 0; i--) {

        const d =
          new Date();

        d.setDate(
          now.getDate() - i
        );

        labels.push({

          label:
            d.toLocaleDateString(
              "en-US",
              {
                weekday:
                  "short"
              }
            ),

          start:
            new Date(
              d.setHours(
                0,
                0,
                0,
                0
              )
            ),

          end:
            new Date(
              d.setHours(
                23,
                59,
                59,
                999
              )
            )

        });

      }

    }

    let data = [];

    // 🔥 STUDENTS GRAPH
    if (type === "students") {

      for (const item of labels) {

        const total =
          await Student.countDocuments({

            libraryId,

            createdAt: {

              $gte:
                item.start,

              $lte:
                item.end

            }

          });

        data.push({

          label:
            item.label,

          value:
            total

        });

      }

    }

    // 🔥 REVENUE GRAPH
    else if (type === "revenue") {

      for (const item of labels) {

        const fees =
          await Fees.find({

            libraryId,

            paymentDate: {

              $gte:
                item.start,

              $lte:
                item.end

            }

          });

        const total =
          fees.reduce(

            (sum, fee) =>

              sum +

              Number(
                fee.totalAmount || 0
              ),

            0

          );

        data.push({

          label:
            item.label,

          value:
            total

        });

      }

    }

    // 🔥 ATTENDANCE GRAPH
    else if (type === "attendance") {

      for (const item of labels) {

        const total =
          await Attendance.countDocuments({

            libraryId,

            date: {

              $gte:
                item.start,

              $lte:
                item.end

            }

          });

        data.push({

          label:
            item.label,

          value:
            total

        });

      }

    }

    // 🔥 SEATS GRAPH
    else if (type === "seats") {

      const totalSeats =
        await Seat.countDocuments({

          libraryId

        });

      data =
        labels.map(item => ({

          label:
            item.label,

          value:
            totalSeats

        }));

    }

    res.json(data);

  } catch (error) {

    console.error(
      "GRAPH ERROR:",
      error
    );

    res.status(500).json({

      message:
        error.message

    });

  }

};

export const getRecentActivities = async (req, res) => {
  try {

    const { libraryId } = req.user;

    const attendance = await Attendance.find({
      libraryId
    })
      .populate("studentId", "name")
      .sort({ createdAt: -1 })
      .limit(5);

    const renewals = await Fees.find({
      libraryId
    })
      .populate("studentId", "name")
      .sort({ createdAt: -1 })
      .limit(5);

    const activities = [];

    // 🔥 Attendance Activities
    attendance.forEach(item => {

      activities.push({
        type: "attendance",

        name: item.studentId?.name,

        message: "Marked Present",

        createdAt: item.createdAt
      });
    });

    // 🔥 Renewal Activities
    renewals.forEach(item => {

      activities.push({
        type: "renewal",

        name: item.studentId?.name,

        message: "Renewed Membership",

        createdAt: item.createdAt
      });
    });

    // 🔥 Latest first
    activities.sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );

    res.json(
      activities.slice(0, 8)
    );

  } catch (error) {

    res.status(500).json({
      message: error.message
    });
  }
};