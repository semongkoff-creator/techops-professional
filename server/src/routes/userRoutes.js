import express from "express";
import { body, query } from "express-validator";
import { changeMyPassword, getUserById, listUsers, updateMyProfile, uploadMyAvatar } from "../controllers/userController.js";
import { auth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { uploadAvatar } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.get("/", auth, [query("role").optional().isIn(["staff", "atasan", "supervisor", "teknisi", "technician"])], validate, asyncHandler(listUsers));
router.get("/:id", auth, asyncHandler(getUserById));
router.patch("/me", auth, [body("name").notEmpty().isLength({ min: 2 }), body("avatar_url").optional().isString()], validate, asyncHandler(updateMyProfile));
router.patch("/me/password", auth, [body("current_password").isString().isLength({ min: 6 }), body("new_password").isString().isLength({ min: 6 })], validate, asyncHandler(changeMyPassword));
router.patch("/me/avatar", auth, uploadAvatar.single("avatar"), asyncHandler(uploadMyAvatar));

export default router;
