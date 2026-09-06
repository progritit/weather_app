import { fetchWeather } from "./api/weather.js";
import { normalizeWeather } from "./data/normalizeWeather.js";
import { MAX_SAVED, rememberPlace } from "./storage.js";
import {
  locationKey,
  placeFromWeather,
  queryLabel,
  validateLocation,
} from "./utils/location.js";

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!globalThis.navigator?.geolocation) {
      reject(
        Object.assign(
          new Error(
            "Location access is unavailable. Search for a city instead.",
          ),
          { code: "LOCATION_UNAVAILABLE" },
        ),
      );
      return;
    }
    globalThis.navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) =>
        reject(
          Object.assign(
            new Error(
              error.code === 1
                ? "Location permission was denied. You can still search for a city."
                : "Your location could not be determined. Try searching for a city.",
            ),
            { code: "LOCATION_UNAVAILABLE" },
          ),
        ),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  });
}

function presentError(error) {
  const code = error.code ?? "INVALID_WEATHER_RESPONSE";
  const field = code === "INVALID_LOCATION" || code === "LOCATION_NOT_FOUND";
  let message =
    error.message || "Weather is temporarily unavailable. Please try again.";
  if (code === "LOCATION_NOT_FOUND")
    message =
      "We couldn’t find that location. Add a country or postal code and try again.";
  if (error.status === 429)
    message = `Too many weather requests. ${Number.isFinite(error.retryAfter) ? `Wait ${error.retryAfter} seconds` : "Wait a little"} before trying again.`;
  if (error instanceof TypeError)
    message =
      "The weather service returned incomplete or unexpected data. Please try again.";
  return {
    code,
    message,
    field,
    retryable: !field && code !== "LOCATION_UNAVAILABLE",
  };
}

// Request identifiers guard every success/error path, even if abort arrives too late.
export function createWeatherSearch({
  store,
  storage,
  request = fetchWeather,
  normalize = normalizeWeather,
  now = () => Date.now(),
  locate = getPosition,
  onResult = () => {},
}) {
  let revision = 0;
  let active = null;
  let lastAttempt = null;

  async function run(
    input,
    { remember = true, save = false, locating = false } = {},
  ) {
    const id = ++revision;
    active?.abort();
    const controller = new AbortController();
    active = controller;
    lastAttempt = { input, remember, save, locating };
    try {
      let query;
      if (locating) {
        store.setState({
          status: "locating",
          pendingLabel: "your location",
          error: null,
        });
        query = await locate();
        if (id !== revision) return null;
      } else query = input;
      try {
        query = validateLocation(query);
      } catch (error) {
        error.code = "INVALID_LOCATION";
        throw error;
      }
      const state = store.getState();
      const knownPlace = [
        state.currentPlace,
        ...state.recent,
        ...state.saved,
      ].find((place) => place?.id === locationKey(query));
      store.setState({
        status: "loading",
        pendingLabel: locating
          ? "your location"
          : (knownPlace?.label ?? queryLabel(query)),
        error: null,
      });
      const payload = await request(query, { signal: controller.signal });
      if (id !== revision || controller.signal.aborted) return null;
      const weather = normalize(payload, { referenceTimeMs: now() });
      const place = placeFromWeather(weather, query);
      const previous = store.getState();
      const recent = remember
        ? rememberPlace(previous.recent, place)
        : previous.recent;
      const saved =
        save &&
        !previous.saved.some((item) => item.id === place.id) &&
        previous.saved.length < MAX_SAVED
          ? [...previous.saved, place]
          : previous.saved;
      const summaries = Object.fromEntries(
        Object.entries({
          ...previous.summaries,
          [place.id]: {
            current: weather.current,
            timezone: weather.location.timezone,
            fetchedAtMs: weather.meta.fetchedAtMs,
          },
        }).slice(-20),
      );
      // Step 7 inspection happens immediately before rendering via the state update.
      onResult(weather);
      if (remember) storage.writeRecent(recent);
      if (save) storage.writePreferences({ ...previous, saved });
      store.setState({
        weather,
        currentPlace: place,
        recent,
        saved,
        summaries,
        status: "ready",
        error: null,
        pendingLabel: "",
        day: null,
      });
      return weather;
    } catch (error) {
      if (
        id !== revision ||
        controller.signal.aborted ||
        error.code === "WEATHER_ABORTED"
      )
        return null;
      store.setState({
        status: "error",
        pendingLabel: "",
        error: presentError(error),
      });
      return null;
    } finally {
      if (id === revision) active = null;
    }
  }

  return {
    search: run,
    locate: () => run(null, { locating: true, remember: false }),
    retry: () =>
      lastAttempt ? run(lastAttempt.input, lastAttempt) : Promise.resolve(null),
    cancel() {
      revision += 1;
      active?.abort();
      active = null;
      store.setState({
        status: store.getState().weather ? "ready" : "idle",
        pendingLabel: "",
        error: null,
      });
    },
  };
}
