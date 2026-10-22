import * as rules from "./rules.js";
import * as party from "./party.js";
import * as treasure from "./treasure.js";

/**
 * Every tab module exports:
 * - `id`, `icon`
 * - `prepareCards(app)` → CardData[] (card ids are local to the tab)
 * - `actions`: ApplicationV2 action handlers, merged into the screen's actions
 * - optional `onRender(app, element)` to wire listeners that actions can't cover (drops, inputs)
 */
export const TABS = [rules, party, treasure];
