import express from "express";
import {
    adminLogin, 
    addExpense,
    getExpenses,
    deleteExpense,
    updateExpense,
    getAdminProfitDashboard,
    getAdminMonthlyProfitGraph
} from "./admin.controller.js";
import adminAuth from "../../middlewares/adminAuth.middleware.js";

const router = express.Router();

router.post("/login", adminLogin);

router.post("/expenses", adminAuth, addExpense);
router.get("/expenses", adminAuth, getExpenses);
router.delete("/expenses/:id", adminAuth, deleteExpense);
router.put("/expenses/:id", adminAuth, updateExpense);

router.get("/profit-dashboard", adminAuth, getAdminProfitDashboard);
router.get("/profit-graph", adminAuth, getAdminMonthlyProfitGraph);

export default router;
