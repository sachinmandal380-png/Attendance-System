import { Router } from "express";
import {
  listTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  deleteTeacher,
} from "../controllers/teacherController";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAdmin } from "../middleware/auth";

const router = Router();
router.use(requireAdmin);

router.get("/", asyncHandler(listTeachers));
router.post("/", asyncHandler(createTeacher));
router.get("/:id", asyncHandler(getTeacher));
router.put("/:id", asyncHandler(updateTeacher));
router.delete("/:id", asyncHandler(deleteTeacher));

export default router;
