import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWeather } from "./normalizeWeather.js";

const HOUR_MS = 3_600_000;
const epoch = (iso) => Date.parse(iso) / 1000;

// Representative test data, not a live weather report.
function makeDay(date) {
  const midnight = Date.parse(`${date}T00:00:00-03:00`);
  return {
    datetime: date,
    datetimeEpoch: midnight / 1000,
    temp: 25,
    tempmax: 28,
    tempmin: 23,
    precip: null,
    precipprob: 26,
    sunrise: "05:35:32",
    sunriseEpoch: (midnight + 5 * HOUR_MS + 35 * 60_000 + 32_000) / 1000,
    hours: Array.from({ length: 24 }, (_, hour) => ({
      datetime: `${String(hour).padStart(2, "0")}:00:00`,
      datetimeEpoch: (midnight + hour * HOUR_MS) / 1000,
      temp: 25,
      precip: null,
      precipprob: 0,
    })),
  };
}

function fixture() {
  return {
    data: {
      latitude: -12.9714,
      longitude: -38.5014,
      resolvedAddress: "Salvador, Bahia, Brasil",
      address: "Salvador",
      timezone: "America/Bahia",
      tzoffset: -3,
      queryCost: 1,
      stations: { SBSV: { name: "SBSV" } },
      currentConditions: {
        datetime: "20:00:00",
        datetimeEpoch: epoch("2026-09-05T23:00:00Z"),
        temp: 25,
        feelslike: 25,
        humidity: 78.5,
        precip: null,
        precipprob: 0,
        preciptype: null,
        windgust: null,
        windspeed: 18.4,
        winddir: 60,
        pressure: 1013,
        visibility: 10,
        uvindex: 0,
        conditions: "Clear",
        icon: "clear-night",
        sunrise: "05:35:32",
        sunriseEpoch: epoch("2026-09-05T08:35:32Z"),
        sunset: "17:30:05",
        sunsetEpoch: epoch("2026-09-05T20:30:05Z"),
        stations: ["SBSV"],
        moonphase: 0.8,
      },
      days: [makeDay("2026-09-05"), makeDay("2026-09-06")],
      alerts: [
        {
          id: "test-alert-1",
          event: "Chuvas Intensas",
          headline: "Aviso de Chuvas Intensas",
          description:
            "Chuva e ventos intensos. Atenção às orientações locais.",
          language: "pt",
          link: "https://avisos.inmet.gov.br/55599",
          onset: "2026-09-03T09:00:00",
          onsetEpoch: epoch("2026-09-03T12:00:00Z"),
          ends: "2026-09-06T08:30:50",
          endsEpoch: epoch("2026-09-06T11:30:50Z"),
        },
      ],
    },
    meta: {
      provider: "Visual Crossing",
      units: "metric",
      fetchedAt: "2026-09-05T23:52:39.847Z",
      cache: "miss",
      cacheTtlSeconds: 600,
    },
  };
}

test("keeps the required metric readings, location and distinct timestamps", () => {
  const result = normalizeWeather(fixture());
  assert.deepEqual(result.location, {
    label: "Salvador, Bahia, Brasil",
    city: "Salvador",
    region: "Bahia",
    country: "Brasil",
    latitude: -12.9714,
    longitude: -38.5014,
    timezone: "America/Bahia",
  });
  assert.equal(result.current.temperature, 25);
  assert.equal(result.current.feelsLike, 25);
  assert.equal(result.current.date, "2026-09-05");
  assert.equal(result.current.datetimeLocal, "20:00:00");
  assert.equal(result.current.timestampMs, Date.parse("2026-09-05T23:00:00Z"));
  assert.equal(result.current.utcOffsetHours, -3);
  assert.equal(result.current.condition, "Clear");
  assert.equal(result.current.icon, "clear-night");
  assert.equal(result.current.humidity, 78.5);
  assert.deepEqual(result.current.wind, {
    speed: 18.4,
    gust: null,
    direction: 60,
  });
  assert.equal(result.current.visibility, 10);
  assert.equal(result.current.pressure, 1013);
  assert.equal(result.current.uvIndex, 0);
  assert.deepEqual(result.current.precipitation, {
    amount: null,
    probability: 0,
    types: null,
  });
  assert.deepEqual(result.current.sunrise, {
    local: "05:35:32",
    timestampMs: Date.parse("2026-09-05T08:35:32Z"),
  });
  assert.equal(
    result.current.sunset.timestampMs,
    Date.parse("2026-09-05T20:30:05Z"),
  );
  assert.equal(result.daily[0].high, 28);
  assert.equal(result.daily[0].low, 23);
  assert.equal(result.meta.units, "metric");
  assert.equal(result.meta.fetchedAtMs, Date.parse("2026-09-05T23:52:39.847Z"));
  assert.equal(result.meta.referenceTimeMs, result.meta.fetchedAtMs);
  assert.equal(result.meta.cacheTtlSeconds, 600);
  assert.equal("stations" in result, false);
  assert.equal("queryCost" in result, false);
  assert.equal("stations" in result.current, false);
  assert.equal("moonphase" in result.current, false);
});

test("missing and invalid readings stay null; real zeros survive at every level", () => {
  for (const missing of [undefined, null, "", "0", false, NaN, Infinity]) {
    const payload = fixture();
    const records = [
      payload.data.currentConditions,
      payload.data.days[0],
      payload.data.days[0].hours[20],
    ];
    for (const record of records) {
      Object.assign(record, {
        precip: 0,
        precipprob: missing,
        temp: missing,
        windgust: missing,
        humidity: missing,
        visibility: missing,
        pressure: missing,
        uvindex: missing,
      });
    }
    const result = normalizeWeather(payload);
    for (const reading of [result.current, result.daily[0], result.hourly[0]]) {
      assert.equal(reading.precipitation.amount, 0);
      assert.equal(reading.precipitation.probability, null);
      assert.equal(reading.temperature, null);
      assert.equal(reading.wind.gust, null);
      assert.equal(reading.humidity, null);
      assert.equal(reading.visibility, null);
      assert.equal(reading.pressure, null);
      assert.equal(reading.uvIndex, null);
    }
  }
  const payload = fixture();
  Object.assign(payload.data.currentConditions, {
    temp: 0,
    windspeed: 0,
    windgust: 0,
    winddir: 0,
    humidity: 0,
    visibility: 0,
    uvindex: 0,
    precip: 0,
    precipprob: 0,
    preciptype: [],
  });
  const { current } = normalizeWeather(payload);
  assert.equal(current.temperature, 0);
  assert.deepEqual(current.wind, { speed: 0, gust: 0, direction: 0 });
  assert.equal(current.humidity, 0);
  assert.equal(current.visibility, 0);
  assert.equal(current.uvIndex, 0);
  assert.deepEqual(current.precipitation, {
    amount: 0,
    probability: 0,
    types: [],
  });
});

test("invalid ranges become null without inventing precipitation probability", () => {
  const payload = fixture();
  Object.assign(payload.data.currentConditions, {
    temp: -6,
    precip: -1,
    precipprob: 101,
    humidity: -1,
    windspeed: -1,
    winddir: 400,
    preciptype: ["snow", null, "", 4],
  });
  payload.data.latitude = 100;
  payload.data.longitude = 190;
  const result = normalizeWeather(payload);
  assert.equal(result.current.temperature, -6);
  assert.deepEqual(result.current.precipitation, {
    amount: null,
    probability: null,
    types: ["snow"],
  });
  assert.equal(result.current.humidity, null);
  assert.equal(result.current.wind.speed, null);
  assert.equal(result.current.wind.direction, null);
  assert.equal(result.location.latitude, null);
  assert.equal(result.location.longitude, null);
});

test("selects seven local days and 24 ordered hours, including the current interval", () => {
  const payload = fixture();
  payload.data.days = Array.from({ length: 10 }, (_, i) =>
    makeDay(`2026-09-${String(i + 4).padStart(2, "0")}`),
  ).reverse();
  for (const day of payload.data.days) day.hours.reverse();
  payload.data.days.at(-2).hours.push({ ...payload.data.days.at(-2).hours[0] });
  const result = normalizeWeather(payload);
  assert.deepEqual(
    result.daily.map((day) => day.date),
    [
      "2026-09-05",
      "2026-09-06",
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
    ],
  );
  assert.equal(result.hourly.length, 24);
  assert.equal(
    result.hourly[0].timestampMs,
    Date.parse("2026-09-05T23:00:00Z"),
  );
  assert.equal(
    result.hourly.at(-1).timestampMs,
    Date.parse("2026-09-06T22:00:00Z"),
  );
  assert.equal(new Set(result.hourly.map((hour) => hour.timestampMs)).size, 24);
  assert.equal(result.daily[1].hours.length, 24);
  assert.equal(result.daily[1].hours[0].datetimeLocal, "00:00:00");
  assert.equal(result.daily[1].hours.at(-1).datetimeLocal, "23:00:00");
});

test("an explicit reference reselects cached data using the location's calendar", () => {
  const payload = fixture();
  payload.meta.cache = "hit";
  const result = normalizeWeather(payload, {
    referenceTimeMs: Date.parse("2026-09-06T01:00:00Z"),
  });
  // UTC is already September 6; Salvador is still September 5, 22:00.
  assert.equal(result.daily[0].date, "2026-09-05");
  assert.equal(result.hourly[0].datetimeLocal, "22:00:00");
  assert.equal(
    result.hourly[0].timestampMs,
    Date.parse("2026-09-06T01:00:00Z"),
  );
  assert.equal(result.meta.fetchedAtMs, Date.parse(payload.meta.fetchedAt));
  assert.equal(result.current.timestampMs, Date.parse("2026-09-05T23:00:00Z"));
  assert.equal(result.meta.cache, "hit");
});

test("Paris daylight-saving repeated hours retain separate epochs and offsets", () => {
  const payload = fixture();
  payload.data.timezone = "Europe/Paris";
  payload.data.tzoffset = 2;
  payload.data.days = [
    {
      datetime: "2026-10-25",
      datetimeEpoch: epoch("2026-10-24T22:00:00Z"),
      hours: [
        {
          datetime: "02:00:00",
          datetimeEpoch: epoch("2026-10-25T01:00:00Z"),
          tzoffset: 1,
          temp: 9,
        },
        {
          datetime: "02:00:00",
          datetimeEpoch: epoch("2026-10-25T00:00:00Z"),
          tzoffset: 2,
          temp: 10,
        },
      ],
    },
  ];
  const result = normalizeWeather(payload, {
    referenceTimeMs: Date.parse("2026-10-25T00:30:00Z"),
  });
  assert.equal(result.hourly.length, 2);
  assert.deepEqual(
    result.hourly.map((hour) => hour.datetimeLocal),
    ["02:00:00", "02:00:00"],
  );
  assert.deepEqual(
    result.hourly.map((hour) => hour.utcOffsetHours),
    [2, 1],
  );
  assert.equal(
    result.hourly[1].timestampMs - result.hourly[0].timestampMs,
    HOUR_MS,
  );
  assert.equal(result.location.timezone, "Europe/Paris");
});

test("missing sections differ from supplied empty arrays; missing hours are not fabricated", () => {
  const empty = normalizeWeather({ data: {}, meta: { units: "metric" } });
  assert.equal(empty.current, null);
  assert.deepEqual(empty.daily, []);
  assert.deepEqual(empty.hourly, []);
  assert.deepEqual(empty.alerts, []);
  assert.deepEqual(empty.availability, {
    current: false,
    daily: false,
    hourly: false,
    alerts: false,
  });
  assert.equal(empty.meta.referenceTimeMs, null);

  const payload = fixture();
  payload.data.alerts = [];
  payload.data.days = [
    {
      datetime: "2026-09-05",
      hours: [
        null,
        { datetime: "20:00:00", temp: 25 },
        {
          datetime: "21:00:00",
          datetimeEpoch: epoch("2026-09-06T00:00:00Z"),
          temp: 24,
        },
      ],
    },
  ];
  const result = normalizeWeather(payload);
  assert.equal(result.hourly.length, 1);
  assert.equal(result.daily[0].hours.length, 2);
  assert.equal(result.daily[0].hours[1].timestampMs, null);
  assert.equal(result.daily[0].high, null);
  assert.deepEqual(result.alerts, []);
  assert.equal(result.availability.alerts, true);
  assert.equal(result.availability.hourly, true);
});

test("alert text and provider times survive; unzoned strings are not machine-local timestamps", () => {
  const payload = fixture();
  payload.data.alerts.push({
    onset: "2026-09-05T20:00:00",
    ends: "2026-09-06T10:00:00-03:00",
    link: "javascript:alert(1)",
  });
  const result = normalizeWeather(payload);
  assert.equal(
    result.alerts[0].description,
    payload.data.alerts[0].description,
  );
  assert.equal(result.alerts[0].language, "pt");
  assert.equal(result.alerts[0].link, "https://avisos.inmet.gov.br/55599");
  assert.deepEqual(result.alerts[0].onset, {
    local: "2026-09-03T09:00:00",
    timestampMs: Date.parse("2026-09-03T12:00:00Z"),
  });
  assert.equal(
    result.alerts[0].ends.timestampMs,
    Date.parse("2026-09-06T11:30:50Z"),
  );
  assert.equal(result.alerts[1].onset.timestampMs, null);
  assert.equal(
    result.alerts[1].ends.timestampMs,
    Date.parse("2026-09-06T13:00:00Z"),
  );
  assert.equal(result.alerts[1].link, null);
  assert.equal(result.alerts[1].id, null);
  assert.equal("severity" in result.alerts[0], false);
});

test("unknown timezones and absent epochs never fall back to the computer's timezone", () => {
  const payload = fixture();
  payload.data.timezone = "Unknown/Place";
  payload.meta.fetchedAt = "2026-09-05T20:00:00";
  delete payload.data.currentConditions.datetimeEpoch;
  const result = normalizeWeather(payload);
  assert.equal(result.location.timezone, "Unknown/Place");
  assert.equal(result.current.timestampMs, null);
  assert.equal(result.current.date, null);
  assert.equal(result.meta.fetchedAtMs, null);
  assert.equal(result.meta.referenceTimeMs, null);
  assert.deepEqual(result.hourly, []);
  assert.equal(result.daily[0].date, "2026-09-05");
  assert.equal(result.daily[0].hours.length, 24);
});

test("rejects malformed envelopes, wrong units and invalid reference timestamps", () => {
  for (const payload of [null, [], {}, { data: null }, { data: [] }]) {
    assert.throws(() => normalizeWeather(payload), TypeError);
  }
  for (const units of [undefined, "us", "uk"]) {
    assert.throws(
      () => normalizeWeather({ data: {}, meta: { units } }),
      /metric/,
    );
  }
  for (const referenceTimeMs of [null, "0", NaN, Infinity, 9e15]) {
    assert.throws(
      () => normalizeWeather(fixture(), { referenceTimeMs }),
      /referenceTimeMs/,
    );
  }
});

test("transformation is repeatable and leaves the entire source unchanged", () => {
  function deepFreeze(value) {
    if (value && typeof value === "object") {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  }
  const payload = fixture();
  payload.data.currentConditions.preciptype = ["rain"];
  const original = JSON.stringify(payload);
  deepFreeze(payload);
  const first = normalizeWeather(payload);
  const second = normalizeWeather(payload);
  assert.deepEqual(first, second);
  first.current.precipitation.types.push("snow");
  first.daily[0].hours[0].temperature = -100;
  first.alerts[0].event = "Changed locally";
  assert.equal(JSON.stringify(payload), original);
  assert.deepEqual(second.current.precipitation.types, ["rain"]);
  assert.equal(second.daily[0].hours[0].temperature, 25);
});
