export const id = "treasure";
export const icon = "fa-solid fa-coins";

export const actions = {};

/** @returns {Promise<import("../apps/gm-screen.js").CardData[]>} */
export async function prepareCards() {
  return [{ id: "placeholder", title: game.i18n.localize("SARGAS_GMSCREEN.Tabs.treasure"), icon, body: "" }];
}
