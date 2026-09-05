import { temperature } from "../utils/units.js";
import { conditions } from "../data/mockWeather.js";
import { weatherIcon } from "./assets.js";
export function dayLabel(day) {
  return day.index === 0
    ? "Today"
    : new Intl.DateTimeFormat("en", {
        weekday: "short",
        timeZone: "UTC",
      }).format(day.date);
}
export function renderHourly(weather, unit) {
  const values = weather.hourly.map((hour) => hour.temperature);
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const y = (value) => 110 - ((value - min) / (max - min)) * 80;
  const points = weather.hourly
    .map((hour, i) => `${i * 48 + 24},${y(hour.temperature)}`)
    .join(" ");
  return `<section class="panel hourly-section" aria-labelledby="hourly-title">
    <div class="section-heading"><div><p class="eyebrow">THE HOURS AHEAD</p><h2 id="hourly-title">Next 24 hours</h2></div><span class="subtle">Scroll to explore →</span></div>
    <div class="chart-legend"><span class="temp-key">Temperature (°${unit})</span><span class="rain-key">Rain probability (%)</span></div>
    <div class="hourly-scroll" tabindex="0" aria-label="24-hour forecast, scroll horizontally">
      <div class="hourly-track"><div class="hourly-items">${weather.hourly.map((hour) => `<div class="hour"><span>${hour.label}</span>${weatherIcon(hour.condition, hour.phase)}<span class="sr-only">${conditions[hour.condition]}</span><strong>${temperature(hour.temperature, unit)}</strong><span class="rain-value"><span class="sr-only">Rain probability </span>${hour.rain}%</span></div>`).join("")}</div>
      <svg class="forecast-chart" viewBox="0 0 1152 150" role="img" aria-label="Temperature and rain probability chart. Exact values are listed above.">
        <path d="M0 130 H1152 M0 70 H1152 M0 10 H1152" class="chart-grid" />
        ${weather.hourly.map((hour, i) => `<rect x="${i * 48 + 17}" y="${145 - hour.rain * 0.35}" width="14" height="${hour.rain * 0.35}" rx="3" class="rain-bar" />`).join("")}
        <polyline points="${points}" class="temperature-line" />
      </svg></div>
    </div><p class="chart-note">Line scale: ${temperature(min, unit)}–${temperature(max, unit)}${unit}. Rain bars: 0–100%. Exact hourly values above.</p>
  </section>`;
}
export function renderDaily(weather, unit, selectedDay) {
  return `<section class="panel daily-section" aria-labelledby="daily-title"><div class="section-heading"><div><p class="eyebrow">A LITTLE FURTHER OUT</p><h2 id="daily-title">Seven-day forecast</h2></div><span class="subtle">Select a day</span></div>
    <div class="day-columns" aria-hidden="true"><span>Day / conditions</span><span>Rain</span><span>Low / high</span></div>
    <div class="day-list">${weather.daily
      .map(
        (
          day,
        ) => `<div><button class="day-row ${selectedDay === day.index ? "selected" : ""}" data-day="${day.index}" aria-label="${dayLabel(day)}, ${conditions[day.condition]}, rain probability ${day.rain}%, low ${temperature(day.low, unit)}${unit}, high ${temperature(day.high, unit)}${unit}" aria-expanded="${selectedDay === day.index}" aria-controls="day-detail-${day.index}">
      <span class="day-name">${dayLabel(day)}</span>${weatherIcon(day.condition)}<span class="day-condition">${conditions[day.condition]}</span><span class="rain-value">${day.rain}%</span><span class="temperature-range"><span>${temperature(day.low, unit)}</span><i></i><strong>${temperature(day.high, unit)}</strong></span><span aria-hidden="true">${selectedDay === day.index ? "−" : "+"}</span>
    </button>${selectedDay === day.index ? renderDayDetail(day, weather, unit) : `<div id="day-detail-${day.index}" hidden></div>`}</div>`,
      )
      .join("")}</div></section>`;
}
function renderDayDetail(day, weather, unit) {
  const date = new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(day.date);
  return `<div id="day-detail-${day.index}" class="day-detail"><p class="eyebrow">${date.toUpperCase()} · DAILY OUTLOOK</p><h3>${conditions[day.condition]}, ${temperature(day.high, unit)} at the warmest.</h3><p>Rain probability ${day.rain}%. Wind from the southeast at ${weather.wind} km/h, with gusts up to ${weather.gusts} km/h.</p><dl class="detail-stats"><div><dt>Morning</dt><dd>${temperature(day.low + 1, unit)}</dd></div><div><dt>Afternoon</dt><dd>${temperature(day.high, unit)}</dd></div><div><dt>Evening</dt><dd>${temperature(day.low + 2, unit)}</dd></div><div><dt>Sunset</dt><dd>${weather.location.sunset}</dd></div></dl></div>`;
}
export function renderMetrics(weather, missing) {
  const metrics = [
    ["Humidity", `${weather.humidity}%`, "Relative humidity"],
    ["Wind", `${weather.wind} km/h`, `SE · gusts ${weather.gusts} km/h`],
    [
      "UV index",
      `${weather.uv} / 11+`,
      weather.uv >= 6 ? "High" : weather.uv >= 3 ? "Moderate" : "Low",
    ],
    ["Visibility", `${weather.visibility} km`, "Horizontal distance"],
    ["Pressure", `${weather.pressure} hPa`, "Sea-level pressure"],
    ["Precipitation", `${weather.precipitation} mm`, "Current-hour amount"],
  ];
  return `<section class="panel metrics-section" aria-labelledby="details-title"><div class="section-heading"><div><p class="eyebrow">A CLOSER LOOK</p><h2 id="details-title">In the atmosphere</h2></div></div><dl class="metrics">${metrics.map(([label, value, note], i) => `<div><dt>${label}</dt><dd>${missing && i > 2 ? "—" : value}</dd><span>${missing && i > 2 ? "Not available" : note}</span></div>`).join("")}</dl><div class="sun-track"><div><span>Sunrise</span><strong>${weather.location.sunrise}</strong></div><div class="sun-arc" aria-hidden="true">☀</div><div><span>Sunset</span><strong>${weather.location.sunset}</strong></div></div><p class="chart-note">Times are local to ${weather.location.name}.</p></section>`;
}
