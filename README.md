# Wayfarer's Toolkit

Three GM tools, plus an optional three-coin economy, for [Foundry VTT](https://foundryvtt.com) and the dnd5e system: overland hex travel, flight routes, and a session-start helper. Your campaign content (encounter tables, routes, recaps) stays in your world; the module supplies the logic.

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

The tracker journal's **Flight Routes** page holds two tables: flight points (name, scene to open on arrival, unlocked yes/no) and routes (from, to, fare per passenger, hours). Write fares with coins, like `2s`, `1g 20s` or `75c`; a plain number such as `2` is read in the *Fare unit* setting (gold by default). Edit the tables directly; Flight Master reads the page each time.

**Players and Flight Master.** With *Players can use Flight Master* on (the default), players get a feather button in the token controls and, after setup, the Flight Master macro on their hotbar. A player picks a route and confirms; the GM's client checks the route, takes the fare from the party purse, advances time, logs the trip and opens the destination scene. A GM must be logged in. Players see a copy of the flight points and routes, never the GM journal itself.

**Flight sound.** A "Be Good" clip (`sounds/be-good.ogg`, recorded by a friend of the author) plays for everyone when a flight departs. Pick a different file in the *Flight sound* setting, or clear it for silence.

## Three-coin economy (copper, silver, gold)

An optional World of Warcraft–style economy: no electrum or platinum, and **100 copper = 1 silver, 100 silver = 1 gold**. Character, NPC and party sheets show only gold, silver and copper (abbreviated g, s, c), dnd5e's currency **Convert** button changes coins at the new rates, and Flight Master charges and gives change in the new coins.

### Setup

1. **Clear out platinum and electrum first.** Those coins stop counting once you switch. Open any sheet that holds pp or ep and convert or remove them while you're still on Standard. (If any are left after switching, the module whispers the GM a list of who still has them.)
2. Open **Game Settings → Configure Settings → Wayfarer's Toolkit** and set **Coin system** to *Three coins: copper, silver, gold (100 to 1)*. Save; Foundry reloads.
3. Set **Fare unit** to the coin your Flight Routes table uses for plain numbers. For WoW-like prices that's usually *Silver*. Or write each fare with its coin (`2s`, `1g 20s`) and the setting doesn't matter.
4. Check a sheet: the currency block should show only g, s and c.

To switch back, set **Coin system** to *Standard 5e*. Coin amounts stay as they are; they're just read at 5e rates again.

### What it doesn't change

**Item prices.** Nothing on your items is rewritten. dnd5e keeps each price's number and coin, so an item listed at *15 gp* now costs 15 **gold**, a hundred times more in silver than before. Many tables using this economy read a 5e price in gp as the same number of **silver** (a 15 gp longsword costs 15s). If you want that, reprice your items separately; this setting won't do it for you.

**Treasure and rewards** you award by hand: give coin in the new denominations.

## Macros and scripting

Every tool is available as `game.modules.get("wayfarers-toolkit").api.<tool>()`: `hexTravel`, `flight`, `sessionStart`, `setup`. Money helpers: `parseMoney("1g 20s")` returns an amount in the smallest coin, `fmtMoney(amount)` formats one, and `totalMoney(actor)` / `pay(actor, amount)` read and spend an actor's purse.

## License

MIT
