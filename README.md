# Wayfarer's Toolkit

Three GM tools for [Foundry VTT](https://foundryvtt.com) and the dnd5e system: overland hex travel, flight routes, and a session-start helper. Your campaign content (encounter tables, routes, recaps) stays in your world; the module supplies the logic.

| Tool | What it does |
| --- | --- |
| **Hex Travel** | Enter road and off-road hexes and a pace. Roads are safe; each off-road hex rolls for an encounter on the zone's roll table. Tick *Mounted* to travel faster. Advances world time, logs the trip, whispers encounters to the GM. |
| **Flight Master** | Flies the party between unlocked flight points on the cheapest route. Fares come out of a party group actor's purse (with change). Points, routes and fares are an editable table in a journal page. |
| **Session Start** | Pick a scene, edit a "Previously…" recap, post it to chat, activate the scene and unpause. |

## Install

In Foundry's setup screen, go to **Add-on Modules → Install Module** and paste this manifest URL:

```
https://github.com/cocoomg11/wayfarers-toolkit/releases/latest/download/module.json
```

Enable the module in your world, then open **Game Settings → Configure Settings → Wayfarer's Toolkit → Run setup**. Setup creates anything missing (tracker journal, party actor, macros on empty hotbar slots) and never overwrites existing documents.

## Configure

All settings are per world:

- **Campaign name**: used in the session recap heading.
- **Tracker journal / Party actor**: document names the tools look for.
- **Encounter zones**: JSON mapping a zone name to an encounter roll table, e.g. `{"Forest": "Encounters · Forest"}`.
- **Encounter die, off-road multiplier, mounted multiplier, pace speeds**.
- **Scenes hidden from Session Start**: a regular expression.

### Flight routes

The tracker journal's **Flight Routes** page holds two tables: flight points (name, scene to open on arrival, unlocked yes/no) and routes (from, to, fare in gp per passenger, hours). Edit them directly; Flight Master reads the page each time.

## Macros and scripting

Every tool is available as `game.modules.get("wayfarers-toolkit").api.<tool>()`: `hexTravel`, `flight`, `sessionStart`, `setup`.

## License

MIT
