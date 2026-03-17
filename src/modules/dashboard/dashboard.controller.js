import Student from "../student/student.model.js";
import Seat from "../seat/seat.model.js";
import SeatBooking from "../commonmodel/seatBooking.model.js";
import Attendance from "../attendance/attendance.model.js";
import Payment from "../payment/payment.model.js";

export const getDashboardStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const totalStudents = await Student.countDocuments();

    const todayAttendance = await Attendance.countDocuments({
      date: today
    });

    const todayFeesRecords = await Fees.find({
      paymentDate: today
    });

    const todayCollection = todayFeesRecords.reduce(
      (sum, item) => sum + item.amountPaid,
      0
    );

    const totalFeesEntries = await Fees.countDocuments();

    res.json({
      totalStudents,
      todayAttendance,
      todayCollection,
      totalFeesEntries
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminDashboard = async (req, res) => {
  try {
    const { libraryId } = req.user;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1️⃣ Total Students
    const totalStudents = await Student.countDocuments({
      libraryId,
      status: "active"
    });

    // 2️⃣ Total Seats
    const totalSeats = await Seat.countDocuments({
      libraryId
    });

    // 3️⃣ Occupied Seats (active booking)
    const occupiedSeats = await SeatBooking.distinct("seatId", {
      libraryId,
      status: "active"
    });

    const occupiedCount = occupiedSeats.length;

    // 4️⃣ Available Seats
    const availableSeats = totalSeats - occupiedCount;

    // 5️⃣ Today's Attendance
    const todayAttendance = await Attendance.countDocuments({
      libraryId,
      date: today
    });

    // 6️⃣ Today's Revenue
    const todayRevenueAgg = await Payment.aggregate([
      {
        $match: {
          libraryId,
          createdAt: {
            $gte: today
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const todayRevenue =
      todayRevenueAgg.length > 0 ? todayRevenueAgg[0].total : 0;

    // 7️⃣ Pending Bills (students without active plan)
    const activeStudentsWithPlan = await Payment.distinct("studentId", {
      libraryId,
      endDate: { $gte: new Date() }
    });

    const pendingBills = totalStudents - activeStudentsWithPlan.length;

    res.json({
      totalStudents,
      totalSeats,
      occupiedSeats: occupiedCount,
      availableSeats,
      todayAttendance,
      todayRevenue,
      pendingBills
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
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