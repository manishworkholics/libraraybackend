import Admin from "./admin.model.js";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1️⃣ Find admin and populate library
        const admin = await Admin.findOne({ email }).populate("libraryId");

        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        // 2️⃣ Check library active status
        if (!admin.libraryId.isActive) {
            return res.status(403).json({
                message: "Library account is deactivated. Contact support."
            });
        }

        // 3️⃣ Check subscription expiry
        if (
            admin.libraryId.subscriptionExpiresAt &&
            new Date(admin.libraryId.subscriptionExpiresAt) < new Date()
        ) {
            return res.status(403).json({
                message: "Subscription expired. Please renew plan."
            });
        }

        // 4️⃣ Check password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid password" });
        }

        // 5️⃣ Generate SaaS-ready JWT
        const token = jwt.sign(
            {
                userId: admin._id,
                libraryId: admin.libraryId._id,
                role: admin.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // 6️⃣ Send safe response (no password)
        res.json({
            message: "Login successful",
            token,
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                library: {
                    id: admin.libraryId._id,
                    name: admin.libraryId.name,
                    subscriptionPlan: admin.libraryId.subscriptionPlan
                }
            }
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};