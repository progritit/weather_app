import test from "node:test";
import assert from "node:assert/strict";
import {
  createStorage,
  rememberPlace,
  MAX_RECENT,
  WEATHER_CACHE_TTL_MS,
  WEATHER_CACHE_STALE_MS,
} from "./storage.js";

test("recent locations are deduplicated, ordered and capped", () => {
  let recent = [];
  for (let index = 0; index < 12; index += 1)
    recent = rememberPlace(recent, {
      id: `place:${index}`,
      label: `Place ${index}`,
      query: `Place ${index}`,
    });
  assert.equal(recent.length, MAX_RECENT);
  const revisited = recent[3];
  recent = rememberPlace(recent, revisited);
  assert.equal(recent[0], revisited);
  assert.equal(recent.filter((place) => place.id === revisited.id).length, 1);
});

test("preferences and recent searches survive a new storage instance", () => {
  const values = new Map();
  const getStorage = () => ({
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  });
  const first = createStorage(getStorage);
  const place = {
    id: "place:paris, france",
    query: "Paris, France",
    label: "Paris, France",
  };
  first.writeRecent([place]);
  first.writePreferences({
    unit: "F",
    saved: [place],
    defaultId: place.id,
    landscape: "countryside",
  });
  const second = createStorage(getStorage);
  assert.deepEqual(second.readRecent(), [place]);
  assert.deepEqual(second.readPreferences(), {
    unit: "F",
    saved: [place],
    defaultId: place.id,
    landscape: "countryside",
  });
  first.writeRecent([]);
  assert.deepEqual(second.readRecent(), []);
});

test("corrupt or unavailable browser storage does not break the session", () => {
  const malformed = createStorage(() => ({ getItem: () => "{broken" }));
  assert.deepEqual(malformed.readRecent(), []);
  assert.deepEqual(malformed.readPreferences().saved, []);
  const denied = createStorage(() => {
    throw new Error("Access denied");
  });
  assert.deepEqual(denied.readRecent(), []);
  assert.doesNotThrow(() => denied.writeRecent([]));
  assert.doesNotThrow(() => denied.writePreferences({ unit: "C", saved: [] }));
});

test("malformed entries and unknown defaults are dropped on load", () => {
  const storage = createStorage(() => ({
    getItem: () =>
      JSON.stringify({
        unit: "Kelvin",
        landscape: "mars",
        defaultId: "unknown",
        saved: [
          { query: { latitude: 200, longitude: 0 }, label: "Invalid" },
          { query: "Paris", label: "Paris" },
        ],
      }),
  }));
  const value = storage.readPreferences();
  assert.equal(value.unit, "C");
  assert.equal(value.landscape, "urban");
  assert.equal(value.defaultId, null);
  assert.equal(value.saved.length, 1);
});

test("weather cache expires briefly, can serve bounded stale data, and rounds coordinates", () => {
  const values = new Map();
  const storage = createStorage(() => ({
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  }));
  const weather = {
    location: { label: "Salvador, Brazil", timezone: "America/Bahia" },
    meta: { units: "metric" },
    current: { temperature: 25 },
  };
  const cachedAtMs = 1_000_000;
  storage.writeWeatherCache(
    { latitude: -12.97144, longitude: -38.50144 },
    weather,
    { cachedAtMs },
  );
  const fresh = storage.readWeatherCache(
    { latitude: -12.971, longitude: -38.501 },
    { now: cachedAtMs + WEATHER_CACHE_TTL_MS - 1 },
  );
  assert.deepEqual(fresh.weather, weather);
  assert.equal(fresh.stale, false);
  assert.equal(
    storage.readWeatherCache(
      { latitude: -12.971, longitude: -38.501 },
      { now: cachedAtMs + WEATHER_CACHE_TTL_MS + 1 },
    ),
    null,
  );
  const stale = storage.readWeatherCache(
    { latitude: -12.971, longitude: -38.501 },
    { now: cachedAtMs + WEATHER_CACHE_TTL_MS + 1, allowStale: true },
  );
  assert.deepEqual(stale.weather, weather);
  assert.equal(stale.stale, true);
  assert.equal(
    storage.readWeatherCache(
      { latitude: -12.971, longitude: -38.501 },
      { now: cachedAtMs + WEATHER_CACHE_STALE_MS + 1, allowStale: true },
    ),
    null,
  );
});

test("malformed weather cache entries are ignored without breaking preferences", () => {
  const storage = createStorage(() => ({
    getItem: () =>
      JSON.stringify({
        entries: {
          "place:paris": {
            cachedAtMs: 100,
            weather: { meta: { units: "imperial" } },
          },
          "place:valid": {
            cachedAtMs: "100",
            weather: { meta: { units: "metric" } },
          },
        },
      }),
  }));
  assert.equal(storage.readWeatherCache("Paris"), null);
  assert.deepEqual(storage.readPreferences().saved, []);
});
