import { env } from "../config/env";

/**
 * The single source of truth for "now" in this application.
 * Every attendance record's date/time is derived from this - never from a
 * client-supplied timestamp.
 */
function getPartsInZone(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: env.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  return parts;
}

export function nowInTimezone() {
  const parts = getPartsInZone(new Date());
  // "24:00:00" edge case from some ICU implementations at midnight
  const hour = parts.hour === "24" ? "00" : parts.hour;

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`, // YYYY-MM-DD, for the `date` column
    time: `${hour}:${parts.minute}:${parts.second}`, // HH:mm:ss, for the `time` column
    iso: new Date().toISOString(),
  };
}

export function formatTimeForDisplay(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${mStr} ${suffix}`;
}

export function formatDateForDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${d} ${months[m - 1]} ${y}`;
}


export interface AttendanceSlotStatus {
  configured: boolean;
  allowed: boolean;
  startTime: string | null;
  endTime: string | null;
}

function parseClock(value: string): number {
  const [h, m, sec = 0] = value.split(":").map(Number);
  return h * 3600 + m * 60 + sec;
}

function formatClock(totalSeconds: number): string {
  const normalized = ((totalSeconds % 86400) + 86400) % 86400;
  const h = Math.floor(normalized / 3600);
  const m = Math.floor((normalized % 3600) / 60);
  const s = normalized % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

/**
 * Pure, deterministic fixed one-hour slot calculation. `currentTime` must be
 * an HH:MM:SS clock value already derived from the server's Asia/Kolkata time.
 */
export function getAttendanceSlotStatus(
  attendanceStartTime: string | null | undefined,
  currentTime: string
): AttendanceSlotStatus {
  if (!attendanceStartTime) {
    return { configured: false, allowed: true, startTime: null, endTime: null };
  }

  const start = parseClock(attendanceStartTime);
  const current = parseClock(currentTime);
  const end = start + 3600;

  // A fixed daily window is evaluated on the current day's clock. For a slot
  // that would cross midnight, the usable part is the same-day portion; the
  // next calendar date gets its own daily slot.
  const allowed = end <= 86400
    ? start <= current && current < end
    : start <= current;

  return {
    configured: true,
    allowed,
    startTime: formatClock(start),
    endTime: formatClock(end),
  };
}
