import Enquiry from "./enquiry.model.js";
import XLSX from "xlsx";
import Student from "../student/student.model.js"

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

const parseImportDate = (value) => {
  if (!value) return null;
  const normalizedValue = String(value).trim();
  if (/^\d{4,6}(?:\.\d+)?$/.test(normalizedValue)) {
    const excelDate = XLSX.SSF.parse_date_code(Number(normalizedValue));
    return excelDate ? new Date(excelDate.y, excelDate.m - 1, excelDate.d) : null;
  }
  const dayFirstMatch = normalizedValue.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return parsed.getFullYear() === Number(year) && parsed.getMonth() === Number(month) - 1 && parsed.getDate() === Number(day)
      ? parsed
      : null;
  }
  const parsed = new Date(normalizedValue);
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

export const exportEnquiries = async (req, res) => {
  try {
    const { libraryId } = req.user;
    const enquiries = await Enquiry.find({ libraryId })
      .sort({ date: -1, createdAt: -1 })
      .lean();
    const rows = [
      ["Name", "Contact", "Address", "Course", "Status", "Source", "Notes", "Demo Date", "Remark", "Enquiry Date"],
      ...enquiries.map((enquiry) => [
        enquiry.name || "", enquiry.contact || "", enquiry.address || "", enquiry.course || "",
        enquiry.status || "", enquiry.source || "", enquiry.notes || "", formatExcelDate(enquiry.demoDate),
        enquiry.remark || "", formatExcelDate(enquiry.date)
      ])
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = rows[0].map((header) => ({ wch: Math.max(header.length + 2, 16) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Enquiries");

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="enquiries.xlsx"');
    return res.send(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  } catch (error) {
    return res.status(500).json({ message: "Could not export enquiries" });
  }
};

export const downloadEnquiryImportTemplate = (req, res) => {
  const rows = [
    ["name", "contact", "address", "course", "status", "notes", "demoDate", "remark", "date"],
    ["Amit Sharma", "9876543210", "Vijay Nagar", "UPSC", "new", "Asked for a demo", "", "", "2026-09-12"],
    ["Neha Verma", "9876543211", "Sudama Nagar", "SSC", "contacted", "Will visit tomorrow", "2026-09-15", "Follow up", "2026-09-12"]
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = rows[0].map((header) => ({ wch: Math.max(header.length + 2, 16) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Enquiries");

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="enquiry-import-template.xlsx"');
  return res.send(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
};

export const importEnquiries = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Please upload an Excel or CSV file" });

    const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: false });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: true });
    if (!rows.length) return res.status(400).json({ message: "The uploaded file has no enquiry rows" });

    const { libraryId } = req.user;
    const existingContacts = new Set((await Enquiry.find({ libraryId }).select("contact").lean()).map((item) => String(item.contact).trim()));
    const importContacts = new Set();
    const errors = [];
    let importedCount = 0;

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const name = getImportValue(row, ["name", "fullName"]);
      const contact = getImportValue(row, ["contact", "mobile", "phone"]);
      const address = getImportValue(row, ["address"]);
      const course = getImportValue(row, ["course"]);
      const status = getImportValue(row, ["status"]).toLowerCase() || "new";
      const notes = getImportValue(row, ["notes", "note"]);
      const remark = getImportValue(row, ["remark"]);
      const demoDateValue = getImportValue(row, ["demoDate", "demo"]);
      const dateValue = getImportValue(row, ["date", "enquiryDate", "registrationDate"]);
      const demoDate = demoDateValue ? parseImportDate(demoDateValue) : null;
      const date = dateValue ? parseImportDate(dateValue) : new Date();
      const rowErrors = [];

      if (!name || !contact || !address || !course) rowErrors.push("name, contact, address and course are required");
      if (contact && !/^\d{10}$/.test(contact)) rowErrors.push("contact must be exactly 10 digits");
      if (!["new", "contacted", "converted", "rejected"].includes(status)) rowErrors.push("invalid status");
      if (demoDateValue && !demoDate) rowErrors.push("invalid demoDate (use YYYY-MM-DD or DD-MM-YYYY)");
      if (dateValue && !date) rowErrors.push("invalid date (use YYYY-MM-DD or DD-MM-YYYY)");
      if (contact && (existingContacts.has(contact) || importContacts.has(contact))) rowErrors.push("contact already exists in this branch");

      if (rowErrors.length) {
        errors.push({ row: rowNumber, message: rowErrors.join("; ") });
        continue;
      }

      await Enquiry.create({ name, contact, address, course, status, notes: notes || undefined, demoDate, remark: remark || "", date, source: "manual", libraryId });
      importContacts.add(contact);
      importedCount += 1;
    }

    return res.status(201).json({ message: "Enquiry import completed", importedCount, skippedCount: errors.length, errors });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Enquiry import failed" });
  }
};

/* =========================================
   ➕ CREATE ENQUIRY
========================================= */
export const createEnquiry = async (req, res) => {
  try {
    const { name, contact, address, course } = req.body;
    const { libraryId } = req.user;

    if (!name || !contact || !address || !course) {
      return res.status(400).json({
        message: "Please fill all required fields"
      });
    }

    const enquiry = await Enquiry.create({
      name,
      contact,
      address,
      course,
      libraryId
    });

    res.status(201).json({
      message: "Enquiry added successfully",
      enquiry
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

/* =========================================
   📋 GET ALL ENQUIRIES (Pagination + Search)
========================================= */
export const getAllEnquiries = async (req, res) => {
  try {
    const { libraryId } = req.user;

    const {
      page = 1,
      limit = 10,
      search = "",
      date
    } = req.query;

    const filters = [
      {
        libraryId
      },

      // New registration ke baad registered=true wali enquiry hide
      {
        registered: { $ne: true }
      }
    ];

    // 🔍 SEARCH FILTER
    if (search.trim()) {
      filters.push({
        $or: [
          {
            name: {
              $regex: search.trim(),
              $options: "i"
            }
          },
          {
            contact: {
              $regex: search.trim(),
              $options: "i"
            }
          }
        ]
      });
    }

    // 📅 DATE FILTER
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);

      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      filters.push({
        date: {
          $gte: start,
          $lte: end
        }
      });
    }

    /*
     * 🔥 OLD REGISTERED STUDENTS
     *
     * Student collection se registered students ke phone numbers
     * nikal rahe hain.
     */
    const registeredStudents = await Student.find(
      {
        libraryId
      },
      {
        phone: 1,
        _id: 0
      }
    ).lean();

    const registeredPhones = registeredStudents
      .map((student) => String(student.phone || "").trim())
      .filter(Boolean);

    /*
     * Agar students hain to unke phone wali enquiries hide karo.
     */
    if (registeredPhones.length > 0) {
      filters.push({
        contact: {
          $nin: registeredPhones
        }
      });
    }

    // Final query
    const query = {
      $and: filters
    };

    const pageNumber = Math.max(
      1,
      Number.parseInt(page, 10) || 1
    );

    const pageLimit = Math.max(
      1,
      Number.parseInt(limit, 10) || 10
    );

    // 📊 TOTAL
    const total = await Enquiry.countDocuments(query);

    // 📄 ENQUIRIES
    const enquiries = await Enquiry.find(query)
      .sort({
        date: -1,
        createdAt: -1,
        _id: -1
      })
      .skip((pageNumber - 1) * pageLimit)
      .limit(pageLimit)
      .lean();

    res.json({
      total,
      page: pageNumber,
      pages: Math.ceil(total / pageLimit),
      enquiries
    });

  } catch (error) {
    console.error("Get All Enquiries Error:", error);

    res.status(500).json({
      message: error.message
    });
  }
};

/* =========================================
   🔍 GET SINGLE ENQUIRY
========================================= */
export const getSingleEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const { libraryId } = req.user;

    const enquiry = await Enquiry.findOne({
      _id: id,
      libraryId
    });

    if (!enquiry) {
      return res.status(404).json({
        message: "Enquiry not found"
      });
    }

    res.json(enquiry);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================================
   ✏️ UPDATE ENQUIRY
========================================= */
export const updateEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const { libraryId } = req.user;

    const enquiry = await Enquiry.findOneAndUpdate(
      { _id: id, libraryId },
      req.body,
      { new: true }
    );

    if (!enquiry) {
      return res.status(404).json({
        message: "Enquiry not found"
      });
    }

    res.json({
      message: "Enquiry updated successfully",
      enquiry
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================================
   ❌ DELETE ENQUIRY
========================================= */
export const deleteEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const { libraryId } = req.user;

    const enquiry = await Enquiry.findOneAndDelete({
      _id: id,
      libraryId
    });

    if (!enquiry) {
      return res.status(404).json({
        message: "Enquiry not found"
      });
    }

    res.json({
      message: "Enquiry deleted successfully"
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================================
   🌐 WEBSITE ENQUIRY (PUBLIC)
========================================= */
export const createWebsiteEnquiry = async (req, res) => {
  try {

    const { name, contact, address, course, libraryId } = req.body;

    if (!name || !contact || !address || !course || !libraryId) {
      return res.status(400).json({
        message: "Please fill all required fields"
      });
    }

    const enquiry = await Enquiry.create({
      name,
      contact,
      address,
      course,
      libraryId,
      source: "website"
    });

    res.status(201).json({
      message: "Enquiry submitted successfully",
      enquiry
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================================
   📅 SET DEMO DATE
========================================= */
export const setDemoDate = async (req, res) => {
  try {

    const { id } = req.params;
    const { libraryId } = req.user;

    const enquiry = await Enquiry.findOneAndUpdate(
      { _id: id, libraryId },
      { demoDate: new Date() },
      { new: true }
    );

    if (!enquiry) {
      return res.status(404).json({
        message: "Enquiry not found"
      });
    }

    res.json({
      message: "Demo date saved",
      enquiry
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================================
   📝 ADD REMARK
========================================= */
export const addRemark = async (req, res) => {
  try {

    const { id } = req.params;
    const { libraryId } = req.user;
    const { remark } = req.body;

    const enquiry = await Enquiry.findOneAndUpdate(
      { _id: id, libraryId },
      { remark },
      { new: true }
    );

    if (!enquiry) {
      return res.status(404).json({
        message: "Enquiry not found"
      });
    }

    res.json({
      message: "Remark added",
      enquiry
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
