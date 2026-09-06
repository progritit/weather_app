import test from "node:test";
import assert from "node:assert/strict";
import { URL } from "node:url";
import { createHandler } from "../index.mjs";

const SECRET = "FAKE_TEST_SECRET_NEVER_A_REAL_KEY";
function harness(options = {}) {
  const entries = new Map();
  const calls = [];
  const tasks = [];
  let upstreamChecks = 0;
  let clock = Date.parse("2026-09-05T12:00:00Z");
  const env = {
    WEATHER_ENABLED: "true",
    VISUAL_CROSSING_API_KEY: SECRET,
    ALLOWED_ORIGINS: "http://localhost:8080,https://progritit.github.io",
    CLIENT_LIMITER: {
      limit: async () => ({ success: options.clientAllowed !== false }),
    },
    UPSTREAM_LIMITER: {
      limit: async () => {
        upstreamChecks++;
        return { success: options.upstreamAllowed !== false };
      },
    },
  };
  const cache = {
    match: async (key) => entries.get(key.url)?.clone(),
    put: async (key, response) => {
      entries.set(key.url, response.clone());
    },
  };
  const handler = createHandler({
    now: () => clock,
    getCache: () => cache,
    fetcher: async (url, init) => {
      calls.push({ url, init });
      if (options.throws) throw options.throws;
      return new globalThis.Response(
        options.body ??
          JSON.stringify({
            timezone: "America/Bahia",
            days: [],
            currentConditions: { temp: 28 },
            queryCost: 1,
          }),
        { status: options.status ?? 200 },
      );
    },
  });
  return {
    env,
    calls,
    entries,
    get upstreamChecks() {
      return upstreamChecks;
    },
    advance: () => {
      clock += 601000;
    },
    async request(
      query = "location=Salvador",
      init = {},
      path = "/api/weather",
    ) {
      const response = await handler(
        new globalThis.Request(`https://weather.example${path}?${query}`, init),
        env,
        { waitUntil: (promise) => tasks.push(promise) },
      );
      await Promise.all(tasks);
      return response;
    },
  };
}

test("fixed upstream, metric units, no caller headers, no secret in response or cache key", async () => {
  const h = harness();
  const response = await h.request("location=Salvador", {
    headers: {
      Origin: "http://localhost:8080",
      Authorization: "never-forward",
    },
  });
  assert.equal(response.status, 200);
  const upstream = new URL(h.calls[0].url);
  assert.equal(upstream.origin, "https://weather.visualcrossing.com");
  assert.ok(upstream.pathname.endsWith("/timeline/salvador"));
  assert.equal(upstream.searchParams.get("key"), SECRET);
  assert.equal(upstream.searchParams.get("unitGroup"), "metric");
  assert.equal(h.calls[0].init.redirect, "error");
  assert.equal(h.calls[0].init.headers, undefined);
  assert.equal(
    response.headers.get("Access-Control-Allow-Origin"),
    "http://localhost:8080",
  );
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.ok(!(await response.text()).includes(SECRET));
  assert.ok(
    [...h.entries.keys()].every(
      (key) => !key.includes(SECRET) && !key.includes("salvador"),
    ),
  );
});
test("invalid, duplicate and injected parameters never call provider", async () => {
  for (const query of [
    "",
    "location=a",
    "location=Paris&location=Rome",
    "location=Paris&key=x",
    "location=https://evil.test",
    "lat=91&lon=0",
    "lat=0&lon=181",
    "lat=&lon=0",
    "location=Paris&lat=0&lon=0",
    "lat=NaN&lon=0",
    "lat=0",
    "location=" + "x".repeat(121),
  ]) {
    const h = harness();
    assert.equal((await h.request(query)).status, 400, query);
    assert.equal(h.calls.length, 0);
  }
});
test("Unicode city names and rounded coordinates are supported", async () => {
  const h = harness();
  assert.equal(
    (await h.request("location=S%C3%A3o%20Paulo%2C%20Brazil")).status,
    200,
  );
  assert.equal((await h.request("lat=-12.971456&lon=-38.501234")).status, 200);
  assert.ok(
    decodeURIComponent(new URL(h.calls[1].url).pathname).endsWith(
      "/-12.971,-38.501",
    ),
  );
});
test("routing, methods, origin checks and preflight make no provider calls", async () => {
  const h = harness();
  assert.equal((await h.request("location=Paris", {}, "/wrong")).status, 404);
  assert.equal(
    (await h.request("location=Paris", { method: "POST" })).status,
    405,
  );
  assert.equal(
    (
      await h.request("location=Paris", {
        headers: { Origin: "https://evil.test" },
      })
    ).status,
    403,
  );
  const response = await h.request("", {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:8080",
      "Access-Control-Request-Method": "GET",
    },
  });
  assert.equal(response.status, 204);
  assert.equal(h.calls.length, 0);
});
test("disabled endpoint, absent key or missing protection bindings fail closed", async () => {
  for (const key of [
    "VISUAL_CROSSING_API_KEY",
    "CLIENT_LIMITER",
    "UPSTREAM_LIMITER",
    "WEATHER_ENABLED",
  ]) {
    const h = harness();
    delete h.env[key];
    assert.equal((await h.request()).status, 503);
    assert.equal(h.calls.length, 0);
  }
});
test("both limits block calls and provide Retry-After", async () => {
  for (const options of [
    { clientAllowed: false },
    { upstreamAllowed: false },
  ]) {
    const h = harness(options);
    const response = await h.request();
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), "60");
    assert.equal(h.calls.length, 0);
  }
});
test("canonical cache hit avoids upstream budget and reapplies CORS; old data expires", async () => {
  const h = harness();
  const first = await (await h.request()).json();
  const secondResponse = await h.request("location=%20SALVADOR%20", {
    headers: { Origin: "https://progritit.github.io" },
  });
  const second = await secondResponse.json();
  assert.equal(second.meta.cache, "hit");
  assert.equal(second.meta.fetchedAt, first.meta.fetchedAt);
  assert.equal(
    secondResponse.headers.get("Access-Control-Allow-Origin"),
    "https://progritit.github.io",
  );
  assert.equal(h.calls.length, 1);
  assert.equal(h.upstreamChecks, 1);
  h.advance();
  assert.equal((await (await h.request()).json()).meta.cache, "miss");
  assert.equal(h.calls.length, 2);
});
test("upstream errors and thrown messages cannot expose provider credentials", async () => {
  for (const [upstream, expected] of [
    [400, 404],
    [401, 503],
    [403, 503],
    [429, 503],
    [500, 502],
  ]) {
    const h = harness({ status: upstream, body: SECRET });
    const response = await h.request();
    assert.equal(response.status, expected);
    assert.ok(!(await response.text()).includes(SECRET));
    assert.equal(h.entries.size, 0);
  }
  const h = harness({ throws: new Error(`Private URL?key=${SECRET}`) });
  const response = await h.request();
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes(SECRET));
});
test("timeout, malformed JSON, huge payloads and reflected secrets are safe", async () => {
  const timeout = new Error(SECRET);
  timeout.name = "TimeoutError";
  assert.equal((await harness({ throws: timeout }).request()).status, 504);
  for (const body of [
    "not json",
    "{}",
    "x".repeat(2 * 1024 * 1024 + 1),
    JSON.stringify({ timezone: SECRET, days: [] }),
  ]) {
    const h = harness({ body });
    const response = await h.request();
    assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes(SECRET));
    assert.equal(h.entries.size, 0);
  }
});
