/**
 * Wayfarer's Toolkit
 * Hex travel, flight routes, a session-start helper, vendor trash, a character pane, a quest log, boss frames, loot rolls and boss loot.
 * Each tool is a feature that can be turned off (features.mjs); turned-off tools register nothing.
 * for Foundry VTT (dnd5e). Campaign content (tables, journals, routes) lives in each world; this module is the logic.
 */
import * as Trash from "./trash.mjs";
import * as Pane from "./pane.mjs";
import * as Quests from "./quests.mjs";
import * as F from "./features.mjs";
import * as Bosses from "./bosses.mjs";
import * as Loot from "./loot.mjs";
import * as BossLoot from "./bossloot.mjs";
import * as Flight from "./flight.mjs";
import * as Health from "./health.mjs";
import { isActiveGM, activeGM } from "./gm.mjs";
import * as Updates from "./updates.mjs";
import { MACROS, macroData, macroOn } from "./macros.mjs";
import * as Panel from "./panel.mjs";
import * as FlightEditor from "./flight-editor.mjs";
import * as Cleanup from "./cleanup.mjs";
import * as Merchant from "./merchant.mjs";
import { log } from "./log.mjs";
import * as Pace from "./travel-pace.mjs";
import * as FlightMap from "./flight-map.mjs";
import * as Gold from "./gold.mjs";
import * as SettingsIO from "./settings-io.mjs";
import { DEFAULT_CURVE, curveText } from "./gold-model.mjs";

const ID = "wayfarers-toolkit";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const setting = key => game.settings.get(ID, key);

const DEFAULTS = {
  trackerJournal: "Campaign Trackers (GM)",
  partyActor: "The Party",
  campaignName: "",
  zones: JSON.stringify({ "Forest": "Encounters · Forest", "Hills": "Encounters · Hills" }),
  encounterDie: 12,
  offroadMult: 2,
  mountMult: 1.5,
  paceSlow: 2,
  paceNormal: 3,
  paceFast: 4,
  hiddenScenes: "Hex Test|NPC Gallery",
  flightSound: "modules/wayfarers-toolkit/sounds/be-good.ogg",
  flightVolume: 0.8,
  playerFlights: true,
  coinSystem: "standard",
  fareUnit: "gp",
  trashPacks: "",
  trashItemPiles: true,
  itemPilesCoins: true,
  riderFeat: "Riding Training",
  dungeonCoinMult: 2,
  dungeonDropBonus: 25,
  dungeonExtraRoll: true,
  trashAutoRoll: true,
  trashAutoLoot: true,
  trashGmAddedLoot: true,
  junkSellButton: true,
  itemCompare: true,
  trashUnconscious: false,
  partySize: 4,
  debugLog: false,
  weaponSets: true,
  weaponSwapCost: "attack",
  relicClasses: "paladin, druid, cleric",
  paceRequests: true,
  travelPaceCurrent: "normal",
  flightDiscovered: true,
  flightMapLocked: "hide",
  // Off by default from 1.20 (earlier versions always advanced time); the 1.20.0 update notes offer a button to turn it back on.
  flightAdvanceTime: false,
  goldAct: 1,
  goldCurve: curveText(DEFAULT_CURVE),
  goldIncludeGear: false
};
/** The riding feat's name before v1.8.0. A world whose setting still holds it is treated as using the new default. */
const OLD_RIDER = "Trained Rider";
/** The riding feat's name for this world: the setting, with the old default read as the new one. */
const riderName = () => { const n = String(setting("riderFeat") || "").trim(); return !n || n === OLD_RIDER ? DEFAULTS.riderFeat : n; };
const SOCKET = `module.${ID}`;

// ---------------------------------------------------------------- coins
/**
 * Three-coin economy: copper, silver and gold only, 100 copper to the silver and 100 silver to the gold. Applied at init, before any sheet renders.
 * The object is changed in place, never replaced: dnd5e's currency data fields hold a reference to it and build every actor's and container's
 * `system.currency` from its keys, in its order. So sheets, the currency manager and award dialogs all show copper, silver, gold and nothing else.
 */
function applyCoinSystem() {
  if (setting("coinSystem") !== "threeCoin") return;
  const C = CONFIG.DND5E?.currencies; if (!C?.gp || !C?.sp || !C?.cp) return console.warn(`${ID} | dnd5e currencies not found; three-coin economy not applied`);
  C.gp.conversion = 1; C.sp.conversion = 100; C.cp.conversion = 10000;
  C.gp.abbreviation = "g"; C.sp.abbreviation = "s"; C.cp.abbreviation = "c";
  const keep = ["cp", "sp", "gp"].map(k => [k, C[k]]);
  for (const k of Object.keys(C)) delete C[k];
  for (const [k, c] of keep) C[k] = c;
}
/** Platinum and electrum a document still stores (hidden in three-coin mode), from its source data. */
const oldCoins = doc => { const c = doc?._source?.system?.currency; return c && (c.pp > 0 || c.ep > 0) ? c : null; };
/** Update turning stored pp/ep into gold and silver: 1 pp = 10 g, 1 ep = 50 s (half a gold piece, as in standard 5e). */
const oldCoinUpdate = c => ({ "system.currency.gp": (c.gp || 0) + 10 * (c.pp || 0), "system.currency.sp": (c.sp || 0) + 50 * (c.ep || 0), "system.currency.pp": 0, "system.currency.ep": 0 });
/** Three-coin mode, active GM only (or the GM running setup): converts any platinum and electrum left on actors, containers and unlinked tokens. Returns the names changed. */
async function convertOldCoins({ manual = false } = {}) {
  if (setting("coinSystem") !== "threeCoin" || !(manual ? game.user.isGM : isActiveGM())) return [];
  const names = [];
  const items = coll => coll.filter(oldCoins).map(i => { names.push(i.name); return { _id: i.id, ...oldCoinUpdate(oldCoins(i)) }; });
  try {
    const actorUpdates = game.actors.filter(oldCoins).map(a => { names.push(a.name); return { _id: a.id, ...oldCoinUpdate(oldCoins(a)) }; });
    if (actorUpdates.length) await Actor.updateDocuments(actorUpdates);
    for (const a of game.actors) { const u = items(a.items); if (u.length) await a.updateEmbeddedDocuments("Item", u); }
    const worldItems = items(game.items); if (worldItems.length) await Item.updateDocuments(worldItems);
    for (const scene of game.scenes) for (const t of scene.tokens) {
      if (t.actorLink || !t.actor) continue;
      const c = oldCoins(t.actor); if (c) { names.push(t.name); await t.actor.update(oldCoinUpdate(c)); }
      const u = items(t.actor.items); if (u.length) await t.actor.updateEmbeddedDocuments("Item", u);
    }
  } catch (e) { console.warn(`${ID} | couldn't convert platinum and electrum`, e); }
  if (names.length) await WCT.gmWhisper(`<p><strong>Three-coin economy:</strong> converted platinum (1 pp = 10g) and electrum (1 ep = 50s) on: ${[...new Set(names)].map(esc).join(", ")}.</p>`);
  return names;
}
/** Coins in use, most valuable first: [key, value in the smallest coin]. */
function coins() {
  const C = CONFIG.DND5E.currencies; const list = Object.entries(C).filter(([, c]) => c.conversion > 0);
  const base = Math.max(...list.map(([, c]) => c.conversion));
  return list.map(([k, c]) => [k, Math.round(base / c.conversion)]).sort((a, b) => b[1] - a[1]);
}
const COIN_ALIAS = { g: "gp", gold: "gp", s: "sp", silver: "sp", c: "cp", copper: "cp", p: "pp", platinum: "pp", e: "ep", electrum: "ep" };
const coinKey = s => { s = String(s).toLowerCase().replace(/\.$/, ""); if (CONFIG.DND5E.currencies[s]) return s; for (const [k, c] of Object.entries(CONFIG.DND5E.currencies)) if (String(c.abbreviation).toLowerCase() === s) return k; return COIN_ALIAS[s] ?? COIN_ALIAS[s.replace(/s$/, "")] ?? null; };
/** "1g 20s", "2 gp", "50c" or a plain number (read in the Fare unit setting) → amount in the smallest coin. */
function parseMoney(text, unit = setting("fareUnit")) { return Flight.parseCoins(text, Object.fromEntries(coins()), unit, coinKey); }
/** Amount in the smallest coin → "1g 20s 5c" (three-coin) or "1 gp 2 sp" (standard). Electrum is never used for change. */
function fmtMoney(amount) {
  const C = CONFIG.DND5E.currencies;
  return Flight.formatCoins(amount, coins(), Object.fromEntries(Object.entries(C).map(([k, c]) => [k, c.abbreviation])), setting("coinSystem") === "threeCoin");
}

/** Item Piles' currency list for the three-coin economy, copper first: gold is primary, silver and copper are worth 1/100 and 1/10000 of it. */
const IP_COINS = [
  ["cp", "DND5E.CurrencyCP", "{#}c", 0.0001, false, "icons/commodities/currency/coin-engraved-waves-copper.webp"],
  ["sp", "DND5E.CurrencySP", "{#}s", 0.01, false, "icons/commodities/currency/coin-engraved-moon-silver.webp"],
  ["gp", "DND5E.CurrencyGP", "{#}g", 1, true, "icons/commodities/currency/coin-embossed-crown-gold.webp"]
].map(([k, name, abbreviation, exchangeRate, primary, img]) => ({ type: "attribute", name, img, abbreviation, data: { path: `system.currency.${k}` }, primary, exchangeRate }));
/** Whether Item Piles' currencies are the three-coin set (null when Item Piles isn't active and set up). */
function ipCoinsMatch() {
  const IP = game.modules.get("item-piles")?.active ? game.itempiles?.API : null;
  if (!IP?.setCurrencies || !IP.ITEM_QUANTITY_ATTRIBUTE) return null;
  const cur = IP.CURRENCIES ?? [];
  return cur.length === IP_COINS.length && IP_COINS.every((w, i) => { const c = cur[i]; return c?.data?.path === w.data.path && Math.abs((c.exchangeRate ?? 0) - w.exchangeRate) < 1e-9 && !!c.primary === w.primary; });
}
/** Keeps Item Piles' currencies in step with the three-coin economy (active GM, only once Item Piles is set up for the system). */
async function syncItemPilesCoins() {
  if (!isActiveGM() || setting("coinSystem") !== "threeCoin" || !setting("itemPilesCoins")) return;
  const same = ipCoinsMatch(); if (same !== false) return;
  const IP = game.itempiles.API;
  try { await IP.setCurrencies(foundry.utils.deepClone(IP_COINS)); WCT.gmWhisper("<p><strong>Three-coin economy:</strong> Item Piles' currencies set to copper, silver and gold at 100 to 1.</p>"); }
  catch (e) { console.warn(`${ID} | couldn't set Item Piles currencies`, e); }
}

function registerSettings() {
  F.registerSettings();
  // The main settings list shows one button, "Wayfarer's Toolkit", opening the control panel (panel.mjs), plus each user's own
  // "Quest tracker: Show on screen". Every other setting is registered with config: false (same keys as before, so nothing stored is
  // lost) and shown in the panel. Settings of a turned-off feature stay registered and show greyed out there.
  const s = (key, name, hint, type, extra = {}) => game.settings.register(ID, key, { name, hint, scope: "world", config: false, type, default: DEFAULTS[key], ...extra });
  s("partySize", "Party size", "How many characters the party has (1 to 8). Boss loot coin scales with it (× party size / 4) and, above 4, bosses with 3 or more draws get one more (see Boss loot settings).", Number, { range: { min: 1, max: 8, step: 1 } });
  s("coinSystem", "Coin system", "Three coins replaces dnd5e's five with copper, silver and gold at 100 to 1, as in classic MMOs. Reloads Foundry. Item prices are not changed. See the README before switching.", String, { choices: { standard: "Standard 5e (cp, sp, ep, gp, pp)", threeCoin: "Three coins: copper, silver, gold (100 to 1)" }, requiresReload: true });
  // Kept registered (no longer shown) so worlds that set it keep their value; Session Start no longer posts a recap (1.21).
  s("campaignName", "Campaign name", "No longer used since 1.21 (Session Start no longer posts a recap). Kept so stored values aren't lost.", String);
  // General
  s("trackerJournal", "General: Tracker journal", "Journal holding the Travel Log page.", String);
  s("partyActor", "General: Party actor", "Group actor whose purse pays flight fares and whose members count as passengers.", String);
  s("itemPilesCoins", "General: Set Item Piles coins for three coins", "With the three-coin economy on, sets Item Piles' currencies to gold, silver and copper at 100 to 1 (no platinum or electrum) each time the world loads. Turn off to manage Item Piles' currencies yourself.", Boolean);
  s("debugLog", "General: Debug logging", "Writes the toolkit's automatic decisions to the browser console (F12): why a body got no loot, which GM ran an automatic step, the items and CR bands chosen, how loot rolls were settled. Off: nothing is logged.", Boolean);
  // Travel
  s("zones", "Hex Travel: Encounter zones", "JSON object mapping zone name to encounter roll table name, e.g. {\"Forest\": \"Encounters · Forest\"}.", String, { onChange: v => checkZones(v, { notify: true }) });
  s("encounterDie", "Hex Travel: Encounter die", "Each off-road hex rolls this die; a 1 is an encounter.", Number);
  s("offroadMult", "Hex Travel: Off-road time multiplier", "Off-road hexes take this many times as long as road hexes.", Number);
  s("mountMult", "Hex Travel: Mounted speed multiplier", "Overland speed multiplier when the party travels mounted.", Number);
  s("paceSlow", "Hex Travel: Slow pace (mph)", "", Number);
  s("paceNormal", "Hex Travel: Normal pace (mph)", "", Number);
  s("paceFast", "Hex Travel: Fast pace (mph)", "", Number);
  s("hiddenScenes", "Session Start: Scenes hidden from the list", "Regular expression; matching scene names are left out of the list.", String);
  s("playerFlights", "Flight Master: Players can book flights", "Players get a Flight Master button in the token controls and can book flights themselves. A GM must be logged in; the fare comes out of the party purse.", Boolean, { onChange: () => ui.controls?.render?.({ reset: true }) });
  s("flightSound", "Flight Master: Departure sound", "Audio file played for everyone when a flight departs. Defaults to the bundled departure clip; clear it for no sound.", String, { filePicker: "audio" });
  s("flightVolume", "Flight Master: Sound volume", "", Number, { range: { min: 0, max: 1, step: 0.05 } });
  s("fareUnit", "Flight Master: Fare unit", "Coin used for fares typed as plain numbers in the flight network editor. Fares can also be typed with coins, like 1g 20s or 50c.", String, { choices: { gp: "Gold", sp: "Silver", cp: "Copper" } });
  s("riderFeat", "Riding Training: Feat name", "Hex Travel ticks Mounted automatically when every party member has this feat (Long Road). Setup creates a feat with this name (Riding Training by default).", String);
  // Vendor Trash
  s("trashItemPiles", "Vendor Trash: Use Item Piles", "When Item Piles is active and set up for your system, Vendor Trash puts the loot on each defeated creature and turns its token into a lootable pile. Off, or without Item Piles, the GM gets a loot card with a Give to Party button.", Boolean);
  s("dungeonCoinMult", "Vendor Trash: Dungeon coin multiplier", "Coin dropped by creatures in scenes marked as dungeons (Scene configuration › Basics) is multiplied by this.", Number, { range: { min: 1, max: 5, step: 0.25 } });
  s("dungeonDropBonus", "Vendor Trash: Dungeon drop bonus (%)", "Percentage points added to each item-drop chance for creatures in dungeon scenes (a 70% drop becomes 95% at +25). Chances never go above 100%.", Number, { range: { min: 0, max: 100, step: 5 } });
  s("dungeonExtraRoll", "Vendor Trash: Dungeon extra item roll", "Creatures in dungeon scenes roll their item drops a second time (coin is not rolled again). The trash pool is grey items only, so this stands in for better-quality loot.", Boolean);
  s("trashAutoRoll", "Vendor Trash: Roll loot when NPC tokens are placed", "Each unlinked NPC token gets its vendor-trash drop and coin rolled when it's placed (pasted copies roll their own). The loot waits hidden on the token until the body is looted. Reroll it from the dice button in the token HUD.", Boolean);
  s("trashAutoLoot", "Vendor Trash: Make bodies lootable on death", "When an unlinked NPC token drops to 0 HP or is marked defeated, its body becomes lootable with its drop (an Item Piles pile, or a Give to Party card without Item Piles). Off: run the Vendor Trash macro yourself.", Boolean);
  s("trashGmAddedLoot", "Vendor Trash: Items the GM adds to an NPC count as loot", "When a GM adds a weapon, armour, consumable, tool, loot or container to an NPC (dragged onto its sheet or created there), the item is marked Lootable and shows in the body's loot pile. Items that came with the stat block are never marked. Change the mark on the item sheet or the inventory context menu.", Boolean);
  s("trashUnconscious", "Vendor Trash: Unconscious bodies become lootable", "An unlinked NPC token that gets the Unconscious condition becomes lootable as if it had died (No loot and one-loot-per-body still apply).", Boolean);
  s("junkSellButton", "Vendor Trash: Sell all junk button", "A Sell all junk button on Item Piles merchant windows: sells every grey item the character carries at the merchant's prices, after a confirm. Equipped items, favourites and items in a weapon set are never sold.", Boolean);
  s("trashPacks", "Vendor Trash: Compendiums", "Item compendium IDs to draw vendor trash from, separated by commas. Leave blank to use the wow-classic-items module's compendium (wow-classic-items.items) when it's installed. Grey items are trash; in other compendiums, loot items with no rarity are.", String, { onChange: () => Trash.resetPool() });
  // Character pane: weapon sets
  s("weaponSets", "Character pane: Weapon sets", "Melee, Ranged and Utility weapon sets in the character pane; only the set in hand is equipped on the sheet. Off: one Main Hand, Off Hand and Ranged slot, all equipped at once.", Boolean, { onChange: () => Pane.refreshOpen?.() });
  s("weaponSwapCost", "Character pane: Weapon swap cost", "What a weapon-set swap costs in combat. Shown in a chat line when a character in an active combat swaps; nothing is enforced. Outside combat swapping is free and silent.", String, { choices: { free: "Free", attack: "Part of an attack", object: "Object interaction", bonus: "Bonus action", action: "Action" } });
  s("itemCompare", "Character pane: Item comparison tooltips", "Hovering an item in the character pane (or in a loot pile or merchant, for your character) compares it with what's in its slot or weapon-set hand.", Boolean);
  s("relicClasses", "Character pane: Classes with a relic slot", "dnd5e class identifiers, separated by commas, whose characters get a relic slot in the character pane (for a spellcasting focus or a relic).", String, { onChange: () => Pane.refreshOpen?.() });
  // Travel pace (feature travelPace, with Hex Travel). The party's pace is a world setting everyone reads; only GMs write it.
  s("paceRequests", "Travel pace: players can ask for a pace", "Players get a Travel Pace window to ask for fast, normal or slow pace; the GM gets a whisper with a button to accept.", Boolean);
  s("travelPaceCurrent", "Travel pace: the party's pace", "", String, { choices: { fast: "Fast", normal: "Normal", slow: "Slow (careful)" } });
  // Flight Master refinements.
  s("flightDiscovered", "Flight Master: announce new flight points", "When the GM unlocks a flight point, chat says \"Discovered! New flight point: …\".", Boolean);
  s("flightMapLocked", "Flight route map: locked points for players", "Hidden: players' map shows only unlocked points. Greyed: locked points show as Unknown.", String, { choices: { hide: "Hidden", grey: "Greyed out, unnamed" }, onChange: () => FlightMap.refresh() });
  s("flightAdvanceTime", "Flight Master: flights advance world time", "On arrival, world time advances by the flight's hours (game.time.advance, which calendar modules follow).", Boolean);
  // Party gold tracker.
  s("goldAct", "Party gold: current act / tier", "", Number, { range: { min: 1, max: 20, step: 1 }, onChange: () => Gold.refresh() });
  s("goldCurve", "Party gold: wealth curve", "Gold per character for each act or tier, separated by commas (Act/Tier 1 first).", String, { onChange: () => Gold.refresh() });
  s("goldIncludeGear", "Party gold: count mundane gear", "Adds the price of the party's non-magical, no-rarity gear to their coin.", Boolean, { onChange: () => Gold.refresh() });
  Gold.registerSettings();
  // Before 1.16 the GM kept a players' copy of the Flight Routes page here. Unused now; registered so Remove toolkit data resets it.
  game.settings.register(ID, "flightCache", { scope: "world", config: false, type: Object, default: { pts: [], routes: [] } });
  // The flight network (points, routes, fares). World scope: every client reads it, only GMs write it (the editor or api.flight).
  game.settings.register(ID, "flightNetwork", { scope: "world", config: false, type: Object, default: Flight.emptyNetwork(), onChange: () => { FlightEditor.refresh(); FlightMap.refresh(); } });
  // The pre-1.17 setup reminder's version stamp: no longer written, only read to tell a world that ran an earlier version from a new one.
  game.settings.register(ID, "setupReminded", { scope: "world", config: false, type: String, default: "" });
  Updates.registerSettings();
  game.settings.register(ID, "wizardDone", { scope: "world", config: false, type: Boolean, default: false });
  // Every feature's settings, whether the feature is on or not (the panel shows a turned-off feature's settings greyed out).
  Loot.registerSettings(); Bosses.registerSettings(); BossLoot.registerSettings();
  Quests.registerSettings({ tracker: F.on("questLog") && F.on("questTracker") });
  game.settings.registerMenu(ID, "panel", { name: "Wayfarer's Toolkit", label: "Open the control panel", hint: "Everything in one window: what needs attention, which tools are on, and each tool's settings. Run setup, the health check and Remove toolkit data are in its Overview tab.", icon: "fas fa-toolbox", type: Panel.ControlPanel, restricted: true });
}

/**
 * Checks the Encounter zones setting: returns { zones, error, unknown: [{ zone, table }] }. With `notify`, a GM gets a notification
 * naming the setting and the JSON problem's position, and the zones whose tables don't exist.
 */
function checkZones(text = setting("zones"), { notify = false } = {}) {
  const r = Flight.parseZones(text);
  const unknown = r.error ? [] : Flight.unknownZoneTables(r.zones, game.tables?.map?.(t => t.name) ?? []);
  if (notify && game.user?.isGM) {
    if (r.error) ui.notifications.error(`Wayfarer's Toolkit › Hex Travel: Encounter zones: ${r.error}.`);
    else if (unknown.length) ui.notifications.warn(`Wayfarer's Toolkit › Hex Travel: Encounter zones: no roll table named ${unknown.map(u => `"${u.table}" (zone ${u.zone})`).join(", ")}.`);
  }
  return { ...r, unknown };
}

const RIDER_FEAT = name => ({
  name, type: "feat", img: "icons/environment/creatures/horse-brown.webp",
  flags: { [ID]: { feat: "trained-rider" } },
  system: {
    type: { value: "feat", subtype: "general" },
    requirements: "",
    source: { book: "Wayfarer's Toolkit", custom: "Wayfarer's Toolkit" },
    description: { value: `<p><em>General Feat</em></p><p><em>Granted on completing riding training with a stablemaster or riding instructor.</em></p><p>You've learned to ride properly, not just to stay on.</p><p><strong>Swift Mount.</strong> Mounting or dismounting a creature costs you only 5 feet of movement, rather than half your Speed.</p><p><strong>Long Road.</strong> When every member of your party has this feat and all of you are mounted, the party travels overland at mounted speed.</p>` }
  }
});

const TRACKER_PAGES = {
  "Travel Log": `<h2>Travel Rules</h2><ul><li><strong>1 hex = 1 mile.</strong> Roads are safe: no encounter rolls on road hexes.</li><li>Off-road hexes take longer and each rolls for an encounter on the zone's table.</li><li>Tick <em>Mounted</em> in Hex Travel when the party rides.</li></ul><p>The Hex Travel and Flight Master tools write each trip below.</p><h2>Log</h2>`
};

export const WCT = {
  ID,
  get version() { return game.modules.get(ID)?.version; },
  get JOURNAL() { return setting("trackerJournal"); },
  get PARTY() { return setting("partyActor"); },
  get ZONES() { const r = Flight.parseZones(setting("zones")); if (r.error) ui.notifications.error(`Wayfarer's Toolkit › Hex Travel: Encounter zones: ${r.error}.`); return r.zones; },
  get PACE() { return { slow: setting("paceSlow"), normal: setting("paceNormal"), fast: setting("paceFast") }; },
  get OFFROAD_MULT() { return setting("offroadMult"); },
  get MOUNT_MULT() { return setting("mountMult"); },
  get ENC_DIE() { return setting("encounterDie"); },

  // ------------------------------------------------------------ helpers
  tracker() { const j = game.journal.getName(this.JOURNAL); if (!j) throw new Error(`Wayfarer's Toolkit: journal "${this.JOURNAL}" not found. Run setup from the control panel (Game Settings › Wayfarer's Toolkit).`); return j; },
  state() { return foundry.utils.duplicate(this.tracker().getFlag("world", "trackers") ?? {}); },
  async setState(patch) { const s = { ...this.state(), ...patch }; await this.tracker().setFlag("world", "trackers", s); return s; },
  stamp(t = game.time.worldTime) { const d = Math.floor(t / 86400) + 1, h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60); return `Day ${d}, ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; },
  page(name) { const p = this.tracker().pages.getName(name); if (!p) throw new Error(`Wayfarer's Toolkit: page "${name}" missing from "${this.JOURNAL}".`); return p; },
  async appendPage(name, html) { const p = this.page(name); await p.update({ "text.content": (p.text.content || "") + html }); },
  parseTable(html, i) { const t = new DOMParser().parseFromString(html, "text/html").querySelectorAll("table")[i]; return t ? [...t.querySelectorAll("tbody tr")].map(tr => [...tr.children].map(td => td.textContent.trim())) : []; },
  gmWhisper(content) { return ChatMessage.create({ content, whisper: game.users.filter(u => u.isGM).map(u => u.id), speaker: { alias: "Wayfarer's Toolkit" } }); },
  say(content, alias = "Narrator") { return ChatMessage.create({ content, speaker: { alias } }); },
  /** An information or refusal window with a single OK button. */
  info(title, content, label = "OK") { return foundry.applications.api.DialogV2.prompt({ classes: ["wct-window"], window: { title }, content, ok: { label, icon: "fa-solid fa-check" }, rejectClose: false }); },
  form(title, content, label = "OK") { return foundry.applications.api.DialogV2.prompt({ classes: ["wct-window"], window: { title }, content, position: { width: 460 }, ok: { label, callback: (ev, btn) => new foundry.applications.ux.FormDataExtended(btn.form).object }, rejectClose: false }); },
  confirm(title, content) { return foundry.applications.api.DialogV2.confirm({ classes: ["wct-window"], window: { title }, content, rejectClose: false }); },
  gmOnly() { if (!game.user.isGM) { ui.notifications.warn("GM only."); return false; } return true; },
  opt(v, label, sel) { return `<option value="${esc(v)}" ${sel ? "selected" : ""}>${esc(label ?? v)}</option>`; },
  campaign() { return setting("campaignName") || game.world.title; },
  trackerPages() { return { ...TRACKER_PAGES, ...(F.on("vendorTrash") ? { [Trash.RULES_PAGE]: Trash.RULES_PAGE_HTML } : {}) }; },

  // ------------------------------------------------------------ setup
  /** What Run setup would create for the features turned on, without creating it: [{ key, label, ok, detail }]. */
  setupPlan() {
    const out = [];
    const needJournal = ["hexTravel", "flightMaster", "sessionStart", "vendorTrash"].some(F.on);
    const needParty = ["flightMaster", "vendorTrash", "riderFeat", "questLog"].some(F.on);
    if (needJournal) {
      const j = game.journal.getName(this.JOURNAL); const tp = this.trackerPages();
      out.push({ key: "journal", label: `tracker journal "${this.JOURNAL}"`, ok: !!j });
      if (j) for (const name of Object.keys(tp)) out.push({ key: `page:${name}`, label: name === Trash.RULES_PAGE ? `${name} page` : `tracker page "${name}"`, ok: !!j?.pages.getName(name) });
    }
    if (needParty) out.push({ key: "party", label: `party actor "${this.PARTY}"`, ok: !!game.actors.find(a => a.type === "group" && a.name === this.PARTY) });
    for (const m of MACROS.filter(m => macroOn(m, F.on))) out.push({ key: `macro:${m.fn}`, label: `macro "${m.name}"`, ok: !!game.macros.getName(m.name) });
    if (F.on("riderFeat")) out.push({ key: "feat", label: `${riderName()} feat`, ok: !!game.items.find(i => i.getFlag(ID, "feat") === "trained-rider") });
    return out;
  },
  /** GM: checks the world and whispers the report (also the Health check button in the settings and the Toolkit Health Check macro). */
  health(opts = {}) { if (!this.gmOnly()) return; return Health.post(this, opts); },
  /** For the health check: coin settings, Item Piles' currencies and the active GM helpers. */
  internals: { ipCoinsMatch, riderName, activeGM, isActiveGM, checkZones },
  /** Party size (1–8) from the world setting. */
  get partySize() { return BossLoot.clampParty(setting("partySize")); },

  async setup() {
    if (!this.gmOnly()) return [];
    const made = [];
    const needJournal = ["hexTravel", "flightMaster", "sessionStart", "vendorTrash"].some(F.on);
    const needParty = ["flightMaster", "vendorTrash", "riderFeat", "questLog"].some(F.on);
    if (!needJournal) { /* no tool that writes the tracker journal is on */ }
    else if (!game.journal.getName(this.JOURNAL)) {
      await JournalEntry.create({ name: this.JOURNAL, ownership: { default: 0 }, flags: { world: { trackers: { mountsUnlocked: false, trips: 0 } } }, pages: Object.entries(this.trackerPages()).map(([name, content]) => ({ name, type: "text", text: { content, format: 1 } })) });
      made.push("tracker journal");
    } else {
      const j = game.journal.getName(this.JOURNAL); const tp = this.trackerPages(); const missing = Object.keys(tp).filter(n => !j.pages.getName(n));
      if (missing.length) { await j.createEmbeddedDocuments("JournalEntryPage", missing.map(name => ({ name, type: "text", text: { content: tp[name], format: 1 } }))); made.push(`tracker pages (${missing.join(", ")})`); }
    }
    if (needParty && !game.actors.find(a => a.type === "group" && a.name === this.PARTY)) {
      await Actor.create({ name: this.PARTY, type: "group", img: "icons/environment/people/group.webp", ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER } });
      made.push("party actor");
    }
    // All missing macros in one create. Nobody's hotbar is touched: the GM and players drag them from the folder or the compendium.
    // The same definitions (macros.mjs) build the Wayfarer's Toolkit Macros compendium.
    const want = MACROS.filter(m => macroOn(m, F.on) && !game.macros.getName(m.name));
    if (want.length) {
      const folder = game.folders.find(f => f.type === "Macro" && f.name === "Wayfarer's Toolkit") ?? await Folder.create({ name: "Wayfarer's Toolkit", type: "Macro", sorting: "m" });
      const created = await Macro.implementation.createDocuments(want.map(m => ({ ...macroData(m), folder: folder.id, ...(m.shared ? { ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER } } : {}) })));
      for (const m of created) made.push(`macro "${m.name}"`);
    }
    if (F.on("riderFeat")) made.push(...await this.renameOldRiderFeat());
    if (F.on("riderFeat") && !game.items.find(i => i.getFlag(ID, "feat") === "trained-rider")) {
      let ifolder = game.folders.find(f => f.type === "Item" && f.name === "Wayfarer's Toolkit");
      ifolder ??= await Folder.create({ name: "Wayfarer's Toolkit", type: "Item" });
      await Item.create({ ...RIDER_FEAT(riderName()), folder: ifolder.id, ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER } });
      made.push(`feat "${riderName()}"`);
    }
    if (F.on("flightMaster") && setting("playerFlights")) made.push(...await this.shareFlightMacro());
    const converted = await convertOldCoins({ manual: true }); if (converted.length) made.push(`gold and silver from old platinum/electrum (${converted.length})`);
    return made;
  },
  /**
   * v1.8.0 rename: when the world uses the default name, the module's own "Trained Rider" feats (world items and copies on actors)
   * become "Riding Training" with the new description. Only items the module made are touched: those carrying its feat flag, or
   * with the exact old name and the module's description text. A stored setting of "Trained Rider" is moved to the new name.
   */
  async renameOldRiderFeat() {
    if (!this.gmOnly() || riderName() !== DEFAULTS.riderFeat) return [];
    const done = [];
    if (String(setting("riderFeat") || "").trim() === OLD_RIDER) { await game.settings.set(ID, "riderFeat", DEFAULTS.riderFeat); done.push(`Riding feat name setting (${OLD_RIDER} → ${DEFAULTS.riderFeat})`); }
    const ours = i => i.type === "feat" && i.name === OLD_RIDER && (i.getFlag(ID, "feat") === "trained-rider" || String(i.system?.description?.value ?? "").includes("You've learned to ride properly, not just to stay on."));
    const fresh = RIDER_FEAT(DEFAULTS.riderFeat);
    const patch = i => ({ _id: i.id, name: fresh.name, "system.description.value": fresh.system.description.value, [`flags.${ID}.feat`]: "trained-rider" });
    try {
      const wi = game.items.filter(ours); if (wi.length) await Item.updateDocuments(wi.map(patch));
      let n = wi.length;
      for (const a of game.actors) { const owned = a.items.filter(ours); if (owned.length) { await a.updateEmbeddedDocuments("Item", owned.map(patch)); n += owned.length; } }
      for (const scene of game.scenes) for (const t of scene.tokens) {
        if (t.actorLink || !t.actor) continue;
        const owned = t.actor.items.filter(ours); if (owned.length) { await t.actor.updateEmbeddedDocuments("Item", owned.map(patch)); n += owned.length; }
      }
      if (n) done.push(`${n} "${OLD_RIDER}" feat${n === 1 ? "" : "s"} renamed to "${DEFAULTS.riderFeat}"`);
    } catch (e) { console.warn(`${ID} | couldn't rename the old riding feat`, e); }
    return done;
  },
  /** Lets players see the Flight Master macro (Observer). Players' hotbars are left alone: they drag it from the macro directory or the compendium. */
  async shareFlightMacro() {
    if (!this.gmOnly()) return [];
    const m = game.macros.getName("Flight Master"); if (!m) return [];
    const done = []; const OBS = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
    if ((m.ownership.default ?? 0) < OBS) { await m.update({ "ownership.default": OBS }); done.push("Flight Master shared with players"); }
    return done;
  },

  // ------------------------------------------------------------ travel
  async hexTravel() {
    if (!F.need("hexTravel") || !this.gmOnly()) return;
    const s = this.state(); const Z = this.ZONES; const zones = Object.keys(Z);
    const riders = this.riders(); const mountedDefault = riders.members ? riders.untrained.length === 0 : !!s.mountsUnlocked;
    const sc = canvas.scene?.name ?? ""; const guess = zones.find(z => sc.includes(z.split(" ")[0])) ?? zones[0];
    const content = `<div class="form-group"><label>Zone</label><select name="zone">${[...zones, "Other (no encounter table)"].map(z => this.opt(z, z, z === guess)).join("")}</select></div>
      <div class="form-group"><label>Road hexes</label><input type="number" name="road" value="0" min="0"></div>
      <div class="form-group"><label>Off-road hexes</label><input type="number" name="off" value="0" min="0"></div>
      <div class="form-group"><label>Pace</label><select name="pace">${this.paceOptions()}</select></div>
      ${F.on("travelPace") ? `<p class="hint">The party's pace is ${esc(Pace.PACES[this.travelPaceNow()].label.toLowerCase())}; changing it here sets it for the party.</p>` : ""}
      <p class="hint">1 hex = 1 mile. Roads are safe; each off-road hex takes ×${this.OFFROAD_MULT} time and rolls 1d${this.ENC_DIE} (1 = encounter). </p>
      <div class="form-group"><label>Mounted (speed ×${this.MOUNT_MULT})</label><input type="checkbox" name="mounted" ${mountedDefault ? "checked" : ""}></div>
      ${riders.members ? `<p class="hint">${riders.untrained.length ? `Long Road: not trained to ride yet: ${riders.untrained.map(esc).join(", ")}.` : `Long Road: every party member has ${esc(riderName())}.`}</p>` : ""}`;
    const f = await this.form("Hex Travel", content, "Travel"); if (!f) return;
    const road = Math.max(0, Math.floor(+f.road || 0)), off = Math.max(0, Math.floor(+f.off || 0));
    if (!road && !off) return ui.notifications.warn("No hexes entered.");
    const pace = Pace.normPace(f.pace);
    const hours = Pace.tripHours({ road, off, mph: this.PACE[pace], offroadMult: this.OFFROAD_MULT, mountMult: this.MOUNT_MULT, mounted: !!f.mounted });
    if (!Number.isFinite(hours)) return ui.notifications.warn(`Hex Travel: the ${pace} pace setting is 0 miles per hour.`);
    if (F.on("travelPace") && pace !== this.travelPaceNow()) await game.settings.set(ID, "travelPaceCurrent", pace);
    const table = game.tables.getName(Z[f.zone] ?? "");
    const enc = [];
    for (let i = 1; i <= off; i++) {
      const r = await new Roll(`1d${this.ENC_DIE}`).evaluate();
      if (r.total === 1) { if (table) { const d = await table.roll(); const res = d.results[0]; enc.push(`Off-road hex ${i} (rolled ${d.roll.total}): ${res.description || res.name}`); } else enc.push(`Off-road hex ${i}: encounter (no table for this zone)`); }
    }
    const before = this.stamp(); await game.time.advance(Math.round(hours * 3600)); const after = this.stamp();
    const trips = (s.trips || 0) + 1; await this.setState({ trips });
    const summary = `<strong>${esc(f.zone)}</strong>: ${road} road + ${off} off-road hexes, ${pace} pace${f.mounted ? ", mounted" : ""}. ${hours.toFixed(1)} h (${before} → ${after}).${F.on("travelPace") ? ` ${esc(Pace.effectText(pace))}` : ""}`;
    const encHtml = enc.length ? `<ul>${enc.map(e => `<li>${e}</li>`).join("")}</ul>` : `<p>No encounters${off ? "" : ". Roads are safe"}.</p>`;
    await this.appendPage("Travel Log", `<p><strong>Trip ${trips}.</strong> ${summary}</p>${encHtml}`);
    await this.gmWhisper(`<h3>Hex Travel</h3><p>${summary}</p>${encHtml}`);
    await this.say(`<p><em>The party travels ${road + off} miles through ${esc(f.zone)} (${hours.toFixed(1)} hours).</em></p>${F.on("travelPace") ? `<p>${esc(Pace.PACES[pace].label)} pace: ${esc(Pace.effectText(pace))}</p>` : ""}`, "Travel");
    return { hours, enc };
  },
  /** Hex Travel's pace options; with Travel pace on, the party's pace is picked and the SRD 5.2 effects are named. */
  paceOptions() {
    if (!F.on("travelPace")) return `${this.opt("slow", `Slow · ${this.PACE.slow} mph · can travel stealthily`)}${this.opt("normal", `Normal · ${this.PACE.normal} mph`, true)}${this.opt("fast", `Fast · ${this.PACE.fast} mph · −5 passive Perception`)}`;
    const now = this.travelPaceNow();
    return Pace.PACE_IDS.map(p => this.opt(p, Pace.optionLabel(p, this.PACE[p]), p === now)).join("");
  },
  // ------------------------------------------------------------ travel pace (feature travelPace, with Hex Travel)
  /** The party's pace: fast | normal | slow. */
  travelPaceNow() { try { return Pace.normPace(setting("travelPaceCurrent")); } catch { return "normal"; } },
  /** GM: sets the party's pace and says so in chat. */
  async setTravelPace(pace, { announce = true, by = null } = {}) {
    if (!this.gmOnly()) return null;
    pace = Pace.normPace(pace);
    await game.settings.set(ID, "travelPaceCurrent", pace);
    if (announce) await this.say(`<p><strong>The party travels at ${esc(Pace.PACES[pace].label.toLowerCase())} pace</strong>${by ? ` (asked by ${esc(by)})` : ""}. ${esc(Pace.effectText(pace))}</p>`, "Travel");
    return pace;
  },
  /** Opens Travel pace: the GM sets the party's pace, a player asks the GM for one. */
  async travelPace() {
    if (!F.need("travelPace") || !F.need("hexTravel")) return;
    const gm = game.user.isGM; const now = this.travelPaceNow();
    if (!gm && !setting("paceRequests")) return ui.notifications.info(`The party travels at ${Pace.PACES[now].label.toLowerCase()} pace. ${Pace.effectText(now)}`);
    const rows = Pace.PACE_IDS.map(p => `<label class="wct-check" style="display:block;margin:4px 0;"><input type="radio" name="pace" value="${p}" ${p === now ? "checked" : ""}> <strong>${esc(Pace.PACES[p].label)}</strong> · ${this.PACE[p]} miles an hour, about ${Math.round(Pace.PACES[p].perDay * this.PACE[p] / Pace.PACES[p].perHour)} a day · ${esc(Pace.effectText(p))}</label>`).join("");
    const content = `<p>The party travels at <strong>${esc(Pace.PACES[now].label.toLowerCase())}</strong> pace.</p>${rows}<p class="hint">${gm ? "Hex Travel uses the party's pace, and players see it here." : "The GM decides; your request goes to them."}${gm ? ` Speeds come from the pace settings (control panel › Travel › Advanced): ${this.PACE.fast}, ${this.PACE.normal} and ${this.PACE.slow} miles an hour.` : ""}</p>`;
    const f = await this.form("Travel pace", content, gm ? "Set pace" : "Ask the GM"); if (!f?.pace) return;
    if (gm) return this.setTravelPace(f.pace);
    if (!activeGM()) return ui.notifications.warn("A GM needs to be connected.");
    game.socket.emit(SOCKET, { action: "paceRequest", pace: Pace.normPace(f.pace), userId: game.user.id });
    ui.notifications.info("Travel pace: request sent to the GM.");
  },
  /** Active GM: a player's pace request becomes a whisper with an Accept button. */
  async paceRequest(msg, senderId) {
    const r = Pace.readRequest(msg); if (!r || !isActiveGM() || !setting("paceRequests")) return;
    const uid = typeof senderId === "string" && game.users.has(senderId) ? senderId : r.userId; const u = game.users.get(uid);
    if (!u || u.isGM) return;
    return ChatMessage.create({ whisper: game.users.filter(x => x.isGM).map(x => x.id), speaker: { alias: "Travel" }, flags: { [ID]: { paceRequest: { pace: r.pace, user: u.name } } },
      content: `<p><strong>${esc(u.name)}</strong> asks to travel at <strong>${esc(Pace.PACES[r.pace].label.toLowerCase())}</strong> pace (now ${esc(Pace.PACES[this.travelPaceNow()].label.toLowerCase())}).</p><p><button type="button" data-wct-action="accept-pace"><i class="fa-solid fa-check"></i> Set ${esc(Pace.PACES[r.pace].label.toLowerCase())} pace</button></p>` });
  },
  // ------------------------------------------------------------ flight network (the flightNetwork world setting; everyone can read it)
  /** The flight network, cleaned up (see flight.mjs). */
  flightNetwork() { let raw; try { raw = game.settings.get(ID, "flightNetwork"); } catch { raw = null; } return Flight.normalizeNetwork(raw); },
  /** GM: replaces the network. Refuses one with errors (empty or repeated names, routes to unknown points or to themselves). */
  async setFlightNetwork(obj) {
    if (!game.user.isGM) throw new Error("Only a GM can change the flight network.");
    const net = Flight.normalizeNetwork(obj); const errors = Flight.validateNetwork(net).filter(p => p.level === "error");
    if (errors.length) throw new Error(`Flight network not saved: ${errors.slice(0, 4).map(Flight.problemText).join("; ")}${errors.length > 4 ? "; …" : ""}.`);
    const found = F.on("flightMaster") && setting("flightDiscovered") ? Flight.newlyUnlocked(this.flightNetwork(), net) : [];
    await game.settings.set(ID, "flightNetwork", net);
    for (const p of found) await this.say(`<p class="wct-discovered"><i class="fa-solid fa-feather-pointed"></i> <strong>Discovered!</strong> New flight point: <strong>${esc(p.name)}</strong>.</p>`, "Flight Master");
    return net;
  },
  sceneExists(uuid) { return !!uuid && !!fromUuidSync(uuid, { strict: false }); },
  sceneName(uuid) { try { return fromUuidSync(uuid, { strict: false })?.name ?? null; } catch { return null; } },
  /** The pre-1.16 Flight Routes page's tables (GM): { pointRows, routeRows } or null when there's no such page or it's empty. */
  legacyFlightRows() {
    if (!game.user.isGM) return null;
    const p = game.journal.getName(this.JOURNAL)?.pages.getName("Flight Routes"); if (!p) return null;
    const html = p.text?.content ?? ""; const pointRows = this.parseTable(html, 0), routeRows = this.parseTable(html, 1);
    return Flight.legacyHasRows(pointRows) ? { pointRows, routeRows } : null;
  },
  /** Whether the editor and the health check should offer the import: the network is empty and the old page has rows. */
  canImportLegacyFlights() { return !this.flightNetwork().points.length && !!this.legacyFlightRows(); },
  /**
   * GM: imports the old Flight Routes page into the flight network. `dryRun` only reports. Never edits or deletes the page, and refuses
   * when the network already has flight points. Returns { network, report, counts, saved }.
   */
  async importLegacyFlights({ dryRun = false } = {}) {
    if (!game.user.isGM) throw new Error("GM only.");
    const rows = this.legacyFlightRows(); if (!rows) throw new Error(`No Flight Routes page with flight points in "${this.JOURNAL}".`);
    if (this.flightNetwork().points.length) throw new Error("The flight network already has flight points; the journal page isn't imported over it.");
    const res = Flight.importLegacy({ ...rows, scenes: game.scenes.map(s => ({ name: s.name, uuid: s.uuid })), parse: f => parseMoney(f) });
    if (dryRun) return { ...res, saved: false };
    await this.setFlightNetwork(res.network);
    await this.gmWhisper(`<p><strong>Flight Master:</strong> imported ${res.counts.points} flight point${res.counts.points === 1 ? "" : "s"} and ${res.counts.routes} route${res.counts.routes === 1 ? "" : "s"} from ${esc(this.JOURNAL)} › Flight Routes. The page wasn't changed and is no longer read; you may delete it.</p>${res.report.length ? `<ul>${res.report.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}`);
    return { ...res, saved: true };
  },
  /** GM: unlocks (or with on = false locks) a flight point by name or id. Returns the point. */
  async unlockFlightPoint(nameOrId, on = true) {
    if (!game.user.isGM) throw new Error("GM only.");
    const net = this.flightNetwork(); const p = Flight.findPoint(net, nameOrId); if (!p) throw new Error(`No flight point "${nameOrId}".`);
    if (p.unlocked !== !!on) { p.unlocked = !!on; await this.setFlightNetwork(net); }
    return { ...p };
  },
  /** Opens the flight network editor (GM). */
  flightEditor() { return this.gmOnly() ? FlightEditor.open(this) : undefined; },
  route(net, from, to) { return Flight.route(net, from, to); },
  partyActor() { return game.actors.find(a => a.type === "group" && a.name === this.PARTY); },
  playFlightSound() {
    const src = setting("flightSound"); if (!src) return;
    foundry.audio.AudioHelper.play({ src, volume: setting("flightVolume") ?? 0.8, autoplay: true, loop: false }, true);
  },
  /**
   * Opens Flight Master. The GM flies the party directly; a player's booking is sent to the active GM's client, which checks it again
   * and carries it out. Before confirming, both see the route, fare per passenger × passengers = total, the party purse and the hours.
   * A flight the party can't afford or over an unknown flight point is refused and nothing is charged. The GM can tick Free flight.
   */
  async flight() {
    if (!F.need("flightMaster")) return;
    const gm = game.user.isGM;
    if (!gm && !setting("playerFlights")) return ui.notifications.warn("Flight Master is GM only in this world.");
    if (!gm && !activeGM()) return ui.notifications.warn("A GM needs to be connected to fly.");
    const net = this.flightNetwork(); const open = net.points.filter(p => p.unlocked && p.name);
    if (open.length < 2) {
      if (!gm) return ui.notifications.warn("There are no flight paths open yet.");
      ui.notifications.warn(this.canImportLegacyFlights() ? "Flight Master: import your Flight Routes journal page in the flight network editor first." : "Flight Master: fewer than two flight points are unlocked. Set them up in the flight network editor.");
      return this.flightEditor();
    }
    let party = this.partyActor();
    const members = party?.system.members?.length || 0;
    const here = open.find(p => p.sceneUuid && p.sceneUuid === canvas.scene?.uuid)?.id ?? open[0].id;
    const other = open.find(p => p.id !== here)?.id;
    const content = `<div class="form-group"><label>From</label><select name="from">${open.map(p => this.opt(p.id, p.name, p.id === here)).join("")}</select></div>
      <div class="form-group"><label>To</label><select name="to">${open.map(p => this.opt(p.id, p.name, p.id === other)).join("")}</select></div>
      <div class="form-group"><label>Passengers</label><input type="number" name="pax" min="1" max="20" value="${members || 4}"></div>
      ${gm ? `<div class="form-group"><label>Open destination scene for players</label><input type="checkbox" name="scene" checked></div>
      <div class="form-group"><label>Free flight (no fare)</label><input type="checkbox" name="free"></div><p class="hint">GM only: a free flight skips the purse check and charges nothing; players never see this.</p>` : ""}
      <p class="hint">${gm ? "Flight points and routes come from the flight network (control panel › Travel). " : "Fares are paid from the party purse. "}${party ? `Party purse: ${this.purse(party)}.` : gm ? `No group actor named ${esc(this.PARTY)}; fares won't be deducted.` : ""}</p>`;
    const f = await this.form("Flight Master", content, "Check route"); if (!f) return;
    party = this.partyActor(); const pax = Flight.clampPax(f.pax); const free = gm && !!f.free;
    const c = Flight.check({ net, from: f.from, to: f.to, pax, purse: party ? this.totalMoney(party) : null, fmt: fmtMoney, free, sceneExists: gm ? u => this.sceneExists(u) : undefined });
    const path = r => `<p><strong>${r.names.map(esc).join(" → ")}</strong></p>`;
    if (!c.ok) {
      if (!c.r) return ui.notifications.warn(c.error);
      return this.info("Flight Master", `${path(c.r)}<p><strong>${esc(c.error)}</strong></p>`);
    }
    const { r, q } = c;
    const fare = free ? `<p><strong>Free flight</strong>: no fare is charged (the route's fare is ${fmtMoney(r.f)} per passenger).</p>`
      : `<p>Fare: ${fmtMoney(r.f)} per passenger × ${pax} passenger${pax === 1 ? "" : "s"} = <strong>${fmtMoney(q.total)}</strong></p>
      <p>${party ? `Party purse: ${this.purse(party)} (${fmtMoney(q.have)}; ${fmtMoney(q.have - q.total)} left after the flight)` : `No group actor named ${esc(this.PARTY)}: no fare is charged`}.</p>`;
    const land = gm && c.land.reason !== "ok" ? `<p class="hint">${esc(c.dest.name)} has ${c.land.reason === "missing" ? "a scene that no longer exists" : "no scene"}: the party lands there but the scene doesn't change.</p>` : "";
    const go = await this.confirm("Flight Master", `${path(r)}${fare}<p>Flight time: ${r.h} hour${r.h === 1 ? "" : "s"}.</p>${land}<p>${gm ? "Fly now?" : "Book this flight?"}</p>`);
    if (!go) return;
    if (!gm) {
      if (!activeGM()) return ui.notifications.warn("A GM needs to be connected to fly.");
      game.socket.emit(SOCKET, { action: "flight", from: f.from, to: f.to, pax, userId: game.user.id });
      ui.notifications.info("Booking sent to the flight master…");
      return r;
    }
    return this.doFlight({ from: f.from, to: f.to, pax, scene: !!f.scene, free });
  },
  /** GM, no dialog: flies the party now. `opts`: { pax, free, scene }. From and to are flight point names or ids. */
  async flyNow(from, to, { pax, free = false, scene = true } = {}) {
    if (!F.need("flightMaster") || !this.gmOnly()) return null;
    pax ??= this.partyActor()?.system.members?.length || 4;
    return this.doFlight({ from, to, pax, free: !!free, scene });
  },
  /** Tells a player how their booking went (the player's client shows it). */
  tellFlight(userId, ok, text) { if (userId && userId !== game.user.id) game.socket.emit(SOCKET, { action: "flightResult", userId, ok, text }); },
  /**
   * Carries out a flight on the GM's client: checks everything again (a player's request can't set its own price or ask for a free
   * flight), charges the fare, opens the destination scene when the point has one (refunding the fare if that fails), then sound,
   * time, log and chat. A point with no scene (or a deleted one) is still flown to; the scene just stays put and the GM is told.
   */
  async doFlight({ from, to, pax, scene = true, userId = null, free = false }) {
    const by = userId ? game.users.get(userId) : null;
    const fail = async error => {
      if (by) { await this.gmWhisper(`<p>${esc(by.name)}'s flight didn't go: ${esc(error)}</p>`); this.tellFlight(userId, false, error); }
      else ui.notifications.warn(`Flight Master: ${error}`);
      return null;
    };
    const net = this.flightNetwork();
    pax = Flight.clampPax(pax);
    const party = this.partyActor();
    // A booking that came over the socket (userId set) is a player's: `free` is ignored there, whoever sent it.
    const c = Flight.decide({ net, from, to, pax, purse: party ? this.totalMoney(party) : null, fmt: fmtMoney, free, byPlayer: !!userId, wantScene: scene, sceneExists: u => this.sceneExists(u) });
    if (!c.ok) return fail(c.error);
    const { r, q, dest, land, charge } = c; free = c.free;
    const sc = c.changeScene ? fromUuidSync(land.sceneUuid, { strict: false }) : null;
    const before = party ? foundry.utils.deepClone(party.system.currency ?? {}) : null;
    if (charge) await this.pay(party, charge);
    if (sc) {
      try { await sc.activate(); }
      catch (e) {
        let refunded = false; if (charge) { try { await party.update({ "system.currency": before }); refunded = true; } catch (e2) { console.error(`${ID} | flight refund failed`, e2); } }
        return fail(`the scene "${sc.name}" couldn't be opened (${e.message}). ${refunded ? "The fare was refunded." : charge ? `Refund failed: give the party ${fmtMoney(charge)} back by hand.` : ""}`.trim());
      }
    }
    this.playFlightSound();
    // Core world time, which calendar modules follow. Only with Flights advance world time on (off by default from 1.20).
    if (setting("flightAdvanceTime") === true && r.h > 0) await game.time.advance(Math.round(r.h * 3600));
    const fareText = free ? "free flight" : `${fmtMoney(q.total)}${charge || !q.total ? "" : " (not charged)"}`;
    // The flight has happened by now; a missing Travel Log page only costs the log line.
    try { await this.appendPage("Travel Log", `<p><strong>Flight.</strong> ${r.names.map(esc).join(" → ")}, ${r.h} h, ${fareText}${by ? `, booked by ${esc(by.name)}` : ""}. Arrived ${this.stamp()}.</p>`); }
    catch (e) { console.warn(`${ID} | flight not logged`, e); }
    await this.say(`<p><em>The party flies from ${esc(c.from.name)} to ${esc(dest.name)}${r.names.length > 2 ? ` by way of ${r.names.slice(1, -1).map(esc).join(", ")}` : ""}. ${r.h} hours in the air.</em></p><p>${free ? "Free flight: no fare." : `Fare: ${fmtMoney(q.total)}.`}</p><p>The party lands at ${esc(dest.name)}.</p>`, "Flight Master");
    if (!sc) {
      const why = land.reason === "missing" ? `${esc(dest.name)}'s scene no longer exists (pick another in the flight network editor)` : land.reason === "none" ? `${esc(dest.name)} has no scene` : "you chose not to open the destination scene";
      await this.gmWhisper(`<p><strong>Flight Master:</strong> the party landed at ${esc(dest.name)}, but ${why}, so the scene didn't change. You may want to move the party.</p>`);
    }
    if (by) this.tellFlight(userId, true, `Flight booked: ${c.from.name} → ${dest.name}. The party lands at ${dest.name}.`);
    return { ...r, free, charged: charge, sceneChanged: !!sc, landing: land.reason };
  },
  /** Long Road: which party members lack the riding feat (matched by the feat's flag or its name). */
  riders() {
    if (!F.on("riderFeat")) return { members: 0, untrained: [] };
    const party = this.partyActor();
    // The feat's flag, the configured name, or either default name (old worlds may still hold "Trained Rider").
    const names = new Set([riderName(), String(setting("riderFeat") || ""), DEFAULTS.riderFeat, OLD_RIDER].map(n => n.trim().toLowerCase()).filter(Boolean));
    const members = (party?.system.members ?? []).map(m => m.actor ?? m).filter(a => a?.items);
    const has = a => a.items.some(i => i.type === "feat" && (i.getFlag(ID, "feat") === "trained-rider" || names.has(i.name.trim().toLowerCase())));
    return { members: members.length, untrained: members.filter(a => !has(a)).map(a => a.name) };
  },

  // ------------------------------------------------------------ vendor trash
  vendorTrash(tokens) { return F.need("vendorTrash") ? Trash.vendorTrash(this, tokens) : undefined; },
  sellTrash(actor) { return F.need("vendorTrash") ? Trash.sellTrash(this, actor) : undefined; },
  /** Sells a character's grey junk to an Item Piles merchant (actors or tokens), after a confirm. */
  sellJunk(seller, merchant) { return F.need("vendorTrash") ? Merchant.sellJunk(seller ?? game.user.character, merchant) : undefined; },
  syncItemPilesCoins,
  /** Vendor Trash internals plus reroll(tokens), preview(tokenOrActor, n) and showPreview(tokens, n) for the GM. */
  trash: {
    ...Trash,
    reroll(tokens) { return F.need("vendorTrash") ? Trash.reroll(WCT, tokens) : undefined; },
    reset(tokens, opts = {}) { return F.need("vendorTrash") ? Trash.reset(WCT, tokens, opts) : undefined; },
    showPreview(tokens, n = 12) { return F.need("vendorTrash") ? Trash.showPreview(WCT, tokens, n) : undefined; },
    preview(target, n = 20) { return F.need("vendorTrash") ? Trash.preview(target ?? canvas.tokens?.controlled?.[0], n) : undefined; },
    /** Marks items (documents or UUIDs) Lootable (true), not lootable (false) or clears the mark (null). GM only. */
    setLootable(items, on = true) { return F.need("vendorTrash") ? Trash.setLootable(items, on) : undefined; },
    /** Everything is lootable on an actor or token (every physical item shows in its pile). GM only. */
    setAllLootable(target, on = true) { return F.need("vendorTrash") ? Trash.setAllLootable(target ?? canvas.tokens?.controlled?.[0], on) : undefined; },
    /** No loot on tokens or actors: setNoLoot(tokensOrActors, on, { actor }) (actor: mark the world actor, every token of it). */
    setNoLoot(targets, on = true, opts = {}) {
      if (!F.on("vendorTrash") && !F.on("bossLoot")) return F.need("vendorTrash");
      return Trash.setNoLoot(WCT, targets, on, opts);
    }
  },

  // ------------------------------------------------------------ character pane
  characterPane(actor) { return F.need("characterPane") ? Pane.characterPane(actor) : undefined; },
  pane: Pane,

  // ------------------------------------------------------------ quest log
  /** Opens the quest log, optionally on one quest. */
  questLog(quest) { return F.need("questLog") ? Quests.open(quest) : undefined; },
  /** Quest API (create, activate, complete, fail, tickObjective, open…); undefined when the quest log is off. */
  get quests() { return F.on("questLog") ? Quests.api : undefined; },

  // ------------------------------------------------------------ boss frames and loot rolls
  /** Boss frames API (toggle(tokens, on), isBoss(token), refresh()); undefined when the feature is off. */
  get bosses() { return F.on("bossFrames") ? Bosses.api : undefined; },
  /** Loot roll API (start(itemOrUuid, { seconds }), close(messageId)); undefined when the feature is off. */
  get lootRoll() { return F.on("lootRolls") ? Loot.api : undefined; },
  /** GM: opens the Loot history window (the Loot History macro). */
  lootHistory() { return F.need("lootRolls") && this.gmOnly() ? Loot.api.history() : undefined; },
  /**
   * Boss loot API; undefined when the feature is off. set(actorOrToken, { table, draws, coinCp, note }, { world }), get(actorOrToken),
   * preview(actorOrToken | list) whispers the table's odds to the GM, drop(tokens) drops it now, reset(tokens, { clearCoin }) is Reset loot,
   * dialog(token) opens the Boss loot dialog, and draw / drawWeighted / odds helpers.
   */
  /** GM: whispers the boss loot odds for the selected tokens (the Preview Boss Loot macro). */
  previewBossLoot(targets) { return F.need("bossLoot") ? BossLoot.preview(WCT, targets) : undefined; },
  get bossLoot() {
    if (!F.on("bossLoot")) return undefined;
    return {
      get: BossLoot.get, set: BossLoot.set, draw: BossLoot.draw, drawWeighted: BossLoot.drawWeighted, odds: BossLoot.odds,
      preview: targets => BossLoot.preview(WCT, targets), showPreview: targets => BossLoot.preview(WCT, targets),
      drop: tokens => BossLoot.drop(WCT, tokens), reset: (tokens, opts = {}) => Trash.reset(WCT, tokens, opts), dialog: target => BossLoot.openDialog(WCT, target ?? canvas.tokens?.controlled?.[0]),
      /** Links NPC actors to world tables named "<name> · Loot" (also " - Loot" or "Loot: <name>"). { folder, overwrite } */
      autoLink: (opts = {}) => BossLoot.autoLink(WCT, opts),
      scaledCoin: BossLoot.scaledCoin, scaledDraws: BossLoot.scaledDraws
    };
  },

  // ------------------------------------------------------------ 1.20: flight map, party gold, settings export / import
  /** Opens the flight route map (everyone; players see the unlocked points). */
  flightMap() { return F.need("flightMap") && F.need("flightMaster") ? FlightMap.open(this) : undefined; },
  /** GM: opens the party gold tracker. */
  partyGold() { return F.need("partyGold") && this.gmOnly() ? Gold.open(this) : undefined; },
  /** Party gold numbers (GM): { coin, gear, wealth, size, rows, … } in the smallest coin; undefined when the feature is off. */
  get gold() { return F.on("partyGold") ? { read: () => Gold.read(this), open: () => Gold.open(this), snapshot: note => Gold.snapshot(this, note), snapshots: Gold.snapshots } : undefined; },
  /** Settings export / import (GM): export() downloads the file, import() opens the import window, read(text) checks a file's text. */
  get settingsIO() { return F.on("settingsIO") ? { export: () => SettingsIO.exportFile(this), import: () => SettingsIO.openImport(this), read: text => SettingsIO.readText(text), apply: rows => SettingsIO.apply(rows) } : undefined; },

  // ------------------------------------------------------------ features
  features: F,
  /** Remove toolkit data: plan() counts what would go, remove({ actors, tokens, scenes, items, deleteItems, journals, macros, settings }) removes it (GM). Opens the window with no arguments. */
  cleanup: { plan: Cleanup.plan, remove: pick => Cleanup.remove(pick), open: () => new Cleanup.CleanupApp().render(true) },
  /** GM: opens the control panel, optionally on a tab (overview, features, travel, loot, boss, pane, quests). */
  panel(tab) { return this.gmOnly() ? Panel.open(tab) : undefined; },
  /** GM: opens the welcome wizard. */
  wizard() { return this.gmOnly() ? new Panel.WelcomeWizard().render({ force: true }) : undefined; },
  log,

  // ------------------------------------------------------------ money (amounts are in the smallest coin in use)
  parseMoney, fmtMoney, coins,
  totalMoney(a) { const c = a.system.currency ?? {}; return coins().reduce((t, [k, v]) => t + (c[k] || 0) * v, 0); },
  purse(a) { const c = a.system.currency ?? {}; const C = CONFIG.DND5E.currencies; const tight = setting("coinSystem") === "threeCoin"; return coins().filter(([k]) => c[k]).map(([k]) => `${c[k]}${tight ? "" : " "}${C[k].abbreviation}`).join(" ") || "empty"; },
  /** Spends the smallest coins first, then breaks one larger coin and gives change, so the purse keeps its mix. */
  async pay(a, amount) {
    const c = { ...a.system.currency }; let need = Math.round(amount); const asc = coins().reverse();
    for (const [k, v] of asc) { const take = Math.min(c[k] || 0, Math.floor(need / v)); c[k] = (c[k] || 0) - take; need -= take * v; }
    if (need > 0) {
      for (const [k, v] of asc) {
        if ((c[k] || 0) > 0 && v >= need) {
          c[k] -= 1; let change = v - need; need = 0;
          for (const [k2, v2] of coins()) { if (v2 >= v || k2 === "ep") continue; const n = Math.floor(change / v2); c[k2] = (c[k2] || 0) + n; change -= n * v2; }
          break;
        }
      }
    }
    await a.update({ "system.currency": c });
  },
  /** Changes an actor's coins up into the largest coins (no electrum), keeping the total. */
  consolidate(a) { return this.addMoney(a, 0, { consolidate: true }); },
  /**
   * Adds coin (in the smallest coin) to an actor in a single write, skipped when nothing changes. Plain: the amount goes on top in
   * the largest coins. consolidate: the whole purse is changed up into the largest coins afterwards (no electrum).
   */
  async addMoney(a, amount, { consolidate = false } = {}) {
    const old = a.system.currency ?? {}; const c = { ...old }; let left = Math.max(0, Math.round(amount));
    if (consolidate) left += this.totalMoney(a);
    for (const [k, v] of coins()) {
      if (k === "ep") { if (consolidate) c.ep = 0; continue; }
      const n = Math.floor(left / v); c[k] = consolidate ? n : (c[k] || 0) + n; left -= n * v;
    }
    if (Object.keys(c).some(k => c[k] !== old[k])) await a.update({ "system.currency": c });
  },
  /** Old name kept for macros written against v1.0–1.2. */
  totalCp(a) { return this.totalMoney(a); },

  // ------------------------------------------------------------ session
  async sessionStart() {
    if (!F.need("sessionStart") || !this.gmOnly()) return;
    let hide; try { hide = new RegExp(setting("hiddenScenes") || "(?!)"); } catch { hide = /(?!)/; }
    const scenes = game.scenes.filter(s => !hide.test(s.name)).sort((a, b) => a.name.localeCompare(b.name));
    const content = `<div class="form-group"><label>Scene</label><select name="scene">${scenes.map(s => this.opt(s.id, s.name, s.id === canvas.scene?.id)).join("")}</select></div>
      <div class="form-group"><label>Activate it for players</label><input type="checkbox" name="activate" checked></div>
      <div class="form-group"><label>Unpause the game</label><input type="checkbox" name="unpause" checked></div>`;
    const f = await this.form("Session Start", content, "Start session"); if (!f) return;
    const s = game.scenes.get(f.scene); if (f.activate && s) await s.activate();
    if (f.unpause && game.paused) game.togglePause(false, { broadcast: true });
    await this.appendPage("Travel Log", `<p><strong>Session started</strong> at ${this.stamp()}${s ? ` on ${esc(s.name)}` : ""}.</p>`);
  }
};

// api.updateNotes.show(fromVersion?) posts the update notes card again.
WCT.updateNotes = { show: from => Updates.show(from), build: from => Updates.build(from) };

// api.flight() opens Flight Master; its helpers hang off the same function.
Object.assign(WCT.flight, {
  network: () => WCT.flightNetwork(),
  setNetwork: obj => WCT.setFlightNetwork(obj),
  unlock: (nameOrId, on = true) => WCT.unlockFlightPoint(nameOrId, on),
  importLegacy: (opts = {}) => WCT.importLegacyFlights(opts),
  fly: (from, to, opts = {}) => WCT.flyNow(from, to, opts),
  editor: () => WCT.flightEditor(),
  map: () => WCT.flightMap()
});

Hooks.once("init", () => {
  registerSettings(); applyCoinSystem();
  Health.init(WCT); Panel.init(WCT); Updates.init(WCT);
  if (F.on("characterPane")) { Pane.registerHooks(); Pane.patchArmorClass(); }
  if (F.on("questLog")) Quests.init(WCT, { tracker: F.on("questTracker") });
  if (F.on("flightMaster")) registerFlightHooks();
  if (F.on("travelPace") && F.on("hexTravel")) registerPaceHooks();
  if (F.on("vendorTrash")) { registerTrashHooks(); Merchant.init(); }
  if (F.on("bossFrames")) Bosses.init();
  if (F.on("lootRolls")) Loot.init();
  // After Vendor Trash's hooks, so a body gets its trash before its boss loot joins it in the same pile.
  if (F.on("bossLoot")) BossLoot.init(WCT, { vendorTrash: F.on("vendorTrash") });
});
Hooks.once("ready", () => {
  const mod = game.modules.get(ID); mod.api = WCT;
  globalThis.WCT = WCT; // lets world macros written for the library version keep working
  if (F.on("travelPace") && F.on("hexTravel")) game.socket.on(SOCKET, (msg, senderId) => { if (msg?.action === "paceRequest") WCT.paceRequest(msg, senderId).catch(e => console.warn(`${ID} | pace request`, e)); });
  if (F.on("flightMaster")) {
    game.socket.on(SOCKET, async (msg, senderId) => {
      if (msg?.action === "flightResult") {
        if (msg.userId === game.user.id && typeof msg.text === "string") ui.notifications[msg.ok ? "info" : "warn"](`Flight Master: ${msg.text.slice(0, 300)}`);
        return;
      }
      if (msg?.action !== "flight" || !isActiveGM()) return;
      const uid = typeof senderId === "string" && game.users.has(senderId) ? senderId : msg.userId;
      if (!setting("playerFlights")) return WCT.tellFlight(uid, false, "players can't book flights in this world.");
      // A player's booking: always charged, always changes the scene when the point has one (a "free" field is ignored).
      try { await WCT.doFlight({ ...Flight.socketBooking(msg), userId: uid }); }
      catch (e) { console.error(`${ID} | player flight failed`, e); ui.notifications.error(`Wayfarer's Toolkit: a player's flight failed (${e.message}).`); WCT.tellFlight(uid, false, `the flight failed (${e.message}).`); }
    });
  }
  if (F.on("questLog")) Quests.ready();
  if (F.on("lootRolls")) Loot.ready();
  if (F.on("hexTravel") && isActiveGM()) checkZones(setting("zones"), { notify: true });
  convertOldCoins();
  // The welcome wizard (fresh worlds only) decides first, so a world it marks as already configured counts as an upgrade; then the
  // update notes (an upgrade posts its card; a new world just stores the version).
  Panel.maybeWelcome(WCT).catch(e => { console.warn(`${ID} | welcome wizard`, e); return false; })
    .then(() => Updates.onReady(WCT)).catch(e => console.warn(`${ID} | update notes`, e));
  console.log(`${ID} | ready (v${mod.version}; features off: ${F.FEATURES.filter(f => !F.on(f.id)).map(f => f.id).join(", ") || "none"})`);
});

// Item Piles applies its system defaults shortly after its own ready hook; set the three-coin currencies after that.
Hooks.once("item-piles-ready", () => setTimeout(() => syncItemPilesCoins(), 2000));

function registerFlightHooks() {
  // Flight Master button in the token controls, for the GM and (when allowed) players.
  Hooks.on("getSceneControlButtons", controls => {
    const tokens = controls.tokens ?? controls.token; if (!tokens?.tools) return;
    if (!game.user.isGM && !game.settings.get(ID, "playerFlights")) return;
    tokens.tools.wctFlight = { name: "wctFlight", title: "Flight Master", icon: "fa-solid fa-feather-pointed", order: 99, button: true, visible: true, onChange: () => WCT.flight() };
  });
  // Flight route map button: for everyone (players see only what's unlocked), when the map is turned on.
  if (F.on("flightMap")) Hooks.on("getSceneControlButtons", controls => {
    const tokens = controls.tokens ?? controls.token; if (!tokens?.tools) return;
    tokens.tools.wctFlightMap = { name: "wctFlightMap", title: "Flight route map", icon: "fa-solid fa-map-location-dot", order: 100, button: true, visible: true, onChange: () => WCT.flightMap() };
  });
}

function registerPaceHooks() {
  // A player's pace request: the GM's Accept button on the whispered card.
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const req = message.flags?.[ID]?.paceRequest; if (!req) return;
    const btn = html.querySelector?.("[data-wct-action=accept-pace]"); if (!btn) return;
    if (!game.user.isGM) return btn.remove();
    if (WCT.travelPaceNow() === Pace.normPace(req.pace)) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-check"></i> That\'s the pace now'; }
    btn.addEventListener("click", async ev => { ev.preventDefault(); btn.disabled = true; try { await WCT.setTravelPace(req.pace, { by: req.user }); } catch (e) { btn.disabled = false; ui.notifications.error(`Travel pace: ${e.message}`); } });
  });
}

function registerTrashHooks() {
  // Scene configuration: a "Dungeon" checkbox (flags.wayfarers-toolkit.dungeon) for richer Vendor Trash drops.
  Hooks.on("renderSceneConfig", (app, html) => Trash.addDungeonField(app, html));
  // Vendor Trash loot cards: the Give to Party button (GM only).
  Hooks.on("renderChatMessageHTML", (message, html) => {
    if (!message.flags?.[ID]?.trash) return;
    const btn = html.querySelector?.("[data-wct-action=give-trash]"); if (!btn) return;
    if (!game.user.isGM) return btn.remove();
    if (message.getFlag(ID, "trash")?.given) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-check"></i> Given to party'; return; }
    btn.addEventListener("click", async ev => { ev.preventDefault(); btn.disabled = true; try { await Trash.giveTrash(message, WCT); } catch (e) { btn.disabled = false; ui.notifications.error(`Vendor Trash: ${e.message}`); } });
  });
  // Pre-rolled loot: rolled when an unlinked NPC token is placed (active GM's client only; the checks live in trash.mjs).
  Hooks.on("createToken", doc => Trash.onCreateToken(doc, WCT));
  // Bodies become lootable at 0 HP (an unlinked token's HP lives in its actor delta) or when marked defeated.
  const hpChanged = c => foundry.utils.hasProperty(c ?? {}, "system.attributes.hp");
  Hooks.on("updateActor", (actor, changes) => { if (actor.isToken && hpChanged(changes)) Trash.onDeath(actor.token, WCT); });
  Hooks.on("updateToken", (doc, changes) => { if (hpChanged(changes.delta)) Trash.onDeath(doc, WCT); });
  Hooks.on("updateCombatant", (c, changes) => { if (changes.defeated === true) Trash.onDeath(c.token, WCT, { defeated: true }); });
  Hooks.on("createActiveEffect", effect => {
    const actor = effect.parent; const dead = CONFIG.specialStatusEffects?.DEFEATED ?? "dead";
    if (!actor?.isToken) return;
    if (effect.statuses?.has?.(dead)) return Trash.onDeath(actor.token, WCT, { defeated: true });
    if (effect.statuses?.has?.("unconscious") && setting("trashUnconscious")) Trash.onDeath(actor.token, WCT, { defeated: true });
  });
  // Your own loot: GM-added items are marked Lootable as they're created; marks and "Everything is lootable" refresh existing piles.
  Hooks.on("preCreateItem", (item, data, options, userId) => Trash.onPreCreateItem(item, data, options, userId));
  const lootFlagChanged = c => foundry.utils.hasProperty(c ?? {}, `flags.${ID}.lootable`) || foundry.utils.hasProperty(c ?? {}, `flags.${ID}.-=lootable`);
  Hooks.on("updateItem", (item, changes) => { if (item.parent instanceof Actor && lootFlagChanged(changes)) Trash.refreshPiles(item.parent); });
  Hooks.on("createItem", item => { if (item.parent instanceof Actor && item.getFlag(ID, "lootable") === true) Trash.refreshPiles(item.parent); });
  Hooks.on("updateActor", (actor, changes) => {
    if (foundry.utils.hasProperty(changes ?? {}, `flags.${ID}.allLootable`) || foundry.utils.hasProperty(changes ?? {}, `flags.${ID}.-=allLootable`)) Trash.refreshPiles(actor);
  });
  // Lootable checkbox on NPC items' sheets, Mark as loot in the inventory context menu, Everything is lootable in the NPC sheet header (GM).
  // renderDocumentSheetV2 fires for every ApplicationV2 document sheet whatever the system's class name (dnd5e's ItemSheet5e included).
  Hooks.on("renderDocumentSheetV2", (app, element) => { if (app.document instanceof Item) Trash.addLootableCheckbox(app, element); });
  Hooks.on("dnd5e.getItemContextOptions", (item, options) => Trash.addItemContextOptions(item, options));
  Hooks.on("getHeaderControlsActorSheetV2", (app, controls) => Trash.addAllLootableControl(app, controls));
  Hooks.on("renderTokenHUD", (hud, html) => Trash.addHudButton(hud, html, WCT));
  Hooks.on("renderTokenHUD", (hud, html) => Trash.addNoLootButton(hud, html, WCT));
  // The rules page and the world's creature names feed the flavour rules; re-read them when they change.
  const rulesPage = p => p?.name === Trash.RULES_PAGE && p.parent?.name === WCT.JOURNAL;
  for (const h of ["createJournalEntryPage", "updateJournalEntryPage", "deleteJournalEntryPage"]) Hooks.on(h, p => { if (rulesPage(p)) Trash.resetRules(); });
  Hooks.on("createActor", Trash.resetFamilies);
  Hooks.on("deleteActor", Trash.resetFamilies);
  Hooks.on("updateActor", (a, changes) => { if ("name" in (changes ?? {})) Trash.resetFamilies(); });
}
