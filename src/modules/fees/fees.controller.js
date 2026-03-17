import Fees from "./fees.model.js";

/* Add Fees Entry */
export const addFees = async (req, res) => {
  try {
    const { studentId, amountPaid, month, note } = req.body;

    const record = await Fees.create({
      studentId,
      amountPaid,
      month,
      note
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

    const history = await Fees.find({ studentId }).sort({ paymentDate: -1 });

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const createFees = async (req, res) => {
  try {
    const fees = await Fees.create(req.body);
    res.json(fees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getFees = async (req, res) => {
  try {
    const fees = await Fees.find();
    res.json(fees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};