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
    retryAfter: Number.isFinite(error.retryAfter) ? error.retryAfter : null,
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

  function readCache(query, allowStale = false) {
    if (typeof storage.readWeatherCache !== "function") return null;
    try {
      return storage.readWeatherCache(query, { now: now(), allowStale });
    } catch {
      return null;
    }
  }

  function writeCache(query, place, weather, cachedAtMs) {
    if (typeof storage.writeWeatherCache !== "function") return;
    const queries = new Set([query, place.query]);
    queries.forEach((item) => {
      try {
        storage.writeWeatherCache(item, weather, { cachedAtMs });
      } catch {
        /* A cache write must never turn a successful weather response into an error. */
      }
    });
  }

  function commit(
    id,
    query,
    weather,
    {
      remember = true,
      save = false,
      summaryOnly = false,
      source = "network",
      cachedAtMs = null,
      fallbackError = null,
    } = {},
  ) {
    if (id !== revision || active?.signal.aborted) return null;
    const previous = store.getState();
    const resolvedPlace = placeFromWeather(weather, query);
    const existingPlace = [
      previous.currentPlace,
      ...previous.recent,
      ...previous.saved,
    ].find((item) => item?.id === locationKey(query));
    // Keep a previously stored identity stable when a richer provider address
    // (for example Paris -> Paris, Île-de-France, France) is learned later.
    const place = existingPlace
      ? { ...existingPlace, label: resolvedPlace.label }
      : resolvedPlace;
    const recent = remember
      ? rememberPlace(previous.recent, place)
      : previous.recent;
    const saved =
      save &&
      !previous.saved.some((item) => item.id === place.id) &&
      previous.saved.length < MAX_SAVED
        ? [...previous.saved, place]
        : previous.saved;
    const summary = {
      current: weather.current,
      timezone: weather.location.timezone,
      fetchedAtMs: weather.meta.fetchedAtMs,
      cachedAtMs,
      source,
    };
    const summaries = { ...previous.summaries, [place.id]: summary };
    // Keep the in-memory summary map bounded even if many saved searches occur.
    const boundedSummaries = Object.fromEntries(
      Object.entries(summaries).slice(-20),
    );
    const patch = {
      summaries: boundedSummaries,
      status: "ready",
      error: fallbackError,
      pendingLabel: "",
      pendingPlaceId: null,
      pendingMode: null,
    };
    if (!summaryOnly) {
      Object.assign(patch, {
        weather,
        currentPlace: place,
        recent,
        saved,
        day: null,
        weatherSource: source,
        cacheTimestampMs: cachedAtMs,
        cacheStale: source === "stale-cache",
      });
    }
    onResult(weather, { source });
    if (remember) storage.writeRecent(recent);
    if (save) storage.writePreferences({ ...previous, saved });
    store.setState(patch);
    return weather;
  }

  async function run(
    input,
    {
      remember = true,
      save = false,
      locating = false,
      summaryOnly = false,
      force = false,
      refreshing = false,
    } = {},
  ) {
    const id = ++revision;
    active?.abort();
    const controller = new AbortController();
    active = controller;
    lastAttempt = {
      input,
      remember,
      save,
      locating,
      summaryOnly,
      force,
      refreshing,
    };
    let query;
    try {
      if (locating) {
        store.setState({
          status: "locating",
          pendingLabel: "your location",
          pendingPlaceId: null,
          pendingMode: "locating",
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
      const pendingPlaceId = knownPlace?.id ?? locationKey(query);
      store.setState({
        status: "loading",
        pendingLabel: locating
          ? "your location"
          : (knownPlace?.label ?? queryLabel(query)),
        pendingPlaceId,
        pendingMode: locating ? "locating" : refreshing ? "refresh" : "search",
        error: null,
      });

      const fresh = !force ? readCache(query) : null;
      if (fresh) {
        return commit(id, query, fresh.weather, {
          remember,
          save,
          summaryOnly,
          source: "cache",
          cachedAtMs: fresh.cachedAtMs,
        });
      }

      const payload = await request(query, { signal: controller.signal });
      if (id !== revision || controller.signal.aborted) return null;
      const weather = normalize(payload, {
        referenceTimeMs: now(),
        locationQuery: typeof query === "string" ? query : null,
      });
      const cachedAtMs = now();
      const place = placeFromWeather(weather, query);
      writeCache(query, place, weather, cachedAtMs);
      const source =
        weather.meta.cache === "hit" ? "upstream-cache" : "network";
      return commit(id, query, weather, {
        remember,
        save,
        summaryOnly,
        source,
        cachedAtMs,
      });
    } catch (error) {
      if (
        id !== revision ||
        controller.signal.aborted ||
        error.code === "WEATHER_ABORTED"
      )
        return null;

      // A bounded stale cache keeps the app useful during a brief outage while
      // the error banner and retry action make its age explicit.
      const stale = query ? readCache(query, true) : null;
      if (stale) {
        return commit(id, query, stale.weather, {
          remember,
          save,
          summaryOnly,
          source: stale.stale ? "stale-cache" : "cache-fallback",
          cachedAtMs: stale.cachedAtMs,
          fallbackError: presentError(error),
        });
      }
      store.setState({
        status: "error",
        pendingLabel: "",
        pendingPlaceId: null,
        pendingMode: null,
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
    refreshSaved: (place) =>
      run(place?.query ?? place, {
        remember: false,
        summaryOnly: true,
        force: true,
        refreshing: true,
      }),
    retry: () =>
      lastAttempt ? run(lastAttempt.input, lastAttempt) : Promise.resolve(null),
    cancel() {
      revision += 1;
      active?.abort();
      active = null;
      store.setState({
        status: store.getState().weather ? "ready" : "idle",
        pendingLabel: "",
        pendingPlaceId: null,
        pendingMode: null,
        error: null,
      });
    },
  };
}
