# Changelog

All notable changes to Wanderer's Toolkit. Versions follow the `version` in `module.json`.


## Unreleased (planned 2.2.0)

Renown (reputation), one slice. New feature `renown` (on by default; until the GM adds a faction, the Reputation page only says there are none). Nothing to migrate: older quests read an empty renown reward list (quest record version unchanged), and no stored shape changed.

**Added**
- **Renown per character, per faction** (no party score). The GM defines factions in **Factions and renown…** (control panel › Character, `api.renown.setup()`): name, short note, parent side (subfactions) or group, hidden from players, inactive, a starting-faction bonus switch (data only, not applied), the shared tier set or custom tiers for the faction, and the faction's Item Piles merchants. **Tiers** are world data: colour, name, threshold, merchant discount %, unlocked rarity text, perk text, title text; defaults are four generic tiers at 3 / 10 / 25 / 50 (Known, Trusted, Esteemed, Celebrated; rename freely) with 0 / 10 / 15 / 25 % off. Renown never goes below 0; no opposed pairs.
- **Awards**: the Award renown window (whole party or picked characters; gain presets +1 / +2 / +3 and dice-loss presets 1d8 / 2d6 / 2d12, both editable under *Tiers and presets*; any amount or a custom formula, rolled per character), with a preview line and a chat card (*+2 renown · Faction … is now Trusted (10): perk · 10% off*) whispered to the GMs and the characters' owners (GMs only for a hidden faction).
- **Other sources**: GM-added labels per character per faction (*Bastion in their land +1*), shown on the row and counted into the total. No automation.
- **Quest renown rewards**: *Add renown* rows in the quest editor (faction ± amount), shown in the quest log, its journal page and the completion card, and given to each member character of the quest's party when the rewards are paid (through the same award: card and hook). Rewards with a hidden faction are left out of the quest's public view.
- **Reputation page** on the toolkit character sheet (bookmark after Biography; only while Renown is on): the tracked faction pinned with its next-tier perk, factions grouped by parent side / group (fold a group), search, All / Subfactions / Neutral, Show inactive, Sort by renown or name, tier bar *12 / 25 to Esteemed*, discount, other sources, tier key. Owner: track a faction; observers: read only; GM: Award, ± and + per row, × on a source, the score in Edit mode. With the toolkit sheet off, dnd5e's character sheet gets a **Reputation** header button opening the same page in a window (`api.renown.open(actor)`).
- **Merchant discounts through Item Piles**: Item Piles' public `API.updateMerchantPriceModifiers(merchant, [{ actorUuid, buyPriceModifier, sellPriceModifier, override }])` (checked in Item Piles' source, `src/API/api.js`; prices read by `getMerchantModifiersForActor` per buying actor). Each character's discount at a linked merchant becomes their own buy modifier (10 % → 0.9; sell kept at 1, so selling prices don't change). Only entries the toolkit set are ever changed (recorded in the GM-only store; an entry the GM made or changed is left alone and reported by the health check); an ended discount writes a neutral entry (Item Piles' API can't delete one). Updated after each change on that GM's client and by the leader at load. Without Item Piles: shown on the sheet and in the health check only.
- **Hook** `wayfarers-toolkit.renownChanged` `{ actorId, factionId, before, after, delta, tierBefore, tierAfter }` (ids and numbers; GM client; with *Hooks for other modules* on), experimental. **API** `api.renown` (experimental): `factions`, `faction`, `tiers`, `get`, `open`, `track`; GM: `award`, `setScore`, `addSource`, `removeSource`, `setup`, `awardDialog`, `sync`.
- **Health check** section *Renown*: factions (hidden count), characters with renown, shared tiers, where players see it, merchant links (missing actor, not a merchant, Item Piles off, the GM's own price kept, prices to update), quest rewards naming a deleted faction, the hook.
- **Remove toolkit data**: new category *Put back the Item Piles merchant prices Renown set* (runs before the GM-only records are deleted); renown actor flags go with *actors*, hidden factions with the GM-only records, `renownConfig` with the settings reset.

**Where data lives**
- World setting `renownConfig` (record setting; `RECORD_SETTINGS` + `WIZARD_IGNORE`): shared tiers, award presets, factions players may see. Every client reads it, so hidden factions are never in it.
- GM-only store bucket `renown`: hidden factions, every character's renown with them, and the Item Piles entries the toolkit set (`{ merchantId: { actorUuid: buyModifier } }`). Switching *Hidden from players* moves the faction and its renown between here and the characters.
- Actor flag `flags.wayfarers-toolkit.renown` `{ v: 1, scores, ribbons, tracked }`: the character's renown with visible factions (readable by whoever can see the character, which is the point).
- Caps (renown-model.mjs): 100 factions, 8 tiers, 12 other sources per faction per character, 200 factions per character, 50 merchants per faction, 6 presets each, 500 recorded Item Piles entries.

**Review fixes** (independent review: "ship after fixes")
- **High: hidden renown and discount records now really clear.** The GM-only store deletes keys only three levels deep and Foundry merges objects, so a hidden score set to 0, a removed source, a deleted faction's entries and a cleared discount record came back. The `renown` bucket is now stored with `scores` and `applied` as arrays (`HIDDEN_VERSION` 2, `storeHidden`), which an update replaces whole; `normalizeHidden` still reads the earlier map shape (pre-release builds), and the next write converts it. Every write goes through one path (`writeHidden`). Tested on core's fakes (`-=` keys and v14's deletion operator).
- **Medium: quests follow a faction's visibility.** Hiding, showing, renaming or deleting a faction re-saves every quest that names it as a reward (the quest log's own save: GM record, journal flag and page), so a hidden faction's name no longer stays on a quest page players read, and a shown one appears. Chat cards already posted can't be changed (the hidden switch's hint says so, and that Item Piles' per-character prices are in data players' clients receive).
- **Medium: turning Renown off puts back its Item Piles prices.** Registered whatever the feature setting: with Renown off, the acting GM resets the prices it recorded once Item Piles is ready (with a notice). The health check warns while any remain.
- Quest pay with renown rewards and Renown off now pays nothing and leaves the quest unpaid (it used to mark it paid without the renown); a quest whose only rewards are renown shows no Pay button while Renown is off.
- No double awards: the Award window awards once per submit (button disabled while it runs), and a quest is paid once at a time.
- The award card shows the change actually applied (a loss stops at 0), with the roll as rolled.
- Remove toolkit data puts back Renown's merchant prices whenever the GM-only records journal is deleted, even if the Renown box isn't ticked.
- Loops (discount plans, the health check, the setup window's sources) read the GM-only bucket once.
- Docs: visible renown is owner-editable like any actor field; the update note mentions the new Reputation button on dnd5e's sheet.

**User decisions in this round**
- **Merchant discounts are optional**: new feature `renownDiscounts` (*Renown merchant discounts*, default **off**, needs `renown`; not in the Classic MMO preset). Off: no Item Piles price is read for planning or written; tier discounts show greyed as *10% (discounts off)* on the sheet, the tier key and the card; the setup window hides the merchant ticks (links are kept). Turning it off (or Renown off) puts back the recorded prices at the next load (the same leader check, `R.offReset` on `discountsOn()`); health lines for both states.
- **Defaults stay** (3 / 10 / 25 / 50, 0 / 10 / 15 / 25 %, +1 / +2 / +3, 1d8 / 2d6 / 2d12, starting-faction +1 / +2 / +3 / +5) and **every one is GM-editable**: the starting-faction steps are now world data (`renownConfig.startBonus`, *Tiers and presets › Starting faction bonus*), and *Tiers and presets* has **Reset to defaults** (confirm; factions, their own tiers and renown stay).

**Changed**
- *Hooks for other modules* hint mentions renown. The quest editor's *Other* reward placeholder no longer suggests renown.
- Tests updated: the sheet's page list includes `reputation`; the quest journal write tests accept `publicQuest(q, PUB)`.

**Tests**: `tests/v220-renown-store.test.mjs` (core's fakes: set → clear → read for hidden scores, sources and discount records, with `-=` keys and the deletion operator; map-shaped bucket read and converted; round trip and cap; faction hidden / shown / renamed / deleted re-saves the quests naming it), `tests/v220-renown.test.mjs` (feature-off reset rule and wiring, pay refused with Renown off and Pay button rule, pay guard, applied delta on the card, award guard, single bucket read; tier defaults and cleaning, standing and bar text, amounts and dice formulas, presets, factions and config caps, actor flag and ribbons, hidden move both ways, GM-only bucket caps, quest rewards and public view, glow stamp unchanged, hook payload, the Item Piles discount plan (create with sell 1, unchanged, tier up, ended → neutral, GM's own and changed entries left alone, override never ours, neutral entry reused), page model and HTML (groups, tracked, filters, inactive, sort, search, folded groups, escaping, no hidden factions or GM controls for players, observers read-only, empty states), chat card and award hint, sheet bookmark, wiring checks, CSS scope, no publisher wording).

**Untested in Foundry** (live checklist)
- Factions and renown window: create a visible and a hidden faction, custom tiers on one, shared tiers and presets saved; search; delete (confirm; characters lose that renown).
- Award renown: whole party and picked; preset gain; dice loss (rolled per character, card shows the roll); custom formula; preview line; card whispered to GMs + owners (hidden faction: GMs only); tier-up line.
- Reputation page (toolkit sheet on): as GM (Award, ±, + source, × source, score field in Edit mode), as owner (track star; pinned box), as observer (read-only), as limited (no page); filters, Show inactive, sort, fold a group, search keeps focus; Enter in search/score doesn't submit the sheet. Re-renders after an award.
- dnd5e's own sheet (toolkit sheet off): header menu *Reputation* opens the window; re-renders on change.
- Hide a faction with renown on characters: actor flags lose it, players' page no longer lists it, GM still sees it marked hidden; show it again: renown back on the characters.
- Quest editor: Add renown rows, save, reopen; quest log shows "Renown: Faction +2 · each character of Party"; player's quest log / journal page doesn't show a hidden faction's reward; Complete and pay gives each party character the renown with a card; with Renown off, a notice and no renown.
- Item Piles 3.3.4: link a merchant; a character at the 10 % tier sees 0.9× buy prices in that merchant (and normal sell prices), another character without a tier sees normal prices; tier up → 0.85; delete the faction → back to normal; a GM-made per-character price is kept and the health check warns; the merchant's own Item Piles settings show the per-actor entries. Unlinked merchant tokens and buyers acting through an unlinked token are not covered (Item Piles matches the buyer's actor UUID).
- Remove toolkit data with *Put back the Item Piles merchant prices* ticked: entries back to 1.
- Review fixes: hidden score to 0 (and last source removed) survives a reload; hide → show → hide brings no old score back; hide a faction a visible quest rewards, then as a player its journal page and quest log don't name it; Renown off with discounts set → after reload a player's price is normal (notice to the GM); double-click Award / Enter twice awards once; quest with renown rewards and Renown off: Pay refused, quest not marked paid; Remove toolkit data with only the GM-only records ticked puts the prices back; a linked merchant placed as an unlinked token whose pile data was edited on the token (does the world actor's per-character price apply?); the Reputation header button on v13 and v14, not on the toolkit sheet.
- Health check *Renown* lines; `api.renown.*` from the console as GM and as a player (GM-only calls warn); the `wayfarers-toolkit.renownChanged` hook fires once per character.

## 2.1.2

2026-11-06. Live-tested on Foundry 14.370; one small sheet fix. No migration.

**Live test** (Foundry 14.370, dnd5e 6.0.6, Item Piles 3.3.4): the 2.1.1 coin fix and the tick-lists PASS; player views as owner, observer and limited PASS; 14.370 checks PASS (Red Book session time, map pins, GM-only data). Real mouse drags for container move and doll slots still need a manual try.

**Fixed**
- Character sheet, Special traits page: a user who can only view the character (observer) saw "Switch to Edit to change these". The hint now shows only to users who can edit.

**Changed**
- `compatibility.verified` is now 14.370 (minimum 13, no maximum; dnd5e verified stays 6.0.6).

**Tests**: `tests/v212.test.mjs` (hint only when editable, version, note).

**Untested in Foundry** (live checklist)
- Drag an item into a container and onto doll slots with a real mouse.
- Special traits page as an observer: no hint, fields disabled; as owner in Play mode: hint shown.

## 2.1.1

2026-11-06. Two fixes from the 2.1.0 live test. No migration; Item Piles' currency list is rewritten once on the next load in three-coin worlds (as before, only with *Set Item Piles coins for three coins* on).

**Live test of 2.1.0** (GM side, Foundry 14.369, dnd5e 6.0.6, Item Piles 3.3.4): ready to keep building. Two problems, fixed here.

**Fixed**
- **Item Piles never showed silver** ("1g 5000c" for 1.5 gp) and silver payments could compute NaN: Item Piles 3.3.4 needs its currencies largest first. The toolkit's three-coin list (`IP_COIN_ROWS` / `ipCoins()` in rounding-model.mjs) is now gold, silver, copper, and `ipCoinsMatchList` only accepts that order, so a world set copper-first by 2.1.0 (or earlier) is corrected once with the GM whisper, which now reads "gold, silver and copper". Merchant rounding and Sell all junk read rates by size, not position (tested).
- **Control panel tick-lists**: unticking and re-ticking a relic class (also compendiums, parties, ignored users, hidden scenes) left "Unsaved changes in 1 setting" because the rebuilt list came out in a different order. Tick-lists now compare as sets (`M.sameList`) and Save writes the saved order first, then new picks (`M.listValue` / `keepOrder`).

**Tests**: `tests/v211.test.mjs` (coin order descending, copper-first doesn't match, helpers order-independent, tick-list comparison and values for every list kind, version and note).

**Untested in Foundry** (live checklist)
- Load a three-coin world whose Item Piles list is copper-first: whisper "set to gold, silver and copper"; Item Piles' currency settings show gold, silver, copper; a 1.5 gp purchase shows "1g 50s" and pays with correct change. Next load: no whisper.
- Health check: "Item Piles' currencies match the three coins."
- Control panel › Character › relic classes: untick and re-tick a class → no unsaved mark; change one and Save → the stored list keeps the old order with the new class at the end. Same for Vendor Trash compendiums, quest parties, ignored users.

## 2.1.0

2026-11-06. Character sheet replacement, slices 3 and 4: every page is now built. Also small quality-of-life fixes, README screenshots and an optional Merchant coin rounding. Nothing new stored, no migration.

### Slice 3: Features and Spells

**Added**
- **Features page**: a **Classes** box (level, subclass, hit die; *+ Add subclass* when dnd5e's subclass advancement is due, through dnd5e's compendium browser; edit mode: dnd5e's level change with its advancement manager and level-down confirmation, delete via dnd5e's dialog, *+ Add class*), then the features in dnd5e's sections (by origin: each class with its subclass, species, background, other; or Active / Passive with the Group button), each row with uses, recovery, recharge, use, description toggle and dnd5e's item menu inside dnd5e's `<dnd5e-inventory>` element. Search, the Action / Bonus / Reaction / Short rest / Long rest / Concentration / Magical chips (dnd5e's filter rules), sort manual / A–Z, *+ Create feature* (dnd5e's create dialog with its Features types).
- **Spells page**: a card per spellcasting class (ability modifier, spell attack, save DC, prepared n / max; the radio sets the character's spellcasting ability like dnd5e's), the spellbook sections dnd5e builds (cantrips, spell levels, pact magic, at-will / innate / ritual, spells from items) with **slot pips** (dnd5e's click rule; pact pips purple; temporary slots dashed; edit mode: the spell slot settings gear), time / range / target / roll columns, C and R tags, dnd5e's prepare toggle (always-prepared shown, not toggled), cast by clicking the name. Filters: action types, concentration, ritual, prepared, each spellcasting class and school; sort A–Z / priority / manual; *+ Create spell* in edit mode.
- Drops on these pages go through the dnd5e drop host with the page as its tab: features get dnd5e's advancement, spells take the section's casting method (dnd5e's rule), and only the Inventory page turns spells into scrolls.

**Not 1:1 with dnd5e 6.0.6**
- No favourites (by design). The Classes box replaces dnd5e's class pills (same actions); its level select lists levels 1–20 by delta like dnd5e's but doesn't grey out levels beyond the character cap (dnd5e's own level change still refuses them).
- Filter chips can only include (dnd5e also lets you exclude with a right-click); list state is per window, not remembered per user.
- Spell rows don't list their activities as sub-rows (cast the spell to pick one); spell slots can't be dragged to the hotbar from the section header.
- The spell "Range" column shows dnd5e's range value and unit as text (dnd5e draws its own number parts).

**Tests**: `tests/v21-sheet-book.test.mjs` (chips and sorts by dnd5e's rules, feature grouping and sections, classes box and edit controls, slot pips and the togglePip rule, spellcasting cards, sections with data-level / data-method, columns, tags, prepare toggle, edit/observer differences, wiring to dnd5e's methods, CSS scope).


### Slice 4: Effects, Biography, Bastion, Special traits, level up

**Review fixes (slices 3–4)**
- Level down: declining dnd5e's "remove advancements" question now still lowers the level, as dnd5e does (closing the dialog cancels).
- Bastion: the × on occupants and defenders shows in Edit mode only (dnd5e); pending trades still ask dnd5e's question. Facility subtitles are escaped.
- Features: a subclass can be deleted in Edit mode (dnd5e's delete dialog).
- Leaving Edit mode saves text still open in a ProseMirror editor (biography, bastion description) first; the Play / Edit switch and Shift+E share one path.
- Special traits: emptying a numeric flag (crit threshold, …) unsets it. Add class / subclass / facility set the dnd5e drop helper's page explicitly.
- Live checks: level down with and without removing advancements; occupant × hidden in Play; delete a subclass; type in the biography editor and switch to Play without saving (text kept); clear a crit threshold (dnd5e's sheet shows it empty).

**Added**
- **Effects page**: dnd5e's own `<dnd5e-effects>` element with the sheet's markup, so dnd5e does the work: conditions as buttons (click to add / remove; exhaustion and other levelled conditions up on click, down on right-click), effects in dnd5e's categories (temporary, passive, inactive, unavailable, enchantments) with duration, source link, on/off switch (not for concentration), description with its changes, and dnd5e's effect menu (edit, duplicate, delete, disable, break concentration). Effects on items show with their item. Search; *+ Create effect* in Edit mode.
- **Biography page**: dnd5e's nine characteristics, the ideals / bonds / flaws / personality traits / appearance boxes and the biography; Edit mode uses fields, text areas and Foundry's ProseMirror editor (as dnd5e's sheet).
- **Bastion page** (only when dnd5e offers a bastion): name, defenders, basic and special facilities (dnd5e's counts for the character's level), each with size or build state, order progress, crafted item and occupant slots; give orders (dnd5e's `facility.use`), remove occupants or cancel a pending trade (dnd5e's question), add facilities through dnd5e's compendium browser, drop actors on occupant slots (dnd5e's drop); description in ProseMirror.
- **Special traits page**: original class and dnd5e's character flags and global bonuses, editable in Edit mode, shown disabled in Play mode (as dnd5e's sheet).
- **Level up**: in Edit mode the title band's level badge gets a **+**; it runs dnd5e's level change and advancement windows (one class), or asks which class (several), with *Add a class*. The Features page's level selects share the same path.

**Not 1:1 with dnd5e 6.0.6**
- Effects can't be favourited (by design); no effect sort control (dnd5e lists effects A–Z with a search only, as here).
- Biography text boxes save on change (leaving the field); the biography editor saves with its own save button. dnd5e saves both through its sheet form.
- Bastion: no drag-to-reorder of facilities; facility order icons show as a label.
- Special traits fields are plain inputs (dnd5e renders its own form fields); bonus formulas are saved as typed and validated by dnd5e on update.

**Tests**: `tests/v22-sheet-extra.test.mjs` (effect categories by dnd5e's rules, effects markup for dnd5e's element incl. item effects and conditions, edit / observer differences, biography fields and editor, bastion slot counts, facilities, occupants and dnd5e's actions, bastion only when offered, special traits disabled in Play, level-up medallion and choices, the one changeLevel path, APP_CONTRACT intact, every bookmark has a page).


### Small quality-of-life fixes

**Fixed**
- **Control panel: the "unsaved" mark stayed after you put a field back.** The mark (on Save, the tab and the footer note) now follows the real difference from the saved value: change a setting and change it back, and the mark goes away. Save uses the same comparison, so what is marked is exactly what Save writes.
- **A player calling `api.open()` (or any GM-only call that goes through the shared check) got "GM only." with no module name.** The notice now reads "Wanderer's Toolkit: GM only.", like the rest of the GM-only API.

### Merchant coin rounding

Nothing stored in documents; one hidden world setting.

**Added**
- **Merchant coin rounding** (new feature `merchantRounding`, **off by default**, Features tab; needs Item Piles). Item Piles 3.3.4 rounds a merchant price (item price × the merchant's modifier) to its *Currency decimal digits* (default 0.00001 of the primary coin) and then floors each coin, so with gold primary and copper at 0.0001, a 1-copper item at 50% showed "0g 0s 0c" and was free, and 3 copper at 50% became 1 copper. With the feature on, the active GM sets Item Piles' *Currency decimal digits* to the smallest coin (the finest exchange rate among Item Piles' currencies and every merchant's own currency list; 0.0001 for the three-coin economy) through Item Piles' public `game.itempiles.API.setCurrencyDecimalDigits`, once Item Piles is ready on each load and again when Item Piles' currencies change. Prices then round to a whole smallest coin, half up: 1 cp at 50% → 1c, 3 cp at 50% → 2c, 1 sp at 50% → 50c, quantity applied after rounding, free items stay free.
- Setting **Merchant prices round** (`merchantRoundingMode`, world, Loot › Advanced): *Round to the nearest whole coin* (default) or *Item Piles default*. Hidden world setting `merchantRoundingPrev` remembers Item Piles' value before the toolkit changed it (RECORD_SETTINGS + WIZARD_IGNORE); it is put back when the feature is off on a load, the mode is Item Piles default, or Remove toolkit data resets the settings, unless someone changed Item Piles' value since (then theirs stays).
- Health check (Loot extras): on / off / not applied yet, a sample (an item worth 1 smallest coin at half price), merchants whose buy or sell modifier is under 0.5, and an info line when Item Piles is newer than 3.3.4.

**Why this seam**: Item Piles 3.3.4 fires no hook around its price maths (`getPriceData`, `getPriceArray`, `getPaymentData` in `src/helpers/pile-utilities.js`) and ships as one bundled file, so its helpers can't be wrapped; `PRICE_MODIFIER_TRANSFORMER` / `ITEM_COST_TRANSFORMER` belong to the system integration (Item Piles: D&D 5e) and the modifier is rounded to 2 decimals after them anyway. The decimal-digits setting is public API and is used for every price, payment and change sum, so display, trade and change agree. **Limit**: it rounds half up, not always up: less than half a smallest coin still rounds down, and at a merchant under 50% an item worth exactly 1 smallest coin has no price (Item Piles then refuses the trade instead of giving it away).

**Tests**: `tests/v210-rounding.test.mjs` (step from currency lists, plan set / restore / forget, a copy of Item Piles 3.3.4's price maths showing the bug at 0.00001 and the fix at 0.0001, the 1 cp / 3 cp / 1 sp / free / quantity cases, under-half merchants, health lines, wiring).

### Screenshots

README and docs gain screenshots (`docs/images`; not in the module zip).

**Untested in Foundry** (live checklist; Foundry 14.369, dnd5e 6.0.6)

_Features and Spells_
- **Both themes**, **GM and player owner**, **observer** (no buttons, pips not clickable), **edit mode**.
- **Features**: sections match dnd5e's Features tab for a multiclass character (class features under their class, subclass features with the class, species, background, other); Group button → Active / Passive. Uses input (`-1`), recharge roll, Use (activity choice for multi-activity features), description toggle, ⋮ menu (edit, duplicate, delete, display card). Search, each chip, sort. Edit: level up (advancement manager opens), level down (confirmation), delete a class and a subclass, Add class and Add subclass (compendium browser filtered), Create feature. Drop a feat from a compendium (its advancement runs), drop a class (advancement), drop a background.
- **Spells**: cards for each spellcasting class (and a subclass caster); prepared count matches dnd5e; radio changes the spellcasting ability. Sections match dnd5e's (cantrips, levels with slots, pact, at-will / innate / ritual, item-granted spells only when shown in the spellbook). Pips: click the last lit pip spends one, an empty pip restores; a long rest refills; temporary slots show dashed; edit mode shows the gear → dnd5e's spell slot config. Prepare toggle; always-prepared star can't be toggled; prepared filter. Columns (time, range, target, roll) match dnd5e's. Cast a spell (upcast dialog, slot spent). Filters (each school, a class, ritual, concentration) and sorts (priority). Drop a spell onto 1st level / pact section: it gets that method. Create spell.
- Drag a spell row onto the hotbar (dnd5e's macro); drag a feature onto a container on the Inventory page is refused like dnd5e.
- Nothing from slice 2 changed: Character, Details, Inventory still behave as in 2.0.1.

_Effects, Biography, Bastion, Special traits, level up_
- **Both themes**, GM, player owner, observer, Edit mode on every new page.
- **Effects**: conditions match dnd5e's (blinded on / off; exhaustion click up, right-click down, matches the vitals pips); concentrate on a spell → the effect shows, its switch is missing and ⋮ → Break concentration ends it; a temporary effect shows its duration; an item effect lists the item as source (click opens it) and moves to *Unavailable* when the item is unequipped / unattuned; disable / enable; edit (dnd5e's effect sheet); duplicate; delete (confirmation); expand shows changes and description; Create effect; search. Drop an effect from an item or compendium onto the page.
- **Biography**: characteristics and text boxes match dnd5e's tab; edit each (saved on leaving the field); biography editor opens, saves, and the play view shows the enriched text (links, secrets for owners only).
- **Bastion** (enable bastions in dnd5e settings, level 5+ character): the bookmark appears; counts match dnd5e's; give an order (order window), progress bar; remove a defender / hireling; cancel a pending trade; add a basic and a special facility through the browser; drop an actor on an empty occupant slot; rename the bastion; edit the description.
- **Special traits**: values match dnd5e's tab; disabled in Play; tick a feat flag, change a crit threshold, add a global bonus (`+1d4`), change the original class: dnd5e's sheet shows the same.
- **Level up**: single-class character: Edit → click the level badge → dnd5e's advancement windows (HP, features); finish → level and features updated on the Features page. Multiclass: chooser lists each class's next level; *Add a class* opens the browser; at level 20 a notice. Level down from the Features select asks dnd5e's confirmation.
- Shift+E toggles Edit on every page; the level badge's **+** only shows in Edit for owners.

_Quality-of-life fixes_
- [ ] Control panel: tick a switch, untick it again: the Save button, the tab and the footer note lose the mark; edit two settings, revert one: "Unsaved changes in 1 setting".
- [ ] A text field and a number/slider field: change then restore the original value: mark clears; type a different value: mark returns.
- [ ] Scene list and other tick-lists (hidden scenes, packs, classes): untick then re-tick: mark clears; the raw hidden-scenes text box still marks when edited.
- [ ] Encounter zones: add a row then remove it again: the mark clears; edit a row: it marks; Save writes only real changes.
- [ ] As a player, run `game.modules.get("wayfarers-toolkit").api.open()`: the warning reads "Wanderer's Toolkit: GM only."

_Merchant coin rounding_
- Turn on Merchant coin rounding, reload: Item Piles settings › Currency decimal digits reads 0.0001 (three-coin) and the health check's line is ok with "costs 1".
- Merchant at 50%: a 1-copper item shows 1c (buy and sell), 3-copper item 2c, 1-silver item 50c; buy 3 of the 3-copper item: 6c paid, change correct.
- Buy and sell with a purse of only gold or silver: Item Piles makes change correctly.
- A merchant at 25%: health check names it; the 1-copper item there can't be traded (no error in the console beyond Item Piles' own refusal: check this).
- Set the mode to Item Piles default: Currency decimal digits goes back to 0.00001 at once. Turn the feature off and reload: same.
- Change Item Piles' currencies with the feature on: the value is set again.
- Standard 5e coins (gold primary, copper 0.01): set to 0.01.

## 2.0.1

2026-11-06. Fixes from the 2.0.0 live test. No data migration, nothing new stored.

**Live test of 2.0.0** (Foundry 14.369, dnd5e 6.0.6, warcraft-dev world): almost everything passed: the three pages in both themes, GM and player, rolls and config apps, equip from Inventory into the doll slot, pane and sheet staying in sync, drag and drop through dnd5e. Three bugs, fixed here:

**Fixed**
- **Inventory Delete** (the edit-mode row button and ⋮ → Delete) did nothing: dnd5e's `Item#deleteDialog({ sheet })` calls `sheet._confirmDialog(config)`, which the toolkit sheet lacked ("sheet._confirmDialog is not a function").
- **Create item** did nothing: dnd5e's create dialog calls `sheet._renderChild(dialog)` ("sheet._renderChild is not a function").
- Both come from one gap, so the sheet now implements **dnd5e 6.0.6's whole app contract** (`APP_CONTRACT` in sheet-model.mjs, found by searching dnd5e's source for what its documents, dialogs and elements call on a sheet): `_renderChild` (dialogs, activity choice and usage dialogs, advancement confirmations, item sheets), `_confirmDialog` (item, effect and activity deletes; a DialogV2 in the toolkit look, resolving true / false / null like dnd5e's), `changeMode` / `isEditMode` (dnd5e's Shift+E *Toggle sheet mode* key now switches Play / Edit), `_onDropCreateItems` / `_onDropStackConsumables` / `_onDropSingleItem` (group sheets dropping items on a member, through the dnd5e drop host), and `_concentration` (dnd5e's effects element), alongside slice 2's `inventorySource`, `expandedSections`, `canExpand` and `_openDocumentSheet` (which now renders as a child too).
- **Dropping on a Finger slot** logged "Cannot use 'in' operator to search for 'ask' in finger1": a doll drop can resolve to a slot string, and the callers tested it with `in`. Every caller (the sheet's drop and equip handlers, the pane's `_onDrop` / `_equipFromBag`, `dropOnDoll`, `equipToSlot`) now goes through `askOf(r)` (pane-model.mjs), which only reads `{ ask: [...] }` objects.

**Noted, not ours**: dnd5e labels an item with no range value "Range NaN ft" (seen in the Attack box and item tooltips); that text is dnd5e's own `labels.range`.

**Tests**: `tests/v134-sheet.test.mjs` (askOf on strings, objects and empty results; no `"ask" in r` left; every `APP_CONTRACT` member defined on the sheet; the confirm dialog's shape; group drops through the host).

**Untested in Foundry** (live checklist)
- Inventory: edit-mode Delete and ⋮ → Delete ask for confirmation and delete (and the advancement question for an item with advancement); No / closing the dialog keeps the item.
- Create item opens dnd5e's create dialog; the new item appears.
- Drop an item on Finger 1 and Finger 2 (empty and filled), and swap them: no console error.
- Delete an activity from an item's ⋮ (activity row) and an effect: confirmation shows.
- Shift+E on the toolkit sheet toggles Play / Edit (owners only).
- Drag an item from a group (party) sheet onto a member using the toolkit sheet: the item is created once.

## 2.0.0

2026-11-06. Character sheet replacement, slice 2: the **Character**, **Details** and **Inventory** pages. No data migration and nothing new stored: the Character page uses the character pane's existing item flag `slot` and actor flag `weaponSets`.

**Added**
- **Character page**: the paper doll (left and right slot columns, portrait from dnd5e's preferred artwork with *Attuned n / max*, Melee / Ranged / Utility weapon sets with the set in hand lit and a Stowed label on the others, the Relic slot when the pane shows one, the pane's set notes and *Stow shield*), then **Attributes** (name | score | (mod), aligned; click = dnd5e's ability check), **Defence** and **Attack** (follows the weapon set in hand, with the Auto / Melee / Ranged / Spell menu and a **Use** button = `item.use`), and **Equippable items** with *n equipped but not in a slot* and **Slot equipped items**. Drag onto slots or hands, onto the portrait (best place) or back to the strip (take off); click a slot for the picker; right-click to take off. Item quality colours on slot borders (`data-quality`); the pane's tooltips and comparisons. Edit mode: ability score inputs, **Change portrait** / token art (Foundry's file picker; prototype token config for wildcard images) and dnd5e's **Show token instead of portrait** flag.
- **Details page**: six ability medallions (mod, score, save in the corner; click = check, corner = save), Concentration (while concentrating or editing), **Skills** (half / proficient / expertise marks, ability, total, passive; click rolls), **Tools**, **Origin** (species and background items, creature type, size) and **Traits** as dnd5e prepares them. Edit mode: dnd5e's own `<proficiency-cycle>` controls for saves, skills and tools, a skill's ability select, score inputs, size select, and config buttons opening dnd5e's own apps (AbilityConfig, ConcentrationConfig, SkillsConfig, SkillToolConfig, ToolsConfig, MovementSensesConfig, DamagesConfig, TraitsConfig, WeaponsConfig, LanguagesConfig, CreatureTypeConfig), chosen as dnd5e's sheet chooses them.
- **Inventory page**: dnd5e's inventory sections; rows with quality icon, name and subtitle, the item's doll slot, price, weight, quantity (− / +, delta input), uses (or recharge), equip, attune, description toggle and dnd5e's item context menu, inside dnd5e's own `<dnd5e-inventory>` element so dnd5e handles use / view / edit / delete / duplicate / split / quantity / uses / recharge / expand. Search and the Action / Bonus / Reaction / Equipped / Magical chips (dnd5e's filter rules), Sort manual / A–Z, Create item (edit mode, dnd5e's create dialog). Encumbrance bar with dnd5e's breakpoints, coin fields and dnd5e's currency manager (and the toolkit coin display when the three-coin economy is on), containers (drop targets, context menu), attunement count.
- **Equipping from the Inventory places the item in its paper-doll slot** with the pane's rules (`autoEquip`: relic slot, a free hand of a weapon set, else its best gear slot, replacing what was there as the pane does). With no clear slot the item is equipped without one and shows in the *not in a slot* note. Unequipping clears its slot or set.
- **Drag and drop** elsewhere on the sheet is dnd5e's: drops go to an unrendered dnd5e character sheet for the same actor (`_onDrop` → create with advancement, stack consumables, sort, move into and out of containers, spells as scrolls on the Inventory page, effects, actors, folders).

**Changed**
- pane.mjs: the paper-doll logic is exported (`autoEquip`, `slotEquippedItems`, `dropOnDoll`, `slotMenu`, `askSlotMenu`, `itemTooltip`, `attackFacts`, `registerSlotHooks`, …) and the pane's methods call it; no behaviour change in the pane. The slot bookkeeping hooks also run with only the character sheet on.

**Not 1:1 with dnd5e 6.0.6** (closest safe behaviour)
- No favourites bar (by design). Inventory grouping is always by type (dnd5e's "group by type"); dnd5e's group-by-container switch and its filter-chip exclusion state (right-click to exclude) aren't there. Search, chips and sort are per window and not remembered (dnd5e remembers them per user).
- The item list's columns are fixed (Slot, Price, Weight, Qty, Uses); dnd5e's per-section roll / formula columns for weapons and its narrow-width column hiding aren't copied.
- Saving throws are rolled from the medallion corner; there is no separate Saving Throws box (dnd5e has one on Details).
- Species / background pills open the item; adding or deleting species and background stays on the system sheet (link at the foot).
- Item names aren't draggable to the hotbar from the name itself (drag the row); dnd5e's per-activity sub-rows under an expanded item aren't listed (use the item to pick an activity).

**Tests**: `tests/v134-sheet.test.mjs` (built pages and footer link; doll, sets, relic, ghost, notes, attributes columns, edit inputs, attack box, strip and note; shared pane functions and no own slot writes; inventory equip → slot; dnd5e roll methods and config apps; inventory markup inside dnd5e's element; drop host; details medallions, skills marks, traits, edit controls; inventory sections, filters, sort, encumbrance, coins; delta inputs; CSS scope; public-repo words).

**Untested in Foundry** (live checklist; Foundry 14.369, dnd5e 6.0.6)
- **Both themes**: every page body dark; text readable on inputs, selects and the item context menu; the expanded item description readable.
- **GM and player**: a player owner can roll, equip, slot and drag; an observer (another player) sees values but no inputs, roll links, equip / attune buttons or drag; a limited viewer still sees the name only.
- **Character page**: slots, hands and relic show the same items as the pane; open the pane and the sheet side by side and slot something in each: both update. Swap sets (tab), blocked swap note with Stow shield, two-handed ghost in the off hand. Drag item → slot, → hand, → portrait (best place; "Where does it go?" picker for an item with no clear slot), slot → *Equippable items* (unslots), finger 1 ↔ finger 2 swap. Click a slot: picker; right-click: takes it off. Tooltips with comparison. *Slot equipped items*. Attributes click rolls a check (and dnd5e's roll dialog / fast-forward modifiers work); Attack box follows the set; Use rolls the weapon. Edit mode: change a score (also `+1`), Change portrait, Show token instead of portrait (and back), wildcard token art opens the prototype token config.
- **Details page**: medallion click → check, corner → save; Concentration while concentrating; skill click → dnd5e's skill roll; tool → tool roll. Half proficiency (e.g. a feature granting it) and expertise marks match dnd5e's sheet. Edit mode: proficiency cycles write and the sheet redraws; skill ability select; size select (with a species); every gear button opens the same window dnd5e's sheet opens; trait lists match dnd5e's Details tab (including damage modification, condition immunities in play mode, weapon masteries).
- **Inventory page**: sections and items match dnd5e's tab; click a name uses it (activities choice); ⋮ menu shows dnd5e's options (incl. Split stack, Display card, Identify) and works; quantity − / + and typed deltas; uses input; recharge roll; attune toggle; description toggle (expand / collapse); edit and delete in edit mode; Create item. Search filters live; chips; sort A–Z ↔ manual. Encumbrance bar and breakpoints match dnd5e; coin inputs (`+5`), Manage coin; three-coin economy shows g/s/c only.
- **Equip from Inventory → slot**: a helm goes to Head; a ring to a free Finger; a weapon to a free hand of a set (sets on) or Main Hand (sets off); a focus to Relic for relic classes; an item with no clear slot gets equipped and appears in the Character page's note; unequip removes it from its slot / set. Equipping armour while Chest is full replaces it as the pane does.
- **Drag and drop (dnd5e's)**: from a compendium, the Items sidebar and another actor (copy), reorder rows (move), drop onto a container icon (into it), spell dropped on Inventory → scroll, a class or feature dropped → advancement, an Active Effect dropped. No duplicate items after any drop.
- **Edit mode toggle** keeps the page and scroll position; Play hides inputs again.
- Performance: the sheet re-renders on actor / item changes without lag on a character with ~100 items.

## 1.33.2

2026-11-05. Key C for players without an assigned character. No data migration, nothing stored.

**Changed**
- **C opens a player's only character.** A player's C key (`pickSheetActor`, sheet-model.mjs) now picks, in order: the assigned character (as before); with none assigned, the only `character` actor they own; owning several, the selected token's character when it is one of theirs, else the notice "You own several characters: select one's token or assign one in User Configuration."; owning none, the old "no character assigned" notice. The owned list (`game.actors.filter(a => a.type === "character" && a.isOwner)`) is built only for players without an assigned character. GMs are unchanged (the selected token's character).

**Tests**: `tests/v133-sheet.test.mjs` (assigned wins, one owned, several with a selected own token / a token not theirs / none selected, none owned, GM unchanged).

**Untested in Foundry** (live checklist)
- A player with one owned, unassigned character presses C: that character's sheet opens.
- A player with two owned characters and none assigned: C with one's token selected opens it; with no token (or another player's) selected, the "own several characters" notice.
- A player with an assigned character: C opens it, whatever is selected. A player owning none: the "no character assigned" notice.
- GM: unchanged (selected token's character, or the notice).

## 1.33.1

2026-11-05. Follow-up to the 1.33.0 live test. No data migration; the `coreSheetKeyMoved` client setting keeps its key and meaning (the moved action's id).

**Live test of 1.33.0** (Foundry 14.369, dnd5e 6.0.6): the sheet passed: registration and fallback, both themes, System sheet, values, buttons, edit-mode warnings, Bastion bookmark, key C (players and GM, not while typing) and permissions. Core's character-sheet toggle was found as **`core.characterSheet`** (default plain C). It was never moved: Foundry v14's own **`core.focusChat` defaults to Shift+C**, so the clash check blocked the move on every stock client (health warn "Shift+C is already used by core.focusChat"). Our C still won, as designed.

**Changed**
- **Foundry's Toggle Character Sheet now moves to Alt+C** (was Shift+C). Same rules: per client on `ready`, only with *Character sheet replacement* and *Keyboard shortcuts* on; the action is found by scan (`findCoreSheetAction`), never by an assumed id; moved only if its keys still equal its defaults and nothing else on that client fires on Alt+C (`keyClashes`, was `shiftCClashes`: an Alt+C binding, or a plain-C binding with Alt reserved); once per client via `coreSheetKeyMoved`; restore only when the action is still exactly our move; cleanup's settings reset restores too. The target is one constant, `CORE_SHEET_MOVED` in sheet-model.mjs; health texts use its label.
- **Leftover 1.33.0 moves are undone**: where the record is set and the action is still exactly Shift+C (only possible on a client with Focus Chat rebound), the defaults are put back first and the Alt+C plan runs again. With the sheet off, either our Alt+C or 1.33.0's Shift+C is restored.
- **Sheet: page bookmarks on the right.** The bookmark column moved from the left edge to the right edge of the sheet body (`flex-direction: row-reverse` on `.wct-cs-body`, so the markup, keyboard order and aria are unchanged: tabs first, then the page). The flat side of each bookmark meets the content and the rounded side faces outward; the active bookmark still grows toward the content. The page's left/right padding swapped so the content keeps its gutter.
- Wording: the 1.33.0 notes and docs said core's Shift+C was harmless; corrected (it is Focus Chat).

**Tests**: `tests/v133-sheet.test.mjs` updated (Alt+C target and label, a stock-v14 fixture where `core.focusChat` holds Shift+C and Alt+C is free → move, the 1.33.0 clash reproduced, Alt reserved / Alt+Shift+C / rebinds, the leftover Shift+C undo and restore, bookmarks-on-the-right CSS and unchanged markup order).

**Untested in Foundry** (live checklist)
- Stock client with the sheet and *Keyboard shortcuts* on, reload: Configure Controls shows *Toggle Character Sheet* on **Alt+C**, *Focus Chat* still on Shift+C, *Open character sheet* on C; the health check says "is on Alt+C on this computer" (no warn line); Alt+C toggles your character's sheet; Shift+C still focuses chat. On macOS Alt is Option: check Option+C toggles the sheet.
- Clients from the 1.33.0 test: 1.33.0 only wrote `coreSheetKeyMoved` when it actually moved the key, so blocked clients have an empty record and move to Alt+C on the first 1.33.1 load. If one did move to Shift+C (Focus Chat rebound there), the first load puts it back to C, then moves it to Alt+C.
- Turn the sheet off (reload): Toggle Character Sheet is back on C and the record is empty. Cleanup › reset settings with the sheet on does the same.
- Rebind Toggle Character Sheet yourself, turn the sheet off and on: your key stays.
- **Bookmarks on the right**: both themes, the column sits on the sheet's right edge; flat side against the page, rounded side outward; the active bookmark is wider toward the page; the page content keeps a gutter on both sides; Tab moves through the bookmarks then the page as before; screen reader still announces the tab list.

## 1.33.0

2026-11-05. Character sheet replacement, slice 1. New feature `characterSheet`, **off by default**; no data migration, nothing stored (the Play/Edit mode and the page shown are per window).

**Added**
- **Wanderer's Toolkit sheet** for dnd5e `character` actors (`scripts/sheet.mjs` UI, `scripts/sheet-model.mjs` pure, `styles/sheet.css`). An `ActorSheetV2` registered with `DocumentSheetConfig.registerSheet(Actor, "wayfarers-toolkit", WctCharacterSheet, { types: ["character"], makeDefault: true, label: "Wanderer's Toolkit sheet" })` in `init`, **only while the feature is on**. `makeDefault` only changes this load's in-memory default (nothing is written), so switching the feature off (reload) unregisters the class and dnd5e's sheet is the default again; an actor set to this sheet by hand falls back to the default; a GM's own pick under Configure Default Sheets still wins.
- The shell: title band (level medallion, name, class · species · background, XP bar from dnd5e's prepared `details.xp` (hidden for levelling mode *noxp*), Rested badge (with *Rested at the inn*), Heroic inspiration, Short / Long rest, Play / Edit switch), vitals strip (AC shield, HP bar with temp HP, hit dice bar, Initiative, Speed, Proficiency, Exhaustion pips, Death save pips), page bookmarks on the left (Character, Details, Inventory, Features, Spells, Effects, Biography, Bastion only when dnd5e's `bastionConfiguration.availableForActor(actor)`, Special traits) and the conditions bar (the actor's `statuses`, exhaustion left out: it has pips). Pages are placeholders with **Open in system sheet** (opens dnd5e's sheet on the matching tab). No favourites bar (on purpose).
- Buttons call dnd5e: `actor.shortRest()` / `longRest()` (shown to players only with dnd5e's *Allow rests*), `rollInitiativeDialog()`, `rollDeathSave()`; inspiration and exhaustion are `actor.update()` of `system.attributes.inspiration` / `system.attributes.exhaustion` (what dnd5e's own sheet writes; dnd5e syncs the exhaustion effect). Nothing is computed by the toolkit.
- Edit-mode warnings badge beside Rested: the count of dnd5e's own preparation warnings (`actor._preparationWarnings`, the list behind dnd5e's header warning button); hidden in Play mode, when there are none, or if a dnd5e version doesn't have the list.
- **System sheet** header button (and header-menu entry) for GMs: opens `dnd5e.CharacterActorSheet` for the same actor.
- **Key C** (new action `characterSheet`, *Open character sheet*; needs *Keyboard shortcuts* too): a player's assigned character, a GM's selected token's character (notification if none or not a character); a second press closes it when it is the front window. Registered at PRIORITY precedence because Foundry core's *Toggle Character Sheet* is also C (no modifier); while the sheet is on our action runs first. While a text field, select or editable text has focus the press is not consumed (returns false) so the letter is typed. The existing *Open character pane* action is unchanged (same id, still no default key), so keys users bound to it keep working. Clash check: core Shift+W/A/S/D/C/T, dnd5e Shift+B/E, toolkit Shift+K / L, Red Book Shift+R, Satchel Shift+G, Ctrl+Shift+N: none is plain C. (Correction in 1.33.1: core's Shift+C is not harmless for the move below: it is v14's *Focus Chat*.)
- **Foundry's Toggle Character Sheet moves to Shift+C** (per client, on `ready`, only with *Character sheet replacement* and *Keyboard shortcuts* on). Core's action id isn't assumed: `sheet-model.mjs` `findCoreSheetAction` picks the one registered action in namespace `core` whose id or name mentions "character" and "sheet" and whose default keys are exactly plain C (none or several: nothing is moved). It is moved only if its current keys still equal its defaults (not rebound) and no other action on that client would fire on Shift+C (`shiftCClashes`: a Shift+C binding, or a plain-C binding with Shift reserved). The move is `game.keybindings.set("core", <action>, [{ key: "KeyC", modifiers: ["Shift"] }])`, recorded once in the hidden client setting `coreSheetKeyMoved` (the action id; RECORD_SETTINGS + WIZARD_IGNORE), so it never repeats or fights a later rebind. With the sheet or the keys off, core's defaults are put back only if the action is still exactly our Shift+C and the record is set; the record is then cleared (a later user key is kept). Cleanup's settings reset does the same (`restoreCoreKey`). Health: on Shift+C (ok), not found / rebound (info), Shift+C clash naming the actions (warn). **Superseded in 1.33.1:** Foundry v14's own `core.focusChat` defaults to Shift+C, so on a stock client the clash check always blocked this move; 1.33.1 moves to Alt+C.
- Health check section *Character sheet* (read-only): off / on and default / on but another default picked / not registered.
- Control panel: feature card; not in the Classic MMO or Minimal presets (Everything turns it on).

**Tests**: `tests/v133-sheet.test.mjs` (feature default and presets, registration gating, dnd5e calls, key default and clash list, typing guard, actor pick, view model, warnings only in edit mode, owner-only buttons, bookmarks and Bastion, limited view, exhaustion pips, CSS scoping / no theme selectors, public-repo words).

**Untested in Foundry** (live checklist)
- Feature off (default): character sheets are dnd5e's, no C binding, no health warning.
- Turn it on (reload): opening a character from the sidebar shows *Wanderer's Toolkit sheet*; Sheet configuration lists it; turning it off restores dnd5e's sheet.
- Both themes: sheet body dark and identical; only the window frame changes.
- GM: **System sheet** header button and header-menu entry open dnd5e's sheet; players don't see it. **Open in system sheet** on a page opens the matching dnd5e tab.
- Values match dnd5e's sheet: level, XP bar, AC, HP / temp HP, hit dice, initiative, speed, proficiency, exhaustion, death saves, conditions; equip armour or add an effect and the sheet updates.
- Buttons: inspiration toggles; Short / Long rest open dnd5e's dialogs; Initiative opens dnd5e's roll dialog (adds to combat); death save button rolls at 0 HP (dnd5e warns otherwise); exhaustion pips set / lower the level and the condition follows.
- Edit mode: the edit note shows; with two body armours equipped the warnings badge shows 1 warning with the text on hover; Play mode hides it.
- Bastion bookmark only with bastions enabled and a level 5+ character.
- Key C: player opens own character, again closes; GM with a character token selected opens it, with nothing selected gets the note, with an NPC selected gets the note; typing "c" in chat, a journal editor or a sheet field types the letter. Rebinding *Open character sheet* in Configure Controls works and survives reload.
- Core key move: with the sheet and *Keyboard shortcuts* on, reload; Configure Controls shows Foundry's *Toggle Character Sheet* on Shift+C and *Open character sheet* on C. **Verify the actual core action id** (health check line, or `game.settings.get("wayfarers-toolkit", "coreSheetKeyMoved")`) and that Shift+C was free in this world (no warn line). Shift+C toggles your character's sheet (dnd5e's default or ours). Rebind core's action to another key, turn the sheet off and back on: your key stays. Turn the sheet off (reload): core is back on C and the setting is empty. Cleanup › reset settings with the sheet on puts core back on C. A second client (another browser) gets its own move.
- Observer / limited permission: observer sees values without buttons; limited sees name only.

## 1.32.0

2026-11-01. Quality-of-life fixes from a live usability pass. No data migration; two new world settings (`pruneToolkitCards`, `permIgnoreUsers`), one new API entry (`api.open()`), and a default key for the control panel.

**Changed**
- **Less clutter in chat.** A live world had 63 of 122 chat messages as toolkit cards, most of them old health check and update notes cards. Now, when the toolkit posts a health card or an update notes card, the GM who posted it deletes the toolkit's older cards of that kind, so at most one of each is left. New setting **Keep only the newest health and update card** (`pruneToolkitCards`, world, on by default; control panel › Overview) turns it off. **Clear old toolkit cards…** (also on Overview) counts the old cards, asks, and deletes them, keeping the newest of each.
  - How a card is recognised (`chat-cards-model.mjs`, pure): it must have the toolkit's flag for that kind *and* that card's root class, and must not have been written by a player. Health cards have carried `flags.wayfarers-toolkit.health === true` since 1.13 and a `wct-health` class in every version; update cards have carried a `flags.wayfarers-toolkit.updateNotes` object since 1.17 and a `wct-update` class. So older cards are found safely without a new flag. From 1.32 new cards also carry `flags.wayfarers-toolkit.toolkitCard = "health" | "updates"`, checked the same way. Players' messages, loot, loot roll, quest, room, pace and other toolkit cards can't match. Deleting uses `ChatMessage.deleteDocuments(ids)`, GM only.
- **"No character to act with" can ignore users.** The health check's no-character warning has an **Ignore these users** fix (control panel Overview and the Wanderer's Satchel; asks first) that adds those players to **Players not checked for a character** (`permIgnoreUsers`, world, list of user ids, capped at 100; control panel › Loot › Advanced, a tick list of player users). Ignored players are left out of the warning; when everyone else is fine the line is OK and says who wasn't checked, otherwise an info line names them.
- **Routes into locked flight points.** Several such routes are now one line, "N routes lead into locked flight points", with the routes behind a **Show the routes** toggle in the chat card, the health window and the Overview. One route reads as before. In `healthReport()` (plain text) the list follows the line after a colon.
- **Character pane on short screens.** It opened 580 × 880 and was cut off on short screens. The opening height is now min(880, screen height − 100), and on screens too short for the sheet the window minimum follows the screen (not below 360) and the sheet scrolls inside the window. Remembered positions still work (core still clamps them to the screen).
- **Control panel: unsaved-changes marker.** The Save button and every tab with unsaved edits get a small dot. Checked first: switching tabs never lost edits (every tab stays in the page and Save writes all of them), so there's no confirm on tab switch; only closing the window drops them, as before.
- **Control panel shortcut.** *Open the control panel (GM)* now has a default key: **Shift+K**. Shift+T was asked for, but Foundry v14 core's *Target Token* is T with Shift reserved (Shift+T adds to your targets), so it would clash; nothing in core or dnd5e 6.x uses K. Change it under Configure Controls (feature *Keyboard shortcuts*). The character pane still has no default key.
- **`api.open(tab?)`**: GM, opens the control panel (same as `api.panel(tab)`); the Wanderer's Satchel launcher calls it. The rest of the API is unchanged.

**Tests**: `tests/v132.test.mjs` (card recognition and pruning incl. pre-1.30 markup, players' and other cards never matched; prune and setting wiring; ignore list and the permission lines; locked-route collapse and its plain text; pane height maths; unsaved marker; the Shift+K default and `api.open`; version). `tests/v130-core.test.mjs` updated for the pane minimum and the control panel default key.

**Untested in Foundry**
- Post the health card twice (Overview › Full health report): only the newest stays. Same after an update notes card (Overview › Show update notes). With *Keep only the newest…* off, older cards stay.
- Clear old toolkit cards… in a world with many old cards: the count in the confirm is right, only health and update cards go, the newest of each stays; loot, loot roll, quest, inn and pace cards and players' messages stay. A player-posted message never goes. Pre-1.30 cards ("Wayfarer's Toolkit … health check") are found too.
- With two GMs online: only the posting GM deletes; no errors on the other client.
- No-character warning: the Fix button (Overview and Satchel) asks, adds the players, and the next check shows OK / the info line; the tick list under Loot › Advanced shows and saves them; unticking brings the warning back.
- Several routes into locked points: one line with Show the routes in the chat card, the health window, the Overview and the Satchel (plain text with the list).
- Character pane on a short window (e.g. 768 px tall): opens fully on screen, the sheet scrolls inside; on a tall screen it looks as before; a remembered size and position still apply; resizing still can't go below 540 wide (or 780 tall where the screen allows).
- Control panel: editing a setting marks Save and that tab; switching tabs keeps the edit; Save clears the marks.
- Shift+K opens the control panel for a GM (with *Keyboard shortcuts* on); nothing for a player; Shift+T still adds targets. `game.modules.get("wayfarers-toolkit").api.open()` opens the panel; the Satchel launcher opens it.

## 1.31.1

Two fixes from a live test of 1.31.0. No data migration.

**Fixed**
- The comparison on the loot roll card never showed for players on Foundry v14: `addCompare` waited for the item and then required the card element to be connected, but the element the `renderChatMessageHTML` hook gives is still detached at that point (it is attached after a `setTimeout(0)`). It now inserts into the element it was given, and skips only when a newer render of the same element has started or a comparison is already there, so a re-render never doubles it.
- Loot history: a Red Book session whose name already contains its date (e.g. "Session 9 - 2026-11-01") no longer gets the date appended again.

**Tests**: `tests/v131-compare.test.mjs` (source check: no `isConnected` guard, stale-render guard), `tests/v131-history.test.mjs` (session label with and without the date in the name).

**Untested in Foundry**
- Loot roll card as a player who can roll: the comparison appears on a fresh card and after a reload, appears once after the card re-renders (a choice from another player, a GM connecting), and not at all for the GM or once the roll is closed.
- Loot history with the Red Book: a session named with its date shows the date once; one without it still shows "(date)".

## 1.31.0

New feature: open a merchant for the players. Also: loot history by session, and a comparison on the loot roll card. No data migration; one new feature switch and one new world setting.

**Added**
- **Open shop for players** (new feature `merchantShop`, on by default, Features tab; needs Item Piles). GM only. A GM's Item Piles merchant window gets **Open for players** and **Close for everyone** in its title bar; merchant tokens get a shop button in the token HUD (click: open, right-click: close for everyone); scripts call `api.shop.open(merchant, { users, onlyOnScene })`, `api.shop.close(merchant)` and `api.shop.openedFor(merchant)` (experimental). The pick dialog (core look) lists connected players with a character they own, all ticked, and an optional *Only players whose tokens are on this scene*. Each chosen player gets the merchant's Item Piles window with their own character as the buyer and seller, so Item Piles' prices, coin and merchant settings apply as usual, and the Sell all junk button and item comparison tooltips appear in it as they do when the player opens it. Players with no character, a character they don't own, who aren't connected or (with the scene option) have no token on the scene are named in a notification; nothing throws.
  - Item Piles call (checked in Item Piles 3.3.4's source, `src/API/api.js`): `game.itempiles.API.renderItemPileInterface(merchant, { userIds: [userId], inspectingTarget: characterUuid })`, one call per player because Item Piles takes one inspecting target per call; Item Piles sends it to that user's client over its own socket. Close: `unrenderItemPileInterface(merchant, { userIds })`. The toolkit sends no socket message of its own and stores nothing; who it was opened for is kept on the GM's client for Close for everyone (after a reload, Close for everyone goes to every connected player).
- Setting **Say when a shop opens** (`shopChatLine`, world, default off; Loot › Advanced): a whispered "The shop is open" line to those players and the GM.
- Health check: an *Open shop for players* line (Loot, junk and phases); the Permissions section counts shops opened for players among the tools that need a character the player owns.
- **Loot history by session.** The Loot history window's date filter becomes a *Session* filter: with the Red Book module active (optional; now in `relationships.recommends`), its sessions, read through its public API (`game.modules.get("red-book").api.session.list()` → ids, then `session.get(id).startedAt` / `endedAt`, GM only); rolls outside every session, and every roll without the Red Book, are grouped by local date as before. A **By session** switch groups the list under a heading per session or date. The per-player tally and Export CSV follow the filter. Pure parts in `history-model.mjs` (`normalizeSessions`, `sessionOf`, `groupKey`, `sessionGroups`, `inGroup`). Nothing stored; the window's choice is per window.
- **Compare on the loot roll card.** Each player who can still roll sees, on their own copy of an open Need / Greed card, the item compared with what their character has in that slot or hand (`pane.mjs` `comparisonHTML`, the same rules as the comparison tooltips in `compare.mjs`; the new pure `showOnLootCard` decides who sees it). Built on the player's client on each render from the card's item; nothing is added to the message. Follows *Item comparison tooltips* and needs the character pane. GMs don't get it.

**Tests**: `tests/v131-history.test.mjs` (Red Book session reading, bucketing, past-midnight and open sessions, date fallback, optional integration), `tests/v131-compare.test.mjs` (who sees the card comparison; built client-side, never stored), `tests/v131-shop.test.mjs` (user selection, the per-player Item Piles calls and UUID/id checks, close targets, the API's `users` option, feature/panel/permission wiring, source checks: Item Piles only through its API, no socket or flags, every Item Piles call caught).

**Untested in Foundry**
- With Item Piles 3.3.4 (and its dnd5e module), as GM: Open for players from a merchant window header and from a merchant token's HUD; the dialog lists only connected players with an owned character; unticking one leaves them out; *Only players whose tokens are on this scene* leaves out a player with no token there.
- On each player's client the merchant window opens with their own character as the buyer; buying and selling move coin and items as usual; an unlinked (token) merchant keeps its own stock; a merchant set closed or with Item Piles' own restrictions behaves as Item Piles decides.
- Sell all junk button and comparison tooltips work in the pushed window.
- Close for everyone (header and HUD right-click) closes it on those players' screens and not on the GM's; after a GM reload it closes for every connected player.
- A player with no character, a character they don't own, or offline: named in the GM's warning, no error in either console. `api.shop.open(m, { users: "Name" })` and `{ users: null }` from a macro; a player calling `api.shop.open` gets "GM only".
- *Say when a shop opens* on: one whisper to the chosen players and the GM. Feature off: no header buttons, no HUD button, `api.shop` undefined.
- Loot history with the Red Book active (0.7.x): the Session filter lists its sessions with counts; rolls during a session (also one that ran past midnight, and the open one) are under it; rolls outside sessions show under their date; By session headings in order, column sort inside each; tally and CSV follow the filter. Red Book inactive or its session log off: dates only, no errors.
- Loot roll card as a player who can roll: the comparison with their own character shows (an armour piece, a weapon with weapon sets on and off, an item with an empty slot); it disappears once they chose or the roll closed; another player sees only their own; the GM sees none; Item comparison tooltips off or the character pane off: none. The chat message's saved content has no comparison (check with a reload as another player).

## 1.30.2

Patch. No data, setting or API changes.

**Fixed**
- **Loot roll card said "A GM needs to be connected." with a GM online.** The note was hidden with a `hidden` attribute, which Foundry's HTML cleaning drops from saved chat content, and it was only re-hidden for viewers still due to roll. It is now hidden by a CSS class and the GM-connected check runs on every render for every viewer; the note shows only when no GM is connected and the viewer still has to roll. No other chat card relies on a `hidden` attribute.

**Tests**: `tests/v130-2.test.mjs` (source checks).

**Untested in Foundry**
- Roll card as GM, as a player due to roll and as a player who already rolled, with a GM online (no note); then the GM logs out (note only for the player due to roll).

## 1.30.1

Patch for the light theme. No data, setting or API changes.

**Fixed**
- **Character pane stats unreadable in the light theme.** Foundry sets text colours per theme on definition lists, so every value in the sheet's stat boxes (AC, HP, hit dice, initiative, speed, to hit, damage, range) turned dark grey on the dark sheet when Foundry's interface was set to light. The values now set `color: var(--wc-text)`.
- **Same class of bug on the other in-world panels.** The character sheet, the item tooltip, the quest log's stone list and parchment page, the quest tracker and the boss frames each get a low-specificity rule that sets an explicit colour from their own tokens on the elements Foundry colours per theme (links, `dd`, `dt`, labels, headings, paragraphs, list items, table cells, form controls), so text no longer depends on the theme. Component rules still win. No theme selectors were added.
- Audit of the windows that follow the theme (control panel, flight map and editor, travel pace, party gold, coin log, loot history, inn dialogs, vendor trash, pin dialogs, chat cards): none hard-codes a text colour; a test now keeps it that way.

**Changed**
- wanderers-core 0.5.1 (Module data folder merge): every "Module data" folder is hidden and duplicates are merged when the store is filed. No API change.

**Tests**: `tests/v130-1.test.mjs` scans the CSS (each in-world root's text rules set a colour, the pane's `dd` rule does, no theme selectors, no literal text colours in the theme-following sheets).

**Untested in Foundry** (live check, Foundry's interface set to light and to dark)
- A world with several Module data folders ends with one after a reload.
- Character pane: AC, HP, hit dice, initiative, speed, saves, to hit, damage and range are light on the dark sheet; item-pick list, set notes, tab buttons and the Attack dropdown still look as before.
- Item tooltip (hover a slot and a bag item, with and without a comparison): text, links and comparison table readable.
- Quest log: stone list (rows, zone headers, party tags, legend) and parchment page (title, headings, objectives, rewards, footer buttons and switch, the party select) unchanged in both themes.
- Quest tracker and boss frames: titles, objectives, counters and header buttons unchanged.
- Theme-following windows look right in light and dark (control panel, flight map, party gold, coin log, loot history, inn dialogs, vendor trash, pin dialogs, loot roll card).

## 1.30.0

The facelift, part two: the character pane becomes a classic character sheet, and every other toolkit window, dialog and chat card moves to wanderers-core's shared look (Option A: same layouts, core's tokens and components instead of the old wood, stone and parchment frames). The health chat card gets short when the Wanderer's Satchel is there. Two quest log fixes from the 1.29.0 live test. On wanderers-core 0.5.0: the GM-only records journal runs on core's store (filed once into a hidden "Module data" folder), windows remember where you left them, the shortcuts use core's helper, and health lines can carry a Fix button. No data migration; two new hidden client settings.

**Added**
- **Remembered windows** (core's `RememberedWindow`): the control panel, quest log, character pane, flight route map, flight editor, coin log, loot history, party gold and the health window reopen where this user left them, at the same size, minimized if they were. Stored in the new hidden client setting `windowPlacement` (core's, one per module, each user and browser its own); keys `panel`, `questLog`, `pane`, `flightMap`, `flightEditor`, `coinLog`, `lootHistory`, `partyGold`, `health` (stable). The character pane drops its own size memory (`paneWindow` is read once as a starting place until core has one, then never written) and keeps its 540 × 780 minimum. **Reset window positions** on control panel › Loot › Advanced. The quest tracker keeps its own placement (unchanged), and the quest editor isn't remembered.
- **"Module data" folder** (core's data folder): the acting GM files the existing root-level records journal into the shared *Module data* journal folder **once** after load (`Store.file()`, after the 1.27 moves), marked `flags.wayfarers-toolkit.dataFolderFiled` so a GM who moves it afterwards keeps their choice. A fresh world creates the journal inside that folder. The folder is hidden from the Journal sidebar (`hideDataFolder`) unless **Show module data folder** is on (new hidden client setting `showModuleData`, default off; control panel › Loot › Advanced; any module's switch shows it). Tidiness only, not secrecy.
- **Health lines with a fix** (core 0.5.0's contract): a missing setup item (**Run setup**), creatures with an unlinked boss table (**Link boss tables**), the records journal shared with players (**Make GM only**: ownership None for the default and every player with a level of their own) and a records journal still at the top of the sidebar (**File it now**). Each asks first (confirm text). `api.healthReport()` passes the fix through for the Wanderer's Satchel's Fix button; the control panel's Overview offers it where it had no button of its own. The HTML chat card and window don't show them. New health lines: the records journal not filed yet (info), two records journals at once (warn).

**Changed**
- **Core 0.5.0.** `vendor/wanderers-core` updated from 0.3.1 with the vendor tool (first 0.4.0, then 0.5.0; stylesheet revision 3: item quality tokens, `wc-item-slot`, `wc-coins`; `quality()`, `itemSlot()`, `coins()`, `formatCoins()` unchanged in 0.5.0); CI pinned to `module-checks.yml@v0.5.0`; the release zip leaves out core's dev-only test fakes (`vendor/wanderers-core/testing/*`, test). Windows use `UI_CLASSES`, so they moved from `wc-r2` to `wc-r3` on their own; nothing hard-codes a revision (test).
- **GM-only records on core's store** (`vault.mjs`): now a thin wrapper over core's `createStore("wayfarers-toolkit", { name, flagKey: "vault", entryFlag: "vaultEntry", normalize: normalizeVault, keysAt: "buckets", keys: BUCKETS, deleteDepth: 3, about, log, isWriter: isActiveGM })`. The existing journal is found exactly as before (by `flags.wayfarers-toolkit.vaultEntry`, never by name; nothing renamed). `Vault.get / set / setKey / update / migrated / markMigrated / status` keep their names, so the rest of the module is unchanged. New for the store: v14's deletion operator when present (else `-=` keys), deletions three levels deep for every bucket (before: only capped buckets), an 8 MiB size guard, reads cached until the entry's `modifiedTime` changes. `vault-model.mjs` `deletions()` now uses core's walk.
- **Shortcuts on core's helper** (`registerOpenKeybinding`): *Open quest log* (default L), *Open character pane* and *Open the control panel (GM)* (no default keys) keep their action ids `questLog`, `characterPane`, `controlPanel`, so keys users set carry over. The control panel binding is now Foundry-restricted to GMs (it did nothing for players before).
- **Cleanup**: *GM-only records journal* now removes through core's store (`remove()`: every copy, then the *Module data* folder when nothing else is in it); its flags `vaultEntry`, `vault`, `dataFolderFiled` go with it. *Settings* resets the two new client settings with the others.
- **Character pane: classic sheet** (`pane.mjs`, new pure `pane-model.mjs`). Inside the native Foundry window (chrome follows the theme): title with name and *Level N Class · Species · Party* (the party is the group actor the character is a member of), a **Rested** pill (core badge; tooltip names the inn and the benefit from *Rested gives*). Centre: portrait with **Attuned n / max**, an **HP bar** (`system.attributes.hp`: value / `effectiveMax` or max, a striped temporary-HP segment after it, green / amber / red at half and a quarter) and the actor's **coins** (`system.currency` through core's `coins()`, platinum and electrum folded in, ratio from the coins in use). Slot columns are the toolkit's own slots (left Head, Neck, Shoulder, Back, Chest, Shirt, Tabard, Wrist; right Hands, Waist, Legs, Feet, Finger ×2, Trinket ×2); **empty slots show original outline drawings** (helm, pendant, pauldron, cloak, chest, shirt, tabard, bracers, gloves, belt, legs, boot, ring, gem; weapon hands: sword, shield, bow; relic: sun), drawn for this module as stroke-only SVG paths. Filled slots, hands and the item list are core `wc-item-slot`s with the quality border and glow (an MMO-style tooltip colour wins, else core's `quality()` of `system.rarity`). Bottom row: the three weapon sets and the relic slot, the set in hand outlined in gold, stowed sets dimmed. Below: **Attributes** (six scores and modifiers), **Defence** (AC, HP, hit dice `value / max dN`, initiative `init.total`, walking speed `movement.speeds.walk` / `speed` / `walk`, saves `abilities.*.save.value` with proficient saves marked) and **Attack**, which **follows the set in hand** (Ranged set: the ranged weapon; Utility set: spell for a caster, else melee; Melee set: melee, or spell when a caster holds only a focus). Weapons read dnd5e's prepared labels (`labels.toHit`, `labels.damages[0].label`, `labels.range` / `reach`); spells read `attributes.spell.attack` / `dc` and the spellcasting ability. The box's dropdown (Auto / Melee / Ranged / Spell) overrides it for that window. *Equippable items* and *Slot equipped items* are unchanged. **Every existing pane behaviour is kept** (drag and drop, click menus, right-click to remove, weapon-set swaps and blocks, Stow shield, relic slot, comparison tooltips; the remembered window size now comes from core, see above). The sheet sets its own core tokens and bright quality colours on `.wct-frame`, so it stays dark in both themes with no theme selectors (test). The minimum window grows to 540 × 780 (default 580 × 880) for the stat boxes.
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
  - Core 0.5.0: the stylesheet loads first; windows carry `wc-ui wc-r3`; a module still on core 0.3.x (`wc-r2`) open at the same time keeps its own look. A release zip built by the workflow has no `vendor/wanderers-core/testing/` and loads without errors.
  - GM-only store on core: an existing world (records journal at the root, named either old or new name) keeps its journal, name, ownership and records (hidden pins, quests' GM text, flight network, rentals, coin log, migrations all still read); after the acting GM's load it sits in *Module data* once and has `dataFolderFiled`; moving it back to the root by hand stays after a reload. A fresh world creates it inside *Module data* on the first GM-only save, with the About page. Deleting a hidden pin / a quest / a rental really removes the key after a reload (v13 `-=` and v14 `_del`). Two GM tabs writing at once leave one journal. A player's client: no journal, no errors.
  - Module data folder: hidden from the Journal sidebar for GMs and players; *Show module data folder* (Loot › Advanced) shows it at once (the sidebar redraws); the Red Book or the Satchel's switch shows it too; directory search doesn't find the hidden entries.
  - Remembered windows: each of the nine windows reopens where it was after close and after a reload, minimized state kept; a smaller browser window pulls them back on screen; the character pane never opens below 540 × 780 and a pane last placed by 1.29 opens where it was; one placement for every actor's pane; Reset window positions puts them back (open ones on next open); the quest tracker still keeps its own spot.
  - Shortcuts: Configure Controls lists Open quest log (L), Open character pane and Open the control panel (GM); keys users set in 1.28/1.29 still work; the control panel binding is greyed out for players.
  - Health fixes: in the Wanderer's Satchel the four lines show a Fix button that asks first and works (Run setup, Link boss tables, Make GM only, File it now); in the control panel's Overview the same, where the line had no button before; the chat card shows no Fix buttons.
  - Cleanup: *GM-only records journal* deletes the journal and the *Module data* folder only when no other module's journal is in it; *Settings* resets window placement and Show module data folder on this browser.
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
