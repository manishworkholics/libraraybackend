import Admin from "../models/adminModel.js";
import crypto from "crypto";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";


export const forgotPassword = async (req, res) => {
  try {

    const { email, phone } = req.body;

    let admin;

    if (email) {
      admin = await Admin.findOne({ email });
    } else if (phone) {
      admin = await Admin.findOne({ phone });
    }

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // EMAIL RESET LINK
    if (email) {

      const resetToken = crypto.randomBytes(32).toString("hex");

      admin.resetPasswordToken = resetToken;

      admin.resetPasswordExpire =
        Date.now() + 15 * 60 * 1000;

      await admin.save();

      const resetUrl =
        `http://localhost:3000/reset-password/${resetToken}`;

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: process.env.EMAIL,
        to: admin.email,
        subject: "Password Reset",
        html: `
          <h3>Password Reset</h3>
          <a href="${resetUrl}">
            Click Here
          </a>
        `,
      });

      return res.status(200).json({
        success: true,
        message: "Reset link sent to email",
      });
    }

    // MOBILE OTP
    if (phone) {

      const otp =
        Math.floor(
          100000 + Math.random() * 900000
        );

      admin.resetOtp = otp;

      admin.resetOtpExpire =
        Date.now() + 10 * 60 * 1000;

      await admin.save();

      // Twilio / MSG91 SMS API
      console.log("OTP:", otp);

      return res.status(200).json({
        success: true,
        message: "OTP sent to mobile number",
      });
    }

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

export const resetPassword = async (req, res) => {

  const { token } = req.params;

  const { password } = req.body;

  const admin = await Admin.findOne({
    resetPasswordToken: token,
    resetPasswordExpire: {
      $gt: Date.now(),
    },
  });

  if (!admin) {
    return res.status(400).json({
      message: "Token expired",
    });
  }

  admin.password =
    await bcrypt.hash(password, 10);

  admin.resetPasswordToken = undefined;

  admin.resetPasswordExpire = undefined;

  await admin.save();

  res.status(200).json({
    success: true,
    message: "Password updated successfully",
  });
};

export const verifyOtp = async (req, res) => {

  const { phone, otp, password } = req.body;

  const admin = await Admin.findOne({
    phone,
    resetOtp: otp,
    resetOtpExpire: {
      $gt: Date.now(),
    },
  });

  if (!admin) {
    return res.status(400).json({
      message: "Invalid OTP",
    });
  }

  admin.password =
    await bcrypt.hash(password, 10);

  admin.resetOtp = undefined;

  admin.resetOtpExpire = undefined;

  await admin.save();

  res.status(200).json({
    success: true,
    message: "Password changed successfully",
  });
};