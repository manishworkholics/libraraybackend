import express from "express";

import seatRoutes from "../modules/seat/seat.routes.js";
import adminRoutes from "../modules/admin/admin.routes.js";
import attendanceRoutes from "../modules/attendance/attendance.routes.js";
import studentRoutes from "../modules/student/student.routes.js";
import paymentRoutes from "../modules/payment/payment.routes.js";
import feesRoutes from "../modules/fees/fees.routes.js";
import complaintRoutes from "../modules/complaint/complaint.routes.js";
import enquiryRoutes from "../modules/enquiry/enquiry.routes.js";
import subscriptionRoutes from "../modules/subscription/subscription.routes.js";
import superAdminRoutes from "../modules/superadmin/superAdmin.routes.js";
import supportRoutes from "../modules/support/supportComplaint.routes.js";
import uploadRoutes from "../modules/upload/upload.routes.js";
import dashboardRoutes from "../modules/dashboard/dashboard.routes.js";
import renewalRoutes from "../modules/renewal/renewal.routes.js";
const router = express.Router();

router.use("/seats", seatRoutes);
router.use("/admin", adminRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/students", studentRoutes);
router.use("/payment", paymentRoutes);
router.use("/fees", feesRoutes);
router.use("/complaints", complaintRoutes);
router.use("/enquiry", enquiryRoutes);
router.use("/subscription", subscriptionRoutes);
router.use("/super-admin", superAdminRoutes);
router.use("/support", supportRoutes);
router.use("/upload", uploadRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/renewal", renewalRoutes);

export default router;