import test from "node:test";
import assert from "node:assert/strict";
import { formatResolvedLocation, titleCaseLocationPart } from "./location.js";

test("location components use readable casing while retaining accents", () => {
  assert.equal(titleCaseLocationPart("paris"), "Paris");
  assert.equal(titleCaseLocationPart("sao paulo"), "Sao Paulo");
  assert.equal(titleCaseLocationPart("ÎLE-DE-FRANCE"), "Île-de-France");
  assert.equal(titleCaseLocationPart("côte d'ivoire"), "Côte d'Ivoire");
  assert.equal(titleCaseLocationPart("D.C."), "D.C.");
});

test("resolved addresses merge incomplete provider labels with the search context", () => {
  assert.deepEqual(
    formatResolvedLocation("paris, france", "Paris, Île-de-France, France"),
    {
      city: "Paris",
      region: "Île-de-France",
      country: "France",
      label: "Paris, Île-de-France, France",
    },
  );
  assert.deepEqual(formatResolvedLocation("são paulo, são paulo, brasil"), {
    city: "São Paulo",
    region: "São Paulo",
    country: "Brasil",
    label: "São Paulo, São Paulo, Brasil",
  });
});

test("a city-only provider result still receives a canonical fallback label", () => {
  assert.deepEqual(
    formatResolvedLocation("paris", "Paris, Île-de-France, France"),
    {
      city: "Paris",
      region: "Île-de-France",
      country: "France",
      label: "Paris, Île-de-France, France",
    },
  );
  assert.deepEqual(formatResolvedLocation(null, "Salvador"), {
    city: "Salvador",
    region: null,
    country: null,
    label: "Salvador",
  });
  assert.deepEqual(
    formatResolvedLocation("10001, new york, new york, united states"),
    {
      city: "New York",
      region: "New York",
      country: "United States",
      label: "New York, New York, United States",
    },
  );
});
