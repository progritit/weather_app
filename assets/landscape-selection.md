# Landscape selection

The weather provider tells the app the weather and coordinates. It does not reliably tell the app whether the surrounding scene should look coastal, urban, or rural. Treat landscape classification as a separate, best-effort display feature; it must never block the forecast.

## Recommended decision flow

1. Store a per-location preference: `auto`, `coastal`, `urban`, `countryside`, or `neutral`. If the user chooses a category, use it and remember it by a stable location key such as rounded latitude/longitude plus country code.
2. In `auto`, resolve the location to latitude/longitude. A searched location can use the coordinates returned by the weather query; “Use my location” starts with the browser coordinates and then performs reverse geocoding for its label.
3. Check coastal proximity first. A small server-side landscape endpoint can compare the point with a coastline dataset, or a curated coastal-city list can cover the first portfolio version. Use a conservative threshold such as approximately 25 km and mark the result `coastal` only when confidence is good.
4. If it is not coastal, use an urban signal: a geocoder's `city`/`town` feature, an available population or built-up-area signal, or a maintained city metadata table. Use `urban` only when the signal is positive.
5. Use `countryside` only when a rural/village/field signal is positive. Otherwise use the neutral fallback and show “Landscape not determined” rather than presenting a guess as fact.

The simple first version can use a small curated hint table for the demonstration locations, then add automatic geographic classification later:

| Location          | Default category | Why                                                             |
| ----------------- | ---------------- | --------------------------------------------------------------- |
| Salvador, Brazil  | `coastal`        | Coastal city; preserve the existing ocean scenes.               |
| Paris, France     | `urban`          | Inland metropolitan setting.                                    |
| São Paulo, Brazil | `urban`          | Inland metropolitan setting.                                    |
| A rural village   | `countryside`    | Use only when the geocoder or metadata provides a rural signal. |

## Why the user override matters

Classification is not the same as truth about a whole metropolitan area. A coastal city can contain dense urban neighborhoods, parks, hills, and inland districts. The selector should therefore contain **Auto**, **Coastal**, **Urban**, **Countryside**, and **Neutral**. “Auto” is a helpful default, not a promise that the scenery is geographically exact.

## API boundaries

- Visual Crossing: weather, forecasts, sunrise/sunset, timezone, and the searched location's coordinates.
- Browser Geolocation: permission-based latitude/longitude for “Use my location”.
- Reverse geocoding: readable city/region/country for coordinate-based searches.
- Optional geographic classifier: coastline proximity and urban/rural metadata. Keep this behind the same small Worker as the weather request, cache its result, and validate all user input.

Do not call a public geocoder repeatedly from every browser client without respecting its usage policy. Cache classification by rounded coordinates, add a neutral fallback, and retain manual search if permission or reverse geocoding fails.

## Theme selection remains independent

The final asset key has three independent inputs:

```js
const assetKey = `${landscapeCategory}-${weatherCondition}-${isDay ? "day" : "night"}`;
```

`weatherCondition` comes from the normalized provider condition, `day/night` comes from the selected location's sunrise and sunset, and `landscapeCategory` comes from the preference/classifier. Rain does not automatically mean night, and a city type does not change the weather data.
