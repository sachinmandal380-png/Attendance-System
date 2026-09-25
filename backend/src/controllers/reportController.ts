import { Request, Response } from "express";
import { eq, and, gte, lte, ilike, desc } from "drizzle-orm";
import { db } from "../db";
import { attendance } from "../db/schema";
import { dateRangeSchema } from "../validators/schemas";
import { nowInTimezone } from "../utils/timezone";

function buildConditions(query: ReturnType<typeof dateRangeSchema.parse>) {
  const conditions = [];
  if (query.fromDate) conditions.push(gte(attendance.attendanceDate, query.fromDate));
  if (query.toDate) conditions.push(lte(attendance.attendanceDate, query.toDate));
  if (query.personType) conditions.push(eq(attendance.personType, query.personType));
  if (query.attendanceType) conditions.push(eq(attendance.attendanceType, query.attendanceType));
  if (query.personId) conditions.push(eq(attendance.personId, query.personId));
  if (query.name) conditions.push(ilike(attendance.personName, `%${query.name}%`));
  return conditions.length ? and(...conditions) : undefined;
}

export async function dailyReport(req: Request, res: Response) {
  const query = dateRangeSchema.parse(req.query);
  const { date } = nowInTimezone();
  const targetDate = query.fromDate ?? date;

  const rows = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.attendanceDate, targetDate), buildConditions(query) ?? undefined))
    .orderBy(desc(attendance.attendanceTime));

  res.json({ date: targetDate, records: rows });
}

export async function dateRangeReport(req: Request, res: Response) {
  const query = dateRangeSchema.parse(req.query);
  const rows = await db
    .select()
    .from(attendance)
    .where(buildConditions(query))
    .orderBy(desc(attendance.attendanceDate), desc(attendance.attendanceTime));

  res.json({ records: rows });
}

function toCsv(rows: (typeof attendance.$inferSelect)[]): string {
  const header = ["Name", "ID", "Person Type", "Attendance Type", "Date", "Time"];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.personName, r.personId, r.personType, r.attendanceType, r.attendanceDate, r.attendanceTime]
      .map((v) => escape(String(v)))
      .join(",")
  );
  return [header.map(escape).join(","), ...lines].join("\r\n");
}

export async function exportCsv(req: Request, res: Response) {
  const query = dateRangeSchema.parse(req.query);
  const rows = await db
    .select()
    .from(attendance)
    .where(buildConditions(query))
    .orderBy(desc(attendance.attendanceDate), desc(attendance.attendanceTime));

  const csv = toCsv(rows);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="attendance_export.csv"`);
  res.send(csv);
}
