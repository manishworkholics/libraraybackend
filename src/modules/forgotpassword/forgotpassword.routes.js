import express from "express";
import {
   forgotPassword,
   resetPassword,
   verifyOtp
} from "./forgotpassword.controller.js";


const router = express.Router();

router.post("/forgot-password", forgotPassword);
router.post(
  "/reset-password/:token",
  resetPassword
);
router.post("/verify-otp", verifyOtp);

export default router;