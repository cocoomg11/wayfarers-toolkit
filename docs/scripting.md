# Scripting and data

[Back to the README](../README.md)

For macro writers, module authors and anyone curious how the toolkit stores things. You don't need any of this to run a game.

- [Macros and scripting](#macros-and-scripting)
- [Public API and hooks: what's stable](#public-api-and-hooks-whats-stable) and [hooks](#hooks)
- [GM-only data and players' clients](#gm-only-data-and-players-clients)
- [Upgrading to 1.27: data moved once](#upgrading-to-127-data-moved-once)
- [Health report: what it checks](#health-report-what-it-checks)
- [Update notes](#update-notes)
- [Several GMs and GM tabs](#several-gms-and-gm-tabs)
- [Building from source](#building-from-source)

## Macros and scripting

Every tool is available as `game.modules.get("wayfarers-toolkit").api.<tool>()`: `hexTravel`, `flight`, `vendorTrash`, `sellTrash`, `characterPane`, `questLog`, `setup`, `health` (the health check; `api.setupPlan()` lists what setup would create; GM only since 2.3.2). Boss frames are under `api.bosses` (`toggle(tokens, on)`, `isBoss(token)`) and loot rolls under `api.lootRoll` (`start(item, { seconds })`, `close(messageId)`) (plus `assign(messageId, actor)`) and boss loot under `api.bossLoot` (`set`, `get`, `preview`, `drop`, `reset`, `dialog`, `autoLink`; see [Boss loot](loot-and-coins.md#boss-loot)); all are undefined when their feature is off. `api.partySize` reads the Party size setting; `api.cleanup` is [Remove toolkit data](../README.md#removing-the-toolkits-data). The quest API is under `api.quests` (see [Quest log](quests-and-characters.md#quest-log)); `api.features.on("questLog")` tells whether a feature is turned on. `characterPane(actor)` opens the pane for an actor (or the selected token's, or your character); `api.pane.slotItem(actor, item, slot)` and `api.pane.unslotItem(item)` slot and unslot from a macro (slots: `head`, `neck`, `shoulder`, `back`, `chest`, `shirt`, `tabard`, `wrist`, `hands`, `waist`, `legs`, `feet`, `finger1`, `finger2`, `trinket1`, `trinket2`, `mainhand`, `offhand`, `ranged`, `relic`; with weapon sets on, the three weapon slots mean the set in hand, see [Weapon sets](quests-and-characters.md#weapon-sets)). `vendorTrash(tokens)` takes an optional list of tokens instead of the selection, `api.trash.reroll(tokens)` rerolls pre-rolled trash (everything under `api.trash`, `api.bossLoot`, `api.gold` and `api.cleanup` is GM only since 1.27: a player gets a warning and `undefined`), `api.trash.reset(tokens, { clearCoin })` resets looted tokens, `api.trash.preview(tokenOrActor, n)` returns what a creature can drop, `api.trash.showPreview(tokens, n)` whispers that as a GM chat card (the Preview Vendor Trash macro), and `sellTrash(actor)` sells one actor's trash without asking. Money helpers: `parseMoney("1g 20s")` returns an amount in the smallest coin, `fmtMoney(amount)` formats one, `moneyHTML(amount)` returns it as coin markup for the shared look (1.30, experimental; `coinRatio()` is the copper per silver of the coins in use), and `totalMoney(actor)` / `pay(actor, amount)` read and spend an actor's purse (`pay` resolves to true when paid; since 2.3.2 it takes nothing and resolves to false when the purse is short).

More calls are listed with each tool, under *For scripters* in the guides: [travel](travel.md), [loot and coins](loot-and-coins.md), [quests and characters](quests-and-characters.md) and [places](places.md). Monk's Active Tiles script actions can call the same API (they run on the GM's client).

### Public API and hooks: what's stable

`game.modules.get("wayfarers-toolkit").api` is available from the `ready` hook. Getters for a tool return `undefined` while that tool is turned off. **Stable** means the name, arguments and result shape are kept across minor versions (a change goes through a deprecation note in the changelog first); **experimental** may still change in a minor version. GM tools refuse players (a warning and `undefined`).

| API | Status |
|---|---|
| `hexTravel`, `flight` (+ `network`, `setNetwork`, `unlock`, `fly`, `editor`, `importLegacy`, `map`), `vendorTrash`, `sellTrash`, `characterPane`, `questLog`, `quests`, `bosses` (`toggle`, `isBoss`, `refresh`), `lootRoll` (`start`, `close`, `assign`), `bossLoot` (`get`, `set`, `preview`, `drop`, `reset`, `dialog`, `autoLink`), `trash` (`reroll`, `reset`, `preview`, `showPreview`), `pane` (`slotItem`, `unslotItem`), `setup`, `setupPlan`, `health`, `panel`, `open` (1.32: GM, opens the control panel, same as `panel(tab)`; used by the Wanderer's Satchel launcher), `cleanup` (`plan`, `remove`, `open`), `features.on`, `partySize`, `parseMoney`, `fmtMoney`, `totalMoney`, `pay` | stable |
| `healthReport`, `coinLog` (`entries`, `open`, `undo`), `splitCoin`, `flightMap`, `travelPace`, `setTravelPace`, `partyGold`, `gold`, `zoneTitles`, `rentRooms`, `inn` (`inn`, `inns`, `all`, `rested`, `rental`, `clear`, `candidates`, `rent`, `save`, `remove`, `makeInnkeeper`), `pins` (`place`, `create`, `update`, `move`, `remove`, `reveal`, `open`, `list`, `read`), `lootHistory`, `updateNotes`, `wizard`, `trash.applyWeights`, `settingsRecords`, `migrations` (`status`, `run`), `quests.showTracker`, `quests.resetTrackerPosition`, `quests.progressObjective`, `quests.assign`, `quests.pickReward`, `quests.parties`, `quests.difficulty`, `moneyHTML`, `coinRatio` (1.30), `shop` (`open`, `close`, `openedFor`; 1.31), health lines' `fix` in `healthReport()` (1.30), `renown` (2.2: `factions`, `faction`, `tiers`, `get`, `open`, `track`; GM only: `award`, `setScore`, `addSource`, `removeSource`, `setup`, `awardDialog`, `sync`; see [Renown for scripters](quests-and-characters.md#renown-for-scripters)), `sheet` (2.3: `registerPage`, `unregisterPage`, `pages`; character sheet on only; every client; see [Sheet pages for other modules](#sheet-pages-for-other-modules)), hook `wayfarers-toolkit.sheetReady` (2.3) | experimental |
| `internals`, `log`, anything not listed here | internal: don't rely on it |

Removed in 1.27: `sessionStart`, `whosOnline`, `online` (both tools moved to the **Red Book** module) and `settingsIO` (settings files are the hub module's job; `api.settingsRecords()` lists the record settings a settings file must leave out). Under `api.trash`, only the functions listed in the code comment remain (the internal module is no longer spread into the API).

**`api.healthReport()`** (GM; experimental) returns the health check in the shared health format of the Wanderer's modules (the same shape each of them returns), so a hub such as the Wanderer's Satchel can show them together:

```js
const report = await game.modules.get("wayfarers-toolkit").api.healthReport({ timeoutMs: 20000 }); // timeoutMs optional
// [{ title: "Boss loot", lines: [{ level: "ok" | "warn" | "bad" | "off" | "info", text: "…" }] }, …]
```

- A Promise of an array of sections in the order of the health card; sections with no lines are left out.
- `text` is plain text (no HTML; buttons in the chat card are dropped). `level` is one of the five words.
- Each section runs wrapped and time-limited: `timeoutMs` per section when given (clamped to 1 s – 5 min; a hub passes its own budget so the two limits agree), otherwise 20 s. One that throws or runs out of time becomes a single `warn` line, and the others still run. Nothing in the world is changed. Nothing is posted to chat (use `api.health()` for the chat card).
- Players get `[]` (the report names GM-only things).

### Hooks

With the feature *Hooks for other modules* on (default), the toolkit fires these hooks (`Hooks.callAll`), on the GM client that makes the change only (one client, not every client). All are **experimental**.

```js
Hooks.on("wayfarersToolkit.questUpdated", ({ questId, change }) => { … });
Hooks.on("wayfarersToolkit.journey", ({ kind, fromId, toId, fromName, toName, hours, cost, partyId }) => { … });
Hooks.on("wayfarers-toolkit.renownChanged", ({ actorId, factionId, before, after, delta, tierBefore, tierAfter }) => { … }); // 2.2, Renown on
```

- **`wayfarersToolkit.questUpdated`** `{ questId, change }`: `questId` is the quest journal entry's 16-character id; `change` is one of `"started"` (given or reopened), `"completed"`, `"failed"`, `"objective"` (ticked, unticked, revealed or hidden), `"updated"` (anything else: text, hidden from or shown to players, rewards paid, set back to not given) or `"assigned"` (the quest moved to another party, or to none; since 1.29). It fires only **after** the quest is saved (the GM-only records and the quest journal), so reading the quest from inside the hook sees the change. Ids only: read the quest through `api.quests.get(questId)`.
- **`wayfarersToolkit.journey`** after a hex trip or flight has happened: `kind` `"hex"` or `"flight"`; for a flight `fromId` / `toId` are flight point ids and the names their names; for hex travel `fromId` / `fromName` are the scene travelled from and `toName` the zone travelled through (`toId` null). `hours` is decimal hours (e.g. `2.5`); `cost` is `{ gp, sp, cp }`, whole coins of each kind (what was actually charged; 0 for free flights and hex travel); `partyId` the party actor's id or null.

- **`wayfarers-toolkit.renownChanged`** (2.2, feature *Renown* on too) after a character's renown with a faction changed and was saved (an award, a quest's renown reward, the GM setting the score, or adding or removing another source): `actorId` the character, `factionId` the faction's id (read it with `api.renown.faction(factionId)`; for a hidden faction only on a GM's client, which is the only place the hook fires), `before` / `after` the totals (score plus other sources, never below 0), `delta` the change to the score itself (0 when only a source changed; a loss stopped at 0 counts what was actually taken), `tierBefore` / `tierAfter` tier indexes (0 = the first tier, −1 = no tier). Ids and numbers only. Fired once per character: an award to the party fires it for each.

- **`wayfarers-toolkit.sheetReady`** (2.3, experimental) is different from the hooks above: it fires on **every** client, once, right after `api` is set (in the toolkit's `ready`), only while the character sheet replacement is on, and whether or not *Hooks for other modules* is on. Its argument is `api.sheet`. It is how modules that load before the toolkit add [sheet pages](#sheet-pages-for-other-modules).

Earlier hooks: none from 1.27 to 1.27.2 (`wayfarers-toolkit.playerCountChanged` and `wayfarers-toolkit.allPlayersOnline` moved with Who's online to the Red Book module, which fires `red-book.playerCountChanged` / `red-book.allPlayersOnline`, and the old names too while the toolkit doesn't provide `api.online`). Internally the toolkit broadcasts one notice hook, `wayfarers-toolkit.notice` (`{ to: userId | null, level, text }`: flight results, refused pins, quest objective lines); clients accept it only from the GM client that acts for the world, and it isn't meant for other modules.

Other modules should read and change toolkit data through this API rather than writing `flags.wayfarers-toolkit.*` directly; flag shapes are documented for reading, and may gain fields.

### Sheet pages for other modules

**Experimental (2.3).** While the *Character sheet replacement* is on, `api.sheet` lets another module add its own page (a bookmark and a page) to the toolkit sheet. It is `undefined` while the sheet is off. The rules come from the shared core's guest pages (`wanderers-core` 0.6.0, docs/pages.md there); the toolkit keeps the registry, and other modules reach it only through `api.sheet`.

```js
function addPage(sheet) {
  return sheet?.registerPage({
    id: "my-module.professions",        // your module id, a dot, then a name (letters, digits, _ or -); one page per id
    label: "Professions",               // bookmark tooltip and page title, at most 40 characters
    hint: "from your tool proficiencies", // optional, the small line next to the title, at most 80 characters
    icon: "M14 6l4 4M3 21l9-9M11 5l2-2l8 8l-2 2z", // optional: one SVG path on a 24 × 24 grid (stroke, like ours) or "fa-solid fa-hammer"
    order: 85,                          // optional: where the bookmark goes (below); none = after every page
    visible: actor => true,             // optional: false hides the page for that character
    render: async ({ actor, mode, editable, root }) => "<section class=\"my-prof\">…</section>", // HTML text or an element
    activate: ({ actor, mode, editable, root, element, refresh }) => {} // optional: wire listeners after each render
  });
}
// Modules whose ready runs after the toolkit's:
Hooks.once("ready", () => { const off = addPage(game.modules.get("wayfarers-toolkit")?.api?.sheet); });
// Modules that load earlier: wait for the toolkit (fired once on every client, with api.sheet, right after the API is set).
Hooks.once("wayfarers-toolkit.sheetReady", sheet => { const off = addPage(sheet); });
```

- **`registerPage(def)`** returns `off()`. It never throws: a bad definition is refused with a console warning, `off.ok` is `false` and `off.reason` says why. A second `registerPage` with the same id replaces the first (an old `off()` then leaves the new one alone). At most 20 pages from other modules. `off()` (or **`unregisterPage(id)`**) removes the page; open sheets redraw on every change (on a page that went away they show Character).
- **`pages()`**: every page in bookmark order, as `{ id, label, hint, order, guest }` (other modules' pages also carry `icon` / `fa`); no functions. Our own pages keep these orders: Character 10, Details 20, Inventory 30, Features 40, Spells 50, Effects 60, Biography 70, Reputation 75, Bastion 80, Special traits 90 (Bastion and Reputation only show when they apply). On a tie ours come first, then by id.
- Registration is **per client**: each player's client registers its own (the hook fires on every client). Pages show in Play and Edit mode, for every character the viewer can see; `visible(actor)` decides beyond that (a `visible` that throws hides the page).
- **`render(ctx)`** gets `{ actor, mode, editable, root }`: the character, `"play"` or `"edit"` (edit only when the viewer may edit), whether the viewer may edit the character, and the sheet's window element (`null` on the first draw). It returns HTML text, which is **inserted as is: escape your own data**, or an element. The toolkit draws the page title and hint above it. A render that throws, takes longer than 5 seconds or returns something else shows one line ("The … page couldn't be drawn (…)") instead; the rest of the sheet keeps working.
- **`activate(ctx)`** runs after each render with the same fields plus `element` (your page's container, `.wct-cs-guest`) and `refresh()` (redraws the sheet). Errors are logged.
- The toolkit stores nothing for your page and gives it no way to write toolkit data: read and update the actor yourself. Never write `flags.wayfarers-toolkit.*`.
- Inside the page: use your own listeners (from `activate`), not `data-action` (those are the sheet's buttons) nor `data-name` / `[data-drop]` (the sheet's own field and drop rules). Enter in a text field doesn't submit the sheet. Drops on your page reach the sheet's drop rules (dnd5e's) unless your listener stops them.
- Style: the page sits inside the sheet's dark palette (`.wct-sheet .wct-cs`, core's `--wc-*` tokens and `wc-*` classes work); scope your CSS under your own class and use no theme selectors (the sheet is dark in both themes).

### GM-only data and players' clients

Since 1.27 the toolkit keeps everything players mustn't read out of what their clients receive:

- **GM-only records**: one journal entry, *Wanderer's Toolkit (GM only)* (worlds made before 1.27.2 keep the older name *Wayfarer's Toolkit (GM only)*; the module finds it by its flag), ownership None for players, with `flags.wayfarers-toolkit.vault = { v: 1, buckets }`: the full flight network (with locked points), hidden GM map pins (no map note exists until you reveal one), each quest's full data (hidden objectives and the description's secret sections), room rentals, party gold snapshots, the loot roll history and (2.2) bucket `renown` (`{ v: 2, factions, scores: [{ actor, faction, score, ribbons }], applied: [{ merchant, actorUuid, buy }] }`; arrays, so a removed entry really goes): hidden factions, every character's renown with them, and which Item Piles per-character prices the toolkit set. Don't share it with players; deleting it loses those records. The health check warns if a player can open it. Since 1.30 it lives in the shared **Module data** journal folder (the module finds it by `flags.wayfarers-toolkit.vaultEntry`): the GM's client moves it there once (marked `flags.wayfarers-toolkit.dataFolderFiled`; move it elsewhere afterwards and it stays where you put it), and a new world creates it there. The folder is hidden from the Journal sidebar unless **Show module data folder** is on (control panel › Loot › Advanced; a hidden client setting `showModuleData`, per user and browser; another Wanderer's module's switch shows it too). Hiding it is tidiness, not secrecy.
- **Renown** (2.2): the world setting `renownConfig` (`{ v, tiers, gains, losses, factions }`) holds the shared tiers, the award presets and the factions players may see; each character's renown with those is the actor flag `flags.wayfarers-toolkit.renown` (`{ v, scores: { factionId: n }, ribbons: { factionId: [{ id, text, amount, at }] }, tracked }`), readable by whoever can see the character and, like any field on an actor, changeable by its owner (from the console, for example); only hidden factions' renown is GM-only. Quest renown rewards with a hidden faction are left out of the quest's public view.
- **What players' clients get**: the world setting `flightNetwork` holds only the unlocked points and their routes (greyed locked points as bare positions if you chose *Greyed out*); a quest journal's flag and page hold only what players may see (nothing at all for a quest that isn't given or is hidden); map notes exist only for pins players may see.
- **Requests from players** (flight bookings, pace and room requests, loot roll choices, map pin changes, long rests) go to the GM's client as checked requests: unknown kinds, unexpected fields, wrong types and oversized messages are refused, the sender is always the one Foundry reports (never a field in the message; unknown senders are refused), repeats are dropped and each user is rate-limited. Notices back are accepted only from the GM client that acts for the world.
- **This is an honor system, not secrecy.** The GM journal's ownership is set so players can't open it, and Foundry keeps it out of their sidebar. But Foundry still sends every journal entry's data to each player's browser (checked on Foundry 14), so a player who digs through their browser's developer tools could read it. The same goes for the hidden *Module data* folder: hiding it keeps the sidebar tidy, nothing more. Keep real secrets off the table.

### Upgrading to 1.27: data moved once

The first time the GM's client that acts for the world loads 1.27, each of these runs once (recorded in the GM-only records; `api.migrations.status()` lists them) and a whisper lists what moved:

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

## Health report: what it checks

The **health check** (the control panel's Overview tab sums it up; **Full health report**, the **Toolkit Health Check** macro or `api.health()` post it) whispers the GM a report with fine / warning / problem lines. It changes nothing. Since 1.30, when the [Wanderer's Satchel](https://github.com/cocoomg11/wanderers-satchel) hub module is active the chat card is one line (how many checks are fine, warnings and problems) with an **Open in Wanderer's Satchel** button that shows the full report there; without it the card lists every line as before. `api.health({ window: true })` opens the full report in a window. It covers:

- which features are on;
- dependencies: Item Piles and Item Piles: D&D 5e, the vendor-trash compendiums, and whether the coins match the Coin system setting (and Item Piles' currencies in three-coin mode);
- setup: each macro, the tracker journal and pages, the party actor, the Vendor Trash Rules page and the riding feat, for the features turned on, with a **Run setup** button when something's missing;
- boss loot: the party size and what it does to boss loot, every actor and token with a table linked, whether the table exists, how many results resolve to items, the draws and coin adjusted for the party size, and whether there are more draws than usable results. Links that would fall back to vendor trash are flagged. Creatures with a table named for them but not linked get a **Link boss tables by name** button;
- how many actors and tokens are marked **No loot**;
- problems on the Vendor Trash Rules page, scenes marked Dungeon, the flight network's size, flight points with no scene (⚠, information only: flying there still works) or a deleted scene, routes into locked points (since 1.32 several are one line, "N routes lead into locked flight points", with the list behind **Show the routes**; plain text in `healthReport()`), routes naming a point that doesn't exist (✗), and an old Flight Routes journal page waiting to be imported;
- encounter zones whose roll table doesn't exist (or a stored value an earlier version couldn't read);
- the route map, travel pace, party gold and settings export / import (1.20), when they're on;
- **Permissions** (always, since 1.27): for each tool that's on, what players need, each line ✓ / ⚠ / ✗ with a fix: the module socket (player flights, loot roll choices, pace requests, quest notices), a character each player owns (loot rolls, the character pane, looting bodies, Sell all junk), the *Use Script Macros* permission and Observer on the shared macros (Flight Master, Quest Log, Travel Pace, Flight Route Map), Observer on the party actor (players see the purse their flights use), quest journals players should be able to read, and Item Piles for lootable bodies. Since 1.32 players on the *Players not checked for a character* list (control panel › Loot › Advanced, or the **Ignore these users** fix on that warning) are left out of the no-character warning and shown as not checked;
- whether update notes are on, and the last version this world ran;
- the active GM and how many GMs are online.

Since 1.30 some lines carry a quick fix, shown as a **Fix** button in the Wanderer's Satchel's health page and in the control panel's Overview (each asks first): a missing setup item (**Run setup**), creatures with a boss table named for them but not linked (**Link boss tables**), the GM-only records journal shared with a player (**Make GM only**), the records journal not yet in the *Module data* folder (**File it now**), and players with no character (**Ignore these users**, 1.32). The chat card doesn't show them.

## Update notes

After the module is updated, the first time the world loads the GMs get one whispered chat card (players never see it): **Wanderer's Toolkit updated: 1.14.4 → 1.17.0**, a short plain list of what's new in the newest version, the versions in between collapsed underneath, and a **To do** list with a button for each thing that still needs doing, plus an **Open the control panel** link. It's posted once, by the active GM, and only when there's something to say: a small patch with no notes and nothing to do posts nothing. The buttons work after a reload, only for GMs, and show as done once done (also when you did it some other way).

What can be on the to-do list:

- **Run setup**, when setup hasn't made everything the tools turned on need. It never touches a hotbar.
- **Import flight network from the old Flight Routes page** (Flight Master, coming from 1.15 or earlier), while the flight network is empty and the old page has flight points. It asks first and doesn't change the page.

Things for a tool that's switched off aren't listed. New worlds get no card (the welcome wizard covers them). The world remembers the last version it ran in a hidden setting; worlds updated from before 1.17 are recognised from the old setup reminder's record. Switch the card off with **Show update notes after updating** on the control panel's Overview tab; **Show update notes** there (or `api.updateNotes.show()`, or `api.updateNotes.show("1.15.0")` for everything since 1.15.0) posts it again. This card replaces the setup reminder of earlier versions.

**Fewer cards in chat (1.32).** When the toolkit posts a health check card or an update notes card, the GM who posted it deletes the toolkit's older cards of that kind, so chat keeps the newest one of each. Switch it off with **Keep only the newest health and update card** on the Overview tab (world setting `pruneToolkitCards`, on by default). **Clear old toolkit cards…** on the same tab does it for both kinds at once (it says how many first and asks). A message only counts when it has the toolkit's flag for that card (`flags.wayfarers-toolkit.health === true`, or an `updateNotes` object; since 1.32 also `toolkitCard: "health" | "updates"`) *and* the card's own markup (`wct-health` / `wct-update` class), and was not written by a player; loot, quest, room and pace cards and players' messages are never touched.

## Several GMs and GM tabs

A world can have more than one GM logged in. Everything the toolkit does on its own (pre-rolling trash when a token is placed, making bodies lootable, drawing boss loot, settling loot rolls, carrying out players' flights, warnings about the rules page, coin conversion and the update notes) runs only on the **active GM**'s client: Foundry's active GM, or the connected GM with the lowest user id. Buttons and macros still run for whichever GM clicks them.

The same GM can also be logged in more than once (two browser tabs, or a laptop and a desktop). The GM's clients find each other and only one of them acts: the one opened first. A lone tab acts by itself a moment after the world loads; closing the acting tab hands over to another within a couple of seconds (or a few seconds if that tab crashed or lost its connection). Players' requests (rooms, rests, travel pace, flights, loot choices) also carry an id, so a request that arrives twice is handled once. The health check says when you're logged in on several clients and which one acts.

## Building from source

Tests: `npm test` runs the pure-logic tests in `tests/` with Node's built-in test runner (Node 22), `npm run check` syntax-checks every script and `npm run lint` runs ESLint on the shared core's config (`npm install` first for the linter). CI runs them through the shared core's reusable workflow (`module-checks.yml@v0.5.1`), which first checks that `vendor/wanderers-core/` matches its pin.

**Shared library.** The toolkit bundles a pinned copy of **wanderers-core** (the small library the Wanderer's modules share) in `vendor/wanderers-core/`, with the pin in `wanderers-core.lock.json`. Never edit the copy by hand; update it with `node vendor/wanderers-core/vendor.mjs update X.Y.Z` and commit both. The release zip includes `vendor/` without core's `config/` folder and `vendor.mjs` (dev tools).

The compendium sources live in `src/packs/macros` as JSON and are generated from `scripts/macros.mjs`, the same list Run setup uses. After changing a macro, run `node tools/build-packs.mjs sources` and commit the JSON. The release workflow installs `@foundryvtt/foundryvtt-cli`, checks the sources are current, compiles them into `packs/macros` (LevelDB) and adds `packs/` to `module.zip`. To build locally: `npm install`, then `node tools/build-packs.mjs compile`.
