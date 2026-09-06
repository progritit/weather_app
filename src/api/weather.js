const DEPLOYED_ENDPOINT =
  "https://solaris-weather-proxy.progritit.workers.dev/api/weather";

export class WeatherApiError extends Error {
  constructor(
    message,
    { code = "WEATHER_REQUEST_FAILED", status = 0, retryAfter = null } = {},
  ) {
    super(message);
    this.name = "WeatherApiError";
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function getWeatherEndpoint(hostname = globalThis.location?.hostname) {
  return ["localhost", "127.0.0.1"].includes(hostname)
    ? "http://localhost:8787/api/weather"
    : DEPLOYED_ENDPOINT;
}

function createLocationQuery(location) {
  if (typeof location === "string") {
    const value = location.trim();
    if (!value)
      throw new WeatherApiError("Enter a location to search.", {
        code: "INVALID_LOCATION",
      });
    return { location: value };
  }
  if (location && typeof location === "object") {
    const { latitude, longitude } = location;
    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    ) {
      return { lat: latitude, lon: longitude };
    }
  }
  throw new WeatherApiError("A valid city or coordinate pair is required.", {
    code: "INVALID_LOCATION",
  });
}

/** Fetch the raw Worker envelope. Cancellation and timeout cover body reading too. */
export async function fetchWeather(
  location,
  { endpoint = getWeatherEndpoint(), signal, timeoutMs = 10_000 } = {},
) {
  const url = new URL(endpoint);
  Object.entries(createLocationQuery(location)).forEach(([key, value]) =>
    url.searchParams.set(key, String(value)),
  );
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) {
    throw new WeatherApiError("Weather request cancelled.", {
      code: "WEATHER_ABORTED",
    });
  }
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      if (response.ok)
        throw new WeatherApiError(
          "The weather service returned invalid JSON.",
          {
            code: "INVALID_WEATHER_RESPONSE",
            status: response.status,
          },
        );
    }
    // Also protect against a fetch implementation that finishes after cancellation.
    if (controller.signal.aborted) throw new Error("Request aborted");
    if (!response.ok) {
      const code =
        typeof payload?.error?.code === "string"
          ? payload.error.code
          : response.status === 404
            ? "LOCATION_NOT_FOUND"
            : "WEATHER_REQUEST_FAILED";
      const message =
        typeof payload?.error?.message === "string"
          ? payload.error.message.slice(0, 500)
          : "The weather service rejected the request.";
      const retry = response.headers.get("Retry-After");
      const retryAfter =
        retry !== null && /^\d+$/.test(retry) ? Number(retry) : null;
      throw new WeatherApiError(message, {
        code,
        status: response.status,
        retryAfter,
      });
    }
    if (
      !payload?.data ||
      typeof payload.data !== "object" ||
      Array.isArray(payload.data)
    ) {
      throw new WeatherApiError("The weather response is missing its data.", {
        code: "INVALID_WEATHER_RESPONSE",
        status: response.status,
      });
    }
    return payload;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new WeatherApiError(
        timedOut
          ? "The weather request timed out. Please try again."
          : "Weather request cancelled.",
        {
          code: timedOut ? "WEATHER_TIMEOUT" : "WEATHER_ABORTED",
        },
      );
    }
    if (error instanceof WeatherApiError) throw error;
    throw new WeatherApiError(
      "The weather service could not be reached. Check your connection.",
      { code: "WEATHER_NETWORK_ERROR" },
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
