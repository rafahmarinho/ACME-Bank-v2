export const TIME_ZONE = "America/New_York";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Formats integer cents as USD, e.g. 123456 → "$1,234.56". */
export function formatCents(cents: number | null | undefined, opts: { sign?: boolean } = {}) {
  const value = Number(cents ?? 0);
  const text = usd.format(Math.abs(value) / 100);
  if (value < 0) return `-${text}`;
  if (opts.sign && value > 0) return `+${text}`;
  return text;
}

/** Parses user input such as "1,234.5" or "$20" into integer cents. Returns null when invalid. */
export function parseMoneyToCents(input: string | null | undefined): number | null {
  if (input == null) return null;
  const cleaned = String(input).replace(/[$,\s]/g, "");
  if (!/^\d{1,9}(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2);
}

const dateFmt = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, month: "short", day: "numeric", year: "numeric" });
const shortDateFmt = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, month: "short", day: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "long", month: "long", day: "numeric", year: "numeric" });
const isoDayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

export const formatDate = (v: string | Date | null | undefined) => (v ? dateFmt.format(new Date(v)) : "—");
export const formatShortDate = (v: string | Date | null | undefined) => (v ? shortDateFmt.format(new Date(v)) : "—");
export const formatDateTime = (v: string | Date | null | undefined) => (v ? dateTimeFmt.format(new Date(v)) : "—");
export const formatTime = (v: string | Date) => timeFmt.format(new Date(v));
export const formatDayHeading = (v: string | Date) => dayFmt.format(new Date(v));
/** YYYY-MM-DD in the bank's time zone. */
export const localIsoDate = (v: string | Date) => isoDayFmt.format(new Date(v));

/** Formats a plain YYYY-MM-DD date (no time zone shift). */
export function formatPlainDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** Converts a YYYY-MM-DD local (New York) date to the UTC instant of its midnight. */
export function localMidnightUtc(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, 12));
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(guess)
    .find((p) => p.type === "timeZoneName")?.value; // e.g. "GMT-05:00"
  const match = offset?.match(/GMT([+-])(\d{2}):(\d{2})/);
  const minutes = match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
  return new Date(Date.UTC(y, m - 1, d) - minutes * 60_000);
}

export function addDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function maskAccount(num: string | null | undefined) {
  return num ? `••${num.slice(-4)}` : "";
}

export function initials(name: string | null | undefined) {
  return (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function titleCase(v: string | null | undefined) {
  return (v ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
