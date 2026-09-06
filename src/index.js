import "./styles.css";
import { fetchWeather } from "./api/weather.js";
import { normalizeWeather } from "./data/normalizeWeather.js";
import { mountApp } from "./ui/index.js";

mountApp(document.querySelector("#app"));

// Step 6: inspect the app model before connecting it to state and live rendering.
async function inspectWeather() {
  try {
    const response = await fetchWeather("Salvador");
    const weather = normalizeWeather(response, { referenceTimeMs: Date.now() });
    console.log("Solaris normalized weather:", weather);
  } catch (error) {
    console.warn("Solaris weather inspection failed:", error.message);
  }
}

void inspectWeather();
