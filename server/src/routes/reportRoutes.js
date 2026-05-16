import express from "express";
import { body } from "express-validator";
import {
  approveReport,
  createReport,
  forwardReport,
  getReportById,
  listReports,
  reviewReport,
  revisionReport,
} from "../controllers/reportController.js";
import { auth, roleGuard } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.post("/", auth, roleGuard("teknisi", "technician", "staff"), [body("task_id").isInt(), body("report_date").isISO8601(), body("supervisor_id").isInt(), body("progress_percent").isInt({ min: 0, max: 100 }), body("summary_text").notEmpty(), body("issue_text").optional().isString()], validate, asyncHandler(createReport));
router.get("/", auth, asyncHandler(listReports));
router.get("/:id", auth, asyncHandler(getReportById));
router.patch("/:id/review", auth, roleGuard("supervisor", "staff"), asyncHandler(reviewReport));
router.patch("/:id/forward", auth, roleGuard("supervisor", "staff"), asyncHandler(forwardReport));
router.patch("/:id/approve", auth, roleGuard("staff", "atasan"), asyncHandler(approveReport));
router.patch("/:id/revision", auth, roleGuard("staff", "atasan", "supervisor"), asyncHandler(revisionReport));

export default router;
