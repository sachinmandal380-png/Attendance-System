/**
 * DEVELOPMENT / DEMO SEED DATA ONLY.
 * These are fictional records for local testing - do not run in production.
 */
import { db, pool } from "./index";
import { students, teachers } from "./schema";

async function seed() {
  console.log("Seeding demo students and teachers (development data only)...");

  await db
    .insert(students)
    .values([
      { studentId: "STU001", fullName: "Rahul Kumar", mobileNumber: "9800000001", status: "ACTIVE" },
      { studentId: "STU002", fullName: "Amit Kumar", mobileNumber: "9800000002", status: "ACTIVE" },
    ])
    .onConflictDoNothing();

  await db
    .insert(teachers)
    .values([
      { teacherId: "TCH001", fullName: "Suresh Kumar", mobileNumber: "9800000101", status: "ACTIVE" },
      { teacherId: "TCH002", fullName: "Neha Sharma", mobileNumber: "9800000102", status: "ACTIVE" },
    ])
    .onConflictDoNothing();

  console.log("Seed complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
