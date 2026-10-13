
import { Request, Response } from "express";
import { eq, and, gte, lte, ilike, desc, or, inArray } from "drizzle-orm";
import { db } from "../db";
import { attendance, students, teachers } from "../db/schema";
import { dateRangeSchema } from "../validators/schemas";
import { nowInTimezone } from "../utils/timezone";

type ReportQuery = ReturnType<typeof dateRangeSchema.parse>;
type AttendanceRow = typeof attendance.$inferSelect;

function noEmailMatchCondition() {
  return eq(attendance.personId, "__NO_EMAIL_MATCH__");
}

async function buildConditions(query: ReportQuery) {
  const conditions = [];

  if (query.fromDate) {
    conditions.push(gte(attendance.attendanceDate, query.fromDate));
  }

  if (query.toDate) {
    conditions.push(lte(attendance.attendanceDate, query.toDate));
  }

  if (query.personType) {
    conditions.push(eq(attendance.personType, query.personType));
  }

  if (query.attendanceType) {
    conditions.push(eq(attendance.attendanceType, query.attendanceType));
  }

  if (query.personId?.trim()) {
    conditions.push(eq(attendance.personId, query.personId.trim()));
  }

  if (query.name?.trim()) {
    conditions.push(ilike(attendance.personName, `%${query.name.trim()}%`));
  }

  if (query.email?.trim()) {
    const emailPattern = `%${query.email.trim()}%`;

    const [studentRows, teacherRows] = await Promise.all([
      query.personType === "TEACHER"
        ? Promise.resolve([])
        : db
            .select({ personId: students.studentId })
            .from(students)
            .where(ilike(students.email, emailPattern)),

      query.personType === "STUDENT"
        ? Promise.resolve([])
        : db
            .select({ personId: teachers.teacherId })
            .from(teachers)
            .where(ilike(teachers.email, emailPattern)),
    ]);

    const emailConditions = [];

    if (studentRows.length > 0) {
      emailConditions.push(
        and(
          eq(attendance.personType, "STUDENT"),
          inArray(
            attendance.personId,
            studentRows.map((row) => row.personId)
          )
        )
      );
    }

    if (teacherRows.length > 0) {
      emailConditions.push(
        and(
          eq(attendance.personType, "TEACHER"),
          inArray(
            attendance.personId,
            teacherRows.map((row) => row.personId)
          )
        )
      );
    }

    if (emailConditions.length > 0) {
      conditions.push(or(...emailConditions));
    } else {
      conditions.push(noEmailMatchCondition());
    }
  }

  return conditions.length ? and(...conditions) : undefined;
}

async function getReportRows(query: ReportQuery) {
  return db
    .select()
    .from(attendance)
    .where(await buildConditions(query))
    .orderBy(desc(attendance.attendanceDate), desc(attendance.attendanceTime));
}

export async function dailyReport(req: Request, res: Response) {
  const query = dateRangeSchema.parse(req.query);
  const { date } = nowInTimezone();
  const targetDate = query.fromDate ?? date;

  const conditions = await buildConditions(query);

  const rows = await db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.attendanceDate, targetDate),
        conditions
      )
    )
    .orderBy(desc(attendance.attendanceTime));

  res.json({ date: targetDate, records: rows });
}

export async function dateRangeReport(req: Request, res: Response) {
  const query = dateRangeSchema.parse(req.query);
  const rows = await getReportRows(query);
  const emailMap = await getEmailMap(rows);

  const records = rows.map((row) => ({
    ...row,
    email: emailMap.get(`${row.personType}:${row.personId}`) ?? "",
  }));

  res.json({ records });
}
async function getEmailMap(rows: AttendanceRow[]) {
  const emailMap = new Map<string, string>();

  const studentIds = [
    ...new Set(
      rows
        .filter((row) => row.personType === "STUDENT")
        .map((row) => row.personId)
    ),
  ];

  const teacherIds = [
    ...new Set(
      rows
        .filter((row) => row.personType === "TEACHER")
        .map((row) => row.personId)
    ),
  ];

  const [studentRows, teacherRows] = await Promise.all([
    studentIds.length
      ? db
          .select({ personId: students.studentId, email: students.email })
          .from(students)
          .where(inArray(students.studentId, studentIds))
      : Promise.resolve([]),

    teacherIds.length
      ? db
          .select({ personId: teachers.teacherId, email: teachers.email })
          .from(teachers)
          .where(inArray(teachers.teacherId, teacherIds))
      : Promise.resolve([]),
  ]);

  for (const row of studentRows) {
    emailMap.set(`STUDENT:${row.personId}`, row.email ?? "");
  }

  for (const row of teacherRows) {
    emailMap.set(`TEACHER:${row.personId}`, row.email ?? "");
  }

  return emailMap;
}

function toCsv(
  rows: AttendanceRow[],
  emailMap: Map<string, string>
): string {
  const header = [
    "Name",
    "ID",
    "Email",
    "Person Type",
    "Attendance Type",
    "Date",
    "Time",
  ];

  const escape = (value: unknown) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const lines = rows.map((row) =>
    [
      row.personName,
      row.personId,
      emailMap.get(`${row.personType}:${row.personId}`) ?? "",
      row.personType,
      row.attendanceType,
      row.attendanceDate,
      row.attendanceTime,
    ]
      .map(escape)
      .join(",")
  );

  return [header.map(escape).join(","), ...lines].join("\r\n");
}

export async function exportCsv(req: Request, res: Response) {
  const query = dateRangeSchema.parse(req.query);
  const rows = await getReportRows(query);
  const emailMap = await getEmailMap(rows);
  const csv = toCsv(rows, emailMap);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="attendance_export.csv"'
  );
  res.send("\uFEFF" + csv);
}
