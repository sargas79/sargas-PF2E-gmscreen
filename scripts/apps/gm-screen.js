import { I18N, MODULE_ID } from "../constants.js";
import { SETTINGS, getSetting, setSetting } from "../settings.js";
import { TABS } from "../tabs/index.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

const TEMPLATES = `modules/${MODULE_ID}/templates`;

/**
 * @typedef CardData
 * @property {string} id      Unique within its tab
 * @property {string} title
 * @property {string} icon    Font Awesome classes
 * @property {string} body    Pre-rendered HTML
 */

/**
 * The GM screen window: a tab per module in `tabs/`, each a grid of collapsible, pinnable cards.
 *
 * Never reach for the global `document`/`window` in here: the screen can be detached
 * into its own browser window, so always go through `this.element`.
 */
export class GMScreen extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    const saved = getSetting(SETTINGS.windowState) ?? {};
    super(foundry.utils.mergeObject({ position: saved }, options));
    const tab = getSetting(SETTINGS.activeTab);
    this.tabGroups.primary = TABS.some((t) => t.id === tab) ? tab : TABS[0].id;
  }

  static DEFAULT_OPTIONS = {
    id: MODULE_ID,
    classes: [MODULE_ID],
    window: {
      title: `${I18N}.Title`,
      icon: "fa-solid fa-book-open",
      resizable: true,
    },
    position: {
      width: 960,
      height: 680,
    },
    actions: {
      togglePin: GMScreen.#onTogglePin,
      toggleCollapse: GMScreen.#onToggleCollapse,
      ...Object.assign({}, ...TABS.map((t) => t.actions)),
    },
  };

  static PARTS = {
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    toolbar: { template: `${TEMPLATES}/toolbar.hbs` },
    ...Object.fromEntries(TABS.map((t) => [t.id, { template: `${TEMPLATES}/tab.hbs`, scrollable: [""] }])),
  };

  static TABS = {
    primary: {
      tabs: TABS.map((t) => ({ id: t.id, icon: t.icon, label: `${I18N}.Tabs.${t.id}` })),
      initial: TABS[0].id,
    },
  };

  /** Current search text; kept across re-renders but not saved. */
  #query = "";

  #saveWindowState = foundry.utils.debounce((state) => setSetting(SETTINGS.windowState, state), 500);

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const pinned = new Set(getSetting(SETTINGS.pinnedCards));
    const collapsed = new Set(getSetting(SETTINGS.collapsedCards));

    const cardsByTab = {};
    await Promise.all(
      TABS.map(async (tab) => {
        const cards = await tab.prepareCards(this);
        cardsByTab[tab.id] = await Promise.all(
          cards.map(async (card) => {
            const key = `${tab.id}.${card.id}`;
            const data = { ...card, key, pinned: pinned.has(key), collapsed: collapsed.has(key) };
            data.html = await renderTemplate(`${TEMPLATES}/card.hbs`, data);
            return data;
          }),
        );
      }),
    );

    return Object.assign(context, {
      tabs: this._prepareTabs("primary"),
      cardsByTab,
      pinnedCards: Object.values(cardsByTab)
        .flat()
        .filter((c) => c.pinned),
      query: this.#query,
    });
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId in context.cardsByTab) {
      context.tab = context.tabs[partId];
      context.cards = context.cardsByTab[partId];
    }
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const search = this.element.querySelector("input[name=search]");
    search?.addEventListener("input", (event) => {
      this.#query = event.currentTarget.value;
      this.#applySearch();
    });
    this.#applySearch();
    for (const tab of TABS) tab.onRender?.(this, this.element);
  }

  changeTab(tab, group, options) {
    super.changeTab(tab, group, options);
    if (group === "primary") setSetting(SETTINGS.activeTab, tab);
  }

  setPosition(position) {
    const result = super.setPosition(position);
    if (result) {
      const { left, top, width, height } = result;
      this.#saveWindowState({ left, top, width, height });
    }
    return result;
  }

  /**
   * Show cards whose title matches. Otherwise show a card if any of its `[data-search]` items
   * match, hiding the items that don't.
   */
  #applySearch() {
    const query = this.#query.trim().toLocaleLowerCase();
    for (const card of this.element.querySelectorAll(".gms-card")) {
      const title = card.querySelector(".gms-card-title")?.textContent.toLocaleLowerCase() ?? "";
      const items = card.querySelectorAll("[data-search]");
      const titleMatch = !query || title.includes(query);
      let anyItem = false;
      for (const item of items) {
        const match = titleMatch || item.dataset.search.toLocaleLowerCase().includes(query);
        item.hidden = !match;
        anyItem ||= match;
      }
      card.hidden = !(titleMatch || anyItem);
    }
  }

  static async #onTogglePin(event, target) {
    await GMScreen.#toggleInSetting(SETTINGS.pinnedCards, target.dataset.cardKey);
    this.render();
  }

  static async #onToggleCollapse(event, target) {
    await GMScreen.#toggleInSetting(SETTINGS.collapsedCards, target.dataset.cardKey);
    this.render();
  }

  static async #toggleInSetting(setting, key) {
    const keys = new Set(getSetting(setting));
    if (keys.has(key)) keys.delete(key);
    else keys.add(key);
    await setSetting(setting, [...keys]);
  }
}
