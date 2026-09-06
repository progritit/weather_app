import { formatResolvedLocation } from "../utils/location.js";

const HOUR_MS = 60 * 60 * 1000;
const MAX_DATE_MS = 8.64e15;

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const numberOrNull = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const textOrNull = (value) =>
  typeof value === "string" && value.trim() !== "" ? value : null;

function boundedNumber(value, min, max = Infinity) {
  const number = numberOrNull(value);
  return number !== null && number >= min && number <= max ? number : null;
}

function epochToMs(value) {
  const seconds = numberOrNull(value);
  const ms = seconds === null ? null : seconds * 1000;
  return ms !== null && Math.abs(ms) <= MAX_DATE_MS ? ms : null;
}

function zonedIsoToMs(value) {
  // Never let Date.parse interpret a provider-local date as the machine's time.
  if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    return null;
  }
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

function localDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  // Explicit UTC here only validates the calendar label, not an event timestamp.
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? value
    : null;
}

function dateAt(timestampMs, timezone) {
  if (timestampMs === null || timezone === null) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(timestampMs);
    const part = (type) => parts.find((item) => item.type === type).value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    // Retain the supplied timezone on location; do not invent a replacement.
    return null;
  }
}

function sunEvent(local, epoch) {
  return { local: textOrNull(local), timestampMs: epochToMs(epoch) };
}

function normalizeReading(record, date, fallbackOffset) {
  return {
    date,
    datetimeLocal: textOrNull(record.datetime),
    timestampMs: epochToMs(record.datetimeEpoch),
    utcOffsetHours: numberOrNull(record.tzoffset) ?? fallbackOffset,
    temperature: numberOrNull(record.temp),
    feelsLike: numberOrNull(record.feelslike),
    condition: textOrNull(record.conditions),
    icon: textOrNull(record.icon),
    humidity: boundedNumber(record.humidity, 0, 100),
    wind: {
      speed: boundedNumber(record.windspeed, 0),
      gust: boundedNumber(record.windgust, 0),
      direction: boundedNumber(record.winddir, 0, 360),
    },
    uvIndex: boundedNumber(record.uvindex, 0),
    visibility: boundedNumber(record.visibility, 0),
    pressure: boundedNumber(record.pressure, 0),
    precipitation: {
      amount: boundedNumber(record.precip, 0),
      probability: boundedNumber(record.precipprob, 0, 100),
      types: Array.isArray(record.preciptype)
        ? record.preciptype.filter((type) => textOrNull(type) !== null)
        : null,
    },
  };
}

function byTimestamp(a, b) {
  if (a.timestampMs === null) return b.timestampMs === null ? 0 : 1;
  if (b.timestampMs === null) return -1;
  return a.timestampMs - b.timestampMs;
}

function normalizeDay(day, timezone, fallbackOffset) {
  const timestampMs = epochToMs(day.datetimeEpoch);
  const date = localDate(day.datetime) ?? dateAt(timestampMs, timezone);
  const offset = numberOrNull(day.tzoffset) ?? fallbackOffset;
  return {
    ...normalizeReading(day, date, offset),
    high: numberOrNull(day.tempmax),
    low: numberOrNull(day.tempmin),
    sunrise: sunEvent(day.sunrise, day.sunriseEpoch),
    sunset: sunEvent(day.sunset, day.sunsetEpoch),
    hours: Array.isArray(day.hours)
      ? day.hours
          .filter(isRecord)
          .map((hour) => normalizeReading(hour, date, offset))
          .sort(byTimestamp)
      : [],
  };
}

function safeLink(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function normalizeAlert(alert) {
  return {
    id: textOrNull(alert.id),
    event: textOrNull(alert.event),
    headline: textOrNull(alert.headline),
    description: textOrNull(alert.description),
    language: textOrNull(alert.language),
    link: safeLink(alert.link),
    onset: {
      local: textOrNull(alert.onset),
      timestampMs: epochToMs(alert.onsetEpoch) ?? zonedIsoToMs(alert.onset),
    },
    ends: {
      local: textOrNull(alert.ends),
      timestampMs: epochToMs(alert.endsEpoch) ?? zonedIsoToMs(alert.ends),
    },
  };
}

/**
 * Pure Worker-envelope -> app-model transformation. No fetch, DOM, storage or clock reads.
 * All measurements remain metric; every absolute timestamp is in milliseconds.
 * Missing readings are null. Empty arrays never synthesize readings or alerts.
 * Supply referenceTimeMs explicitly to reselect a cached forecast at a later time;
 * locationQuery supplies canonical display context when the provider address is
 * incomplete.
 */
export function normalizeWeather(
  payload,
  { referenceTimeMs, locationQuery } = {},
) {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new TypeError(
      "Expected the Worker's { data, meta } weather response.",
    );
  }
  if (payload.meta?.units !== "metric") {
    throw new TypeError(
      "Expected metric weather data from the protected Worker.",
    );
  }
  if (
    referenceTimeMs !== undefined &&
    (numberOrNull(referenceTimeMs) === null ||
      Math.abs(referenceTimeMs) > MAX_DATE_MS)
  ) {
    throw new TypeError(
      "referenceTimeMs must be a finite epoch timestamp in milliseconds.",
    );
  }

  const { data, meta } = payload;
  const timezone = textOrNull(data.timezone);
  const fallbackOffset = numberOrNull(data.tzoffset);
  const currentSource = isRecord(data.currentConditions)
    ? data.currentConditions
    : null;
  const fetchedAtMs = zonedIsoToMs(meta.fetchedAt);
  const observedAtMs = epochToMs(currentSource?.datetimeEpoch);
  const referenceMs = referenceTimeMs ?? fetchedAtMs ?? observedAtMs;
  const referenceDate = dateAt(referenceMs, timezone);
  const sourceDays = Array.isArray(data.days) ? data.days.filter(isRecord) : [];
  const days = sourceDays.map((day) =>
    normalizeDay(day, timezone, fallbackOffset),
  );
  const seen = new Set();
  const hourly = days
    .flatMap((day) => day.hours)
    .filter((hour) => {
      if (hour.timestampMs === null || referenceMs === null) return false;
      // Include the current hour in progress, then the remaining upcoming hours.
      if (
        hour.timestampMs + HOUR_MS <= referenceMs ||
        hour.timestampMs >= referenceMs + 24 * HOUR_MS
      )
        return false;
      if (seen.has(hour.timestampMs)) return false;
      seen.add(hour.timestampMs);
      return true;
    })
    .sort(byTimestamp)
    .slice(0, 24);
  const daily = days
    .filter(
      (day) =>
        day.date !== null &&
        (referenceDate === null || day.date >= referenceDate),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 7);

  const resolvedLocation = formatResolvedLocation(
    textOrNull(data.resolvedAddress) ?? textOrNull(data.address),
    typeof locationQuery === "string" ? locationQuery : null,
  );

  return {
    location: {
      label: resolvedLocation.label,
      city: resolvedLocation.city,
      region: resolvedLocation.region,
      country: resolvedLocation.country,
      latitude: boundedNumber(data.latitude, -90, 90),
      longitude: boundedNumber(data.longitude, -180, 180),
      timezone,
    },
    current: currentSource
      ? {
          ...normalizeReading(
            currentSource,
            dateAt(observedAtMs, timezone),
            fallbackOffset,
          ),
          sunrise: sunEvent(currentSource.sunrise, currentSource.sunriseEpoch),
          sunset: sunEvent(currentSource.sunset, currentSource.sunsetEpoch),
        }
      : null,
    hourly,
    daily,
    alerts: Array.isArray(data.alerts)
      ? data.alerts.filter(isRecord).map(normalizeAlert)
      : [],
    availability: {
      current: currentSource !== null,
      daily: Array.isArray(data.days),
      hourly: sourceDays.some((day) => Array.isArray(day.hours)),
      alerts: Array.isArray(data.alerts),
    },
    meta: {
      provider: textOrNull(meta.provider),
      units: "metric",
      fetchedAtMs,
      referenceTimeMs: referenceMs,
      cache: ["hit", "miss"].includes(meta.cache) ? meta.cache : null,
      cacheTtlSeconds: boundedNumber(meta.cacheTtlSeconds, 0),
    },
  };
}
