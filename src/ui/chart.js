import { temperature } from "../utils/units.js";

export function renderChart(hours, unit) {
  if (!hours.length) return "";
  const values = hours.map((hour) => hour.temperature).filter(Number.isFinite);
  const min = values.length ? Math.min(...values) - 2 : null;
  const max = values.length ? Math.max(...values) + 2 : null;
  const width = hours.length * 80;
  let penDown = false;
  const path = hours
    .map((hour, index) => {
      if (!Number.isFinite(hour.temperature)) {
        penDown = false;
        return "";
      }
      const contiguous =
        index > 0 &&
        hour.timestampMs - hours[index - 1].timestampMs === 3_600_000;
      const point = `${penDown && contiguous ? "L" : "M"}${index * 80 + 40},${110 - ((hour.temperature - min) / (max - min)) * 90}`;
      penDown = true;
      return point;
    })
    .join(" ");
  const bars = hours
    .map((hour, index) => {
      const value = hour.precipitation.probability;
      return Number.isFinite(value)
        ? `<rect x="${index * 80 + 32}" y="${140 - value * 0.5}" width="16" height="${value * 0.5}" rx="3" class="rain-bar" />`
        : "";
    })
    .join("");
  const points = hours
    .map((hour, index) =>
      Number.isFinite(hour.temperature)
        ? `<circle cx="${index * 80 + 40}" cy="${110 - ((hour.temperature - min) / (max - min)) * 90}" r="2.5" class="temperature-point" />`
        : "",
    )
    .join("");
  return `<svg class="forecast-chart" viewBox="0 0 ${width} 150" preserveAspectRatio="none" role="img" aria-label="Temperature and precipitation probability. Exact values are listed above; missing readings leave gaps.">
    <path d="M0 140 H${width} M0 80 H${width} M0 20 H${width}" class="chart-grid" />${bars}<path d="${path}" class="temperature-line" />${points}
    </svg><p class="chart-note">${values.length ? `Temperature scale: ${temperature(min, unit)}–${temperature(max, unit)}${unit}.` : "Temperature readings unavailable."} Precipitation bars: 0–100%. Missing readings leave gaps.</p>`;
}
