import Student from "../student/student.model.js"; // adjust path
import renewalModels from "./renewal.models.js";
// ✅ GET Renewal List
const getRenewalList = async (req, res) => {
  try {
    const today = new Date();

    const startOfMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );

    const endOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    );

    const students = await Student.find({
      isActive: true,
      subscriptionEnd: {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
    });

    const renewalList = students.map((student) => {
      const lastRenewal = student.lastRenewalDate || null;
      const renewDate = student.subscriptionStart || null;
      const nextRenew = student.subscriptionEnd || null;

      let status = "completed";
      let canRenew = false;

      if (nextRenew && new Date(nextRenew) < today) {
        status = "pending";
        canRenew = true;
      } else if (
        nextRenew &&
        new Date(nextRenew) - today <= 3 * 24 * 60 * 60 * 1000
      ) {
        status = "warning";
        canRenew = true;
      }

      return {
        _id: student._id,
        enrollmentNumber: student.enrollmentNumber,
        name: student.name,
        phone: student.phone,
        studyHours: student.studyHours,

        lastRenewalDate: lastRenewal,
        renewDate: renewDate,
        nextRenewDate: nextRenew,

        planDuration: student.planDuration || 1,
        status,
        canRenew,
      };
    });

    res.json({
      success: true,
      data: renewalList,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ✅ Renew Student
const renewStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { duration } = req.body;

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const today = new Date();

    const lastRenewalDate = student.subscriptionEnd || null;
    const renewDate = today;

    let baseDate = student.subscriptionEnd;

    if (!baseDate || new Date(baseDate) < today) {
      baseDate = today;
    }

    const nextDate = new Date(baseDate);
    nextDate.setMonth(nextDate.getMonth() + Number(duration));

    student.lastRenewalDate = lastRenewalDate;
    student.subscriptionStart = renewDate;
    student.subscriptionEnd = nextDate;
    student.planDuration = duration;
    student.isActive = true;

    await student.save();

    res.json({
      success: true,
      data: {
        lastRenewalDate,
        renewDate,
        nextRenewDate: nextDate,
      },
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// 🔥 IMPORTANT EXPORT (ESM)
export { getRenewalList, renewStudent };