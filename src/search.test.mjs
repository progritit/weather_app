import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "./state.js";
import { createStorage, WEATHER_CACHE_TTL_MS } from "./storage.js";
import { createWeatherSearch } from "./search.js";
import { normalizeWeather } from "./data/normalizeWeather.js";

const NOW = Date.parse("2026-09-06T12:00:00Z");
function payload(label, latitude = -12.971, longitude = -38.501) {
  return {
    data: {
      resolvedAddress: label,
      latitude,
      longitude,
      timezone: "America/Bahia",
      currentConditions: {
        datetimeEpoch: NOW / 1000,
        temp: 25,
        precip: null,
        precipprob: null,
        icon: "clear-day",
      },
      days: [],
      alerts: [],
    },
    meta: {
      units: "metric",
      fetchedAt: new Date(NOW).toISOString(),
      cache: "miss",
    },
  };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function setup(extra = {}) {
  const memory = new Map();
  const storage = createStorage(() => ({
    getItem: (key) => memory.get(key),
    setItem: (key, value) => memory.set(key, value),
  }));
  const store = createStore();
  const calls = [];
  const results = [];
  const request = (query, options) => {
    const task = deferred();
    calls.push({ query, ...options, ...task });
    return task.promise;
  };
  const search = createWeatherSearch({
    store,
    storage,
    request,
    now: () => NOW,
    onResult: (weather) => results.push(weather),
    ...extra,
  });
  return { storage, store, search, calls, results };
}

test("blank and unsupported input produce field errors without network or history writes", async () => {
  const { search, calls, store, storage } = setup();
  for (const query of ["", "   ", "x", "<script>", "a".repeat(121)]) {
    await search.search(query);
    assert.equal(store.getState().error.field, true);
  }
  assert.equal(calls.length, 0);
  assert.deepEqual(storage.readRecent(), []);
});

test("search validates Unicode input, normalizes once, and remembers the resolved place", async () => {
  const { search, calls, store, storage, results } = setup();
  const pending = search.search("  São   Paulo, Brazil  ");
  assert.equal(calls[0].query, "São Paulo, Brazil");
  assert.equal(store.getState().status, "loading");
  calls[0].resolve(payload("São Paulo, São Paulo, Brasil", -23.551, -46.633));
  await pending;
  const state = store.getState();
  assert.equal(state.status, "ready");
  assert.equal(state.weather.location.label, "São Paulo, São Paulo, Brasil");
  assert.equal(state.weather.current.precipitation.probability, null);
  assert.equal(state.currentPlace.label, state.weather.location.label);
  assert.equal(state.currentPlace.query, "São Paulo, São Paulo, Brasil");
  assert.deepEqual(storage.readRecent(), state.recent);
  assert.equal(results.length, 1);
  assert.equal(results[0], state.weather);
});

test("a late success cannot overwrite a newer success, history, or inspection log", async () => {
  const { search, calls, store, storage, results } = setup();
  const first = search.search("Salvador");
  const second = search.search("Paris");
  assert.equal(calls[0].signal.aborted, true);
  assert.equal(calls[1].signal.aborted, false);
  calls[1].resolve(payload("Paris, France", 48.857, 2.352));
  await second;
  // Deliberately ignore AbortSignal, like a response already in flight.
  calls[0].resolve(payload("Salvador, Brazil"));
  await first;
  assert.equal(store.getState().weather.location.label, "Paris, France");
  assert.equal(store.getState().status, "ready");
  assert.deepEqual(
    storage.readRecent().map((place) => place.label),
    ["Paris, France"],
  );
  assert.equal(results.length, 1);
});

test("a stale rejection cannot clear newer loading state or replace its error", async () => {
  const { search, calls, store } = setup();
  const first = search.search("Salvador");
  const second = search.search("Paris");
  calls[0].reject(new Error("Old network error"));
  await first;
  assert.equal(store.getState().status, "loading");
  assert.equal(store.getState().error, null);
  calls[1].reject(
    Object.assign(new Error("Limit reached"), {
      status: 429,
      code: "RATE_LIMITED",
      retryAfter: 60,
    }),
  );
  await second;
  assert.equal(store.getState().error.code, "RATE_LIMITED");
  assert.match(store.getState().error.message, /60 seconds/);
});

test("a failed new location retains the last successful location and its readings", async () => {
  const { search, calls, store, storage } = setup();
  const first = search.search("Salvador");
  calls[0].resolve(payload("Salvador, Brazil"));
  await first;
  const previous = store.getState().weather;
  const second = search.search("Atlantis");
  assert.equal(store.getState().weather, previous);
  calls[1].reject(
    Object.assign(new Error("Not found"), {
      code: "LOCATION_NOT_FOUND",
      status: 404,
    }),
  );
  await second;
  assert.equal(store.getState().weather, previous);
  assert.equal(store.getState().currentPlace.label, "Salvador, Brazil");
  assert.equal(store.getState().error.field, true);
  assert.equal(storage.readRecent().length, 1);
});

test("a newer blank submission also invalidates an older pending request", async () => {
  const { search, calls, store, results } = setup();
  const pending = search.search("Paris");
  await search.search("   ");
  calls[0].resolve(payload("Paris, France", 48.857, 2.352));
  await pending;
  assert.equal(store.getState().error.code, "INVALID_LOCATION");
  assert.equal(store.getState().weather, null);
  assert.equal(results.length, 0);
});

test("late geolocation callbacks cannot start requests after a newer typed search", async () => {
  const position = deferred();
  const { search, calls, store } = setup({ locate: () => position.promise });
  const locating = search.locate();
  const typed = search.search("Paris");
  position.resolve({ latitude: -12.971, longitude: -38.501 });
  await locating;
  assert.equal(calls.length, 1);
  calls[0].resolve(payload("Paris, France", 48.857, 2.352));
  await typed;
  assert.equal(store.getState().weather.location.label, "Paris, France");
});

test("successful geolocation is not added to recent searches automatically", async () => {
  const { search, calls, storage } = setup({
    locate: async () => ({ latitude: -12.97144, longitude: -38.50144 }),
  });
  const task = search.locate();
  await Promise.resolve();
  assert.deepEqual(calls[0].query, { latitude: -12.971, longitude: -38.501 });
  calls[0].resolve(payload("Salvador, Brazil"));
  await task;
  assert.deepEqual(storage.readRecent(), []);
});

test("successful searches can save a resolved location and retry a failed attempt", async () => {
  const { search, calls, storage, store } = setup();
  const failed = search.search("Paris", { save: true });
  calls[0].reject(new Error("Network failed"));
  await failed;
  assert.deepEqual(storage.readPreferences().saved, []);
  const retry = search.retry();
  calls[1].resolve(payload("Paris, France", 48.857, 2.352));
  await retry;
  assert.equal(storage.readPreferences().saved[0].label, "Paris, France");
  assert.equal(store.getState().status, "ready");
});

test("a fresh device cache avoids a request and still updates the active place", async () => {
  const { search, storage, store, calls } = setup();
  const weather = normalizeWeather(payload("Paris, France", 48.857, 2.352));
  storage.writeWeatherCache("Paris", weather, { cachedAtMs: NOW });
  await search.search("Paris");
  assert.equal(calls.length, 0);
  assert.equal(store.getState().weather.location.label, "Paris, France");
  assert.equal(store.getState().weatherSource, "cache");
  assert.equal(store.getState().cacheStale, false);
  assert.equal(storage.readRecent()[0].label, "Paris, France");
});

test("an upstream cache hit is labelled cached rather than newly updated", async () => {
  const { search, calls, store } = setup();
  const task = search.search("Paris");
  calls[0].resolve({
    ...payload("Paris, France", 48.857, 2.352),
    meta: { ...payload("Paris, France").meta, cache: "hit" },
  });
  await task;
  assert.equal(store.getState().weatherSource, "upstream-cache");
});

test("an expired cache makes a network request while a bounded stale entry can recover an outage", async () => {
  const { search, storage, store, calls } = setup();
  const weather = normalizeWeather(payload("Paris, France", 48.857, 2.352));
  storage.writeWeatherCache("Paris", weather, {
    cachedAtMs: NOW - WEATHER_CACHE_TTL_MS - 1,
  });
  const task = search.search("Paris");
  assert.equal(calls.length, 1);
  calls[0].reject(new Error("Network failed"));
  await task;
  assert.equal(store.getState().weather.location.label, "Paris, France");
  assert.equal(store.getState().weatherSource, "stale-cache");
  assert.equal(store.getState().cacheStale, true);
  assert.equal(store.getState().error.retryable, true);
});

test("saved-summary refresh is explicit, bypasses the browser cache, and preserves the active forecast", async () => {
  const { search, calls, store, storage } = setup();
  const first = search.search("Salvador");
  calls[0].resolve(payload("Salvador, Brazil"));
  await first;
  const activeWeather = store.getState().weather;
  const activePlace = store.getState().currentPlace;
  const savedPlace = {
    id: "place:paris, france",
    query: "Paris, France",
    label: "Paris, France",
  };
  store.setState({ saved: [savedPlace] });
  const freshParis = normalizeWeather(payload("Paris, France", 48.857, 2.352));
  storage.writeWeatherCache("Paris, France", freshParis, { cachedAtMs: NOW });
  store.getState().summaries[savedPlace.id] = {
    current: freshParis.current,
    timezone: freshParis.location.timezone,
    fetchedAtMs: freshParis.meta.fetchedAtMs,
  };
  const refresh = search.refreshSaved(savedPlace);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].query, "Paris, France");
  calls[1].resolve(payload("Paris, France", 48.857, 2.352));
  await refresh;
  const state = store.getState();
  assert.equal(state.weather, activeWeather);
  assert.equal(state.currentPlace, activePlace);
  assert.equal(state.status, "ready");
  assert.equal(state.summaries[savedPlace.id].source, "network");
});
