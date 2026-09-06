import "./styles.css";
import "./ui/live.css";
import { createStore } from "./state.js";
import { createStorage } from "./storage.js";
import { createWeatherSearch } from "./search.js";
import { mountApp } from "./ui/index.js";

const storage = createStorage();
const store = createStore({
  preferences: storage.readPreferences(),
  recent: storage.readRecent(),
});
const search = createWeatherSearch({
  store,
  storage,
  onResult: (weather) => console.log("Solaris normalized weather:", weather),
});
mountApp(document.querySelector("#app"), { store, storage, search });
const state = store.getState();
const initialPlace =
  state.saved.find((place) => place.id === state.defaultId) ?? state.recent[0];
void search.search(initialPlace?.query ?? "Salvador, Brazil", {
  remember: false,
});
