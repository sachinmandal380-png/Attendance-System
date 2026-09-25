import { Request, Response } from "express";
import { eq, and, desc, ilike, gte, lte, count } from "drizzle-orm";
import { db } from "../db";
import { students, teachers, attendance } from "../db/schema";
import {
  verifyAttendanceSchema,
  markAttendanceSchema,
  correctAttendanceSchema,
  manualAttendanceSchema,
  dateRangeSchema,
} from "../validators/schemas";
import { ApiError } from "../middleware/errorHandler";
import { nowInTimezone, formatTimeForDisplay, formatDateForDisplay } from "../utils/timezone";
import { writeAuditLog } from "../utils/audit";
import { attendanceOverrides } from "../db/schema";
import { getAttendanceSlotStatus } from "../utils/timezone";

async function findPerson(personType: "STUDENT" | "TEACHER", personId: string) {
  if (personType === "STUDENT") {
    const [row] = await db.select().from(students).where(eq(students.studentId, personId)).limit(1);
    return row
      ? { id: row.studentId, name: row.fullName, status: row.status, attendanceStartTime: row.attendanceStartTime }
      : null;
  }
  const [row] = await db.select().from(teachers).where(eq(teachers.teacherId, personId)).limit(1);
  return row ? { id: row.teacherId, name: row.fullName, status: row.status, attendanceStartTime: null } : null;
}

async function getStudentTimingState(personId: string) {
  const now = nowInTimezone();
  const [override] = await db
    .select()
    .from(attendanceOverrides)
    .where(and(eq(attendanceOverrides.studentId, personId), eq(attendanceOverrides.overrideDate, now.date)))
    .limit(1);
  return { now, override: !!override };
}

function timingError(startTime: string | null, currentTime: string) {
  const slot = getAttendanceSlotStatus(startTime, currentTime);
  if (slot.allowed || !slot.configured) return null;
  const start = formatTimeForDisplay(slot.startTime!);
  const end = formatTimeForDisplay(slot.endTime!);
  return new ApiError(403, `Attendance is currently blocked. Allowed window: ${start} – ${end}.`);
}


export async function verifyPerson(req: Request, res: Response) {
  const { personType, personId } = verifyAttendanceSchema.parse(req.body);

  const person = await findPerson(personType, personId);
  if (!person) throw new ApiError(404, "ID not found.");
  if (person.status !== "ACTIVE") {
    throw new ApiError(403, "This account is inactive. Please contact the administrator.");
  }

  let timing: ReturnType<typeof getAttendanceSlotStatus> | null = null;
  let overrideGranted = false;
  if (personType === "STUDENT") {
    const timingState = await getStudentTimingState(person.id);
    timing = getAttendanceSlotStatus(person.attendanceStartTime, timingState.now.time);
    overrideGranted = timingState.override;
    if (!overrideGranted) {
      const err = timingError(person.attendanceStartTime, timingState.now.time);
      if (err) throw err;
    }
  }

  res.json({
    personId: person.id,
    fullName: person.name,
    personType,
    ...(personType === "STUDENT" && timing
      ? {
          attendanceStartTime: person.attendanceStartTime,
          windowStart: timing.startTime,
          windowEnd: timing.endTime,
        }
      : {}),
  });
}

export async function markAttendance(req: Request, res: Response) {
  const { personType, personId, attendanceType } = markAttendanceSchema.parse(req.body);

  const person = await findPerson(personType, personId);
  if (!person) throw new ApiError(404, "ID not found.");
  if (person.status !== "ACTIVE") {
    throw new ApiError(403, "This account is inactive. Please contact the administrator.");
  }

  const { date, time } = nowInTimezone();

  if (personType === "STUDENT") {
    const [override] = await db
      .select()
      .from(attendanceOverrides)
      .where(and(eq(attendanceOverrides.studentId, person.id), eq(attendanceOverrides.overrideDate, date)))
      .limit(1);
    if (!override) {
      const err = timingError(person.attendanceStartTime, time);
      if (err) throw err;
    }
  }

  // Has this type already been marked today? Check first for a friendly
  // message; the unique index below is the real guarantee against races.
  const [existingSameType] = await db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.personType, personType),
        eq(attendance.personId, personId),
        eq(attendance.attendanceDate, date),
        eq(attendance.attendanceType, attendanceType)
      )
    )
    .limit(1);

  if (existingSameType) {
    throw new ApiError(
      409,
      `${attendanceType} attendance has already been marked today at ${formatTimeForDisplay(
        existingSameType.attendanceTime
      )}.`
    );
  }

  if (attendanceType === "OUT") {
    const [inRecord] = await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.personType, personType),
          eq(attendance.personId, personId),
          eq(attendance.attendanceDate, date),
          eq(attendance.attendanceType, "IN")
        )
      )
      .limit(1);
    if (!inRecord) {
      throw new ApiError(400, "IN attendance must be marked before OUT.");
    }
  }

  let created;
  try {
    [created] = await db
      .insert(attendance)
      .values({
        personType,
        personId: person.id,
        personName: person.name,
        attendanceType,
        attendanceDate: date,
        attendanceTime: time,
      })
      .returning();
  } catch (err: any) {
    // Unique constraint violation - a race between two near-simultaneous
    // requests. Treat it the same as the friendly duplicate message.
    if (err?.code === "23505") {
      throw new ApiError(409, `${attendanceType} attendance has already been marked today.`);
    }
    throw err;
  }

  res.status(201).json({
    message: "Attendance marked successfully",
    record: {
      personId: created.personId,
      fullName: created.personName,
      personType: created.personType,
      attendanceType: created.attendanceType,
      date: created.attendanceDate,
      dateDisplay: formatDateForDisplay(created.attendanceDate),
      time: created.attendanceTime,
      timeDisplay: formatTimeForDisplay(created.attendanceTime),
    },
  });
}

export async function todayAttendance(_req: Request, res: Response) {
  const { date } = nowInTimezone();
  const rows = await db.select().from(attendance).where(eq(attendance.attendanceDate, date));

  const summary = {
    total: rows.length,
    studentIn: rows.filter((r) => r.personType === "STUDENT" && r.attendanceType === "IN").length,
    studentOut: rows.filter((r) => r.personType === "STUDENT" && r.attendanceType === "OUT").length,
    teacherIn: rows.filter((r) => r.personType === "TEACHER" && r.attendanceType === "IN").length,
    teacherOut: rows.filter((r) => r.personType === "TEACHER" && r.attendanceType === "OUT").length,
  };

  const recent = [...rows]
    .sort((a, b) => (a.attendanceTime < b.attendanceTime ? 1 : -1))
    .slice(0, 20);

  res.json({ date, summary, recent });
}

export async function listAttendance(req: Request, res: Response) {
  const query = dateRangeSchema.parse(req.query);
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;

  const conditions = [];
  if (query.fromDate) conditions.push(gte(attendance.attendanceDate, query.fromDate));
  if (query.toDate) conditions.push(lte(attendance.attendanceDate, query.toDate));
  if (query.personType) conditions.push(eq(attendance.personType, query.personType));
  if (query.attendanceType) conditions.push(eq(attendance.attendanceType, query.attendanceType));
  if (query.personId) conditions.push(eq(attendance.personId, query.personId));
  if (query.name) conditions.push(ilike(attendance.personName, `%${query.name}%`));

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(attendance)
    .where(whereClause);

  const rows = await db
    .select()
    .from(attendance)
    .where(whereClause)
    .orderBy(desc(attendance.attendanceDate), desc(attendance.attendanceTime))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  res.json({ records: rows, pagination: { page, pageSize, total } });
}

export async function createManualAttendance(req: Request, res: Response) {
  const data = manualAttendanceSchema.parse(req.body);
  const person = await findPerson(data.personType, data.personId);
  if (!person) throw new ApiError(404, "ID not found.");

  const [created] = await db
    .insert(attendance)
    .values({
      personType: data.personType,
      personId: person.id,
      personName: person.name,
      attendanceType: data.attendanceType,
      attendanceDate: data.attendanceDate,
      attendanceTime: data.attendanceTime,
      correctedBy: req.admin?.username,
      correctedAt: new Date(),
    })
    .returning();

  await writeAuditLog({
    action: "ATTENDANCE_MANUAL_ADD",
    entityType: "attendance",
    entityId: created.id,
    performedBy: req.admin?.username,
    details: data,
  });

  res.status(201).json({ record: created });
}

export async function correctAttendance(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10);
  const data = correctAttendanceSchema.parse(req.body);

  const [existing] = await db.select().from(attendance).where(eq(attendance.id, id)).limit(1);
  if (!existing) throw new ApiError(404, "Attendance record not found.");

  const [updated] = await db
    .update(attendance)
    .set({
      ...data,
      correctedBy: req.admin?.username,
      correctedAt: new Date(),
    })
    .where(eq(attendance.id, id))
    .returning();

  await writeAuditLog({
    action: "ATTENDANCE_CORRECTED",
    entityType: "attendance",
    entityId: id,
    performedBy: req.admin?.username,
    details: { before: existing, changes: data },
  });

  res.json({ record: updated });
}

export async function deleteAttendance(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(attendance).where(eq(attendance.id, id)).limit(1);
  if (!existing) throw new ApiError(404, "Attendance record not found.");

  await db.delete(attendance).where(eq(attendance.id, id));

  // The audit log row is independent of the attendance row (no FK), so it
  // survives this delete and keeps a full snapshot of what was removed.
  await writeAuditLog({
    action: "ATTENDANCE_DELETED",
    entityType: "attendance",
    entityId: id,
    performedBy: req.admin?.username,
    details: existing,
  });

  res.json({ message: "Attendance record deleted." });
}
