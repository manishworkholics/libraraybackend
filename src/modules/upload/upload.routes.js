import express from "express";
import upload from "../../middlewares/upload.js";
import { uploadImage } from "./upload.controller.js";

const router = express.Router();

router.post("/upload-image", upload.single("image"), uploadImage);

export default router;