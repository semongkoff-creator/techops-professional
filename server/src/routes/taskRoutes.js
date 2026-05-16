import express from "express";
import { body } from "express-validator";
import {
  assignTechnician,
  createTask,
  deleteTask,
  getTaskById,
  getTaskHistory,
  listTasks,
  uploadTaskDocumentationImage,
  updateTask,
  updateTaskProgress,
  updateTaskStatus,
} from "../controllers/taskController.js";
import { auth, roleGuard } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { uploadTaskMedia } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.post(
  "/",
  auth,
  roleGuard("staff", "atasan", "supervisor", "teknisi", "technician"),
  [body("title").notEmpty(), body("description").notEmpty(), body("customer").optional().isString(), body("location").notEmpty(), body("priority").isIn(["low", "medium", "high"]), body("supervisor_id").optional({ nullable: true, checkFalsy: true }).isInt(), body("staff_id").optional({ nullable: true, checkFalsy: true }).isInt(), body("technician_id").optional({ nullable: true, checkFalsy: true }).isInt(), body("documentation_image_url").optional({ nullable: true, checkFalsy: true }).isURL(), body("completion_percent").optional({ nullable: true, checkFalsy: true }).isInt({ min: 0, max: 100 })],
  validate,
  asyncHandler(createTask),
);
router.get("/", auth, asyncHandler(listTasks));
router.post("/upload-media", auth, roleGuard("teknisi", "technician"), uploadTaskMedia.single("media"), asyncHandler(uploadTaskDocumentationImage));
router.get("/:id", auth, asyncHandler(getTaskById));
router.patch("/:id", auth, [body("title").optional().notEmpty(), body("description").optional().notEmpty(), body("customer").optional().isString(), body("location").optional().notEmpty(), body("priority").optional().isIn(["low", "medium", "high"]), body("supervisor_id").optional({ nullable: true, checkFalsy: true }).isInt(), body("technician_id").optional({ nullable: true, checkFalsy: true }).isInt(), body("documentation_image_url").optional({ nullable: true, checkFalsy: true }).isURL(), body("completion_percent").optional({ nullable: true, checkFalsy: true }).isInt({ min: 0, max: 100 })], validate, asyncHandler(updateTask));
router.delete("/:id", auth, asyncHandler(deleteTask));
router.patch("/:id/assign-technician", auth, roleGuard("supervisor", "staff", "atasan"), [body("technician_id").isInt(), body("note").optional().isString()], validate, asyncHandler(assignTechnician));
router.patch("/:id/status", auth, roleGuard("teknisi", "technician", "supervisor"), [body("status").notEmpty()], validate, asyncHandler(updateTaskStatus));
router.patch("/:id/progress", auth, roleGuard("teknisi", "technician", "supervisor"), [body("completion_percent").isInt({ min: 0, max: 100 })], validate, asyncHandler(updateTaskProgress));
router.get("/:id/history", auth, asyncHandler(getTaskHistory));

export default router;

