import express from "express";
import { body } from "express-validator";
import {
  assignTechnician,
  createTask,
  deleteTask,
  getTaskById,
  getTaskHistory,
  listTasks,
  updateTask,
  updateTaskProgress,
  updateTaskStatus,
} from "../controllers/taskController.js";
import { auth, roleGuard } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.post(
  "/",
  auth,
  roleGuard("staff", "atasan", "supervisor", "teknisi", "technician"),
  [body("title").notEmpty(), body("description").notEmpty(), body("customer").optional().isString(), body("location").notEmpty(), body("priority").isIn(["low", "medium", "high"]), body("supervisor_id").optional().isInt(), body("staff_id").optional().isInt(), body("technician_id").optional().isInt(), body("completion_percent").optional().isInt({ min: 0, max: 100 })],
  validate,
  asyncHandler(createTask),
);
router.get("/", auth, asyncHandler(listTasks));
router.get("/:id", auth, asyncHandler(getTaskById));
router.patch("/:id", auth, [body("title").optional().notEmpty(), body("description").optional().notEmpty(), body("customer").optional().isString(), body("location").optional().notEmpty(), body("priority").optional().isIn(["low", "medium", "high"]), body("supervisor_id").optional().isInt(), body("technician_id").optional().isInt(), body("completion_percent").optional().isInt({ min: 0, max: 100 })], validate, asyncHandler(updateTask));
router.delete("/:id", auth, asyncHandler(deleteTask));
router.patch("/:id/assign-technician", auth, roleGuard("supervisor", "staff", "atasan"), [body("technician_id").isInt(), body("note").optional().isString()], validate, asyncHandler(assignTechnician));
router.patch("/:id/status", auth, roleGuard("teknisi", "technician", "supervisor"), [body("status").notEmpty()], validate, asyncHandler(updateTaskStatus));
router.patch("/:id/progress", auth, roleGuard("teknisi", "technician", "supervisor"), [body("completion_percent").isInt({ min: 0, max: 100 })], validate, asyncHandler(updateTaskProgress));
router.get("/:id/history", auth, asyncHandler(getTaskHistory));

export default router;

