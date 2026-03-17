import Payment from "./payment.model.js";
import Student from "../student/student.model.js";
import { v4 as uuidv4 } from "uuid";

export const addPayment = async (req, res) => {
  try {
    const { studentId, amount, planType, paymentMode } = req.body;
    const { libraryId } = req.user;

    const student = await Student.findOne({
      _id: studentId,
      libraryId
    });

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    const startDate = new Date();
    let endDate = new Date();

    // Plan duration logic
    switch (planType) {
      case "monthly":
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case "threeMonths":
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case "sixMonths":
        endDate.setMonth(endDate.getMonth() + 6);
        break;
      case "yearly":
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      default:
        return res.status(400).json({
          message: "Invalid plan type"
        });
    }

    const receiptNumber = `RCPT-${uuidv4().slice(0, 8)}`;

    const payment = await Payment.create({
      studentId,
      libraryId,
      amount,
      planType,
      startDate,
      endDate,
      paymentMode,
      receiptNumber
    });

    res.json({
      message: "Payment added successfully",
      payment
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getStudentPayments = async (req, res) => {
  try {
    const { userId: studentId } = req.user;

    const payments = await Payment.find({ studentId })
      .sort({ createdAt: -1 });

    res.json(payments);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllPayments = async (req, res) => {
  try {
    const { libraryId } = req.user;

    const payments = await Payment.find({ libraryId })
      .populate("studentId", "name enrollmentNumber")
      .sort({ createdAt: -1 });

    res.json(payments);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};