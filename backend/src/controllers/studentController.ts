import { Request, Response } from "express";
import { eq, ilike, or, and, desc } from "drizzle-orm";
import { db } from "../db";
import { students } from "../db/schema";
import { createStudentSchema, updateStudentSchema, allowTodaySchema } from "../validators/schemas";
import { ApiError } from "../middleware/errorHandler";
import { writeAuditLog } from "../utils/audit";
import { nowInTimezone, formatTimeForDisplay, getAttendanceSlotStatus } from "../utils/timezone";
import { attendanceOverrides } from "../db/schema";

export async function listStudents(req: Request, res: Response) {
  const search = (req.query.search as string | undefined)?.trim();
  const status = req.query.status as string | undefined;

  const conditions = [];
  if (search) {
    conditions.push(
      or(ilike(students.fullName, `%${search}%`), ilike(students.studentId, `%${search}%`))
    );
  }
  if (status === "ACTIVE" || status === "INACTIVE") {
    conditions.push(eq(students.status, status));
  }

  const rows = await db
    .select()
    .from(students)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(students.createdAt));

  res.json({ students: rows });
}

export async function getStudent(req: Request, res: Response) {
  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.studentId, req.params.id))
    .limit(1);

  if (!student) throw new ApiError(404, "Student not found.");
  res.json({ student });
}

export async function createStudent(req: Request, res: Response) {
  const data = createStudentSchema.parse(req.body);

  const [existing] = await db
    .select()
    .from(students)
    .where(eq(students.studentId, data.studentId))
    .limit(1);
  if (existing) throw new ApiError(409, "A student with this ID already exists.");

  const [created] = await db
    .insert(students)
    .values({
      studentId: data.studentId,
      fullName: data.fullName,
      mobileNumber: data.mobileNumber,
      email: data.email,
      status: data.status ?? "ACTIVE",
      attendanceStartTime: data.attendanceStartTime ?? null,
    })
    .returning();

  await writeAuditLog({
    action: "STUDENT_CREATED",
    entityType: "student",
    entityId: created.studentId,
    performedBy: req.admin?.username,
    details: { fullName: created.fullName },
  });

  res.status(201).json({ student: created });
}

export async function updateStudent(req: Request, res: Response) {
  const data = updateStudentSchema.parse(req.body);

  const [existing] = await db
    .select()
    .from(students)
    .where(eq(students.studentId, req.params.id))
    .limit(1);
  if (!existing) throw new ApiError(404, "Student not found.");

  const [updated] = await db
    .update(students)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(students.studentId, req.params.id))
    .returning();

  await writeAuditLog({
    action: "STUDENT_UPDATED",
    entityType: "student",
    entityId: updated.studentId,
    performedBy: req.admin?.username,
    details: data,
  });

  res.json({ student: updated });
}

export async function allowStudentToday(req: Request, res: Response) {
  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.studentId, req.params.id))
    .limit(1);
  if (!student) throw new ApiError(404, "Student not found.");
  if (student.status !== "ACTIVE") throw new ApiError(403, "Inactive students cannot be granted an attendance override.");

  const { date } = nowInTimezone();
  const data = allowTodaySchema.parse(req.body ?? {});
  const reason = data.reason || null;

  const [override] = await db
    .insert(attendanceOverrides)
    .values({
      studentId: student.studentId,
      overrideDate: date,
      grantedBy: req.admin?.username ?? "unknown",
      reason,
    })
    .onConflictDoUpdate({
      target: [attendanceOverrides.studentId, attendanceOverrides.overrideDate],
      set: { grantedBy: req.admin?.username ?? "unknown", grantedAt: new Date(), reason },
    })
    .returning();

  await writeAuditLog({
    action: "STUDENT_ATTENDANCE_OVERRIDE_GRANTED",
    entityType: "student",
    entityId: student.studentId,
    performedBy: req.admin?.username,
    details: { studentId: student.studentId, date, reason },
  });

  res.json({ message: "Attendance timing override granted for today.", override });
}

export async function todayStudentStatus(req: Request, res: Response) {
  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.studentId, req.params.id))
    .limit(1);
  if (!student) throw new ApiError(404, "Student not found.");

  const now = nowInTimezone();
  const [override] = await db
    .select()
    .from(attendanceOverrides)
    .where(and(eq(attendanceOverrides.studentId, student.studentId), eq(attendanceOverrides.overrideDate, now.date)))
    .limit(1);
  const slot = getAttendanceSlotStatus(student.attendanceStartTime, now.time);
  const allowed = student.status === "ACTIVE" && (slot.allowed || !!override);

  res.json({
    student: { studentId: student.studentId, fullName: student.fullName, status: student.status },
    configuredStartTime: student.attendanceStartTime,
    windowStart: slot.startTime,
    windowEnd: slot.endTime,
    currentServerTime: now.time,
    currentServerTimeDisplay: formatTimeForDisplay(now.time),
    today: now.date,
    currentlyAllowed: allowed,
    timingBlocked: student.status !== "ACTIVE" ? false : slot.configured && !slot.allowed && !override,
    overrideGranted: !!override,
    overrideDate: override?.overrideDate ?? null,
  });
}

export async function deleteStudent(req: Request, res: Response) {
  const [existing] = await db
    .select()
    .from(students)
    .where(eq(students.studentId, req.params.id))
    .limit(1);
  if (!existing) throw new ApiError(404, "Student not found.");

  // Soft delete by archiving rather than a hard DELETE, so historical
  // attendance rows (which store a name snapshot, not a FK) stay meaningful.
  await db
    .update(students)
    .set({ status: "INACTIVE", updatedAt: new Date() })
    .where(eq(students.studentId, req.params.id));

  await writeAuditLog({
    action: "STUDENT_DELETED",
    entityType: "student",
    entityId: existing.studentId,
    performedBy: req.admin?.username,
  });

  res.json({ message: "Student archived (deactivated)." });
}
