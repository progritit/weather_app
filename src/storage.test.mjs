import test from "node:test";
import assert from "node:assert/strict";
import { createStorage, rememberPlace, MAX_RECENT } from "./storage.js";

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
