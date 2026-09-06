import "./styles.css";
import { fetchWeather } from "./api/weather.js";
import { mountApp } from "./ui/index.js";

mountApp(document.querySelector("#app"));

// Step 5 inspection only: the UI still renders its mock data until normalization.
void fetchWeather("Salvador").catch((error) => {
  console.warn("Solaris weather inspection failed:", error.message);
});
