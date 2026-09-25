import { Router } from "express";
import {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  allowStudentToday,
  todayStudentStatus,
} from "../controllers/studentController";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAdmin } from "../middleware/auth";

const router = Router();
router.use(requireAdmin);

router.get("/", asyncHandler(listStudents));
router.post("/", asyncHandler(createStudent));
router.get("/:id", asyncHandler(getStudent));
router.put("/:id", asyncHandler(updateStudent));
router.post("/:id/allow-today", asyncHandler(allowStudentToday));
router.get("/:id/today-status", asyncHandler(todayStudentStatus));
router.delete("/:id", asyncHandler(deleteStudent));

export default router;
