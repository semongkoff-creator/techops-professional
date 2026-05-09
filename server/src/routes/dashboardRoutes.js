import express from "express";
import { auth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { dashboardCharts, dashboardSummary, exportDummy } from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/summary", auth, asyncHandler(dashboardSummary));
router.get("/charts", auth, asyncHandler(dashboardCharts));
router.get("/export", auth, asyncHandler(exportDummy));

export default router;
