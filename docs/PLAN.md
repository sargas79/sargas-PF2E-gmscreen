# Sargas PF2e GM Screen — Module Plan

A Foundry VTT module that gives the GM of a **Pathfinder 2e Remaster** game a tabbed, pop-out screen with:

1. **Rules reference**: the tables and rulings you look up mid-session.
2. **Party overview**: every PC's defenses, HP and conditions at a glance, updated live.
3. **Treasure & loot**: the per-level treasure budget, plus a loot roller that draws from the PF2e system's compendiums.

The encounter builder is out of scope for v1 (see [Later](#later)).

---

## Targets and assumptions

| Item | Target |
|---|---|
| Foundry VTT | **v14 only.** `module.json`: `compatibility.minimum: "14.361"`, `maximum: "14"`, and `verified` set to the latest 14.x build tested. There's no v13 support, because the v14 PF2e system can't run on v13 anyway. |
| Game system | `pf2e` **8.x**, the line built for v14. (8.6.1 requires Foundry 14.361 or later and is verified on 14.369.) Declared in `relationships.systems` with a minimum version. |
| Rules source | Player Core, GM Core and Monster Core (Remaster). **No legacy terms**: the screen says *off-guard*, not *flat-footed*, and has no alignment. |
| Who sees it | GM only. Players never get the button or the keybinding. |
| Build | No bundler: plain ES modules, Handlebars templates and one CSS file. A build step can be added later if needed. |

**Rules text and licensing.** The Remaster rules are published under the ORC license, and the `pf2e` system already ships their full text in its compendiums. So the screen **links to compendium entries** (conditions, actions, equipment) instead of copying their text, and opens the system's own item sheet when you click one. Only short numeric tables (DCs, treasure budgets) are kept as data files in this module, with ORC attribution in `LICENSE`/`README`.

---

## User experience

- **Ways to open it:** a button in the token scene controls (GM only), a configurable keybinding (default `Shift+G`), and the macro API `game.modules.get("sargas-pf2e-gmscreen").api.toggle()`.
- **Window:** a resizable, movable `ApplicationV2` window. It remembers its size, position and active tab per client.
- **Second monitor:** Foundry v14 can detach an application into its own browser window. The screen must work fully when detached, which is the main way a GM will use it: open it, detach it, and drag it to a second monitor. Whether it was detached is remembered too.
- **Relation to the system's own GM screen:** PF2e 8.x ships a GM-screen *journal* (static rules pages). This module is the interactive layer on top of it: live party data, a treasure tracker and a loot roller. The Rules tab links to the journal's pages wherever they cover a topic, rather than repeating them. The exact overlap gets audited at the start of M2.
- **Tabs:** `Rules` · `Party` · `Treasure`. Each tab is a grid of **cards**, and the GM can collapse or pin cards. Pinned cards also appear on a compact "Pinned" strip at the top of every tab.
- **Search box:** filters the cards and the condition/action lists in the current tab.
- Every condition, action or item name is a link: **click** opens the compendium entry, **drag** drops it onto an actor or into chat.

---

## Feature specs

### 1. Rules reference (`Rules` tab)

| Card | Contents | Data source |
|---|---|---|
| DCs by level | Level 0–25 → DC | `data/dc-by-level.json` (GM Core) |
| Simple DCs & adjustments | Untrained/Trained/…/Legendary; incredibly easy … incredibly hard; rarity adjustments | `data/dc-adjustments.json` |
| Degrees of success | Beat the DC by 10 or more = crit; nat 20 / nat 1 shift the result one step | static template |
| Conditions | Remaster list with each condition's value and a one-line summary; click a name to open the full entry | `pf2e.conditionitems` compendium |
| Basic & specialty actions | Action-cost glyph + name, grouped (Basic, Skill, Exploration, Downtime) | `pf2e.actionspf2e` compendium, filtered by trait/category |
| Dying, wounded & recovery | Recovery check DC 10 + dying value; the wounded/doomed interactions; hero points | static template |
| Cover, light, terrain & falling | Lesser/standard/greater cover; dim light and darkness; difficult/greater difficult terrain; falling damage | static template |
| Recall Knowledge | DC by creature level, skill by creature trait | static + `dc-by-level.json` |
| GM notes | A free-text card for house rules, saved as a world setting | setting `notes` |

Compendium lookups are cached once per session, the first time the tab opens. If a compendium id is missing (for example after the system renames it), the card shows a warning and keeps the static text.

### 2. Party overview (`Party` tab)

**Who is shown:** members of the PF2e **Party actor** (`game.actors.party`). If there isn't one, the tab falls back to every `character` actor that has a player owner. The GM can override the list in settings.

One row per PC:

| Column | Source (verify against the current pf2e data model during implementation) |
|---|---|
| Portrait, name, class, level | `actor.img`, `actor.name`, `actor.class?.name`, `actor.level` |
| HP / max (+ temp HP), as a bar | `actor.system.attributes.hp` |
| AC | `actor.armorClass.value` |
| Fort / Ref / Will | `actor.saves.fortitude.mod` etc. |
| Perception, plus Perception DC | `actor.perception.mod` (DC = 10 + mod) |
| Class DC / spell DC | `actor.classDC?.dc.value`, highest spellcasting DC |
| Hero points | `actor.heroPoints` |
| Conditions | `actor.conditions.active`, shown as icons with their values |
| Speeds, senses | `actor.system.movement.speeds`, `actor.system.perception.senses` |

- **Live updates:** re-render just the affected row on the `updateActor`, `createItem`, `deleteItem` and `updateItem` hooks (conditions and effects are items).
- **Quick actions on each row:** open the sheet, ping the token (switching to the token's **scene level** first, a v14 feature), adjust HP ±, and drag a condition from the Rules tab onto the row to apply it.
- **Party summary row:** lowest Perception, lowest Will and similar (useful when choosing who gets targeted), and the party's average level.
- **Secret checks:** a button that makes a blind roll of every PC's Perception or a chosen skill, posted to chat as GM-only messages, using `actor.skills[slug].roll({ rollMode: "blindroll" })`.

### 3. Treasure & loot (`Treasure` tab)

- **Treasure by level card:** the GM Core *Party Treasure by Level* table (currency, permanent items, consumables, and the per-extra-PC column). Party level and size are filled in from the Party tab, and can be edited.
- **Budget tracker:** the GM logs what they've handed out at each level, and the card shows what's left of the budget. Saved per world as a setting, a flag on the Party actor if one exists.
- **Loot roller:**
  - Inputs: item level (or a range), category (permanent / consumable / currency), rarity, traits filter, and how many.
  - Pulls candidates from the `pf2e.equipment-srd` index (fetched with the `level`, `rarity`, `traits` and `price` fields).
  - Shows the results with prices. Buttons: **Re-roll one**, **Post to chat** (GM-only or public), **Add to Party stash**, which creates the items on the Party actor's inventory.
- **Coin splitter:** splits a sum of gp/sp/cp evenly among the party, or assigns it to the stash.

---

## Architecture

```
sargas-pf2e-gmscreen/
├─ module.json            # id, compatibility, relationships.systems: pf2e
├─ scripts/
│  ├─ main.js             # init/ready hooks, settings, keybinding, API
│  ├─ settings.js
│  ├─ apps/
│  │  └─ gm-screen.js     # ApplicationV2 + HandlebarsApplicationMixin; tabs, pins, search
│  ├─ tabs/
│  │  ├─ rules.js         # builds the context for the Rules cards, compendium caching
│  │  ├─ party.js         # party resolution, row data, hook subscriptions
│  │  └─ treasure.js      # budget, loot roller, coin splitter
│  └─ util/
│     ├─ compendium.js    # cached index lookups and safe fallbacks
│     └─ pf2e.js          # every read of pf2e actor fields lives here (one place to fix when the system changes)
├─ data/
│  ├─ dc-by-level.json
│  ├─ dc-adjustments.json
│  └─ treasure-by-level.json
├─ templates/
│  ├─ gm-screen.hbs
│  ├─ tabs/{rules,party,treasure}.hbs
│  └─ partials/card.hbs
├─ styles/gm-screen.css   # uses Foundry's CSS variables, so light and dark themes both work
└─ lang/en.json           # every UI string goes through game.i18n
```

**Design rules**
- `util/pf2e.js` is the **only** file that touches `actor.system.*`. PF2e changes its data model often, so this keeps those breakages in one place.
- The tab modules return plain context objects, and the templates render them. No DOM manipulation outside `_onRender`.
- Settings: `client` (window state, pinned cards, last tab), `world` (GM notes, party override, treasure log), with `config: false` for internal ones.
- **Detached-window safe:** never use the global `document`/`window` inside the app. Always go through `this.element` and `this.element.ownerDocument`/`defaultView`, for event listeners, `querySelector`, drag-and-drop and focus. Otherwise everything breaks once the screen is detached to a second monitor.
- **v14 API only:** ApplicationV2 and the `foundry.*` namespaces, with no deprecated v13 shims. Measured templates no longer exist in v14 and aren't needed here. Conditions stay pf2e *items*, even with v14's Active Effects V2, so that detail stays in `util/pf2e.js`.

---

## Milestones

| # | Deliverable | Done when |
|---|---|---|
| **M0** | Scaffold: `module.json`, an empty window, the GM-only button and keybinding, a dev symlink into Foundry's `Data/modules` | Opens in a PF2e 8.x world on v14 with no console errors |
| **M1** | The window shell: tabs, the card partial, collapse/pin, search, remembered window state | Pins and position survive a reload; everything works after detaching the window |
| **M2** | Rules tab: all the cards above, compendium links, drag to apply conditions | Every link opens the right Remaster entry |
| **M3** | Party tab: rows, live updates, quick actions, secret rolls | Changing HP or a condition on a sheet updates the row immediately |
| **M4** | Treasure tab: the table, budget tracker, loot roller, coin splitter | Loot drops into the Party stash with the correct levels |
| **M5** | Release: README, screenshots, a GitHub Actions workflow that zips the module and attaches `module.json` and `module.zip` to a GitHub Release, plus a manifest URL for installing | Installs in Foundry from the manifest URL |

Each milestone goes on its own branch with its own PR.

## Testing

- Manual test world: a PF2e world with a Party actor, 4 PCs at different levels, and conditions applied.
- A checklist in each PR description, covering both themes, the window docked and detached, and a v14 smoke test.
- Optional later: [Quench](https://github.com/Ethaks/FVTT-Quench) in-Foundry tests for `util/pf2e.js` and the treasure maths.

## Later

- An encounter builder (XP budget, creature level vs. party level, plus a link to the PF2e system's own encounter tools).
- Player-facing "lite" screen (conditions + actions only).
- More translations.

## Open questions

1. Which exact Foundry v14 build and PF2e 8.x version does your table run?
2. Where is your Foundry `Data` folder, for the dev symlink?
3. Module id: is `sargas-pf2e-gmscreen` OK?
