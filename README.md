# Sargas PF2e GM Screen

An interactive GM screen for **Pathfinder 2e Remaster** in **Foundry VTT v14**: a rules reference, a live party overview, and treasure & loot tools.

> Work in progress. See [docs/PLAN.md](docs/PLAN.md) for the plan and the [issues](https://github.com/sargas79/sargas-PF2E-gmscreen/issues) for the milestones.

## Requirements

- Foundry VTT v14 (14.361 or later)
- PF2e system 8.x

## Usage

As GM, open the screen with any of these:

- the **book** button in the Token controls
- the **Shift+G** keybinding (rebind it under *Configure Controls*)
- a macro: `game.modules.get("sargas-pf2e-gmscreen").api.toggle()`

Players don't see the button and can't use the keybinding.

## Development

The module has no build step. To have Foundry load it from your working copy, link the repo into your Foundry `Data/modules` folder:

```powershell
./tools/link-dev.ps1                                  # default: %LOCALAPPDATA%\FoundryVTT\Data
./tools/link-dev.ps1 -DataPath "E:\FoundryData\Data"  # custom Data folder
```

Then enable **Sargas PF2e GM Screen** in a PF2e world, and press F5 to reload after making changes.
