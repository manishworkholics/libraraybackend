import express from "express";
import adminAuth from "../../middlewares/adminAuth.middleware.js";
import { getDashboardStats,getAdminDashboard,getGraphData, getRecentActivities} from "./dashboard.controller.js";

const router = express.Router();

router.get("/stats", adminAuth, getDashboardStats);
router.get("/", adminAuth, getAdminDashboard);
router.get("/graph", adminAuth, getGraphData);
router.get(
  "/recent-activities",
  adminAuth,
  getRecentActivities
);
export default router;