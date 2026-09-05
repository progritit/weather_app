export function temperature(value, unit = "C") {
  if (value === null || value === undefined) return "—";
  return `${Math.round(unit === "F" ? (value * 9) / 5 + 32 : value)}°`;
}
