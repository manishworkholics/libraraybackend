import Student from "./student.model.js";
import Counter from "../commonmodel/Counter.js";
import Seat from "../seat/seat.model.js";
import SeatBooking from "../commonmodel/seatBooking.model.js";
import Library from "../commonmodel/Library.model.js";
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
      course,
      studyHours,
      documentNumber,
      referralCode,
      password
    } = req.body;

    const { libraryId } = req.user;

    // ✅ REQUIRED FIELDS
    if (
      !name ||
      !phone ||
      !address ||
      !course ||
      !studyHours ||
      !documentNumber
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Please fill all required fields"
      });

    }

    // ✅ VALID STUDY HOURS
    const validStudyHours = [
      "3 Hours",
      "4 Hours",
      "5 Hours",
      "6 Hours",
      "7 Hours",
      "8 Hours",
      "9 Hours",
      "10 Hours",
      "11 Hours",
      "12 Hours",
      "Full Day"
    ];

    if (
      !validStudyHours.includes(
        String(studyHours)
      )
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Invalid study hours selected"
      });

    }
    if (email) {
      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address"
        });
      }
    }

    // Phone Validation
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be 10 digits"
      });
    }
    // ✅ EMAIL CHECK
    if (email) {

      const existingEmail =
        await Student.findOne({

          email:
            email.toLowerCase(),

          libraryId

        });

      if (existingEmail) {

        return res.status(400).json({
          success: false,
          message:
            "Student with this email already exists"
        });

      }

    }

    // ✅ PHONE CHECK
    const existingPhone =
      await Student.findOne({

        phone,
        libraryId

      });

    if (existingPhone) {

      return res.status(400).json({
        success: false,
        message:
          "Student with this phone already exists"
      });

    }

    // ✅ LIBRARY
    const library =
      await Library.findById(
        libraryId
      );

    if (!library) {

      return res.status(404).json({
        success: false,
        message:
          "Library not found"
      });

    }

    // ✅ PREFIX
    const prefix =
      library.name
        .replace(/\s+/g, "")
        .substring(0, 3)
        .toUpperCase();

    // ✅ FIND LAST STUDENT
    // ✅ FIND HIGHEST ENROLLMENT NUMBER
    const students = await Student.find({
      libraryId,
      enrollmentNumber: {
        $regex: `^${prefix}-`
      }
    }).select("enrollmentNumber");

    let maxNumber = 0;

    students.forEach((student) => {

      if (!student.enrollmentNumber)
        return;

      const parts =
        student.enrollmentNumber.split("-");

      const currentNumber =
        parseInt(parts[1]);

      if (
        !isNaN(currentNumber) &&
        currentNumber > maxNumber
      ) {
        maxNumber =
          currentNumber;
      }

    });

    const nextNumber =
      maxNumber + 1;

    // ✅ ENROLLMENT NUMBER
    const enrollmentNumber =
      `${prefix}-${nextNumber}`;
    // ✅ PASSWORD
    const studentPassword =
      password ||
      phone.slice(-6);

    const hashedPassword =
      await bcrypt.hash(
        studentPassword,
        10
      );

    // ✅ FILES
    const documentPhoto =
      req.files?.documentPhoto?.[0]?.path ||
      req.body.documentPhoto ||
      "";

    const passportPhoto =
      req.files?.passportPhoto?.[0]?.path ||
      req.body.passportPhoto ||
      "";

    // ✅ CREATE STUDENT
    const student =
      await Student.create({

        name: name.trim(),

        fathername:
          fathername ||
          fatherName ||
          "",

        dob,

        gender,

        email:
          email?.trim()
            ? email.toLowerCase()
            : undefined,

        phone,

        address,

        course,

        studyHours:
          String(studyHours),

        documentNumber,

        referralCode,

        documentPhoto,

        passportPhoto,

        enrollmentNumber,

        password:
          hashedPassword,

        libraryId

      });

    // ✅ REMOVE PASSWORD
    const studentResponse =
      student.toObject();

    delete studentResponse.password;

    res.status(201).json({

      success: true,

      message:
        "Student created successfully",

      student:
        studentResponse,

      defaultPassword:
        studentPassword

    });

  } catch (error) {

    console.error(
      "CREATE STUDENT ERROR:",
      error
    );

    // ✅ DUPLICATE KEY
    if (error.code === 11000) {

      const field =
        Object.keys(
          error.keyValue
        )[0];

      return res.status(400).json({

        success: false,

        message:
          `${field} already exists`,

        field

      });

    }

    res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};

/* Get All Students (Library Only) */
export const getAllStudents = async (req, res) => {
  try {

    const { libraryId } = req.user;

    // 🔥 Show all students
    const students = await Student.find({
      libraryId
    })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: students.length,
      students
    });

  } catch (error) {

    console.error(
      "GET STUDENTS ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message
    });
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

    const updateData = { ...req.body };

    // ❌ Password update API se password mat update karo
    delete updateData.password;

    // ✅ Email Validation
    if (updateData.email) {
      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(updateData.email)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address"
        });
      }

      const existingEmail =
        await Student.findOne({
          email: updateData.email.toLowerCase(),
          libraryId,
          _id: { $ne: req.params.id }
        });

      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message:
            "Student with this email already exists"
        });
      }

      updateData.email =
        updateData.email.toLowerCase().trim();
    }

    // ✅ Phone Validation
    if (updateData.phone) {
      if (!/^\d{10}$/.test(updateData.phone)) {
        return res.status(400).json({
          success: false,
          message: "Phone number must be 10 digits"
        });
      }

      const existingPhone =
        await Student.findOne({
          phone: updateData.phone,
          libraryId,
          _id: { $ne: req.params.id }
        });

      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message:
            "Student with this phone already exists"
        });
      }
    }

    // ✅ Study Hours Validation
    if (updateData.studyHours) {
      const validStudyHours = [
        "3 Hours",
        "4 Hours",
        "5 Hours",
        "6 Hours",
        "7 Hours",
        "8 Hours",
        "9 Hours",
        "10 Hours",
        "11 Hours",
        "12 Hours",
        "Full Day"
      ];

      if (
        !validStudyHours.includes(
          String(updateData.studyHours)
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid study hours selected"
        });
      }
    }

    // ✅ Trim Fields
    if (updateData.name)
      updateData.name =
        updateData.name.trim();

    if (updateData.fathername)
      updateData.fathername =
        updateData.fathername.trim();

    if (updateData.address)
      updateData.address =
        updateData.address.trim();

    if (updateData.documentNumber)
      updateData.documentNumber =
        updateData.documentNumber.trim();

    if (updateData.referralCode)
      updateData.referralCode =
        updateData.referralCode.trim();

    // ✅ Update Student
    const student =
      await Student.findOneAndUpdate(
        {
          _id: req.params.id,
          libraryId
        },
        { $set: updateData },
        {
          new: true
        }
      );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student updated successfully",
      student
    });

  } catch (error) {
    console.error(
      "UPDATE STUDENT ERROR:",
      error
    );

    if (error.code === 11000) {
      const field =
        Object.keys(error.keyValue)[0];

      return res.status(400).json({
        success: false,
        message: `${field} already exists`,
        field
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Internal Server Error"
    });
  }
};

/* Delete Student */
export const deleteStudent = async (req, res) => {

  try {

    const { libraryId } =
      req.user;

    // ✅ FIND STUDENT FIRST
    const student =
      await Student.findOne({

        _id:
          req.params.id,

        libraryId

      });

    if (!student) {

      return res.status(404).json({

        success: false,

        message:
          "Student not found"

      });

    }

    // ✅ DELETE STUDENT
    await Student.findByIdAndDelete(
      student._id
    );

    // ✅ GET LAST STUDENT
    const lastStudent =
      await Student.findOne({
        libraryId
      })
        .sort({
          createdAt: -1
        });

    // ✅ IF NO STUDENTS LEFT
    if (!lastStudent) {

      return res.json({

        success: true,

        message:
          "Student deleted successfully"

      });

    }

    // ✅ DELETED NUMBER
    const deletedNumber =
      parseInt(
        student.enrollmentNumber
          ?.split("-")[1]
      );

    // ✅ LAST NUMBER
    const lastNumber =
      parseInt(
        lastStudent.enrollmentNumber
          ?.split("-")[1]
      );

    // ✅ ONLY RESET IF LAST STUDENT DELETED
    if (
      deletedNumber ===
      lastNumber + 1
    ) {

      console.log(
        "Last enrollment deleted"
      );

    }

    res.json({

      success: true,

      message:
        "Student deleted successfully"

    });

  } catch (error) {

    console.error(
      "DELETE STUDENT ERROR:",
      error
    );

    res.status(500).json({

      success: false,

      message:
        error.message

    });

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

// 1️⃣ Get Seats
export const getAvailableSeats = async (req, res) => {
  try {

    const seats = await Seat.find({
      libraryId: req.user.libraryId
    });

    res.json({
      success: true,
      data: seats
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// 2️⃣ Book Seat
export const bookSeat = async (req, res) => {
  try {

    const { seatId, shift } = req.body;

    // check if seat already booked
    const existingSeatBooking = await SeatBooking.findOne({
      seatId,
      shift,
      status: "active"
    });

    if (existingSeatBooking) {
      return res.status(400).json({
        success: false,
        message: "Seat already booked for this shift"
      });
    }

    // check if student already has seat
    const studentBooking = await SeatBooking.findOne({
      studentId: req.user.userId,
      status: "active"
    });

    if (studentBooking) {
      return res.status(400).json({
        success: false,
        message: "You already have a booked seat"
      });
    }

    const booking = await SeatBooking.create({
      studentId: req.user.userId,
      libraryId: req.user.libraryId,
      seatId,
      shift,
      checkIn: new Date(),
      status: "active"
    });

    res.json({
      success: true,
      message: "Seat booked successfully",
      data: booking
    });

  } catch (error) {

    if (error.code === 11000) {
      return res.status(400).json({
        message: "Seat already booked"
      });
    }

    res.status(500).json({
      message: error.message
    });
  }
};

// 3️⃣ Checkout Seat
export const checkoutSeat = async (req, res) => {
  try {

    const booking = await SeatBooking.findOne({
      studentId: req.user.userId,
      status: "active"
    });

    if (!booking) {
      return res.status(400).json({
        message: "No active seat booking"
      });
    }

    booking.status = "completed";
    booking.checkOut = new Date();
    await booking.save();

    await Seat.findByIdAndUpdate(
      booking.seatId,
      { status: "vacant" }
    );

    res.json({
      success: true,
      message: "Seat checkout successful"
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
