# Wayfarer's Toolkit

GM tools for travel and loot, plus an optional three-coin economy, for [Foundry VTT](https://foundryvtt.com) and the dnd5e system: overland hex travel, flight routes, and a session-start helper. Your campaign content (encounter tables, routes, recaps) stays in your world; the module supplies the logic.

| Tool | What it does |
| --- | --- |
| **Hex Travel** | Enter road and off-road hexes and a pace. Roads are safe; each off-road hex rolls for an encounter on the zone's roll table. Tick *Mounted* to travel faster. Advances world time, logs the trip, whispers encounters to the GM. |
| **Flight Master** | Flies the party between unlocked flight points on the cheapest route. Fares come out of a party group actor's purse (with change). Points, routes and fares are an editable table in a journal page. Players can book flights too (button in the token controls), and an optional sound plays for everyone on departure. |
| **Session Start** | Pick a scene, edit a "Previously…" recap, post it to chat, activate the scene and unpause. |
| **Vendor Trash** | Select defeated creatures and roll WoW-style grey loot: beasts drop body parts, humanoids drop worn gear, trinkets and a little coin, undead drop bones. One click gives it to the party; **Sell Vendor Trash** cashes it all in. |
| **Trained Rider** | A riding feat that setup adds to your world. When every party member has it, Hex Travel travels mounted by default. |

## Install

In Foundry's setup screen, go to **Add-on Modules → Install Module** and paste this manifest URL:

```
https://github.com/cocoomg11/wayfarers-toolkit/releases/latest/download/module.json
```

Enable the module in your world, then open **Game Settings → Configure Settings → Wayfarer's Toolkit → Run setup**. Setup creates anything missing (tracker journal, party actor, the Trained Rider feat, macros on empty hotbar slots) and never overwrites existing documents.

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

## Vendor Trash

Grey "vendor trash" from defeated creatures, the way World of Warcraft drops it.

1. Select (or target) the defeated creatures' tokens.
2. Run the **Vendor Trash** macro. The GM gets a loot card listing each creature's drop and its vendor value.
3. Click **Give to Party** on the card. Items go into the party actor's inventory, priced at their vendor value; coin goes into its purse.
4. At a vendor, run **Sell Vendor Trash** to sell every trash item the party holds.

Each token is only looted once. What drops depends on the creature:

| Creature | Drops |
| --- | --- |
| Beast, monstrosity | A body part (70%), sometimes two. Parts sharing a word with the creature's name come first: a boar drops tusks, a spider drops webbing. No coin. |
| Humanoid, giant | Coin (75%), a trinket (50%), a piece of worn gear for its level (35%). |
| Undead | Bones and dust (60%), sometimes worn gear or coin. |
| Elemental, construct | Stones, ash, essences (60%). |
| Plant, fey | Roots, petals, spores (60%). |
| Dragon | Scales and claws. |

The creature type comes from the sheet; if it's blank, the name decides (a "Mangy Wolf" is a beast, a "Defias Bandit" a humanoid). A creature's level for gear and coin comes from its CR (CR 1 ≈ WoW level 4, CR 5 ≈ 17, CR 10 ≈ 34, CR 18 ≈ 60).

**Where the items come from.** The tool reads an item compendium; it ships no items. With the **WoW Classic Items** module installed, it uses that compendium's grey-quality items and their real WoW sell prices, which is what you want with the three-coin economy. To use other items, list compendium IDs in **Vendor trash compendiums**; in those, loot-type items with no rarity count as trash.

## Trained Rider and Long Road

**Run setup** adds a feat called *Trained Rider* to an Items folder named *Wayfarer's Toolkit* (players can see it, so they can drag it onto their sheets):

> **Swift Mount.** Mounting or dismounting a creature costs you only 5 feet of movement, rather than half your Speed.
> **Long Road.** When every member of your party has this feat and all of you are mounted, the party travels overland at mounted speed.

Hex Travel enforces Long Road: when the party actor has members, the *Mounted* box starts ticked only if every member has the feat, and the dialog names anyone who doesn't. The GM can still tick or untick it. Rename the feat in the **Riding feat name** setting if you call it something else.

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

Every tool is available as `game.modules.get("wayfarers-toolkit").api.<tool>()`: `hexTravel`, `flight`, `sessionStart`, `vendorTrash`, `sellTrash`, `setup`. Money helpers: `parseMoney("1g 20s")` returns an amount in the smallest coin, `fmtMoney(amount)` formats one, and `totalMoney(actor)` / `pay(actor, amount)` read and spend an actor's purse.

## License

MIT
