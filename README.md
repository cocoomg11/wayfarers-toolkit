# Wayfarer's Toolkit

A free toolkit of GM helpers for [Foundry VTT](https://foundryvtt.com) and the **dnd5e** system: overland hex travel, flight routes paid from a party purse, a session-start helper, grey vendor-trash loot, a riding feat, an MMO-style character pane, a narrative quest log, boss health frames, Need / Greed / Pass loot rolls, boss loot from roll tables, an optional custom token ring and an optional three-coin economy.

The module supplies only the logic. Your own campaign content (encounter tables, flight points, recaps, quests) stays in your world, and every tool can be switched on or off per world in the [control panel](#control-panel).

What changed in each version: [CHANGELOG](CHANGELOG.md).

## Features

| Tool | What it does |
| --- | --- |
| **Hex Travel** | Enter road and off-road hexes and a pace. Roads are safe; each off-road hex rolls for an encounter on the zone's roll table. Tick *Mounted* to travel faster. Advances world time, logs the trip, whispers encounters to the GM. |
| **Flight Master** | Flies the party between unlocked flight points on the cheapest route. Fares come out of a party group actor's purse (with change). Points, routes and fares are set up in a flight network editor inside the module; a point opens a scene only if you give it one. The GM can also fly the party for free. Players can book flights too (button in the token controls), and an optional sound plays for everyone on departure. |
| **Session Start** | Pick a scene, edit a "Previously…" recap, post it to chat, activate the scene and unpause. |
| **Vendor Trash** | Grey vendor-trash loot, pre-rolled on every NPC token when it's placed and lootable as soon as it dies: a wolf drops fur and fangs, a spider chitin, a bandit trinkets, worn gear and coin. Drops follow the creature's type and name, get better with CR, and follow extra rules you keep in a journal page. With Item Piles, bodies become lootable piles; without it, one click gives the loot to the party. Scenes marked as dungeons drop more. **Sell Vendor Trash** cashes it all in. |
| **Riding Training** | A riding feat that setup adds to your world. When every party member has it, Hex Travel travels mounted by default. |
| **Character pane** | A classic-MMO-style character frame: the portrait and stats in the middle, equipment slots around it. Slotting an item equips it on the dnd5e sheet; taking it out unequips it. Players can use it for their own characters. |
| **Quest log** | Narrative quests ("Deal with the bandit camp", not "collect 15 bandanas") with objectives the GM ticks off, grouped by zone in an MMO-style log (key **L**). Each quest is a journal entry. Chat cards when a quest is given or completed, a Pay rewards button, and an on-screen tracker. |
| **Boss frames** | Mark a token as a boss (crown button in the token HUD). While it's in a running combat, everyone sees a classic-MMO-style frame for it at the top of the screen: portrait, name and health bar. Several bosses stack; defeated ones turn grey. |
| **Loot rolls** | Need / Greed / Pass for an item lying in an Item Piles pile or body. Players roll from a chat card with a countdown; the GM's client makes every roll and moves the item to the winner's character. |
| **Boss loot** | Link a roll table of hand-picked drops to a creature. When it dies, the table is drawn (weighted, no repeats) and the items go on its body next to any vendor trash, with a **Start loot roll** button per item on the GM's card. |
| **Custom token ring** | Optional, off by default: your own ring image around NPC tokens (or every token), drawn by Foundry's dynamic token rings. New tokens get it as they're placed; one button rings the ones you already have. Token art and portraits aren't changed. |
| **Three-coin economy** | Optional: copper, silver and gold only, at 100 to 1. |

## Compatibility

- **Foundry VTT** v13 and v14 (verified on v14).
- **dnd5e** system 5.0 or later. The module is built for dnd5e and doesn't run on other systems.

## Optional integrations

None of these are required; the toolkit works on its own.

- **[Item Piles](https://foundryvtt.com/packages/item-piles)** with **Item Piles: D&D 5e** (`itempilesdnd5e`): Vendor Trash turns defeated creatures into lootable piles, and Loot rolls hand out items from piles. See [Setting up Item Piles](#setting-up-item-piles).
- **Monk's Active Tiles**: tiles can drive quests and the other tools through the module API (`game.modules.get("wayfarers-toolkit").api`). See [Scripting](#scripting).
- **wow-classic-items**: optionally reads items from the `wow-classic-items` module if installed (grey items for Vendor Trash, tooltip slots and quality colours in the character pane). No items or art from it are bundled.

## Install

In Foundry's setup screen, go to **Add-on Modules → Install Module** and paste this manifest URL:

```
https://github.com/cocoomg11/wayfarers-toolkit/releases/latest/download/module.json
```

## Setup

Enable the module in your world. The first time a GM loads it, the [welcome wizard](#control-panel) offers to pick the tools and run setup. Any time after, open the [control panel](#control-panel) and click **Run setup** on its Overview tab. Setup creates anything missing (tracker journal, party actor, the Riding Training feat, and the macros in a *Wayfarer's Toolkit* macro folder) and never overwrites existing documents. It never puts macros on anyone's hotbar and never removes ones already there: drag the macros you want from the *Wayfarer's Toolkit* macro folder or the **Wayfarer's Toolkit Macros** compendium onto your hotbar.

### Update notes

After the module is updated, the first time the world loads the GMs get one whispered chat card (players never see it): **Wayfarer's Toolkit updated: 1.14.4 → 1.17.0**, a short plain list of what's new in the newest version, the versions in between collapsed underneath, and a **To do** list with a button for each thing that still needs doing, plus an **Open the control panel** link. It's posted once, by the active GM, and only when there's something to say: a small patch with no notes and nothing to do posts nothing. The buttons work after a reload, only for GMs, and show as done once done (also when you did it some other way).

What can be on the to-do list:

- **Run setup**, when setup hasn't made everything the tools turned on need. It never touches a hotbar.
- **Import flight network from the old Flight Routes page** (Flight Master, coming from 1.15 or earlier), while the flight network is empty and the old page has flight points. It asks first and doesn't change the page.

Things for a tool that's switched off aren't listed. New worlds get no card (the welcome wizard covers them). The world remembers the last version it ran in a hidden setting; worlds updated from before 1.17 are recognised from the old setup reminder's record. Switch the card off with **Show update notes after updating** on the control panel's Overview tab; **Show update notes** there (or `api.updateNotes.show()`, or `api.updateNotes.show("1.15.0")` for everything since 1.15.0) posts it again. This card replaces the setup reminder of earlier versions.

### Health check

**Health check** (the control panel's Overview tab sums it up; **Full health report**, the **Toolkit Health Check** macro or `api.health()` post it) whispers the GM a report with ✓ / ⚠ / ✗ lines. It changes nothing. It covers:

- which features are on;
- dependencies: Item Piles and Item Piles: D&D 5e, the vendor-trash compendiums, and whether the coins match the Coin system setting (and Item Piles' currencies in three-coin mode);
- setup: each macro, the tracker journal and pages, the party actor, the Vendor Trash Rules page and the riding feat, for the features turned on, with a **Run setup** button when something's missing;
- boss loot: the party size and what it does to boss loot, every actor and token with a table linked, whether the table exists, how many results resolve to items, the draws and coin adjusted for the party size, and whether there are more draws than usable results. Links that would fall back to vendor trash are flagged. Creatures with a table named for them but not linked get a **Link boss tables by name** button;
- how many actors and tokens are marked **No loot**;
- problems on the Vendor Trash Rules page, scenes marked Dungeon, the flight network's size, flight points with no scene (⚠, information only: flying there still works) or a deleted scene, routes into locked points, routes naming a point that doesn't exist (✗), and an old Flight Routes journal page waiting to be imported;
- encounter zones whose roll table doesn't exist (or a stored value an earlier version couldn't read);
- the custom token ring: whether an image is chosen and loads, whether Foundry is using it, and how many matching tokens don't have it yet;
- whether update notes are on, and the last version this world ran;
- the active GM and how many GMs are online.

### Remove toolkit data

**Remove toolkit data** (a button on the control panel's Overview tab, GM only; also `api.cleanup.open()`) cleans the toolkit out of a world, for example before uninstalling it. The window first counts what it would remove, with a checkbox per kind:

- toolkit flags (`flags.wayfarers-toolkit`) on actors, on tokens on every scene, on scenes (Dungeon), on items (world items and items on actors), and on journals, journal pages and roll tables (flags only: the documents stay; quest journals stop being quests);
- optionally, **items created by the toolkit** (vendor trash and boss loot items, wherever they are: on bodies, the party actor or characters);
- optionally, the **world macros Run setup made** (macros carrying the toolkit's macro flag);
- optionally, **reset the module's settings** to their defaults (feature toggles included; Foundry offers to reload).

Type **REMOVE** and click **Remove** (or **Cancel** to close without changes). Nothing else is touched: your own documents, other modules' flags and items the toolkit didn't create stay. Item Piles piles stay piles (use Reset loot on them first if you want normal tokens back). What was removed is shown in a notification and whispered to the GMs. It doesn't need to be the active GM. From a macro: `api.cleanup.plan()` counts, `api.cleanup.remove({ actors: true, tokens: true, … })` removes.

### Debug logging

**Debug logging** (control panel › Loot › Advanced, off by default) writes the toolkit's automatic decisions to the browser console (F12): why a body got no loot, which GM's client ran an automatic step, the creature kind, CR band and items rolled, boss loot draws, and how each loot roll was settled. With it off nothing is logged.

### Several GMs

A world can have more than one GM logged in. Everything the toolkit does on its own (pre-rolling trash when a token is placed, making bodies lootable, drawing boss loot, settling loot rolls, carrying out players' flights, warnings about the rules page, coin conversion and the update notes) runs only on the **active GM**'s client: Foundry's active GM, or the connected GM with the lowest user id. Buttons and macros still run for whichever GM clicks them.

## Macro compendium

The module ships a **Wayfarer's Toolkit Macros** compendium (in a *Wayfarer's Toolkit* compendium folder) with every macro Run setup makes: Hex Travel and Flight Master (*Travel*), Session Start and Quest Log (*Sessions and Quests*), Vendor Trash, Preview Vendor Trash and Sell Vendor Trash (*Vendor Trash*), Preview Boss Loot (*Boss Loot*), and Toolkit Health Check (*Toolkit*). Open it from the **Compendium Packs** sidebar and drag a macro onto your hotbar; Foundry imports a copy into your world. **Run setup** also creates world copies in a *Wayfarer's Toolkit* macro folder (Macro Directory). Setup doesn't touch any hotbar, so drag the macros you want from that folder or from the compendium onto your hotbar.

Players can see the compendium (Observer), so they can drag out **Flight Master** and **Quest Log** themselves. The other macros are GM tools: a player who runs one gets a "GM only" warning and nothing happens. A compendium can't hide entries per world, so macros for tools you've switched off in the control panel are still listed; running one only shows the "turned off" warning. Each macro is a one-line call into the module API, so the compendium copies never go stale between versions.

## Control panel

All of the toolkit's settings live in one window. Open **Game Settings → Configure Settings → Wayfarer's Toolkit → Open the control panel** (GM only), or run `game.modules.get("wayfarers-toolkit").api.panel()`. The only other entry in the module's settings list is **Quest tracker: Show on screen**, which each player sets for themselves.

The panel has seven tabs down the left. Each settings tab shows the few settings most GMs change first; everything else is in a collapsed **Advanced** section at the bottom. Each tab has a **?** link to its section of this README and a **Reset this tab to defaults** button (asks first; the Features tab has none). Change what you like on any tabs, then click **Save changes**.

**A quick walkthrough for a new world**

1. The first time a GM opens a new world with the toolkit, the **welcome wizard** asks three things: a style (which tools to switch on), the party size, and the coins and campaign name. Finish it and it offers to **Run setup**. Skip it if you'd rather set things up yourself; it won't come back on its own (rerun it from the Overview tab).
2. Open the control panel. **Overview** says "Everything looks good" or lists what needs attention, each with a button that fixes it.
3. On **Features**, switch off anything you won't use and click **Save features** (Foundry reloads).
4. Go through **Travel**, **Loot**, **Boss & Combat** and **Quests**, change what you need and click **Save changes**.

The settings kept their keys from earlier versions, so anything you set before is still set, and macros and the API work as before.

### Overview tab

A plain-language health summary built from the [health check](#health-check): "Everything looks good", or "N things need attention" with one line per problem and, where there's a quick fix, a button: **Run setup** for anything setup hasn't made yet, **Link boss tables by name** for creatures with an unlinked table, a jump to the Travel tab for encounter zones or the Loot tab for compendiums, opening the flight network editor (or **Import from the Flight Routes journal page** when that's waiting), or opening the Vendor Trash Rules page. Below it: **Run setup**, **Full health report (to chat)** (the full ✓ / ⚠ / ✗ card), **Check again**, **Run the welcome wizard**, **Show update notes** and **Remove toolkit data…**, and the **Show update notes after updating** switch (saved as soon as you flip it; see [Update notes](#update-notes)).

### Features tab

One card per tool, with a switch: Hex Travel, Flight Master, Session Start, Vendor Trash, Riding Training, Character pane, Quest log, Quest tracker, Boss frames, Boss loot, Loot rolls, Custom token ring and the Three-coin economy. All tools are on by default except the custom token ring (the coins start on standard 5e). **Save features (reloads Foundry for everyone)** applies them.

A tool that's switched off adds nothing: no buttons, macros, key bindings, chat buttons, hooks or sheet changes (the character pane's armour-class adjustment included). Its settings stay in the other tabs, greyed out with a note, so you can see them. **Run setup** skips its macros and items. Nothing already in your world is deleted, so switching a tool back on picks up where it left off. Calling a switched-off tool from a macro just shows a warning.

### Travel tab

| | Settings |
| --- | --- |
| **Basics** | **Encounter zones** (a table: zone name and the roll table its encounters come from, with **Add zone** and a remove button per row; problems such as a missing name, a zone listed twice or a table that doesn't exist show under the table), **Players can book flights**, **Fares without a coin are in** (gold, silver or copper), the **Flight network…** button (the [flight network editor](#the-flight-network-editor)), **Scenes left out of Session Start** (tick the scenes), **Campaign name** (the "Previously, in …" recap heading) |
| **Advanced** | Encounter die, off-road time multiplier, mounted speed multiplier, slow / normal / fast pace, departure sound and its volume, riding feat name, tracker journal and party actor (pick from your journals and group actors, or type a name) |

If an earlier version's **Scenes hidden from Session Start** held a hand-written pattern, it's shown in Advanced as a text field with a note; ticking scenes replaces it.

### Loot tab

| | Settings |
| --- | --- |
| **Basics** | **Roll loot when creatures are placed**, **Bodies can be looted when they die**, **Items you give a creature count as loot**, **Party size** (1–8, see [Boss loot](#boss-loot)), **Seconds to choose Need / Greed / Pass** |
| **Advanced** | Unconscious creatures can be looted, loot stays on the body (Item Piles), the three dungeon settings, **Where junk loot comes from** (tick item compendiums by name), keep Item Piles' coins in step (three-coin economy), [debug logging](#debug-logging) |

### Boss & Combat tab

| | Settings |
| --- | --- |
| **Basics** | **Boss health players see** (bar only, bar and percentage, exact HP), **Boss loot drops on death**, **Creatures with boss loot get a boss frame**; and a **Link boss tables by name** button |
| **Advanced** | Extra boss drop for parties over 4 |

### Quests tab

| | Settings |
| --- | --- |
| **Basics** | **Show the quest tracker on my screen** (just for you), **Announce objectives in chat**, sounds when a quest is given and completed |
| **Advanced** | Quest sound volume, quest folder |

### Tokens tab

| | Settings |
| --- | --- |
| **Basics** | **Ring image**, **Which tokens get the ring** (NPCs only, or every token), **New tokens get the ring**, **Token art size inside the ring**; and the **Apply ring to existing tokens** and **Remove the toolkit's ring** buttons |
| **Advanced** | Keep existing tokens ringed (checked each time the world loads) |

See [Custom token ring](#custom-token-ring).

## Flight Master

Flight Master flies the party between **flight points** along **routes** you set up in the module itself. Nothing is read from a journal page, and a flight point opens a scene only if you pick one for it.

### The flight network editor

Open **control panel › Travel › Flight network…** (or `api.flight.editor()`). It has two tables and **Save** / **Cancel**; nothing changes until you save.

- **Flight points:** a name (for example *Harbor Town*), the **scene on arrival** (a dropdown of your scenes, or *No scene*), an **Unlocked** switch, an optional GM note, and a remove button. **Add flight point** adds a row. Only unlocked points can be flown from or to.
- **Routes:** **From** and **To** (dropdowns of your flight points), the **fare** per passenger, the flight **hours**, a **Two-way** switch (off: the route only flies From → To) and a **Free** switch (nobody pays for this route, players included). Type fares with coins, like `2s`, `1g 20s` or `75c`; a plain number such as `2` is read in *Fares without a coin are in* (control panel › Travel, gold by default). The fare is shown back formatted when you leave the field.

Problems show under the tables as you type, and the rows are outlined: a point with no name or the same name as another, a route from a point to itself, a route naming a point that no longer exists, or a fare that can't be read stop **Save**; a route listed twice is only a warning (the cheaper one is flown). Removing a flight point asks first and removes its routes too.

Flight Master always takes the cheapest way through unlocked points, so the party can fly *Harbor Town → Hill Fort → River Camp* in one booking if each leg is a route.

### Flying

Open Flight Master from the feather button in the token controls or the **Flight Master** macro. Pick From, To and the number of passengers, then **Check route**: before anyone confirms, the window shows the route, the fare per passenger × passengers = total, the party purse and the flight time. Confirming charges the fare from the party group actor's purse (with change), plays the departure sound, advances the world time, writes the trip to the Travel Log and posts "The party flies from … The party lands at *Harbor Town*." to chat.

- **A point with a scene:** that scene is activated on arrival (the GM can untick *Open destination scene for players*). If it can't be opened, the fare is refunded and the flight is called off.
- **A point with no scene** (or a scene that has been deleted): the flight still happens, the fare is charged, time passes and the trip is logged, but the scene stays where it is. The GM gets a whisper saying the party landed there and may need moving.

A flight is refused, with nothing charged, when the party can't afford it ("needs X, has Y (short Z)"), when a point isn't in the network or isn't unlocked, or when no route connects the two points.

**Free flight (GM).** The GM's Flight Master window has a **Free flight (no fare)** checkbox (off by default). A free flight skips the purse check and charges nothing; everything else happens as usual and the chat card and Travel Log say "free flight". From a macro: `api.flight.fly("Harbor Town", "Hill Fort", { free: true })`. Players never see the checkbox, and the GM's client ignores a "free" request in a player's booking: players always pay unless the route itself is marked **Free**.

**Players and Flight Master.** With *Players can book flights* on (the default, control panel › Travel), players get the feather button in the token controls and can drag the **Flight Master** macro onto their own hotbar from the *Wayfarer's Toolkit Macros* compendium (or the shared world copy in the macro folder). Players read the unlocked flight points and routes from the module's world setting (they never see your notes or a journal). A player picks a route and confirms; the active GM's client checks everything again (purse, points, routes), charges the fare and carries the flight out, and the player is told how it went. A GM must be connected ("A GM needs to be connected to fly.").

### Upgrading from 1.15 or earlier: the Flight Routes journal page

Earlier versions kept the network in two tables on the tracker journal's **Flight Routes** page. While the flight network is empty and that page has flight points, the editor and the Overview tab offer **Import from the Flight Routes journal page** (or `api.flight.importLegacy({ dryRun: true })` to see what would come in). It asks first and lists anything worth a look:

- each point's scene is matched by its exact scene name; a name with no match (or more than one scene with that name) imports as *No scene*, to pick in the editor;
- fares are read exactly as before (coins, or plain numbers in the fare unit);
- every route imports as **Two-way**, because the old tables always flew both ways;
- rows naming an unknown point, or a point to itself, are skipped and listed.

The import never edits or deletes the page and never runs on its own. Once the flight network has flight points the page is ignored, and you may delete it.

### Scripting

`api.flight()` opens Flight Master. `api.flight.network()` returns the network (`{ version, points: [{ id, name, sceneUuid, unlocked, note }], routes: [{ id, from, to, fareCp, hours, twoWay, free }] }`; `from` / `to` are point ids and `fareCp` is in the smallest coin in use). GM only: `api.flight.setNetwork(obj)` replaces it (points may be named by name in routes; a network with errors is refused), `api.flight.unlock("Hill Fort")` unlocks a point by name or id (`unlock(name, false)` locks it), `api.flight.fly(from, to, { pax, free, scene })` flies now without the window, `api.flight.importLegacy({ dryRun })` and `api.flight.editor()`.

**Flight sound.** A short bundled departure clip (`sounds/be-good.ogg`) plays for everyone when a flight departs. Pick a different file in *Departure sound* (control panel › Travel › Advanced), or clear it for silence.

## Vendor Trash

Grey "vendor trash" from defeated creatures, in the style of classic MMOs.

1. Place NPC tokens as usual. Each unlinked NPC token gets its drop and coin rolled the moment it's placed. The loot waits on the token's own copy of the actor; players can't see it.
2. When the creature drops to 0 HP or is marked defeated in the combat tracker (or, with the setting on, falls unconscious), its body becomes lootable (see below). Nothing else to do.
3. At a vendor, run **Sell Vendor Trash**. Pick whose trash to sell (the party actor or a character holding some; a selected token's actor is picked by default) and confirm. The coin goes to the same actor.

Every item is priced at its vendor value and marked as vendor trash. Each token is only looted once. Characters and group actors are never looted.

**Placing and rolling.** Only unlinked NPC tokens are pre-rolled; characters, group actors, linked tokens and tokens that are already piles or looted are left alone. A copied or pasted token rolls its own drop. Healing a creature back above 0 HP before its body is looted doesn't reroll anything; it keeps the loot it had. To check or change a drop, open the token HUD and hover the **dice** button (it lists the current drop) or click it to reroll; from a macro, `api.trash.reroll(tokens)`.

**Resetting loot.** To undo a looting (say, to replay an encounter), open the token HUD on a looted body, an Item Piles pile, a body that dropped [boss loot](#boss-loot) or a linked NPC carrying trash and click the **Reset loot** button (the circular arrow). Confirm, optionally ticking *Also clear coin*. The pile is turned back into a normal token, items marked as vendor trash or boss loot are removed (nothing else is touched) and the token can be looted again (and draw its boss loot again). For a linked token this changes the world actor: its trash is removed and its pile setting cleared, so later tokens of that actor aren't piles; it stays unrolled. An unlinked token gets a fresh pre-rolled drop when pre-rolling is on. From a macro: `api.trash.reset(tokens, { clearCoin: true })` (GM only; defaults to the selected tokens).

**The Vendor Trash macro** still works: select (or target) creatures and run it to loot them by hand (for example linked tokens, or with the automatic settings off). It uses the pre-rolled drop when there is one and rolls one otherwise.

| Setting | Default | Effect |
| --- | --- | --- |
| **Roll trash loot when NPC tokens are placed** | on | Pre-rolls the drop of every unlinked NPC token as it's placed. Off: the drop is rolled when the body is looted. |
| **Make bodies lootable automatically on death** | on | At 0 HP or when marked defeated, the body becomes an Item Piles pile (or, without Item Piles, the GM gets the Give to Party card). Off: run the Vendor Trash macro yourself. |

| **Items the GM adds to an NPC count as loot** | on | A weapon, armour, consumable, tool, loot item or container a GM adds to an NPC is marked *Lootable* and shows in its body's pile. See [Adding your own loot](#adding-your-own-loot). |
| **Unconscious bodies become lootable** | off | The Unconscious condition also makes an unlinked NPC's body lootable, as if it had died. No loot and one-loot-per-body still apply. |

All of these are on the control panel's **Loot** tab (greyed out while Vendor Trash is switched off). The rolling and looting happen on the active GM's client, so a GM has to be logged in.

**Several deaths at once.** When several bodies become lootable within about a second and a half of each other (an area spell), the GM gets **one** summary card instead of one per creature: a Vendor Trash section and a Boss loot section, a line per creature and the totals. The Give to Party and per-item **Start loot roll** buttons are on it as usual.

### With Item Piles: loot the bodies

When the [Item Piles](https://foundryvtt.com/packages/item-piles) module is active (and *Vendor Trash: Use Item Piles* is on, the default), Vendor Trash puts each creature's drop and coin on that creature and turns its token into an Item Pile. The token keeps its image and name. Players double-click the body (standing next to it) to open it and take the items and coin, which go onto their own character. The GM gets a short summary card. A creature that dropped nothing is left as it is.

- **Only the loot shows.** The creature's own weapons, armor and features stay on it but are hidden from the pile, so players see just the trash, coin and anything you [marked as loot](#adding-your-own-loot).
- **The world actor isn't touched** for ordinary unlinked tokens: the loot goes onto the token's own copy of the actor. (If an NPC's token is linked to its actor, the loot goes onto that actor.)
- **Empty bodies** stay on the map unless you turn on Item Piles' *Delete empty piles* setting. To make a body a normal token again, run `game.itempiles.API.revertTokensFromItemPiles(token)` (or turn the pile off in its Item Piles configuration).

#### Setting up Item Piles

1. Install and enable **Item Piles** and its system add-on: for dnd5e that's **Item Piles: D&D 5e** (`itempilesdnd5e`). Item Piles 3 has no system settings of its own; without the add-on it doesn't know item quantities or coins, and Vendor Trash falls back to the Give to Party card with a warning.
2. Reload. Item Piles applies the dnd5e settings the first time it sees the add-on.
3. **Three-coin economy:** the dnd5e add-on sets up five coins at 10 to 1. With the three-coin economy on and *Keep Item Piles' coins in step* on (the default, control panel › Loot › Advanced), this module replaces them each time the world loads with copper (×0.0001), silver (×0.01) and gold (primary), in that order, and whispers the GM when it changes them. To do it by hand instead, turn that setting off and in **Item Piles → Module Settings → System → Currencies** keep three attribute currencies, in this order: `system.currency.cp` (0.0001), `system.currency.sp` (0.01) and `system.currency.gp` (exchange rate 1, primary), and delete platinum and electrum.

### Without Item Piles: Give to Party

The GM gets a loot card listing each creature's drop and its vendor value. Click **Give to Party** on the card: items go into the party actor's inventory and coin into its purse. This is also what happens when *Vendor Trash uses Item Piles* is off.

### What drops

What drops depends on the creature: its type, its subtype and the words in its name.

| Creature | Drops |
| --- | --- |
| Beast, monstrosity | A body part (70%), sometimes two, made of what that creature has: a wolf or bear fur, fangs, claws and meat; a spider or scorpion chitin, silk, venom and stingers; a bird feathers, talons and beaks; a crocodile or snake scales, teeth and eggs. No coin. |
| Humanoid, giant | Coin (75%), a trinket or other junk (50%), a piece of worn gear for its level (35%). Never body parts, except ones named after its own kind (a gnoll's mane). |
| Undead | Bones, dust and rotting flesh (60%), sometimes worn gear or coin. |
| Elemental, construct | Stones, ash, embers, essences and shards (60%). |
| Plant, fey | Roots, petals, bark, leaves and spores (60%). |
| Ooze | Slime and residue (60%). |
| Dragon | Scales, claws, teeth and wing parts. Never fur, insect parts, feathers or bones, not even through the rules page. |

**Material tags.** Each item is sorted by the words in its name: `fur` (fur, pelt, hide, leather, mane…), `tooth` (tooth, tusk, horn, fang, claw…), `flesh` (meat, flank, heart, eye, gland…), `insect` (chitin, carapace, mandible, stinger, ichor, silk, web…), `venom`, `egg`, `scale`, `avian` (feather, talon, beak, quill), `wing`, `aquatic` (fin, gill, blubber, pearl), `shell`, `undead` (bone, skull, dust, grave…), `elemental` (stone, ash, ember, essence, shard, crystal…), `plant` (root, petal, spore, bark, leaf…), `ooze` (slime, goo, residue) and `trinket` (made things: spoons, mugs, pouches, candles, rings…). Weapons and armour are `gear`; loot whose name matches nothing is `misc`, which humanoids and creatures of unusual types can drop.

**Creature words.** The creature's name and subtype are matched against ordinary English animal words (wolf, hound, bear, boar, cat, stag, rat, ape, spider, scorpion, beetle, wasp, crab, turtle, crocodile, lizard, snake, raptor, bat, owl, hawk, vulture, wyvern, shark, gnoll, kobold, goblin, orc, ogre, troll, dragon, drake, whelp, skeleton, zombie, ghost…). The words decide which materials it may drop. If the sheet has no creature type the name decides the type too (a "Mangy Wolf" is a beast, a "Bandit Lookout" a humanoid). A humanoid race word (gnoll, kobold, goblin, orc, ogre, troll) in the name or subtype makes the creature a humanoid whatever its type on the sheet, so a gnoll statted as a fiend still drops trinkets, gear and coin; so does a role word such as *bandit* or *guard* when no animal word is beside it. Dragons, undead, elementals, constructs, oozes and plants keep their type (a gnoll lich drops bones).

**Family words.** If an item's name contains a creature-family word, only creatures of that family drop it. The family words are the animal words above plus the first word of every NPC name in your world (skipping words such as *Young*, *Mangy* or colours) and any listed on the rules page. So once a "Duskwing Stalker" exists in the world, a "Duskwing Chitin" only drops from creatures whose name contains *Duskwing*, never from ordinary spiders, without that name being written anywhere in the module. Items named after the creature are picked first (75% of the time). Items matching no rule fall back to the creature type's usual kinds of junk.

**Where the items come from.** The tool reads an item compendium; it ships no items. With the optional `wow-classic-items` module installed, it uses that compendium's grey-quality items, their item levels and their vendor sell prices, which is what you want with the three-coin economy. To use other items, list compendium IDs in **Vendor Trash: Compendiums**; in those, loot-type items with no rarity count as trash.

### Adding your own loot

Any item can be loot, not just vendor trash: a key, a letter, the bandit captain's sword.

- **Drag it onto the NPC.** With *Items the GM adds to an NPC count as loot* on (the default), an item a GM adds to an NPC actor or an unlinked token's sheet is marked **Lootable** and shows in the pile when the body becomes lootable, next to its trash and coin. The items that came with the stat block (imported or created with the actor) are never marked, so the creature's own gear stays hidden as before.
- **Mark or unmark by hand.** On an NPC's item sheet the GM sees a **Lootable** checkbox in the header; in the NPC sheet's inventory, right-click an item for **Mark as loot** / **Unmark loot**. Unmarking an item the GM added keeps it on the creature but out of the pile.
- **Everything is lootable.** For a creature whose whole kit should be lootable (a fallen adventurer), use the NPC sheet's header menu: **Everything is lootable: turn on**. Its pile then shows every physical item (weapons, equipment, consumables, tools, loot and containers), never features, spells or classes. Items explicitly unmarked stay hidden. On an unlinked token's sheet this affects only that token.
- **Bodies that are already piles** update straight away when a mark changes or *Everything is lootable* is toggled.
- **Without Item Piles** the hand-added loot of an unlinked token goes onto the Give to Party card with the trash.
- **Reset loot** keeps marked items on the creature (with their mark) unless you tick *Also remove hand-added loot*. **Remove toolkit data** counts and removes the marks with the other toolkit flags (the items themselves stay).
- The health check shows how many NPCs have *Everything is lootable* and how many items are marked.

The flags are `flags.wayfarers-toolkit.lootable` (`true` or `false`) on items and `flags.wayfarers-toolkit.allLootable` on actors. From a macro (GM only): `api.trash.setLootable(itemsOrUuids, true)` (`false` hides, `null` clears the mark) and `api.trash.setAllLootable(actorOrToken, true)`. `api.trash.reset(tokens, { removeHandAdded: true })` also removes marked items.

### No loot

Some creatures shouldn't drop anything (summons, illusions, a captured prisoner). Open the token HUD as the GM and click the **crossed-out sack** button: *click* marks this token, *Shift-click* marks the world actor (every token of it); the tooltip says which is set. A marked creature gets no pre-rolled trash, its body isn't made lootable on death, boss loot isn't drawn, and the Vendor Trash macro skips it with a note. Turning it on for a token that already has pre-rolled trash removes that trash (nothing is rerolled). A token can be turned back on while its actor stays marked.

The flag is `flags.wayfarers-toolkit.noLoot = true` on the actor or the token (a token's own `true` or `false` wins over its actor's). From a macro: `api.trash.setNoLoot(tokensOrActors, true, { actor: false })`.

### Value by challenge rating

Higher CR means better loot: more rolls, higher item levels and more coin. The bands live in one commented constant, `CR_BANDS` in `scripts/trash-rules.mjs`, to tune if your table wants richer or poorer trash:

| Band | Item level | Vendor value of unlevelled items | Coin (if it carries any) | Rolls of its drop table |
| --- | --- | --- | --- | --- |
| CR 0–1/4 | 1–6 | 1–30c | 60c–3s 20c | 1 |
| CR 1/2–1 | 3–10 | 5c–1s | 1s 50c–6s | 1 |
| CR 2–4 | 7–16 | 20c–4s | 10s–40s | 1 |
| CR 5–8 | 15–28 | 1s–15s | 50s–1g 60s | 1–2 |
| CR 9–12 | 28–42 | 4s–40s | 2g–5g 60s | 1–2 |
| CR 13–16 | 41–55 | 10s–80s | 3g–7g | 2 |
| CR 17+ | 54–63 | 20s–2g | 6g–17g | 2–3 |

(Copper, silver and gold at 100 to 1. In a standard 5e economy the same copper amounts are paid out in cp, sp and gp.) The bands aim for trash to be a modest slice of a party's income, around a tenth, on a wealth curve of roughly 1g per character by level 2, 15g by 6, 75g by 10, 400g by 14 and 1,200g by 18; quest rewards and treasure stay the main income. If too few matching items fall inside a band, the item-level range widens a few levels at a time until some do: a creature drops a slightly off-level item before it drops one that doesn't fit it.

**Preview Vendor Trash macro.** Select (or target) one or more tokens and run **Preview Vendor Trash** (GM only; Run setup creates it). Each token gets a GM-whispered card: its kind and CR band, the materials it may and may not drop, the rules from the Vendor Trash Rules page that matched it, how many pool items fit and whether the item-level band had to be widened, its current pre-rolled drop and coin (or *looted*), a sample of up to 12 possible drops with item level and vendor value (in collapsible lists), and its coin odds and range. Nothing is rolled or changed. From a macro: `api.trash.showPreview(tokens, n)`.

**Checking a creature.** Select a token and run `game.modules.get("wayfarers-toolkit").api.trash.preview()` (or pass a token or actor, and how many items to list: `preview(token, 40)`). It returns the creature's kind, materials, CR band, the rules that matched and a sample of what it can drop, and logs how many items of the pool fit.

### Your own rules: the Vendor Trash Rules page

**Run setup** adds a **Vendor Trash Rules** page to the tracker journal. Its first table holds extra rules for your world; edit it like any journal table. Each row applies to every creature whose name, type or subtype contains the text in the first column (not case-sensitive; `*` matches every creature):

| Creature match | Allow tags | Allow items | Deny items | Family words |
| --- | --- | --- | --- | --- |
| ember | elemental | | | |
| trapper | fur, gear | | | |
| swamp | plant | Bog Lily | Dry Leaf | |
| marsh lurker | | | | murkfin |

- **Allow tags**: material tags (listed above) the creature may also drop. `gear` lets it drop worn weapons and armour; `coin` makes it carry coin.
- **Allow items**: parts of item names it may always drop, and drops first.
- **Deny items**: parts of item names it never drops.
- **Family words**: words that tie items to this creature, as if they were the first word of its name. In the last row, items with *Murkfin* in their name drop from Marsh Lurkers (and from creatures named Murkfin…), and no one else.

Lists are separated by commas. Rows with an unknown tag or an empty first column are skipped, and the GM gets a warning naming them. Changes apply to the next roll; already pre-rolled tokens keep their loot until rerolled.

### Dungeon loot

Mark a scene as a dungeon to make its creatures richer: open the scene's configuration and tick **Dungeon** on the *Basics* tab (it's stored as the scene flag `flags.wayfarers-toolkit.dungeon`). Creatures looted on that scene then get:

| Setting | Default | Effect |
| --- | --- | --- |
| **Dungeon coin multiplier** | 2 | Coin a creature drops is multiplied by this. |
| **Dungeon drop bonus (%)** | 25 | Percentage points added to every item-drop chance (a 70% body part becomes 95%), never above 100%. |
| **Dungeon extra item roll** | on | The creature's item drops are rolled a second time (coin is not). |

The dungeon bonus comes on top of the creature's CR band. The trash pool is grey items only by design, so instead of raising item quality the dungeon bonus gives an extra roll. A pre-rolled token gets the bonus of the scene it was placed on. Whether coin drops at all is unchanged; only the amount goes up. Scenes not marked as dungeons drop exactly as before. The GM's Vendor Trash card shows a small **Dungeon** tag when the bonus applied. The checkbox and settings belong to Vendor Trash and disappear when it's turned off.

## Riding Training and Long Road

**Run setup** adds a feat called *Riding Training* to an Items folder named *Wayfarer's Toolkit* (players can see it, so they can drag it onto their sheets). It's granted on completing riding training with a stablemaster or riding instructor:

> **Swift Mount.** Mounting or dismounting a creature costs you only 5 feet of movement, rather than half your Speed.
> **Long Road.** When every member of your party has this feat and all of you are mounted, the party travels overland at mounted speed.

Hex Travel enforces Long Road: when the party actor has members, the *Mounted* box starts ticked only if every member has the feat, and the dialog names anyone who doesn't. The GM can still tick or untick it. Rename the feat in the **Riding feat name** setting if you call it something else.

**Upgrading from 1.7 or earlier.** The feat used to be called *Trained Rider*. Hex Travel accepts either name, and a *Riding feat name* setting still holding *Trained Rider* is read as *Riding Training*. Run setup once to rename the module's own *Trained Rider* feats (in the Items directory and on actors) to *Riding Training*; a feat you renamed yourself is left alone.

## Character pane

A paper doll in the style of a classic MMO character screen. The character's portrait sits in the middle with their stats underneath (the six ability scores, Armor, Health and attuned items), and the gear slots run around it.

**Open it** with the shirt button in the header of a dnd5e character (or NPC) sheet, also in the sheet's **⋮** controls menu, or from a macro with `game.modules.get("wayfarers-toolkit").api.characterPane(actor)` (no actor: the selected token's, else your own character). Anyone who owns the actor can open it, so players can dress their own characters. Turn it off under **Choose features**.

The window is resizable: the slots and portrait grow with it, the *Equippable items* list scrolls inside it, and each player's size and position are remembered on their own computer.

### Slots

Classic-MMO equipment slots, without an Ammo slot:

| Left | Right | Bottom |
| --- | --- | --- |
| Head, Neck, Shoulder, Back, Chest, Shirt, Tabard, Wrist | Hands, Waist, Legs, Feet, Finger ×2, Trinket ×2 | Main Hand, Off Hand, Ranged |

Empty slots show a faint placeholder. Item icons get a border in their quality colour (grey, white, green, blue, purple, orange): an item with an MMO-style tooltip uses its own colour; otherwise dnd5e rarity decides (common white, uncommon green, rare blue, very rare purple, legendary orange, artifact gold). Hover an item for its tooltip.

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

### Items with MMO-style tooltips

Items whose description holds an MMO-style item tooltip, like those in the optional `wow-classic-items` compendium, are placed by the tooltip's slot line: Head, Neck, Shoulder, Back, Chest, Shirt, Tabard, Wrist, Hands, Waist, Legs, Feet, Finger, Trinket, Main Hand, One-Hand (either hand), Two-Hand, Off Hand / Held In Off-hand, and Ranged / Thrown / Relic in the Ranged slot. Their border uses the tooltip's quality colour, and hovering shows that tooltip. When a description has no slot line, the compendium folder the item came from decides (Head, Two-Hand, Finger, Wands…). Nothing from that module is bundled; icons come from the items.

**Armour pieces and AC.** MMO-style helms, shoulders, gloves, boots and the like are often typed as light, medium or heavy armour with no AC of their own, and dnd5e only counts one piece of armour for AC. So that a helm doesn't replace the chest armour, armour-typed items worn in a slot other than **Chest** are left out of dnd5e's AC calculation while the character pane is on. Armour in the Chest slot, and equipped armour that isn't in any slot, counts as usual.

## Quest log

Quests stay narrative: each one has a few objectives written as things to do ("Handle the bandit camp", "Find out who hired them"), and the GM ticks them off when the story says so. There are no kill or collect counters.

### Setup

1. Make sure **Quest log** (and, if you want it, **Quest tracker**) is switched on in the control panel's Features tab.
2. Run setup to add a **Quest Log** macro (shared with players). Everyone can also open the log with the scroll button in the token controls or the **L** key (change it under **Configure Controls**).
3. Optional settings (control panel › Quests): **Quest folder** (the journal folder quests live in, default *Quest Log*), **Quest objectives in chat**, and **Quest accepted / complete sound** with a volume (blank by default; pick your own audio files).

### Making quests (GM)

Click **New quest** in the log. A quest has:

- **Title**, **Zone / region** (quests are grouped under zone headers) and an optional **Level / tier** label.
- **Quest giver**: type a name or drop an actor on the field to link it.
- **Summary** (a line or two, used in chat) and a rich-text **Description**.
- **Objectives**: add, remove and reorder rows. Each can be **Hidden** (players don't see it until you reveal it) or **Optional**.
- **Rewards**: coin written like `1g 20s` or `50c` (a plain number uses the *Fare unit*; works with either coin system), items dropped from the sidebar or a compendium, and free text such as renown.
- **Status**: *Not given*, *Active*, *Completed* or *Failed*, and **Hidden from players**.

In the log the GM sees every quest, including ones not given yet (*Not given* tab) and hidden ones (marked with a crossed-out eye). Buttons under each quest: **Give quest**, **Complete**, **Fail**, **Reopen**, **Pay rewards**, **Show / Hide from players**, **Edit**, **Journal** and **Delete**. Click an objective's box to tick it; **Reveal** shows a hidden objective.

### What players see

Players only read. They see quests that have been given and aren't hidden, under **Active** and **Completed** (failed quests sit in Completed, struck through), with visible objectives, the description and rewards. The journal entries follow the same rule: players get Observer permission only once a quest is given and not hidden.

**Tracker.** Newly given quests are tracked automatically (up to five); untick **Track** in the log to drop one. The tracker sits at the top right of the canvas, left of the sidebar, listing each tracked quest's open objectives. Collapse it with its arrow, or turn it off per player with the **Quest tracker** client setting.

### Moments

- **Give quest** posts a *New quest* card with the summary (and plays the accepted sound).
- Ticking or revealing an objective posts a short line (or a notification, with *Quest objectives in chat* off).
- **Complete** posts a *Quest complete* card listing the rewards, with a **Pay rewards** button for the GM: the coin goes into the party actor's purse and the items onto the party actor. Each quest pays once.
- **Fail** posts a *Quest failed* card.

Hidden quests announce nothing; showing an active quest to players announces it then.

### Journals

Each quest is a journal entry with one text page in the quest folder. The page is rewritten from the quest's data whenever it changes, so it reads well on its own and in exports: status, level, zone, giver, summary, objectives (☑/☐), description and rewards. Hidden objectives go in a secret block that only the GM sees. Edit quests in the quest log rather than on the page, since the page is regenerated. The data is in `flags.wayfarers-toolkit.quest`.

### Scripting

`game.modules.get("wayfarers-toolkit").api.quests` (also usable from Monk's Active Tiles script actions):

```js
const q = game.modules.get("wayfarers-toolkit").api.quests;
await q.create({ title: "Trouble at the Old Mill", zone: "Riverside", summary: "Bandits hold the mill.",
  objectives: ["Deal with the bandit camp", { text: "Find out who hired them", hidden: true }],
  rewards: { coin: "1g 20s", items: ["Compendium.dnd5e.items.Item.…"], other: "Goodwill of the miller" } });
await q.activate("Trouble at the Old Mill");          // give it
await q.tickObjective("Trouble at the Old Mill", "bandit camp");  // by index, id or (part of) the text
await q.revealObjective("Trouble at the Old Mill", 1);
await q.complete("Trouble at the Old Mill");          // or q.fail(…), q.reset(…)
q.open("Trouble at the Old Mill");
```

Also `update(quest, patch)`, `hide(quest, true|false)`, `untickObjective`, `payRewards`, `delete`, `list()`, `get(quest)`, `track(quest, on)`. Quests are found by journal id, UUID or name. All of these that change a quest are GM only: on a player's client they just warn, and no quest change is ever sent over the socket. Monk's Active Tiles runs its actions on the GM's client, so tiles work as usual.

## Boss frames

Select a token, open its token HUD (right-click) and click the **crown** button to mark it as a boss; click again to unmark it. The mark is on the token, so each copy of a creature can be marked separately. From a macro: `api.bosses.toggle(tokens, true)`.

While a combat is running and a marked boss is one of its combatants, every connected client sees its frame at the top centre of the screen: the token image, its name and a health bar that updates as it takes damage (temporary hit points show as a striped segment). Several bosses stack. The frame goes away when the combat ends, the boss is removed from it or unmarked. A boss at 0 HP or marked defeated stays on screen, greyed out, until the combat ends. Hidden combatants and hidden tokens aren't shown to players.

With the **Carousel Combat Tracker** module showing its dock along the top of the screen, the default stack sits just below the dock instead of under it, and follows it when it changes size. Frames you've moved stay where you put them.

Each user can arrange the frames on their own screen. Drag a group's top frame to move the whole group; drag any other frame to pull it out on its own. Drop a frame within a few pixels of another frame's edge and it snaps flush against it (a dashed outline shows where) and joins that group; new bosses join the main stack. The layout is remembered on that browser and kept on-screen after a resize. Double-click any frame to put them all back in one stack at the top centre.

**Boss frames: what players see** (world setting): *Bar only*, *Bar and percentage* or *Exact HP*. The GM always sees exact hit points.

**Boss frames: treat tokens with boss loot as bosses** (world setting, on by default, with Boss loot turned on): a creature with a boss loot table gets a frame in combat without the crown. Turning the crown off on such a token hides its frame (the token stores an explicit "not a boss").

Frames show only for the combat on the scene you're viewing, and a frame disappears straight away when its token, combatant or actor is deleted mid-combat.

## Loot rolls

Needs Item Piles set up for your system (for dnd5e, Item Piles: D&D 5e). Without it the feature just adds nothing.

1. Open an Item Piles pile or lootable body as the GM. Each item row has a **dice** button (*Roll for this*), next to *Take*. From a macro: `game.modules.get("wayfarers-toolkit").api.lootRoll.start(itemOrUuid, { seconds })`.
2. A **Loot roll** chat card shows the item's name, icon and rarity colour, with **Need**, **Greed** and **Pass** buttons and a countdown (**Seconds to choose Need / Greed / Pass**, control panel › Loot, default 60 seconds). Every logged-in player who has a character can choose once; the GM can **Close the roll now**.
3. Each choice goes to the GM's client, which rolls a d100 for Need and Greed and writes it on the card, so everyone sees every roll and nobody can set their own.
4. When everyone has chosen or time runs out: the highest Need wins; if nobody chose Need, the highest Greed. Ties reroll among the tied players. The item (the whole stack) moves from the pile to the winner's assigned character (or the first character they own) through Item Piles, and the result is posted to chat. If everyone passes or nobody answers, the item stays in the pile.

**If the winner can't take it** (they have no character, their character was deleted, or Item Piles can't move the item), the item goes to the next-best roll (Need before Greed, then by roll) and the card says who was passed over and why. If nobody who rolled can receive it, it stays in the pile.

**Assign to…** The GM's copy of an open card has a dropdown of the player characters and the party actor and an **Assign to…** button: it ends the roll and moves the item there straight away.

The players of the receiving character (everyone who owns it or has it as their character) get a whisper, "You won *item*", as well as the public line; the same goes for a GM Assign. Given to the party actor, its player owners get the whisper, if it has any.

A GM must be connected for players' choices to count. While none is, players' Need / Greed / Pass buttons are disabled with "A GM needs to be connected." and come back when a GM connects. An open roll survives a GM reload and closes when its time is up.

## Boss loot

Hand-picked drops for named creatures, alongside (or instead of) vendor trash. Works with linked and unlinked tokens.

1. Make a **roll table** with one result per possible drop. Each result is a document result pointing at an Item (a world item or a compendium item); its **weight** is its relative chance. Text results (such as "Nothing") drop nothing.
2. As the GM, open the creature's token HUD and click the **gem** button (*Boss loot…*). Pick a world table from the list, or drag any roll table (also from a compendium) onto the *Table UUID* box. Set **Draws** (how many results drop), optional **Coin** (in copper) and a **Note** for yourself. For an unlinked token you choose whether it applies to this token only or to every token of that actor. Choose *(none)* to remove it. The gem is lit on tokens with a table.
3. When the creature drops to 0 HP or is marked defeated, the active GM's client draws the table once: `draws` results, weighted, without replacement (the same item never drops twice in one draw). The roll table itself is never changed, so "drawn" marks on it don't matter. The items are copied onto the body and, with Item Piles, it becomes a lootable pile showing only loot (vendor trash and boss loot) and coin; the creature's own gear stays hidden. Without Item Piles the GM's card has a **Give to Party** button.
4. The GM gets a card "*Name* dropped:" with a link per item and, when Loot rolls is on, a **Start loot roll** button per item.

**Party size.** Boss coin is scaled by the **Party size** setting: `coinCp × party size / 4`, rounded to the copper (a 1,000c boss drops 1,250c for five). The flag itself is not changed. With **Boss loot: extra drop for parties above 4** on (the default), a boss with 3 or more draws draws one more for a party of 5 or more, never more than its table's usable results. Preview Boss Loot and the health check show the adjusted coin and draws next to the ones set.

**Link boss tables by name.** If your tables are named after their creatures, link them all at once: **Link boss tables by name** (control panel › Boss & Combat, or the Overview tab when it applies), the button in the health check, or `api.bossLoot.autoLink({ folder, overwrite })`. Every world NPC actor without a boss loot link gets the world roll table named exactly "*Actor name* · Loot" (also "*Actor name* - Loot" or "Loot: *Actor name*"), with 1 draw and no coin, unless the table says otherwise: a table flag `flags.wayfarers-toolkit.bossLootDefaults = { draws, coinCp, note }`, or "draws: 2" / "coin: 1500" (copper) in the table's description. Existing links are never changed unless `overwrite: true`. `folder` (a folder, its id or name) limits it to actors in that folder. You get a notification and a whisper listing what was linked and skipped.

**Fallback.** If the linked table has been deleted, has no results that can drop, or the draw finds none of the items its results point at, the body gets the normal vendor-trash drop instead (unless it's marked No loot) and the GM is whispered which creature, why and what happened: "vendor trash dropped instead", "no vendor trash rolled for it either", "its vendor trash is already on the body", or why there's none (Vendor Trash off, No loot, no compendium). A linked boss has no pre-rolled trash, so its fallback drop is rolled then (up to three tries before it counts as empty). The health check lists these links in advance.

Each death draws once: healing and dying again doesn't draw again. **Reset loot** (token HUD) removes the boss loot items as well as vendor trash and lets it draw again. **Boss loot: drop automatically on death** (world setting, on by default) can be turned off; then drop it yourself with `api.bossLoot.drop(tokens)`.

**Preview Boss Loot** (macro) whispers the GM a card per selected token: the table, the number of draws and coin (adjusted for the party size), note, and every result with its weight and its chance per draw.

### Flag format

The link is an actor flag, set on the world actor (linked tokens, or every token of an actor) or on an unlinked token's own actor:

```json
"flags": {
  "wayfarers-toolkit": {
    "bossLoot": { "table": "RollTable.abc123def456ghi7", "draws": 2, "coinCp": 1500, "note": "Drops from the cave guardian" }
  }
}
```

- `table` (required): the roll table's UUID (`RollTable.<id>` or `Compendium.<pack>.RollTable.<id>`).
- `draws` (default 1): how many results drop, never more than the table has.
- `coinCp` (optional): coin added to the body, in copper.
- `note` (optional): shown on the GM's cards.

Dropped items carry the item flag `flags.wayfarers-toolkit.bossLoot` and the token gets `flags.wayfarers-toolkit.bossLootDrawn` once it has dropped.

From a macro:

```js
const api = game.modules.get("wayfarers-toolkit").api;
await api.bossLoot.set(token, { table: "RollTable.abc123def456ghi7", draws: 2, coinCp: 1500 }); // a token or an actor
api.bossLoot.get(token.actor);   // { table, draws, coinCp, note } or null
api.bossLoot.preview(token);     // GM card with the odds
api.bossLoot.drop([token]);      // drop now (skipped if it already dropped)
await api.bossLoot.autoLink();   // link tables named "<creature> · Loot"; { folder, overwrite }
```

## Custom token ring

Use your own ring image for Foundry's **dynamic token rings** (the ring Foundry draws around a token's art when *Dynamic ring* is ticked in the token's settings). It's off by default: switch on **Custom token ring** in the Features tab, then on the **Tokens** tab:

1. **Ring image**: a square image of the ring with a transparent middle, 256 × 256 or bigger (PNG or WebP with transparency). Upload it to your world's folder with the file picker. Foundry reloads when you change it.
2. **Which tokens get the ring**: *NPCs only* (the default) never touches player characters' tokens; *Every token* rings them too.
3. **New tokens get the ring** (on by default): tokens you place from now on get the ring as they're created.
4. **Token art size inside the ring**: Foundry's ring *subject scale* for the tokens the toolkit rings. Foundry draws the token art on top of the ring, so for a ring drawn near the edge of its image keep this below 1 (0.85 by default) to keep the ring outside round token art. A scale you set yourself on a token is kept.
5. Click **Apply ring to existing tokens**. It asks first, then turns the ring on for the prototype token of every matching actor and every matching token already on your scenes (in batches, by the active GM).

What it changes: only each token's *Dynamic ring* switch and its subject scale. The token image, its subject image and the actor's portrait are never changed. The toolkit records what each token had, so **Remove the toolkit's ring** puts every token it ringed back the way it was (tokens you ringed yourself aren't touched).

While the tool is on, your image is the ring for **every** token with a dynamic ring in the world (Foundry has one ring style per world), including tokens that had the ring on before. Ring colours and effects from the token's settings still work; the image keeps its own colours. Switch the tool off and Foundry's own ring comes back.

How it works: the module registers a ring style with Foundry's dynamic token ring system. Each client draws your image into one shared texture when the world loads, so there's no extra drawing per token and nothing to install or convert. **Keep existing tokens ringed** (Advanced) has the active GM ring any matching token that's missing it each time the world loads.

From a macro: `api.ring.applyAll({ npcOnly: true })`, `api.ring.remove()`, `api.ring.plan()` (counts without changing anything) and `api.ring.status()`.

## Three-coin economy (copper, silver, gold)

An optional classic-MMO-style economy: no electrum or platinum, and **100 copper = 1 silver, 100 silver = 1 gold**. Character, NPC, group, vehicle and container sheets, the currency manager and award dialogs show only copper, silver and gold, in that order (abbreviated c, s, g); dnd5e's currency **Convert** button changes coins at the new rates, and Flight Master charges and gives change in the new coins.

### Setup

1. **Platinum and electrum are converted for you.** Each time the world loads in three-coin mode (and when you **Run setup**), the GM's client turns any pp or ep left on actors, containers and unlinked tokens into the new coins: **1 pp = 10 gold** and **1 ep = 50 silver** (half a gold piece, its standard 5e value), and whispers the GM who was changed. If you'd rather decide yourself, convert or remove them while you're still on Standard.
2. In the control panel's **Features** tab, switch on **Three-coin economy** and click **Save features**; Foundry reloads.
3. Set **Fares without a coin are in** (control panel › Travel) to the coin your flight fares use when typed as plain numbers. For MMO-style prices that's usually *Silver*. Or write each fare with its coin (`2s`, `1g 20s`) and the setting doesn't matter.
4. Check a sheet: the currency block should show only copper, silver and gold, left to right.

To switch back, switch **Three-coin economy** off again. Coin amounts stay as they are; they're just read at 5e rates again.

### What it doesn't change

**Item prices.** Nothing on your items is rewritten. dnd5e keeps each price's number and coin, so an item listed at *15 gp* now costs 15 **gold**, a hundred times more in silver than before. Many tables using this economy read a 5e price in gp as the same number of **silver** (a 15 gp longsword costs 15s). If you want that, reprice your items separately; this setting won't do it for you.

**Treasure and rewards** you award by hand: give coin in the new denominations.

## Macros and scripting

Every tool is available as `game.modules.get("wayfarers-toolkit").api.<tool>()`: `hexTravel`, `flight`, `sessionStart`, `vendorTrash`, `sellTrash`, `characterPane`, `questLog`, `setup`, `health` (the health check; `api.setupPlan()` lists what setup would create). Boss frames are under `api.bosses` (`toggle(tokens, on)`, `isBoss(token)`) and loot rolls under `api.lootRoll` (`start(item, { seconds })`, `close(messageId)`) (plus `assign(messageId, actor)`) and boss loot under `api.bossLoot` (`set`, `get`, `preview`, `drop`, `reset`, `dialog`, `autoLink`; see [Boss loot](#boss-loot)); all are undefined when their feature is off. `api.partySize` reads the Party size setting; `api.cleanup` is [Remove toolkit data](#remove-toolkit-data). The quest API is under `api.quests` (see [Quest log](#quest-log)); `api.features.on("questLog")` tells whether a feature is turned on. `characterPane(actor)` opens the pane for an actor (or the selected token's, or your character); `api.pane.slotItem(actor, item, slot)` and `api.pane.unslotItem(item)` slot and unslot from a macro (slots: `head`, `neck`, `shoulder`, `back`, `chest`, `shirt`, `tabard`, `wrist`, `hands`, `waist`, `legs`, `feet`, `finger1`, `finger2`, `trinket1`, `trinket2`, `mainhand`, `offhand`, `ranged`). `vendorTrash(tokens)` takes an optional list of tokens instead of the selection, `api.trash.reroll(tokens)` rerolls pre-rolled trash, `api.trash.reset(tokens, { clearCoin })` resets looted tokens, `api.trash.preview(tokenOrActor, n)` returns what a creature can drop, `api.trash.showPreview(tokens, n)` whispers that as a GM chat card (the Preview Vendor Trash macro), and `sellTrash(actor)` sells one actor's trash without asking. Money helpers: `parseMoney("1g 20s")` returns an amount in the smallest coin, `fmtMoney(amount)` formats one, and `totalMoney(actor)` / `pay(actor, amount)` read and spend an actor's purse.

## License

[MIT](LICENSE). Free to use, modify and share.

This is an unofficial fan-made module. It is not affiliated with or endorsed by Foundry Gaming LLC, Wizards of the Coast or any game publisher, and it bundles no third-party game content.

## Credits

- Module by **cocoomg11**.
- Flight sound (`sounds/be-good.ogg`) recorded by a friend of the author, used with permission.

Bug reports and suggestions: [GitHub issues](https://github.com/cocoomg11/wayfarers-toolkit/issues).

## Building from source

Tests: `npm test` runs the pure-logic tests in `tests/` with Node's built-in test runner (Node 22; nothing to install), and `npm run check` syntax-checks every script. Both run on GitHub Actions for every push and pull request to `main`.

The compendium sources live in `src/packs/macros` as JSON and are generated from `scripts/macros.mjs`, the same list Run setup uses. After changing a macro, run `node tools/build-packs.mjs sources` and commit the JSON. The release workflow installs `@foundryvtt/foundryvtt-cli`, checks the sources are current, compiles them into `packs/macros` (LevelDB) and adds `packs/` to `module.zip`. To build locally: `npm install`, then `node tools/build-packs.mjs compile`.
