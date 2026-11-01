# CLAUDE.md: Wayfarer's Toolkit

Foundry VTT module (v13/v14, dnd5e) of GM tools: hex travel, flight routes, vendor trash loot, character pane, quest log, boss frames, loot rolls, boss loot, three-coin economy. Logic only; campaign content stays in each world. Public repo, MIT.

## File map (`scripts/`)
- `main.mjs` entry: settings, hooks, macros/setup, the module API (`game.modules.get("wayfarers-toolkit").api`).
- `features.mjs` feature registry (`FEATURES`, `on(id)`); `macros.mjs` macro definitions shared by Run setup and the pack build.
- `panel.mjs` / `panel-model.mjs` control panel + welcome wizard (UI / pure data and converters).
- `health.mjs` read-only health check; `cleanup.mjs` "Remove toolkit data" window.
- `update-notes.mjs` (bundled per-version notes + pure logic) and `updates.mjs` (post-update GM chat card, `lastSeenVersion`).
- `core.mjs` binds wanderers-core (leader + logger); `requests.mjs` every socket request schema and the notice hook (pure). `gm.mjs` the names the rest uses (`isActiveGM`, `settled`, `onLeader`, `handle`, `request`, `notify`, `cardPosted`); `gm-model.mjs` `cardExists`; `log.mjs` debug logging (core createLogger, setting "Debug logging").
- `vault.mjs` / `vault-model.mjs` the GM-only store (one None-ownership journal, `flags.wayfarers-toolkit.vault`, buckets, caps, deletions); `migrate.mjs` the one-time 1.27 moves; `scene-config.mjs` the toolkit's Table Tools section; `quests-model.mjs` quests' public view (`publicQuest`, `stripSecrets`).
- `flight.mjs` network model, checks, importer, encounter-zone parser (pure); `flight-editor.mjs` network editor window.
- `trash.mjs` Vendor Trash; `trash-rules.mjs` pure rules (CR bands, tags); `summary.mjs` merges batched death cards.
- `merchant.mjs` Sell all junk on Item Piles merchants; `junk-rules.mjs` pure junk rules.
- `bosses.mjs` boss frames; `phases.mjs` pure phase thresholds; `bossloot.mjs` boss loot tables.
- `loot.mjs` Need/Greed/Pass; `history.mjs` / `history-model.mjs` loot roll history (UI / pure).
- `pane.mjs` character pane; `weapon-sets.mjs` pure weapon-set rules; `compare.mjs` pure item comparison tooltips.
- `flight-map.mjs` route map window (model: `Flight.mapModel`, `autoLayout`, `newlyUnlocked`, `withPositions`, `mapBackground` in flight.mjs).
- `travel-pace.mjs` pure pace rules (SRD 5.2 figures, effect text, trip hours/days, socket request reader); UI and socket in main.mjs (`travelPace`, `setTravelPace`, `paceRequest`).
- `gold.mjs` / `gold-model.mjs` party gold tracker (UI / pure curve, coin, gear and status maths).
- `permissions.mjs` pure permission checks; `health.mjs` gathers the facts (`permissionFacts`) for its *Permissions* section.
- `zone-titles.mjs` / `zone-titles-model.mjs` zone title cards (UI / pure config and show rules); `inn.mjs` / `inn-model.mjs` inns and Rested (records, renting, token HUD, rest hook / pure records, price, pay, rentals, benefit rules).
- `pins.mjs` / `pins-model.mjs` map pins (tool, dialogs, card, GM relay, Note class / pure flag shape, permissions, request reader and GM decision, quest guard, cleanup grouping).
- `quests.mjs` quest log + tracker. Also `styles/`, `sounds/`, `src/packs/macros` (JSON sources), `tools/build-packs.mjs`.

## Key patterns
- **Feature registry:** one world setting per tool in `features.mjs`. A disabled feature registers nothing (no hooks, buttons, socket handlers, wrappers) and Run setup skips its macros. Gate registration with `on("<id>")`; API getters return undefined when off.
- **Settings & control panel:** keys are stable across versions (never rename). New record-type settings go in `RECORD_SETTINGS` and `WIZARD_IGNORE` (panel-model.mjs). `panel-model.mjs` decides which settings show on which tab (Basic vs Advanced) and labels/hints; `panel.mjs` renders. Add a setting there, not as a loose submenu.
- **Health check:** `health.mjs`, `api.health()`; each check is wrapped, never throws, never changes anything. Add a line when adding a feature with setup needs.
- **Update notes:** each user-visible release gets an entry at the top of `NOTES` in `update-notes.mjs` (plain-words changes, optional `actions` with `check()`/`run()`). Patch releases without an entry post nothing.
- **Active-GM writes:** anything that writes documents automatically runs only when `isActiveGM()` (= core `leader.isLeader()`), true on one client even with several GM tabs. Ready-time GM work waits for `settled()`. Players (and non-leader GM tabs) call `request(kind, data)`; add the kind's schema to `requests.mjs` and the handler with `handle(kind, (data, user, { rid }) => …)` in a ready hook. `user` is Foundry's sender (core refuses unknown senders, repeats, rate limits; `from: "gm"` kinds refuse players). **Never** read a user id from the payload. Cards posted for a request are stamped with `rid` and checked with `cardPosted`. Notices to a client go through `notify(userId | null, text, level)` (a leader broadcast hook; never a raw socket message). No module code calls `game.socket` directly (a test checks).
- **API surface:** `api.quests`, `bosses`, `lootRoll`, `trash`, `bossLoot`, `flight` (+ `flight.map()`), `flightMap()`, `travelPace()`, `setTravelPace()`, `partyGold()`, `gold`, `zoneTitles`, `rentRooms()`, `inn`, `pins`, `pane`, `panel(tab)`, `wizard()`, `health()`, `healthReport()`, `setup()`, `setupPlan()`, `updateNotes`, `cleanup`, `migrations`, `settingsRecords()`. Macros only call the API. GM tool objects are wrapped with `gmOnlyApi()` (main.mjs): players get a warning and `undefined`. Never spread a module's internals into the API.
- **GM-only data never goes where players' clients can read it** (world settings, flags on documents players can observe, Notes, journal pages players own). Put it in the GM-only store: `Vault.get(bucket)` (GM only; players get the fallback), `Vault.update(v => …)` / `set` / `setKey`. A new bucket goes in `vault-model.mjs` `BUCKETS` (with a cap in `CAPS` if keyed) and is removed by cleanup with the journal.
- Flags live under `flags.wayfarers-toolkit.*`. Windows use the `wct-window` class (backdrop blur is disabled on purpose: it tanks FPS in v14).
- Pure logic goes in files with no Foundry calls at import time so it can be tested in Node.

## 1.20 notes
- New features: `flightMap` (needs `flightMaster`), `travelPace` (needs `hexTravel`), `partyGold`, `settingsIO`, `permissionChecks`. Cross-feature needs are checked at the call site (`F.need` twice) and in `macroOn(m, F.on)` (`feature: "a:b"` on a macro).
- Flight refinements stay in Flight Master: `flightDiscovered` (chat on unlock, in `setFlightNetwork` via `Flight.newlyUnlocked`; an empty previous network announces nothing) and `flightAdvanceTime` (default **false** from 1.20; earlier versions always advanced; update-notes action `flightTime` turns it back on). Map positions live on points as `pos` in `flightNetwork`.
- Travel pace: `travelPaceCurrent` (world, GM writes) and `paceRequests`. Socket action `paceRequest` is only handled when both features are on. Speeds still come from `paceSlow/Normal/Fast`.
- Party gold: settings `goldAct`, `goldCurve` (text, parsed by `parseCurve`; bad text falls back to the default with a warning), `goldIncludeGear`, hidden `goldSnapshots`. No Session Start hook exists, so there's no automatic snapshot; don't add one by changing `sessionStart()`.
- Settings IO (removed in 1.27): its SKIP list is now `RECORD_SETTINGS` in panel-model.mjs.
- Health: *Permissions* lines come from `Perm.featureChecks(facts)`; add a need there when a tool starts relying on a player permission.

## 1.22 notes
- New features `zoneTitles`, `whosOnline`, `restedInn`; settings on the control panel's **Places** tab (`zoneTitle*`, `online*`, `inn*`).
- Scene flags (added to the scene config's Basics tab by `renderSceneConfig`): `zoneTitle = { show, title, subtitle, sound }`, `hub`, `inn = { on, name, price }`. Actor flag `rested = { scene, inn, at }`.
- Zone titles write nothing; each client decides (`updateScene` active → shown on that client's next `canvasReady` for the scene; the first draw after load is "load" and shows nothing unless `zoneTitleOnLoad`).
- Who's online writes nothing; it fires `wayfarers-toolkit.allPlayersOnline` and `wayfarers-toolkit.playerCountChanged` on every client (documented in the README; never edit world tiles from the module).
- Inn: renting is a GM action; `dnd5e.restCompleted(actor, result, config)` (`result.longRest`) on the resting client → active GM applies (socket `restedRest`, owner-checked). Socket `roomRequest` from players → GM whisper with a Rent rooms button. Coin maths in `inn-model.mjs` (`spend`, `payPlan`) mirrors `api.pay`.

## 1.23 notes
- New feature `flightMapBackground` (needs `flightMap` + `flightMaster`; rows use `"flightMaster:flightMap:flightMapBackground"`). World settings `flightMapImage` (`filePicker: "image"`, rendered by the panel as `<file-picker>`), `flightMapFit` (`Flight.MAP_FITS`: contain/cover/stretch → SVG `preserveAspectRatio` meet/slice/none), `flightMapOpacity`, `flightMapScale`, `flightMapOffsetX/Y`; all `onChange: FlightMap.refresh()`.
- `Flight.mapBackground(settings, box)` (pure) places the picture in the SVG's points box (`PAD`..`W−PAD`, `PAD`..`H−PAD`), the same box `pos` 0–1 maps to, so positions line up with the picture at any window size. `flight-map.mjs` `background()` reads the settings and draws an `<image class="wct-fm-bg">` (no pointer events) before the edges. Null (feature off, blank image) = 1.22 output.
- No per-point or per-region images: one picture per world. Point positioning stays the existing GM drag + Save layout.

## 1.26 notes
- New feature `mapPins`; settings `pinsPlayers`, `pinsEditAll`, `pinsDimDone`, `pinsSize`, `pinsPaper`, `pinsShowNotes` (Places › Advanced) and client `pinsNotesShown` (SKIP + WIZARD_IGNORE).
- Pins are core Notes with `flags.wayfarers-toolkit.pin` (`PIN_VERSION` 1, `normalize`). Players never write Notes: socket `mapPin` (create/update/move/delete, `rid`) → acting GM → `readRequest` + `decide` (kind/hidden/author set by the GM; quest links checked with `Quests.canSee` for the sender) → `mapPinResult` on refusal.
- `init` wraps `CONFIG.Note.objectClass` (after dnd5e's `Note5e`): `isVisible` hides hidden GM pins from players, `_canView` lets a pin with no journal be double-clicked, `_onClickLeft2` opens the pin card, `_getTargetAlpha` dims, `_drawControlIcon` hides the dark square and adds the parchment disc. Marked with `MARK` so the health check notices a later replacement.
- Cleanup category `pins` deletes the Notes (not just flags).

## 1.27 notes
- **Core**: `vendor/wanderers-core` 0.2.0 (`wanderers-core.lock.json`). Never edit it; `node vendor/wanderers-core/vendor.mjs update X.Y.Z` (here the vendor tool needs `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` behind the proxy). Features via core `createFeatures` (features.mjs; same keys), logging via `createLogger`, update notes via core `notes-model` (update-notes.mjs keeps its own `decide` wrapper for the pre-1.17 `setupReminded` record).
- **healthReport contract** (Satchel hub reads it): `api.healthReport({ timeoutMs })` → `Promise<[{ title, lines: [{ level: "ok"|"warn"|"bad"|"off"|"info", text }] }]>`, core `healthCollector` (each section wrapped and time-limited; a failure is one warn line), plain text (`toPlain` drops buttons and tags), empty sections dropped, never posts to chat, `[]` for players. `api.health()` still posts the HTML card.
- **Inns**: `flags.wayfarers-toolkit.inns = { v: 1, list: [{ id, name, price, innkeeper: { actor, token } | null, region | null }] }` (≤ `INNS_MAX` 20). Old `flags.…inn` kept, moved once (`inns1`). Rentals in vault bucket `rentals` (≤ 200); `afterLongRest` grants only with a rental (a flag without one is cleared). HUD: mug = Make innkeeper here…, bed = Rent rooms (innkeeper tokens).
- **Table Tools**: `scene-config.mjs` adds one core `sceneTab` section (order 10) for zoneTitles / vendorTrash / restedInn fields; nothing registers `renderSceneConfig` itself any more (test).
- **Quests**: full quest in vault bucket `quests[journalId]`; the journal flag is `publicQuest(q)` (`pub: true`) and the page is built from it. `data(j)` on a GM reads the vault (falls back to the flag before the move).
- **Pins**: hidden GM pins are vault records (bucket `pins`, `PM.hiddenRecord`), drawn for GMs as a PIXI overlay (`redrawGhosts`), never Notes; reveal creates the Note with `keepId`. `WctPinNote.isVisible` uses `pinVisible` (bug fix: v14's own rule hides entry-less notes from players).
- **Flight network**: full network in vault bucket `flightNetwork`; the world setting holds `Flight.playerView(net, { locked })`, rewritten on every save and when `flightMapLocked` changes. Satchel's settings import shape check sees `flightNetwork` as the players' view (still `{ version, points, routes }`).
- **Removed**: Settings IO (`RECORD_SETTINGS` in panel-model.mjs replaces its SKIP list; `api.settingsRecords()`), the permissionChecks switch, Session Start and Who's online (Red Book 0.3.0). Keep registered (hidden, same types/defaults) for Red Book's migration: `hiddenScenes`, `onlineCount`, `onlineList`, `onlinePosition`, `onlineDrag`, client `onlineHudPos`; scene flag `hub` untouched. Don't add `api.online` back (Red Book fires the old hook names only while it's absent).
- **Migrations** (`migrate.mjs`): `inns1`, `vault1`, `quests1`, `pins1`, `rested1`, each once, recorded in vault bucket `migrations`, run by the leader after `settled()`; a move whose tool is off waits.

## House practices
- **CI**: `test.yml` calls core's `module-checks.yml@v0.2.0` (types step off until JSDoc-clean) plus a pack-sources job; `release.yml` = read-only build job + upload job (only writer), actions pinned by SHA, `npm ci` once `package-lock.json` exists (none yet; generate with `npm install --package-lock-only` where the registry is reachable and commit it).
- **Release tags** are `vMAJOR.MINOR.PATCH` only (`v1.24.0`; never `1.24` or `v1.24`). The Release workflow fails early on anything else and still sets version/URLs from the tag.
- **Compatibility:** keep `module.json` `compatibility` (minimum 13, verified = newest Foundry checked live, no maximum unless something is known to break) and the dnd5e `relationships.systems` entry (`minimum`, `verified` = last dnd5e checked live, now 6.0.6) accurate. Optional integrations (Item Piles, itempilesdnd5e, …) go in `relationships.recommends`, never `requires`.
- **Hot hooks** (`updateActor`, `updateToken`, `updateItem`, `renderChatMessageHTML`, canvas/refresh hooks, …) bail out in their first lines when the change isn't relevant: check `changes` (`foundry.utils.hasProperty`), our flag, `isActiveGM()` for writers, or whether the UI is even showing, before any loop over scenes/tokens.
- **Record settings are capped** in their pure model (`HISTORY_MAX` 500 in history-model.mjs, `SNAPSHOTS_MAX` 50 in gold-model.mjs) with tests. A new list-like setting gets a cap the same way; don't move existing storage.
- **Flags:** ours live only under `flags.wayfarers-toolkit.*` (plus the legacy `flags.world.trackers` on the tracker journal). Other modules read/change toolkit data through the API, and we never write another module's flags except through its API (Item Piles' own calls).
- **Schema versions:** a stored shape that has changed before or is likely to carries a version and is read through one normalizer: `flightNetwork.version` (flight.mjs `VERSION`), `weaponSets.v`, `lootHistoryData.v`, `goldSnapshots.v`, `quest.v` (`QUEST_VERSION` in quests.mjs; missing = 0, old giver/objective shortcuts). Bump the version and handle the old shape in the normalizer when changing a shape. No migrations without something to migrate.
- **Cleanup covers everything we write:** a new flag, setting, status effect or document must be found by `cleanup.mjs` `plan()` and removed by `remove()` (and listed in its `CATEGORIES` label).
- **Docs:** README *Public API and hooks* lists every `api.*` entry and every hook we fire (`Hooks.callAll("wayfarers-toolkit.*")`), each marked stable or experimental. Update it with any API or hook change.
- **End each release with a live checklist** in the changelog/handoff: what was not run in Foundry and needs checking in a live world.

## Tests
- `npm test` = `node --test tests/*.test.mjs`; `npm run check` syntax-checks all scripts; `npm run lint` ESLint on core's config (`eslint.config.mjs`). CI runs them via core's reusable workflow. 1.27 tests: `tests/v127.test.mjs`.
- Pure and tested: rules, models, parsers, update-note logic, weapon sets, flight network (and map model), phases, history, compare, travel pace, gold curve, settings import validation, permission checks (`tests/v120.test.mjs`), title config, online roster, room costs and coin deduction, rested benefits (`tests/v122.test.mjs`), flight map background placement (`tests/v123.test.mjs`). `tests/_globals.mjs` stubs minimal Foundry globals.
- Not testable in Node (needs a live world): hooks, ApplicationV2 windows, Item Piles integration, sockets, chat cards. Say what is untested in the changelog/handoff.

## Release process
1. Bump `version` in `module.json` and the `download` URL (`.../releases/download/vX.Y.Z/module.zip`); manifest URL stays `.../releases/latest/download/module.json`.
2. Add a `CHANGELOG.md` section and, if user-visible, an `update-notes.mjs` entry.
3. If macros changed: `node tools/build-packs.mjs sources` and commit the JSON (packs are compiled by CI, not locally; `packs/` is gitignored).
4. Commit and push to main. **Agents never tag or publish.** The user publishes the GitHub release; the Release workflow then sets version/URLs, compiles packs and uploads `module.zip`. The zip contains `module.json scripts styles lang sounds packs vendor README.md CHANGELOG.md LICENSE` (vendor minus `vendor/wanderers-core/config/` and `vendor.mjs`): any new folder referenced by `module.json` must be added to the workflow zip step.

## Rules
- Public repo: no campaign names, no game-publisher (WoW/Blizzard) wording in user-facing text, no private details (IPs, domains, local paths). Use generic wording ("classic MMO"). Optional integrations (e.g. a classic item module) are referenced generically.
- No official non-SRD rules text. Never use 5etools or other unofficial rules sites; SRD 5.2 only.
- Every feature must be toggleable; strings are plain English in code (`lang/en.json` is empty).
- Do not put macros on hotbars automatically.
- Commit author `cocoomg11 <cocoomg11@users.noreply.github.com>`; end commit messages with the attribution trailers given by the session.
- Another agent may be committing to main: `git fetch origin main` and rebase before pushing.
