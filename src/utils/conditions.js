import { localDate } from "./dates.js";

const PHASES = new Set(["day", "night"]);

const VISUAL_PROFILES = Object.freeze({
  clear: Object.freeze({ theme: "clear", accent: "amber" }),
  "partly-cloudy": Object.freeze({ theme: "partly-cloudy", accent: "ice" }),
  overcast: Object.freeze({ theme: "overcast", accent: "ice" }),
  rain: Object.freeze({ theme: "rain", accent: "ice" }),
  thunderstorm: Object.freeze({ theme: "thunderstorm", accent: "violet" }),
  snow: Object.freeze({ theme: "snow", accent: "frost" }),
  fog: Object.freeze({ theme: "fog", accent: "mist" }),
  wind: Object.freeze({ theme: "wind", accent: "ice" }),
  sleet: Object.freeze({ theme: "sleet", accent: "ice" }),
  unknown: Object.freeze({ theme: "unknown", accent: "muted" }),
});

export function conditionKey(icon) {
  if (typeof icon !== "string") return "unknown";
  const value = icon.trim().toLowerCase();
  if (!value) return "unknown";
  if (value.includes("thunder")) return "thunderstorm";
  if (value.includes("snow") || value.includes("blizzard")) return "snow";
  if (
    ["sleet", "ice", "freezing-rain", "freezing-drizzle"].some((token) =>
      value.includes(token),
    )
  )
    return "sleet";
  if (
    value.includes("rain") ||
    value.includes("shower") ||
    value.includes("drizzle")
  )
    return "rain";
  if (value.startsWith("partly-cloudy") || value.includes("partially cloudy"))
    return "partly-cloudy";
  if (value.startsWith("clear") || value === "fair" || value === "sunny")
    return "clear";
  if (value.startsWith("cloudy") || value.startsWith("overcast"))
    return "overcast";
  if (["fog", "mist", "haze"].includes(value)) return "fog";
  if (value === "wind" || value.includes("windy")) return "wind";
  return "unknown";
}

export function phaseFromIcon(icon) {
  if (typeof icon !== "string") return null;
  const value = icon.trim().toLowerCase();
  if (value.endsWith("-night")) return "night";
  if (value.endsWith("-day")) return "day";
  return null;
}

export function iconKey(condition, phase) {
  const key = conditionKey(condition);
  const selectedPhase = PHASES.has(phase)
    ? phase
    : (phaseFromIcon(condition) ?? "day");
  return ["clear", "partly-cloudy"].includes(key)
    ? `${key}-${selectedPhase}`
    : key;
}

export function visualProfile(condition, phase) {
  const key = conditionKey(condition);
  const profile = VISUAL_PROFILES[key] ?? VISUAL_PROFILES.unknown;
  return {
    condition: key,
    phase: PHASES.has(phase) ? phase : "unknown",
    theme: profile.theme,
    accent: profile.accent,
  };
}

export function phaseFor(
  reading,
  sun = reading,
  timestampMs = reading?.timestampMs,
) {
  const rise = sun?.sunrise?.timestampMs;
  const set = sun?.sunset?.timestampMs;
  if (
    Number.isFinite(timestampMs) &&
    Number.isFinite(rise) &&
    Number.isFinite(set) &&
    rise < set
  ) {
    return timestampMs >= rise && timestampMs < set ? "day" : "night";
  }
  return phaseFromIcon(reading?.icon);
}

export function currentAppearance(weather, now) {
  const date = localDate(now, weather.location.timezone);
  const day = weather.daily.find((item) => item.date === date);
  const sun = day ?? (weather.current?.date === date ? weather.current : null);
  return {
    condition: conditionKey(weather.current?.icon),
    phase: phaseFor(weather.current, sun, now),
  };
}

export function activeAlerts(weather, now) {
  return weather.alerts.filter(
    (alert) =>
      (!Number.isFinite(alert.onset.timestampMs) ||
        alert.onset.timestampMs <= now) &&
      (!Number.isFinite(alert.ends.timestampMs) ||
        alert.ends.timestampMs > now),
  );
}
