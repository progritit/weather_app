import test from "node:test";
import assert from "node:assert/strict";
import { renderChart } from "./chart.js";
import { measurement, temperature, windDirection } from "../utils/units.js";
import { formatLocal, sunLabel } from "../utils/dates.js";
import { conditionKey, phaseFor, activeAlerts } from "../utils/conditions.js";
import { escapeHtml } from "../utils/html.js";

function hour(index, value, probability) {
  return {
    timestampMs: index * 3_600_000,
    temperature: value,
    precipitation: { probability },
  };
}

test("unknown chart readings leave gaps and never create fabricated zero-percent bars", () => {
  const output = renderChart(
    [hour(0, 20, null), hour(1, null, null), hour(2, 22, null)],
    "C",
  );
  assert.equal(output.includes("<rect"), false);
  assert.equal(output.includes("NaN"), false);
  assert.equal(output.includes("Infinity"), false);
  const line = output.match(/<path d="([^"]*)" class="temperature-line"/)[1];
  assert.equal((line.match(/M/g) ?? []).length, 2);
  assert.equal(line.includes("L"), false);
  const empty = renderChart([hour(0, null, null)], "C");
  assert.match(empty, /Temperature readings unavailable/);
  assert.equal(empty.includes("NaN"), false);
  assert.equal(empty.includes("<circle"), false);
});

test("real zero readings and Fahrenheit labels remain present", () => {
  const output = renderChart([hour(0, 0, 0)], "F");
  assert.match(output, /height="0"/);
  assert.match(output, /28°F to 36°F/);
  assert.equal(temperature(0, "F"), "32°");
  assert.equal(temperature(null, "F"), "—");
  assert.equal(measurement(null, "%"), "—");
  assert.equal(measurement(0, "%"), "0%");
  assert.equal(windDirection(0), "N");
  assert.equal(windDirection(null), "—");
});

test("the plot reserves gutters so edge precipitation bars stay visible", () => {
  const output = renderChart([hour(0, 20, 100), hour(1, 21, 50)], "C");
  const bars = [...output.matchAll(/<rect x="([\d.]+)"/g)].map((match) =>
    Number(match[1]),
  );
  const [firstBarX, lastBarX] = bars;
  assert.equal(bars.length, 2);
  assert.ok(firstBarX >= 40);
  assert.ok(lastBarX > firstBarX);
});

test("charts expose a keyboard-readable data-table alternative", () => {
  const output = renderChart(
    [hour(0, 20, 25), hour(1, null, null)],
    "C",
    "America/Bahia",
  );
  assert.match(output, /role="img" aria-label="Temperature \(°C\)/);
  assert.match(output, /View chart data as a table/);
  assert.match(output, /<table>/);
  assert.match(output, /Temperature \(°C\)/);
  assert.match(output, /Precipitation probability/);
  assert.match(output, /20°C/);
  assert.match(output, />—<\/td>/);
});

test("local formatting uses the requested timezone and tolerates absent timestamps", () => {
  const time = Date.parse("2026-09-06T01:00:00Z");
  assert.match(
    formatLocal(time, "America/Bahia", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      hourCycle: "h23",
    }),
    /Sep 5/,
  );
  assert.equal(formatLocal(null, "Europe/Paris"), "—");
  assert.equal(formatLocal(time, "Unknown/Place"), "—");
  assert.equal(
    sunLabel({ local: "05:35:32", timestampMs: null }, "America/Bahia"),
    "05:35",
  );
});

test("provider icons and local sunrise/sunset select bounded themes", () => {
  assert.equal(conditionKey("cloudy"), "overcast");
  assert.equal(conditionKey("partly-cloudy-night"), "partly-cloudy");
  assert.equal(conditionKey("thunder-rain"), "thunderstorm");
  assert.equal(conditionKey("../../unknown"), "unknown");
  assert.equal(conditionKey(null), "unknown");
  const reading = {
    icon: "rain",
    sunrise: { timestampMs: 100 },
    sunset: { timestampMs: 200 },
  };
  assert.equal(phaseFor(reading, reading, 150), "day");
  assert.equal(phaseFor(reading, reading, 200), "night");
  assert.equal(phaseFor({ icon: "rain" }), null);
});

test("expired and future alerts stay out of the current banner", () => {
  const alerts = [
    { id: "active", onset: { timestampMs: 10 }, ends: { timestampMs: 100 } },
    { id: "ended", onset: { timestampMs: 0 }, ends: { timestampMs: 50 } },
    { id: "future", onset: { timestampMs: 70 }, ends: { timestampMs: 100 } },
    {
      id: "unknown",
      onset: { timestampMs: null },
      ends: { timestampMs: null },
    },
  ];
  assert.deepEqual(
    activeAlerts({ alerts }, 50).map((item) => item.id),
    ["active", "unknown"],
  );
});

test("provider text and saved labels cannot introduce HTML markup", () => {
  assert.equal(
    escapeHtml('<img src="x" onerror="alert(1)"> & Paris'),
    "&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt; &amp; Paris",
  );
  assert.equal(escapeHtml("O'Fallon"), "O&#39;Fallon");
});
