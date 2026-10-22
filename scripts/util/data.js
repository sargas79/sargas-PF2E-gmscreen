import { MODULE_ID } from "../constants.js";

const cache = new Map();

/** Load a JSON file from this module's `data/` folder, once per session. */
export function loadData(name) {
  if (!cache.has(name)) {
    const promise = fetch(`modules/${MODULE_ID}/data/${name}.json`).then((response) => {
      if (!response.ok) throw new Error(`${MODULE_ID} | Failed to load data/${name}.json (${response.status})`);
      return response.json();
    });
    cache.set(name, promise);
  }
  return cache.get(name);
}
