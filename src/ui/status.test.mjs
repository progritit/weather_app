import test from "node:test";
import assert from "node:assert/strict";
import { renderSkeleton, renderStatus } from "./status.js";

const weather = { location: { label: "Salvador, Brazil" }, current: {} };

test("status copy distinguishes initial search, refresh, and geolocation", () => {
  assert.match(
    renderStatus({
      status: "loading",
      pendingMode: "search",
      pendingLabel: "Paris",
      weather,
    }),
    /Searching for Paris/,
  );
  assert.match(
    renderStatus({
      status: "loading",
      pendingMode: "refresh",
      pendingLabel: "Salvador",
      weather,
    }),
    /Refreshing Salvador/,
  );
  assert.match(
    renderStatus({
      status: "locating",
      pendingMode: "locating",
      pendingLabel: "your location",
      weather,
    }),
    /Finding your location/,
  );
});

test("cached status is explicit for local and provider cache hits", () => {
  const local = renderStatus({ weather, weatherSource: "cache" });
  const provider = renderStatus({ weather, weatherSource: "upstream-cache" });
  assert.match(local, /Showing a cached forecast/);
  assert.match(provider, /provider returned a cached forecast/);
  assert.doesNotMatch(local, /Updated/);
  assert.doesNotMatch(provider, /Updated/);
});

test("stale weather exposes the outage and a retry action", () => {
  const html = renderStatus({
    weather,
    weatherSource: "stale-cache",
    error: {
      code: "WEATHER_NETWORK_ERROR",
      message: "The weather service could not be reached.",
      retryable: true,
    },
  });
  assert.match(html, /latest cached forecast/);
  assert.match(html, /Try again/);
  assert.match(html, /role="alert"/);
});

test("permission errors provide a manual-search action without retrying location", () => {
  const html = renderStatus({
    error: {
      code: "LOCATION_UNAVAILABLE",
      message:
        "Location permission was denied. You can still search for a city.",
      retryable: false,
    },
  });
  assert.match(html, /Search manually/);
  assert.match(html, /You can search for a city/);
  assert.doesNotMatch(html, /Try again/);
});

test("the loading skeleton remains readable and escapes its status message", () => {
  const html = renderSkeleton("Loading <weather>");
  assert.match(html, /Loading &lt;weather&gt;/);
  assert.match(html, /aria-busy="true"/);
});
