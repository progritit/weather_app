export function temperature(value, unit = "C") {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(unit === "F" ? (value * 9) / 5 + 32 : value)}°`;
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
  ][Math.round(value / 22.5) % 16];
}
