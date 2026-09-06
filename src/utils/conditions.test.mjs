import test from "node:test";
import assert from "node:assert/strict";
import {
  conditionKey,
  iconKey,
  phaseFromIcon,
  visualProfile,
} from "./conditions.js";

test("provider condition codes collapse into the curated visual vocabulary", () => {
  const cases = [
    ["clear-day", "clear"],
    ["sunny", "clear"],
    ["partly-cloudy-night", "partly-cloudy"],
    ["cloudy", "overcast"],
    ["overcast-night", "overcast"],
    ["light drizzle", "rain"],
    ["rain-showers-day", "rain"],
    ["freezing-rain", "sleet"],
    ["snow-showers-night", "snow"],
    ["thunder-rain", "thunderstorm"],
    ["haze", "fog"],
    ["windy", "wind"],
    ["volcanic ash", "unknown"],
  ];
  for (const [providerCode, expected] of cases)
    assert.equal(conditionKey(providerCode), expected);
  assert.equal(conditionKey("  CLEAR-DAY  "), "clear");
  assert.equal(conditionKey(null), "unknown");
});

test("icon keys retain provider day/night hints and use safe defaults", () => {
  assert.equal(phaseFromIcon("clear-night"), "night");
  assert.equal(phaseFromIcon("rain-showers-day"), "day");
  assert.equal(phaseFromIcon("rain"), null);
  assert.equal(iconKey("clear", "night"), "clear-night");
  assert.equal(iconKey("partly-cloudy-night"), "partly-cloudy-night");
  assert.equal(iconKey("rain", "night"), "rain");
  assert.equal(iconKey("not-a-provider-code", "night"), "unknown");
});

test("visual profiles expose stable condition, phase, theme, and accent values", () => {
  assert.deepEqual(visualProfile("thunder-rain", "night"), {
    condition: "thunderstorm",
    phase: "night",
    theme: "thunderstorm",
    accent: "violet",
  });
  assert.deepEqual(visualProfile("future-provider-code", "dusk"), {
    condition: "unknown",
    phase: "unknown",
    theme: "unknown",
    accent: "muted",
  });
});
