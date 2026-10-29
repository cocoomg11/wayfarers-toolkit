# Wayfarer's Toolkit

GM tools for travel and loot, a WoW-style character pane, and an optional three-coin economy, for [Foundry VTT](https://foundryvtt.com) and the dnd5e system: overland hex travel, flight routes, and a session-start helper. Your campaign content (encounter tables, routes, recaps) stays in your world; the module supplies the logic.

| Tool | What it does |
| --- | --- |
| **Hex Travel** | Enter road and off-road hexes and a pace. Roads are safe; each off-road hex rolls for an encounter on the zone's roll table. Tick *Mounted* to travel faster. Advances world time, logs the trip, whispers encounters to the GM. |
| **Flight Master** | Flies the party between unlocked flight points on the cheapest route. Fares come out of a party group actor's purse (with change). Points, routes and fares are an editable table in a journal page. Players can book flights too (button in the token controls), and an optional sound plays for everyone on departure. |
| **Session Start** | Pick a scene, edit a "Previously…" recap, post it to chat, activate the scene and unpause. |
| **Vendor Trash** | Select defeated creatures and roll WoW-style grey loot: beasts drop body parts, humanoids drop worn gear, trinkets and a little coin, undead drop bones. With Item Piles, the bodies become lootable piles; without it, one click gives the loot to the party. **Sell Vendor Trash** cashes it all in. |
| **Trained Rider** | A riding feat that setup adds to your world. When every party member has it, Hex Travel travels mounted by default. |
| **Character pane** | A World of Warcraft–style character frame: the portrait and stats in the middle, gear slots around it. Slotting an item equips it on the dnd5e sheet; taking it out unequips it. Players can use it for their own characters. |

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
2. Run the **Vendor Trash** macro. Each creature's drop is rolled; every item is priced at its vendor value and marked as vendor trash.
3. The loot goes either onto the bodies or to the party (see below).
4. At a vendor, run **Sell Vendor Trash**. Pick whose trash to sell (the party actor or a character holding some; a selected token's actor is picked by default) and confirm. The coin goes to the same actor.

Each token is only looted once. Characters and group actors are never looted.

### With Item Piles: loot the bodies

When the [Item Piles](https://foundryvtt.com/packages/item-piles) module is active (and *Vendor Trash uses Item Piles* is on, the default), Vendor Trash puts each creature's drop and coin on that creature and turns its token into an Item Pile. The token keeps its image and name. Players double-click the body (standing next to it) to open it and take the items and coin, which go onto their own character. The GM gets a short summary card. A creature that dropped nothing is left as it is.

- **Only the loot shows.** The creature's own weapons, armor and features stay on it but are hidden from the pile, so players see just the trash and coin.
- **The world actor isn't touched** for ordinary unlinked tokens: the loot goes onto the token's own copy of the actor. (If an NPC's token is linked to its actor, the loot goes onto that actor.)
- **Empty bodies** stay on the map unless you turn on Item Piles' *Delete empty piles* setting. To make a body a normal token again, run `game.itempiles.API.revertTokensFromItemPiles(token)` (or turn the pile off in its Item Piles configuration).

#### Setting up Item Piles

1. Install and enable **Item Piles** and its system add-on: for dnd5e that's **Item Piles: D&D 5e** (`itempilesdnd5e`). Item Piles 3 has no system settings of its own; without the add-on it doesn't know item quantities or coins, and Vendor Trash falls back to the Give to Party card with a warning.
2. Reload. Item Piles applies the dnd5e settings the first time it sees the add-on.
3. **Three-coin economy:** the dnd5e add-on sets up five coins at 10 to 1. With *Coin system* on *Three coins* and *Set Item Piles coins for three coins* on (the default), this module replaces them each time the world loads with gold (primary), silver (×0.01) and copper (×0.0001), and whispers the GM when it changes them. To do it by hand instead, turn that setting off and in **Item Piles → Module Settings → System → Currencies** keep three attribute currencies: `system.currency.gp` (exchange rate 1, primary), `system.currency.sp` (0.01) and `system.currency.cp` (0.0001), and delete platinum and electrum.

### Without Item Piles: Give to Party

The GM gets a loot card listing each creature's drop and its vendor value. Click **Give to Party** on the card: items go into the party actor's inventory and coin into its purse. This is also what happens when *Vendor Trash uses Item Piles* is off.

### What drops

What drops depends on the creature:

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

## Character pane

A paper doll in the style of World of Warcraft's character screen. The character's portrait sits in the middle with their stats underneath (the six ability scores, Armor, Health and attuned items), and the gear slots run around it.

**Open it** with the shirt button in the header of a dnd5e character (or NPC) sheet, also in the sheet's **⋮** controls menu, or from a macro with `game.modules.get("wayfarers-toolkit").api.characterPane(actor)` (no actor: the selected token's, else your own character). Anyone who owns the actor can open it, so players can dress their own characters. Turn it off with the **Character pane** setting.

### Slots

WoW Classic's layout, without the Ammo slot:

| Left | Right | Bottom |
| --- | --- | --- |
| Head, Neck, Shoulder, Back, Chest, Shirt, Tabard, Wrist | Hands, Waist, Legs, Feet, Finger ×2, Trinket ×2 | Main Hand, Off Hand, Ranged |

Empty slots show a faint placeholder. Item icons get a border in their quality colour (grey, white, green, blue, purple, orange): an item with a WoW tooltip uses its own colour; otherwise dnd5e rarity decides (common white, uncommon green, rare blue, very rare purple, legendary orange, artifact gold). Hover an item for its tooltip.

### Equipping

- **Drag** an item from the character sheet's inventory, from the pane's *Equippable items* list, from a compendium, the Items sidebar or another actor onto a slot. Items from elsewhere are copied onto the character first, the same way dropping them on the sheet would.
- **Click a slot** to pick from the character's items that fit it, or to take off what's there.
- **Click an item** in the list to put it in its slot (the first free one it fits, else replacing what's there). If it could go anywhere, the pane asks where.
- **Take an item off** by right-clicking its slot, dragging it back to the list, or choosing *Take off*.
- Dragging between the two finger (or trinket) slots swaps them.

Slotting an item marks it **equipped** on the dnd5e sheet; taking it off unequips it. Unequipping an item on the sheet takes it out of its slot too. The slot is stored on the item (`flags.wayfarers-toolkit.slot`). Items that are equipped but not in a slot are marked with an *E* in the list, and **Slot equipped items** puts them into free slots.

### What fits where

| Item | Slots |
| --- | --- |
| Melee weapon | Main Hand or Off Hand. Thrown weapons can also go in Ranged. |
| Two-handed weapon | Main Hand only. It fills the Off Hand (shown greyed out) and takes off whatever was there. |
| Ranged weapon | Ranged |
| Shield | Off Hand |
| Light, medium, heavy or natural armour | Chest |
| Clothing | Chest, Shirt or Tabard (or the slot its name suggests: "boots", "gloves"…) |
| Ring | Finger |
| Wand, rod | Ranged or Off Hand |
| Trinket | Trinket, or any other gear slot |
| Wondrous and other equipment | Any gear slot (not the weapon slots). Its name suggests a default: a cloak goes on the Back, boots on the Feet, an amulet on the Neck; with no hint, the pane asks. |

One item per slot. The pane warns, but doesn't stop you, when an item needs attunement and the character is already attuned to the maximum (3), when a second suit of armour goes on, or when a second shield does.

### WoW Classic Items bonus

Items whose description holds a WoW-style tooltip, like those in the **WoW Classic Items** compendium, are placed by the tooltip's slot line: Head, Neck, Shoulder, Back, Chest, Shirt, Tabard, Wrist, Hands, Waist, Legs, Feet, Finger, Trinket, Main Hand, One-Hand (either hand), Two-Hand, Off Hand / Held In Off-hand, and Ranged / Thrown / Relic in the Ranged slot. Their border uses the tooltip's quality colour, and hovering shows the WoW tooltip. When a description has no slot line, the compendium folder the item came from decides (Head, Two-Hand, Finger, Wands…). Nothing from WoW is bundled; icons come from the items.

**Armour pieces and AC.** WoW helms, shoulders, gloves, boots and the like are often typed as light, medium or heavy armour with no AC of their own, and dnd5e only counts one piece of armour for AC. So that a helm doesn't replace the chest armour, armour-typed items worn in a slot other than **Chest** are left out of dnd5e's AC calculation while the character pane is on. Armour in the Chest slot, and equipped armour that isn't in any slot, counts as usual.

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

Every tool is available as `game.modules.get("wayfarers-toolkit").api.<tool>()`: `hexTravel`, `flight`, `sessionStart`, `vendorTrash`, `sellTrash`, `characterPane`, `setup`. `characterPane(actor)` opens the pane for an actor (or the selected token's, or your character); `api.pane.slotItem(actor, item, slot)` and `api.pane.unslotItem(item)` slot and unslot from a macro (slots: `head`, `neck`, `shoulder`, `back`, `chest`, `shirt`, `tabard`, `wrist`, `hands`, `waist`, `legs`, `feet`, `finger1`, `finger2`, `trinket1`, `trinket2`, `mainhand`, `offhand`, `ranged`). `vendorTrash(tokens)` takes an optional list of tokens instead of the selection, and `sellTrash(actor)` sells one actor's trash without asking. Money helpers: `parseMoney("1g 20s")` returns an amount in the smallest coin, `fmtMoney(amount)` formats one, and `totalMoney(actor)` / `pay(actor, amount)` read and spend an actor's purse.

## License

MIT
