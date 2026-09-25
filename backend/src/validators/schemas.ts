import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});

const attendanceStartTimeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Attendance start time must be HH:MM or HH:MM:SS.")
  .refine((value: string) => {
    const parts = value.split(":").map(Number);
    const h = parts[0];
    const m = parts[1];
    const sec = parts.length === 3 ? parts[2] : 0;
    return h >= 0 && h <= 23 && m >= 0 && m <= 59 && sec >= 0 && sec <= 59;
  }, "Attendance start time is invalid.");

const personBase = {
  fullName: z.string().min(2, "Full name is required."),
  mobileNumber: z.string().min(6, "A valid mobile number is required."),
  email: z.string().email().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
};

export const createStudentSchema = z.object({
  studentId: z.string().min(1, "Student ID is required."),
  ...personBase,
  attendanceStartTime: attendanceStartTimeSchema.nullable().optional(),
});
export const updateStudentSchema = z.object({
  ...personBase,
  attendanceStartTime: attendanceStartTimeSchema.nullable().optional(),
}).partial();

export const createTeacherSchema = z.object({
  teacherId: z.string().min(1, "Teacher ID is required."),
  ...personBase,
});
export const updateTeacherSchema = z.object(personBase).partial();

export const verifyAttendanceSchema = z.object({
  personType: z.enum(["STUDENT", "TEACHER"]),
  personId: z.string().min(1, "ID is required."),
});

export const markAttendanceSchema = z.object({
  personType: z.enum(["STUDENT", "TEACHER"]),
  personId: z.string().min(1, "ID is required."),
  attendanceType: z.enum(["IN", "OUT"]),
});

export const correctAttendanceSchema = z.object({
  attendanceType: z.enum(["IN", "OUT"]).optional(),
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  attendanceTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
});

export const manualAttendanceSchema = z.object({
  personType: z.enum(["STUDENT", "TEACHER"]),
  personId: z.string().min(1),
  attendanceType: z.enum(["IN", "OUT"]),
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attendanceTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

export const allowTodaySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const dateRangeSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  personType: z.enum(["STUDENT", "TEACHER"]).optional(),
  attendanceType: z.enum(["IN", "OUT"]).optional(),
  name: z.string().optional(),
  personId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});
