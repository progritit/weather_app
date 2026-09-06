import { localDate } from "../utils/dates.js";

const HOUR_MS = 3_600_000;

// Reselect already-loaded readings as local time advances. No fetch, mutation or clock reads.
export function selectForecast(weather, referenceTimeMs) {
  if (!Number.isFinite(referenceTimeMs)) return weather;
  const date = localDate(referenceTimeMs, weather.location.timezone);
  const seenHours = new Set();
  const hourly = [
    ...weather.hourly,
    ...weather.daily.flatMap((day) => day.hours),
  ]
    .filter((hour) => {
      const time = hour.timestampMs;
      if (
        !Number.isFinite(time) ||
        time + HOUR_MS <= referenceTimeMs ||
        time >= referenceTimeMs + 24 * HOUR_MS ||
        seenHours.has(time)
      )
        return false;
      seenHours.add(time);
      return true;
    })
    .sort((a, b) => a.timestampMs - b.timestampMs)
    .slice(0, 24);
  const seenDays = new Set();
  const daily = weather.daily
    .filter((day) => {
      if (!day.date || (date && day.date < date) || seenDays.has(day.date))
        return false;
      seenDays.add(day.date);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 7);
  return {
    ...weather,
    hourly,
    daily,
    meta: { ...weather.meta, referenceTimeMs },
  };
}

// Changes only when the visible forecast window changes, avoiding a full render every minute.
export function forecastWindowKey(weather) {
  return JSON.stringify([
    localDate(weather.meta.referenceTimeMs, weather.location.timezone),
    weather.hourly.map((hour) => hour.timestampMs),
    weather.daily.map((day) => day.date),
  ]);
}
