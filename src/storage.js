import { locationKey, validateLocation } from "./utils/location.js";

const PREFIX = "solaris-atmosphere:v1:";
export const MAX_RECENT = 8;
export const MAX_SAVED = 12;
export const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
export const WEATHER_CACHE_STALE_MS = 24 * 60 * 60 * 1000;
const MAX_WEATHER_CACHE = 12;

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function cleanPlaces(value, limit) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .flatMap((item) => {
      try {
        if (typeof item?.label !== "string" || !item.label.trim()) return [];
        const query = validateLocation(item.query);
        const id = locationKey(query);
        if (seen.has(id)) return [];
        seen.add(id);
        return [{ id, query, label: item.label.trim().slice(0, 300) }];
      } catch {
        return [];
      }
    })
    .slice(0, limit);
}

function cacheKey(query) {
  try {
    return locationKey(validateLocation(query));
  } catch {
    return null;
  }
}

function isWeatherModel(value) {
  return (
    isRecord(value) &&
    isRecord(value.location) &&
    isRecord(value.meta) &&
    value.meta.units === "metric"
  );
}

function cleanWeatherCache(value) {
  if (!isRecord(value) || !isRecord(value.entries)) return {};
  return Object.fromEntries(
    Object.entries(value.entries)
      .filter(
        ([key, entry]) =>
          typeof key === "string" &&
          isRecord(entry) &&
          isWeatherModel(entry.weather) &&
          Number.isFinite(entry.cachedAtMs),
      )
      .sort(([, first], [, second]) => second.cachedAtMs - first.cachedAtMs)
      .slice(0, MAX_WEATHER_CACHE),
  );
}

// Access storage lazily: even reading localStorage can throw in restricted browsers.
export function createStorage(getStorage = () => globalThis.localStorage) {
  function read(name) {
    try {
      return JSON.parse(getStorage()?.getItem(PREFIX + name) ?? "null");
    } catch {
      return null;
    }
  }
  function write(name, value) {
    try {
      getStorage()?.setItem(PREFIX + name, JSON.stringify(value));
    } catch {
      /* The current session still works if persistence is unavailable. */
    }
  }
  return {
    readRecent: () => cleanPlaces(read("recent"), MAX_RECENT),
    writeRecent: (items) => write("recent", cleanPlaces(items, MAX_RECENT)),
    readPreferences() {
      const value = read("preferences");
      const saved = cleanPlaces(value?.saved, MAX_SAVED);
      return {
        unit: value?.unit === "F" ? "F" : "C",
        landscape: ["urban", "countryside", "coastal"].includes(
          value?.landscape,
        )
          ? value.landscape
          : "urban",
        saved,
        defaultId: saved.some((place) => place.id === value?.defaultId)
          ? value.defaultId
          : null,
      };
    },
    writePreferences({ unit, landscape, saved, defaultId }) {
      write("preferences", {
        unit,
        landscape,
        saved: cleanPlaces(saved, MAX_SAVED),
        defaultId,
      });
    },
    readWeatherCache(query, { now = Date.now(), allowStale = false } = {}) {
      const key = cacheKey(query);
      if (!key || !Number.isFinite(now)) return null;
      const entry = cleanWeatherCache(read("weather-cache"))[key];
      if (!entry) return null;
      const ageMs = Math.max(0, now - entry.cachedAtMs);
      if (ageMs > WEATHER_CACHE_STALE_MS) return null;
      if (!allowStale && ageMs > WEATHER_CACHE_TTL_MS) return null;
      return {
        weather: entry.weather,
        cachedAtMs: entry.cachedAtMs,
        ageMs,
        stale: ageMs > WEATHER_CACHE_TTL_MS,
      };
    },
    writeWeatherCache(query, weather, { cachedAtMs = Date.now() } = {}) {
      const key = cacheKey(query);
      if (!key || !isWeatherModel(weather) || !Number.isFinite(cachedAtMs))
        return;
      const entries = cleanWeatherCache(read("weather-cache"));
      entries[key] = { weather, cachedAtMs };
      write("weather-cache", {
        entries: Object.fromEntries(
          Object.entries(entries)
            .sort(
              ([, first], [, second]) => second.cachedAtMs - first.cachedAtMs,
            )
            .slice(0, MAX_WEATHER_CACHE),
        ),
      });
    },
  };
}

export function rememberPlace(recent, place) {
  return [place, ...recent.filter((item) => item.id !== place.id)].slice(
    0,
    MAX_RECENT,
  );
}
