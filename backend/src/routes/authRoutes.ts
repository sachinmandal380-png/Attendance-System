import { Router } from "express";
import { login, me } from "../controllers/authController";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAdmin } from "../middleware/auth";
import { loginLimiter } from "../middleware/rateLimit";

const router = Router();

router.post("/login", loginLimiter, asyncHandler(login));
router.get("/me", requireAdmin, asyncHandler(me));

export default router;
