// Shared state has no DOM or network dependencies. Updates notify the UI.
export function createStore({ preferences = {}, recent = [] } = {}) {
  let state = {
    weather: null,
    currentPlace: null,
    status: "idle",
    pendingLabel: "",
    error: null,
    day: null,
    unit: preferences.unit ?? "C",
    landscape: preferences.landscape ?? "urban",
    recent,
    saved: preferences.saved ?? [],
    defaultId: preferences.defaultId ?? null,
    summaries: {},
  };
  const listeners = new Set();
  return {
    getState: () => state,
    setState(patch) {
      state = { ...state, ...patch };
      listeners.forEach((listener) => listener(state));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
