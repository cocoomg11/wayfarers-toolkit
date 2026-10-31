# Changelog

All notable changes to Wayfarer's Toolkit. Versions follow the `version` in `module.json`.

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
