-- Additive migration: fixed daily student attendance slots + one-day admin overrides.
ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "attendance_start_time" TIME NULL;

CREATE TABLE IF NOT EXISTS "attendance_overrides" (
  "id" SERIAL PRIMARY KEY,
  "student_id" VARCHAR(50) NOT NULL,
  "override_date" DATE NOT NULL,
  "granted_by" VARCHAR(100) NOT NULL,
  "granted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "reason" TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_overrides_student_date_unique"
  ON "attendance_overrides" ("student_id", "override_date");

CREATE INDEX IF NOT EXISTS "attendance_overrides_student_date_idx"
  ON "attendance_overrides" ("student_id", "override_date");
