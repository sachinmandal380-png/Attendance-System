-- Additive migration: admin notifications for missing OUT attendance.

CREATE TABLE IF NOT EXISTS "admin_notifications" (
  "id" SERIAL PRIMARY KEY,
  "person_type" VARCHAR(20) NOT NULL,
  "person_id" VARCHAR(50) NOT NULL,
  "person_name" VARCHAR(150) NOT NULL,
  "attendance_date" DATE NOT NULL,
  "in_time" TIME NOT NULL,
  "expected_out_time" TIME NOT NULL,
  "message" TEXT NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'UNREAD',
  "email_sent_at" TIMESTAMPTZ NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "resolved_at" TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_notifications_person_date_unique"
  ON "admin_notifications" ("person_type", "person_id", "attendance_date");

CREATE INDEX IF NOT EXISTS "admin_notifications_status_idx"
  ON "admin_notifications" ("status");

CREATE INDEX IF NOT EXISTS "admin_notifications_date_idx"
  ON "admin_notifications" ("attendance_date");