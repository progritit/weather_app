// The model always keeps Celsius. Convert from that source, never from rounded UI text.
export function convertTemperature(value, unit = "C") {
  if (!Number.isFinite(value)) return null;
  return unit === "F" ? (value * 9) / 5 + 32 : value;
}

export function temperature(value, unit = "C", { includeUnit = false } = {}) {
  const converted = convertTemperature(value, unit);
  if (converted === null) return "—";
  return `${Math.round(converted)}°${includeUnit ? (unit === "F" ? "F" : "C") : ""}`;
}

export function measurement(value, suffix = "", decimals = 1) {
  return Number.isFinite(value)
    ? `${Number(value.toFixed(decimals))}${suffix}`
    : "—";
}

export function windDirection(value) {
  if (!Number.isFinite(value)) return "—";
  return [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ][Math.round((((value % 360) + 360) % 360) / 22.5) % 16];
}
