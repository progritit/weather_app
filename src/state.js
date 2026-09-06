// Shared state has no DOM or network dependencies. Updates notify the UI.
export function createStore({
  preferences = {},
  recent = [],
  summaries = {},
} = {}) {
  let state = {
    weather: null,
    currentPlace: null,
    status: "idle",
    pendingLabel: "",
    pendingPlaceId: null,
    pendingMode: null,
    error: null,
    day: null,
    unit: preferences.unit === "F" ? "F" : "C",
    landscape: preferences.landscape ?? "urban",
    recent,
    saved: preferences.saved ?? [],
    defaultId: preferences.defaultId ?? null,
    summaries,
    weatherSource: null,
    cacheTimestampMs: null,
    cacheStale: false,
  };
  const listeners = new Set();
  const setState = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener(state));
  };
  return {
    getState: () => state,
    setState,
    setUnit(unit) {
      if (!["C", "F"].includes(unit) || unit === state.unit) return false;
      setState({ unit });
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
