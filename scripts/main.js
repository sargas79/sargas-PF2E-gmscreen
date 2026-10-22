import { I18N, MODULE_ID } from "./constants.js";
import { registerSettings } from "./settings.js";
import { GMScreen } from "./apps/gm-screen.js";

/** @type {GMScreen|null} */
let screen = null;

function getScreen() {
  screen ??= new GMScreen();
  return screen;
}

function open() {
  if (!game.user.isGM) return;
  return getScreen().render({ force: true });
}

function close() {
  return screen?.close();
}

function toggle() {
  if (!game.user.isGM) return;
  return screen?.rendered ? close() : open();
}

Hooks.once("init", () => {
  registerSettings();

  // `restricted` limits the keybinding to GMs.
  game.keybindings.register(MODULE_ID, "toggle", {
    name: `${I18N}.Keybindings.Toggle.Name`,
    hint: `${I18N}.Keybindings.Toggle.Hint`,
    editable: [{ key: "KeyG", modifiers: ["Shift"] }],
    restricted: true,
    onDown: () => {
      toggle();
      return true;
    },
  });

  game.modules.get(MODULE_ID).api = { open, close, toggle };
});

Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;
  const tokens = controls.tokens;
  if (!tokens) return;
  tokens.tools[MODULE_ID] = {
    name: MODULE_ID,
    title: `${I18N}.Controls.Toggle`,
    icon: "fa-solid fa-book-open",
    order: Object.keys(tokens.tools).length,
    button: true,
    visible: true,
    onChange: () => toggle(),
  };
});
