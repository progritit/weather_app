export function formatLocal(timestampMs, timezone, options = {}) {
  if (!Number.isFinite(timestampMs) || !timezone) return "—";
  try {
    return new Intl.DateTimeFormat("en", {
      ...options,
      timeZone: timezone,
    }).format(timestampMs);
  } catch {
    return "—";
  }
}

export function localDate(timestampMs, timezone) {
  if (!Number.isFinite(timestampMs) || !timezone) return null;
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(timestampMs);
    const part = (type) => parts.find((item) => item.type === type).value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    return null;
  }
}

export function dateLabel(date, options = { weekday: "short" }) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "—";
  const timestamp = Date.parse(`${date}T12:00:00Z`);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== date
  )
    return "—";
  return formatLocal(timestamp, "UTC", options);
}

export function timeLabel(timestampMs, timezone) {
  return formatLocal(timestampMs, timezone, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

export function timestampLabel(timestampMs, timezone) {
  return formatLocal(timestampMs, timezone, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

export function sunLabel(event, timezone) {
  const formatted = timeLabel(event?.timestampMs, timezone);
  if (formatted !== "—") return formatted;
  return localTimeLabel(event?.local);
}

export function localTimeLabel(value) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value ?? "")
    ? value.slice(0, 5)
    : "—";
}

export function utcOffsetLabel(timestampMs, timezone) {
  if (!Number.isFinite(timestampMs) || !timezone) return "—";
  try {
    return (
      new Intl.DateTimeFormat("en", {
        timeZone: timezone,
        timeZoneName: "shortOffset",
      })
        .formatToParts(timestampMs)
        .find((part) => part.type === "timeZoneName")?.value ?? "—"
    );
  } catch {
    return "—";
  }
}

export function readingDate(reading, timezone) {
  return localDate(reading.timestampMs, timezone) ?? reading.date;
}
