import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";

import authRoutes from "./routes/authRoutes";
import studentRoutes from "./routes/studentRoutes";
import teacherRoutes from "./routes/teacherRoutes";
import attendanceRoutes from "./routes/attendanceRoutes";
import reportRoutes from "./routes/reportRoutes";
import qrRoutes from "./routes/qrRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins.length ? env.corsOrigins : false,
      credentials: true,
    })
  );
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

  app.use("/api/auth", authRoutes);
  app.use("/api/students", studentRoutes);
  app.use("/api/teachers", teacherRoutes);
  app.use("/api/attendance", attendanceRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/qr", qrRoutes);
  app.use("/api/dashboard", dashboardRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
