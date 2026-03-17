import express from "express";
import { createComplaint, getLibraryComplaints, } from "./supportComplaint.controller.js";
import { getAllComplaints, resolveComplaint, } from "../superadmin/superAdmin.controller.js";
import adminAuth from "../../middlewares/adminAuth.middleware.js";
import superAdminAuth from "../../middlewares/superAdminAuth.middleware.js";

const router = express.Router();

// library
router.post("/", adminAuth, createComplaint);
router.get("/my", adminAuth, getLibraryComplaints);

// super admin
router.get("/admin/all", superAdminAuth, getAllComplaints);
router.put("/admin/resolve/:id", superAdminAuth, resolveComplaint);

export default router;