import { localDate } from "./dates.js";

export function conditionKey(icon) {
  if (typeof icon !== "string") return "unknown";
  if (icon.startsWith("thunder")) return "thunderstorm";
  if (icon.includes("snow")) return "snow";
  if (["sleet", "ice", "freezing-rain"].includes(icon)) return "sleet";
  if (icon.includes("rain") || icon.includes("showers")) return "rain";
  if (icon.startsWith("partly-cloudy")) return "partly-cloudy";
  if (icon.startsWith("clear-")) return "clear";
  if (icon === "cloudy" || icon === "overcast") return "overcast";
  return ["fog", "wind"].includes(icon) ? icon : "unknown";
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
  if (reading?.icon?.endsWith("-night")) return "night";
  if (reading?.icon?.endsWith("-day")) return "day";
  return null;
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
