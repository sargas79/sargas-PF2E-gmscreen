import { MODULE_ID } from "./constants.js";

export const SETTINGS = {
  windowState: "windowState",
  activeTab: "activeTab",
  pinnedCards: "pinnedCards",
  collapsedCards: "collapsedCards",
};

export function registerSettings() {
  // Size and position of the screen.
  game.settings.register(MODULE_ID, SETTINGS.windowState, {
    scope: "client",
    config: false,
    type: Object,
    default: {},
  });

  game.settings.register(MODULE_ID, SETTINGS.activeTab, {
    scope: "client",
    config: false,
    type: String,
    default: "rules",
  });

  // Card ids, e.g. "rules.dcs-by-level".
  game.settings.register(MODULE_ID, SETTINGS.pinnedCards, {
    scope: "client",
    config: false,
    type: Array,
    default: [],
  });

  game.settings.register(MODULE_ID, SETTINGS.collapsedCards, {
    scope: "client",
    config: false,
    type: Array,
    default: [],
  });
}

export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}

export function setSetting(key, value) {
  return game.settings.set(MODULE_ID, key, value);
}
