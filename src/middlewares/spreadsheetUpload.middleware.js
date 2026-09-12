import multer from "multer";
import path from "path";

const allowedExtensions = new Set([".xlsx", ".xls", ".csv"]);

const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    if (!allowedExtensions.has(extension)) {
      return callback(new Error("Only .xlsx, .xls, or .csv files are allowed"));
    }
    callback(null, true);
  }
});

export default spreadsheetUpload;
