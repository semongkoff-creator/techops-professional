import express from "express";
import { body, query } from "express-validator";
import { changeMyPassword, createMember, getUserById, listUsers, updateMyProfile, updateMyPushToken, uploadMyAvatar } from "../controllers/userController.js";
import { auth, roleGuard } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { uploadAvatar } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.get("/", auth, [query("role").optional().isIn(["staff", "atasan", "supervisor", "teknisi", "technician"])], validate, asyncHandler(listUsers));
router.post("/members", auth, roleGuard("supervisor", "atasan"), [
  body("name").notEmpty().isLength({ min: 2 }),
  body("username").notEmpty().isLength({ min: 3 }),
  body("email").optional({ nullable: true, checkFalsy: true }).isEmail(),
  body("phone_number").optional({ nullable: true, checkFalsy: true }).isString(),
  body("password").isString().isLength({ min: 6 }),
  body("role").optional().isIn(["teknisi", "technician", "staff"]),
], validate, asyncHandler(createMember));
router.get("/:id", auth, asyncHandler(getUserById));
router.patch("/me", auth, [body("name").notEmpty().isLength({ min: 2 }), body("avatar_url").optional().isString()], validate, asyncHandler(updateMyProfile));
router.patch("/me/push-token", auth, [body("push_token").optional({ nullable: true, checkFalsy: true }).isString()], validate, asyncHandler(updateMyPushToken));
router.patch("/me/password", auth, [body("current_password").isString().isLength({ min: 6 }), body("new_password").isString().isLength({ min: 6 })], validate, asyncHandler(changeMyPassword));
router.patch("/me/avatar", auth, uploadAvatar.single("avatar"), asyncHandler(uploadMyAvatar));

export default router;
