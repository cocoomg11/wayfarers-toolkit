# Wayfarer's Toolkit

Three GM tools for [Foundry VTT](https://foundryvtt.com) and the dnd5e system: overland hex travel, flight routes, and a session-start helper. Your campaign content (encounter tables, routes, recaps) stays in your world; the module supplies the logic.

| Tool | What it does |
| --- | --- |
| **Hex Travel** | Enter road and off-road hexes and a pace. Roads are safe; each off-road hex rolls for an encounter on the zone's roll table. Tick *Mounted* to travel faster. Advances world time, logs the trip, whispers encounters to the GM. |
| **Flight Master** | Flies the party between unlocked flight points on the cheapest route. Fares come out of a party group actor's purse (with change). Points, routes and fares are an editable table in a journal page. Players can book flights too (button in the token controls), and an optional sound plays for everyone on departure. |
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

**Players and Flight Master.** With *Players can use Flight Master* on (the default), players get a feather button in the token controls and, after setup, the Flight Master macro on their hotbar. A player picks a route and confirms; the GM's client checks the route, takes the fare from the party purse, advances time, logs the trip and opens the destination scene. A GM must be logged in. Players see a copy of the flight points and routes, never the GM journal itself.

**Flight sound.** A \"Be Good\" clip (`sounds/be-good.ogg`, recorded by a friend of the author) plays for everyone when a flight departs. Pick a different file in the *Flight sound* setting, or clear it for silence.

## Macros and scripting

Every tool is available as `game.modules.get("wayfarers-toolkit").api.<tool>()`: `hexTravel`, `flight`, `sessionStart`, `setup`.

## License

MIT
