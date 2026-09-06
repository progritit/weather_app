import test from "node:test";
import assert from "node:assert/strict";
import { locationMatchText, suggestLocations } from "./locationSearch.js";

test("suggestions are accent-insensitive and rank an exact city first", () => {
  const matches = suggestLocations("sao paulo");
  assert.equal(matches[0].city, "São Paulo");
  assert.equal(matches[0].region, "São Paulo");
  assert.equal(matches[0].country, "Brazil");
  assert.equal(matches[0].query, "São Paulo, São Paulo, Brazil");
  assert.equal(locationMatchText(matches[0]), "São Paulo · Brazil");
});

test("suggestions tolerate a small typo and return canonical queries", () => {
  const matches = suggestLocations("londre");
  assert.equal(matches[0].query, "London, England, United Kingdom");
});

test("region and country tokens can disambiguate cities", () => {
  const matches = suggestLocations("paris france");
  assert.equal(matches[0].query, "Paris, Île-de-France, France");
  assert.deepEqual(suggestLocations("x"), []);
  assert.deepEqual(suggestLocations("paris", { limit: 0 }), []);
});
