import express from "express";
import adminAuth from "../../middlewares/adminAuth.middleware.js";

import {
  getRenewalList,
  renewStudent
} from "./renewal.controller.js";

const router = express.Router();

// ✅ Get renewal list
router.get("/", adminAuth, getRenewalList);

// ✅ Renew student
router.put("/renew/:id", adminAuth, renewStudent);

export default router; // 🔥 MUST (same as fees)