import { checkForgotOutAttendance } from "./attendanceReminderService";

const CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

let running = false;

export function startAttendanceReminderScheduler() {
  const runCheck = async () => {
    if (running) return;

    running = true;

    try {
      await checkForgotOutAttendance();
    } catch (error) {
      console.error("Attendance reminder check failed:", error);
    } finally {
      running = false;
    }
  };

  // Run once shortly after server startup.
  setTimeout(runCheck, 5000);

  // Then check every minute.
  setInterval(runCheck, CHECK_INTERVAL_MS);

  console.log("Attendance reminder scheduler started.");
}