# Sargas PF2e GM Screen

An interactive GM screen for **Pathfinder 2e Remaster** in **Foundry VTT v14**. It has three tabs:

- **Rules:** the DCs, conditions, actions and rules you look up mid-session.
- **Party:** every PC's HP, defenses and conditions, updated live.
- **Treasure:** the per-level treasure budget, a loot roller and a coin splitter.

It's built to sit on a second monitor: use Foundry v14's pop-out to detach the window into its own browser window.

## Requirements

- Foundry VTT v14 (14.361 or later)
- The PF2e game system, 8.x

## Install

In Foundry's **Add-on Modules → Install Module**, paste this manifest URL:

```
https://github.com/sargas79/sargas-PF2E-gmscreen/releases/latest/download/module.json
```

Then enable **Sargas PF2e GM Screen** in your PF2e world.

## Usage

As GM, open the screen with any of these:

- the **book** button in the Token controls
- **Shift+G** (rebind it under *Configure Controls*)
- a macro: `game.modules.get("sargas-pf2e-gmscreen").api.toggle()` (`open()` and `close()` also exist)

Players don't see the button and can't use the keybinding.

### Rules tab

- **DCs by level** (your party's level is highlighted), simple DCs, difficulty and rarity adjustments, and degrees of success.
- **Conditions** and **actions** (basic, skill, exploration and downtime) come straight from the PF2e compendiums. Click one to read it. Drag a condition onto a token, a character sheet or a Party row to apply it.
- Quick cards for dying and hero points, cover/terrain/light/falling, and Recall Knowledge. Each links to the full page in the PF2e system's own *GM Screen* journal, and a card lists every page of that journal.
- **GM notes** for house rules, saved with the world.

### Party tab

- One row per PC showing HP (with − / + buttons; hold Shift for ±10), AC, Fortitude/Reflex/Will, Perception and its DC, class and spell DC, hero points, conditions, speeds and senses. Rows update live as sheets change.
- Click a condition to lower it by one; Shift-click removes it. Drop a condition or effect on a row to apply it.
- Buttons on each row open the character sheet, or pan to the PC's token and ping it.
- **Party at a Glance** shows the party's lowest AC, saves and Perception, and who has them.
- **Secret Checks** rolls Perception or any skill for every PC as a blind GM roll.
- **Who's Shown** lists characters by default from the Party actor, otherwise every player-owned character. Tick characters to choose them yourself.

### Treasure tab

- **Party Treasure by Level** (GM Core), with your party's level highlighted.
- **Treasure Budget** tracks what you've handed out against the budget for a level, adjusted for party size. It's stored on the Party actor if there is one, otherwise in the world.
- **Loot Roller** draws random items from the PF2e equipment compendium by level range, category, rarity and traits. You can re-roll single items, post the list to chat (GM-only or public), or add everything to the Party stash, which also logs it in the budget.
- **Coin Splitter** shares coins evenly among the PCs, with any remainder going to the Party stash, or puts it all in the stash.

Every card can be **pinned** (it then also shows at the top of every tab) or **collapsed**. The search box filters cards and the lists inside them.

## Development

The module has no build step. To have Foundry load it straight from your working copy, link the repo into your Foundry `Data/modules` folder:

```powershell
./tools/link-dev.ps1                                  # default: %LOCALAPPDATA%\FoundryVTT\Data
./tools/link-dev.ps1 -DataPath "E:\FoundryData\Data"  # custom Data folder
```

Press F5 in Foundry to reload after making changes. See [docs/PLAN.md](docs/PLAN.md) for the architecture.

- All reads of pf2e actor data go through `scripts/util/pf2e.js`.
- Each tab is a module in `scripts/tabs/`.
- Card bodies are Handlebars templates in `templates/`.

### Releasing

Publish a GitHub release with a tag such as `v0.2.0`. The release workflow then sets the version in `module.json` from the tag and attaches `module.json` and `module.zip` to the release. The manifest URL above always points to the latest release.

## License

The code is under the [MIT License](LICENSE).

This module uses trademarks and/or copyrights owned by Paizo Inc., used under Paizo's Community Use Policy ([paizo.com/licenses/communityuse](https://paizo.com/licenses/communityuse)). We are expressly prohibited from charging you to use or access this content. This module is not published, endorsed, or specifically approved by Paizo. For more information about Paizo Inc. and Paizo products, visit [paizo.com](https://paizo.com).

The rules tables in `data/` and the rules summaries in `lang/` are based on the *Pathfinder Player Core* and *GM Core* (Paizo Inc.), licensed under the [ORC License](https://paizo.com/orclicense). The full rules text comes from the PF2e system's compendiums, linked rather than copied.
