import { temperature, measurement, windDirection } from "../utils/units.js";
import {
  dateLabel,
  localDate,
  localTimeLabel,
  readingDate,
  timeLabel,
  timestampLabel,
  sunLabel,
  utcOffsetLabel,
} from "../utils/dates.js";
import { conditionKey, phaseFor } from "../utils/conditions.js";
import { escapeHtml as esc } from "../utils/html.js";
import { renderChart } from "./chart.js";

function hourItems(
  hours,
  weather,
  unit,
  weatherIcon,
  referenceTimeMs = null,
  sun = null,
) {
  const timezone = weather.location.timezone;
  const offsets = hours.map((hour) =>
    utcOffsetLabel(hour.timestampMs, timezone),
  );
  const offsetChanges =
    new Set(offsets.filter((offset) => offset !== "—")).size > 1;
  return hours
    .map((hour, index) => {
      const date = readingDate(hour, timezone);
      const day = sun ?? weather.daily.find((item) => item.date === date);
      const currentHour =
        Number.isFinite(referenceTimeMs) &&
        Number.isFinite(hour.timestampMs) &&
        hour.timestampMs <= referenceTimeMs &&
        hour.timestampMs + 3_600_000 > referenceTimeMs;
      const formatted = timeLabel(hour.timestampMs, timezone);
      const time =
        formatted === "—" ? localTimeLabel(hour.datetimeLocal) : formatted;
      const label = currentHour ? "Now" : time;
      const datetime = Number.isFinite(hour.timestampMs)
        ? ` datetime="${new Date(hour.timestampMs).toISOString()}"`
        : "";
      const exact = temperature(hour.temperature, unit, { includeUnit: true });
      return `<div class="hour"><time${datetime} title="${esc(timestampLabel(hour.timestampMs, timezone))} ${esc(offsets[index])}">${esc(label)}</time><small>${esc(dateLabel(date, { month: "short", day: "numeric" }))}</small>${offsetChanges ? `<small class="hour-offset">${esc(offsets[index])}</small>` : ""}${weatherIcon(conditionKey(hour.icon), phaseFor(hour, day))}<span class="sr-only">${esc(hour.condition ?? "Conditions unavailable")}</span><strong aria-label="Temperature ${exact}">${temperature(hour.temperature, unit)}</strong><span class="rain-value"><span class="sr-only">Precipitation probability </span>${measurement(hour.precipitation.probability, "%", 0)}</span></div>`;
    })
    .join("");
}

function timeNote(weather) {
  return weather.location.timezone
    ? `Times are local to ${esc(weather.location.label ?? "the selected location")} (${esc(weather.location.timezone)}).`
    : "Location timezone unavailable; supplied local labels are shown where available.";
}

// The shell supplies the icon renderer, keeping forecast presentation independent of bundling.
export function renderHourly(weather, unit, weatherIcon) {
  const hours = weather.hourly;
  return `<section class="panel hourly-section" aria-labelledby="hourly-title">
    <div class="section-heading"><div><p class="eyebrow">THE HOURS AHEAD</p><h2 id="hourly-title">Next 24 hours</h2></div><span class="subtle">Scroll to explore →</span></div>
    ${
      hours.length
        ? `<div class="chart-legend"><span class="temp-key">Temperature (°${unit})</span><span class="rain-key">Precipitation probability (%)</span></div>
      <div class="hourly-scroll" tabindex="0" aria-label="Hourly forecast in °${unit}, scroll horizontally" data-focus="overview-hours"><div class="hourly-track" style="--hour-count:${hours.length};--track-width:${Math.max(320, hours.length * 80)}px"><div class="hourly-items">${hourItems(hours, weather, unit, weatherIcon, weather.meta.referenceTimeMs)}</div>${renderChart(hours, unit, weather.location.timezone)}</div></div>
      ${hours.length < 24 ? `<p class="chart-note">Only ${hours.length} hourly reading${hours.length === 1 ? " is" : "s are"} available in this window.</p>` : ""}`
        : '<p class="empty-section">Hourly readings are unavailable for this forecast window. Refresh to check for a newer forecast.</p>'
    }
    <p class="chart-note">${timeNote(weather)} Dates distinguish hours after midnight; GMT offsets appear when the clocks change.</p>
  </section>`;
}

export function renderDaily(weather, unit, selectedDay, weatherIcon) {
  const today = localDate(
    weather.meta.referenceTimeMs,
    weather.location.timezone,
  );
  return `<section class="panel daily-section" aria-labelledby="daily-title"><div class="section-heading"><div><p class="eyebrow">A LITTLE FURTHER OUT</p><h2 id="daily-title">Seven-day forecast</h2></div><span class="subtle">Select a day</span></div>
    ${
      weather.daily.length
        ? `<div class="day-columns" aria-hidden="true"><span>Day / conditions</span><span>Precip.</span><span>Low / high (°${unit})</span></div><div class="day-list">${weather.daily
            .map((day, index) => {
              const label = day.date === today ? "Today" : dateLabel(day.date);
              const expanded = selectedDay === day.date;
              return `<div><button class="day-row ${expanded ? "selected" : ""}" data-day="${esc(day.date)}" data-focus="day-${esc(day.date)}" aria-expanded="${expanded}" aria-controls="day-detail-${index}">
        <span class="day-name">${esc(label)}<small>${esc(dateLabel(day.date, { month: "short", day: "numeric" }))}</small></span>${weatherIcon(conditionKey(day.icon))}<span class="day-condition">${esc(day.condition ?? "Unavailable")}</span><span class="rain-value"><span class="sr-only">Precipitation probability </span>${measurement(day.precipitation.probability, "%", 0)}</span><span class="temperature-range"><span><span class="sr-only">Low </span>${temperature(day.low, unit)}</span><i aria-hidden="true"></i><strong><span class="sr-only">High </span>${temperature(day.high, unit)}</strong><span class="sr-only">°${unit}</span></span><span aria-hidden="true">${expanded ? "−" : "+"}</span>
      </button>${expanded ? renderDayDetail(day, index, weather, unit, weatherIcon) : `<div id="day-detail-${index}" hidden></div>`}</div>`;
            })
            .join(
              "",
            )}</div>${weather.daily.length < 7 ? `<p class="chart-note">Only ${weather.daily.length} forecast day${weather.daily.length === 1 ? " is" : "s are"} available. Refresh to check for a newer forecast.</p>` : ""}`
        : '<p class="empty-section">Daily forecast readings are unavailable. Refresh to check for a newer forecast.</p>'
    }
  </section>`;
}

function renderDayDetail(day, index, weather, unit, weatherIcon) {
  const stats = [
    [
      "Average temperature",
      temperature(day.temperature, unit, { includeUnit: true }),
    ],
    [
      "Average feels like",
      temperature(day.feelsLike, unit, { includeUnit: true }),
    ],
    ["Humidity", measurement(day.humidity, "%")],
    [
      "Wind",
      `${measurement(day.wind.speed, " km/h")} ${windDirection(day.wind.direction)}`,
    ],
    ["Gusts", measurement(day.wind.gust, " km/h")],
    ["UV index", `${measurement(day.uvIndex)} · ${uvCategory(day.uvIndex)}`],
    ["Visibility", measurement(day.visibility, " km")],
    ["Pressure", measurement(day.pressure, " hPa")],
    ["Precipitation total", measurement(day.precipitation.amount, " mm")],
    [
      "Precipitation probability",
      measurement(day.precipitation.probability, "%", 0),
    ],
    ["Sunrise", sunLabel(day.sunrise, weather.location.timezone)],
    ["Sunset", sunLabel(day.sunset, weather.location.timezone)],
  ];
  return `<div id="day-detail-${index}" class="day-detail"><p class="eyebrow">${esc(dateLabel(day.date, { month: "long", day: "numeric", year: "numeric" }))} · DAILY OUTLOOK</p><h3>${esc(day.condition ?? "Conditions unavailable")}</h3><p>High ${temperature(day.high, unit, { includeUnit: true })} / low ${temperature(day.low, unit, { includeUnit: true })}.</p><dl class="detail-stats">${stats.map(([name, value]) => `<div><dt>${name}</dt><dd>${value}</dd></div>`).join("")}</dl>
    ${
      day.hours.length
        ? `<h4 class="detail-hourly-title">Hourly forecast (°${unit})</h4><div class="hourly-scroll detail-hours" tabindex="0" data-focus="detail-hours-${esc(day.date)}" aria-label="Hourly readings for ${esc(day.date)} in °${unit}"><div class="hourly-track" style="--hour-count:${day.hours.length};--track-width:${Math.max(320, day.hours.length * 80)}px"><div class="hourly-items">${hourItems(day.hours, weather, unit, weatherIcon, null, day)}</div>${renderChart(day.hours, unit, weather.location.timezone)}</div></div>`
        : '<p class="chart-note">Hourly details are unavailable for this day.</p>'
    }</div>`;
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
  const date = localDate(
    weather.meta.referenceTimeMs,
    weather.location.timezone,
  );
  const today = weather.daily.find((day) => day.date === date);
  const sun = (name) => {
    const daily = sunLabel(today?.[name], weather.location.timezone);
    return daily !== "—"
      ? daily
      : current?.date === date
        ? sunLabel(current[name], weather.location.timezone)
        : "—";
  };
  return `<section class="panel metrics-section" aria-labelledby="details-title"><div class="section-heading"><div><p class="eyebrow">A CLOSER LOOK</p><h2 id="details-title">In the atmosphere</h2></div></div><dl class="metrics">${metrics.map(([label, value, note]) => `<div><dt>${label}</dt><dd>${value}</dd><span>${value === "—" ? "Not available" : note}</span></div>`).join("")}</dl><div class="sun-track"><div><span>Sunrise</span><strong>${sun("sunrise")}</strong></div><div class="sun-arc" aria-hidden="true">☀</div><div><span>Sunset</span><strong>${sun("sunset")}</strong></div></div><p class="chart-note">Other measurements stay metric. ${timeNote(weather)}</p></section>`;
}
