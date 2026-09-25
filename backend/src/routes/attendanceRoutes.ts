import { Router } from "express";
import {
  verifyPerson,
  markAttendance,
  todayAttendance,
  listAttendance,
  createManualAttendance,
  correctAttendance,
  deleteAttendance,
} from "../controllers/attendanceController";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAdmin } from "../middleware/auth";
import { publicAttendanceLimiter } from "../middleware/rateLimit";

const router = Router();

// --- Public endpoints (called from attendance.html by anyone who scanned the QR) ---
router.post("/verify", publicAttendanceLimiter, asyncHandler(verifyPerson));
router.post("/mark", publicAttendanceLimiter, asyncHandler(markAttendance));

// --- Admin-only endpoints ---
router.get("/today", requireAdmin, asyncHandler(todayAttendance));
router.get("/", requireAdmin, asyncHandler(listAttendance));
router.post("/manual", requireAdmin, asyncHandler(createManualAttendance));
router.put("/:id", requireAdmin, asyncHandler(correctAttendance));
router.delete("/:id", requireAdmin, asyncHandler(deleteAttendance));

export default router;
