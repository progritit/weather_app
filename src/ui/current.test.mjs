import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWeather } from "../data/normalizeWeather.js";
import { renderCurrent } from "./current.js";

const icon = () => '<span class="test-icon" aria-hidden="true"></span>';
const NOW = Date.parse("2026-09-06T12:00:00Z");

function weatherFor(label) {
  return normalizeWeather(
    {
      data: {
        resolvedAddress: label,
        timezone: "Europe/Paris",
        currentConditions: {
          datetime: "14:00:00",
          datetimeEpoch: NOW / 1000,
          temp: 22,
          feelslike: 22,
          conditions: "Clear",
          icon: "clear-day",
        },
        days: [],
        alerts: [],
      },
      meta: {
        units: "metric",
        fetchedAt: new Date(NOW).toISOString(),
      },
    },
    { referenceTimeMs: NOW, locationQuery: "Paris, Île-de-France, France" },
  );
}

test("hero uses canonical city casing and a region/country context line", () => {
  const weather = weatherFor("paris, france");
  const html = renderCurrent(
    {
      weather,
      currentPlace: {
        id: "place:paris",
        query: "Paris, Île-de-France, France",
        label: "Paris, Île-de-France, France",
      },
      unit: "C",
      landscape: "urban",
      saved: [],
      weatherSource: "network",
    },
    NOW,
    icon,
  );
  assert.match(html, /<h1 id="location-title">Paris<span>\.<\/span><\/h1>/);
  assert.match(html, /<p class="eyebrow">Île-de-France · France<\/p>/);
  assert.match(
    html,
    /<p class="resolved-location">Paris, Île-de-France, France<\/p>/,
  );
  assert.doesNotMatch(html, />paris<span>/u);
});
