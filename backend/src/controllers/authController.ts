import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { admins } from "../db/schema";
import { loginSchema } from "../validators/schemas";
import { signAdminToken } from "../utils/jwt";
import { ApiError } from "../middleware/errorHandler";
import { writeAuditLog } from "../utils/audit";

export async function login(req: Request, res: Response) {
  const { username, password } = loginSchema.parse(req.body);

  const [admin] = await db.select().from(admins).where(eq(admins.username, username)).limit(1);

  if (!admin) {
    throw new ApiError(401, "Invalid username or password.");
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    throw new ApiError(401, "Invalid username or password.");
  }

  const token = signAdminToken({ adminId: admin.id, username: admin.username });

  await writeAuditLog({
    action: "ADMIN_LOGIN",
    entityType: "admin",
    entityId: admin.id,
    performedBy: admin.username,
  });

  res.json({
    token,
    admin: { id: admin.id, username: admin.username, email: admin.email },
  });
}

export async function me(req: Request, res: Response) {
  res.json({ admin: req.admin });
}
