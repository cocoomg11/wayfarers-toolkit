# CLAUDE.md: Wayfarer's Toolkit

Foundry VTT module (v13/v14, dnd5e) of GM tools: hex travel, flight routes, session start, vendor trash loot, character pane, quest log, boss frames, loot rolls, boss loot, three-coin economy. Logic only; campaign content stays in each world. Public repo, MIT.

## File map (`scripts/`)
- `main.mjs` entry: settings, hooks, macros/setup, the module API (`game.modules.get("wayfarers-toolkit").api`).
- `features.mjs` feature registry (`FEATURES`, `on(id)`); `macros.mjs` macro definitions shared by Run setup and the pack build.
- `panel.mjs` / `panel-model.mjs` control panel + welcome wizard (UI / pure data and converters).
- `health.mjs` read-only health check; `cleanup.mjs` "Remove toolkit data" window.
- `update-notes.mjs` (bundled per-version notes + pure logic) and `updates.mjs` (post-update GM chat card, `lastSeenVersion`).
- `gm.mjs` active-GM pick; `log.mjs` debug logging (setting "Debug logging").
- `flight.mjs` network model, checks, importer, encounter-zone parser (pure); `flight-editor.mjs` network editor window.
- `trash.mjs` Vendor Trash; `trash-rules.mjs` pure rules (CR bands, tags); `summary.mjs` merges batched death cards.
- `merchant.mjs` Sell all junk on Item Piles merchants; `junk-rules.mjs` pure junk rules.
- `bosses.mjs` boss frames; `phases.mjs` pure phase thresholds; `bossloot.mjs` boss loot tables.
- `loot.mjs` Need/Greed/Pass; `history.mjs` / `history-model.mjs` loot roll history (UI / pure).
- `pane.mjs` character pane; `weapon-sets.mjs` pure weapon-set rules; `compare.mjs` pure item comparison tooltips.
- `flight-map.mjs` route map window (model: `Flight.mapModel`, `autoLayout`, `newlyUnlocked`, `withPositions` in flight.mjs).
- `travel-pace.mjs` pure pace rules (SRD 5.2 figures, effect text, trip hours/days, socket request reader); UI and socket in main.mjs (`travelPace`, `setTravelPace`, `paceRequest`).
- `gold.mjs` / `gold-model.mjs` party gold tracker (UI / pure curve, coin, gear and status maths).
- `settings-io.mjs` / `settings-io-model.mjs` settings export/import (UI / pure file format and validation).
- `permissions.mjs` pure permission checks; `health.mjs` gathers the facts (`permissionFacts`) for its *Permissions* section.
- `quests.mjs` quest log + tracker. Also `styles/`, `sounds/`, `src/packs/macros` (JSON sources), `tools/build-packs.mjs`.

## Key patterns
- **Feature registry:** one world setting per tool in `features.mjs`. A disabled feature registers nothing (no hooks, buttons, socket handlers, wrappers) and Run setup skips its macros. Gate registration with `on("<id>")`; API getters return undefined when off.
- **Settings & control panel:** keys are stable across versions (never rename). `panel-model.mjs` decides which settings show on which tab (Basic vs Advanced) and labels/hints; `panel.mjs` renders. Add a setting there, not as a loose submenu.
- **Health check:** `health.mjs`, `api.health()`; each check is wrapped, never throws, never changes anything. Add a line when adding a feature with setup needs.
- **Update notes:** each user-visible release gets an entry at the top of `NOTES` in `update-notes.mjs` (plain-words changes, optional `actions` with `check()`/`run()`). Patch releases without an entry post nothing.
- **Active-GM writes:** anything that writes documents automatically runs only when `isActiveGM()` (`gm.mjs`) so multi-GM worlds don't double-write. Players send choices over the socket; the active GM acts.
- **API surface:** `api.quests`, `bosses`, `lootRoll`, `trash`, `bossLoot`, `flight` (+ `flight.map()`), `flightMap()`, `travelPace()`, `setTravelPace()`, `partyGold()`, `gold`, `settingsIO`, `pane`, `panel(tab)`, `wizard()`, `health()`, `setup()`, `setupPlan()`, `updateNotes`, `cleanup`. Macros only call the API.
- Flags live under `flags.wayfarers-toolkit.*`. Windows use the `wct-window` class (backdrop blur is disabled on purpose: it tanks FPS in v14).
- Pure logic goes in files with no Foundry calls at import time so it can be tested in Node.

## 1.20 notes
- New features: `flightMap` (needs `flightMaster`), `travelPace` (needs `hexTravel`), `partyGold`, `settingsIO`, `permissionChecks`. Cross-feature needs are checked at the call site (`F.need` twice) and in `macroOn(m, F.on)` (`feature: "a:b"` on a macro).
- Flight refinements stay in Flight Master: `flightDiscovered` (chat on unlock, in `setFlightNetwork` via `Flight.newlyUnlocked`; an empty previous network announces nothing) and `flightAdvanceTime` (default **false** from 1.20; earlier versions always advanced; update-notes action `flightTime` turns it back on). Map positions live on points as `pos` in `flightNetwork`.
- Travel pace: `travelPaceCurrent` (world, GM writes) and `paceRequests`. Socket action `paceRequest` is only handled when both features are on. Speeds still come from `paceSlow/Normal/Fast`.
- Party gold: settings `goldAct`, `goldCurve` (text, parsed by `parseCurve`; bad text falls back to the default with a warning), `goldIncludeGear`, hidden `goldSnapshots`. No Session Start hook exists, so there's no automatic snapshot; don't add one by changing `sessionStart()`.
- Settings IO: `SKIP` in settings-io-model.mjs lists record-type settings never exported/imported; add new record settings there (and to `WIZARD_IGNORE`).
- Health: *Permissions* lines come from `Perm.featureChecks(facts)`; add a need there when a tool starts relying on a player permission.

## Tests
- `npm test` = `node --test tests/*.test.mjs`; `npm run check` syntax-checks all scripts. CI runs them (`test.yml`).
- Pure and tested: rules, models, parsers, update-note logic, weapon sets, flight network (and map model), phases, history, compare, travel pace, gold curve, settings import validation, permission checks (`tests/v120.test.mjs`). `tests/_globals.mjs` stubs minimal Foundry globals.
- Not testable in Node (needs a live world): hooks, ApplicationV2 windows, Item Piles integration, sockets, chat cards. Say what is untested in the changelog/handoff.

## Release process
1. Bump `version` in `module.json` and the `download` URL (`.../releases/download/vX.Y.Z/module.zip`); manifest URL stays `.../releases/latest/download/module.json`.
2. Add a `CHANGELOG.md` section and, if user-visible, an `update-notes.mjs` entry.
3. If macros changed: `node tools/build-packs.mjs sources` and commit the JSON (packs are compiled by CI, not locally; `packs/` is gitignored).
4. Commit and push to main. **Agents never tag or publish.** The user publishes the GitHub release; the Release workflow then sets version/URLs, compiles packs and uploads `module.zip`. The zip contains `module.json scripts styles lang sounds packs README.md LICENSE`: any new folder referenced by `module.json` must be added to the workflow zip step.

## Rules
- Public repo: no campaign names, no game-publisher (WoW/Blizzard) wording in user-facing text, no private details (IPs, domains, local paths). Use generic wording ("classic MMO"). Optional integrations (e.g. a classic item module) are referenced generically.
- No official non-SRD rules text. Never use 5etools or other unofficial rules sites; SRD 5.2 only.
- Every feature must be toggleable; strings are plain English in code (`lang/en.json` is empty).
- Do not put macros on hotbars automatically.
- Commit author `cocoomg11 <cocoomg11@users.noreply.github.com>`; end commit messages with the attribution trailers given by the session.
- Another agent may be committing to main: `git fetch origin main` and rebase before pushing.
