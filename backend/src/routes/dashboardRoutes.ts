import { Router } from "express";
import { dashboardCounts } from "../controllers/dashboardController";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAdmin } from "../middleware/auth";

const router = Router();
router.get("/", requireAdmin, asyncHandler(dashboardCounts));

export default router;
