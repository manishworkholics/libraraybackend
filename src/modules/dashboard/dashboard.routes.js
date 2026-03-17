import express from "express";
import adminAuth from "../../middlewares/adminAuth.middleware.js";
import { getDashboardStats,getAdminDashboard } from "./dashboard.controller.js";

const router = express.Router();

router.get("/stats", adminAuth, getDashboardStats);
router.get("/", adminAuth, getAdminDashboard);

export default router;