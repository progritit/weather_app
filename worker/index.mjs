const PROVIDER =
  "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/";
const CACHE_SECONDS = 600;
const MAX_BYTES = 2 * 1024 * 1024;

class InputError extends Error {}

export function parseLocation(url) {
  const params = url.searchParams;
  for (const key of params.keys()) {
    if (
      !["location", "lat", "lon"].includes(key) ||
      params.getAll(key).length !== 1
    ) {
      throw new InputError("Use location OR lat and lon; no other parameters.");
    }
  }
  if (params.has("location")) {
    if (params.has("lat") || params.has("lon"))
      throw new InputError("Use a city or coordinates, not both.");
    const city = params
      .get("location")
      .normalize("NFKC")
      .trim()
      .replace(/\s+/gu, " ");
    if (
      city.length < 2 ||
      city.length > 120 ||
      !/^[\p{L}\p{M}\p{N} .,'’()-]+$/u.test(city) ||
      !/[\p{L}\p{N}]/u.test(city)
    ) {
      throw new InputError(
        "Enter a city or postal location between 2 and 120 characters.",
      );
    }
    return city.toLowerCase();
  }
  function coordinate(name, max) {
    const value = params.get(name);
    if (
      value === null ||
      !/^[+-]?\d+(?:\.\d+)?$/.test(value) ||
      !Number.isFinite(Number(value)) ||
      Math.abs(Number(value)) > max
    ) {
      throw new InputError(
        "Latitude must be between -90 and 90; longitude between -180 and 180.",
      );
    }
    // About 110 m latitude precision: enough for weather, improves cache reuse.
    return Number(Number(value).toFixed(3));
  }
  return `${coordinate("lat", 90)},${coordinate("lon", 180)}`;
}

function reply(body, status, origin, extra = {}) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
    ...extra,
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return new globalThis.Response(body === null ? null : JSON.stringify(body), {
    status,
    headers,
  });
}

function failure(status, code, message, origin, extra) {
  return reply({ error: { code, message } }, status, origin, extra);
}

async function readJson(response) {
  if (!response.body) throw new Error("Empty response");
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        throw new Error("Response too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new globalThis.TextDecoder().decode(buffer));
}

async function fetchWithTimeout(fetcher, url, timeoutMs = 10000) {
  const controller = new globalThis.AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, {
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timer);
  }
}

// Dependencies are injectable for tests. Production uses native Worker APIs.
export function createHandler({
  fetcher = (...args) => globalThis.fetch(...args),
  getCache = () => globalThis.caches.default,
  now = () => Date.now(),
} = {}) {
  return async function handle(request, env, ctx) {
    let origin = null;
    try {
      const url = new globalThis.URL(request.url);
      const requestedOrigin = request.headers.get("Origin");
      const allowed = (env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (requestedOrigin && !allowed.includes(requestedOrigin)) {
        return failure(
          403,
          "ORIGIN_NOT_ALLOWED",
          "This origin is not allowed.",
        );
      }
      origin = requestedOrigin;
      if (url.pathname !== "/api/weather")
        return failure(404, "NOT_FOUND", "Endpoint not found.", origin);
      if (request.method === "OPTIONS") {
        if (
          request.headers.get("Access-Control-Request-Method") !== "GET" ||
          request.headers.get("Access-Control-Request-Headers")
        ) {
          return failure(
            403,
            "PREFLIGHT_NOT_ALLOWED",
            "Only a simple GET request is supported.",
            origin,
          );
        }
        return reply(null, 204, origin, {
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Max-Age": "600",
        });
      }
      if (request.method !== "GET")
        return failure(405, "METHOD_NOT_ALLOWED", "Use GET.", origin, {
          Allow: "GET, OPTIONS",
        });
      if (url.search.length > 512)
        return failure(
          400,
          "INVALID_LOCATION",
          "Location query is too long.",
          origin,
        );
      let location;
      try {
        location = parseLocation(url);
      } catch (error) {
        if (error instanceof InputError)
          return failure(400, "INVALID_LOCATION", error.message, origin);
        throw error;
      }
      if (env.WEATHER_ENABLED !== "true" || !env.VISUAL_CROSSING_API_KEY) {
        return failure(
          503,
          "WEATHER_DISABLED",
          "Weather access is not enabled yet.",
          origin,
        );
      }
      // Fail closed if either binding is absent or fails; never bypass protection.
      if (!env.CLIENT_LIMITER?.limit || !env.UPSTREAM_LIMITER?.limit)
        throw new Error("Missing limiter");
      // Cloudflare supplies this header in production. Local requests share one key.
      const ip = request.headers.get("CF-Connecting-IP") || "local-or-unknown";
      const client = await env.CLIENT_LIMITER.limit({ key: `weather:${ip}` });
      if (!client.success)
        return failure(
          429,
          "RATE_LIMITED",
          "Too many requests. Try again shortly.",
          origin,
          { "Retry-After": "60" },
        );

      const digest = await globalThis.crypto.subtle.digest(
        "SHA-256",
        new globalThis.TextEncoder().encode(location),
      );
      const hash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const cacheKey = new globalThis.Request(
        `${url.origin}/__weather_cache/v1/${hash}`,
      );
      let cache;
      let cached;
      try {
        cache = getCache();
        cached = await cache.match(cacheKey);
      } catch {
        /* Cache failure must not bypass the upstream limiter. */
      }
      if (cached) {
        try {
          const payload = await cached.json();
          const age = now() - Date.parse(payload.meta.fetchedAt);
          if (age >= 0 && age < CACHE_SECONDS * 1000)
            return reply(
              { ...payload, meta: { ...payload.meta, cache: "hit" } },
              200,
              origin,
            );
        } catch {
          /* Ignore corrupt entries. */
        }
      }
      const budget = await env.UPSTREAM_LIMITER.limit({
        key: "visual-crossing-forecast",
      });
      if (!budget.success)
        return failure(
          429,
          "UPSTREAM_RATE_LIMITED",
          "Weather requests are busy. Try again shortly.",
          origin,
          { "Retry-After": "60" },
        );

      const upstream = new globalThis.URL(
        PROVIDER + encodeURIComponent(location),
      );
      upstream.search = new globalThis.URLSearchParams({
        key: env.VISUAL_CROSSING_API_KEY,
        unitGroup: "metric",
        contentType: "json",
        include: "current,days,hours,alerts",
        lang: "en",
      }).toString();
      // Dates, API parameters, destination and redirects cannot be chosen by callers.
      let data;
      try {
        const result = await fetchWithTimeout(
          fetcher,
          upstream.toString(),
        );

        if (!result.ok) {
          await result.body?.cancel();
          if ([400, 404].includes(result.status))
            return failure(
              404,
              "LOCATION_NOT_FOUND",
              "No weather was found for that location.",
              origin,
            );
          if ([401, 403, 429].includes(result.status))
            return failure(
              503,
              "PROVIDER_UNAVAILABLE",
              "The weather provider is temporarily unavailable.",
              origin,
              { "Retry-After": "60" },
            );
          return failure(
            502,
            "PROVIDER_ERROR",
            "The weather provider could not complete the request.",
            origin,
          );
        }
        data = await readJson(result);
      } catch (error) {
        const timeout = ["TimeoutError", "AbortError"].includes(error.name);
        return failure(
          timeout ? 504 : 502,
          timeout ? "PROVIDER_TIMEOUT" : "PROVIDER_ERROR",
          "The weather provider could not complete the request.",
          origin,
        );
      }
      if (
        !data ||
        typeof data !== "object" ||
        !Array.isArray(data.days) ||
        typeof data.timezone !== "string"
      ) {
        return failure(
          502,
          "INVALID_PROVIDER_DATA",
          "The weather provider returned an unexpected response.",
          origin,
        );
      }
      const payload = {
        data,
        meta: {
          provider: "Visual Crossing",
          units: "metric",
          fetchedAt: new Date(now()).toISOString(),
          cache: "miss",
          cacheTtlSeconds: CACHE_SECONDS,
        },
      };
      const serialized = JSON.stringify(payload);
      // Defense in depth: never echo the credential, even if upstream reflects it.
      if (serialized.includes(env.VISUAL_CROSSING_API_KEY))
        return failure(
          502,
          "INVALID_PROVIDER_DATA",
          "The weather provider returned an unexpected response.",
          origin,
        );
      if (cache) {
        ctx.waitUntil(
          cache
            .put(
              cacheKey,
              new globalThis.Response(serialized, {
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
                },
              }),
            )
            .catch(() => {}),
        );
      }
      return reply(payload, 200, origin);
    } catch {
      // Never log or return exception messages, provider URLs, headers or bodies.
      return failure(
        503,
        "SERVICE_UNAVAILABLE",
        "Weather access is temporarily unavailable.",
        origin,
      );
    }
  };
}

export default { fetch: createHandler() };
