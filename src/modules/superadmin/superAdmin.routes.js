import express from "express";
import superAdminAuth from "../../middlewares/superAdminAuth.middleware.js";

import {
    getSuperAdminDashboard,
    createLibrary,
    getAllLibrary,
    getLibraryById,
    updateLibrary,
    deleteLibrary,
    toggleLibraryStatus,
    getPlatformRevenueDashboard,
    getProfitDashboard,
    getMonthlyProfitGraph,
    getLast12MonthsRevenue,
    getLibraryWiseRevenue,
    addExpense,
    getExpenses,
    deleteExpense,
    getRevenueHistory,
    getRevenueById,
    updateRevenue,
    superAdminLogin,
    createSuccessStory,
    getSuccessStories,
    updateSuccessStory,
    deleteSuccessStory,
    createGallery,
    getGallery,
    updateGallery,
    deleteGallery
} from "./superAdmin.controller.js";

import {
    createPlan,
    getPlans,
    updatePlan,
    deletePlan,
    activatePlanForLibrary
} from "../subscription/subscription.controller.js";


const router = express.Router();

// 🔓 Public Route
router.post("/login", superAdminLogin);

// 🔐 All routes below require Super Admin auth

router.get("/dashboard", superAdminAuth, getSuperAdminDashboard);
router.get("/get-all-library", superAdminAuth, getAllLibrary);

router.post("/create-library", superAdminAuth, createLibrary);
router.get(
    "/library/:libraryId",
    superAdminAuth,
    getLibraryById
);

router.put(
    "/library/:libraryId",
    superAdminAuth,
    updateLibrary
);

router.delete(
    "/library/:libraryId",
    superAdminAuth,
    deleteLibrary
);
router.post(
  "/subscription/activate",
  superAdminAuth,
  activatePlanForLibrary
);
router.put("/library/:libraryId/status", superAdminAuth, toggleLibraryStatus);
router.get("/platform-revenue/dashboard", superAdminAuth, getPlatformRevenueDashboard);

router.get("/revenue-12-months", superAdminAuth, getLast12MonthsRevenue);

router.get("/library-wise-revenue", superAdminAuth, getLibraryWiseRevenue);

// 🔥 SUPER ADMIN ROUTES

router.post("/platform-expenses", superAdminAuth, addExpense);
router.get("/platform-expenses", superAdminAuth, getExpenses);
router.delete("/platform-expenses/:id", superAdminAuth, deleteExpense);
router.get(
    "/platform-revenue/history",
    superAdminAuth,
    getRevenueHistory
);

router.get(
    "/platform-revenue/:id",
    superAdminAuth,
    getRevenueById
);

router.put(
    "/platform-revenue/:id",
    superAdminAuth,
    updateRevenue
);
router.get("/profit-dashboard", superAdminAuth, getProfitDashboard);
router.get("/profit-graph", getMonthlyProfitGraph);

router.post("/plans", superAdminAuth, createPlan);
router.get("/plans", superAdminAuth, getPlans);
router.put("/plans/:id", superAdminAuth, updatePlan);
router.delete("/plans/:id", superAdminAuth, deletePlan);


router.post("/success-story", superAdminAuth, createSuccessStory);
router.get("/success-story", getSuccessStories);
router.put("/success-story/:id", superAdminAuth, updateSuccessStory);
router.delete("/success-story/:id", superAdminAuth, deleteSuccessStory);


router.post("/gallery", superAdminAuth, createGallery);
router.get("/gallery", getGallery);
router.put("/gallery/:id", superAdminAuth, updateGallery);
router.delete("/gallery/:id", superAdminAuth, deleteGallery);

export default router;

