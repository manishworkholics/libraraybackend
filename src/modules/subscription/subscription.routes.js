import express from "express";
import superAdminAuth from "../../middlewares/superAdminAuth.middleware.js";

import {
  createPlan,
  getPlans,
  getPlanById,
  updatePlan,
  deletePlan,
  togglePlanStatus,
  activatePlanForLibrary,
  getLibrarySubscription,
  getSubscriptionHistory,
  getAllRenewals,
  getExpiringSoon,
  getRenewalDashboard,
  getMonthlyRenewalSheet
} from "./subscription.controller.js";

const router = express.Router();

/* ==========================
   PLAN ROUTES
========================== */

// Create Plan
router.post(
  "/plan",
  superAdminAuth,
  createPlan
);

// Get All Plans
router.get(
  "/plan",
  getPlans
);

// Get Single Plan
router.get(
  "/plan/:id",
  getPlanById
);

// Update Plan
router.put(
  "/plan/:id",
  superAdminAuth,
  updatePlan
);

// Update Plan
router.delete(
  "/plan/:id",
  superAdminAuth,
  deletePlan
);

// Activate/Deactivate Plan
router.patch(
  "/plan/:id/status",
  superAdminAuth,
  togglePlanStatus
);

/* ==========================
   SUBSCRIPTION ROUTES
========================== */

// Activate Plan For Library
router.post(
  "/activate",
  superAdminAuth,
  activatePlanForLibrary
);

// Current Active Subscription
router.get(
  "/current/:libraryId",
  superAdminAuth,
  getLibrarySubscription
);

// Subscription History
router.get(
  "/history/:libraryId",
  superAdminAuth,
  getSubscriptionHistory
);
router.get(
  "/renewals",
  superAdminAuth,
  getAllRenewals
);

router.get(
  "/expiring-soon",
  superAdminAuth,
  getExpiringSoon
);

router.get(
  "/renewal-dashboard",
  superAdminAuth,
  getRenewalDashboard
);

router.get(
  "/monthly-renewals",
  superAdminAuth,
  getMonthlyRenewalSheet
);


export default router;