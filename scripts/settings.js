import { MODULE_ID } from "./constants.js";

export const SETTINGS = {
  windowState: "windowState",
};

export function registerSettings() {
  // Size, position and detached state of the screen; filled in by M1.
  game.settings.register(MODULE_ID, SETTINGS.windowState, {
    scope: "client",
    config: false,
    type: Object,
    default: {},
  });
}
