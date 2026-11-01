# Wanderer's Toolkit

> Formerly *Wayfarer's Toolkit*. Only the display name changed: the module id (`wayfarers-toolkit`), settings, API and hooks are the same, and your worlds need nothing done.

A free GM kit for [Foundry VTT](https://foundryvtt.com) and the **dnd5e** system. Hex travel with pace and encounter rolls, a flight-master network, a quest log (players read their quests in journals; the full data stays in a GM-only store), a character pane, boss frames, Need / Greed loot rolls, vendor-trash loot, boss loot, a three-coin economy, inns and rest, map pins, zone title cards, a Table Tools section in scene settings, a health report, and migrations that bring older worlds forward.

The module supplies only the logic. Your own campaign content (encounter tables, flight points, quests) stays in your world, and every tool can be switched on or off per world in the [control panel](#control-panel).

What changed in each version: [CHANGELOG](CHANGELOG.md).

## Features

| Tool | What it does |
| --- | --- |
| **Hex Travel** | Enter road and off-road hexes and a pace. Roads are safe; each off-road hex rolls for an encounter on the zone's roll table. Tick *Mounted* to travel faster. Advances world time, logs the trip, whispers encounters to the GM. |
| **Flight Master** | Flies the party between unlocked flight points on the cheapest route. Fares come out of a party group actor's purse (with change). Points, routes and fares are set up in a flight network editor inside the module; a point opens a scene only if you give it one. The GM can also fly the party for free. Players can book flights too (button in the token controls), and an optional sound plays for everyone on departure. |
| **Vendor Trash** | Grey vendor-trash loot, pre-rolled on every NPC token when it's placed and lootable as soon as it dies: a wolf drops fur and fangs, a spider chitin, a bandit trinkets, worn gear and coin. Drops follow the creature's type and name, get better with CR, and follow extra rules you keep in a journal page. With Item Piles, bodies become lootable piles; without it, one click gives the loot to the party. Scenes marked as dungeons drop more. **Sell Vendor Trash** cashes it all in, and **Sell all junk** sells a character's grey items to an Item Piles merchant. |
| **Riding Training** | A riding feat that setup adds to your world. When every party member has it, Hex Travel travels mounted by default. |
| **Character pane** | A classic-MMO-style character frame: the portrait and stats in the middle, equipment slots around it. Slotting an item equips it on the dnd5e sheet; taking it out unequips it. Melee, Ranged and Utility weapon sets with a one-click swap (only the set in hand is equipped), a relic slot for chosen classes, and comparison tooltips against what you have on. Players can use it for their own characters. |
| **Quest log** | Narrative quests ("Deal with the bandit camp", not "collect 15 bandanas") with objectives the GM ticks off, grouped by zone in an MMO-style log (key **L**). Each quest is a journal entry. Chat cards when a quest is given or completed, a Pay rewards button, and an on-screen tracker. |
| **Boss frames** | Mark a token as a boss (crown button in the token HUD). While it's in a running combat, everyone sees a classic-MMO-style frame for it at the top of the screen: portrait, name and health bar. Several bosses stack; defeated ones turn grey. Optional phase marks on the health bar, with a whisper to the GM as each is crossed. |
| **Loot rolls** | Need / Greed / Pass for an item lying in an Item Piles pile or body. Players roll from a chat card with a countdown; the GM's client makes every roll and moves the item to the winner's character. A GM-only loot history keeps every result, with a per-player tally and CSV export. |
| **Boss loot** | Link a roll table of hand-picked drops to a creature. When it dies, the table is drawn (weighted, no repeats) and the items go on its body next to any vendor trash, with a **Start loot roll** button per item on the GM's card. |
| **Flight route map** | The flight network drawn as a map: flight points and the routes between them. Players see the points they've unlocked (locked ones hidden, or greyed and unnamed); the GM drags points to arrange it. Needs Flight Master. |
| **Flight map background** | A picture of your own (from your world's files, for example a map of your continent) behind the flight route map, for everyone who opens it. Fit (inside / fill / stretch), scale, offset and opacity under control panel › Travel › Advanced; drag the flight points onto the picture and **Save layout**. No picture: the map is unchanged. Needs the flight route map. |
| **Travel pace** | Fast, normal or slow (careful) pace for Hex Travel, after the SRD 5.2 travel pace rules: what each pace does to Perception, Survival and Stealth checks shows in Hex Travel and chat. The GM sets the party's pace; players can ask for one. Needs Hex Travel. |
| **Party gold tracker** | GM only, read-only: the coin the player characters and the party actor carry (optionally with their mundane gear), against an editable wealth curve per act or tier × party size, in green, amber or red. |
| **Permission checks** | Part of the health check: the permissions players need for each tool that's on, with a fix for each problem. |
| **Zone title cards** | When a scene is activated, its title fades in over the map in classic-MMO style, with an optional subtitle ("Levels 1–3") and short sound. Per-scene title, subtitle, sound or off switch in the scene configuration. |
| **Rested at the inn** | Mark a scene as an Inn with a room price. Rent rooms for the party (players can ask); their next long rest gives Heroic Inspiration, an extra Hit Die or temporary hit points. |
| **Map pins** | The party's own marks on any scene (the hex travel map, a zone map): an inked, hand-drawn mark (pin, flag, camp, cave, question, cross, skull, star) in one of six inks, with a label, a short note and an optional quest link. Players place and change the party's pins; the GM's own pins can stay hidden until revealed. Stored as ordinary map notes. |
| **Quest objectives find their map pin** | Click a tracked quest's objective (or its title) in the tracker, or an objective in the quest log: the map moves to the quest's map pin and pings it. Needs the quest log and map pins. |
| **Updated quests glow** | A quest the GM changes glows (with an *Updated* tag) in each player's tracker and quest log until they open it. Remembered per computer. |
| **Keyboard shortcuts** | Configure Controls entries to open the character pane and (GM) the control panel, with no keys set. |
| **Coin log** | GM only: every coin movement the toolkit makes, with who, how much (gold, silver, copper), why and when; Undo on the latest. |
| **Split coin** | Share the party actor's coin evenly among its members, after a preview; the odd coins stay with the party. |
| **Rest after renting rooms** | After renting, long-rest everyone who rented in one click and move world time on. |
| **Cost and time before travel** | Hex Travel and flights show cost, time and who pays before going. |
| **Hooks for other modules** | Foundry hooks when quests change and when the party travels (see [Hooks](#hooks)). |
| **Three-coin economy** | Optional: copper, silver and gold only, at 100 to 1. |

## Contents

- [Features](#features) · [Compatibility](#compatibility) · [Optional integrations](#optional-integrations)
- [Install](#install) · [Quick start](#quick-start) · [Setup](#setup)
- [Macro compendium](#macro-compendium) · [Control panel](#control-panel)
- Travel: [Hex Travel](#hex-travel) · [Flight Master](#flight-master) · [Travel pace](#travel-pace) · [Riding Training](#riding-training-and-long-road)
- Loot: [Vendor Trash](#vendor-trash) · [Loot rolls](#loot-rolls) · [Boss loot](#boss-loot) · [Party gold tracker](#party-gold-tracker) · [Three-coin economy](#three-coin-economy-copper-silver-gold)
- Characters and story: [Character pane](#character-pane) · [Quest log](#quest-log) · [Boss frames](#boss-frames)
- Places: [Zone title cards](#zone-title-cards) · [Rested at the inn](#rested-at-the-inn) · [Map pins](#map-pins)
- Housekeeping: [Health check](#health-check) · [Remove toolkit data](#remove-toolkit-data) · [Update notes](#update-notes)
- For scripters: [Macros and scripting](#macros-and-scripting) · [Public API and hooks](#public-api-and-hooks-whats-stable)
- [License](#license) · [Building from source](#building-from-source)

## Compatibility

- **Foundry VTT** v13 and v14 (verified on v14).
- **dnd5e** system 5.0 or later (verified on 6.0.6). The module is built for dnd5e and doesn't run on other systems.

### Look

Since 1.30 every toolkit window, dialog and chat card uses the shared look of the Wanderer's modules (from the bundled wanderers-core library): they follow Foundry's dark or light theme, with one set of item quality colours and coin marks. A few things on the table look the same in both themes on purpose: the character sheet, the on-screen quest tracker and boss frames over the map, and the quest log's list and page.

## Optional integrations

None of these are required; the toolkit works on its own.

- **[Item Piles](https://foundryvtt.com/packages/item-piles)** with **Item Piles: D&D 5e** (`itempilesdnd5e`): Vendor Trash turns defeated creatures into lootable piles, and Loot rolls hand out items from piles. See [Setting up Item Piles](#setting-up-item-piles).
- **Monk's Active Tiles**: tiles can drive quests and the other tools through the module API (`game.modules.get("wayfarers-toolkit").api`). See [Scripting](#scripting).
- **A classic MMO item compendium module** (package id `wow-classic-items`): optional. If it is installed, the toolkit reads its items (grey items for Vendor Trash, tooltip slots and quality colours in the character pane). No items or art from it are bundled.

## Install

In Foundry's setup screen, go to **Add-on Modules → Install Module** and paste this manifest URL:

```
https://github.com/cocoomg11/wayfarers-toolkit/releases/latest/download/module.json
```

## Quick start

From "installed" to your first tool, in about five minutes. You need a world that uses the **dnd5e** system, and you need to be the GM.

1. **Enable it.** Open your world, go to **Game Settings › Manage Modules**, tick **Wanderer's Toolkit** and save. Foundry reloads.
2. **Answer the welcome wizard.** The first time a GM loads the world, a wizard asks for a style (*Minimal*, *Classic MMO* or *Everything*), your party size and your coin system. Pick what fits and click **Finish (reloads Foundry)**. It then offers to **Run setup**: say yes. This makes the tracker journal, the party actor and the macros. (Skipped it? Go to **Game Settings › Configure Settings › Wanderer's Toolkit › Open the control panel**, then use **Run the welcome wizard** or **Run setup** on the Overview tab.)
3. **Check the control panel.** On the **Overview** tab you should see "Everything looks good". If it lists problems, each has a button that fixes it. On the **Features** tab, switch off tools you won't use and click **Save features**.
4. **Grab your macros.** Open the **Macro Directory**, find the *Wanderer's Toolkit* folder and drag the ones you want onto your hotbar. Setup never touches a hotbar by itself.
5. **Try one thing.** The easiest first steps:
   - Press **L** to open the **Quest log**, then click **New quest**.
   - Open a character sheet and click the shirt button in its header for the **Character pane**.
   - Place a few NPC tokens on a scene. Each one rolls its own **Vendor Trash**; reduce one to 0 HP and its body becomes lootable.
6. **Optional extras.** Install **Item Piles** and **Item Piles: D&D 5e** if you want lootable bodies, loot rolls and merchants. See [Setting up Item Piles](#setting-up-item-piles).

<!-- screenshot: control panel Overview tab showing "Everything looks good" -->

## Setup

Enable the module in your world. The first time a GM loads it, the [welcome wizard](#control-panel) offers to pick the tools and run setup. Any time after, open the [control panel](#control-panel) and click **Run setup** on its Overview tab. Setup creates anything missing (tracker journal, party actor, the Riding Training feat, and the macros in a *Wanderer's Toolkit* macro folder) and never overwrites existing documents. It never puts macros on anyone's hotbar and never removes ones already there: drag the macros you want from the *Wanderer's Toolkit* macro folder or the **Wanderer's Toolkit Macros** compendium onto your hotbar.

### Update notes

After the module is updated, the first time the world loads the GMs get one whispered chat card (players never see it): **Wanderer's Toolkit updated: 1.14.4 → 1.17.0**, a short plain list of what's new in the newest version, the versions in between collapsed underneath, and a **To do** list with a button for each thing that still needs doing, plus an **Open the control panel** link. It's posted once, by the active GM, and only when there's something to say: a small patch with no notes and nothing to do posts nothing. The buttons work after a reload, only for GMs, and show as done once done (also when you did it some other way).

What can be on the to-do list:

- **Run setup**, when setup hasn't made everything the tools turned on need. It never touches a hotbar.
- **Import flight network from the old Flight Routes page** (Flight Master, coming from 1.15 or earlier), while the flight network is empty and the old page has flight points. It asks first and doesn't change the page.

Things for a tool that's switched off aren't listed. New worlds get no card (the welcome wizard covers them). The world remembers the last version it ran in a hidden setting; worlds updated from before 1.17 are recognised from the old setup reminder's record. Switch the card off with **Show update notes after updating** on the control panel's Overview tab; **Show update notes** there (or `api.updateNotes.show()`, or `api.updateNotes.show("1.15.0")` for everything since 1.15.0) posts it again. This card replaces the setup reminder of earlier versions.

### Health check

**Health check** (the control panel's Overview tab sums it up; **Full health report**, the **Toolkit Health Check** macro or `api.health()` post it) whispers the GM a report with fine / warning / problem lines. It changes nothing. Since 1.30, when the [Wanderer's Satchel](https://github.com/cocoomg11/wanderers-satchel) hub module is active the chat card is one line (how many checks are fine, warnings and problems) with an **Open in Wanderer's Satchel** button that shows the full report there; without it the card lists every line as before. `api.health({ window: true })` opens the full report in a window. It covers:

- which features are on;
- dependencies: Item Piles and Item Piles: D&D 5e, the vendor-trash compendiums, and whether the coins match the Coin system setting (and Item Piles' currencies in three-coin mode);
- setup: each macro, the tracker journal and pages, the party actor, the Vendor Trash Rules page and the riding feat, for the features turned on, with a **Run setup** button when something's missing;
- boss loot: the party size and what it does to boss loot, every actor and token with a table linked, whether the table exists, how many results resolve to items, the draws and coin adjusted for the party size, and whether there are more draws than usable results. Links that would fall back to vendor trash are flagged. Creatures with a table named for them but not linked get a **Link boss tables by name** button;
- how many actors and tokens are marked **No loot**;
- problems on the Vendor Trash Rules page, scenes marked Dungeon, the flight network's size, flight points with no scene (⚠, information only: flying there still works) or a deleted scene, routes into locked points, routes naming a point that doesn't exist (✗), and an old Flight Routes journal page waiting to be imported;
- encounter zones whose roll table doesn't exist (or a stored value an earlier version couldn't read);
- the route map, travel pace, party gold and settings export / import (1.20), when they're on;
- **Permissions** (always, since 1.27): for each tool that's on, what players need, each line ✓ / ⚠ / ✗ with a fix: the module socket (player flights, loot roll choices, pace requests, quest notices), a character each player owns (loot rolls, the character pane, looting bodies, Sell all junk), the *Use Script Macros* permission and Observer on the shared macros (Flight Master, Quest Log, Travel Pace, Flight Route Map), Observer on the party actor (players see the purse their flights use), quest journals players should be able to read, and Item Piles for lootable bodies;
- whether update notes are on, and the last version this world ran;
- the active GM and how many GMs are online.

### Remove toolkit data

**Remove toolkit data** (a button on the control panel's Overview tab, GM only; also `api.cleanup.open()`) cleans the toolkit out of a world, for example before uninstalling it. The window first counts what it would remove, with a checkbox per kind:

- toolkit flags (`flags.wayfarers-toolkit`) on actors (with the *Rested* status icon, if Rent rooms added one), on tokens on every scene, on scenes (Dungeon, Title card, inns, and the old Hub and Inn marks), on items (world items and items on actors), and on journals, journal pages and roll tables (flags only: the documents stay; quest journals stop being quests), plus Hex Travel's trip counter on the tracker journal; with *Delete the GM-only records journal* ticked (off by default), the journal entry *Wanderer's Toolkit (GM only)* (the full flight network, hidden map pins, quest GM text, room rentals, gold snapshots and loot history);
- optionally, toolkit flags on **chat messages** (loot, loot roll, quest, health and update cards; the cards stay but their buttons stop working);
- optionally, **map pins** (the map notes placed with the Map pin tool, on every scene, party and GM pins alike: they're deleted);
- optionally, **items created by the toolkit** (vendor trash and boss loot items, wherever they are: on bodies, the party actor or characters);
- optionally, the **world macros Run setup made** (macros carrying the toolkit's macro flag);
- optionally, **reset the module's settings** to their defaults (feature toggles included; Foundry offers to reload).

Type **REMOVE** and click **Remove** (or **Cancel** to close without changes). Nothing else is touched: your own documents, other modules' flags and items the toolkit didn't create stay. Item Piles piles stay piles (use Reset loot on them first if you want normal tokens back). What was removed is shown in a notification and whispered to the GMs. It doesn't need to be the active GM. From a macro: `api.cleanup.plan()` counts, `api.cleanup.remove({ actors: true, tokens: true, pins: true, … })` removes.

### Debug logging

**Debug logging** (control panel › Loot › Advanced, off by default) writes the toolkit's automatic decisions to the browser console (F12): why a body got no loot, which GM's client ran an automatic step, the creature kind, CR band and items rolled, boss loot draws, and how each loot roll was settled. With it off nothing is logged.

### Several GMs

A world can have more than one GM logged in. Everything the toolkit does on its own (pre-rolling trash when a token is placed, making bodies lootable, drawing boss loot, settling loot rolls, carrying out players' flights, warnings about the rules page, coin conversion and the update notes) runs only on the **active GM**'s client: Foundry's active GM, or the connected GM with the lowest user id. Buttons and macros still run for whichever GM clicks them.

The same GM can also be logged in more than once (two browser tabs, or a laptop and a desktop). The GM's clients find each other over the module's socket and only one of them acts: the one opened first. A lone tab acts by itself a moment after the world loads; closing the acting tab hands over to another within a couple of seconds (or a few seconds if that tab crashed or lost its connection). Players' requests (rooms, rests, travel pace, flights, loot choices) also carry an id, so a request that arrives twice is handled once. The health check says when you're logged in on several clients and which one acts.

## Macro compendium

The module ships a **Wanderer's Toolkit Macros** compendium (in a *Wanderer's Toolkit* compendium folder) with every macro Run setup makes: Hex Travel, Flight Master, Flight Route Map and Travel Pace (*Travel*), Quest Log (*Sessions and Quests*), Rent Rooms (*Places*), Vendor Trash, Preview Vendor Trash and Sell Vendor Trash (*Vendor Trash*), Preview Boss Loot (*Boss Loot*), Loot History (*Loot Rolls*), and Party Gold and Toolkit Health Check (*Toolkit*). Each is made only while its tool is on. Open it from the **Compendium Packs** sidebar and drag a macro onto your hotbar; Foundry imports a copy into your world. **Run setup** also creates world copies in a *Wanderer's Toolkit* macro folder (Macro Directory). Setup doesn't touch any hotbar, so drag the macros you want from that folder or from the compendium onto your hotbar.

Players can see the compendium (Observer), so they can drag out **Flight Master** and **Quest Log** themselves. The other macros are GM tools: a player who runs one gets a "GM only" warning and nothing happens. A compendium can't hide entries per world, so macros for tools you've switched off in the control panel are still listed; running one only shows the "turned off" warning. Each macro is a one-line call into the module API, so the compendium copies never go stale between versions.

## Control panel

<!-- screenshot (1.30): the control panel on the shared look, dark and light theme -->

All of the toolkit's settings live in one window. Open **Game Settings → Configure Settings → Wanderer's Toolkit → Open the control panel** (GM only), or run `game.modules.get("wayfarers-toolkit").api.panel()`. The only other entry in the module's settings list is **Show the quest tracker on my screen**, which each player sets for themselves.

The panel has eight tabs in a sidebar on the left (arrow keys, Home and End move between them). Each settings tab shows the few settings most GMs change first; everything else is in a collapsed **Advanced** section at the bottom. Each tab has a **?** link to its section of this README and a **Reset this tab to defaults** button (asks first; the Features tab has none). Change what you like on any tabs, then click **Save changes**.

**A quick walkthrough for a new world**

1. The first time a GM opens a new world with the toolkit, the **welcome wizard** asks three things: a style (which tools to switch on), the party size, and the coin system. Finish it and it offers to **Run setup**. Skip it if you'd rather set things up yourself; it won't come back on its own (rerun it from the Overview tab).
2. Open the control panel. **Overview** says "Everything looks good" or lists what needs attention, each with a button that fixes it.
3. On **Features**, switch off anything you won't use and click **Save features** (Foundry reloads).
4. Go through **Travel**, **Loot**, **Boss & Combat** and **Quests**, change what you need and click **Save changes**.

<!-- screenshot: the control panel Features tab with the tool switches -->

The settings kept their keys from earlier versions, so anything you set before is still set, and macros and the API work as before.

### Overview tab

A plain-language health summary built from the [health check](#health-check): "Everything looks good", or "N things need attention" with one line per problem and, where there's a quick fix, a button: **Run setup** for anything setup hasn't made yet, **Link boss tables by name** for creatures with an unlinked table, a jump to the Travel tab for encounter zones or the Loot tab for compendiums, opening the flight network editor (or **Import from the Flight Routes journal page** when that's waiting), or opening the Vendor Trash Rules page. Below it: **Run setup**, **Full health report (to chat)** (the full ✓ / ⚠ / ✗ card), **Check again**, **Run the welcome wizard**, **Show update notes** and **Remove toolkit data…**, and the **Show update notes after updating** switch (saved as soon as you flip it; see [Update notes](#update-notes)).

### Features tab

One card per tool, with a switch: Hex Travel, Flight Master, Vendor Trash, Riding Training, Character pane, Quest log, Quest tracker, Boss frames, Boss loot, Loot rolls, Flight route map, Travel pace, Party gold tracker, Zone title cards, Rested at the inn, Map pins and the Three-coin economy. All tools are on by default (the coins start on standard 5e). **Save features (reloads Foundry for everyone)** applies them.

A tool that's switched off adds nothing: no buttons, macros, key bindings, chat buttons, hooks or sheet changes (the character pane's armour-class adjustment included). Its settings stay in the other tabs, greyed out with a note, so you can see them. **Run setup** skips its macros and items. Nothing already in your world is deleted, so switching a tool back on picks up where it left off. Calling a switched-off tool from a macro just shows a warning.

### Travel tab

| | Settings |
| --- | --- |
| **Basics** | **Encounter zones** (a table: zone name and the roll table its encounters come from, with **Add zone** and a remove button per row; problems such as a missing name, a zone listed twice or a table that doesn't exist show under the table), **Players can book flights**, **Fares without a coin are in** (gold, silver or copper), the **Flight network…** button (the [flight network editor](#the-flight-network-editor)) |
| **Advanced** | **Announce new flight points** (on), **Flights advance world time** (off), **Locked flight points on players' map** (hidden or greyed), **Zoom and pan the route map** (on), **Players can ask for a travel pace** (on), encounter die, off-road time multiplier, mounted speed multiplier, slow / normal / fast pace, departure sound and its volume, riding feat name, tracker journal and party actor (pick from your journals and group actors, or type a name) |

With the route map and travel pace on, the tab also has **Flight route map…** and **Travel pace…** buttons.


### Loot tab

| | Settings |
| --- | --- |
| **Basics** | **Roll loot when creatures are placed**, **Bodies can be looted when they die**, **Items you give a creature count as loot**, **Party size** (1–8, see [Boss loot](#boss-loot)), **Seconds to choose Need / Greed / Pass**; and a **Loot history…** button (see [Loot history](#loot-history)) |
| **Advanced** | **Party is in act / tier**, **Wealth curve (gold per character)**, **Count mundane gear in party wealth** (off) (see [Party gold tracker](#party-gold-tracker)), **Keep a loot roll history** (on), **Sell all junk button** (on; see [Sell all junk](#sell-all-junk-at-a-merchant)), unconscious creatures can be looted, loot stays on the body (Item Piles), the three dungeon settings, **Where junk loot comes from** (tick item compendiums by name), keep Item Piles' coins in step (three-coin economy), [debug logging](#debug-logging) |

### Boss & Combat tab

| | Settings |
| --- | --- |
| **Basics** | **Boss health players see** (bar only, bar and percentage, exact HP), **Show phase marks to players** (off; see [Phase marks](#phase-marks)), **Boss loot drops on death**, **Creatures with boss loot get a boss frame**; and a **Link boss tables by name** button |
| **Advanced** | Extra boss drop for parties over 4 |

### Character tab

| | Settings |
| --- | --- |
| **Basics** | **Weapon sets** (on by default), **Weapon swap cost** (Free, Part of an attack, Object interaction, Bonus action, Action; default Part of an attack), **Classes with a relic slot** (a checklist of the classes in your world; Paladin, Druid and Cleric to start with), **Item comparison tooltips** (on; see [Item comparison](#item-comparison)) |

Greyed out while the character pane is switched off. See [Weapon sets](#weapon-sets).

### Places tab

| | Settings |
| --- | --- |
| **Basics** | **Title cards show** (when a scene is activated, or every time a scene is viewed), **Title cards are seen by** (everyone, or players only), **Room price per person per night** (5s by default), **Rested gives** (Heroic Inspiration by default); and **Preview title card** and **Rent rooms…** buttons |
| **Advanced** | Every scene gets a title card (on), seconds on screen, title card style, default title card sound and volume, show a card when the world loads (off), rooms are paid from (party actor), Rested lasts until the next long rest anywhere (on), Rested icon on tokens (off), players can ask for rooms (on), players can place map pins (on), players can change any party pin (on), fade pins of finished quests (on), pin size (40), parchment behind pins (on), show map notes when a scene has pins (on) |

See [Zone title cards](#zone-title-cards) and [Rested at the inn](#rested-at-the-inn). Per-scene options (title card, Dungeon, inns) are in each scene's configuration, **Table Tools** tab.

### Quests tab

| | Settings |
| --- | --- |
| **Basics** | **Show the quest tracker on my screen** (just for you), **Parties**, **Announce objectives in chat**, sounds when a quest is given and completed |
| **Advanced** | Quest cap, quest sound volume, quest folder |

## Hex Travel

**How to use:** run the **Hex Travel** macro (GM only), or `api.hexTravel()`. You need at least one encounter zone first: **control panel › Travel › Encounter zones**, with **Add zone** (a zone name and the roll table its encounters come from).

The window asks for the **Zone**, the number of **Road hexes** and **Off-road hexes**, the **Pace** and whether the party is **Mounted**, then you click **Travel**. One hex is one mile.

- Roads are safe. Each off-road hex takes longer (*Off-road hexes take*, 2 times by default) and rolls the *Encounter die*: a 1 is an encounter, drawn from the zone's roll table.
- Mounted travel multiplies the speed (*Riding speeds travel up by*). With [Riding Training](#riding-training-and-long-road), the *Mounted* box starts ticked only when every party member has the feat.
- The trip advances world time, is written to the **Travel Log** page of the tracker journal, whispers the trip and any encounters to the GM, and posts a short line to chat.
- Choosing "Other (no encounter table)" as the zone still moves time; any encounter roll just says "no table for this zone".
- Speeds come from the *Slow / Normal / Fast pace* settings (Travel › Advanced). With [Travel pace](#travel-pace) on, the pace is the party's pace.

## Flight Master

**How to use:** click the feather button in the token controls (or run the **Flight Master** macro), pick From, To and the number of passengers, then click **Check route**. Set up your flight points and routes first, in **control panel › Travel › Flight network…**.

Flight Master flies the party between **flight points** along **routes** you set up in the module itself. Nothing is read from a journal page, and a flight point opens a scene only if you pick one for it.

### The flight network editor

Open **control panel › Travel › Flight network…** (or `api.flight.editor()`). It has two tables and **Save** / **Cancel**; nothing changes until you save.

- **Flight points:** a name (for example *Harbor Town*), the **scene on arrival** (a dropdown of your scenes, or *No scene*), an **Unlocked** switch, an optional GM note, and a remove button. **Add flight point** adds a row. Only unlocked points can be flown from or to.
- **Routes:** **From** and **To** (dropdowns of your flight points), the **fare** per passenger, the flight **hours**, a **Two-way** switch (off: the route only flies From → To) and a **Free** switch (nobody pays for this route, players included). Type fares with coins, like `2s`, `1g 20s` or `75c`; a plain number such as `2` is read in *Fares without a coin are in* (control panel › Travel, gold by default). The fare is shown back formatted when you leave the field.

Problems show under the tables as you type, and the rows are outlined: a point with no name or the same name as another, a route from a point to itself, a route naming a point that no longer exists, or a fare that can't be read stop **Save**; a route listed twice is only a warning (the cheaper one is flown). Removing a flight point asks first and removes its routes too.

Flight Master always takes the cheapest way through unlocked points, so the party can fly *Harbor Town → Hill Fort → River Camp* in one booking if each leg is a route.

<!-- screenshot: the flight network editor with a few points and routes -->

### Flying

Open Flight Master from the feather button in the token controls or the **Flight Master** macro. Pick From, To and the number of passengers, then **Check route**: before anyone confirms, the window shows the route, the fare per passenger × passengers = total, the party purse and the flight time. Confirming charges the fare from the party group actor's purse (with change), plays the departure sound, advances the world time by the flight's hours if *Flights advance world time* is on (off by default from 1.20), writes the trip to the Travel Log and posts "The party flies from … The party lands at *Harbor Town*." to chat.

- **A point with a scene:** that scene is activated on arrival (the GM can untick *Open destination scene for players*). If it can't be opened, the fare is refunded and the flight is called off.
- **A point with no scene** (or a scene that has been deleted): the flight still happens, the fare is charged, time passes and the trip is logged, but the scene stays where it is. The GM gets a whisper saying the party landed there and may need moving.

A flight is refused, with nothing charged, when the party can't afford it ("needs X, has Y (short Z)"), when a point isn't in the network or isn't unlocked, or when no route connects the two points.

**Free flight (GM).** The GM's Flight Master window has a **Free flight (no fare)** checkbox (off by default). A free flight skips the purse check and charges nothing; everything else happens as usual and the chat card and Travel Log say "free flight". From a macro: `api.flight.fly("Harbor Town", "Hill Fort", { free: true })`. Players never see the checkbox, and the GM's client ignores a "free" request in a player's booking: players always pay unless the route itself is marked **Free**.

**Players and Flight Master.** With *Players can book flights* on (the default, control panel › Travel), players get the feather button in the token controls and can drag the **Flight Master** macro onto their own hotbar from the *Wanderer's Toolkit Macros* compendium (or the shared world copy in the macro folder). Players read the unlocked flight points and routes from the module's world setting (they never see your notes or a journal). A player picks a route and confirms; the active GM's client checks everything again (purse, points, routes), charges the fare and carries the flight out, and the player is told how it went. A GM must be connected ("A GM needs to be connected to fly.").

### Upgrading from 1.15 or earlier: the Flight Routes journal page

Earlier versions kept the network in two tables on the tracker journal's **Flight Routes** page. While the flight network is empty and that page has flight points, the editor and the Overview tab offer **Import from the Flight Routes journal page** (or `api.flight.importLegacy({ dryRun: true })` to see what would come in). It asks first and lists anything worth a look:

- each point's scene is matched by its exact scene name; a name with no match (or more than one scene with that name) imports as *No scene*, to pick in the editor;
- fares are read exactly as before (coins, or plain numbers in the fare unit);
- every route imports as **Two-way**, because the old tables always flew both ways;
- rows naming an unknown point, or a point to itself, are skipped and listed.

The import never edits or deletes the page and never runs on its own. Once the flight network has flight points the page is ignored, and you may delete it.

### Scripting

`api.flight()` opens Flight Master. `api.flight.network()` returns the network (`{ version, points: [{ id, name, sceneUuid, unlocked, note }], routes: [{ id, from, to, fareCp, hours, twoWay, free }] }`; `from` / `to` are point ids and `fareCp` is in the smallest coin in use). GM only: `api.flight.setNetwork(obj)` replaces it (points may be named by name in routes; a network with errors is refused), `api.flight.unlock("Hill Fort")` unlocks a point by name or id (`unlock(name, false)` locks it), `api.flight.fly(from, to, { pax, free, scene })` flies now without the window, `api.flight.importLegacy({ dryRun })` and `api.flight.editor()`.

### Route map

With **Flight route map** on (Features tab), the token controls get a map button next to the feather (for players too), and there's a **Flight Route Map** macro and **control panel › Travel › Flight route map…**. The map draws each flight point as a dot and each route as a line (dotted for free routes, an arrow for one-way ones); hover a line for its hours and fare. A ring marks the point for the scene you're on.

- **Players** see the unlocked points and the routes between them. *Locked flight points on players' map* (Travel › Advanced) decides the rest: **Hidden** (default) leaves locked points off the map; **Greyed out, unnamed** shows them as *Unknown*, greyed, with their routes dashed and no fare or hours.
- **The GM** sees every point (locked ones marked) and can drag points around; **Save layout** stores the positions in the flight network (each point's `pos`, 0 to 1), so players see the same map. **Arrange in a circle** spreads every point evenly. Points never placed are laid out on a circle.
- **Zoom and pan** (everyone; *Zoom and pan the route map*, Travel › Advanced, on): the mouse wheel zooms around the cursor (half size to four times) and dragging the empty map moves it; **Reset view** goes back. The GM can still drag points at any zoom, and **Save layout** stores the same 0-to-1 positions. Only that window's view changes; nothing is saved, and the background picture zooms with the points.

### Discoveries and time

- **Discovered!** When a GM unlocks a flight point (the editor's Unlocked switch, then Save, or `api.flight.unlock(name)`), chat says "Discovered! New flight point: *name*." for everyone. Switch it off with *Announce new flight points* (Travel › Advanced). The first save of a new network and the import from the old journal page announce nothing.
- **Flights advance world time** (Travel › Advanced, **off** by default): on arrival, world time moves on by the flight's hours with Foundry's own `game.time.advance`, so a calendar module that follows world time follows the flight. Before 1.20 every flight did this; the 1.20 update notes card has a **Keep flights advancing world time** button for worlds that want to keep it.

**Flight sound.** A short bundled departure clip (`sounds/be-good.ogg`) plays for everyone when a flight departs. Pick a different file in *Departure sound* (control panel › Travel › Advanced), or clear it for silence.

## Vendor Trash

**How to use:** just place NPC tokens; each rolls its own loot. When one dies, its body becomes lootable. To cash in, run **Sell Vendor Trash**, or click **Sell all junk** on an Item Piles merchant.

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
| **Roll loot when creatures are placed** | on | Pre-rolls the drop of every unlinked NPC token as it's placed. Off: the drop is rolled when the body is looted. |
| **Bodies can be looted when they die** | on | At 0 HP or when marked defeated, the body becomes an Item Piles pile (or, without Item Piles, the GM gets the Give to Party card). Off: run the Vendor Trash macro yourself. |
| **Items you give a creature count as loot** | on | A weapon, armour, consumable, tool, loot item or container a GM adds to an NPC is marked *Lootable* and shows in its body's pile. See [Adding your own loot](#adding-your-own-loot). |
| **Unconscious creatures can be looted** | off | The Unconscious condition also makes an unlinked NPC's body lootable, as if it had died. No loot and one-loot-per-body still apply. |

All of these are on the control panel's **Loot** tab (greyed out while Vendor Trash is switched off). The rolling and looting happen on the active GM's client, so a GM has to be logged in.

**Several deaths at once.** When several bodies become lootable within about a second and a half of each other (an area spell), the GM gets **one** summary card instead of one per creature: a Vendor Trash section and a Boss loot section, a line per creature and the totals. The Give to Party and per-item **Start loot roll** buttons are on it as usual.

### Sell all junk at a merchant

With Item Piles, a merchant window opened for a character (a player's own, or the GM's) gets a **Sell all junk** button in its title bar. It lists every grey item the character carries (anything Vendor Trash dropped, items whose MMO-style tooltip is grey, and items of *poor* rarity) with the price the merchant pays and the total, and sells them all when you confirm. The sale goes through Item Piles' own trade, so the merchant's buy and sell price modifiers, its coin and the [three-coin economy](#three-coin-economy-copper-silver-gold) all apply, and the coin lands on the character.

Never sold: equipped items, items marked as favourites on the dnd5e sheet, items in any of the character's [weapon sets](#weapon-sets), containers, and anything the merchant would pay nothing for. The confirm says which junk was kept back and why. If the merchant won't buy one of the items, the rest are still sold, one by one, and you're told which wasn't. Merchants set to *purchase only* get no button. A GM has to be connected (Item Piles carries out trades on a GM's client).

Switch it off with **Sell all junk button** (control panel › Loot › Advanced). From a macro: `api.sellJunk(character, merchantActorOrToken)`.

### With Item Piles: loot the bodies

When the [Item Piles](https://foundryvtt.com/packages/item-piles) module is active (and *Loot stays on the body (Item Piles)* is on, the default), Vendor Trash puts each creature's drop and coin on that creature and turns its token into an Item Pile. The token keeps its image and name. Players double-click the body (standing next to it) to open it and take the items and coin, which go onto their own character. The GM gets a short summary card. A creature that dropped nothing is left as it is.

- **Only the loot shows.** The creature's own weapons, armor and features stay on it but are hidden from the pile, so players see just the trash, coin and anything you [marked as loot](#adding-your-own-loot).
- **The world actor isn't touched** for ordinary unlinked tokens: the loot goes onto the token's own copy of the actor. (If an NPC's token is linked to its actor, the loot goes onto that actor.)
- **Empty bodies** stay on the map unless you turn on Item Piles' *Delete empty piles* setting. To make a body a normal token again, run `game.itempiles.API.revertTokensFromItemPiles(token)` (or turn the pile off in its Item Piles configuration).

#### Setting up Item Piles

1. Install and enable **Item Piles** and its system add-on: for dnd5e that's **Item Piles: D&D 5e** (`itempilesdnd5e`). Item Piles 3 has no system settings of its own; without the add-on it doesn't know item quantities or coins, and Vendor Trash falls back to the Give to Party card with a warning.
2. Reload. Item Piles applies the dnd5e settings the first time it sees the add-on.
3. **Three-coin economy:** the dnd5e add-on sets up five coins at 10 to 1. With the three-coin economy on and *Keep Item Piles' coins in step* on (the default, control panel › Loot › Advanced), this module replaces them each time the world loads with copper (×0.0001), silver (×0.01) and gold (primary), in that order, and whispers the GM when it changes them. To do it by hand instead, turn that setting off and in **Item Piles → Module Settings → System → Currencies** keep three attribute currencies, in this order: `system.currency.cp` (0.0001), `system.currency.sp` (0.01) and `system.currency.gp` (exchange rate 1, primary), and delete platinum and electrum.

### Without Item Piles: Give to Party

The GM gets a loot card listing each creature's drop and its vendor value. Click **Give to Party** on the card: items go into the party actor's inventory and coin into its purse. This is also what happens when *Loot stays on the body (Item Piles)* is off.

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

**Where the items come from.** The tool reads an item compendium; it ships no items. With the optional classic MMO item module installed (see [Optional integrations](#optional-integrations)), it uses that compendium's grey-quality items, their item levels and their vendor sell prices, which is what you want with the three-coin economy. To use other items, tick compendiums in **Where junk loot comes from** (control panel › Loot › Advanced); in those, loot-type items with no rarity count as trash.

### Adding your own loot

Any item can be loot, not just vendor trash: a key, a letter, the bandit captain's sword.

- **Drag it onto the NPC.** With *Items you give a creature count as loot* on (the default), an item a GM adds to an NPC actor or an unlinked token's sheet is marked **Lootable** and shows in the pile when the body becomes lootable, next to its trash and coin. The items that came with the stat block (imported or created with the actor) are never marked, so the creature's own gear stays hidden as before.
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

Mark a scene as a dungeon to make its creatures richer: open the scene's configuration and tick **Dungeon** on the **Table Tools** tab (*Wanderer's Toolkit* section) (it's stored as the scene flag `flags.wayfarers-toolkit.dungeon`). Creatures looted on that scene then get:

| Setting | Default | Effect |
| --- | --- | --- |
| **Dungeon coin multiplier** | 2 | Coin a creature drops is multiplied by this. |
| **Dungeon drop bonus (%)** | 25 | Percentage points added to every item-drop chance (a 70% body part becomes 95%), never above 100%. |
| **Dungeons roll items twice** | on | The creature's item drops are rolled a second time (coin is not). |

The dungeon bonus comes on top of the creature's CR band. The trash pool is grey items only by design, so instead of raising item quality the dungeon bonus gives an extra roll. A pre-rolled token gets the bonus of the scene it was placed on. Whether coin drops at all is unchanged; only the amount goes up. Scenes not marked as dungeons drop exactly as before. The GM's Vendor Trash card shows a small **Dungeon** tag when the bonus applied. The checkbox and settings belong to Vendor Trash and disappear when it's turned off.

## Travel pace

**How to use:** run the **Travel Pace** macro (or **control panel › Travel › Travel pace…**) to set the party's pace. Players open the same window to ask for one.

With **Travel pace** on (it needs Hex Travel), the party has a pace: **fast**, **normal** or **slow (careful)**. The effects follow the SRD 5.2 travel pace rules, in the module's words:

| Pace | Distance (SRD) | While travelling |
| --- | --- | --- |
| Fast | 4 miles an hour, 30 a day | Disadvantage on Perception, Survival and Stealth checks |
| Normal | 3 miles an hour, 24 a day | Disadvantage on Stealth checks |
| Slow (careful) | 2 miles an hour, 18 a day | Advantage on Perception and Survival checks |

Hex Travel's speed still comes from the *Slow / Normal / Fast pace* settings (Travel › Advanced), so a world that changed them keeps its numbers. Nothing is rolled or enforced: the effect is named in Hex Travel's pace list, in the GM's trip summary and in the chat line, for you to apply.

- **The GM** sets the pace in the **Travel Pace** window (the **Travel Pace** macro, *control panel › Travel › Travel pace…* or `api.travelPace()`), which posts "The party travels at … pace" with its effect. Picking another pace in Hex Travel sets it too.
- **Players** open the same window (the macro is shared with them) and **Ask the GM**: the GMs get a whisper with a **Set … pace** button. With *Players can ask for a travel pace* off, players just see the current pace.

Without Travel pace, Hex Travel's pace list is as before. There's no hex trail.

## Zone title cards

**How to use:** open a scene's configuration, find *Title card* on the **Table Tools** tab, give it a title and subtitle, and activate the scene. **Preview title card** (control panel › Places) shows one on your screen only.

With **Zone title cards** on, activating a scene shows its title over the map on every screen viewing it: large gold serif lettering in the upper third, a thin ornament line and an optional subtitle. It fades in, holds (*Seconds on screen*, 4 by default) and fades out, over the canvas without moving anything; with the browser's *reduce motion* preference it appears and disappears without fading.

- **Per scene** (Scene configuration › Table Tools › *Title card*): **Show a title card**, **Title** (blank: the scene's navigation name, or its name if that is empty), **Subtitle**, **Sound** (blank: the default sound, if any). The module bundles no audio: pick your own short clip.
- **When** (*Title cards show*): when a scene is activated (default), or also every time someone's view moves to a scene (a player pulled to another scene, a GM looking around).
- **World load**: the scene that's already active when someone joins shows no card, unless **Show a card when the world loads** is on.
- **Who**: everyone (default) or players only. **Every scene gets a title card** off means only scenes you tick show one.
- **Preview title card** (Places tab) shows the current scene's card on your screen only. Macros: `api.zoneTitles.show(scene)` or `api.zoneTitles.show({ title, subtitle, sound })` on the client running it.

## Rested at the inn

**How to use:** open a scene's configuration, **Table Tools** tab › *Inns* › **Add inn**, or right-click an innkeeper's token and click the mug button (**Make innkeeper here…**). Then rent from that token's bed button, **Rent rooms…** (control panel › Places) or the **Rent Rooms** macro.

**Inns** (since 1.27) are records on their scene, several per scene if you like. Each has a **name** (blank: the scene's name), a **room price** per person per night (like `5s` or `1g 20s`; blank: *Room price per person per night* on the Places tab, 5 silver to start; a plain number is read in *Fares without a coin are in*), an optional **innkeeper** (a token on the scene; its HUD gets a *Rent rooms* button) and, on v14 scenes with regions, an optional **Region** (a long rest counts as at the inn when the character's token is inside it). Stored as `flags.wayfarers-toolkit.inns = { v: 1, list: [{ id, name, price, innkeeper: { actor, token } | null, region | null }] }` (at most 20 per scene). Prices follow your coin system: 5s is 50 copper with standard coins and 500 with three coins.

**Renting rooms** (GM): the innkeeper's HUD button, **Rent rooms…** on the Places tab, the **Rent Rooms** macro or `api.rentRooms({ scene, inn, actors })`. With several inns on a scene you pick one. The dialog lists the party's player characters (the party actor's members, or player-owned characters with a token on the scene) with a tick each, the price per person and the total. Payment comes from the party actor's coin (default) or each character's own (*Rooms are paid from*), smallest coins first with change, as flight fares are. If there isn't enough, nothing is charged and the dialog says who's short. On a scene with no inn you're asked first.

The chosen characters become **Rested**: the GM's client records each rental in the toolkit's GM-only records, and the character gets `flags.wayfarers-toolkit.rested = { scene, inn, at }` for display (*zzz* by their name in the character pane, and optionally a *Rested* status icon on their token). Chat says "The party takes rooms at *inn*. Rested."

**The next long rest** (dnd5e's `dnd5e.restCompleted` hook) of a Rested character gives **Rested gives**: Heroic Inspiration (default; nothing if they already have it), one extra Hit Die back (their largest spent die), or temporary hit points equal to their character level (if more than they have). It's checked against the GM's rental record, not the character's flag, so a player can't make their own character Rested. Then Rested clears and a chat line says what they got. A long rest away from an inn still counts while **Rested lasts until the next long rest anywhere** is on (default); off, Rested is lost with no benefit. A player's own long rest is sent to the acting GM client, which applies it; with no GM connected, Rested waits for the next long rest.

**Rest after renting** (feature *Rest after renting rooms*, 1.28): when the rooms are paid, the GM is offered **Long rest everyone**, which runs dnd5e's long rest for each character who rented (no rest dialog, with dnd5e's chat card, so Rested is granted as usual) and, ticked by default, moves world time on once by **Hours the inn rest moves time on** (Places › Advanced, default 8; 0 never). dnd5e's own time advance is turned off for these rests, so time moves once, not per character. Flights still never move time unless *Flights advance world time* is on.

**Players can ask for rooms**: on a scene with an inn a player's Rent Rooms macro whispers the GMs a request with a **Rent rooms…** button. The GM still picks who and confirms.

**Upgrading from 1.26**: a scene marked *Inn* becomes one inn record with the same name and price the first time the GM loads 1.27 (the old setting stays on the scene, unused). Characters already Rested keep it.

## Map pins

**How to use:** click the **Map pin** button (the pin icon in the token controls), then click the map. An empty spot opens the new-pin dialog; a pin opens its card. Double-clicking a pin opens its card too. **Esc** cancels.

<!-- Screenshot placeholder: a hex travel map with three inked pins (camp, cave, question) and an open pin card. -->

With **Map pins** on, the party can mark up any scene, the way you'd pencil notes onto a paper map: no glowing markers, just ink on parchment.

**A pin** has a **label** (shown under it on the map), a short **note** (up to 500 characters), a **mark** (pin, flag, camp, cave, question, cross, skull or star: the module's own hand-drawn art), an **ink** (iron-gall black, sepia, red ochre, indigo, verdigris or oak-gall violet) and, with the quest log on, an optional **quest** link. A small parchment disc sits behind each mark so it reads on dark maps (*Parchment behind pins*).

**Who does what**

| | Players | GM |
| --- | --- | --- |
| Party pins | see all of them; place, change, move and delete them (*Players can place map pins*; with *Players can change any party pin* off, only their own) | everything |
| GM pins | see them, unless hidden; can't change them | place, change, move, delete; **Hide** / **Reveal** |

Placing a pin as GM, choose **Whose pin** (the party's or the GM's) and, for a GM pin, **Hidden from players**. A hidden pin is faint on your map, isn't drawn for players at all, and its map note carries no label until you **Reveal** it (from its card).

**Players don't need any permission.** A player's new pin, change, move or delete goes over the module socket to the acting GM's client, which checks it again and saves it. With no GM logged in nothing is saved and the player is told so. Players never touch the map notes directly, so core's *Create map notes* permission doesn't matter.

**The pin card** shows the label, note, who placed it and the linked quest, with an **Open quest** button. A linked quest only shows (and only opens) if that user can see it in the quest log: a player never learns about a hidden or not-yet-given quest from a pin, and can't link one. When the linked quest is completed or failed, the pin fades (*Fade pins of finished quests*, on).

**Seeing pins:** pins are Foundry map notes, so they show on every layer while map notes are switched on (Journal Notes controls › *Toggle notes*), and always while the Journal Notes layer is open. With *Show map notes when a scene has pins* on (default), the toolkit switches that on once in each browser the first time it shows a scene with pins; if someone turns it off again, it stays off. On scenes with levels, a pin is placed on the level being viewed.

**Settings** (control panel › Places › Advanced): *Players can place map pins* (on), *Players can change any party pin* (on), *Fade pins of finished quests* (on), *Pin size* (40 px, 32–96), *Parchment behind pins* (on; reloads), *Show map notes when a scene has pins* (on).

**Data:** each pin is a core Note on its scene with `flags.wayfarers-toolkit.pin = { v: 1, kind: "party" | "gm", hidden, label, text, icon, ink, quest, by }` (`by`: the user who placed it). Up to 300 pins per scene can come from players. *Remove toolkit data* › *Delete map pins* removes them all.

**Scripting:** `api.pins.place()` arms the click; `api.pins.create({ label, text, icon, ink, quest, kind, hidden }, { scene, x, y })`, `update(note, input)`, `move(note, { x, y })`, `remove(note)`, `reveal(note, hidden)` (GM), `open(note)`, `list(scene)` (pins this user can see: `{ id, note, pin }`), `read(note)`; `icons` and `inks` list the choices. Players' calls go through the GM like the tool's.

## Party gold tracker

**How to use:** run the **Party Gold** macro (GM only) or click **Party gold…** in control panel › Loot.

With **Party gold tracker** on, GMs get a **Party gold** window (*control panel › Loot › Party gold…*, the **Party Gold** macro or `api.partyGold()`). It's read-only.

- **Wealth** is the coin of every player character (a character actor a player owns or has assigned) and of the party group actor, coins in their containers included. With *Count mundane gear in party wealth* on, the price of their non-magical gear with no rarity is added. Amounts show in your coin system (three coins or standard).
- **The wealth curve** is gold per character for each act or tier (*Wealth curve*, Loot › Advanced, numbers separated by commas, Act/Tier 1 first). The default is 1, 3, 15, 30, 75, 200, 400, 600, 1200; change it to suit your game. Each act's target is its gold × **Party size**.
- **Status** per act: **green** at 75% to 150% of the target, **amber** at 50% to 75% or 150% to 200%, **red** further off. *Party is in act / tier* picks the act the banner talks about.
- **Take snapshot** saves the wealth now (the last 50 are kept, in a hidden world setting) to compare later. Nothing is taken automatically.

`api.gold.read()` returns the same numbers.

## Riding Training and Long Road

**How to use:** click **Run setup**, then drag the *Riding Training* feat from the Items directory (*Wanderer's Toolkit* folder) onto each character who has learned to ride.

**Run setup** adds a feat called *Riding Training* to an Items folder named *Wanderer's Toolkit* (players can see it, so they can drag it onto their sheets). It's granted on completing riding training with a stablemaster or riding instructor:

> **Swift Mount.** Mounting or dismounting a creature costs you only 5 feet of movement, rather than half your Speed.
> **Long Road.** When every member of your party has this feat and all of you are mounted, the party travels overland at mounted speed.

Hex Travel enforces Long Road: when the party actor has members, the *Mounted* box starts ticked only if every member has the feat, and the dialog names anyone who doesn't. The GM can still tick or untick it. Rename the feat in the **Riding feat name** setting if you call it something else.

**Upgrading from 1.7 or earlier.** The feat used to be called *Trained Rider*. Hex Travel accepts either name, and a *Riding feat name* setting still holding *Trained Rider* is read as *Riding Training*. Run setup once to rename the module's own *Trained Rider* feats (in the Items directory and on actors) to *Riding Training*; a feat you renamed yourself is left alone.

## Character pane

**How to use:** click the shirt button in a dnd5e character sheet's header, then drag items from the sheet onto the slots.

A character sheet in the style of a classic MMO character screen (1.30). The title shows the name, *Level N Class · Species · Party* and a **Rested** badge (its tooltip names the inn and the benefit). The portrait sits in the middle with **Attuned n / 3** on it, a **health bar** (temporary hit points as a striped segment) and the character's **coins** under it, and the gear slots run around it. Below the doll are three boxes:

- **Attributes**: the six ability scores and their modifiers.
- **Defence**: Armor Class, hit points, hit dice, initiative, speed and the six saving throws (proficient ones highlighted).
- **Attack**: follows the [weapon set](#weapon-sets) in hand. The Melee set shows the main-hand weapon, the Ranged set the ranged weapon, the Utility set the spell attack and save DC for a caster; a caster holding only a focus shows the spell. Each shows to hit, damage and range (or spell attack, save DC and ability). Pick *Melee*, *Ranged* or *Spell* from the box's menu to look at another; *Auto* goes back to following the set (the choice lasts while the window is open).

The sheet is an in-world panel: it stays dark in both Foundry themes, while the window around it follows your theme.

**Open it** with the shirt button in the header of a dnd5e character (or NPC) sheet, also in the sheet's **⋮** controls menu, or from a macro with `game.modules.get("wayfarers-toolkit").api.characterPane(actor)` (no actor: the selected token's, else your own character). Anyone who owns the actor can open it, so players can dress their own characters. Turn it off under control panel › Features.

The window is resizable: the slots and portrait grow with it, the *Equippable items* list scrolls inside it, and each player's size and position are remembered on their own computer.

<!-- screenshot (1.30): the character sheet with title line, slots, HP bar, coins and the three stat boxes (dark theme) -->
<!-- screenshot (1.30): the same sheet with Foundry's light theme (the sheet stays dark) -->

### Slots

Classic-MMO equipment slots, without an Ammo slot:

| Left | Right | Bottom |
| --- | --- | --- |
| Head, Neck, Shoulder, Back, Chest, Shirt, Tabard, Wrist | Hands, Waist, Legs, Feet, Finger ×2, Trinket ×2 | The three [weapon sets](#weapon-sets) and the Relic slot (Main Hand, Off Hand and Ranged with weapon sets off) |

Empty slots show a faint outline of what goes there (a helm, a pendant, a cloak, boots, a ring…). Item icons get a border and a soft glow in their quality colour (grey, white, green, blue, purple, orange, gold; the shared colours of the Wanderer's modules): an item with an MMO-style tooltip uses its own colour; otherwise dnd5e rarity decides (none / mundane grey, common white, uncommon green, rare blue, very rare purple, legendary orange, artifact gold). Hover an item for its tooltip.

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

### Weapon sets

You can't hold a sword, a shield and a longbow all at once, so the weapon slots come in three sets, and only one is in hand:

| Set | Hands | For |
| --- | --- | --- |
| **Melee** | Main hand, Off hand | A melee weapon with a shield, a second weapon, or nothing (a versatile weapon in both hands) |
| **Ranged** | Ranged, Off hand | A bow, crossbow, sling, thrown weapon, wand or rod. A one-handed ranged weapon may pair with an off-hand item |
| **Utility** | Main hand, Off hand | A weapon with a torch, a lantern, an instrument or a held holy symbol, or two held things |

**Only the set in hand is equipped** on the dnd5e sheet, so only its weapons count for attacks, AC and bonuses (and for the pane's stats). The other two sets stay visible, dimmed and marked *Stowed*. **Click a set's tab** to swap: the pane equips that set's items and unequips the others' on the sheet. Drag items onto any set's hands, click a hand to pick what goes there, right-click one to take it out of the set. Clicking an item in the list puts a weapon in a free hand of the set in hand (a ranged weapon in the Ranged set, a torch or lantern in Utility). A tooltip on a stowed item says it's stowed. The sets are stored on the actor in `flags.wayfarers-toolkit.weaponSets`.

**Hands.** A two-handed weapon empties its set's off hand. Shields are worn: one that's equipped stays on through a swap (the pane shows it still lit in its set), so:

- A set that needs the shield's hand (a two-handed weapon, an off-hand item, or a ranged weapon that loads ammunition) can't be made active while the shield is on. The pane says why ("Stow the shield first") with a **Stow shield** button, which unequips the shield. That's a separate, deliberate step; the swap never takes a shield off by itself. Swap back to the shield's set and it goes back on.
- **Bucklers** are strapped to the arm and leave the hand free: a buckler stays on with a one-handed ranged weapon, or with a one-handed weapon in each hand. Two-handed weapons are still blocked. A shield counts as a buckler when *buckler* is in its name, or when a GM ticks **Buckler** at the top of its item sheet (untick it to say it isn't one).
- **Versatile weapons** with the off hand empty (and no shield on) are shown as held in both hands, with the two-handed damage. dnd5e does the damage maths.
- **Thrown weapons** can sit in the Melee or the Ranged set.
- A **Ranged set with no ammunition** carried gets a warning; it isn't blocked.

**Swap cost in combat.** The GM picks the cost in **Weapon swap cost** (control panel › Character): Free, Part of an attack (the default: under the 2024 rules you can equip or unequip one weapon as part of each attack), Object interaction, Bonus action or Action. When a character who's a combatant in a started combat swaps, a short public chat line says so, for example *Mira swaps to Ranged (part of an attack).* Nothing is enforced or spent. **Stow shield** in combat posts a line too, noting that taking a shield off (or putting one on) takes the Utilize action. Outside combat, swaps are free and silent.

**Relic slot.** Characters of the classes ticked in **Classes with a relic slot** (dnd5e class identifiers; Paladin, Druid and Cleric to start with) get a Relic slot beside the sets. It's worn, needs no hand and is never part of a set. It takes a spellcasting focus (an item with the Spellcasting Focus property, or a holy symbol, arcane focus or druidic focus) or a relic: an item with *libram*, *idol*, *totem*, *relic* or *sigil* in its name, or one a GM ticks **Relic** on in its item sheet (unticking it says it isn't one). Slotting it equips it on the sheet.

**Existing characters.** The first time a character's pane opens with weapon sets on, what was in the Main Hand and Off Hand becomes the Melee set, what was in Ranged becomes the Ranged set, and Melee is in hand (so a ranged weapon that was equipped is now stowed and unequipped). The set in hand is still recorded in the old slots, so switching **Weapon sets** off (control panel › Character) gives back the single Main Hand, Off Hand and Ranged slots with that set in them, all equipped at once, as before.

**Changing things on the sheet.** Equipping a stowed set's item, or unequipping a weapon in hand, on the dnd5e sheet (or from a macro) takes that item out of its set, so the pane never disagrees with the sheet.

**Scripting.** `api.pane.activateSet(actor, "melee" | "ranged" | "utility")`, `api.pane.assignWeapon(actor, item, set, "main" | "off")`, `api.pane.unassignWeapon(item)`, `api.pane.stowShield(actor, shieldId)` and `api.pane.weaponState(actor)`.

### Item comparison

Hover an item in the pane's *Equippable items* list and its tooltip ends with a comparison against what you'd be swapping out: the item in the slot it would go in, or, for a weapon, shield or held item with weapon sets on, the matching hand of the matching set (a bow against the Ranged set's ranged weapon, a sword against the Melee set's main hand, a shield against the off hand, a torch against the Utility set's off hand). Each line shows the hovered item's value and, greyed, the current one's:

- **Armor Class** (armour and shields, magic bonus included), **Damage** (dice and damage type, with the average roll), **Attack bonus**, **Magic bonus**
- **Properties** gained (+) and lost (−), **Attunement** (needing it counts as worse, since it takes one of your three slots), **Value** and **Weight** (lighter is better)

Green is better, red is worse, white is just different. Lines where both are the same are left out. An empty slot says so. A note follows the [hands rules](#weapon-sets): *Needs both hands: Kite Shield would have to be stowed*, *… Dagger would come out of the off hand*, or *Needs a free hand to load* for a crossbow with a shield (a buckler is fine).

The same comparison shows when you hover an item in an Item Piles loot pile, body or merchant window, against your own character (your assigned character, else the selected token's). Items already in a slot or set aren't compared. Switch it off with **Item comparison tooltips** (control panel › Character).

### Items with MMO-style tooltips

Items whose description holds an MMO-style item tooltip, like those in the optional classic MMO item compendium, are placed by the tooltip's slot line: Head, Neck, Shoulder, Back, Chest, Shirt, Tabard, Wrist, Hands, Waist, Legs, Feet, Finger, Trinket, Main Hand, One-Hand (either hand), Two-Hand, Off Hand / Held In Off-hand, and Ranged / Thrown / Relic in the Ranged slot. Their border uses the tooltip's quality colour, and hovering shows that tooltip. When a description has no slot line, the compendium folder the item came from decides (Head, Two-Hand, Finger, Wands…). Nothing from that module is bundled; icons come from the items.

**Armour pieces and AC.** MMO-style helms, shoulders, gloves, boots and the like are often typed as light, medium or heavy armour with no AC of their own, and dnd5e only counts one piece of armour for AC. So that a helm doesn't replace the chest armour, armour-typed items worn in a slot other than **Chest** are left out of dnd5e's AC calculation while the character pane is on. Armour in the Chest slot, and equipped armour that isn't in any slot, counts as usual.

## Quest log

**How to use:** press **L**, click the scroll button in the token controls, or run the **Quest Log** macro. The GM clicks **New quest**; players only read.

Quests stay narrative: each one has a few objectives written as things to do ("Handle the bandit camp", "Find out who hired them"), and the GM ticks them off when the story says so. An objective can also have a counter ("Wolf pelts 3/8") that the GM moves with + and −; it ticks itself when the count is reached.

Since 1.29 each quest belongs to **one party** (a group actor). Players see a quest only if they own a character in its party: in the log, the tracker, the journal, chat cards and on map pins. A quest with no party is GM-only until you pick one. The log looks like a native Foundry window in both the dark and the light theme; the quest list (a stone frame) and the quest page (parchment) look the same in either.

### Setup

1. Make sure **Quest log** (and, if you want it, **Quest tracker**) is switched on in the control panel's Features tab.
2. Run setup to add a **Quest Log** macro (shared with players). Everyone can also open the log with the scroll button in the token controls or the **L** key (change it under **Configure Controls**).
3. **Parties** (control panel › Quests): tick the group actors quests can be given to. None ticked: the party actor (General tab). **Quest cap** (Advanced, default 25): how many active quests one party can have before you're warned; giving more still works. The list's header shows *Quest Log (n / cap)*.
4. Optional settings (control panel › Quests): **Quest folder** (the journal folder quests live in, default *Quest Log*), **Announce objectives in chat**, and **Sound when a quest is given** / **Sound when a quest is completed** with a **Quest sound volume** (blank by default; pick your own audio files).

<!-- screenshot: the quest log with a quest open -->

### Making quests (GM)

Click **New quest** in the log. A quest has:

- **Title**, **Zone / region** (quests are grouped under zone headers) and an optional **Level**. A number (`4`, or `Lv 4`) gives the quest a difficulty against its party: quest level minus the party's level (the average character level of its members) is **Trivial** (−5 or lower, grey), **Easy** (−4 to −2, green), **Even** (−1 to +1, yellow), **Hard** (+2 or +3, orange) or **Deadly** (+4 or more, red). Text that isn't a number (`3-5`, `Heroic`) is shown as it is, without a colour.
- **Party**: the group actor the quest belongs to (new quests get the log's party filter, or the first party).
- **Quest giver**: type a name or drop an actor on the field to link it.
- **Summary** (a line or two, used in chat) and a rich-text **Description**.
- **Objectives**: add, remove and reorder rows. Each can be **Hidden** (players don't see it until you reveal it) or **Optional**, and can have a count (blank for none).
- **Rewards**: coin written like `1g 20s` or `50c` (a plain number is read in *Fares without a coin are in*, control panel › Travel; works with either coin system), **Items** dropped from the sidebar or a compendium (always given), **Choose one of** (items a party member picks from; the GM can change the pick), and free text such as renown. Item slots are bordered by rarity: mundane grey, common white, uncommon green, rare blue, very rare purple, legendary orange.
- **Status**: *Not given*, *Active*, *Completed* or *Failed*, and **Hidden from players**.

In the log the GM sees every quest, including ones not given yet (*Not given* tab) and hidden ones (marked with a crossed-out eye), and filters by party with the chips at the top (**All parties**, or one party with its level). The list groups quests by zone (click a zone to fold it; remembered on this computer), each row with its Track box, `[level]` and name coloured by difficulty, *(Ready)* when every required objective is done, and the party's name when several parties are shown. The page shows the party badge (a drop-down for the GM: changing it moves the quest to another party) and the difficulty, the title, zone and giver, the description, objectives (with n/m counters), and the rewards: *You will receive*, *Choose one of these rewards* and *You will also receive* (the coin, "to" the party). Buttons: **Track**, **Edit**, **Hide from players**, **Give quest**, **Fail**, **Reopen**, **Journal**, **Delete** and **Complete and pay to *party*** (completes, then pays; with a reward still to choose it completes and leaves **Pay rewards** for later). Click an objective's box to tick it; **Reveal** shows a hidden objective.

### What players see

Players only read, with one exception: a member of the quest's party picks the reward under *Choose one of these rewards* (the choice goes to the GM's client, which checks they're in the party). They see their party's quests that have been given and aren't hidden, under **Active** and **Completed** (failed quests sit in Completed, struck through), with visible objectives (counters as n/m), the description and rewards. There's no party filter for players. The journal entries follow the same rule: a player gets Observer on a quest's journal only once it is given, not hidden, and they own a character in its party (it's updated when a party's members change). Chat cards for a quest are whispered to the GMs and those players.

**Tracker.** Newly given quests are tracked automatically (up to five); untick **Track** in the log to drop one. The tracker lists each tracked quest of the player's party, its title coloured by difficulty, and its open objectives with counters (n/m). It starts at the top right, left of the sidebar, in the first spot that covers none of Foundry's own interface (scene controls and navigation, players list, hotbar, camera dock). **Drag it by its title** to put it anywhere (mouse or touch), or focus its grip (Tab) and use the **arrow keys** (Shift for bigger steps); it's kept inside the window, and each person's spot is remembered on their own computer. Double-click the title, press **Home** on the grip, or use the reset button next to **Show tracker** in the quest log (or *control panel › Quests › Reset quest tracker position*) to put it back. Collapse it with its arrow; close it with its **X** and bring it back with **Show tracker** at the top of the quest log (the same as **Show the quest tracker on my screen**, Quests tab). Tracking a quest while it's closed doesn't reopen it. Scripts: `api.quests.showTracker(on)` and `api.quests.resetTrackerPosition()` (this client only).

**Objective → map pin** (feature *Quest objectives find their map pin*, 1.28). Link a map pin to a quest from the pin's card. Then clicking one of the quest's open objectives in the tracker, or an objective or the quest's title in the quest log, moves the map to the pin and pings it (Foundry's own ping, seen by everyone on the scene; a GM's hidden pin is moved to but never pinged). Clicking the quest's title in the tracker opens the log and also moves to the pin and pings it (without a notice when the quest has no pin). A pin on another scene: the GM is asked whether to view that scene (only the GM moves); a player is told which scene it's on. With several pins, one on the scene you're viewing wins.

**Updated** (feature *Updated quests glow*, 1.28). When the GM changes a quest a player can see (status, an objective ticked or revealed, its text), it pulses with an *Updated* tag in that player's tracker and quest log until they open it in the log. Only what the player sees counts (a change to hidden objectives or GM text doesn't glow). Each computer remembers what it has seen (hidden client setting `questSeen`); the first load after updating marks everything as seen. GMs never see the glow.

### Moments

- **Give quest** posts a *New quest* card with the summary (and plays the accepted sound).
- Ticking or revealing an objective posts a short line (or a notification, with *Quest objectives in chat* off).
- **Complete** posts a *Quest complete* card listing the rewards, with a **Pay rewards** button for the GM: the coin goes into the purse of the quest's party actor and the items (fixed ones plus the chosen one) onto it, logged in the coin log as *Quest reward: …*. Each quest pays once; it waits while a reward is still to be chosen.
- **Fail** posts a *Quest failed* card.

Hidden quests announce nothing; showing an active quest to players announces it then.

### Journals

Each quest is a journal entry with one text page in the quest folder. The page is rewritten from the quest's data whenever it changes, so it reads well on its own and in exports: status, level, zone, party, giver, summary, objectives (☑/☐, counters), description and rewards. Hidden objectives and secret text never go on the page (the full quest is in the GM-only records). Edit quests in the quest log rather than on the page, since the page is regenerated. The players' view is in `flags.wayfarers-toolkit.quest` (record version `v: 2` since 1.29: `party`, numeric `level` with `levelText` for other text, objective `target` / `progress`, rewards `choice` / `pick`).

**Upgrading to 1.29.** Once, on the acting GM's client, every existing quest is given the party actor (General › Party actor) as its party, levels like `Lv 4` become numbers (anything else is kept as text), reward items get their rarity, and each journal's ownership is set from its party. Until then old quests keep the old rule (every player sees given quests). Without a party actor the quests become GM-only until you choose a party for each (the health check lists them).

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

Also `update(quest, patch)`, `hide(quest, true|false)`, `untickObjective`, `payRewards`, `delete`, `list()`, `get(quest)`, `track(quest, on)`, `showTracker(on)` and `resetTrackerPosition()` (the on-screen tracker on this client; experimental). From 1.29 (experimental): `progressObjective(quest, objective, delta)` (counter +/−), `assign(quest, partyId)` (`""` = no party), `pickReward(quest, itemUuid)` (players: sent to the GM), `parties()` (`[{ id, name, level }]`) and `difficulty(quest)` (`{ id, label, colour }` or null). `create` takes `party` (a group actor id), `level` (number or text), objectives with `target`, and `rewards.choice`. Quests are found by journal id, UUID or name. All of these that change a quest are GM only: on a player's client they just warn, and no quest change is ever sent over the socket. Monk's Active Tiles runs its actions on the GM's client, so tiles work as usual.

## Boss frames

**How to use:** select a token, open its token HUD (right-click) and click the **crown** button to mark it as a boss; click again to unmark it. The mark is on the token, so each copy of a creature can be marked separately. From a macro: `api.bosses.toggle(tokens, true)`.

While a combat is running and a marked boss is one of its combatants, every connected client sees its frame at the top centre of the screen: the token image, its name and a health bar that updates as it takes damage (temporary hit points show as a striped segment). Several bosses stack. The frame goes away when the combat ends, the boss is removed from it or unmarked. A boss at 0 HP or marked defeated stays on screen, greyed out, until the combat ends. Hidden combatants and hidden tokens aren't shown to players.

With the **Carousel Combat Tracker** module showing its dock along the top of the screen, the default stack sits just below the dock instead of under it, and follows it when it changes size. Frames you've moved stay where you put them.

Each user can arrange the frames on their own screen. Drag a group's top frame to move the whole group; drag any other frame to pull it out on its own. Drop a frame within a few pixels of another frame's edge and it snaps flush against it (a dashed outline shows where) and joins that group; new bosses join the main stack. The layout is remembered on that browser and kept on-screen after a resize. Double-click any frame to put them all back in one stack at the top centre.

**Boss health players see** (control panel › Boss & Combat): *Bar only*, *Bar and percentage* or *Exact HP*. The GM always sees exact hit points.

**Creatures with boss loot get a boss frame** (control panel › Boss & Combat, on by default, with Boss loot turned on): a creature with a boss loot table gets a frame in combat without the crown. Turning the crown off on such a token hides its frame (the token stores an explicit "not a boss").

<!-- screenshot: boss frame at the top of the screen with phase marks -->

### Phase marks

Give a boss phase marks to see its fight change at set health levels. **Right-click the crown button** in its token HUD (or, as the GM, right-click its frame) and enter percentages, highest first, such as `66, 33`. Tick *Every token of …* to store them on the creature itself so every token of it gets them; unticked, only this token. Blank removes them. From a macro: `api.bosses.setPhases(tokens, [66, 33])` (add `{ actor: true }` for every token of the creature; `[]` removes them) and `api.bosses.phases(token)`.

- The frame's health bar gets a thin gold mark at each percentage. The GM always sees the marks; players only with **Show phase marks to players** (control panel › Boss & Combat; off by default).
- When the boss's health drops below a mark during a started combat, the GMs get one whisper: *The Ogre reached phase 2 (below 66%).* A big hit that passes two marks says both. Each mark is told once; healed back to the mark or above, it resets, so the next drop tells you again.
- The check runs on the active GM's client. Which marks a token has passed is kept on the token (`flags.wayfarers-toolkit.phasesPassed`); the marks themselves in `flags.wayfarers-toolkit.phases` on the token or its creature.

Frames show only for the combat on the scene you're viewing, and a frame disappears straight away when its token, combatant or actor is deleted mid-combat.

## Loot rolls

**How to use:** as GM, open an Item Piles pile or body and click the **dice** button on an item's row.

Needs Item Piles set up for your system (for dnd5e, Item Piles: D&D 5e). Without it the feature just adds nothing.

1. Open an Item Piles pile or lootable body as the GM. Each item row has a **dice** button (*Roll for this*), next to *Take*. From a macro: `game.modules.get("wayfarers-toolkit").api.lootRoll.start(itemOrUuid, { seconds })`.
2. A **Loot roll** chat card shows the item's name, icon and rarity colour, with **Need**, **Greed** and **Pass** buttons and a countdown (**Seconds to choose Need / Greed / Pass**, control panel › Loot, default 60 seconds). Every logged-in player who has a character can choose once; the GM can **Close the roll now**.
3. Each choice goes to the GM's client, which rolls a d100 for Need and Greed and writes it on the card, so everyone sees every roll and nobody can set their own.
4. When everyone has chosen or time runs out: the highest Need wins; if nobody chose Need, the highest Greed. Ties reroll among the tied players. The item (the whole stack) moves from the pile to the winner's assigned character (or the first character they own) through Item Piles, and the result is posted to chat. If everyone passes or nobody answers, the item stays in the pile.

**If the winner can't take it** (they have no character, their character was deleted, or Item Piles can't move the item), the item goes to the next-best roll (Need before Greed, then by roll) and the card says who was passed over and why. If nobody who rolled can receive it, it stays in the pile.

**Assign to…** The GM's copy of an open card has a dropdown of the player characters and the party actor and an **Assign to…** button: it ends the roll and moves the item there straight away.

The players of the receiving character (everyone who owns it or has it as their character) get a whisper, "You won *item*", as well as the public line; the same goes for a GM Assign. Given to the party actor, its player owners get the whisper, if it has any.

A GM must be connected for players' choices to count. While none is, players' Need / Greed / Pass buttons are disabled with "A GM needs to be connected." and come back when a GM connects. An open roll survives a GM reload and closes when its time is up.

### Loot history

With **Keep a loot roll history** on (control panel › Loot › Advanced; on by default), every finished roll is recorded: date and time, scene, the item (name, rarity colour, UUID, quantity), each player's choice (Need, Greed or Pass) and rolls, rerolls included, who received it, and how it ended: *Won*, *All passed*, *GM assigned* (Assign to…), *Expired* (nobody chose before the time ran out) or *Not handed out* (nobody who won could receive it, or it had left the pile). The active GM's client writes it to a hidden world setting, so it can't be deleted or edited by accident and players never see it. The last 500 rolls are kept; older ones drop off.

Open the **Loot history** window (GM only) from **control panel › Loot › Loot history…**, the **Loot History** macro (compendium folder *Loot Rolls*) or `api.lootRoll.history()`:

- **The list.** Click a column heading (Date, Scene, Item, How it ended, Received by) to sort by it; click again to reverse. Under each roll, everyone's choice and roll.
- **Filters.** *Player* (anyone who chose, or received an item) and *Session date* (each day with rolls).
- **Per player.** For each player: rolls taken part in, items received, Need wins, Greed wins and items the GM assigned. It follows the date filter.
- **Export CSV** downloads what's shown, in the order shown (spreadsheet-safe: a value starting with `=`, `+`, `-` or `@` gets a leading apostrophe).
- **Clear history…** deletes every recorded roll after asking. Export first if you want a copy.

Scripting: `api.lootRoll.history()` opens the window, `api.lootRoll.historyEntries()` returns the entries (plain objects, newest first), `api.lootRoll.exportHistory()` and `api.lootRoll.clearHistory({ confirm: false })`.

## Boss loot

**How to use:** open a creature's token HUD (right-click the token), click the **gem** button and pick a roll table of drops.

Hand-picked drops for named creatures, alongside (or instead of) vendor trash. Works with linked and unlinked tokens.

1. Make a **roll table** with one result per possible drop. Each result is a document result pointing at an Item (a world item or a compendium item); its **weight** is its relative chance. Text results (such as "Nothing") drop nothing.
2. As the GM, open the creature's token HUD and click the **gem** button (*Boss loot…*). Pick a world table from the list, or drag any roll table (also from a compendium) onto the *Table UUID* box. Set **Draws** (how many results drop), optional **Coin** (in copper) and a **Note** for yourself. For an unlinked token you choose whether it applies to this token only or to every token of that actor. Choose *(none)* to remove it. The gem is lit on tokens with a table.
3. When the creature drops to 0 HP or is marked defeated, the active GM's client draws the table once: `draws` results, weighted, without replacement (the same item never drops twice in one draw). The roll table itself is never changed, so "drawn" marks on it don't matter. The items are copied onto the body and, with Item Piles, it becomes a lootable pile showing only loot (vendor trash and boss loot) and coin; the creature's own gear stays hidden. Without Item Piles the GM's card has a **Give to Party** button.
4. The GM gets a card "*Name* dropped:" with a link per item and, when Loot rolls is on, a **Start loot roll** button per item.

**Party size.** Boss coin is scaled by the **Party size** setting: `coinCp × party size / 4`, rounded to the copper (a 1,000c boss drops 1,250c for five). The flag itself is not changed. With **Extra boss drop for parties over 4** on (the default), a boss with 3 or more draws draws one more for a party of 5 or more, never more than its table's usable results. Preview Boss Loot and the health check show the adjusted coin and draws next to the ones set.

**Link boss tables by name.** If your tables are named after their creatures, link them all at once: **Link boss tables by name** (control panel › Boss & Combat, or the Overview tab when it applies), the button in the health check, or `api.bossLoot.autoLink({ folder, overwrite })`. Every world NPC actor without a boss loot link gets the world roll table named exactly "*Actor name* · Loot" (also "*Actor name* - Loot" or "Loot: *Actor name*"), with 1 draw and no coin, unless the table says otherwise: a table flag `flags.wayfarers-toolkit.bossLootDefaults = { draws, coinCp, note }`, or "draws: 2" / "coin: 1500" (copper) in the table's description. Existing links are never changed unless `overwrite: true`. `folder` (a folder, its id or name) limits it to actors in that folder. You get a notification and a whisper listing what was linked and skipped.

**Fallback.** If the linked table has been deleted, has no results that can drop, or the draw finds none of the items its results point at, the body gets the normal vendor-trash drop instead (unless it's marked No loot) and the GM is whispered which creature, why and what happened: "vendor trash dropped instead", "no vendor trash rolled for it either", "its vendor trash is already on the body", or why there's none (Vendor Trash off, No loot, no compendium). A linked boss has no pre-rolled trash, so its fallback drop is rolled then (up to three tries before it counts as empty). The health check lists these links in advance.

Each death draws once: healing and dying again doesn't draw again. **Reset loot** (token HUD) removes the boss loot items as well as vendor trash and lets it draw again. **Boss loot drops on death** (control panel › Boss & Combat, on by default) can be turned off; then drop it yourself with `api.bossLoot.drop(tokens)`.

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

## Three-coin economy (copper, silver, gold)

**How to use:** in control panel › Features, switch on **Three-coin economy** and click **Save features**. The steps are below.

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

## Coin log and Split coin

**Coin log** (GM only, feature *Coin log*): control panel › Loot › **Coin log…**. Every coin movement the toolkit makes is listed, newest first: quest rewards paid, rooms rented, flight fares (and a refund when a flight's scene fails to open), vendor trash sold, coin put on bodies by Vendor Trash and Boss loot, coin given with *Give to Party*, Split coin, and undos. Each line has the actor, the amount (and as gold / silver / copper), the reason and the time. The last 200 are kept in the GM-only records (bucket `coinLog`; created once by the `coinLog1` migration). Coin you move by hand on a sheet isn't logged.

**Undo** on one of the latest 20 entries reverses it once: coin that was paid is given back; coin that was given is taken back only if the actor still has at least that much (otherwise nothing changes and you're told why). The undo is logged too and can't itself be undone. `api.coinLog` (GM; experimental): `entries()`, `open()`, `undo(id)`. `api.pay(actor, amount, { reason })` and `api.addMoney(actor, amount, { reason })` log when given a reason.

**Split coin** (GM, feature *Split coin*): the party actor's sheet header menu (**Split coin among members**), control panel › Loot › **Split coin…**, or `api.splitCoin(party?)`. The preview shows each member's share; the remainder that doesn't divide evenly stays with the party. If the party's coin changes while the preview is open, nothing moves.

## Keyboard shortcuts

With *Keyboard shortcuts* on, **Configure Controls** lists *Open character pane* and *Open the control panel (GM)* under Wanderer's Toolkit, with no keys set: each user picks their own. The quest log's own shortcut (**L**) belongs to the quest log and is there whenever the quest log is on.

## Cost and time before travel

With *Cost and time before travel* on, Hex Travel and flights (GM and players' bookings) show a confirm with the **cost** in gold, silver and copper, the **time** and **who pays** (the party actor; free flights and hex travel cost nothing). The GM can skip it with *Travel without the cost and time check* (Travel › Advanced; a player's booking still shows its confirm).

## Macros and scripting

Every tool is available as `game.modules.get("wayfarers-toolkit").api.<tool>()`: `hexTravel`, `flight`, `vendorTrash`, `sellTrash`, `characterPane`, `questLog`, `setup`, `health` (the health check; `api.setupPlan()` lists what setup would create). Boss frames are under `api.bosses` (`toggle(tokens, on)`, `isBoss(token)`) and loot rolls under `api.lootRoll` (`start(item, { seconds })`, `close(messageId)`) (plus `assign(messageId, actor)`) and boss loot under `api.bossLoot` (`set`, `get`, `preview`, `drop`, `reset`, `dialog`, `autoLink`; see [Boss loot](#boss-loot)); all are undefined when their feature is off. `api.partySize` reads the Party size setting; `api.cleanup` is [Remove toolkit data](#remove-toolkit-data). The quest API is under `api.quests` (see [Quest log](#quest-log)); `api.features.on("questLog")` tells whether a feature is turned on. `characterPane(actor)` opens the pane for an actor (or the selected token's, or your character); `api.pane.slotItem(actor, item, slot)` and `api.pane.unslotItem(item)` slot and unslot from a macro (slots: `head`, `neck`, `shoulder`, `back`, `chest`, `shirt`, `tabard`, `wrist`, `hands`, `waist`, `legs`, `feet`, `finger1`, `finger2`, `trinket1`, `trinket2`, `mainhand`, `offhand`, `ranged`, `relic`; with weapon sets on, the three weapon slots mean the set in hand, see [Weapon sets](#weapon-sets)). `vendorTrash(tokens)` takes an optional list of tokens instead of the selection, `api.trash.reroll(tokens)` rerolls pre-rolled trash (everything under `api.trash`, `api.bossLoot`, `api.gold` and `api.cleanup` is GM only since 1.27: a player gets a warning and `undefined`), `api.trash.reset(tokens, { clearCoin })` resets looted tokens, `api.trash.preview(tokenOrActor, n)` returns what a creature can drop, `api.trash.showPreview(tokens, n)` whispers that as a GM chat card (the Preview Vendor Trash macro), and `sellTrash(actor)` sells one actor's trash without asking. Money helpers: `parseMoney("1g 20s")` returns an amount in the smallest coin, `fmtMoney(amount)` formats one, `moneyHTML(amount)` returns it as coin markup for the shared look (1.30, experimental; `coinRatio()` is the copper per silver of the coins in use), and `totalMoney(actor)` / `pay(actor, amount)` read and spend an actor's purse.

### Public API and hooks: what's stable

`game.modules.get("wayfarers-toolkit").api` is available from the `ready` hook. Getters for a tool return `undefined` while that tool is turned off. **Stable** means the name, arguments and result shape are kept across minor versions (a change goes through a deprecation note in the changelog first); **experimental** may still change in a minor version. GM tools refuse players (a warning and `undefined`).

| API | Status |
|---|---|
| `hexTravel`, `flight` (+ `network`, `setNetwork`, `unlock`, `fly`, `editor`, `importLegacy`, `map`), `vendorTrash`, `sellTrash`, `characterPane`, `questLog`, `quests`, `bosses` (`toggle`, `isBoss`, `refresh`), `lootRoll` (`start`, `close`, `assign`), `bossLoot` (`get`, `set`, `preview`, `drop`, `reset`, `dialog`, `autoLink`), `trash` (`reroll`, `reset`, `preview`, `showPreview`), `pane` (`slotItem`, `unslotItem`), `setup`, `setupPlan`, `health`, `panel`, `cleanup` (`plan`, `remove`, `open`), `features.on`, `partySize`, `parseMoney`, `fmtMoney`, `totalMoney`, `pay` | stable |
| `healthReport`, `coinLog` (`entries`, `open`, `undo`), `splitCoin`, `flightMap`, `travelPace`, `setTravelPace`, `partyGold`, `gold`, `zoneTitles`, `rentRooms`, `inn` (`inn`, `inns`, `all`, `rested`, `rental`, `clear`, `candidates`, `rent`, `save`, `remove`, `makeInnkeeper`), `pins` (`place`, `create`, `update`, `move`, `remove`, `reveal`, `open`, `list`, `read`), `lootHistory`, `updateNotes`, `wizard`, `trash.applyWeights`, `settingsRecords`, `migrations` (`status`, `run`), `quests.showTracker`, `quests.resetTrackerPosition`, `quests.progressObjective`, `quests.assign`, `quests.pickReward`, `quests.parties`, `quests.difficulty`, `moneyHTML`, `coinRatio` (1.30) | experimental |
| `internals`, `log`, anything not listed here | internal: don't rely on it |

Removed in 1.27: `sessionStart`, `whosOnline`, `online` (both tools moved to the **Red Book** module) and `settingsIO` (settings files are the hub module's job; `api.settingsRecords()` lists the record settings a settings file must leave out). Under `api.trash`, only the functions listed in the code comment remain (the internal module is no longer spread into the API).

**`api.healthReport()`** (GM; experimental) returns the health check in wanderers-core's shared health format, the same shape every module that uses the shared core returns, so a hub can show them together:

```js
const report = await game.modules.get("wayfarers-toolkit").api.healthReport({ timeoutMs: 20000 }); // timeoutMs optional
// [{ title: "Boss loot", lines: [{ level: "ok" | "warn" | "bad" | "off" | "info", text: "…" }] }, …]
```

- A Promise of an array of sections in the order of the health card; sections with no lines are left out.
- `text` is plain text (no HTML; buttons in the chat card are dropped). `level` is one of the five words.
- Each section runs wrapped and time-limited: `timeoutMs` per section when given (clamped to 1 s – 5 min; a hub passes its own budget so the two limits agree), otherwise 20 s. One that throws or runs out of time becomes a single `warn` line, and the others still run. Nothing in the world is changed. Nothing is posted to chat (use `api.health()` for the chat card).
- Players get `[]` (the report names GM-only things).

### Hooks

With the feature *Hooks for other modules* on (default), the toolkit fires two hooks (`Hooks.callAll`), on the GM client that makes the change only (one client, not every client). Both are **experimental**.

```js
Hooks.on("wayfarersToolkit.questUpdated", ({ questId, change }) => { … });
Hooks.on("wayfarersToolkit.journey", ({ kind, fromId, toId, fromName, toName, hours, cost, partyId }) => { … });
```

- **`wayfarersToolkit.questUpdated`** `{ questId, change }`: `questId` is the quest journal entry's 16-character id; `change` is one of `"started"` (given or reopened), `"completed"`, `"failed"`, `"objective"` (ticked, unticked, revealed or hidden), `"updated"` (anything else: text, hidden from or shown to players, rewards paid, set back to not given) or `"assigned"` (the quest moved to another party, or to none; since 1.29). It fires only **after** the quest is saved (the GM-only records and the quest journal), so reading the quest from inside the hook sees the change. Ids only: read the quest through `api.quests.get(questId)`.
- **`wayfarersToolkit.journey`** after a hex trip or flight has happened: `kind` `"hex"` or `"flight"`; for a flight `fromId` / `toId` are flight point ids and the names their names; for hex travel `fromId` / `fromName` are the scene travelled from and `toName` the zone travelled through (`toId` null). `hours` is decimal hours (e.g. `2.5`); `cost` is `{ gp, sp, cp }`, whole coins of each kind (what was actually charged; 0 for free flights and hex travel); `partyId` the party actor's id or null.

Earlier hooks: none from 1.27 to 1.27.2 (`wayfarers-toolkit.playerCountChanged` and `wayfarers-toolkit.allPlayersOnline` moved with Who's online to the Red Book module, which fires `red-book.playerCountChanged` / `red-book.allPlayersOnline`, and the old names too while the toolkit doesn't provide `api.online`). Internally the toolkit broadcasts one notice hook, `wayfarers-toolkit.notice` (`{ to: userId | null, level, text }`: flight results, refused pins, quest objective lines); clients accept it only from the acting GM client, and it isn't meant for other modules.

Other modules should read and change toolkit data through this API rather than writing `flags.wayfarers-toolkit.*` directly; flag shapes are documented for reading, and may gain fields.

### GM-only data and players' clients

Since 1.27 the toolkit keeps everything players mustn't read out of what their clients receive:

- **GM-only records**: one journal entry, *Wanderer's Toolkit (GM only)* (worlds made before 1.27.2 keep the older name *Wayfarer's Toolkit (GM only)*; the module finds it by its flag), ownership None for players, with `flags.wayfarers-toolkit.vault = { v: 1, buckets }`: the full flight network (with locked points), hidden GM map pins (no map note exists until you reveal one), each quest's full data (hidden objectives and the description's secret sections), room rentals, party gold snapshots and the loot roll history. Don't share it with players; deleting it loses those records. The health check (*Shared core*) warns if a player can open it.
- **What players' clients get**: the world setting `flightNetwork` holds only the unlocked points and their routes (greyed locked points as bare positions if you chose *Greyed out*); a quest journal's flag and page hold only what players may see (nothing at all for a quest that isn't given or is hidden); map notes exist only for pins players may see.
- **Requests from players** (flight bookings, pace and room requests, loot roll choices, map pin changes, long rests) go over the shared core's checked socket requests: unknown kinds, unexpected fields, wrong types and oversized payloads are refused, the sender is always Foundry's own (never a field in the message; unknown senders are refused), repeats are dropped and each user is rate-limited. Notices back are accepted only from the acting GM client.
- Foundry itself decides what a None-ownership journal entry sends to a player's client; the toolkit relies on Foundry's ownership rules for the GM-only entry.

### Upgrading to 1.27: data moved once

The first time the acting GM loads 1.27, each of these runs once (recorded in the GM-only records; `api.migrations.status()` lists them) and a whisper lists what moved:

| Move | What happens | Kept / undo |
|---|---|---|
| `inns1` | each scene marked *Inn* becomes one inn record (same name and price) | the old `flags.wayfarers-toolkit.inn` stays on the scene; 1.26 still reads it |
| `vault1` | the flight network, gold snapshots and loot history are copied into the GM-only records; `flightNetwork` is rewritten to the players' view, `goldSnapshots` and `lootHistoryData` are emptied | the full copies are in the GM-only records. Going back to 1.26 shows only unlocked flight points until you re-enter the rest, and no old snapshots or history |
| `quests1` | each quest's full data is copied into the GM-only records; its journal flag and page are rewritten to the public view | the hidden objectives and secret text live only in the GM-only records afterwards (1.26 would show them as missing) |
| `pins1` | hidden GM pins are copied into the GM-only records and their map notes deleted | revealing a pin recreates its note with the same id; 1.26 doesn't see hidden pins |
| `rested1` | characters already Rested get a room rental record, so they keep the benefit | the Rested flag on characters is unchanged |
| `coinLog1` (1.28) | the coin log's empty record is created | nothing moved |
| `quests2` (1.29) | each quest gets record version 2: the party actor as its party, a numeric level where the text was one, reward rarities, and journal ownership from its party | 1.28 reads version 2 records (unknown fields ignored; a numeric level shows as the number), but players' journal ownership is then per party; set the journals' default ownership back by hand if you go back |

Moves for a tool that's off wait until it's turned on. Settings of Session Start and Who's online (`hiddenScenes`, `onlineCount`, `onlineList`, `onlinePosition`, `onlineDrag`, client `onlineHudPos`) and the scene flag `flags.wayfarers-toolkit.hub` are left untouched and stay registered (hidden), so the Red Book module's own one-time move can read them.

## License

[MIT](LICENSE). Free to use, modify and share.

This is an unofficial fan-made module. It is not affiliated with or endorsed by Foundry Gaming LLC, Wizards of the Coast or any game publisher, and it bundles no third-party game content.

## Credits

- Module by **cocoomg11**.
- Flight sound (`sounds/be-good.ogg`) recorded by a friend of the author, used with permission.

Bug reports and suggestions: [GitHub issues](https://github.com/cocoomg11/wayfarers-toolkit/issues).

## Building from source

Tests: `npm test` runs the pure-logic tests in `tests/` with Node's built-in test runner (Node 22), `npm run check` syntax-checks every script and `npm run lint` runs ESLint on the shared core's config (`npm install` first for the linter). CI runs them through the shared core's reusable workflow (`module-checks.yml@v0.2.0`), which first checks that `vendor/wanderers-core/` matches its pin.

**Shared core.** The toolkit bundles a pinned copy of **wanderers-core** (the small library its sister modules share) in `vendor/wanderers-core/`, with the pin in `wanderers-core.lock.json`. Never edit the copy by hand; update it with `node vendor/wanderers-core/vendor.mjs update X.Y.Z` and commit both. The release zip includes `vendor/` without core's `config/` folder and `vendor.mjs` (dev tools).

The compendium sources live in `src/packs/macros` as JSON and are generated from `scripts/macros.mjs`, the same list Run setup uses. After changing a macro, run `node tools/build-packs.mjs sources` and commit the JSON. The release workflow installs `@foundryvtt/foundryvtt-cli`, checks the sources are current, compiles them into `packs/macros` (LevelDB) and adds `packs/` to `module.zip`. To build locally: `npm install`, then `node tools/build-packs.mjs compile`.
