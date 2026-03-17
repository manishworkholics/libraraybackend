import express from "express";
import superAdminAuth from "../../middlewares/superAdminAuth.middleware.js";

import {
  activatePlanForLibrary,
  createPlan,
  getPlans,
  updatePlan,
  deletePlan
} from "./subscription.controller.js";

const router = express.Router();

// create new plan
router.post("/plan", superAdminAuth, createPlan);

// get all plans
router.get("/plan", getPlans);

// update plan
router.put("/plan/:id", superAdminAuth, updatePlan);

// delete plan
router.delete("/plan/:id", superAdminAuth, deletePlan);

// activate plan for library
router.post("/activate", superAdminAuth, activatePlanForLibrary);

export default router;