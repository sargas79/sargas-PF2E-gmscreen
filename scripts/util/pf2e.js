import { SETTINGS, getSetting } from "../settings.js";

/**
 * The only place in this module that reads pf2e actor data. PF2e changes its data model
 * between releases; when something breaks, fix it here.
 */

/** The world's active PF2e Party actor, if there is one. */
export function getPartyActor() {
  return game.actors.party ?? null;
}

/**
 * The PCs shown on the Party tab: the GM's override list, else the Party actor's characters,
 * else every character with a player owner.
 */
export function getPartyMembers() {
  const override = getSetting(SETTINGS.partyOverride) ?? [];
  if (override.length) {
    return override.map((id) => game.actors.get(id)).filter((a) => a?.type === "character");
  }
  const party = getPartyActor();
  if (party) return party.members.filter((m) => m.type === "character");
  return game.actors.filter((a) => a.type === "character" && a.hasPlayerOwner);
}

/** Characters the GM can choose from when overriding the party. */
export function getCandidateMembers() {
  const partyIds = new Set(getPartyActor()?.members.map((m) => m.id) ?? []);
  return game.actors
    .filter((a) => a.type === "character" && (a.hasPlayerOwner || partyIds.has(a.id)))
    .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
}

export function isPartyMember(actor) {
  if (!actor) return false;
  return getPartyMembers().some((m) => m.id === actor.id);
}

/** Average member level, rounded; null with no members. */
export function getPartyLevel(members = getPartyMembers()) {
  if (!members.length) return null;
  return Math.round(members.reduce((sum, m) => sum + (m.level ?? 0), 0) / members.length);
}

/** Everything a Party tab row shows, as plain data. */
export function summarizeCharacter(actor) {
  const hp = actor.system.attributes?.hp ?? {};
  const hpPercent = hp.max ? Math.clamp(Math.round((100 * (hp.value ?? 0)) / hp.max), 0, 100) : 0;
  const perceptionMod = actor.perception?.mod ?? 0;
  const spellDCs = Array.from(actor.spellcasting ?? [])
    .map((entry) => entry.statistic?.dc?.value)
    .filter((dc) => typeof dc === "number");
  const speed = actor.attributes?.speed;

  return {
    id: actor.id,
    uuid: actor.uuid,
    name: actor.name,
    img: actor.img,
    className: actor.class?.name ?? "",
    level: actor.level,
    hp: {
      value: hp.value ?? 0,
      max: hp.max ?? 0,
      temp: hp.temp ?? 0,
      percent: hpPercent,
      state: hpPercent <= 33 ? "low" : hpPercent <= 66 ? "mid" : "",
    },
    ac: actor.armorClass?.value ?? null,
    saves: {
      fortitude: actor.saves?.fortitude?.mod ?? null,
      reflex: actor.saves?.reflex?.mod ?? null,
      will: actor.saves?.will?.mod ?? null,
    },
    perception: { mod: perceptionMod, dc: 10 + perceptionMod },
    classDC: actor.classDC?.dc?.value ?? null,
    spellDC: spellDCs.length ? Math.max(...spellDCs) : null,
    heroPoints: actor.heroPoints ?? { value: 0, max: 0 },
    conditions: (actor.conditions?.active ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      img: c.img,
      value: c.value ?? null,
    })),
    speeds: [
      speed?.total != null ? `${speed.total} ft` : null,
      ...(speed?.otherSpeeds ?? []).map((s) => `${s.label} ${s.total} ft`),
    ].filter(Boolean),
    senses: Array.from(actor.perception?.senses ?? [])
      .map((s) => s.label)
      .filter(Boolean),
  };
}

/** Checks offered for secret group rolls: Perception plus every core skill. */
export function getSecretCheckOptions() {
  const skills = Object.entries(CONFIG.PF2E?.skills ?? {}).map(([slug, data]) => ({
    value: slug,
    label: game.i18n.localize(typeof data === "string" ? data : data.label),
  }));
  return [{ value: "perception", label: game.i18n.localize("SARGAS_GMSCREEN.Party.Stats.perception") }, ...skills];
}

export function getCheckStatistic(actor, slug) {
  return slug === "perception" ? actor.perception : actor.skills?.[slug];
}

/** Add HP (negative to subtract), clamped to 0..max. */
export function adjustHitPoints(actor, delta) {
  const hp = actor.system.attributes.hp;
  const value = Math.clamp(hp.value + delta, 0, hp.max);
  return actor.update({ "system.attributes.hp.value": value });
}

/** Apply a dropped condition or effect item to an actor. */
export async function applyItem(actor, item) {
  if (item.type === "condition") return actor.increaseCondition(item.slug);
  if (["effect", "affliction"].includes(item.type)) return actor.createEmbeddedDocuments("Item", [item.toObject()]);
  return null;
}

/** Item types from `pf2e.equipment-srd`, grouped the way the loot roller filters them. */
export const LOOT_CATEGORIES = {
  permanent: ["weapon", "armor", "shield", "equipment", "backpack"],
  consumable: ["consumable", "ammo"],
  treasure: ["treasure"],
};

export const LOOT_INDEX_FIELDS = [
  "type",
  "system.level.value",
  "system.price.value",
  "system.traits.rarity",
  "system.traits.value",
];

/** Normalize a `pf2e.equipment-srd` index entry. */
export function summarizeLootEntry(entry) {
  const price = entry.system?.price?.value ?? {};
  const category = Object.entries(LOOT_CATEGORIES).find(([, types]) => types.includes(entry.type))?.[0] ?? null;
  return {
    uuid: entry.uuid,
    name: entry.name,
    type: entry.type,
    category,
    level: entry.system?.level?.value ?? 0,
    rarity: entry.system?.traits?.rarity ?? "common",
    traits: entry.system?.traits?.value ?? [],
    price,
    priceGp: coinsToGp(price),
  };
}

export function coinsToGp({ pp = 0, gp = 0, sp = 0, cp = 0 } = {}) {
  return pp * 10 + gp + sp / 10 + cp / 100;
}

export function formatCoins({ pp = 0, gp = 0, sp = 0, cp = 0 } = {}) {
  const parts = [
    [pp, "pp"],
    [gp, "gp"],
    [sp, "sp"],
    [cp, "cp"],
  ].filter(([n]) => n);
  return parts.length ? parts.map(([n, unit]) => `${n.toLocaleString(game.i18n.lang)} ${unit}`).join(" ") : "—";
}

export function addCoins(actor, coins) {
  return actor.inventory.addCoins(coins);
}

export function decreaseCondition(actor, conditionId, { remove = false } = {}) {
  const condition = actor.items.get(conditionId);
  if (!condition) return null;
  return actor.decreaseCondition(condition, { forceRemove: remove });
}
