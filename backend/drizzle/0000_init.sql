CREATE TYPE "status" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "person_type" AS ENUM ('STUDENT', 'TEACHER');
CREATE TYPE "attendance_type" AS ENUM ('IN', 'OUT');

CREATE TABLE "admins" (
  "id" SERIAL PRIMARY KEY,
  "username" VARCHAR(100) NOT NULL UNIQUE,
  "email" VARCHAR(255),
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "students" (
  "id" SERIAL PRIMARY KEY,
  "student_id" VARCHAR(50) NOT NULL UNIQUE,
  "full_name" VARCHAR(255) NOT NULL,
  "mobile_number" VARCHAR(20) NOT NULL,
  "email" VARCHAR(255),
  "status" "status" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "teachers" (
  "id" SERIAL PRIMARY KEY,
  "teacher_id" VARCHAR(50) NOT NULL UNIQUE,
  "full_name" VARCHAR(255) NOT NULL,
  "mobile_number" VARCHAR(20) NOT NULL,
  "email" VARCHAR(255),
  "status" "status" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "attendance" (
  "id" SERIAL PRIMARY KEY,
  "person_type" "person_type" NOT NULL,
  "person_id" VARCHAR(50) NOT NULL,
  "person_name" VARCHAR(255) NOT NULL,
  "attendance_type" "attendance_type" NOT NULL,
  "attendance_date" DATE NOT NULL,
  "attendance_time" TIME NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "corrected_by" VARCHAR(100),
  "corrected_at" TIMESTAMPTZ
);

CREATE UNIQUE INDEX "attendance_person_day_type_unique"
  ON "attendance" ("person_type", "person_id", "attendance_date", "attendance_type");

CREATE INDEX "attendance_person_date_idx"
  ON "attendance" ("person_type", "person_id", "attendance_date");

CREATE INDEX "attendance_date_idx" ON "attendance" ("attendance_date");

-- No FK to attendance.id on purpose: deleting an attendance row must never
-- cascade-delete its audit trail.
CREATE TABLE "audit_logs" (
  "id" SERIAL PRIMARY KEY,
  "action" VARCHAR(100) NOT NULL,
  "entity_type" VARCHAR(50) NOT NULL,
  "entity_id" VARCHAR(50),
  "performed_by" VARCHAR(100),
  "details" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" ("created_at");
