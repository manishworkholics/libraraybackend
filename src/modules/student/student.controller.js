import Student from "./student.model.js";
import Counter from "../commonmodel/Counter.js";
import bcrypt from "bcryptjs";

/* Create Student */
export const createStudent = async (req, res) => {
  try {

    const {
      name,
      fathername,
      fatherName,
      dob,
      gender,
      email,
      phone,
      address,
      timeSlot,
      course,
      studyHours,
      documentNumber,
      referralCode,
      password
    } = req.body;

    const { libraryId } = req.user;

    /* 🔎 Required Fields */
    if (
      !name ||
      !phone ||
      !address ||
      !timeSlot ||
      !course ||
      !studyHours ||
      !documentNumber
    ) {
      return res.status(400).json({
        message: "Please fill all required fields"
      });
    }

    /* 🔢 Validate study hours */
    if (isNaN(studyHours)) {
      return res.status(400).json({
        message: "Study hours must be a number"
      });
    }

    /* 📧 Email Duplicate Check (Library Wise) */
    if (email) {
      const existingEmail = await Student.findOne({
        email: email.toLowerCase(),
        libraryId
      });

      if (existingEmail) {
        return res.status(400).json({
          message: "Student with this email already exists"
        });
      }
    }

    /* 📱 Phone Duplicate Check */
    const existingPhone = await Student.findOne({
      phone,
      libraryId
    });

    if (existingPhone) {
      return res.status(400).json({
        message: "Student with this phone already exists"
      });
    }

    /* 🔥 Atomic Enrollment Number */
    const counter = await Counter.findOneAndUpdate(
      { libraryId },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const enrollmentNumber = `ADH-${counter.seq}`;

    /* 🔐 Default Password */
    const studentPassword = password || phone.slice(-6);

    const hashedPassword = await bcrypt.hash(studentPassword, 10);

    /* 📸 File Handling */
    const documentPhoto =
      req.files?.documentPhoto?.[0]?.path || req.body.documentPhoto;

    const passportPhoto =
      req.files?.passportPhoto?.[0]?.path || req.body.passportPhoto;

    if (!documentPhoto || !passportPhoto) {
      return res.status(400).json({
        message: "Document photo and passport photo are required"
      });
    }

    /* 🧑‍🎓 Create Student */
    const student = await Student.create({
      name,
      fathername: fathername || fatherName,
      dob,
      gender,
      email: email?.toLowerCase(),
      phone,
      address,
      timeSlot,
      course,
      studyHours: Number(studyHours),
      documentNumber,
      referralCode,
      documentPhoto,
      passportPhoto,
      enrollmentNumber,
      password: hashedPassword,
      libraryId
    });

    /* 🔒 Hide Password */
    const studentResponse = student.toObject();
    delete studentResponse.password;

    res.status(201).json({
      message: "Student created successfully",
      student: studentResponse,
      defaultPassword: studentPassword
    });

  } catch (error) {

    /* 🔥 Duplicate Key Error */
    if (error.code === 11000) {

      const field = Object.keys(error.keyValue)[0];

      return res.status(400).json({
        message: `${field} already exists`,
        field
      });
    }

    res.status(500).json({
      message: error.message
    });
  }
};

/* Get All Students (Library Only) */
export const getAllStudents = async (req, res) => {
  try {
    const { libraryId } = req.user;

    const students = await Student.find({ libraryId })
      .sort({ createdAt: -1 });

    res.json(students);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* Get Single Student */
export const getStudentById = async (req, res) => {
  try {
    const { libraryId } = req.user;

    const student = await Student.findOne({
      _id: req.params.id,
      libraryId
    });

    if (!student)
      return res.status(404).json({ message: "Student not found" });

    res.json(student);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* Update Student */
export const updateStudent = async (req, res) => {
  try {
    const { libraryId } = req.user;

    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, libraryId },
      req.body,
      { new: true }
    );

    if (!student)
      return res.status(404).json({ message: "Student not found" });

    res.json({
      message: "Student updated successfully",
      student
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* Delete Student */
export const deleteStudent = async (req, res) => {
  try {
    const { libraryId } = req.user;

    const student = await Student.findOneAndDelete({
      _id: req.params.id,
      libraryId
    });

    if (!student)
      return res.status(404).json({ message: "Student not found" });

    res.json({ message: "Student deleted successfully" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getStudentProfile = async (req, res) => {
  try {

    const student = await Student.findById(req.user.userId)
      .select("-password");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.json({
      success: true,
      data: student,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateStudentStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const student = await Student.findOneAndUpdate(
      {
        _id: req.params.id,
        libraryId: req.user.libraryId
      },
      {
        status,
        lastStatusUpdatedAt: new Date()
      },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({
      message: "Status updated successfully",
      student
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
