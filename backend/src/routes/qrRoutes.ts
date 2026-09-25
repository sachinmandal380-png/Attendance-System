import { Router } from "express";
import { qrConfig } from "../controllers/qrController";
import { requireAdmin } from "../middleware/auth";

const router = Router();
router.get("/config", requireAdmin, qrConfig);

export default router;
