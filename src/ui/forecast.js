import { temperature, measurement, windDirection } from "../utils/units.js";
import {
  dateLabel,
  localDate,
  timeLabel,
  timestampLabel,
  sunLabel,
} from "../utils/dates.js";
import { conditionKey, phaseFor } from "../utils/conditions.js";
import { escapeHtml as esc } from "../utils/html.js";
import { weatherIcon } from "./assets.js";
import { renderChart } from "./chart.js";

function hourItems(hours, weather, unit, referenceTimeMs = null, sun = null) {
  const timezone = weather.location.timezone;
  return hours
    .map((hour) => {
      const day = sun ?? weather.daily.find((item) => item.date === hour.date);
      const currentHour =
        Number.isFinite(referenceTimeMs) &&
        Number.isFinite(hour.timestampMs) &&
        hour.timestampMs <= referenceTimeMs &&
        hour.timestampMs + 3_600_000 > referenceTimeMs;
      const time = timeLabel(hour.timestampMs, timezone);
      const label = currentHour
        ? "Now"
        : time !== "—"
          ? time
          : (hour.datetimeLocal?.slice(0, 5) ?? "—");
      return `<div class="hour"><span title="${esc(timestampLabel(hour.timestampMs, timezone))}">${esc(label)}</span><small>${esc(dateLabel(hour.date, { month: "short", day: "numeric" }))}</small>${weatherIcon(conditionKey(hour.icon), phaseFor(hour, day))}<span class="sr-only">${esc(hour.condition ?? "Conditions unavailable")}</span><strong>${temperature(hour.temperature, unit)}</strong><span class="rain-value"><span class="sr-only">Precipitation probability </span>${measurement(hour.precipitation.probability, "%", 0)}</span></div>`;
    })
    .join("");
}

export function renderHourly(weather, unit) {
  const hours = weather.hourly;
  return `<section class="panel hourly-section" aria-labelledby="hourly-title">
    <div class="section-heading"><div><p class="eyebrow">THE HOURS AHEAD</p><h2 id="hourly-title">Next 24 hours</h2></div><span class="subtle">Scroll to explore →</span></div>
    ${
      hours.length
        ? `<div class="chart-legend"><span class="temp-key">Temperature (°${unit})</span><span class="rain-key">Precipitation probability (%)</span></div>
    <div class="hourly-scroll" tabindex="0" aria-label="Hourly forecast, scroll horizontally" data-focus="overview-hours"><div class="hourly-track" style="--hour-count:${hours.length};--track-width:${Math.max(320, hours.length * 80)}px"><div class="hourly-items">${hourItems(hours, weather, unit, weather.meta.referenceTimeMs)}</div>${renderChart(hours, unit)}</div></div>`
        : '<p class="empty-section">Hourly readings are unavailable for this forecast window.</p>'
    }
  </section>`;
}

export function renderDaily(weather, unit, selectedDay) {
  const today = localDate(
    weather.meta.referenceTimeMs,
    weather.location.timezone,
  );
  return `<section class="panel daily-section" aria-labelledby="daily-title"><div class="section-heading"><div><p class="eyebrow">A LITTLE FURTHER OUT</p><h2 id="daily-title">Seven-day forecast</h2></div><span class="subtle">Select a day</span></div>
    ${
      weather.daily.length
        ? `<div class="day-columns" aria-hidden="true"><span>Day / conditions</span><span>Precip.</span><span>Low / high</span></div><div class="day-list">${weather.daily
            .map((day, index) => {
              const label = day.date === today ? "Today" : dateLabel(day.date);
              const expanded = selectedDay === day.date;
              return `<div><button class="day-row ${expanded ? "selected" : ""}" data-day="${index}" data-focus="day-${index}" aria-expanded="${expanded}" aria-controls="day-detail-${index}">
        <span class="day-name">${esc(label)}</span>${weatherIcon(conditionKey(day.icon))}<span class="day-condition">${esc(day.condition ?? "Unavailable")}</span><span class="rain-value"><span class="sr-only">Precipitation probability </span>${measurement(day.precipitation.probability, "%", 0)}</span><span class="temperature-range"><span><span class="sr-only">Low </span>${temperature(day.low, unit)}</span><i aria-hidden="true"></i><strong><span class="sr-only">High </span>${temperature(day.high, unit)}</strong></span><span aria-hidden="true">${expanded ? "−" : "+"}</span>
        </button>${expanded ? renderDayDetail(day, index, weather, unit) : `<div id="day-detail-${index}" hidden></div>`}</div>`;
            })
            .join("")}</div>`
        : '<p class="empty-section">Daily forecast readings are unavailable.</p>'
    }</section>`;
}

function renderDayDetail(day, index, weather, unit) {
  return `<div id="day-detail-${index}" class="day-detail"><p class="eyebrow">${esc(dateLabel(day.date, { month: "long", day: "numeric" }))} · DAILY OUTLOOK</p><h3>${esc(day.condition ?? "Conditions unavailable")}</h3><p>High ${temperature(day.high, unit)} / low ${temperature(day.low, unit)}. Precipitation probability ${measurement(day.precipitation.probability, "%", 0)}.</p><dl class="detail-stats">
    <div><dt>Wind</dt><dd>${measurement(day.wind.speed, " km/h")} ${windDirection(day.wind.direction)}</dd></div><div><dt>Gusts</dt><dd>${measurement(day.wind.gust, " km/h")}</dd></div><div><dt>Sunrise</dt><dd>${sunLabel(day.sunrise, weather.location.timezone)}</dd></div><div><dt>Sunset</dt><dd>${sunLabel(day.sunset, weather.location.timezone)}</dd></div></dl>
    ${day.hours.length ? `<div class="hourly-scroll detail-hours" tabindex="0" data-focus="detail-hours-${index}" aria-label="Hourly readings for ${esc(day.date)}"><div class="hourly-track" style="--hour-count:${day.hours.length};--track-width:${Math.max(320, day.hours.length * 80)}px"><div class="hourly-items">${hourItems(day.hours, weather, unit, null, day)}</div></div></div>` : '<p class="chart-note">Hourly details are unavailable for this day.</p>'}</div>`;
}

function uvCategory(uv) {
  if (!Number.isFinite(uv)) return "Not available";
  return uv >= 11
    ? "Extreme"
    : uv >= 8
      ? "Very high"
      : uv >= 6
        ? "High"
        : uv >= 3
          ? "Moderate"
          : "Low";
}

export function renderMetrics(weather) {
  const current = weather.current;
  const metrics = [
    ["Humidity", measurement(current?.humidity, "%"), "Relative humidity"],
    [
      "Wind",
      measurement(current?.wind.speed, " km/h"),
      `${windDirection(current?.wind.direction)} · gusts ${measurement(current?.wind.gust, " km/h")}`,
    ],
    ["UV index", measurement(current?.uvIndex), uvCategory(current?.uvIndex)],
    [
      "Visibility",
      measurement(current?.visibility, " km"),
      "Horizontal distance",
    ],
    ["Pressure", measurement(current?.pressure, " hPa"), "Sea-level pressure"],
    [
      "Precipitation",
      measurement(current?.precipitation.amount, " mm"),
      "Observation amount",
    ],
  ];
  const today = weather.daily.find(
    (day) =>
      day.date ===
      localDate(weather.meta.referenceTimeMs, weather.location.timezone),
  );
  const sunrise = today?.sunrise ?? current?.sunrise;
  const sunset = today?.sunset ?? current?.sunset;
  return `<section class="panel metrics-section" aria-labelledby="details-title"><div class="section-heading"><div><p class="eyebrow">A CLOSER LOOK</p><h2 id="details-title">In the atmosphere</h2></div></div><dl class="metrics">${metrics.map(([label, value, note]) => `<div><dt>${label}</dt><dd>${value}</dd><span>${value === "—" ? "Not available" : note}</span></div>`).join("")}</dl><div class="sun-track"><div><span>Sunrise</span><strong>${sunLabel(sunrise, weather.location.timezone)}</strong></div><div class="sun-arc" aria-hidden="true">☀</div><div><span>Sunset</span><strong>${sunLabel(sunset, weather.location.timezone)}</strong></div></div><p class="chart-note">Times are local to ${esc(weather.location.label ?? "the selected location")}.</p></section>`;
}
