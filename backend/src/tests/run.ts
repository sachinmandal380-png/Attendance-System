/**
 * Lightweight end-to-end test runner.
 *
 * Prerequisites: the server must be running (`npm run dev` or `npm start`)
 * against a migrated, seeded database, and an admin must already exist
 * (`npm run create-admin -- admin admin@example.com Password123!`).
 *
 * Usage:
 *   BASE_URL=http://localhost:4000 ADMIN_USER=admin ADMIN_PASS=Password123! npm test
 */

import { createServer } from "node:http";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { attendance, attendanceOverrides } from "../db/schema";
import { createApp } from "../app";
import { nowInTimezone } from "../utils/timezone";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4000";
const ADMIN_USER = process.env.ADMIN_USER ?? "admin";
const ADMIN_PASS = process.env.ADMIN_PASS ?? "Password123!";

let passed = 0;
let failed = 0;

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name} -> ${(err as Error).message}`);
    failed++;
  }
}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

async function api(path: string, options: RequestInit = {}, token?: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON response, e.g. CSV export */
  }
  return { status: res.status, body, res };
}

async function apiAt(baseUrl: string, path: string, options: RequestInit = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON response */
  }
  return { status: res.status, body, res };
}

async function main() {
  console.log(`Running against ${BASE_URL}\n`);
  let token = "";

  await check("1. Health check responds", async () => {
    const { status, body } = await api("/api/health");
    assert(status === 200 && body.status === "ok", "health endpoint not OK");
  });

  await check("2. Admin login succeeds", async () => {
    const { status, body } = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
    });
    assert(status === 200 && body.token, "login did not return a token");
    token = body.token;
  });

  await check("3. Login rejects wrong password", async () => {
    const { status } = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: ADMIN_USER, password: "wrong-password" }),
    });
    assert(status === 401, "expected 401 for wrong password");
  });

  await check("4. Protected route rejects missing token", async () => {
    const { status } = await api("/api/students");
    assert(status === 401, "expected 401 without token");
  });

  await check("5. Create student", async () => {
    const { status } = await api(
      "/api/students",
      { method: "POST", body: JSON.stringify({ studentId: "STU_TEST", fullName: "Test Student", mobileNumber: "9999999999" }) },
      token
    );
    assert(status === 201 || status === 409, "unexpected status creating student");
  });

  await check("6. Create teacher", async () => {
    const { status } = await api(
      "/api/teachers",
      { method: "POST", body: JSON.stringify({ teacherId: "TCH_TEST", fullName: "Test Teacher", mobileNumber: "9999999998" }) },
      token
    );
    assert(status === 201 || status === 409, "unexpected status creating teacher");
  });

  await check("7. Verify unknown ID returns 404", async () => {
    const { status, body } = await api("/api/attendance/verify", {
      method: "POST",
      body: JSON.stringify({ personType: "STUDENT", personId: "NO_SUCH_ID" }),
    });
    assert(status === 404 && /not found/i.test(body.error), "expected ID not found");
  });

  await check("8. Verify known active student succeeds", async () => {
    const { status, body } = await api("/api/attendance/verify", {
      method: "POST",
      body: JSON.stringify({ personType: "STUDENT", personId: "STU_TEST" }),
    });
    assert(status === 200 && body.fullName === "Test Student", "verify failed for known student");
  });

  await check("9. Mark IN for student succeeds", async () => {
    const { status, body } = await api("/api/attendance/mark", {
      method: "POST",
      body: JSON.stringify({ personType: "STUDENT", personId: "STU_TEST", attendanceType: "IN" }),
    });
    assert(status === 201 || status === 409, `unexpected status marking IN: ${status} ${JSON.stringify(body)}`);
  });

  await check("10. Duplicate IN is rejected", async () => {
    const { status, body } = await api("/api/attendance/mark", {
      method: "POST",
      body: JSON.stringify({ personType: "STUDENT", personId: "STU_TEST", attendanceType: "IN" }),
    });
    assert(status === 409 && /already been marked/i.test(body.error), "duplicate IN was not rejected");
  });

  await check("11. Mark OUT for student succeeds", async () => {
    const { status } = await api("/api/attendance/mark", {
      method: "POST",
      body: JSON.stringify({ personType: "STUDENT", personId: "STU_TEST", attendanceType: "OUT" }),
    });
    assert(status === 201 || status === 409, "unexpected status marking OUT");
  });

  await check("12. Duplicate OUT is rejected", async () => {
    const { status, body } = await api("/api/attendance/mark", {
      method: "POST",
      body: JSON.stringify({ personType: "STUDENT", personId: "STU_TEST", attendanceType: "OUT" }),
    });
    assert(status === 409 && /already been marked/i.test(body.error), "duplicate OUT was not rejected");
  });

  await check("13. Deactivate student then verify is rejected", async () => {
    await api("/api/students/STU_TEST", { method: "PUT", body: JSON.stringify({ status: "INACTIVE" }) }, token);
    const { status, body } = await api("/api/attendance/verify", {
      method: "POST",
      body: JSON.stringify({ personType: "STUDENT", personId: "STU_TEST" }),
    });
    assert(status === 403 && /inactive/i.test(body.error), "inactive student was not rejected");
    // reactivate for repeatable test runs
    await api("/api/students/STU_TEST", { method: "PUT", body: JSON.stringify({ status: "ACTIVE" }) }, token);
  });

  await check("14. Today's attendance summary is reachable", async () => {
    const { status, body } = await api("/api/attendance/today", {}, token);
    assert(status === 200 && typeof body.summary.total === "number", "today summary malformed");
  });

  await check("15. Reports endpoint returns records array", async () => {
    const { status, body } = await api("/api/reports/date-range", {}, token);
    assert(status === 200 && Array.isArray(body.records), "date-range report malformed");
  });

  await check("16. CSV export returns CSV content", async () => {
    const res = await fetch(`${BASE_URL}/api/reports/export-csv`, { headers: { Authorization: `Bearer ${token}` } });
    const text = await res.text();
    assert(res.status === 200 && text.startsWith('"Name"'), "CSV export malformed");
  });

  await check("17. QR config returns attendance URL", async () => {
    const { status, body } = await api("/api/qr/config", {}, token);
    assert(status === 200 && typeof body.attendanceUrl === "string", "QR config malformed");
  });

  await check("18. Rate limiting engages on public endpoint", async () => {
    let sawLimit = false;
    for (let i = 0; i < 15; i++) {
      const { status } = await api("/api/attendance/verify", {
        method: "POST",
        body: JSON.stringify({ personType: "STUDENT", personId: "NO_SUCH_ID" }),
      });
      if (status === 429) sawLimit = true;
    }
    assert(sawLimit, "expected a 429 within 15 rapid requests");
  });


  // 19-29 are deterministic slot/override regression tests. They deliberately
  // use the pure slot helpers for clock-boundary cases so tests never wait for
  // a real clock boundary. The admin override API tests use the live server but
  // do not depend on the public attendance rate limiter.
  const { getAttendanceSlotStatus } = await import("../utils/timezone");

  await check("19. Student inside 1-hour window accepted", async () => {
    const status = getAttendanceSlotStatus("15:00", "15:00:00");
    assert(status.allowed, "exact slot start must be allowed");
  });

  await check("20. Student before window blocked", async () => {
    const status = getAttendanceSlotStatus("15:00", "14:59:59");
    assert(!status.allowed, "time before slot start must be blocked");
  });

  await check("21. Student at/after window end blocked", async () => {
    const atEnd = getAttendanceSlotStatus("15:00", "16:00:00");
    const afterEnd = getAttendanceSlotStatus("15:00", "16:00:01");
    assert(!atEnd.allowed && !afterEnd.allowed, "slot end must be exclusive");
  });

  await check("22. Asia/Kolkata timezone enforcement", async () => {
    const tz = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
    const parts = Object.fromEntries(tz.formatToParts(new Date("2026-01-01T18:30:00Z")).map((p) => [p.type, p.value]));
    assert(parts.hour === "24" || parts.hour === "00", "expected IST midnight boundary");
    const status = getAttendanceSlotStatus("00:00", "00:00:00");
    assert(status.allowed, "IST-derived midnight time must be evaluated as 00:00");
  });

  await check("23. Admin Allow Today grants today's override", async () => {
    const create = await api("/api/students", {
      method: "POST",
      body: JSON.stringify({ studentId: "STU_SLOT_OVERRIDE", fullName: "Slot Override Student", mobileNumber: "9999999901", attendanceStartTime: "03:00" }),
    }, token);
    assert(create.status === 201 || create.status === 409, `unexpected create status: ${create.status}`);
    const granted = await api("/api/students/STU_SLOT_OVERRIDE/allow-today", {
      method: "POST", body: JSON.stringify({ reason: "Admin temporary attendance access" }),
    }, token);
    assert(granted.status === 200 && granted.body.override.overrideDate, "today override was not granted");
  });

  await check("24. Override allows attendance outside normal window", async () => {
    const status = getAttendanceSlotStatus("03:00", "15:00:00");
    assert(!status.allowed, "control condition must be outside the slot");
    const current = await api("/api/students/STU_SLOT_OVERRIDE/today-status", {}, token);
    assert(current.status === 200 && current.body.overrideGranted === true && current.body.currentlyAllowed === true, "today override did not permit attendance outside the normal window");
  });

  await check("25. Override only affects that student", async () => {
    const create = await api("/api/students", {
      method: "POST",
      body: JSON.stringify({ studentId: "STU_SLOT_OTHER", fullName: "Other Slot Student", mobileNumber: "9999999902", attendanceStartTime: "03:00" }),
    }, token);
    assert(create.status === 201 || create.status === 409, `unexpected create status: ${create.status}`);
    const a = await api("/api/students/STU_SLOT_OVERRIDE/today-status", {}, token);
    const b = await api("/api/students/STU_SLOT_OTHER/today-status", {}, token);
    assert(a.status === 200 && a.body.overrideGranted === true, "override missing for target student");
    assert(b.status === 200 && b.body.overrideGranted === false, "override leaked to another student");
  });

  await check("26. Override expires on next Asia/Kolkata date", async () => {
    const studentId = "STU_SLOT_EXPIRY";
    const create = await api("/api/students", {
      method: "POST",
      body: JSON.stringify({
        studentId,
        fullName: "Slot Expiry Student",
        mobileNumber: "9999999903",
        attendanceStartTime: "03:00",
      }),
    }, token);
    assert(create.status === 201 || create.status === 409, `unexpected create status: ${create.status}`);

    const { date: today } = nowInTimezone();
    const oldDate = new Date(`${today}T00:00:00Z`);
    oldDate.setUTCDate(oldDate.getUTCDate() - 1);
    const previousIstDate = oldDate.toISOString().slice(0, 10);

    // Make the test repeatable: remove only this dedicated test student's
    // override for the previous date, then insert a real stale override.
    await db.delete(attendanceOverrides).where(
      and(eq(attendanceOverrides.studentId, studentId), eq(attendanceOverrides.overrideDate, previousIstDate))
    );
    const [inserted] = await db.insert(attendanceOverrides).values({
      studentId,
      overrideDate: previousIstDate,
      grantedBy: "test-admin",
      reason: "Deterministic previous-date expiry regression test",
    }).returning();
    assert(inserted.overrideDate === previousIstDate, "failed to create the previous-date override fixture");
    assert(previousIstDate !== today, "fixture date must be different from today's Asia/Kolkata date");

    const status = await api(`/api/students/${studentId}/today-status`, {}, token);
    assert(status.status === 200, `today-status failed: ${status.status} ${JSON.stringify(status.body)}`);
    assert(status.body.today === today, "today-status did not use the server-derived Asia/Kolkata date");
    assert(status.body.overrideGranted === false, "a previous-date override was incorrectly treated as today's override");
    assert(status.body.currentlyAllowed === false, "student should remain blocked outside the configured slot without today's override");
  });

  await check("27. Inactive student remains blocked even with override", async () => {
    const updated = await api("/api/students/STU_SLOT_OVERRIDE", { method: "PUT", body: JSON.stringify({ status: "INACTIVE" }) }, token);
    assert(updated.status === 200, "could not deactivate override test student");
    const current = await api("/api/students/STU_SLOT_OVERRIDE/today-status", {}, token);
    assert(current.status === 200 && current.body.currentlyAllowed === false && current.body.overrideGranted === true, "inactive student was allowed despite override");
    await api("/api/students/STU_SLOT_OVERRIDE", { method: "PUT", body: JSON.stringify({ status: "ACTIVE" }) }, token);
  });

  async function withFreshPublicApi<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
    const server = createServer(createApp());
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      throw new Error("could not determine ephemeral test server address");
    }
    try {
      return await fn(`http://127.0.0.1:${address.port}`);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    }
  }

  await check("28. Duplicate IN/OUT rules still work", async () => {
    const studentId = "STU_DUPLICATE_REGRESSION";
    const create = await api("/api/students", {
      method: "POST",
      body: JSON.stringify({
        studentId,
        fullName: "Duplicate Regression Student",
        mobileNumber: "9999999904",
        attendanceStartTime: null,
      }),
    }, token);
    assert(create.status === 201 || create.status === 409, `unexpected create status: ${create.status}`);
    const active = await api(`/api/students/${studentId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "ACTIVE", attendanceStartTime: null }),
    }, token);
    assert(active.status === 200, `could not ensure dedicated student is active: ${active.status}`);

    // Clean only this dedicated student's attendance so repeated test runs
    // always start from a known state without touching existing test data.
    await db.delete(attendance).where(
      and(eq(attendance.personType, "STUDENT"), eq(attendance.personId, studentId))
    );

    await withFreshPublicApi(async (baseUrl) => {
      const in1 = await apiAt(baseUrl, "/api/attendance/mark", {
        method: "POST",
        body: JSON.stringify({ personType: "STUDENT", personId: studentId, attendanceType: "IN" }),
      });
      assert(in1.status === 201, `first IN should succeed: ${in1.status} ${JSON.stringify(in1.body)}`);

      const duplicateIn = await apiAt(baseUrl, "/api/attendance/mark", {
        method: "POST",
        body: JSON.stringify({ personType: "STUDENT", personId: studentId, attendanceType: "IN" }),
      });
      assert(duplicateIn.status === 409 && /already been marked/i.test(duplicateIn.body?.error ?? ""), "duplicate IN was not rejected");

      const out1 = await apiAt(baseUrl, "/api/attendance/mark", {
        method: "POST",
        body: JSON.stringify({ personType: "STUDENT", personId: studentId, attendanceType: "OUT" }),
      });
      assert(out1.status === 201, `first OUT should succeed: ${out1.status} ${JSON.stringify(out1.body)}`);

      const duplicateOut = await apiAt(baseUrl, "/api/attendance/mark", {
        method: "POST",
        body: JSON.stringify({ personType: "STUDENT", personId: studentId, attendanceType: "OUT" }),
      });
      assert(duplicateOut.status === 409 && /already been marked/i.test(duplicateOut.body?.error ?? ""), "duplicate OUT was not rejected");
    });
  });

  await check("29. Teacher attendance is unaffected by student timing feature", async () => {
    const teacherId = "TCH_TIMING_REGRESSION";
    const create = await api("/api/teachers", {
      method: "POST",
      body: JSON.stringify({ teacherId, fullName: "Teacher Timing Regression", mobileNumber: "9999999905" }),
    }, token);
    assert(create.status === 201 || create.status === 409, `unexpected teacher create status: ${create.status}`);
    const active = await api(`/api/teachers/${teacherId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "ACTIVE" }),
    }, token);
    assert(active.status === 200, `could not ensure dedicated teacher is active: ${active.status}`);

    await db.delete(attendance).where(
      and(eq(attendance.personType, "TEACHER"), eq(attendance.personId, teacherId))
    );

    await withFreshPublicApi(async (baseUrl) => {
      const verified = await apiAt(baseUrl, "/api/attendance/verify", {
        method: "POST",
        body: JSON.stringify({ personType: "TEACHER", personId: teacherId }),
      });
      assert(verified.status === 200 && verified.body.personType === "TEACHER" && verified.body.personId === teacherId,
        `teacher verify failed: ${verified.status} ${JSON.stringify(verified.body)}`);

      const marked = await apiAt(baseUrl, "/api/attendance/mark", {
        method: "POST",
        body: JSON.stringify({ personType: "TEACHER", personId: teacherId, attendanceType: "IN" }),
      });
      assert(marked.status === 201 && marked.body.record?.personType === "TEACHER",
        `teacher IN failed: ${marked.status} ${JSON.stringify(marked.body)}`);
    });
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Test run crashed:", err);
  process.exit(1);
});
