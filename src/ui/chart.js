import {
  convertTemperature,
  measurement,
  temperature,
} from "../utils/units.js";
import { timestampLabel, utcOffsetLabel } from "../utils/dates.js";
import { escapeHtml as esc } from "../utils/html.js";

const TOP = 20;
const BOTTOM = 140;
const HEIGHT = BOTTOM - TOP;

export function renderChart(hours, unit, timezone = null) {
  if (!hours.length) return "";
  const sourceValues = hours
    .map((hour) => hour.temperature)
    .filter(Number.isFinite);
  const minC = sourceValues.length ? Math.min(...sourceValues) - 2 : null;
  const maxC = sourceValues.length ? Math.max(...sourceValues) + 2 : null;
  const min = convertTemperature(minC, unit);
  const max = convertTemperature(maxC, unit);
  const width = Math.max(320, hours.length * 80);
  const x = (index) => ((index + 0.5) * width) / hours.length;
  const y = (value) =>
    BOTTOM - ((convertTemperature(value, unit) - min) / (max - min)) * HEIGHT;
  const title = (hour, text) =>
    esc(
      `${timestampLabel(hour.timestampMs, timezone)} ${utcOffsetLabel(hour.timestampMs, timezone)} · ${text}`,
    );
  let penDown = false;
  const path = hours
    .map((hour, index) => {
      if (!Number.isFinite(hour.temperature)) {
        penDown = false;
        return "";
      }
      const previous = hours[index - 1];
      const contiguous =
        previous &&
        Number.isFinite(previous.timestampMs) &&
        Number.isFinite(hour.timestampMs) &&
        hour.timestampMs - previous.timestampMs === 3_600_000;
      const point = `${penDown && contiguous ? "L" : "M"}${x(index)},${y(hour.temperature)}`;
      penDown = true;
      return point;
    })
    .join(" ");
  const bars = hours
    .map((hour, index) => {
      const value = hour.precipitation.probability;
      const height = (value / 100) * HEIGHT;
      return Number.isFinite(value)
        ? `<rect x="${x(index) - 8}" y="${BOTTOM - height}" width="16" height="${height}" rx="3" class="rain-bar"><title>${title(hour, `Precipitation probability ${measurement(value, "%", 0)}`)}</title></rect>`
        : "";
    })
    .join("");
  const points = hours
    .map((hour, index) =>
      Number.isFinite(hour.temperature)
        ? `<circle cx="${x(index)}" cy="${y(hour.temperature)}" r="2.5" class="temperature-point"><title>${title(hour, temperature(hour.temperature, unit, { includeUnit: true }))}</title></circle>`
        : "",
    )
    .join("");
  const axes = [0, 0.5, 1]
    .map((position) => {
      const valueC = minC === null ? null : maxC - position * (maxC - minC);
      return `<div class="chart-axis-row" style="top:${TOP + position * HEIGHT}px" aria-hidden="true"><span>${temperature(valueC, unit, { includeUnit: true })}</span><span>${100 - position * 100}%</span></div>`;
    })
    .join("");
  return `<div class="chart-plot"><svg class="forecast-chart" viewBox="0 0 ${width} 160" preserveAspectRatio="none" role="img" aria-label="Temperature (°${unit}) and precipitation probability (%). Exact hourly values are listed above. Missing readings leave gaps.">
    <path d="M0 ${BOTTOM} H${width} M0 80 H${width} M0 ${TOP} H${width}" class="chart-grid" />${bars}<path d="${path}" class="temperature-line" />${points}</svg>${axes}</div>
    <p class="chart-note">${sourceValues.length ? `Temperature scale: ${temperature(minC, unit, { includeUnit: true })} to ${temperature(maxC, unit, { includeUnit: true })}.` : "Temperature readings unavailable."} Precipitation bars: 0–100%. Missing readings leave gaps.</p>`;
}
