import { Request, Response } from "express";
import { eq, count, desc, and, sql } from "drizzle-orm";
import { db } from "../db";
import {
  students,
  teachers,
  attendance,
  adminNotifications as adminNotificationsTable,
} from "../db/schema";

export async function dashboardCounts(_req: Request, res: Response) {
  const [
    [activeStudents],
    [activeTeachers],
    [totalStudents],
    [totalTeachers],
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(students)
      .where(eq(students.status, "ACTIVE")),
    db
      .select({ value: count() })
      .from(teachers)
      .where(eq(teachers.status, "ACTIVE")),
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

export async function adminNotificationsList(_req: Request, res: Response) {
  const notifications = await db
    .select({
      id: adminNotificationsTable.id,
      personType: adminNotificationsTable.personType,
      personId: adminNotificationsTable.personId,
      personName: adminNotificationsTable.personName,
      attendanceDate: adminNotificationsTable.attendanceDate,
      inTime: adminNotificationsTable.inTime,
      expectedOutTime: adminNotificationsTable.expectedOutTime,
      message: adminNotificationsTable.message,
      status: adminNotificationsTable.status,
      createdAt: adminNotificationsTable.createdAt,
      resolvedAt: adminNotificationsTable.resolvedAt,
      actualOutTime: attendance.attendanceTime,
    })
    .from(adminNotificationsTable)
    .leftJoin(
      attendance,
      and(
        sql`${attendance.personType}::text = ${adminNotificationsTable.personType}`,
        eq(attendance.personId, adminNotificationsTable.personId),
        eq(attendance.attendanceDate, adminNotificationsTable.attendanceDate),
        eq(attendance.attendanceType, "OUT")
      )
    )
    .orderBy(desc(adminNotificationsTable.createdAt));

  res.json({
    notifications,
    count: notifications.filter((n) => n.status === "UNREAD").length,
  });
}