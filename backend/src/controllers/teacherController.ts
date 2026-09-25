import { Request, Response } from "express";
import { eq, ilike, or, and, desc } from "drizzle-orm";
import { db } from "../db";
import { teachers } from "../db/schema";
import { createTeacherSchema, updateTeacherSchema } from "../validators/schemas";
import { ApiError } from "../middleware/errorHandler";
import { writeAuditLog } from "../utils/audit";

export async function listTeachers(req: Request, res: Response) {
  const search = (req.query.search as string | undefined)?.trim();
  const status = req.query.status as string | undefined;

  const conditions = [];
  if (search) {
    conditions.push(
      or(ilike(teachers.fullName, `%${search}%`), ilike(teachers.teacherId, `%${search}%`))
    );
  }
  if (status === "ACTIVE" || status === "INACTIVE") {
    conditions.push(eq(teachers.status, status));
  }

  const rows = await db
    .select()
    .from(teachers)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(teachers.createdAt));

  res.json({ teachers: rows });
}

export async function getTeacher(req: Request, res: Response) {
  const [teacher] = await db
    .select()
    .from(teachers)
    .where(eq(teachers.teacherId, req.params.id))
    .limit(1);

  if (!teacher) throw new ApiError(404, "Teacher not found.");
  res.json({ teacher });
}

export async function createTeacher(req: Request, res: Response) {
  const data = createTeacherSchema.parse(req.body);

  const [existing] = await db
    .select()
    .from(teachers)
    .where(eq(teachers.teacherId, data.teacherId))
    .limit(1);
  if (existing) throw new ApiError(409, "A teacher with this ID already exists.");

  const [created] = await db
    .insert(teachers)
    .values({
      teacherId: data.teacherId,
      fullName: data.fullName,
      mobileNumber: data.mobileNumber,
      email: data.email,
      status: data.status ?? "ACTIVE",
    })
    .returning();

  await writeAuditLog({
    action: "TEACHER_CREATED",
    entityType: "teacher",
    entityId: created.teacherId,
    performedBy: req.admin?.username,
    details: { fullName: created.fullName },
  });

  res.status(201).json({ teacher: created });
}

export async function updateTeacher(req: Request, res: Response) {
  const data = updateTeacherSchema.parse(req.body);

  const [existing] = await db
    .select()
    .from(teachers)
    .where(eq(teachers.teacherId, req.params.id))
    .limit(1);
  if (!existing) throw new ApiError(404, "Teacher not found.");

  const [updated] = await db
    .update(teachers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(teachers.teacherId, req.params.id))
    .returning();

  await writeAuditLog({
    action: "TEACHER_UPDATED",
    entityType: "teacher",
    entityId: updated.teacherId,
    performedBy: req.admin?.username,
    details: data,
  });

  res.json({ teacher: updated });
}

export async function deleteTeacher(req: Request, res: Response) {
  const [existing] = await db
    .select()
    .from(teachers)
    .where(eq(teachers.teacherId, req.params.id))
    .limit(1);
  if (!existing) throw new ApiError(404, "Teacher not found.");

  await db
    .update(teachers)
    .set({ status: "INACTIVE", updatedAt: new Date() })
    .where(eq(teachers.teacherId, req.params.id));

  await writeAuditLog({
    action: "TEACHER_DELETED",
    entityType: "teacher",
    entityId: existing.teacherId,
    performedBy: req.admin?.username,
  });

  res.json({ message: "Teacher archived (deactivated)." });
}
