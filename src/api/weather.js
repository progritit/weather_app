const DEPLOYED_ENDPOINT =
  "https://solaris-weather-proxy.progritit.workers.dev/api/weather";
const REQUEST_TIMEOUT_MS = 10_000;

export class WeatherApiError extends Error {
  constructor(message, { code = "WEATHER_REQUEST_FAILED", status = 0 } = {}) {
    super(message);
    this.name = "WeatherApiError";
    this.code = code;
    this.status = status;
  }
}

export function getWeatherEndpoint(hostname = globalThis.location?.hostname) {
  const localHost = ["localhost", "127.0.0.1"].includes(hostname);
  return localHost ? "http://localhost:8787/api/weather" : DEPLOYED_ENDPOINT;
}

function createLocationQuery(location) {
  if (typeof location === "string") {
    const value = location.trim();
    if (!value) {
      throw new WeatherApiError("Enter a location to search.", {
        code: "INVALID_LOCATION",
      });
    }
    return { location: value };
  }

  if (location && typeof location === "object") {
    const { latitude, longitude } = location;
    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      return { lat: latitude, lon: longitude };
    }
  }

  throw new WeatherApiError("A valid city or coordinate pair is required.", {
    code: "INVALID_LOCATION",
  });
}

function buildUrl(location, endpoint) {
  const url = new URL(endpoint);
  Object.entries(createLocationQuery(location)).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  return url;
}

async function readError(response) {
  try {
    const body = await response.json();
    return body?.error?.message || "The weather service rejected the request.";
  } catch {
    return "The weather service rejected the request.";
  }
}

function fetchWithTimeout(url, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });

  return fetch(url, { method: "GET", signal: controller.signal }).finally(
    () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    },
  );
}

/** Fetch raw data from the protected Worker; normalization belongs elsewhere. */
export async function fetchWeather(
  location,
  { endpoint = getWeatherEndpoint(), signal } = {},
) {
  const url = buildUrl(location, endpoint);
  let response;

  try {
    response = await fetchWithTimeout(url, signal);
  } catch (error) {
    if (error.name === "AbortError") {
      throw new WeatherApiError("The weather request timed out.", {
        code: "WEATHER_TIMEOUT",
      });
    }
    throw new WeatherApiError(
      "The weather service could not be reached. Check your connection.",
      { code: "WEATHER_NETWORK_ERROR" },
    );
  }

  if (!response.ok) {
    const message = await readError(response);
    const code =
      response.status === 404 ? "LOCATION_NOT_FOUND" : "WEATHER_REQUEST_FAILED";
    throw new WeatherApiError(message, { code, status: response.status });
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new WeatherApiError("The weather service returned invalid JSON.", {
      code: "INVALID_WEATHER_RESPONSE",
      status: response.status,
    });
  }

  if (!payload?.data || typeof payload.data !== "object") {
    throw new WeatherApiError("The weather response is missing its data.", {
      code: "INVALID_WEATHER_RESPONSE",
      status: response.status,
    });
  }

  // Temporary inspection required by the TOP assignment. Remove after normalization.
  console.log("Solaris weather response:", payload);
  return payload;
}
