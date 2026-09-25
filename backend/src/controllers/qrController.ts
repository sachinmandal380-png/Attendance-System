import { Request, Response } from "express";
import { env } from "../config/env";

export function qrConfig(_req: Request, res: Response) {
  res.json({ attendanceUrl: env.publicAttendanceUrl });
}
