import { Router } from "express";
import { dailyReport, dateRangeReport, exportCsv } from "../controllers/reportController";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAdmin } from "../middleware/auth";

const router = Router();
router.use(requireAdmin);

router.get("/daily", asyncHandler(dailyReport));
router.get("/date-range", asyncHandler(dateRangeReport));
router.get("/export-csv", asyncHandler(exportCsv));

export default router;
