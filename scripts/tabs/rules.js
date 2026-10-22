export const id = "rules";
export const icon = "fa-solid fa-scale-balanced";

export const actions = {};

/** @returns {Promise<import("../apps/gm-screen.js").CardData[]>} */
export async function prepareCards() {
  return [{ id: "placeholder", title: game.i18n.localize("SARGAS_GMSCREEN.Tabs.rules"), icon, body: "" }];
}
