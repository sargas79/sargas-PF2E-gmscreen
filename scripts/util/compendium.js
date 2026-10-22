import { MODULE_ID } from "../constants.js";

const indexes = new Map();

/** The PF2e system's built-in "GM Screen" journal and the pages this module links to. */
export const GM_SCREEN_JOURNAL = "Compendium.pf2e.journals.JournalEntry.S55aqwWIzpQRFhcq";
export const GM_SCREEN_PAGES = {
  bonuses: "9e26SSQNYcyizEQ2",
  dying: "KdoLyU91c0oS2hTw",
  basicActions: "ZrEmfrgDlmlhdvQg",
  terrainCover: "z68vgV2XWhi1KYEP",
  falling: "QnqlEgRJdEsrdM9q",
  conditions: "7sclmGmVRrNOjlNF",
  light: "pW3Q267nqiRu4h38",
  simpleDCs: "4hahgIx6iZfRMpT8",
  dcsByLevel: "pBS3DUjlzVuFgapv",
  heroPoints: "iufSTIPL6F63UTCv",
  dcAdjustments: "7zHsWW9q6YqiMIwy",
  creatureIdentification: "oEyx39yADr2OjfTz",
  treasure: "Dae8LHdXZuBv06Jk",
};

export function gmScreenPageUuid(page) {
  return `${GM_SCREEN_JOURNAL}.JournalEntryPage.${GM_SCREEN_PAGES[page]}`;
}

/**
 * A compendium's index with the given extra fields, cached for the session.
 * Resolves to `null` (and warns once) when the pack doesn't exist, e.g. after a system rename.
 */
export function getIndex(packId, fields = []) {
  const key = `${packId}|${fields.join(",")}`;
  if (!indexes.has(key)) {
    const pack = game.packs.get(packId);
    if (!pack) {
      console.warn(`${MODULE_ID} | Compendium "${packId}" not found`);
      indexes.set(key, Promise.resolve(null));
    } else {
      indexes.set(key, pack.getIndex({ fields }));
    }
  }
  return indexes.get(key);
}

/** `@UUID[uuid]{label}`, ready for {@link enrich}. */
export function uuidLink(uuid, label) {
  return label ? `@UUID[${uuid}]{${label}}` : `@UUID[${uuid}]`;
}

/** Turn `@UUID[...]` links into draggable, clickable content links. */
export function enrich(text) {
  return foundry.applications.ux.TextEditor.implementation.enrichHTML(text);
}

/** Plain-text first sentence of an HTML description, with inline roll/link syntax resolved to its label. */
export function summarize(html, maxLength = 140) {
  const text = (html ?? "")
    .replace(/@\w+\[[^\]]*\](?:\{([^}]*)\})?/g, (_, label) => label ?? "")
    .replace(/\[\[[^\]]*\]\]/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = text.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? text;
  return sentence.length > maxLength ? `${sentence.slice(0, maxLength - 1)}…` : sentence;
}
