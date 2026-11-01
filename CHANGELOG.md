# Changelog

All notable changes to Wanderer's Toolkit. Versions follow the `version` in `module.json`.

## 1.30.0

The facelift, part two: the character pane becomes a classic character sheet, and every other toolkit window, dialog and chat card moves to wanderers-core's shared look (Option A: same layouts, core's tokens and components instead of the old wood, stone and parchment frames). The health chat card gets short when the Wanderer's Satchel is there. Two quest log fixes from the 1.29.0 live test. No data migration; no new settings.

**Changed**
- **Core 0.4.0.** `vendor/wanderers-core` updated from 0.3.1 with the vendor tool (stylesheet revision 3: item quality tokens, `wc-item-slot`, `wc-coins`; `quality()`, `itemSlot()`, `coins()`, `formatCoins()`); CI pinned to `module-checks.yml@v0.4.0`. Windows use `UI_CLASSES`, so they moved from `wc-r2` to `wc-r3` on their own; nothing hard-codes a revision (test). Core's window placement, keybinding and data-folder helpers are **not** adopted yet (waiting for core 0.5.0).
- **Character pane: classic sheet** (`pane.mjs`, new pure `pane-model.mjs`). Inside the native Foundry window (chrome follows the theme): title with name and *Level N Class · Species · Party* (the party is the group actor the character is a member of), a **Rested** pill (core badge; tooltip names the inn and the benefit from *Rested gives*). Centre: portrait with **Attuned n / max**, an **HP bar** (`system.attributes.hp`: value / `effectiveMax` or max, a striped temporary-HP segment after it, green / amber / red at half and a quarter) and the actor's **coins** (`system.currency` through core's `coins()`, platinum and electrum folded in, ratio from the coins in use). Slot columns are the toolkit's own slots (left Head, Neck, Shoulder, Back, Chest, Shirt, Tabard, Wrist; right Hands, Waist, Legs, Feet, Finger ×2, Trinket ×2); **empty slots show original outline drawings** (helm, pendant, pauldron, cloak, chest, shirt, tabard, bracers, gloves, belt, legs, boot, ring, gem; weapon hands: sword, shield, bow; relic: sun), drawn for this module as stroke-only SVG paths. Filled slots, hands and the item list are core `wc-item-slot`s with the quality border and glow (an MMO-style tooltip colour wins, else core's `quality()` of `system.rarity`). Bottom row: the three weapon sets and the relic slot, the set in hand outlined in gold, stowed sets dimmed. Below: **Attributes** (six scores and modifiers), **Defence** (AC, HP, hit dice `value / max dN`, initiative `init.total`, walking speed `movement.speeds.walk` / `speed` / `walk`, saves `abilities.*.save.value` with proficient saves marked) and **Attack**, which **follows the set in hand** (Ranged set: the ranged weapon; Utility set: spell for a caster, else melee; Melee set: melee, or spell when a caster holds only a focus). Weapons read dnd5e's prepared labels (`labels.toHit`, `labels.damages[0].label`, `labels.range` / `reach`); spells read `attributes.spell.attack` / `dc` and the spellcasting ability. The box's dropdown (Auto / Melee / Ranged / Spell) overrides it for that window. *Equippable items* and *Slot equipped items* are unchanged. **Every existing pane behaviour is kept** (drag and drop, click menus, right-click to remove, weapon-set swaps and blocks, Stow shield, relic slot, comparison tooltips, remembered window size). The sheet sets its own core tokens and bright quality colours on `.wct-frame`, so it stays dark in both themes with no theme selectors (test). The minimum window grows to 540 × 780 (default 580 × 880) for the stat boxes.
- **Option A restyle** (same layouts, core look; `look-model.mjs` `card()` wraps chat cards in core's root):
  - Control panel: core's sidebar shell (`wc-shell`, `wc-side`, `wc-nav` with `aria-current`); arrow keys, Home and End move between tabs (`panel-model.mjs` `navKey`), Space and Enter on the sidebar never reach Foundry's pause key; alerts, primary and danger buttons are core's; the welcome wizard and every tab (Places included) read core tokens.
  - Every window and every DialogV2 (hex travel, vendor-trash dialogs, sell junk, boss phase marks, inn dialogs, map pins, flight import and confirms, cleanup, loot history, coin log, party gold, flight editor, route map, quest editor, health window) carries `...UI_CLASSES`; dialogs also get `wct-dialog`.
  - Loot roll (Need / Greed) card: core tokens, a `wc-item-slot` with the item's quality, core buttons; the "won" lines show a small quality slot. Loot history rows show quality slots and core tables.
  - Vendor trash, boss loot, the batched loot summary, quest cards, rooms and travel-pace requests, rest lines, weapon-swap lines, phase notices, update notes, cleanup and migration cards: wrapped in core's root.
  - Coin log, Split coin and Rent rooms show amounts with core's coins (`api.moneyHTML`, new, experimental; `api.coinRatio()` gives the copper per silver: 100 with three coins, 10 in standard 5e).
  - Quest editor: Foundry's forms on core tokens (the parchment is gone). On-screen quest tracker: core's root classes, still a light-on-dark overlay; its 1.27.2 placement, drag, keys, collapse and reset are untouched. Boss frames: core shapes and tokens, still an overlay that looks the same in both themes. Map pin dialogs follow the theme; ink previews sit on a small parchment disc so dark inks stay readable.
- **Health card short** (`health-card-model.mjs`): with the Wanderer's Satchel active, `api.health()` whispers one summary line (ok / warning / problem counts, core status icons) and an **Open in Wanderer's Satchel** button (opens the Satchel's health window for this module via its `api.health({ window: true, ids })`, else its hub, else the toolkit's window); Run setup stays when macros are missing. Without the Satchel: the full card, now on core's look (no ✓ ⚠ ✗ characters). `api.healthReport()` is unchanged.

**Fixed**
- **Quest levels in longer text** (from the 1.29.0 live test: every quest had level text like *Act 4 · Lv 8*, so `level` stayed null and no difficulty colour showed). `parseLevel` now finds *Lv N*, *Lvl N* or *Level N* anywhere in the text: the number is the level and the whole text is kept for display (the editor shows the text). Ranges after the word (*Lv 3-5*, *Level 3 to 5*), two different levels, and text without the word (*3-5*, *Act 4*, *Heroic*) stay text only with no number (decision: no lower bound taken, so a range never claims a precise difficulty). Version 2 records with a null level read it from their text at read time (`normalizeQuest`), so existing quests get their colour without another migration; the next save writes the number.
- **Reward item rarity blank** when items were added by uuid (`api.quests.create` / `update` with `{ uuid, name, img }`): a compendium's default index has no `system.rarity`. Every save (and create) now fills blank rarities on the GM (`fillRarity`): compendium items from one `getIndex({ fields: ["system.rarity"] })` per pack (Foundry caches it; no document load per item), world and actor items from `fromUuidSync`. Mundane items stay blank.

**Decisions**
- In-world surfaces that must look the same in both themes (the character sheet, the tracker overlay, boss frames) set core's tokens on themselves instead of using theme selectors; everything else follows Foundry's theme through core's tokens.
- Quality colours now come from core (`--wc-q-*`, darkened in the light theme outside the sheet): the same grey / white / green / blue / purple / orange / gold as before in slightly different shades. The quest log's own list and page keep their 1.29 colours.
- The Attack box's manual choice is per window and not saved (no new setting); closing the pane returns it to Auto.
- The quest log window itself keeps its 1.29 stone list and parchment page (already on core's look); only the editor, tracker and cards changed.

**Untested in Foundry**
- Nothing in this release was run in Foundry. Check in a live world (v13 and v14, dnd5e 5.x and 6.x), **each in the dark and the light theme**:
  - Core 0.4.0: the stylesheet loads first; windows carry `wc-ui wc-r3`; a module still on core 0.3.x (`wc-r2`) open at the same time keeps its own look.
  - Character pane: title line (level, classes, species, party), Rested pill and its tooltip, Attuned n / max (over the limit in red), HP bar with and without temp HP and at low HP, coins in three-coin and standard worlds, empty-slot outlines at small and large window sizes, quality borders and glow on slots and the item list, set in hand outlined, stowed sets dimmed, relic slot. Stat boxes: scores and modifiers, AC, HP, hit dice (a multiclass character), initiative, speed (dnd5e 5.x `movement.walk` and 6.x `movement.speeds.walk`), saves with proficiency. Attack box: Melee / Ranged / Utility sets, a caster with a focus, a non-caster in the Utility set, the dropdown override, a weapon with no attack activity. The sheet stays dark in the light theme; window chrome follows the theme. Every old behaviour: drag in and out, click menus, right-click remove, swaps blocked by a shield and Stow shield, Slot equipped items, comparison tooltips, the remembered size (now a larger minimum), an NPC.
  - Control panel: sidebar look, arrow / Home / End keys, Space on a tab doesn't pause, narrow window, Save bar, Features cards, Overview alerts and Fix buttons, Places tab, the welcome wizard.
  - Hex travel, Flight Master and the route map (background image, zoom), flight editor, loot roll card (Need / Greed / Pass, timer, assign, result, the won line), loot history, vendor trash dialog, preview and card (Give to Party), boss loot cards and the batched summary, boss frames (drag, phase ticks, dead), quest editor (drag items, rarity chips, objectives), on-screen tracker (drag, keys, collapse, reset, colours over a bright and a dark map), quest chat cards, coin log (coins, Undo, Clear), Split coin, Rent rooms (total updates as boxes change), rest offer, map pin dialogs and pin card (ink previews), cleanup window, health window, update notes card, old chat cards posted before 1.30 still readable.
  - Health card: with the Satchel active, one line and the button opens the Satchel's health window on the toolkit; without it, the full card; Run setup on both when macros are missing; players never see the button.
  - Quest fixes: a quest with level text *Act 4 · Lv 8* shows *[Act 4 · Lv 8]* coloured by difficulty right after the update; saving it stores level 8; *Lv 3-5* stays uncoloured. `api.quests.create({ rewards: { items: [{ uuid, name, img }] } })` with a compendium item stores its rarity (quality border in the log).

## 1.29.0

The quest log's facelift: a party for every quest, difficulty colours, objective counters, chosen rewards and a quest cap, on wanderers-core's shared UI. One quest data migration (`quests2`). The quest log stays one feature switch (`questLog`); the tracker, glow and map-pin features keep their own.

**Changed**
- **Core 0.3.1 and the shared look.** `vendor/wanderers-core` updated from 0.2.0 to 0.3.1 with the vendor tool (adds `styles/wanderers-ui.css` and `ui-model.mjs`). `module.json` lists the core stylesheet first. The Quest Log window carries `...UI_CLASSES` (`wc-ui wc-r2`), so it is a native Foundry v14 window in the dark and light themes: tabs and party filters are `wc-chip`s, New quest and the tracker switch are `wc-btn`s. Inside it, the quest list (a stone frame with a bevelled rim) and the quest page (parchment with a centred title and a small CSS-drawn flourish) are in-world panels that look the same in both themes (CSS only, no images). The quest editor and the tracker keep their 1.28 look.
- **Quest Log layout.** Tabs Active / Completed / Not given (GM), party chips (GM: *All parties* and each party with *· Lv N*; players get none), Show tracker and its reset button, New quest. Left: *Quest Log (n / cap)* header (one party: its active count over the cap; several parties together: just the count), collapsible zone rows (+/− and a count; folded zones per client in hidden client setting `questZonesCollapsed` = `{ v: 1, zones }`, ≤ 200), rows with a Track box, `[level]` and name coloured by difficulty, *(Ready)* when all required objectives are done, the party's name when several parties are listed (GM: *No party* on quests without one), and a colour legend. Right: party badge (GM: a drop-down to move the quest) and *[4] Even*, title, zone and giver line, Description (summary + text), Objectives (box, text, optional marked, n/m with GM − / +), Rewards (*You will receive:*, *Choose one of these rewards:* with the selection, *You will also receive:* g/s/c coins "to *party*"), item slots bordered by rarity (dnd5e `system.rarity`: mundane grey, common white, uncommon green, rare blue, very rare purple, legendary/artifact orange). Footer: Track switch, Edit, Hide from players, Give / Fail / Reopen, Journal, Delete and **Complete and pay to *party***. No Share or Abandon. Narrow windows stack the list above the page.
- **Tracker**: lists only quests the player can see (so their party's), titles coloured by difficulty with `[level]`, counters `n/m` before an objective's text.

**Added**
- **Parties** (world setting `questParties`, Array of group actor ids, control panel › Quests; empty = the party actor, so the default is the current `partyActor`). Kept out of settings files (`RECORD_SETTINGS`: actor ids) and the wizard.
- **Party visibility**: a player sees a quest only if it is given, not hidden, and they own a member of its party (`canSee`, `quest-log-model.mjs` `visibleTo`). A quest with no party is GM-only. Applied to: journal ownership (per user: Observer for those players, None for everyone else, default None; `questOwnership`), the log, the tracker, the glow, chat cards (whispered to the GMs and the quest's viewers; objective notices too) and map pins linked to a quest (`pinVisible` gets `questOk`). When a group's members (or a member's ownership) change, the leader rewrites those quests' journal ownership (`updateActor`, bails unless `system.members` or `ownership` changed).
- **Numeric level and difficulty**: `level` is a number (`levelText` keeps text that isn't one). Party level = the rounded average of its characters' `system.details.level` (dnd5e). Difficulty = quest level − party level: Trivial ≤ −5, Easy −4..−2, Even −1..+1, Hard +2..+3, Deadly ≥ +4 (one table, `DIFFICULTY` in `quest-log-model.mjs`; colours grey / green / yellow / orange / red).
- **Objective counters** `{ target, progress }` (target 0 = none): GM − / + in the log (op `progress`), auto-tick at the target and untick below it; ticking a counter by hand fills it, unticking drops it to target − 1. The editor has a count field per objective. Players see `n/m`.
- **Chosen rewards**: `rewards.choice` (items) and `rewards.pick` (uuid). A member's owner picks (request `questPick` → the leader checks the sender with `canSee` and party membership, `decidePick`); the GM can pick or clear for them. Pay rewards gives fixed items + the picked item + coin to the quest's party actor (coin logged with *Quest reward: name*), and waits with a warning while a pick is missing. **Complete and pay** completes then pays (and marks the completion card paid).
- **Quest cap** (world setting `questCap`, default 25, 1–200, Quests › Advanced): giving, reopening or moving an active quest beyond the cap warns the GM; it never blocks.
- **`questUpdated` change `"assigned"`** now fires (after the save) when a quest's party changes (op `assign`, or `update` with a new `party`). Moving an active quest to a party posts its *New quest* card to that party.
- API (experimental): `quests.progressObjective`, `quests.assign`, `quests.pickReward`, `quests.parties()`, `quests.difficulty()`; `create` / `update` take `party`, numeric `level`, objective `target`, `rewards.choice`.
- Health check (Permissions): given quests with no party are listed (info); the unreadable-journal check only looks at each quest's own party's players.

**Migration `quests2`** (quest record version 2, `QUEST_VERSION` = `quest-log-model.mjs` `QUEST_VERSION`)
- Runs once on the leader with the quest log on, after `quests1`. Each quest without a party gets the party actor; a level like `4`, `Lv 4`, `Level 4` becomes a number (other text stays in `levelText`); reward items get their rarity; the GM-only record, the journal's public flag (`v: 2`), its ownership and its page are rewritten. Without a party actor the quests become GM-only (the whisper and the health check say so). The Parties setting isn't written (empty already means the party actor).
- Before it runs, records without `v: 2` keep the 1.28 rule (`isLegacy`): every player sees given, unhidden quests. `normalize` reads versions 0, 1 and 2.
- Glow: the stamp leaves out the party and item rarity, and the client's seen record re-baselines once for the new shape (`shape: 2`), so the move doesn't make every quest glow.

**Decisions**
- Parties default: an empty setting means "the party actor" instead of copying its id at migration, so changing *Party actor* later still works for worlds that never set Parties.
- Players have no write path except `questPick`; everything else stays GM-only. The pick is sent with the quest id and the item uuid; the sender is Foundry's user.
- Chat cards for version 2 quests are whispers (players outside the party shouldn't read them); old records still post publicly until moved.
- "Complete and pay" with a reward still to choose completes and leaves Pay rewards (no blocking dialog).

**Untested in Foundry**
- Nothing in this release was run in Foundry. To check in a live world (v13 and v14, dnd5e 5.x and 6.x):
  - The `quests2` move on a 1.28 world: quests get the party actor, levels become numbers, journals' ownership per party, the whisper; a world without a party actor (quests GM-only, health line); nothing glows afterwards for players.
  - The Quest Log in the dark and light themes (top bar follows the theme; list and page look the same in both), a narrow window, the core stylesheet loaded first (no clash with other modules on core 0.3.x).
  - Two parties with different players: each player sees only their party's quests in the log, tracker, journal sidebar, chat cards and map pins; the GM's party chips and *· Lv N*; moving a quest with the party drop-down (players' views update, `questUpdated` *assigned*, the new party gets the card).
  - Adding or removing a member of a group actor updates the quests' journal ownership.
  - Counters: − / + in the log, auto-tick at the target, objective chat line, n/m for players and in the tracker, the editor's count field.
  - Choice rewards: a player picks (with a GM online; refused for a non-member), the GM overrides or clears, Pay rewards refuses without a pick, Complete and pay pays fixed + picked + coin to the party actor and the coin log line, the chat card's Pay button turns into *Rewards paid*.
  - Rarity borders on reward slots (compendium items and world items), the editor's chips.
  - Quest cap warning when giving the 26th active quest to a party; the header count.
  - Zones fold and stay folded after reopening; the Track box in a row and the Track switch on the page; Show tracker / reset still work; objective click → map pin; the Updated glow.

## 1.28.0

Eight quality-of-life tools, each with its own switch on the Features tab (all on by default). The quest data model is unchanged.

**Added**
- **Quest objectives find their map pin** (`questMapPins`, needs the quest log and map pins): clicking an open objective in the tracker, or an objective or the title in the quest log, pans to the quest's map pin (`canvas.animatePan`) and pings it (`canvas.ping`; a GM's hidden pin is panned to but never pinged, since pings are broadcast). Pin on another scene: the GM is offered to view it, a player is told its scene. The tracker's quest title opens the log and also pans to the pin and pings it (only the "no map pin" notice is quiet). (`pins.mjs` `goToQuest`, pure pick in `quest-ux-model.mjs` `pinTarget`.)
- **Updated quests glow** (`questGlow`, players only): a quest whose player-visible view changed pulses with an *Updated* tag in the tracker and the log until opened in the log. Per client (hidden client setting `questSeen` = `{ v: 1, init, seen: { questId: stamp } }`, ≤ 500, in `RECORD_SETTINGS` and `WIZARD_IGNORE`); the stamp hashes the quest's name and the view the user receives, so GM-only changes never glow. The first load is a baseline (nothing glows).
- **Keyboard shortcuts** (`keybindings`): *Open character pane* and *Open the control panel (GM)* in Configure Controls, registered in `init` with no default keys. The quest log's L stays where it was.
- **Coin log** (`coinLog`, GM only): vault bucket `coinLog` = `{ v: 1, entries }`, newest first, ≤ 200 (FIFO), created once by migration `coinLog1`. `api.pay` / `api.addMoney` take `{ reason }` and log the actual change in the purse; every toolkit movement passes one (quest rewards, rooms, flight fares and refunds, vendor trash sales, body / Give to Party coin from Vendor Trash and Boss loot, Split coin). Window: control panel › Loot › Coin log…; **Undo** on the latest 20 (gives back a payment; takes back a credit only if the actor still has it, else refuses and changes nothing; logged; once). `api.coinLog` (`entries`, `open`, `undo`).
- **Split coin** (`splitCoin`): GM dialog from the party (group) sheet's header menu, control panel › Loot, or `api.splitCoin(party?)`; preview of each share, remainder stays with the party, re-checked before moving; logged.
- **Rest after renting rooms** (`innRestOffer`, needs Rested at the inn): after a rental the GM is offered *Long rest everyone*: dnd5e `actor.longRest({ dialog: false, chat: true, advanceTime: false })` for each renter (so `dnd5e.restCompleted` grants Rested as usual), then one optional `game.time.advance` by setting `innRestHours` (default 8, 0–24). Flights still only advance time with *Flights advance world time*.
- **Cost and time before travel** (`travelConfirm`): Hex Travel gets a confirm with cost, time and who pays; the flight confirm gains the same table (gold / silver / copper). Setting `travelConfirmSkip` (Travel › Advanced) skips it for the GM.
- **Hooks for other modules** (`moduleHooks`): `wayfarersToolkit.questUpdated` `{ questId, change }` and `wayfarersToolkit.journey` `{ kind, fromId, toId, fromName, toName, hours, cost: { gp, sp, cp }, partyId }`, fired with `Hooks.callAll` on the GM client that made the change, after saving (README › Hooks).

**Fixed**
- **Escape during a mouse drag of the quest tracker** now cancels it: the tracker goes back to where the drag started and nothing is saved. (1.27.2 only handled Escape with the keyboard grip focused. The key is now watched on the whole page while a drag is in progress, and pointer capture is set and released safely.)

**Untested in Foundry**
- Nothing in this release was run in Foundry. To check in a live world (v13 and v14, dnd5e 5.x and 6.x):
  - Quest tracker: press on the header, move, press Escape before releasing: it snaps back and the spot is not saved.
  - Objective / title clicks pan and ping on the current scene; the other-scene prompt views the scene and pings after it loads; players get the notice; a hidden GM pin isn't pinged.
  - The Updated glow appears for a player after a GM ticks an objective, not after a change to a hidden objective; it clears on opening the quest; nothing glows on the first load after updating; reduced-motion shows an outline instead.
  - The two shortcuts appear in Configure Controls with no keys, and work once bound.
  - Coin log lines for each movement (quest pay, rooms from party and from each, flight, flight refund, sell trash, Give to Party, body coin, Split coin); Undo of a credit and of a debit; refusal when the coin is gone; the `coinLog1` migration on an existing 1.27 world.
  - Split coin from the group sheet header (dnd5e group sheet's header controls) and the panel; remainder; changed purse during preview.
  - Inn rest offer: `longRest({ dialog: false, chat: true, advanceTime: false })` rests without dialogs, posts dnd5e's card, grants Rested; time moves once by the setting; a player-owned character rested from the GM client.
  - Hex Travel and flight confirms (GM and player booking), the skip setting.
  - Both hooks fire once, on the acting GM client, with the documented payloads (Red Book listening).

## 1.27.2

**Renamed**
- The display name is now **Wanderer's Toolkit** (was Wayfarer's Toolkit), to match Wanderer's Satchel and wanderers-core. Display name only: nothing to do for users, and world data is untouched. The module id (`wayfarers-toolkit`), settings and flags, the API and hooks, macro pack ids and the repository address are unchanged. Older worlds keep their existing "Wayfarer's Toolkit" macro folder, item folder and GM-only journal; new ones get the new name.

**Fixed**
- **The on-screen quest tracker covered buttons** and couldn't be moved. It was a fixed box at the top right of the canvas (72 px down, 320 px in from the right edge on v14), over whatever core or module buttons sat there. (The Quest Log window itself was already a normal, draggable window.)

**Changed**
- **Drag the quest tracker** by its title bar (mouse, pen or touch), or focus its grip with Tab and move it with the **arrow keys** (Shift: bigger steps, Home: back to the start, Escape during a drag: cancel). It's kept inside the window, and again after the window is resized, the sidebar is collapsed or the UI scale changes. Each person's spot is remembered on their own computer (hidden client setting `trackerPos`: `{ v: 1, fx, y }`, the across position as a share of the free width so a tracker against the right edge stays there, and its top in px).
- **Where it starts:** the first spot, from the top right next to the sidebar, that overlaps none of Foundry's own interface (scene controls, scene navigation, players list, hotbar, camera dock and anything else in the left, right and bottom interface columns), 16 px clear. With nothing in the way that's the top right corner just left of the sidebar.
- **Put it back** with a double-click on its title, Home on its grip, the reset button next to **Show tracker** in the quest log, or *control panel › Quests › Reset quest tracker position*.
- **Close it with its X** and bring it back with **Show tracker** at the top of the quest log (it shows *Tracker shown* while it's on). Both just change this client's **Show the quest tracker on my screen** setting. Tracking a quest (by hand or automatically when a quest is given) never reopens a closed tracker; ticking Track while it's closed shows a short notice saying where to turn it back on. (Chosen over a "reopen when tracking" setting: the user closed it on purpose.)
- Collapsing it with its arrow is still remembered per client (`trackerCollapsed`).
- API (experimental, this client only): `api.quests.showTracker(on)` (omit `on` to toggle) and `api.quests.resetTrackerPosition()`.
- Turned off (Quest log or Quest tracker feature off), nothing is drawn and no resize or settings listeners are added. The control panel's reset button only shows when both are on. **Remove toolkit data › Reset the module's settings** resets `trackerPos` with the other client settings; it's left out of the welcome wizard and of settings files (`RECORD_SETTINGS`).

**Untested in Foundry**
- Nothing in this release was run in Foundry. To check in a live world (v13 and v14):
  - Dragging the tracker by its title with a mouse and on a touch screen; it doesn't pan the canvas or select tokens while dragging, and stays inside the window.
  - Grip keyboard moves (arrows, Shift+arrows, Home), and that the arrows don't also pan the canvas while the grip has focus.
  - The default spot with the sidebar open and collapsed, with the camera dock, and with a big UI scale; that it doesn't cover scene navigation (~x 104–304 px on v14), the players list or the hotbar.
  - The saved spot after a reload and after resizing the browser; double-click reset.
  - The X, the log's Show tracker / Tracker shown switch and its reset button, the control panel reset button, and that ticking Track with the tracker closed leaves it closed (and shows the notice).
  - The tracker above the canvas and interface but below application windows (z-index 50) and tooltips.

## 1.27.1

**Fixed**
- **The first health check after loading a world still took about 20 s** with boss loot tables, and the Boss loot section could time out ("no answer within 20 s"). The check loaded every table result's item from its compendium, and the server answers those one after another (about a quarter of a second each, so ~100 results took 25–30 s). It now only asks whether each item exists, using the compendium's index (already loaded, or fetched once per compendium), and checks the bosses side by side. Measured on a test world: 109 results checked in about 1 ms instead of ~28 s. Dropping loot is unchanged (it still loads the items it draws).
- **`api.healthReport({ timeoutMs })` ignored a caller's longer limit in practice** (the hub module passed none, so the toolkit's own 20 s per section fired before the hub's "Still checking…" and its longer first-run limit). The toolkit now uses the caller's `timeoutMs` per section (clamped to 1 s – 5 min) and keeps 20 s only when none is given.

**Not changed (checked)**
- The GM-only records stay in their None-ownership journal. A GM-only world compendium was tested as a replacement on Foundry 14.369 and does **not** keep data from players: a player's client lists the pack, and `getIndex`, `getDocuments`, `getDocument` and `fromUuid` all return the full entry (flags and pages) over the socket. Moving there would not help.

**Untested in Foundry**
- The 1.27.1 health check itself on a freshly loaded world (the new existence check was compared live against full lookups for all 109 boss loot results and agreed; the full section was not timed on a cold load).
- A boss loot result pointing at a world item or an embedded item (index path / fallback path) in a live health check.
- The hub module's combined health check with its budget passed through (needs Wanderer's Satchel 0.2.1).

## 1.27.0

**Moved to the shared core**
- The toolkit now runs on **wanderers-core 0.2.0**, the small library its sister modules share, bundled in `vendor/wanderers-core/` and pinned in `wanderers-core.lock.json` (CI fails if the copy differs from the pin). Core now does: the feature switches, debug logging, the "one GM client acts" rule (replacing the toolkit's own 1.25.1 version), checked socket requests from players, the update notes logic, the health report format and the shared **Table Tools** tab in Scene Configuration.
- Every player request (flights, travel pace, room requests, long rests, loot roll choices, map pin changes) is read through a schema: unknown kinds, unexpected fields, wrong types and oversized payloads are refused, each user is rate-limited, repeats are dropped. The sender is always Foundry's own; there's no `userId` in any message any more.

**Changed**
- **Inns are their own records** (several per scene). Each has a name, a room price per person per night (5s by default), an optional innkeeper (a token: its HUD gets a **Rent rooms** button) and, on v14, an optional Region. Add them in the scene's **Table Tools** tab or with **Make innkeeper here…** (mug button) on a token's HUD. Players can still ask for rooms. Your existing Inn scenes become one inn each, automatically.
- **Scene options moved to the Table Tools tab** of Scene Configuration (shared with the other modules): title card, Dungeon and inns. They're no longer on the Basics tab.
- **Settings export / import is gone from the toolkit**: the hub module saves every module's settings in one file. Nothing you set is lost.
- **Permission checks are always part of the health check** (no longer a switch).
- **Session Start and Who's online moved to the Red Book module.** The toolkit no longer has them (no macros, no Hub panel, no hooks). Your settings and Hub scenes stay where they were, so Red Book picks them up.

**Fixed (security)**
- **Quest secrets stayed readable by players** once a quest was given: hidden objectives and GM text were in the quest's flag and page, which players' clients receive. The full quest now lives in the GM-only records; players' copy holds only what they may see (nothing for a quest that isn't given or is hidden).
- **Hidden GM map pins were readable** in the scene's map note data. A hidden pin is now only a GM-only record; its map note is made when you reveal it (and removed when you hide it again).
- **A player could give their own character Rested.** Rentals are now recorded on the GM's side, and the long-rest benefit is checked against that record.
- **Requests fell back to a user id in the message**; now a request from an unknown sender is refused.
- **Players could fake notices** ("your flight was booked", "your pin was refused", quest objective lines). Notices are now accepted only from the acting GM client.
- **Spoilers in world settings**: the full flight network (locked points), party gold snapshots and the loot history were world settings every client could read. They're now GM-only; players get only the unlocked flight points.
- **GM tools in the API** were callable by players (including `api.trash.preview` and the whole internal Vendor Trash module spread into `api.trash`). `api.trash`, `api.bossLoot`, `api.gold`, `api.cleanup`, `api.addMoney` and the boss loot preview now refuse players.

**Fixed**
- **Players saw no map pins at all** on Foundry v14 (v14 hides notes without a journal from players). Pins now decide their own visibility.
- **The first health check could take about 30 seconds** with boss loot tables (each item was looked up one after another). Lookups now run eight at a time, once per item per check.

**New**
- `api.healthReport()` returns the health check in the shared health format (`[{ title, lines: [{ level, text }] }]`, plain text, GM only); see README › Public API.
- `api.inn` gains `inns`, `all`, `rental`, `save`, `remove`, `makeInnkeeper`; `api.migrations` (`status`, `run`); `api.settingsRecords()`.
- Remove toolkit data: a new box (off by default) deletes the GM-only records journal; *Delete map pins* also removes hidden pins.

**Removed (API)**: `api.sessionStart`, `api.whosOnline`, `api.online`, `api.settingsIO`, the hooks `wayfarers-toolkit.playerCountChanged` / `allPlayersOnline` (Red Book fires its own, and the old names while the toolkit has no `api.online`), and the internal Vendor Trash functions under `api.trash` (the listed ones remain).

**Data moved once** (on the acting GM's first load; each move runs once and is recorded; a whisper lists what moved; README › *Upgrading to 1.27* has what each keeps):
- Inn scenes → inn records (old scene setting kept).
- Flight network, gold snapshots, loot history → GM-only records (the setting keeps the players' view; snapshots and history settings emptied).
- Quests → full data in GM-only records, journal flag and page rewritten to the players' view.
- Hidden GM pins → GM-only records, their map notes deleted (revealing restores them with the same id).
- Characters already Rested → a rental record, so they keep the benefit.

**CI**: tests run through core's reusable `module-checks.yml@v0.2.0` (core pin, syntax, ESLint, tests; the JSDoc type step is off until the scripts are JSDoc-clean). The Release workflow has a read-only build job and a separate upload job (the only one that can write), every action pinned by commit SHA, the core pin checked against the published release, install scripts off, and `vendor/` in the zip without core's dev tools. A `package-lock.json` is now committed, so the release installs with `npm ci` (pinned, reproducible).

**Tests**: `tests/v127.test.mjs` (request schemas refuse payload user ids, free flights and unknown fields; notices; update notes on core; settings IO and the permission switch gone; health report format; bounded parallel lookups; inn records, cap, legacy move; Rested only with a GM-side rental, rentals capped; Table Tools parts; GM-only store normalizer, caps and deletions; quests' public view strips hidden objectives and secret sections, nested ones too; flight network players' view; hidden pins as records, the move from notes, pin visibility without a journal; gated APIs; Session Start / Who's online gone with their settings still registered). The old GM-session tests moved to core with the code. `tests/house.test.mjs` checks the workflows (SHA pins, one writer job, vendor in the zip).

**Untested in Foundry** (needs a live world, v13 and v14):
- **Map pins visible to players**: a party pin and a revealed GM pin show on a player's client (no journal entry), on the right level in a scene with levels; double-click opens the card.
- **Hidden pins absent from player client data**: with a hidden GM pin on the viewed scene, a player's `canvas.scene.notes` has no note for it and nothing in `game.journal` / world settings names it; the GM sees it as a faint ringed mark, opens it with the Map pin tool, edits, moves, reveals (players see it at once) and hides it again (the note goes away for players).
- **Quest GM text absent from player clients**: a given quest with a hidden objective and a secret section in its description: on a player's client the quest's flag and journal page contain neither; a hidden or ungiven quest's flag and page are empty for players. The GM's quest log still shows and edits everything; ticking, revealing and completing still work and announce as before.
- **Inn records, renting and Rested**: add an inn in Table Tools, and with Make innkeeper here… on a token; rent from that token's HUD, from the Places tab and the macro; several inns on one scene ask which one; a player's room request whispers a button; a long rest after renting grants the benefit once; a Rested flag set by a player on their own character (console) gives nothing and is cleared on their next long rest; an inn with a Region counts only inside it.
- **Migrations from the dev world's existing data**: on the first 1.27 load as GM, the whisper lists the moves; Inn scenes appear as inn records with the same name and price; the flight network, gold snapshots and loot history are all still there for the GM (editor, map, Party gold, Loot history) while a player's client sees only unlocked flight points; existing quests keep their hidden objectives for the GM; hidden pins still exist for the GM and are gone from players' scene data; a character Rested before the update still gets the benefit. Reload: nothing moves twice. `api.migrations.status()` shows every move done.
- **Table Tools tab**: the section shows title card, Dungeon and inns for the tools that are on (and not at all with all three off), saves the title card and Dungeon fields with the window, inn buttons save at once; other modules' sections appear in the same tab; nothing is added to the Basics tab any more.
- Two GM tabs as the same user: one client acts (one whisper per request, one migration run); `api.healthReport()` on the GM returns sections, a player gets `[]`.
- Notices: a player's refused pin and a booked flight show the message on that player only; objective lines show for everyone; a player can't fake one from the console.
- The GM-only records journal: created on first use with ownership None; the health check warns if you share it.
- Red Book 0.3.0 alongside: it reads the old Session Start / Who's online settings and Hub flags once; the toolkit's settings panel no longer shows them.

## 1.26.0

**New**
- **Map pins** (feature `mapPins`, on by default; turn it off under Features). The party's own marks on any scene, in an ink-on-parchment, hand-drawn style. A **Map pin** button in the token controls arms one click on the map: an empty spot opens the pin dialog (label, short note, mark, ink, optional quest link; for the GM also *Whose pin* and *Hidden from players*), a pin opens its card. Double-clicking a pin opens the card too. Card buttons: Open quest, Edit, Move (then click the new spot), Reveal / Hide (GM pins), Delete, each shown only when that user may use it.
- Eight original SVG marks in `styles/pins/` (pin, flag, camp, cave, question, cross, skull, star), white strokes tinted by the Note's `texture.tint` to one of six inks (`INKS`). Our Note class (wrapping the configured one, so dnd5e's `Note5e` look for journal-page notes is kept) hides the dark icon square and adds an optional parchment disc (`pinsPaper`).
- **Storage:** core Note documents with `flags.wayfarers-toolkit.pin = { v: 1, kind: "party" | "gm", hidden, label, text, icon, ink, quest, by }` (`PIN_VERSION`; read through `normalize`, missing `v` = 0 reads the same). `global: true` so pins show on every layer while map notes are toggled on; v14 `levels` gets the viewed level when the scene has it. The Note's own `text` is blank while a GM pin is hidden. New pins are 40 px (`pinsSize`, 32–96: core needs `iconSize` ≥ 32).
- **Players need no permission.** Players never write Notes: create / update / move / delete go over the module socket (`action: "mapPin"`, with a request id) to the acting GM client (`isActiveGM()` after `settled()`, repeats dropped by `firstTime`). The GM client reads the request strictly (`readRequest`: numbers, 16-character ids, unknown fields dropped, kind/hidden/author never taken from the request), then `decide()` checks the sender (Foundry's sender id) against the pin and the world: the scene must be the one the player is viewing, the point is clamped into the scene, a player's quest link must be a quest that player can see (else it's dropped), and players can add at most `PINS_MAX` (300) pins per scene. A refusal goes back as `mapPinResult` and shows as a warning; no GM online: nothing is sent and the player is told.
- **Who may do what** (`can()`): GMs everything; players view party pins and unhidden GM pins, and (with `pinsPlayers`) create, edit, move and delete party pins (with `pinsEditAll` off, only their own). Hidden GM pins aren't drawn for players at all (`isVisible`), and the card won't open for them.
- **Quests:** the card shows and opens the linked quest only when `Quests.canSee` allows it for that user (`questFor`); the dialog offers only quests the user can see, and an existing link to a quest the user can't see is kept without being shown. Pins of completed or failed quests fade (`pinsDimDone`); a quest change redraws only its pins (`updateJournalEntry` bails unless the quest flag or ownership changed).
- **Map notes display:** core hides notes off the Notes layer unless *Toggle notes* is on. With `pinsShowNotes` (on), each browser turns it on once the first time it shows a scene with pins (`pinsNotesShown`, client scope, never exported); turning it off again sticks.
- Settings (control panel › Places › Advanced): `pinsPlayers`, `pinsEditAll`, `pinsDimDone`, `pinsSize`, `pinsPaper` (reload), `pinsShowNotes`.
- Health check (*Map pins*): pin count, hidden count, whether players can place pins, a warning if another module replaced the Note class after us, a note when no GM is online. Permission checks list players' map pins as a socket user.
- Remove toolkit data: new *Delete map pins* box (unticked by default) deletes every pin Note on every scene, one delete per scene (`pinsByScene`).
- API (experimental): `api.pins` = `place`, `create`, `update`, `move`, `remove`, `reveal`, `open`, `list`, `read`, `icons`, `inks`.

**Tests**: `tests/v126.test.mjs` (flag normalizer and schema version, hidden pins only GM pins, Note data and blank label while hidden, icon files exist; permission decisions incl. both sub-toggles; relay reading drops kind/hidden/author and malformed payloads; GM decision: author/kind set by the GM, clamping, per-scene cap, scene check, level check, quest links a player can't see dropped, an existing link kept; GM form and reveal rules; quest guard returns nothing for unseen quests, dimming only for finished ones; hit test; notes-display rule; cleanup grouping and tally; socket permission line; wiring, docs and version). `tests/v125.test.mjs` no longer requires 1.25.0 to be the newest note.

**Untested in Foundry** (needs a live world, v13 and v14):
- The Map pin tool shows for the GM and for players (and not for players with *Players can place map pins* off); click to place, click a pin to open it, Esc cancels, a drag doesn't place a pin; the cursor turns to a crosshair.
- `canvas.canvasCoordinatesFromClient` gives the right spot at any zoom; pins land where clicked; Move puts the pin where clicked.
- Our Note class wrapping dnd5e's `Note5e`: pin marks draw tinted with no dark square and with the parchment disc; journal-page notes still look as before; double-click opens the pin card (`_canView` lets players double-click a pin with no journal entry), and journal notes still open their journal.
- A player (no *Create map notes* permission) places, edits, moves and deletes a party pin through the GM; with no GM online they get the message and nothing changes; with two GM tabs open the pin is created once.
- A hidden GM pin: faint for the GM, not drawn for players, no label in any list; Reveal shows it to players at once (no reload), Hide hides it again.
- Quest link: a player sees and opens only quests they can see; a pin linked to a hidden quest shows no quest line to players; completing the quest fades the pin on every client; reopening it restores it.
- *Show map notes when a scene has pins* turns the notes display on once in a fresh browser; turned off by hand, it stays off after reload.
- Scenes with v14 levels: a pin is placed on the viewed level and only shows there.
- Remove toolkit data: the dry-run count for *Delete map pins*, then the delete.

## 1.25.1

**Fixes**
- **Sell all junk total could be one copper out.** The confirm window added up Item Piles' per-item prices (fractions of the primary coin) and rounded the sum once, while each line and the payment are whole coins per item, so with several cheap items the shown total could differ from the lines by a copper. Each price is now rounded to whole smallest coins first and the whole coins are added (`J.totalSmallest`, `J.smallestRate` in `junk-rules.mjs`), so the total equals the sum of the lines. No setting or API change.
- **One GM logged in on two tabs did everything twice.** Every client of the active GM user thought it was the active GM, so a long rest after renting a room posted two "wakes Rested" cards and gave Heroic Inspiration twice, a room request whispered two cards, and any other automatic GM write (travel pace requests, players' flights, loot rolls, vendor trash, boss loot, quests, coin conversion, update notes) could run once per tab. GM clients now take a random session id at load and announce themselves over the module socket (a ping on load and every 2 s, answered by the other GM clients; a goodbye when the tab closes; a re-check on `userConnected`). Among the live sessions of the active GM user the one started first (ties: lowest id) acts, and `isActiveGM()` is true only there. A client always counts itself, so a lone tab acts by itself 0.8 s after load (ready-time work and socket requests wait for that moment; there is no election to deadlock). A closed leader tab hands over at once, a crashed or disconnected one after two missed pings (about 4 s); liveness is measured against the client's own pings, so a background tab the browser slows down isn't dropped by mistake. Open loot roll timers are picked up by the client that takes over. No setting: this is a correctness fix with no behaviour anyone would want off, and a single-session world behaves as before (apart from the 0.8 s wait after load).
- **Requests are handled once.** Socket requests (`roomRequest`, `restedRest`, `paceRequest`, `flight`, `lootChoice`, `lootClose`, `lootAssign`) carry a random request id `rid`; the acting client remembers the last 200 ids (`SEEN_MAX`) and ignores a repeat. The room request and pace request whispers and the "wakes Rested" card are stamped with it (`flags.wayfarers-toolkit.<roomRequest|paceRequest|restedRest>.rid`, removed by Remove toolkit data's chat message flags), and a card with the same id isn't posted again; a long rest already being applied to an actor on the client is not applied a second time. Requests from older clients (no id) are handled as before.
- Health check (*GMs*): says when you're logged in on several clients and whether this one acts. Pure logic in `scripts/gm-model.mjs` (`leaderOf`, `isLeader`, `aliveCutoff`, `prune`, `readSessionMessage`, `applySessionMessage`, `seenCache`, `requestId`, `cardExists`).

**Changes**
- **Zone title cards use the navigation name.** A scene with no custom *Title* now shows its navigation name, falling back to the scene name when the navigation name is empty (was always the scene name). The scene configuration's Title hint and placeholder say so.

**Tests**: `tests/v125-1.test.mjs` (the old float-sum total is off by one copper; the new total matches the lines, stays an integer; smallest coin rate; GM sessions: a lone client leads with nobody heard, the earliest session leads and both clients agree, other users' sessions don't count, a silent leader drops out after the cut-off, session messages read strictly, ping/here/bye update the table, request ids: repeats ignored, missing ids pass, the cache is bounded, stamped cards count as posted, every player request carries an id); `tests/v122.test.mjs` (title falls back to the navigation name, then the scene name).

**Untested in Foundry** (needs a live world): a Sell all junk sale with many low-value items against a real merchant, checking the confirm total against the coin actually paid; a title card on a scene with a navigation name and no custom title. Two GM tabs open as the same user (and one player): rent a room and long rest the character (from the player, and from each GM tab): one "wakes Rested" card and one Heroic Inspiration; a player's room request gives one whisper; a travel pace request and a player's flight give one whisper / one flight; a loot roll settles once; the health check on each tab says which one acts; close the acting tab and check another tab takes over within a few seconds (a room request then gets its whisper, and an open loot roll still settles when its time runs out); a single GM tab still handles a room request right after load.

## 1.25.0

**New**
- **Who's online panel can be moved.** The HUD panel (Hub scenes) is dragged by its title; each user's spot is stored in a new client-scope setting `onlineHudPos` (`{ left, top }`, that browser only, not exported or imported) and clamped to the window on render, on load and on window resize (`M.clampPos`, 8 px margin), so it can't end up off screen. Double-click the title (or `api.online.resetPosition()`) to go back to the default. New world setting `onlineDrag` (*Who's online panel can be moved*, on; Places › Advanced); off ignores saved spots and the title isn't a handle.
- **New default position.** In Foundry v14 the scene navigation is a column right of the scene controls (about 104–304 px from the left), and the old *Top left* (fixed 120 px) sat on top of it. Positions are now computed in `online-model.mjs` (`anchorPos` / `placePanel`) from the measured `#scene-navigation`, `#scene-controls` and `#players` rectangles: *Top left* starts 8 px right of the navigation (falls back to the controls, then 320 px), *Top centre* never overlaps it, *Bottom left* sits right of it, level with the top of the players list. The panel is positioned with inline `left` / `top`; the `pos-*` CSS classes are gone.
- **Flight route map zoom and pan.** Mouse wheel zooms around the cursor (0.5× to 4×, `Flight.MAP_ZOOM`; at most 2× per wheel event, line and page wheel modes handled), dragging the empty map pans (an invisible `rect.wct-fm-pan` under the drawing; pointerdown on a point still starts the GM's point drag, buttons are outside the SVG), **Reset view** button (disabled at the plain view). Background picture, routes and points share one `<g class="wct-fm-view">` transform, so the 1.23 background stays lined up. Point drags convert the cursor through `Flight.viewToMap`, so `pos` stays in the same 0–1 space and Save layout is unchanged at any zoom. The view lives on the window only (reset on close, kept across redraws while open), never written to the world. Pans are clamped so at least a quarter of the map stays in view. New world setting `flightMapZoom` (*Zoom and pan the route map*, on; Travel › Advanced). Players get it too. Pure maths in `flight.mjs`: `zoomAt`, `panBy`, `clampView`, `viewToMap`, `mapToView`, `wheelFactor`, `isZoomed`, `viewTransform`.
- API: `api.online.resetPosition()` (experimental).

**Tests**: `tests/v125.test.mjs` (anchor positions clear the nav column, clamping on small and resized windows, saved-position handling and the drag toggle; zoom around the cursor keeps the point under it, min/max, pan clamping, view ↔ map round trips, a dragged point's `pos` matches at any zoom, wheel factors; settings rows, labels, SKIP/WIZARD_IGNORE, update note).

**Untested in Foundry** (needs a live world): dragging the panel by its title with pointer capture and the double-click reset, the saved spot after reload and after a window resize, the default spot on a player client and with the sidebar collapsed or the scene navigation hidden; wheel zoom and empty-map panning on GM and player clients (including trackpads), point dragging and Save layout while zoomed, the background picture following the zoom, Reset view, and that a click on a point name or the Flight Master button isn't taken as a pan.

## 1.24.0

**Changes**
- **Remove toolkit data** now also removes the *Rested* status icon Rent rooms adds (with Actors ticked), Hex Travel's trip counter on the tracker journal (with Journals ticked), and, in a new unticked-by-default category, toolkit flags on chat messages (loot, loot roll, quest, health and update cards; the cards stay, their buttons stop working). `api.cleanup.remove({ messages: true })`.
- Boss frames: token and actor updates outside a started combat no longer queue a frame redraw, and phase-mark checks bail out on clients that aren't the active GM. Boss loot's actor-HP hook bails out on non-active-GM clients before walking the scenes' tokens. No change in behaviour.
- Quest data (`flags.wayfarers-toolkit.quest`) now carries a schema version `v: 1`, written the next time a quest changes. Older quests (no `v`) are read as before.
- `module.json`: dnd5e verified on 6.0.6. Gold snapshots cap is now a named constant (`SNAPSHOTS_MAX`, 50; unchanged); loot history stays capped at 500.
- Release workflow: fails at once, with a clear error, if the release tag isn't `vMAJOR.MINOR.PATCH` (for example `v1.24.0`).
- README: *Public API and hooks* section marking each API and hook stable or experimental.

**Tests**: `tests/house.test.mjs` (snapshot and history caps, cleanup's Rested effect and tracker-flag matchers, quest schema version, module.json compatibility, tag format).

**Untested in Foundry** (needs a live world): the new cleanup categories (deleting a Rested effect on a linked actor and on an unlinked token's own actor, unsetting `flags.world.trackers`, stripping chat message flags), and boss frames still redrawing when a boss is crowned or its HP changes during combat.

## 1.23.0

**New**
- **Flight map background** (new feature *Flight map background*, on by default, needs the Flight route map and Flight Master). A picture from the world's files (for example a continent or region map; nothing is bundled) is drawn behind the route map's routes and points, for the GM and for players. World settings (control panel › Travel › Advanced, shown while the feature is on): `flightMapImage` (Foundry file picker, images; blank = no picture), `flightMapFit` (`contain` fit inside / `cover` fill, may crop / `stretch`), `flightMapOpacity` (0.1–1, default 1), `flightMapScale` (0.25–4, default 1, around the centre), `flightMapOffsetX` / `flightMapOffsetY` (−1 to 1, share of the map's width / height). The picture fills the same box the points' saved `pos` (0 to 1) span, so the GM drags points onto it and **Save layout** as before; players see the same positions. Changing a setting redraws an open map (unless the GM has unsaved drags). A GM-only **Background…** button on the map opens the Travel tab. Pure placement maths: `Flight.mapBackground` / `Flight.MAP_FITS`. Off, or no image: the map is unchanged.
- Health check (section *Map, pace, gold and settings*): the picked image and fit, a note when the feature is on with no image, a warning when the route map is off. The settings are included in settings export / import and reset by Remove toolkit data.

**Tests**: `tests/v123.test.mjs` (off/blank, fit values, scale and offset maths, clamping, alignment with point positions, panel rows, update note, no publisher names). Two older tests that assumed 1.22.0 was the newest update note now look the note up by version.

**Untested in Foundry** (needs a live world): the `<image>` drawn in the map's SVG on v14 (GM and player clients), the `<file-picker>` image control on the Travel tab, the redraw when a background setting changes, and dragging points over the picture.

## 1.22.0

Builds on 1.21.0 (which includes the Session Start recap removal).

**New**
- **Zone title cards** (new feature *Zone title cards*). On scene activation (`updateScene` with `active: true`, shown once that client's canvas has drawn the scene) a title card fades in over the canvas: scene title (default the scene name), optional subtitle and ornament line, centred in the upper third, fixed overlay with no layout shift, instant with `prefers-reduced-motion`. Optional sound per scene, or a world default (no bundled audio). Per scene: *Title card* fieldset in the scene configuration (`flags.wayfarers-toolkit.zoneTitle = { show, title, subtitle, sound }`). World settings (control panel › Places): `zoneTitleTrigger` (activation / every view), `zoneTitleAudience` (everyone / players only), `zoneTitleAll`, `zoneTitleSeconds`, `zoneTitleStyle` (classic / plain), `zoneTitleSound`, `zoneTitleVolume`, `zoneTitleOnLoad` (off: the scene already active at world load shows nothing). API: `api.zoneTitles.show(scene | { title, subtitle, sound })`, `api.zoneTitles.config(scene)`.
- **Who's online** (new feature). A board of connected users with their assigned character's portrait and name (or user name and colour), updated on `userConnected` and user/character changes. A HUD panel on scenes with *Hub scene (show who's online)* ticked (`flags.wayfarers-toolkit.hub`), and a window (`api.whosOnline()`, new shared **Who's Online** macro). "Everyone's here" when every user who counts is online (`onlineCount`: players / players with characters (default) / listed users, `onlineList`); position `onlinePosition`. Hooks `wayfarers-toolkit.allPlayersOnline` and `wayfarers-toolkit.playerCountChanged` with `{ online, expected, all, missing, users }`, on every client; documented with an example for a GM's own tile. API `api.online.read()`. Writes nothing.
- **Rested at the inn** (new feature). Per-scene *Inn* fieldset (`flags.wayfarers-toolkit.inn = { on, name, price }`; price per person per night, default `innDefaultPrice` 5s, read with the coin system and fare unit). **Rent rooms** (GM): control panel › Places, new **Rent Rooms** macro (shared, for player requests), `api.rentRooms({ scene, actors })`: dialog with the party's characters (party actor members, else player-owned characters on the scene), price and live total; pays from the party actor (default) or each character (`innPayFrom`), all or nothing; sets `flags.wayfarers-toolkit.rested = { scene, inn, at }` and posts "The party takes rooms at … Rested." On `dnd5e.restCompleted` for a long rest, a Rested character gets `innBenefit`: Heroic Inspiration (`system.attributes.inspiration`, default), one extra Hit Die (largest spent class die, `system.hd.spent − 1`) or temporary HP equal to character level (not stacking), then Rested clears. Away from an Inn scene it still applies with `innLastsAnywhere` (on); otherwise it's lost. A player's own rest is sent to the active GM (socket `restedRest`, checked for ownership). Rested marker (*zzz*) in the character pane; optional *Rested* token status (`innStatus`, off, reloads). Players on an Inn scene can ask for rooms (socket `roomRequest`, setting `innRequests`): GM whisper with a *Rent rooms…* button.
- Control panel: new **Places** tab (5 basics, the rest under Advanced) with *Preview title card*, *Who's online…* and *Rent rooms…* buttons. Health check: section *Title cards, who's online and inns* (trigger and audience, no-card-ever warning, Hub scene count, who's here, list names that match no user, inns, inns without their own price, unreadable prices, no party actor to pay from, who's Rested). Permission checks: the socket, Rent Rooms / Who's Online macros and characters for Rested. Remove toolkit data covers the new scene and actor flags.

- **Vendor trash has weight** (Vendor Trash; settings *Vendor trash has weight*, on, and *Weight multiplier*, 1; control panel › Loot › Advanced). Trash used to weigh nothing, so players could carry unlimited junk. When a trash item is created (on a body, or when given to the party) and its weight is 0 or missing, it gets one from a table in `trash-rules.mjs` (`weightFor`), by name keywords, then document type and armour subtype, in pounds: coins, rings, trinkets 0.1; cloth, paper, feathers, petals, dust 0.1; teeth, fangs, claws, talons, scales 0.25; bones, shells, chitin 0.3; flasks, vials, mugs, pouches 0.5; skulls 1; meat and flesh 1; horns and wings 1; ore and stone chunks 1.5; hides and pelts 3; broken weapons 3; broken armour 2 / 3 / 5 (light / medium / heavy), other equipment 1; anything else 0.5. A made object beats its material ("Leather Pouch" is a pouch, "Bone Ring" a ring). An item that already has a weight is never changed. The weight is `system.weight = { value, units }`; it uses the item's own unit, else kg when dnd5e's metric weight setting is on (converted with dnd5e's own unit table, 1 kg = 2.5 lb). **Backfill** trash already on actors or piles: `api.trash.applyWeights(actorOrTokenOrArray)` (GM; default the controlled tokens) fills in weights on items flagged as vendor trash only, and works even with the setting off. Tests: `tests/trash-weight.test.mjs`.

**Fixes**
- The **Travel Pace** macro icon pointed at a core icon that does not exist in Foundry v14 (`icons/environment/settlement/signpost.webp`, 404). It now uses `icons/skills/movement/feet-winged-boots-brown.webp`. Run setup creates new macros with the new icon; an existing world macro keeps its old icon until you change it.

**Untested in Foundry** (needs a live world): weights on real trash items (the dnd5e 6.x `system.weight` shape and metric units were read from dnd5e source, not run) and `applyWeights` on a real pile; the title card overlay, its timing on activation versus view, and the scene-config fieldsets (v14 scene config tab names); the HUD panel and window, the hooks firing on connect and disconnect; the Rent rooms dialog (live total via DialogV2's `render` option), coin deduction on real actors, the rest hook on dnd5e 6.x for players and GMs, the status icon, the room-request card.

## 1.21.0

**Changes**
- **Session Start: recap removed.** The Session Start window now only picks the scene, activates it for players (tick) and unpauses (tick), and still writes "Session started" to the Travel Log. Gone: the recap text box, *Post recap to chat*, the "Previously, in …" chat message and the edits to the tracker's *Session Recap* page.
- Run setup no longer creates a *Session Recap* tracker page, so the health check and Run setup no longer report it missing. Existing *Session Recap* pages are never touched or deleted; the 1.21.0 update notes tell the GM they can delete it.
- **Campaign name** (`campaignName`) was only used in the recap. It no longer shows on the Travel tab or in the welcome wizard (step 3 is now just the coin system). The setting stays registered under the same key so stored values are kept and settings files still import.
- Feature hint, feature card, tracker journal hint and README updated to match.

**Checked in a live world (v14 build 369, dnd5e 6.0.6, Item Piles 3.3.4)**
- Item Piles hook names used by Sell all junk (`item-piles-openInterface`, `renderMerchantApp`, `app.merchant`, `app.recipient`) and the comparison tooltips (`item-piles-mouseHoverPileItem` / `MerchantItem` / `VaultGridItem` and their `mouseLeave` pairs, called with the row element and the item) match Item Piles 3.3.4. No change needed.
- Flight route map, Travel pace, Party gold, Loot history, character pane, settings import preview and the health check open and close with no toolkit console errors.

**Untested in Foundry**: the new Session Start window itself (run it once after updating).

## 1.20.0

**New**
- **Flight route map** (new feature *Flight route map*, needs Flight Master). An SVG map of the flight network, opened from a map button in the token controls (everyone), the new **Flight Route Map** macro (shared with players), *control panel › Travel › Flight route map…* or `api.flight.map()` / `api.flightMap()`. Players see unlocked points and the routes between them; locked points are hidden, or with the new **Locked flight points on players' map** set to *Greyed out, unnamed*, shown as *Unknown* with dashed routes and no fare or hours. The GM sees every point, drags points to arrange the map and saves the layout into the network (`pos: { x, y }` on each point, 0 to 1; points never placed are laid out on a circle; **Arrange in a circle**). A ring marks the current scene's point.
- **Discovered!** (Flight Master; setting **Announce new flight points**, on by default, Travel › Advanced). When a GM unlocks a flight point (editor or `api.flight.unlock`), chat posts "Discovered! New flight point: …" for everyone. A first save into an empty network and the legacy import announce nothing.
- **Flights advance world time** (Flight Master; setting, **off** by default, Travel › Advanced): on arrival, `game.time.advance` by the flight's hours, which calendar modules follow. The 1.20.0 update notes card offers **Keep flights advancing world time** for worlds that want the old behaviour.
- **Travel pace** (new feature *Travel pace*, needs Hex Travel). Fast, normal or slow (careful), after the SRD 5.2 travel pace table (described in our own words): fast gives disadvantage on Perception, Survival and Stealth checks; normal disadvantage on Stealth; slow advantage on Perception and Survival. The party's pace is a world setting (`travelPaceCurrent`); Hex Travel preselects it, names each pace's effect in its list, the GM summary and the chat line, and picking another pace there sets it. The **Travel Pace** window (new macro, shared; `api.travelPace()`; control panel › Travel) lets the GM set it (chat line with the effect) and players **Ask the GM** over the socket: the active GM whispers the GMs a card with a **Set … pace** button. Setting **Players can ask for a travel pace** (on). Speeds still come from the Slow / Normal / Fast pace settings. No hex trail.
- **Party gold tracker** (new feature *Party gold tracker*). A GM-only, read-only **Party gold** window (control panel › Loot › *Party gold…*, the **Party Gold** macro, `api.partyGold()`; numbers from `api.gold.read()`): coin of every player character (character actors a player owns or has assigned) and the party group actor, coins in containers included, plus optionally their mundane gear (**Count mundane gear in party wealth**, off: physical items with no rarity that aren't magical, quantity × price). Compared with the **Wealth curve** (gold per character per act/tier, default 1, 3, 15, 30, 75, 200, 400, 600, 1200) × **Party size**, with green (75–150%), amber (50–75% or 150–200%) or red per act and **Party is in act / tier** for the banner. Respects the coin system. **Take snapshot** stores the wealth now in a hidden world setting (`goldSnapshots`, last 50). No automatic snapshot at Session Start: Session Start has no hook, and its recap is unchanged.
- **Settings export / import** (new feature). Overview › **Export settings** downloads a JSON file (`module`, `format: 1`, `version`, `world`, `client`); stored records (`lootHistoryData`, `lastSeenVersion`, `setupReminded`, `wizardDone`, `flightCache`, `goldSnapshots`) are left out. **Import settings…** picks a file and checks it (module id, format, each value's type, range or choices); unknown keys and unfit values are listed and ignored. A preview shows now / from the file per setting with a tick (differences ticked), and only ticked ones are written after a confirm; reloads when a feature switch changed. API: `api.settingsIO.export()`, `.import()`, `.read(text)`, `.apply(rows)`.
- **Permission checks** (new feature, health check section *Permissions*). For each tool that's on: the module socket, a character each player owns, *Use Script Macros* and Observer on the shared macros, Observer on the party actor (player flights), quest journals players should read, Item Piles for lootable bodies. Each line ✓ / ⚠ / ✗ with a *Fix:* hint. A health section *Map, pace, gold and settings* reports the 1.20 tools.
- Run setup makes the new macros (Flight Route Map and Travel Pace shared with players, Party Gold) only while their tools are on; a macro can now need several features (`feature: "a:b"`).

**Changes**
- Flights no longer advance world time unless *Flights advance world time* is on (see above).
- The Features tab notes that the route map needs Flight Master and travel pace needs Hex Travel. The Classic MMO wizard preset turns on everything new except Travel pace.

**Fixes** (found in a code review before release)
- Settings import: the *Import ticked settings* button did nothing after the confirm (it touched the clicked button after waiting for the dialog, which throws); it now writes the ticked settings. Opening the import window twice no longer leaves two windows with the same id.
- Health check, *Permissions*: the unshared-macro warning only looks at the macros Run setup shares with players, so *Flight Master* (never shared) no longer raises a warning setup can't fix.

**Untested in Foundry** (needs a live world): the route map window and dragging, the Travel Pace window and the socket request with its Accept button, the Party gold window, export download and import file picking / preview, the Permissions section against real users, the Discovered! line and the time skip.

## 1.19.0

**New**
- **Loot history** (part of Loot rolls; setting **Keep a loot roll history**, on by default, control panel › Loot › Advanced). Each finished loot roll is recorded by the active GM's client in a hidden world setting (`lootHistoryData`, newest first, the last 500 kept): date, scene, item (name, UUID, rarity colour, rarity, quantity), each player's choice and rolls, who received it and how it ended (won, all passed, GM assigned, expired, or not handed out). A GM-only **Loot history** window, opened from control panel › Loot › *Loot history…*, the new **Loot History** macro (compendium folder *Loot Rolls*) or `api.lootRoll.history()`: sortable columns, filters by player and session date, a per-player tally (rolls, items received, Need wins, Greed wins, GM assigned), **Export CSV** and **Clear history…** (asks first). API: `api.lootRoll.historyEntries()`, `exportHistory()`, `clearHistory({ confirm })`, and `api.lootHistory()`.
- **Sell all junk** (part of Vendor Trash; setting **Sell all junk button**, on by default, control panel › Loot › Advanced). An Item Piles merchant window opened for a character gets a *Sell all junk* header button: it lists the character's grey items (Vendor Trash drops, grey MMO-style tooltips, *poor* rarity) with the merchant's price and the total, then sells them through Item Piles' `tradeItems`, so merchant prices and the coin setup apply. Equipped items, dnd5e favourites, items in a weapon set, containers and items worth nothing are never sold (the confirm says what was kept and why). If the batch fails, items are sold one at a time and the ones the merchant refused are named. Purchase-only merchants get no button. API: `api.sellJunk(seller, merchant)`.
- **Boss phase marks** (Boss frames). Right-click the crown button in the token HUD, or (GM) a boss frame, to set phase marks such as `66, 33`, on the token or on its creature for every token. The frame's health bar shows a mark at each; the GM always sees them, players only with the new **Show phase marks to players** (off by default, control panel › Boss & Combat). When health drops below a mark in a started combat, the GMs get one whisper per mark ("… reached phase 2 (below 66%)"), reset when healed back to the mark. Run on the active GM's client. Stored in `flags.wayfarers-toolkit.phases` (token or actor) and `phasesPassed` (token). API: `api.bosses.setPhases(tokens, [66, 33], { actor })`, `api.bosses.phases(token)`, `api.bosses.phaseDialog(token)`.
- **Item comparison tooltips** (Character pane; setting **Item comparison tooltips**, on by default, control panel › Character). Hovering an item in the pane's item list, or in an Item Piles pile, body or merchant window (for your character), compares it with what's in the slot it would go in or, with weapon sets, the matching hand of the matching set: Armor Class, damage (dice, type, average), attack and magic bonus, properties gained and lost, attunement, value and weight, green for better, red for worse. Notes follow the hands rules ("Needs both hands: … would have to be stowed", "… would come out of the off hand", "Needs a free hand to load").
- Health check: a *Loot, junk and phases* section (history on or off and its size, the Sell all junk button and Item Piles, boss tokens with phase marks), and an *Item comparison tooltips* line under *Character pane*.

**Changes**
- Remove toolkit data's *Reset the module's settings* also empties the loot history; *flags on tokens/actors* also removes phase marks.

## 1.18.0

**New**
- **Weapon sets in the character pane.** Three sets, one in hand: **Melee** (main and off hand), **Ranged** (the ranged slot and an off hand) and **Utility** (main and off hand, for a weapon with a torch, lantern, instrument or held focus). Only the set in hand is equipped on the dnd5e sheet (`system.equipped`), so only its items count for attacks, AC, bonuses and the pane's stats. The other sets stay visible, dimmed and marked *Stowed*. A tab per set swaps them and writes the sheet's equipped flags. Stored on the actor in `flags.wayfarers-toolkit.weaponSets`.
- **Hands rule.** A set that would use a two-handed weapon (or an ammunition weapon, or a second off-hand item) while a shield is on can't be made active: the pane says why and offers **Stow shield**, which only unequips the shield. Swaps never take a shield off by themselves. **Bucklers** (shields with *buckler* in the name, or **Buckler** ticked by a GM on the item sheet, `flags.wayfarers-toolkit.buckler`) leave the hand free for a one-handed ranged weapon or a weapon in each hand; two-handed weapons are still blocked. Versatile weapons with the off hand empty show their two-handed damage. Thrown weapons fit in the Melee or Ranged set. A Ranged set with no ammunition carried gets a warning, not a block.
- **Swap cost in combat.** Setting **Weapon swap cost**: Free, Part of an attack (default), Object interaction, Bonus action or Action. A swap by a combatant in a started combat posts a short public chat line with the cost; nothing is enforced. **Stow shield** in combat posts a line noting the Utilize action. Outside combat swaps are free and silent.
- **Relic slot.** A worn slot (no hand, never part of a set) for the classes in **Classes with a relic slot** (dnd5e class identifiers, default Paladin, Druid, Cleric; a checklist in the control panel). Takes spellcasting foci and relics (*libram*, *idol*, *totem*, *relic* or *sigil* in the name, or **Relic** ticked by a GM on the item sheet, `flags.wayfarers-toolkit.relic`).
- **Control panel: Character tab** with Weapon sets (on by default), Weapon swap cost and Classes with a relic slot. Health check: a *Character pane* section.
- API: `api.pane.activateSet`, `assignWeapon`, `unassignWeapon`, `stowShield`, `weaponState`.

**Changes**
- Existing characters are migrated the first time their pane opens with weapon sets on: Main Hand and Off Hand become the Melee set, Ranged the Ranged set, Melee in hand (an equipped ranged weapon becomes stowed and unequipped). The set in hand stays recorded in the old slot flags, so switching **Weapon sets** off gives back the old single slots.
- Equipping or unequipping a set's item outside the pane (the sheet, a macro) so that it disagrees with its set takes it out of the set.
- Remove toolkit data also clears weapon sets and the Buckler and Relic marks.

## 1.17.0

**New**
- **Update notes in chat.** After an update, the first load whispers the GMs one card: what changed since the version this world last ran (the newest version open, the ones in between collapsed) and a **To do** list with a button for each thing that still needs doing, plus an *Open the control panel* link. Posted once, by the active GM, only when there's something to say (a patch with no notes and nothing to do posts nothing). Players never see it.
- To-do buttons: **Run setup** (when setup hasn't made everything the tools turned on need; never touches a hotbar) and, for worlds coming from 1.15 or earlier, **Import flight network from the old Flight Routes page** (while the network is empty and Flight Master is on). Each is left out when already done or when its tool is off; buttons work after a reload, GM only, and show as done once done.
- Setting **Show update notes after updating** (on by default) on the control panel's Overview tab, saved as soon as you switch it, and a **Show update notes** button there. API: `api.updateNotes.show(fromVersion?)`.
- Health check: an *Update notes* line (on or off, and the last version seen in this world).

**Changes**
- The card replaces the once-per-version **setup reminder**: its Run setup prompt is now a to-do on the card, so you're never asked twice. Setup reminder cards already in chat keep working.
- The last version a world ran is stored in a hidden world setting. New worlds store it without a card (the welcome wizard covers them). Worlds updated from an earlier version are recognised from the old setup reminder's record (so 1.14.4 → 1.17.0 shows 1.15.0, 1.16.0 and 1.17.0), or treated as coming from an unknown earlier version.

## 1.16.0

**New**
- **Flight network editor.** Flight Master's points and routes now live in the module (a world setting), set up in a window: *control panel › Travel › Flight network…* (or `api.flight.editor()`). Flight points: name, scene on arrival (or *No scene*), Unlocked switch, note. Routes: from, to, fare (type `2s`, `1g 20s`, `75c` or a plain number in the fare unit), hours, Two-way and Free switches. Problems (repeated or empty names, a route to itself, an unknown point, an unreadable fare) show inline and block Save. Save / Cancel; nothing changes until you save.
- **Flight points without a scene.** A flight to a point with no scene (or a deleted one) still happens: the fare is charged, time passes, the trip is logged and chat says "The party lands at …"; the scene stays put and the GM gets a whisper suggesting moving the party.
- **Free flight (GM).** A GM-only *Free flight (no fare)* checkbox in Flight Master skips the purse check and charges nothing; the chat card and log say "free flight". Players never see it, and the GM's client ignores a free request in a player's booking. A route can also be marked Free for everyone.
- **API:** `api.flight.network()`, `api.flight.setNetwork(obj)`, `api.flight.unlock(nameOrId, on = true)`, `api.flight.fly(from, to, { pax, free, scene })`, `api.flight.importLegacy({ dryRun })`, `api.flight.editor()`.
- **Health check / Overview:** network size, points without a scene (information), deleted scenes, routes into locked points and unknown points, with a fix-it that opens the editor.

**Changes**
- **The Flight Routes journal page is no longer read.** While the new network is empty and the old page has flight points, the editor and the Overview offer *Import from the Flight Routes journal page* (asks first, with a report). Scene names match scenes exactly (otherwise *No scene*), fares are read as before, and every route imports as two-way, as the old tables flew. The page is never edited or deleted; once the network has points it's ignored and you may delete it. Run setup no longer creates it.
- Players read the flight network from the world setting, so the hidden players' copy the GM kept in sync (and its journal and scene hooks) is gone. Player bookings are still carried out by the active GM's client with every check (purse with shortfall, unknown or locked points, GM online, refund if the scene can't be opened).
- The health check no longer lists malformed Flight Routes rows (the tables aren't read).

## 1.15.0

**New**
- **Control panel.** One button in the module settings, *Wayfarer's Toolkit → Open the control panel*, opens a single window with tabs: Overview, Features, Travel, Loot, Boss & Combat and Quests. It replaces the *Choose features*, *Health check*, *Run setup*, *Remove toolkit data*, *Party size*, *Coin system*, *Campaign name* entries and the six "… settings" submenus. The main settings list keeps only the panel button and each user's *Quest tracker: Show on screen*. Also `api.panel(tab)`.
- **Overview tab:** "Everything looks good" or "N things need attention", built from the health check, with a fix-it button per problem where there's a quick fix (Run setup, Link boss tables by name, open the right tab, open the Flight Routes or Vendor Trash Rules page). Buttons for Run setup, Full health report (the chat card), Check again, the welcome wizard and Remove toolkit data.
- **Features tab:** a card per tool with an icon, a one-line description and a switch, including the three-coin economy. Saving reloads Foundry (the button says so). A switched-off tool's settings stay visible in the other tabs, greyed out with a note.
- **Basics and Advanced:** each settings tab shows the few settings most GMs change; the rest sit in a collapsed *Advanced* section. Labels and hints are rewritten to say what each setting does at the table.
- **No typing code:** Encounter zones is a table (zone name, roll table dropdown, remove, *Add zone*) with problems shown under it; Scenes hidden from Session Start is a scene checklist; Vendor trash compendiums is a checklist of item compendiums by name; tracker journal, party actor and quest folder suggest your existing documents. A hand-written scene pattern from an earlier version is kept and shown in Advanced.
- **Help and reset:** each tab links to its README section and has *Reset this tab to defaults* (asks first; not on Features).
- **Welcome wizard** for new worlds: pick a style (Minimal, Classic MMO or Everything), the party size, the coins and the campaign name, then Run setup. Shown once, to the active GM, only when the world doesn't use the toolkit yet; rerun it from the Overview tab or with `api.wizard()`.

**Changes**
- No setting keys changed: everything you set before carries over, and macros and the API are unchanged.
- Settings of switched-off features are now always registered (so the panel can show them); switched-off tools still register no hooks, buttons or macros.
- Worlds that already used the toolkit (any setting changed, anything setup makes, or an earlier version loaded) are marked as having seen the wizard on their first 1.15.0 load and never see it.

## 1.14.4

**Fixes**
- All toolkit windows and dialogs (quest log, quest editor, character pane, setup, health check, features, settings menus, data cleanup and the toolkit's prompts) turn off Foundry's frosted-glass backdrop blur. Their backgrounds are opaque, so the blur was invisible, but it made the browser re-blur the game canvas behind the window on every frame: opening the quest log could drop a large screen to under 20 FPS for as long as it stayed open.
- On-screen quest tracker: dropped the hover background transition.

## 1.14.3

**Changes**
- Run setup no longer puts macros on any hotbar (the GM's or players'). It still creates the missing macros in the *Wayfarer's Toolkit* macro folder and never overwrites them; macros already on a hotbar are left where they are.
- Setup's summary, the setup window and the setup reminder say where the macros are: the *Wayfarer's Toolkit* macro folder and the *Wayfarer's Toolkit Macros* compendium, to drag to the hotbar if wanted. Players can drag Flight Master and Quest Log from the compendium themselves.
- The macro list no longer carries hotbar slot numbers.

## 1.14.2

**Fixes**
- Boss loot fallback: a body whose earlier drop came up empty (no trash, no pile) now reports "no vendor trash rolled for it either" instead of "already on the body".
- Reset loot: an unlinked body whose pile filters had been refreshed no longer stays a pile (the pile setting left on the token's own actor is cleared), so it rerolls, gets the HUD dice back and becomes lootable again on its next death. Pile detection now uses Item Piles' own check when Item Piles is active.
- Loot rolls: the "You won" whisper (normal win and GM Assign) goes to every player who owns the receiving actor or has it as their character; for the party actor, to its player owners, or nobody.
- Remove toolkit data: Cancel button next to Remove.

## 1.14.1

**New**
- **Adding your own loot** (Vendor Trash): any item can show in a body's loot pile. Items a GM adds to an NPC are marked **Lootable** automatically (setting *Items the GM adds to an NPC count as loot*, on by default; stat-block items never are). GM-only **Lootable** checkbox on NPC item sheets and **Mark as loot / Unmark loot** in the NPC inventory context menu.
- **Everything is lootable** per NPC (sheet header control, `api.trash.setAllLootable`): its pile shows every physical item, never features or spells.
- Bodies that are already piles refresh their filters when a mark or *Everything is lootable* changes.
- Setting *Unconscious bodies become lootable* (off by default).
- Reset loot: *Also remove hand-added loot* option (marked items stay by default). Remove toolkit data and the health check include the new flags.
- API: `api.trash.setLootable(items, on)`, `api.trash.setAllLootable(actorOrToken, on)`.

## 1.14.0

**Fixes**
- Token HUD: the vendor-trash dice (reroll) button works again.
- Loot rolls: the won item now moves to the winner's character (Item Piles 3.3 transfer fixed).
- Boss loot fallback: the GM's whisper says what really happened ("no vendor trash rolled for it", "already on the body", …) instead of always "vendor trash dropped"; linked bosses get a proper fallback roll.
- Vendor Trash: creatures named or subtyped after a humanoid race (gnoll, kobold, goblin, orc, ogre, troll, bandit-style role words) count as humanoids whatever their dnd5e type, except dragon, undead, elemental, construct, ooze and plant.
- Boss frames: the default stack sits just below the Carousel Combat Tracker when it's shown; moved frames stay where you put them.
- Flight Master: refusals show an **OK** button instead of "Confirm".
- Health check: flight points with no scene get a warning (flying there opens no scene).

**New**
- **Party size** setting (1–8, default 4): boss loot coin scales with it, and parties above 4 get an extra draw from bosses with 3 or more draws (setting *Boss loot: extra drop for parties above 4*). Preview Boss Loot and the health check show the adjusted numbers.
- Loot rolls: the Need / Greed / Pass buttons are disabled while no GM is connected; if the winner can't receive the item it goes to the next-best roll; the GM can **Assign to…** a character or the party; the winner gets a "You won …" whisper.
- Several bodies dying together (an area spell) give **one** GM loot summary card, with Vendor Trash and Boss loot sections; Start loot roll buttons stay.
- Boss loot: **Link boss tables by name** (`api.bossLoot.autoLink()`, a button in the health check and in Boss loot settings) links creatures to tables named "<name> · Loot".
- Clearer errors: the Encounter zones setting names the JSON problem and where it is, and lists zones whose tables don't exist; malformed Flight Routes rows are named by row and column (GM warning and health check).
- **Remove toolkit data** settings button: counts, lets you pick, asks you to type REMOVE, then removes the toolkit's flags, items, setup macros or settings.
- **Debug logging** setting: the toolkit's automatic decisions in the browser console.

**Changed**
- Settings are grouped into per-feature windows (General, Travel, Vendor Trash, Boss loot & frames, Loot rolls, Quest log). The main list keeps Choose features, Health check, Run setup, Remove toolkit data, Party size, Coin system and Campaign name. Setting keys are unchanged, so nothing stored is lost.
- Automated tests (`npm test`) and a GitHub Actions test workflow.

## 1.13.0
- One active GM runs every automatic step when several GMs are logged in.
- Health check (settings button, macro, `api.health()`), and a Run setup reminder once per version.
- **No loot** for actors or tokens (token HUD toggle).
- Boss loot falls back to vendor trash when its table is missing, empty or its items don't resolve.
- Boss frames: tokens with boss loot count as bosses (setting); frames only for the viewed scene.
- Flight Master: fare × passengers, purse and hours before confirming; unaffordable flights and missing scenes are refused; refund if the scene can't be opened.

## 1.12.0
- **Boss loot**: link a roll table to a creature; on death it's drawn (weighted, no repeats) onto the body with a Start loot roll button per item.
- Preview Boss Loot macro; Reset loot also removes boss loot.

## 1.11.0
- **Wayfarer's Toolkit Macros** compendium with every setup macro, built in the release workflow.

## 1.10.1
- Preview Vendor Trash macro and `api.trash.showPreview`.
- Reset loot for linked and unlinked tokens.

## 1.10.0
- Vendor Trash pre-rolled when NPC tokens are placed; bodies lootable automatically on death.
- Flavour rules (material tags, creature and family words), a Vendor Trash Rules journal page and CR bands.
- Token HUD reroll button.

## 1.9.1
- Boss frames can be dragged, moved one by one and snapped into groups.

## 1.9.0
- **Boss frames** for creatures the GM marks as bosses.
- **Loot rolls**: Need / Greed / Pass for items in Item Piles piles.

## 1.8.0
- **Riding Training** feat (renamed from the earlier riding feat) and Long Road for Hex Travel.
- Dungeon scenes drop more vendor trash.
