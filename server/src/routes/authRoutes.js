import express from "express";
import { body } from "express-validator";
import { login, logout, me, refresh } from "../controllers/authController.js";
import { auth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.post("/login", authLimiter, [body("username").notEmpty(), body("password").isLength({ min: 6 })], validate, asyncHandler(login));
router.post("/refresh", authLimiter, asyncHandler(refresh));
router.post("/logout", auth, asyncHandler(logout));
router.get("/me", auth, asyncHandler(me));

export default router;
