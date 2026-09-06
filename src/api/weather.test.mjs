import test from "node:test";
import assert from "node:assert/strict";
import { URL } from "node:url";
import {
  fetchWeather,
  getWeatherEndpoint,
  WeatherApiError,
} from "./weather.js";

function response(body, status = 200) {
  return new globalThis.Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("selects the local Worker during local development", () => {
  assert.equal(
    getWeatherEndpoint("localhost"),
    "http://localhost:8787/api/weather",
  );
  assert.equal(
    getWeatherEndpoint("127.0.0.1"),
    "http://localhost:8787/api/weather",
  );
  assert.match(
    getWeatherEndpoint("progritit.github.io"),
    /workers\.dev\/api\/weather$/,
  );
});

test("fetches city and coordinate locations without exposing a provider key", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return response({
      data: { currentConditions: { temp: 25 } },
      meta: { cache: "miss" },
    });
  };
  try {
    await fetchWeather("Salvador, Brazil", {
      endpoint: "http://worker.test/api/weather",
    });
    await fetchWeather(
      { latitude: -12.9714, longitude: -38.5014 },
      { endpoint: "http://worker.test/api/weather" },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(
    new URL(calls[0].url).searchParams.get("location"),
    "Salvador, Brazil",
  );
  assert.equal(new URL(calls[1].url).searchParams.get("lat"), "-12.9714");
  assert.equal(new URL(calls[1].url).searchParams.get("lon"), "-38.5014");
  assert.equal(new URL(calls[0].url).searchParams.has("key"), false);
  assert.equal(calls[0].options.method, "GET");
});

test("checks HTTP status and preserves a stable application error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    response(
      {
        error: { code: "LOCATION_NOT_FOUND", message: "No weather was found." },
      },
      404,
    );
  try {
    await assert.rejects(
      fetchWeather("Atlantis", { endpoint: "http://worker.test/api/weather" }),
      (error) =>
        error instanceof WeatherApiError &&
        error.status === 404 &&
        error.code === "LOCATION_NOT_FOUND",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects malformed payloads and invalid input before fetching", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return response({ data: null });
  };
  try {
    await assert.rejects(
      fetchWeather("", { endpoint: "http://worker.test/api/weather" }),
      /Enter a location/,
    );
    await assert.rejects(
      fetchWeather(
        { latitude: 100, longitude: 0 },
        { endpoint: "http://worker.test/api/weather" },
      ),
      /valid city or coordinate/,
    );
    await assert.rejects(
      fetchWeather("Salvador", { endpoint: "http://worker.test/api/weather" }),
      /missing its data/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls, 1);
});

test("an already-aborted search never starts a network request", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return response({ data: {} });
  };
  const controller = new globalThis.AbortController();
  controller.abort();
  try {
    await assert.rejects(
      fetchWeather("Paris", {
        endpoint: "http://worker.test/api/weather",
        signal: controller.signal,
      }),
      (error) => error.code === "WEATHER_ABORTED",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls, 0);
});

test(
  "cancellation after headers aborts response-body reading and is not a timeout",
  { timeout: 1000 },
  async () => {
    const originalFetch = globalThis.fetch;
    let headersReady;
    const headers = new Promise((resolve) => {
      headersReady = resolve;
    });
    const controller = new globalThis.AbortController();
    globalThis.fetch = async (_url, { signal }) => {
      const stream = new globalThis.ReadableStream({
        start(body) {
          signal.addEventListener(
            "abort",
            () =>
              body.error(new globalThis.DOMException("Aborted", "AbortError")),
            { once: true },
          );
        },
      });
      headersReady();
      return new globalThis.Response(stream);
    };
    try {
      const task = fetchWeather("Paris", {
        endpoint: "http://worker.test/api/weather",
        signal: controller.signal,
      });
      await headers;
      controller.abort();
      await assert.rejects(task, (error) => error.code === "WEATHER_ABORTED");
    } finally {
      controller.abort();
      globalThis.fetch = originalFetch;
    }
  },
);

test(
  "the timeout remains active while waiting for the JSON body",
  { timeout: 1000 },
  async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, { signal }) =>
      new globalThis.Response(
        new globalThis.ReadableStream({
          start(body) {
            signal.addEventListener(
              "abort",
              () =>
                body.error(
                  new globalThis.DOMException("Aborted", "AbortError"),
                ),
              { once: true },
            );
          },
        }),
      );
    try {
      await assert.rejects(
        fetchWeather("Paris", {
          endpoint: "http://worker.test/api/weather",
          timeoutMs: 5,
        }),
        (error) => error.code === "WEATHER_TIMEOUT",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

test("preserves the Worker's validation code and retry delay", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new globalThis.Response(
      JSON.stringify({
        error: { code: "RATE_LIMITED", message: "Wait before retrying." },
      }),
      {
        status: 429,
        headers: { "Retry-After": "60", "Content-Type": "application/json" },
      },
    );
  try {
    await assert.rejects(
      fetchWeather("Paris", { endpoint: "http://worker.test/api/weather" }),
      (error) =>
        error.code === "RATE_LIMITED" &&
        error.status === 429 &&
        error.retryAfter === 60,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
