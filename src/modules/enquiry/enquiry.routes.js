import express from "express";
import {
   createEnquiry,
   createWebsiteEnquiry,
   getAllEnquiries,
   getSingleEnquiry,
   updateEnquiry,
   deleteEnquiry,
   setDemoDate,
   addRemark
} from "./enquiry.controller.js";

import adminAuth from "../../middlewares/adminAuth.middleware.js";

const router = express.Router();

/* =========================================
   🌐 WEBSITE ENQUIRY (PUBLIC)
========================================= */

router.post("/public", createWebsiteEnquiry);

/* =========================================
   📅 DEMO DATE
========================================= */

router.put("/demo/:id", adminAuth, setDemoDate);


/* =========================================
   📝 REMARK
========================================= */

router.put("/remark/:id", adminAuth, addRemark);

/* =========================================
   🧑‍💼 ADMIN PANEL ENQUIRIES
========================================= */

router.post("/", adminAuth, createEnquiry);

router.get("/", adminAuth, getAllEnquiries);

router.get("/:id", adminAuth, getSingleEnquiry);

router.put("/:id", adminAuth, updateEnquiry);

router.delete("/:id", adminAuth, deleteEnquiry);

export default router;