import Attendance from "../attendance/attendance.model.js";
import Student from "../student/student.model.js";

export const studentCheckIn = async (req, res) => {
  try {
    const { userId: studentId, libraryId } = req.user;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await Attendance.findOne({
      studentId,
      date: today
    });

    if (existing) {
      return res.status(400).json({
        message: "Attendance already marked today"
      });
    }

    const attendance = await Attendance.create({
      studentId,
      libraryId,
      date: today,
      checkInTime: new Date(),
      markedBy: "student"
    });

    res.json({
      message: "Check-in successful",
      attendance
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Attendance already marked"
      });
    }

    res.status(500).json({ message: error.message });
  }
};

export const studentCheckOut = async (req, res) => {
  try {
    const { userId: studentId } = req.user;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      studentId,
      date: today
    });

    if (!attendance) {
      return res.status(400).json({
        message: "You have not checked in today"
      });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({
        message: "Already checked out"
      });
    }

    attendance.checkOutTime = new Date();
    await attendance.save();

    res.json({
      message: "Check-out successful",
      attendance
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const adminMarkAttendance = async (req, res) => {
  try {

    const { studentId } = req.body;
    const { libraryId } = req.user;

    // CHECK EXISTING ATTENDANCE (student still in library)
    let attendance = await Attendance.findOne({
      studentId,
      libraryId,
      date: {
        $gte: new Date().setHours(0, 0, 0, 0),
        $lte: new Date().setHours(23, 59, 59, 999)
      }
    });

    // ================= CHECK IN =================
    if (!attendance) {

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      attendance = await Attendance.create({
        studentId,
        libraryId,
        date: today,
        checkInTime: new Date(),
        markedBy: "admin"
      });

      return res.json({
        message: "Check-In successful"
      });
    }

    // ================= CHECK OUT =================
    attendance.checkOutTime = new Date();

    const hours =
      (attendance.checkOutTime - attendance.checkInTime) /
      (1000 * 60 * 60);

    attendance.totalHours = Number(hours.toFixed(2));

    await attendance.save();

    return res.json({
      message: "Check-Out successful"
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAttendanceHistory = async (req, res) => {
  try {
    const { userId, role, libraryId } = req.user;

    let filter = { libraryId };

    // If student → only their records
    if (role === "student") {
      filter.studentId = userId;
    }

    const attendance = await Attendance.find(filter)
      .sort({ date: -1 })
      .populate("studentId", "name enrollmentNumber");

    res.json(attendance);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMonthlyAttendancePercentage = async (req, res) => {
  try {
    const { userId: studentId } = req.user;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalDaysSoFar = now.getDate();

    const presentDays = await Attendance.countDocuments({
      studentId,
      date: { $gte: startOfMonth }
    });

    const percentage = ((presentDays / totalDaysSoFar) * 100).toFixed(2);

    res.json({
      month: now.toLocaleString("default", { month: "long" }),
      totalDaysSoFar,
      presentDays,
      percentage: Number(percentage)
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTodayAttendanceSummary = async (req, res) => {
  try {
    const { libraryId } = req.user;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const totalStudents = await Student.countDocuments({
      libraryId,
      status: "active"
    });

    const presentToday = await Attendance.countDocuments({
      libraryId,
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    const absentToday = totalStudents - presentToday;

    const attendanceRate =
      totalStudents > 0
        ? ((presentToday / totalStudents) * 100).toFixed(2)
        : 0;

    res.json({
      totalStudents,
      presentToday,
      absentToday,
      attendanceRate
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};