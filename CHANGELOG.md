# Changelog

All notable changes to Wayfarer's Toolkit. Versions follow the `version` in `module.json`.

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
