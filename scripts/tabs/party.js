export const id = "party";
export const icon = "fa-solid fa-users";

export const actions = {};

/** @returns {Promise<import("../apps/gm-screen.js").CardData[]>} */
export async function prepareCards() {
  return [{ id: "placeholder", title: game.i18n.localize("SARGAS_GMSCREEN.Tabs.party"), icon, body: "" }];
}
