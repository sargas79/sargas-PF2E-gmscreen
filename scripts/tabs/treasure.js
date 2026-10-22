import { I18N, MODULE_ID } from "../constants.js";
import { SETTINGS, getSetting, setSetting } from "../settings.js";
import { loadData } from "../util/data.js";
import { bindOnce } from "../util/dom.js";
import { enrich, getIndex, uuidLink } from "../util/compendium.js";
import {
  LOOT_CATEGORIES,
  LOOT_INDEX_FIELDS,
  addCoins,
  coinsToGp,
  formatCoins,
  getPartyActor,
  getPartyLevel,
  getPartyMembers,
  summarizeLootEntry,
} from "../util/pf2e.js";

export const id = "treasure";
export const icon = "fa-solid fa-coins";

const TEMPLATES = `modules/${MODULE_ID}/templates/treasure`;
const { renderTemplate } = foundry.applications.handlebars;
const REFRESH_PARTS = ["treasure", "toolbar"];
const RARITIES = ["common", "uncommon", "rare", "unique"];
/** The treasure table is written for a party of four. */
const BASE_PARTY_SIZE = 4;

/** Per-session UI state; the screen is a singleton. */
const state = {
  budgetLevel: null,
  loot: [],
  lootOptions: { minLevel: null, maxLevel: null, category: "any", rarity: "common", traits: "", count: 4 },
};

export const actions = {
  addLogEntry: onAddLogEntry,
  removeLogEntry: onRemoveLogEntry,
  rollLoot: onRollLoot,
  rerollLoot: onRerollLoot,
  clearLoot: onClearLoot,
  postLoot: onPostLoot,
  stashLoot: onStashLoot,
  splitCoins: onSplitCoins,
  stashCoins: onStashCoins,
};

/** @returns {Promise<import("../apps/gm-screen.js").CardData[]>} */
export async function prepareCards() {
  const t = (key) => game.i18n.localize(`${I18N}.Treasure.${key}`);
  const table = await loadData("treasure-by-level");
  const members = getPartyMembers();
  const partyLevel = Math.clamp(getPartyLevel(members) ?? 1, 1, 20);
  const partySize = members.length || BASE_PARTY_SIZE;
  const budgetLevel = state.budgetLevel ?? partyLevel;
  const options = { ...state.lootOptions };
  options.minLevel ??= partyLevel;
  options.maxLevel ??= partyLevel + 1;

  const cards = [
    {
      id: "by-level",
      icon: "fa-solid fa-table",
      template: "by-level",
      data: {
        rows: table.map((row) => ({
          ...row,
          permanent: formatItemCounts(row.permanent),
          consumables: formatItemCounts(row.consumables),
          highlight: row.level === partyLevel,
        })),
      },
    },
    {
      id: "budget",
      icon: "fa-solid fa-scale-unbalanced",
      template: "budget",
      data: await prepareBudget(table, budgetLevel, partySize),
    },
    {
      id: "loot",
      icon: "fa-solid fa-dice",
      template: "loot",
      data: {
        options,
        categories: ["any", ...Object.keys(LOOT_CATEGORIES)].map((value) => ({
          value,
          label: t(`Categories.${value}`),
        })),
        rarities: ["any", ...RARITIES].map((value) => ({ value, label: t(`Rarities.${value}`) })),
        results: await Promise.all(
          state.loot.map(async (item, index) => ({
            ...item,
            index,
            link: await enrich(uuidLink(item.uuid, item.name)),
            priceLabel: formatCoins(item.price),
            rarityLabel: t(`Rarities.${item.rarity}`),
          })),
        ),
        hasParty: !!getPartyActor(),
      },
    },
    {
      id: "coins",
      icon: "fa-solid fa-sack-dollar",
      template: "coins",
      data: { memberCount: members.length, hasParty: !!getPartyActor() },
    },
  ];

  return Promise.all(
    cards.map(async ({ template, data, ...card }) => ({
      ...card,
      title: t(`Cards.${card.id}`),
      body: await renderTemplate(`${TEMPLATES}/${template}.hbs`, data),
    })),
  );
}

export function onRender(app, element) {
  for (const select of element.querySelectorAll("select[name=budgetLevel]")) {
    if (!bindOnce(select)) continue;
    select.addEventListener("change", (event) => {
      state.budgetLevel = Number(event.currentTarget.value);
      app.render({ parts: REFRESH_PARTS });
    });
  }
}

/* -------------------------------------------- */
/*  Budget tracker                              */
/* -------------------------------------------- */

async function prepareBudget(table, level, partySize) {
  const row = table.find((r) => r.level === level) ?? table[0];
  const currencyAdjustment = row.perExtraPc * (partySize - BASE_PARTY_SIZE);
  const budget = row.total + currencyAdjustment;
  const entries = getTreasureLog().filter((e) => e.level === level);
  const given = entries.reduce((sum, e) => sum + e.value, 0);

  return {
    level,
    levels: table.map((r) => ({ value: r.level, label: r.level, selected: r.level === level })),
    partySize,
    budget,
    currency: row.currency + currencyAdjustment,
    given: round(given),
    remaining: round(budget - given),
    over: given > budget,
    percent: budget ? Math.clamp(Math.round((100 * given) / budget), 0, 100) : 0,
    entries: entries.map((e) => ({ ...e, kindLabel: game.i18n.localize(`${I18N}.Treasure.Categories.${e.kind}`) })),
    kinds: ["permanent", "consumable", "currency"].map((value) => ({
      value,
      label: game.i18n.localize(`${I18N}.Treasure.Categories.${value}`),
    })),
    storage: getPartyActor() ? "partyActor" : "world",
  };
}

/** Stored on the Party actor when there is one, so it travels with the party; otherwise in a world setting. */
function getTreasureLog() {
  const party = getPartyActor();
  const log = party ? party.getFlag(MODULE_ID, "treasureLog") : getSetting(SETTINGS.treasureLog);
  return Array.isArray(log) ? log : [];
}

async function setTreasureLog(log) {
  const party = getPartyActor();
  if (party) await party.setFlag(MODULE_ID, "treasureLog", log);
  else await setSetting(SETTINGS.treasureLog, log);
}

async function logTreasure(entries) {
  const level = state.budgetLevel ?? Math.clamp(getPartyLevel() ?? 1, 1, 20);
  const added = entries.map((e) => ({ id: foundry.utils.randomID(), level, ...e, value: round(e.value) }));
  await setTreasureLog([...getTreasureLog(), ...added]);
}

async function onAddLogEntry(event, target) {
  const card = target.closest(".gms-card");
  const label = card.querySelector("input[name=logLabel]")?.value.trim();
  const value = Number(card.querySelector("input[name=logValue]")?.value);
  const kind = card.querySelector("select[name=logKind]")?.value ?? "permanent";
  if (!label || !Number.isFinite(value) || value <= 0) {
    ui.notifications.warn(game.i18n.localize(`${I18N}.Treasure.InvalidEntry`));
    return;
  }
  await logTreasure([{ label, value, kind }]);
  this.render({ parts: REFRESH_PARTS });
}

async function onRemoveLogEntry(event, target) {
  const entryId = target.dataset.entryId;
  await setTreasureLog(getTreasureLog().filter((e) => e.id !== entryId));
  this.render({ parts: REFRESH_PARTS });
}

/* -------------------------------------------- */
/*  Loot roller                                 */
/* -------------------------------------------- */

function readLootOptions(card) {
  const value = (name) => card.querySelector(`[name=${name}]`)?.value ?? "";
  const minLevel = Math.clamp(Number(value("lootMinLevel")) || 0, 0, 30);
  const maxLevel = Math.clamp(Number(value("lootMaxLevel")) || minLevel, minLevel, 30);
  return {
    minLevel,
    maxLevel,
    category: value("lootCategory") || "any",
    rarity: value("lootRarity") || "any",
    traits: value("lootTraits"),
    count: Math.clamp(Number(value("lootCount")) || 1, 1, 20),
  };
}

async function getLootCandidates(options) {
  const index = await getIndex("pf2e.equipment-srd", LOOT_INDEX_FIELDS);
  if (!index) {
    ui.notifications.error(game.i18n.localize(`${I18N}.Rules.MissingCompendium`));
    return [];
  }
  const traits = options.traits
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return [...index]
    .map(summarizeLootEntry)
    .filter(
      (item) =>
        item.category &&
        item.level >= options.minLevel &&
        item.level <= options.maxLevel &&
        (options.category === "any" || item.category === options.category) &&
        (options.rarity === "any" || item.rarity === options.rarity) &&
        traits.every((t) => item.traits.includes(t)),
    );
}

async function onRollLoot(event, target) {
  const options = readLootOptions(target.closest(".gms-card"));
  state.lootOptions = options;
  const candidates = await getLootCandidates(options);
  if (!candidates.length) ui.notifications.warn(game.i18n.localize(`${I18N}.Treasure.NoCandidates`));
  state.loot = sample(candidates, options.count);
  this.render({ parts: REFRESH_PARTS });
}

async function onRerollLoot(event, target) {
  const index = Number(target.dataset.index);
  const taken = new Set(state.loot.map((i) => i.uuid));
  const candidates = (await getLootCandidates(state.lootOptions)).filter((i) => !taken.has(i.uuid));
  const [replacement] = sample(candidates, 1);
  if (!replacement) {
    ui.notifications.warn(game.i18n.localize(`${I18N}.Treasure.NoCandidates`));
    return;
  }
  state.loot.splice(index, 1, replacement);
  this.render({ parts: REFRESH_PARTS });
}

function onClearLoot() {
  state.loot = [];
  this.render({ parts: REFRESH_PARTS });
}

async function onPostLoot(event, target) {
  if (!state.loot.length) return;
  const visibility = target.closest(".gms-card").querySelector("select[name=lootVisibility]")?.value;
  const items = state.loot.map((i) => `<li>${uuidLink(i.uuid, i.name)} (${i.level}, ${formatCoins(i.price)})</li>`);
  await ChatMessage.create({
    content: `<h3>${game.i18n.localize(`${I18N}.Treasure.Cards.loot`)}</h3><ul>${items.join("")}</ul>`,
    whisper: visibility === "public" ? [] : game.users.filter((u) => u.isGM).map((u) => u.id),
  });
}

async function onStashLoot() {
  const party = getPartyActor();
  if (!party || !state.loot.length) {
    if (!party) ui.notifications.warn(game.i18n.localize(`${I18N}.Treasure.NoPartyActor`));
    return;
  }
  const items = (await Promise.all(state.loot.map((i) => fromUuid(i.uuid)))).filter(Boolean);
  await party.createEmbeddedDocuments(
    "Item",
    items.map((i) => i.toObject()),
  );
  await logTreasure(
    state.loot.map((i) => ({
      label: i.name,
      value: i.priceGp,
      kind: i.category === "consumable" ? "consumable" : i.category === "treasure" ? "currency" : "permanent",
    })),
  );
  ui.notifications.info(
    game.i18n.format(`${I18N}.Treasure.Stashed`, { count: items.length, party: party.name }),
  );
  state.loot = [];
  this.render({ parts: REFRESH_PARTS });
}

/* -------------------------------------------- */
/*  Coin splitter                               */
/* -------------------------------------------- */

function readCoins(card) {
  const value = (name) => Math.max(0, Math.floor(Number(card.querySelector(`input[name=${name}]`)?.value) || 0));
  return { pp: value("coinsPp"), gp: value("coinsGp"), sp: value("coinsSp"), cp: value("coinsCp") };
}

/** Split coins evenly, keeping each PC's share in the largest denominations. */
export function splitCoins(coins, ways) {
  const totalCp = coins.pp * 1000 + coins.gp * 100 + coins.sp * 10 + coins.cp;
  const shareCp = Math.floor(totalCp / ways);
  const remainderCp = totalCp - shareCp * ways;
  return { share: cpToCoins(shareCp), remainder: cpToCoins(remainderCp) };
}

function cpToCoins(cp) {
  return { gp: Math.floor(cp / 100), sp: Math.floor((cp % 100) / 10), cp: cp % 10 };
}

async function onSplitCoins(event, target) {
  const members = getPartyMembers();
  const coins = readCoins(target.closest(".gms-card"));
  if (!members.length || !Object.values(coins).some(Boolean)) return;

  const { share, remainder } = splitCoins(coins, members.length);
  for (const actor of members) await addCoins(actor, share);
  const party = getPartyActor();
  if (party && Object.values(remainder).some(Boolean)) await addCoins(party, remainder);
  await logTreasure([{ label: game.i18n.localize(`${I18N}.Treasure.CoinsLabel`), value: coinsToGp(coins), kind: "currency" }]);

  ui.notifications.info(
    game.i18n.format(`${I18N}.Treasure.Split`, {
      share: formatCoins(share),
      count: members.length,
      remainder: formatCoins(remainder),
    }),
  );
  this.render({ parts: REFRESH_PARTS });
}

async function onStashCoins(event, target) {
  const party = getPartyActor();
  const coins = readCoins(target.closest(".gms-card"));
  if (!party) {
    ui.notifications.warn(game.i18n.localize(`${I18N}.Treasure.NoPartyActor`));
    return;
  }
  if (!Object.values(coins).some(Boolean)) return;
  await addCoins(party, coins);
  await logTreasure([{ label: game.i18n.localize(`${I18N}.Treasure.CoinsLabel`), value: coinsToGp(coins), kind: "currency" }]);
  this.render({ parts: REFRESH_PARTS });
}

/* -------------------------------------------- */

function formatItemCounts(pairs) {
  return pairs.map(([level, count]) => `${count}×${level}`).join(" ");
}

function sample(array, count) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function round(value) {
  return Math.round(value * 100) / 100;
}
