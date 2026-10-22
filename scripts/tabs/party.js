import { I18N, MODULE_ID } from "../constants.js";
import { SETTINGS, getSetting, setSetting } from "../settings.js";
import {
  adjustHitPoints,
  applyItem,
  decreaseCondition,
  getCandidateMembers,
  getCheckStatistic,
  getPartyActor,
  getPartyLevel,
  getPartyMembers,
  getSecretCheckOptions,
  isPartyMember,
  summarizeCharacter,
} from "../util/pf2e.js";

export const id = "party";
export const icon = "fa-solid fa-users";

const TEMPLATES = `modules/${MODULE_ID}/templates/party`;
const { renderTemplate } = foundry.applications.handlebars;

/** Parts to refresh when party data changes: the treasure budget depends on party level and size. */
const REFRESH_PARTS = ["party", "treasure", "toolbar"];

let hooksRegistered = false;

export const actions = {
  openSheet: (event, target) => actorFrom(target)?.sheet.render(true),
  pingToken: onPingToken,
  adjustHp: (event, target) => {
    const actor = actorFrom(target);
    const step = event.shiftKey ? 10 : 1;
    if (actor) adjustHitPoints(actor, Number(target.dataset.direction) * step);
  },
  decreaseCondition: (event, target) => {
    const actor = actorFrom(target);
    if (actor) decreaseCondition(actor, target.dataset.conditionId, { remove: event.shiftKey });
  },
  secretCheck: onSecretCheck,
  toggleMember: onToggleMember,
};

/** @returns {Promise<import("../apps/gm-screen.js").CardData[]>} */
export async function prepareCards() {
  const t = (key) => game.i18n.localize(`${I18N}.Party.${key}`);
  const members = getPartyMembers();
  const rows = members.map(summarizeCharacter);
  const override = new Set(getSetting(SETTINGS.partyOverride) ?? []);

  const cards = [
    {
      id: "roster",
      icon: "fa-solid fa-users",
      wide: true,
      template: "roster",
      data: { rows },
    },
    {
      id: "summary",
      icon: "fa-solid fa-chart-simple",
      template: "summary",
      data: { stats: summarizeParty(rows), level: getPartyLevel(members), size: members.length },
    },
    {
      id: "secret-checks",
      icon: "fa-solid fa-eye-slash",
      template: "secret-checks",
      data: { options: getSecretCheckOptions(), disabled: !members.length },
    },
    {
      id: "members",
      icon: "fa-solid fa-user-check",
      template: "members",
      data: {
        source: override.size ? "override" : getPartyActor() ? "partyActor" : "playerOwned",
        candidates: getCandidateMembers().map((a) => ({
          id: a.id,
          name: a.name,
          checked: override.has(a.id),
        })),
      },
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
  registerHooks(app);

  for (const row of element.querySelectorAll("[data-drop-actor-id]")) {
    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      row.classList.add("gms-drop-target");
    });
    row.addEventListener("dragleave", () => row.classList.remove("gms-drop-target"));
    row.addEventListener("drop", async (event) => {
      event.preventDefault();
      row.classList.remove("gms-drop-target");
      const actor = game.actors.get(row.dataset.dropActorId);
      const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
      if (!actor || data?.type !== "Item" || !data.uuid) return;
      const item = await fromUuid(data.uuid);
      if (item) await applyItem(actor, item);
    });
  }
}

/** Re-render the party-dependent parts when a member, their items, or the Party actor change. */
function registerHooks(app) {
  if (hooksRegistered) return;
  hooksRegistered = true;

  const refresh = foundry.utils.debounce(() => {
    if (app.rendered) app.render({ parts: REFRESH_PARTS });
  }, 150);
  const onActor = (actor) => {
    if (isPartyMember(actor) || actor?.id === getPartyActor()?.id) refresh();
  };
  const onItem = (item) => onActor(item.parent);

  Hooks.on("updateActor", onActor);
  Hooks.on("createItem", onItem);
  Hooks.on("updateItem", onItem);
  Hooks.on("deleteItem", onItem);
}

/** Lowest defenses, so the GM can see who's easiest to target. */
function summarizeParty(rows) {
  const lowest = (pick) => {
    const candidates = rows.filter((r) => pick(r) != null);
    if (!candidates.length) return null;
    const row = candidates.reduce((min, r) => (pick(r) < pick(min) ? r : min));
    return { value: pick(row), name: row.name };
  };
  const label = (key) => `${I18N}.Party.Stats.${key}`;
  return [
    { label: label("ac"), ...lowest((r) => r.ac) },
    { label: label("fortitude"), ...lowest((r) => r.saves.fortitude), signed: true },
    { label: label("reflex"), ...lowest((r) => r.saves.reflex), signed: true },
    { label: label("will"), ...lowest((r) => r.saves.will), signed: true },
    { label: label("perception"), ...lowest((r) => r.perception.mod), signed: true },
  ].filter((s) => s.name);
}

function actorFrom(target) {
  return game.actors.get(target.closest("[data-actor-id]")?.dataset.actorId);
}

function onPingToken(event, target) {
  const actor = actorFrom(target);
  const token = actor?.getActiveTokens(true, false)[0];
  if (!token) {
    ui.notifications.info(game.i18n.format(`${I18N}.Party.NoToken`, { name: actor?.name ?? "" }));
    return;
  }
  canvas.animatePan({ x: token.center.x, y: token.center.y });
  canvas.ping(token.center);
}

async function onSecretCheck(event, target) {
  const slug = this.element.querySelector("select[name=secretCheck]")?.value;
  if (!slug) return;
  for (const actor of getPartyMembers()) {
    const statistic = getCheckStatistic(actor, slug);
    await statistic?.roll({ rollMode: "blindroll", skipDialog: true });
  }
}

async function onToggleMember(event, target) {
  const ids = new Set(getSetting(SETTINGS.partyOverride) ?? []);
  const actorId = target.dataset.memberId;
  if (ids.has(actorId)) ids.delete(actorId);
  else ids.add(actorId);
  await setSetting(SETTINGS.partyOverride, [...ids]);
  this.render({ parts: REFRESH_PARTS });
}
