import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { adminNotifications, attendance, students } from "../db/schema";
import { env } from "../config/env";

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;

  return `${String(hour12).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )} ${period}`;
}

function addOneHour(time: string): string {
  const total = toMinutes(time) + 60;
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
}

export async function checkForgotOutAttendance() {
  const now = new Date();

  const currentDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: env.timezone,
  }).format(now);

  const currentTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: env.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  const currentMinutes = toMinutes(currentTime);

  const activeStudents = await db
    .select()
    .from(students)
    .where(eq(students.status, "ACTIVE"));

  for (const student of activeStudents) {
    if (!student.attendanceStartTime) continue;

    const expectedOutTime = addOneHour(student.attendanceStartTime);

    if (currentMinutes < toMinutes(expectedOutTime)) continue;

    const todaysIn = await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.personType, "STUDENT"),
          eq(attendance.personId, student.studentId),
          eq(attendance.attendanceDate, currentDate),
          eq(attendance.attendanceType, "IN")
        )
      );

    if (todaysIn.length === 0) continue;

    const todaysOut = await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.personType, "STUDENT"),
          eq(attendance.personId, student.studentId),
          eq(attendance.attendanceDate, currentDate),
          eq(attendance.attendanceType, "OUT")
        )
      );

    if (todaysOut.length > 0) continue;

    const existingNotification = await db
      .select()
      .from(adminNotifications)
      .where(
        and(
          eq(adminNotifications.personType, "STUDENT"),
          eq(adminNotifications.personId, student.studentId),
          eq(adminNotifications.attendanceDate, currentDate),
          isNull(adminNotifications.resolvedAt)
        )
      );

    if (existingNotification.length > 0) continue;

    const inRecord = todaysIn[0];

    const message =
      `${student.fullName} (${student.studentId}) marked IN at ` +
      `${formatTime12Hour(inRecord.attendanceTime)}, ` +
      `but has not marked OUT by ${formatTime12Hour(expectedOutTime)}.`;

    await db
      .insert(adminNotifications)
      .values({
        personType: "STUDENT",
        personId: student.studentId,
        personName: student.fullName,
        attendanceDate: currentDate,
        inTime: inRecord.attendanceTime,
        expectedOutTime,
        message,
      })
      .returning()
    }
}
