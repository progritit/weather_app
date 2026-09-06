import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWeather } from "../data/normalizeWeather.js";
import { selectForecast, forecastWindowKey } from "../data/selectForecast.js";
import { createStore } from "../state.js";
import { createWeatherSearch } from "../search.js";
import { createStorage } from "../storage.js";
import { renderCurrent } from "./current.js";
import { renderHourly, renderDaily, renderMetrics } from "./forecast.js";
import { renderChart } from "./chart.js";
import { convertTemperature, temperature } from "../utils/units.js";
import {
  dateLabel,
  localDate,
  timeLabel,
  sunLabel,
  utcOffsetLabel,
} from "../utils/dates.js";

const HOUR = 3_600_000;
const icon = () => '<span class="test-icon" aria-hidden="true"></span>';

// Synthetic provider-shaped data. Tests never request a live provider.
function fixture(start = "2026-09-05") {
  const reading = {
    temp: 24,
    feelslike: 27,
    humidity: 72,
    windspeed: 18.4,
    windgust: 28,
    winddir: 90,
    pressure: 1013,
    visibility: 10,
    uvindex: 5,
    precip: 0.8,
    precipprob: 35,
    conditions: "Partially cloudy",
    icon: "partly-cloudy-day",
  };
  const days = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(Date.parse(`${start}T12:00:00Z`) + index * 24 * HOUR)
      .toISOString()
      .slice(0, 10);
    const midnight = Date.parse(`${date}T00:00:00-03:00`);
    return {
      ...reading,
      datetime: date,
      datetimeEpoch: midnight / 1000,
      tempmin: 20,
      tempmax: 28,
      sunrise: "06:00:00",
      sunriseEpoch: (midnight + 6 * HOUR) / 1000,
      sunset: "18:00:00",
      sunsetEpoch: (midnight + 18 * HOUR) / 1000,
      hours: Array.from({ length: 24 }, (_, hour) => ({
        ...reading,
        datetime: `${String(hour).padStart(2, "0")}:00:00`,
        datetimeEpoch: (midnight + hour * HOUR) / 1000,
      })),
    };
  });
  const observed = days[0].datetimeEpoch * 1000 + 23 * HOUR;
  return {
    data: {
      resolvedAddress: "Salvador, Bahia, Brazil",
      latitude: -12.97,
      longitude: -38.5,
      timezone: "America/Bahia",
      tzoffset: -3,
      days,
      alerts: [],
      currentConditions: {
        ...days[0],
        hours: undefined,
        datetime: "23:00:00",
        datetimeEpoch: observed / 1000,
        temp: 25.5,
        feelslike: 26.2,
        conditions: "Clear",
        icon: "clear-night",
      },
    },
    meta: {
      units: "metric",
      provider: "Visual Crossing",
      fetchedAt: new Date(observed + HOUR / 2).toISOString(),
      cache: "miss",
    },
  };
}

function frozen(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(frozen);
    Object.freeze(value);
  }
  return value;
}

function stateFor(weather, unit = "C") {
  return {
    weather,
    unit,
    landscape: "urban",
    saved: [],
    currentPlace: { id: "salvador", label: weather.location.label },
  };
}

test("one fetched model drives current, hourly, daily details and repeated unit changes", async () => {
  const payload = fixture();
  const now = Date.parse(payload.meta.fetchedAt);
  const store = createStore();
  const entries = new Map();
  const storage = createStorage(() => ({
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  }));
  let requests = 0;
  const search = createWeatherSearch({
    store,
    storage,
    now: () => now,
    request: async () => {
      requests += 1;
      return payload;
    },
  });
  await search.search("Salvador");
  const source = frozen(store.getState().weather);
  const snapshot = JSON.parse(JSON.stringify(source));
  const date = source.daily[0].date;
  const metrics = renderMetrics(source);
  store.setState({ day: date });
  for (const unit of ["F", "C", "F", "C"]) {
    assert.equal(store.setUnit(unit), true);
    storage.writePreferences(store.getState());
    const state = store.getState();
    const weather = selectForecast(state.weather, now);
    const hero = renderCurrent({ ...state, weather }, now, icon);
    const hourly = renderHourly(weather, unit, icon);
    const daily = renderDaily(weather, unit, state.day, icon);
    assert.match(hero, unit === "F" ? /Feels like 79°F/ : /Feels like 26°C/);
    assert.match(hero, unit === "F" ? /H 82°F \/ L 68°F/ : /H 28°C \/ L 20°C/);
    assert.match(hourly, new RegExp(`Temperature \\(°${unit}\\)`));
    assert.equal((hourly.match(/class="hour"/g) ?? []).length, 24);
    assert.equal((daily.match(/data-day=/g) ?? []).length, 7);
    assert.match(
      daily,
      unit === "F"
        ? /Average temperature<\/dt><dd>75°F/
        : /Average temperature<\/dt><dd>24°C/,
    );
    assert.match(
      daily,
      unit === "F"
        ? /Average feels like<\/dt><dd>81°F/
        : /Average feels like<\/dt><dd>27°C/,
    );
    assert.match(
      daily,
      unit === "F"
        ? /Temperature scale: 72°F to 79°F/
        : /Temperature scale: 22°C to 26°C/,
    );
    assert.equal(renderMetrics(weather), metrics);
    assert.equal(state.weather, source);
    assert.equal(state.day, date);
    assert.equal(requests, 1);
    assert.equal(storage.readPreferences().unit, unit);
  }
  assert.deepEqual(source, snapshot);
  assert.equal(store.setUnit("Kelvin"), false);
  assert.equal(store.setUnit("C"), false);
  assert.equal(requests, 1);
});

test("forecast dates cross local midnight and New Year without altering observations", () => {
  const weather = frozen(normalizeWeather(fixture("2026-12-31")));
  const before = selectForecast(weather, Date.parse("2027-01-01T02:30:00Z"));
  const hours = renderHourly(before, "C", icon);
  assert.match(hours, />Now<\/time><small>Dec 31<\/small>/);
  assert.match(hours, />00:00<\/time><small>Jan 1<\/small>/);
  const midnight = Date.parse("2027-01-01T03:00:00Z");
  const after = selectForecast(weather, midnight);
  assert.equal(after.hourly[0].timestampMs, midnight);
  assert.equal(after.hourly.length, 24);
  assert.equal(after.daily[0].date, "2027-01-01");
  assert.notEqual(forecastWindowKey(before), forecastWindowKey(after));
  assert.equal(
    forecastWindowKey(after),
    forecastWindowKey(selectForecast(weather, midnight + 50 * 60_000)),
  );
  assert.equal(after.current, weather.current);
  assert.equal(after.meta.fetchedAtMs, weather.meta.fetchedAtMs);
  assert.equal(after.current.date, "2026-12-31");
  assert.match(
    renderDaily(after, "C", null, icon),
    /Only 6 forecast days are available/,
  );
  const exhausted = selectForecast(weather, midnight + 10 * 24 * HOUR);
  assert.equal(exhausted.hourly.length, 0);
  assert.equal(exhausted.daily.length, 0);
});

test("Paris autumn repeated hours and spring skipped hours follow epochs and GMT offsets", () => {
  for (const [date, start, count, expectedTimes, expectedOffsets] of [
    [
      "2026-10-25",
      "2026-10-24T22:00:00Z",
      25,
      ["01:00", "02:00", "02:00", "03:00"],
      ["GMT+2", "GMT+1"],
    ],
    [
      "2026-03-29",
      "2026-03-28T23:00:00Z",
      23,
      ["01:00", "03:00", "04:00", "05:00"],
      ["GMT+1", "GMT+2"],
    ],
  ]) {
    const payload = fixture();
    const day = payload.data.days[0];
    const startMs = Date.parse(start);
    Object.assign(day, { datetime: date, datetimeEpoch: startMs / 1000 });
    day.hours = Array.from({ length: count }, (_, i) => ({
      ...day.hours[0],
      datetimeEpoch: (startMs + i * HOUR) / 1000,
      datetime: `${timeLabel(startMs + i * HOUR, "Europe/Paris")}:00`,
    }));
    Object.assign(payload.data, {
      timezone: "Europe/Paris",
      resolvedAddress: "Paris, France",
      days: [day],
    });
    const weather = normalizeWeather(payload, {
      referenceTimeMs: startMs + HOUR / 2,
    });
    assert.deepEqual(
      weather.daily[0].hours
        .slice(1, 5)
        .map((hour) => timeLabel(hour.timestampMs, "Europe/Paris")),
      expectedTimes,
    );
    const html = renderDaily(weather, "F", date, icon);
    assert.equal((html.match(/class="hour"/g) ?? []).length, count);
    for (const offset of expectedOffsets)
      assert.ok(html.includes(`class="hour-offset">${offset}`));
    const line = renderChart(weather.daily[0].hours, "F", "Europe/Paris").match(
      /<path d="([^"]*)" class="temperature-line"/,
    )[1];
    assert.equal((line.match(/M/g) ?? []).length, 1);
    assert.equal((line.match(/L/g) ?? []).length, count - 1);
  }
});

test("missing readings render as unavailable, while true zero amounts remain zero", () => {
  const payload = fixture();
  payload.data.currentConditions = null;
  const day = payload.data.days[0];
  for (const item of [day, ...day.hours]) {
    Object.assign(item, {
      temp: null,
      feelslike: null,
      precipprob: null,
      precip: null,
      humidity: null,
      windspeed: null,
    });
  }
  const weather = normalizeWeather(payload);
  weather.hourly = weather.daily[0].hours;
  const html = [
    renderCurrent(stateFor(weather, "F"), weather.meta.referenceTimeMs, icon),
    renderHourly(weather, "F", icon),
    renderDaily(weather, "F", day.datetime, icon),
    renderMetrics(weather),
  ].join("");
  assert.match(html, /Temperature unavailable/);
  assert.match(html, /Precipitation probability<\/dt><dd>—<\/dd>/);
  assert.match(html, /Precipitation<\/dt><dd>—<\/dd>/);
  assert.doesNotMatch(html, /NaN|Infinity|undefined|>null</);
  const chart = renderChart(weather.hourly, "C");
  assert.doesNotMatch(chart, /<rect|<circle/);
  weather.current = normalizeWeather(fixture()).current;
  weather.current.precipitation.amount = 0;
  weather.current.precipitation.probability = 0;
  assert.match(renderMetrics(weather), /Precipitation<\/dt><dd>0 mm<\/dd>/);
  assert.match(renderChart([weather.current], "C"), /height="0"/);
});

test("cached weather is labelled cached in the hero freshness line", () => {
  const weather = normalizeWeather(fixture());
  const html = renderCurrent(
    {
      ...stateFor(weather),
      weatherSource: "stale-cache",
      cacheTimestampMs: Date.parse("2026-09-06T00:00:00Z"),
    },
    weather.meta.referenceTimeMs,
    icon,
  );
  assert.match(html, /· Cached Sep 5, 21:00 local/);
  assert.doesNotMatch(html, /· Retrieved Sep 5, 21:00 local/);
});

test("sun-event fallback uses only the current local day and all detail units are explicit", () => {
  const weather = normalizeWeather(fixture());
  weather.daily[0].sunrise = { local: null, timestampMs: null };
  weather.daily[0].sunset = { local: null, timestampMs: null };
  const html = renderMetrics(weather);
  assert.match(html, /Sunrise<\/span><strong>06:00/);
  assert.match(html, /Sunset<\/span><strong>18:00/);
  for (const value of [
    "18.4 km/h",
    "28 km/h",
    "10 km",
    "1013 hPa",
    "0.8 mm",
    "72%",
  ])
    assert.ok(html.includes(value));
  weather.current.date = "2026-09-04";
  assert.match(renderMetrics(weather), /Sunrise<\/span><strong>—/);
  assert.match(renderMetrics(weather), /Sunset<\/span><strong>—/);
});

test("numeric conversions preserve precision and local formatters reject impossible dates", () => {
  assert.equal(convertTemperature(-40, "F"), -40);
  assert.equal(convertTemperature(0, "F"), 32);
  assert.equal(convertTemperature(100, "F"), 212);
  assert.equal(convertTemperature(21.25, "F"), 70.25);
  assert.equal(convertTemperature(null, "F"), null);
  assert.equal(temperature(-0.1, "C", { includeUnit: true }), "0°C");
  assert.equal(dateLabel("2026-02-30"), "—");
  assert.equal(sunLabel({ local: "25:61:00" }, null), "—");
  const time = Date.parse("2026-09-05T23:30:00Z");
  assert.equal(localDate(time, "America/Bahia"), "2026-09-05");
  assert.equal(localDate(time, "Asia/Kathmandu"), "2026-09-06");
  assert.equal(timeLabel(time, "Asia/Kathmandu"), "05:15");
  assert.equal(utcOffsetLabel(time, "Asia/Kathmandu"), "GMT+5:45");
  assert.equal(timeLabel(time, "Unknown/Timezone"), "—");
});

test("temperature chart changes labels without changing the physical curve and preserves time gaps", () => {
  const weather = normalizeWeather(fixture());
  const hours = weather.hourly.slice(0, 4).map((hour, index) => ({
    ...hour,
    temperature: 10 + index * 5,
    precipitation: { probability: index === 0 ? 100 : null },
  }));
  hours[2].timestampMs += HOUR;
  hours[3].timestampMs += HOUR;
  const c = renderChart(hours, "C", weather.location.timezone);
  const f = renderChart(hours, "F", weather.location.timezone);
  const line = (html) =>
    html.match(/<path d="([^"]*)" class="temperature-line"/)[1];
  const coordinates = (path) =>
    path.match(/[ML][-\d.,]+/g).map((command) => {
      const [, type, x, y] = command.match(/([ML])([-\d.]+),([-\d.]+)/);
      return [type, Number(x), Number(y)];
    });
  const cCoordinates = coordinates(line(c));
  const fCoordinates = coordinates(line(f));
  assert.equal(cCoordinates.length, fCoordinates.length);
  cCoordinates.forEach(([type, x, y], index) => {
    assert.equal(type, fCoordinates[index][0]);
    assert.ok(Math.abs(x - fCoordinates[index][1]) < 1e-9);
    assert.ok(Math.abs(y - fCoordinates[index][2]) < 1e-9);
  });
  assert.equal((line(c).match(/M/g) ?? []).length, 2);
  assert.match(c, /height="120"/);
  assert.match(c, />27°C<\/span>/);
  assert.match(f, />81°F<\/span>/);
  assert.equal((c.match(/<rect/g) ?? []).length, 1);
});

test("resolved locations and condition text are escaped in all core renderers", () => {
  const weather = normalizeWeather(fixture());
  weather.location.label = '<img src=x onerror="bad()">, Brazil';
  weather.current.condition = "<script>bad()</script>";
  weather.daily[0].condition = weather.current.condition;
  const html =
    renderCurrent(stateFor(weather), weather.meta.referenceTimeMs, icon) +
    renderDaily(weather, "C", weather.daily[0].date, icon) +
    renderHourly(weather, "C", icon);
  assert.doesNotMatch(html, /<script>|<img src=x/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img/);
});
