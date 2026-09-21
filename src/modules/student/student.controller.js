import Student from "./student.model.js";
import Counter from "../commonmodel/Counter.js";
import Seat from "../seat/seat.model.js";
import SeatBooking from "../commonmodel/seatBooking.model.js";
import Library from "../commonmodel/Library.model.js";
import bcrypt from "bcryptjs";
import XLSX from "xlsx";

const validStudyHours = [
  "3 Hours", "4 Hours", "5 Hours", "6 Hours", "7 Hours",
  "8 Hours", "9 Hours", "10 Hours", "11 Hours", "12 Hours",
  "Full Day"
];

const getImportValue = (row, fieldNames) => {
  const normalizedRow = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/[^a-z0-9]/gi, "").toLowerCase(),
      String(value ?? "").trim()
    ])
  );

  for (const fieldName of fieldNames) {
    const value = normalizedRow[fieldName.replace(/[^a-z0-9]/gi, "").toLowerCase()];
    if (value !== undefined) return value;
  }
  return "";
};

const getEnrollmentPrefix = (libraryName = "") =>
  libraryName.replace(/\s+/g, "").substring(0, 3).toUpperCase();

const parseImportDate = (value) => {
  if (!value) return null;

  const normalizedValue = String(value).trim();

  // XLSX stores real Excel dates as serial numbers. Read the serial directly
  // instead of letting the server locale swap day and month.
  if (/^\d{4,6}(?:\.\d+)?$/.test(normalizedValue)) {
    const excelDate = XLSX.SSF.parse_date_code(Number(normalizedValue));
    if (excelDate) {
      return new Date(excelDate.y, excelDate.m - 1, excelDate.d);
    }
  }

  // Excel exports commonly use DD-MM-YYYY / DD-MM-YYYY dates. JavaScript does
  // not parse that format reliably, so construct the date explicitly.
  const dayFirstMatch = normalizedValue.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return (
      parsed.getFullYear() === Number(year) &&
      parsed.getMonth() === Number(month) - 1 &&
      parsed.getDate() === Number(day)
    ) ? parsed : null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatExcelDate = (value) => {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).formatToParts(new Date(value));
  const getPart = (type) => parts.find((part) => part.type === type)?.value;
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
};

export const exportStudents = async (req, res) => {
  try {
    const { libraryId } = req.user;
    const students = await Student.find({ libraryId })
      .sort({ registrationDate: -1, createdAt: -1 })
      .lean();

    const rows = [
      ["Enrollment Number", "Name", "Father Name", "Phone", "Email", "Address", "DOB", "Gender", "Document Number", "Course", "Study Hours", "Registration Date", "Status", "Referral Code"],
      ...students.map((student) => [
        student.enrollmentNumber || "", student.name || "", student.fathername || "",
        student.phone || "", student.email || "", student.address || "",
        formatExcelDate(student.dob), student.gender || "", student.documentNumber || "",
        student.course || "", student.studyHours || "", formatExcelDate(student.registrationDate),
        student.status || "", student.referralCode || ""
      ])
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = rows[0].map((header) => ({ wch: Math.max(header.length + 2, 16) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="students.xlsx"');
    return res.send(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  } catch (error) {
    return res.status(500).json({ message: "Could not export students" });
  }
};

export const downloadStudentImportTemplate = (req, res) => {
  const rows = [
    ["name", "fatherName", "phone", "address", "course", "studyHours", "documentNumber", "registrationDate", "dob", "gender", "email", "referralCode", "password"],
    ["Mayank Porwal", "Ramesh Porwal", "9876543210", "Indore", "Competitive Exam", "10 Hours", "ID12345", "2026-09-01", "2002-08-15", "Male", "mayank@example.com", "REF101", ""],
    ["Prakrati Mandwariya", "", "9876543211", "Sudama Nagar", "UPSC", "Full Day", "", "2026-09-02", "2003-01-10", "Female", "", "", ""]
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = rows[0].map((header) => ({ wch: Math.max(header.length + 2, 16) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Students");

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="student-import-template.xlsx"');
  return res.send(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
};

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

    const { libraryId, parentLibraryId } = req.user;

    // ✅ REQUIRED FIELDS
    if (
      !name ||
      !phone ||
      !address ||
      !course ||
      !studyHours
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
        parentLibraryId || libraryId
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

        // Manual registration always uses the date on which the admin creates
        // the student. Imports set this value from the spreadsheet instead.
        registrationDate: new Date(),

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

/* Import students from XLSX, XLS, or CSV into the logged-in branch. */
export const importStudents = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: "Please select an Excel or CSV file" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return res.status(400).json({ message: "The uploaded file has no worksheet" });
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
      // Keep Excel serial values intact so date parsing is independent of the
      // machine/Excel locale (DD-MM-YYYY must not become MM-DD-YYYY).
      raw: true
    });
    if (!rows.length) {
      return res.status(400).json({ message: "The uploaded worksheet has no student rows" });
    }

    // For date columns, use Excel's displayed cell text (cell.w). A workbook
    // created on a month-first system can store `10-08-2026` internally as
    // October 8 even though the user sees it as 10 August. Reading the visible
    // DD-MM-YYYY text preserves the intended import date.
    const dateColumnNames = new Set([
      "dob", "dateofbirth", "registrationdate", "dateofregistration",
      "joiningdate", "dateofjoining", "admissiondate", "dateofadmission",
      "registration", "date"
    ]);
    const headers = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: false
    })[0] || [];

    rows.forEach((row, rowIndex) => {
      headers.forEach((header, columnIndex) => {
        const normalizedHeader = String(header).replace(/[^a-z0-9]/gi, "").toLowerCase();
        const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex })];
        if (dateColumnNames.has(normalizedHeader) && cell?.w) {
          row[header] = cell.w;
        }
      });
    });

    const { libraryId, parentLibraryId } = req.user;
    const library = await Library.findById(parentLibraryId || libraryId).select("name");
    if (!library) {
      return res.status(404).json({ message: "Library not found" });
    }

    const existingStudents = await Student.find({ libraryId })
      .select("phone email enrollmentNumber");
    const existingPhones = new Set(existingStudents.map((student) => String(student.phone)));
    const existingEmails = new Set(
      existingStudents.filter((student) => student.email)
        .map((student) => student.email.toLowerCase())
    );
    const importPhones = new Set();
    const importEmails = new Set();

    const prefix = getEnrollmentPrefix(library.name);
    let nextEnrollmentNumber = existingStudents.reduce((highest, student) => {
      const match = String(student.enrollmentNumber || "").match(new RegExp(`^${prefix}-(\\d+)$`));
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0) + 1;

    const imported = [];
    const errors = [];

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const name = getImportValue(row, ["name", "studentName"]);
      const fathername = getImportValue(row, ["fatherName", "fathername"]);
      const phone = getImportValue(row, ["phone", "mobile", "mobileNumber"]).replace(/\D/g, "");
      const email = getImportValue(row, ["email"]).toLowerCase();
      const address = getImportValue(row, ["address"]);
      const course = getImportValue(row, ["course"]);
      const requestedStudyHours = getImportValue(row, ["studyHours", "hours"]);
      const studyHours = validStudyHours.find(
        (value) => value.toLowerCase() === requestedStudyHours.toLowerCase()
      ) || "";
      const documentNumber = getImportValue(row, ["documentNumber", "documentNo", "idNumber"]);
      const dob = getImportValue(row, ["dob", "dateOfBirth"]);
      const registrationDateValue = getImportValue(row, [
        "registrationDate",
        "dateOfRegistration",
        "joiningDate",
        "dateOfJoining",
        "admissionDate",
        "dateOfAdmission",
        "registration",
        "date"
      ]);
      const parsedDob = dob ? parseImportDate(dob) : null;
      const registrationDate = registrationDateValue ? parseImportDate(registrationDateValue) : new Date();
      const gender = getImportValue(row, ["gender"]);
      const referralCode = getImportValue(row, ["referralCode", "referral"]);
      const password = getImportValue(row, ["password"]);

      const rowErrors = [];
      if (!name || !phone || !address || !course || !studyHours) {
        rowErrors.push("name, phone, address, course and studyHours are required");
      }
      if (phone && !/^\d{10}$/.test(phone)) rowErrors.push("phone must be exactly 10 digits");
      if (requestedStudyHours && !studyHours) rowErrors.push("invalid studyHours");
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) rowErrors.push("invalid email");
      if (dob && !parsedDob) rowErrors.push("invalid dob (use YYYY-MM-DD or DD-MM-YYYY)");
      if (registrationDateValue && !registrationDate) rowErrors.push("invalid registrationDate (use YYYY-MM-DD or DD-MM-YYYY)");
      if (email && (existingEmails.has(email) || importEmails.has(email))) rowErrors.push("email already exists in this branch");
      if (phone && (existingPhones.has(phone) || importPhones.has(phone))) rowErrors.push("phone already exists in this branch");
      if (gender && !["Male", "Female", "Other"].includes(gender)) rowErrors.push("gender must be Male, Female, or Other");

      if (rowErrors.length) {
        errors.push({ row: rowNumber, message: rowErrors.join("; ") });
        continue;
      }

      try {
        const studentPassword = password || phone.slice(-6);
        const enrollmentNumber = `${prefix}-${nextEnrollmentNumber}`;
        const student = await Student.create({
          name,
          fathername,
          dob: parsedDob || undefined,
          registrationDate,
          gender: gender || undefined,
          email: email || undefined,
          phone,
          address,
          course,
          studyHours,
          documentNumber,
          referralCode: referralCode || undefined,
          password: await bcrypt.hash(studentPassword, 10),
          enrollmentNumber,
          libraryId
        });

        // Advance the sequence only after MongoDB has accepted the student.
        // A skipped/invalid Excel row must never consume an enrollment number.
        nextEnrollmentNumber += 1;
        existingPhones.add(phone);
        importPhones.add(phone);
        if (email) {
          existingEmails.add(email);
          importEmails.add(email);
        }
        imported.push({ row: rowNumber, id: student._id, enrollmentNumber: student.enrollmentNumber, name: student.name });
      } catch (error) {
        errors.push({ row: rowNumber, message: error.code === 11000 ? "duplicate data already exists" : error.message });
      }
    }

    return res.status(201).json({
      message: `${imported.length} student(s) imported successfully`,
      importedCount: imported.length,
      skippedCount: errors.length,
      imported,
      errors
    });
  } catch (error) {
    return res.status(400).json({ message: `Import failed: ${error.message}` });
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
    .sort({ registrationDate: -1, createdAt: -1 });

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

    // Persist the schema field name even if an older client sends camelCase.
    if (Object.prototype.hasOwnProperty.call(updateData, "fatherName")) {
      updateData.fathername = String(updateData.fatherName ?? "").trim();
      delete updateData.fatherName;
    }

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
