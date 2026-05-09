import express from "express";
import { auth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { listNotifications, markAllRead, markRead } from "../controllers/notificationController.js";

const router = express.Router();

router.get("/", auth, asyncHandler(listNotifications));
router.patch("/read-all", auth, asyncHandler(markAllRead));
router.patch("/:id/read", auth, asyncHandler(markRead));

export default router;
