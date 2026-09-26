import express from "express";

import {
  addFees,
  getStudentFees,
  getFees,
  deleteFees,
  getRevenueStats,
  getRenewalList,
  renewFees,
  updateFees,
  changeRenewal,
  importFeesFromExcel,
} from "./fees.controller.js";

import adminAuth from "../../middlewares/adminAuth.middleware.js";

import spreadsheetUpload from "../../middlewares/spreadsheetUpload.middleware.js";

const router = express.Router();

/* =========================================
   💰 ADD REVENUE
========================================= */

router.post(
  "/add",
  adminAuth,
  addFees
);

/* =========================================
   📥 IMPORT REVENUE FROM EXCEL
========================================= */

router.post(
  "/import",
  adminAuth,
  spreadsheetUpload.single("file"),
  importFeesFromExcel
);

/* =========================================
   📊 REVENUE STATS
========================================= */

router.get(
  "/stats",
  adminAuth,
  getRevenueStats
);

/* =========================================
   🔄 RENEWAL LIST
========================================= */

router.get(
  "/renewal-list",
  adminAuth,
  getRenewalList
);

/* =========================================
   ➕ CREATE NEW RENEWAL
========================================= */

router.put(
  "/renew/:id",
  adminAuth,
  renewFees
);

/* =========================================
   ✏️ CHANGE EXISTING RENEWAL PLAN
========================================= */

router.put(
  "/change-renewal/:id",
  adminAuth,
  changeRenewal
);

/* =========================================
   👨‍🎓 STUDENT PAYMENT HISTORY
========================================= */

router.get(
  "/:studentId",
  adminAuth,
  getStudentFees
);

/* =========================================
   💳 PAYMENT HISTORY
========================================= */

router.get(
  "/",
  adminAuth,
  getFees
);

/* =========================================
   🗑️ DELETE REVENUE
========================================= */

router.delete(
  "/delete/:id",
  adminAuth,
  deleteFees
);

/* =========================================
   ✏️ EDIT REVENUE
========================================= */

router.put(
  "/update/:id",
  adminAuth,
  updateFees
);

export default router;