import { locationKey, validateLocation } from "./utils/location.js";

const PREFIX = "solaris-atmosphere:v1:";
export const MAX_RECENT = 8;
export const MAX_SAVED = 12;

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
  };
}

export function rememberPlace(recent, place) {
  return [place, ...recent.filter((item) => item.id !== place.id)].slice(
    0,
    MAX_RECENT,
  );
}
