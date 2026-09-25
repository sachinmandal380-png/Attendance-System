import { Request, Response } from "express";
import { eq, count } from "drizzle-orm";
import { db } from "../db";
import { students, teachers } from "../db/schema";

export async function dashboardCounts(_req: Request, res: Response) {
  const [[activeStudents], [activeTeachers], [totalStudents], [totalTeachers]] = await Promise.all([
    db.select({ value: count() }).from(students).where(eq(students.status, "ACTIVE")),
    db.select({ value: count() }).from(teachers).where(eq(teachers.status, "ACTIVE")),
    db.select({ value: count() }).from(students),
    db.select({ value: count() }).from(teachers),
  ]);

  res.json({
    activeStudents: activeStudents.value,
    activeTeachers: activeTeachers.value,
    totalStudents: totalStudents.value,
    totalTeachers: totalTeachers.value,
  });
}
