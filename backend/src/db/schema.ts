import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  date,
  time,
  pgEnum,
  uniqueIndex,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

export const statusEnum = pgEnum("status", ["ACTIVE", "INACTIVE"]);
export const personTypeEnum = pgEnum("person_type", ["STUDENT", "TEACHER"]);
export const attendanceTypeEnum = pgEnum("attendance_type", ["IN", "OUT"]);

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  email: varchar("email", { length: 255 }),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  studentId: varchar("student_id", { length: 50 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  mobileNumber: varchar("mobile_number", { length: 20 }).notNull(),
  email: varchar("email", { length: 255 }),
  status: statusEnum("status").notNull().default("ACTIVE"),
  attendanceStartTime: time("attendance_start_time"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const teachers = pgTable("teachers", {
  id: serial("id").primaryKey(),
  teacherId: varchar("teacher_id", { length: 50 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  mobileNumber: varchar("mobile_number", { length: 20 }).notNull(),
  email: varchar("email", { length: 255 }),
  status: statusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const attendance = pgTable(
  "attendance",
  {
    id: serial("id").primaryKey(),
    personType: personTypeEnum("person_type").notNull(),
    personId: varchar("person_id", { length: 50 }).notNull(),
    personName: varchar("person_name", { length: 255 }).notNull(),
    attendanceType: attendanceTypeEnum("attendance_type").notNull(),
    attendanceDate: date("attendance_date").notNull(),
    attendanceTime: time("attendance_time").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    correctedBy: varchar("corrected_by", { length: 100 }),
    correctedAt: timestamp("corrected_at", { withTimezone: true }),
  },
  (table) => ({
    // One IN and one OUT per person per day - enforced at the DB level.
    uniquePersonDayType: uniqueIndex("attendance_person_day_type_unique").on(
      table.personType,
      table.personId,
      table.attendanceDate,
      table.attendanceType
    ),
    personDateIdx: index("attendance_person_date_idx").on(
      table.personType,
      table.personId,
      table.attendanceDate
    ),
    dateIdx: index("attendance_date_idx").on(table.attendanceDate),
  })
);

export const attendanceOverrides = pgTable(
  "attendance_overrides",
  {
    id: serial("id").primaryKey(),
    studentId: varchar("student_id", { length: 50 }).notNull(),
    overrideDate: date("override_date").notNull(),
    grantedBy: varchar("granted_by", { length: 100 }).notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
    reason: text("reason"),
  },
  (table) => ({
    studentDateUnique: uniqueIndex("attendance_overrides_student_date_unique").on(
      table.studentId,
      table.overrideDate
    ),
    studentDateIdx: index("attendance_overrides_student_date_idx").on(
      table.studentId,
      table.overrideDate
    ),
  })
);

// No foreign key to `attendance` on purpose: deleting an attendance record
// must never cascade-delete its audit trail.
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: varchar("entity_id", { length: 50 }),
    performedBy: varchar("performed_by", { length: 100 }),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  })
);
