import { I18N, MODULE_ID } from "../constants.js";
import { SETTINGS, getSetting, setSetting } from "../settings.js";
import { loadData } from "../util/data.js";
import { bindOnce } from "../util/dom.js";
import { GM_SCREEN_JOURNAL, enrich, getIndex, gmScreenPageUuid, summarize, uuidLink } from "../util/compendium.js";

export const id = "rules";
export const icon = "fa-solid fa-scale-balanced";

const TEMPLATES = `modules/${MODULE_ID}/templates/rules`;
const { renderTemplate } = foundry.applications.handlebars;

/** Folder ids inside the pf2e `actionspf2e` compendium. */
const ACTION_FOLDERS = { basic: "dfRpdU8Efsenms12", skill: "0Z6sKp3ActW2pM2e" };
const ACTION_GROUPS = ["basic", "skill", "exploration", "downtime"];

export const actions = {};

export function onRender(app, element) {
  element.querySelectorAll("textarea[name=gmNotes]").forEach((textarea) => {
    if (!bindOnce(textarea)) return;
    textarea.addEventListener("change", (event) => setSetting(SETTINGS.notes, event.currentTarget.value));
  });
}

/** @returns {Promise<import("../apps/gm-screen.js").CardData[]>} */
export async function prepareCards(app) {
  const t = (key) => game.i18n.localize(`${I18N}.Rules.${key}`);
  const fullRules = (page) => enrich(uuidLink(gmScreenPageUuid(page), t("FullRules")));
  const partyLevel = app.partyLevel ?? null;

  const [dcsByLevel, adjustments, recallKnowledge] = await Promise.all([
    loadData("dc-by-level"),
    loadData("dc-adjustments"),
    loadData("recall-knowledge"),
  ]);

  const cards = [
    {
      id: "dcs-by-level",
      icon: "fa-solid fa-stairs",
      template: "dcs-by-level",
      data: {
        columns: chunk(
          dcsByLevel.map((row) => ({ ...row, highlight: row.level === partyLevel })),
          Math.ceil(dcsByLevel.length / 3),
        ),
        link: await fullRules("dcsByLevel"),
      },
    },
    {
      id: "dc-adjustments",
      icon: "fa-solid fa-sliders",
      template: "dc-adjustments",
      data: {
        ...adjustments,
        links: [await fullRules("simpleDCs"), await fullRules("dcAdjustments")],
      },
    },
    { id: "degrees", icon: "fa-solid fa-dice-d20", template: "degrees", data: {} },
    {
      id: "conditions",
      icon: "fa-solid fa-heart-crack",
      wide: true,
      template: "conditions",
      data: { conditions: await prepareConditions(), link: await fullRules("conditions") },
    },
    {
      id: "actions",
      icon: "fa-solid fa-person-running",
      wide: true,
      template: "actions",
      data: { groups: await prepareActions(), link: await fullRules("basicActions") },
    },
    {
      id: "dying",
      icon: "fa-solid fa-skull",
      template: "dying",
      data: { links: [await fullRules("dying"), await fullRules("heroPoints")] },
    },
    {
      id: "environment",
      icon: "fa-solid fa-mountain-sun",
      template: "environment",
      data: {
        links: [await fullRules("terrainCover"), await fullRules("light"), await fullRules("falling")],
      },
    },
    {
      id: "recall-knowledge",
      icon: "fa-solid fa-brain",
      template: "recall-knowledge",
      data: {
        traits: recallKnowledge.map(({ trait, skills }) => ({
          trait: localizeConfig("creatureTraits", trait),
          skills: skills.map((s) => localizeConfig("skills", s)).join(", "),
        })),
        link: await fullRules("creatureIdentification"),
      },
    },
    {
      id: "journal",
      icon: "fa-solid fa-book",
      template: "journal",
      data: { pages: await prepareJournalPages() },
    },
    {
      id: "notes",
      icon: "fa-solid fa-feather",
      template: "notes",
      data: { notes: getSetting(SETTINGS.notes) },
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

async function prepareConditions() {
  const index = await getIndex("pf2e.conditionitems", ["system.description.value", "system.value.isValued"]);
  if (!index) return null;
  const sorted = [...index].sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
  return Promise.all(
    sorted.map(async (entry) => ({
      name: entry.name,
      link: await enrich(uuidLink(entry.uuid, entry.name)),
      valued: !!entry.system?.value?.isValued,
      summary: summarize(entry.system?.description?.value),
    })),
  );
}

async function prepareActions() {
  const index = await getIndex("pf2e.actionspf2e", [
    "folder",
    "system.actionType.value",
    "system.actions.value",
    "system.traits.value",
  ]);
  if (!index) return null;

  const groups = Object.fromEntries(ACTION_GROUPS.map((g) => [g, []]));
  for (const entry of index) {
    const traits = entry.system?.traits?.value ?? [];
    const group = traits.includes("exploration")
      ? "exploration"
      : traits.includes("downtime")
        ? "downtime"
        : entry.folder === ACTION_FOLDERS.basic
          ? "basic"
          : entry.folder === ACTION_FOLDERS.skill
            ? "skill"
            : null;
    if (group) groups[group].push(entry);
  }

  return Promise.all(
    ACTION_GROUPS.map(async (group) => ({
      label: game.i18n.localize(`${I18N}.Rules.ActionGroups.${group}`),
      actions: await Promise.all(
        groups[group]
          .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang))
          .map(async (entry) => ({
            name: entry.name,
            glyph: actionGlyph(entry.system?.actionType?.value, entry.system?.actions?.value),
            link: await enrich(uuidLink(entry.uuid, entry.name)),
          })),
      ),
    })),
  );
}

async function prepareJournalPages() {
  const journal = await fromUuid(GM_SCREEN_JOURNAL).catch(() => null);
  if (!journal) return null;
  return Promise.all(
    journal.pages.contents
      .sort((a, b) => a.sort - b.sort)
      .map(async (page) => ({ name: page.name, link: await enrich(uuidLink(page.uuid, page.name)) })),
  );
}

/** The character the pf2e "Pathfinder2eActions" font renders as an action-cost glyph. */
function actionGlyph(type, count) {
  if (type === "reaction") return "R";
  if (type === "free") return "F";
  if (type === "action") return String(count ?? 1);
  return "";
}

/** Localized label from `CONFIG.PF2E[group][key]`, falling back to the capitalized key. */
function localizeConfig(group, key) {
  const label = CONFIG.PF2E?.[group]?.[key];
  const resolved = typeof label === "string" ? label : label?.label;
  return resolved ? game.i18n.localize(resolved) : key.charAt(0).toUpperCase() + key.slice(1);
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}
