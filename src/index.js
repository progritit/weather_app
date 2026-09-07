import "./styles.css";
import "./ui/live.css";
import { createStore } from "./state.js";
import { createStorage } from "./storage.js";
import { createWeatherSearch } from "./search.js";
import { mountApp } from "./ui/index.js";

const storage = createStorage();
const preferences = storage.readPreferences();
const summaries = Object.fromEntries(
  preferences.saved.flatMap((place) => {
    const cached = storage.readWeatherCache(place.query, { allowStale: true });
    if (!cached) return [];
    const { weather } = cached;
    return [
      [
        place.id,
        {
          current: weather.current,
          timezone: weather.location.timezone,
          fetchedAtMs: weather.meta.fetchedAtMs,
          cachedAtMs: cached.cachedAtMs,
          source: cached.stale ? "stale-cache" : "cache",
        },
      ],
    ];
  }),
);
const store = createStore({
  preferences,
  recent: storage.readRecent(),
  summaries,
});
const search = createWeatherSearch({
  store,
  storage,
  onResult: (weather) => console.log("Solaris normalized weather:", weather),
});
mountApp(document.querySelector("#app"), { store, storage, search });
const state = store.getState();
const initialPlace =
  state.saved.find((place) => place.id === state.defaultId) ?? state.recent[0];
void search.search(initialPlace?.query ?? "Paris, Île-de-France, France", {
  remember: false,
});
