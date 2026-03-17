import express from "express";
import adminAuth from "../../middlewares/adminAuth.middleware.js";
import { addFees, getStudentFees,createFees, getFees } from "./fees.controller.js";

const router = express.Router();

router.post("/add", adminAuth, addFees);
router.get("/:studentId", adminAuth, getStudentFees);
router.post("/create",adminAuth, createFees);
router.get("/",adminAuth, getFees);

export default router;
