import { Router } from "express";
import { dashboardCounts, adminNotificationsList } from "../controllers/dashboardController";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAdmin } from "../middleware/auth";

const router = Router();
router.get("/", requireAdmin, asyncHandler(dashboardCounts));
router.get("/notifications", requireAdmin, asyncHandler(adminNotificationsList));
export default router;
