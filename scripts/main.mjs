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
import { MACROS, MACRO_HINT, macroData } from "./macros.mjs";
import * as Menus from "./settings.mjs";
import * as Cleanup from "./cleanup.mjs";
import { log } from "./log.mjs";

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
  trashUnconscious: false,
  partySize: 4,
  debugLog: false
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
function parseMoney(text, unit = setting("fareUnit")) {
  const val = Object.fromEntries(coins()); const str = String(text ?? "").trim(); if (!str) return 0;
  if (/^\d+(\.\d+)?$/.test(str)) return Math.round(+str * (val[unit] ?? val.gp ?? 1));
  let total = 0, hit = false;
  for (const [, n, u] of str.matchAll(/(\d+(?:\.\d+)?)\s*([a-z]+)/gi)) { const k = coinKey(u); if (k && val[k]) { total += +n * val[k]; hit = true; } }
  return Math.round(hit ? total : (parseFloat(str) || 0) * (val[unit] ?? 1));
}
/** Amount in the smallest coin → "1g 20s 5c" (three-coin) or "1 gp 2 sp" (standard). Electrum is never used for change. */
function fmtMoney(amount) {
  amount = Math.max(0, Math.round(amount)); const C = CONFIG.DND5E.currencies; const tight = setting("coinSystem") === "threeCoin"; const parts = [];
  for (const [k, v] of coins()) { if (k === "ep") continue; const n = Math.floor(amount / v); if (n) { parts.push(`${n}${tight ? "" : " "}${C[k].abbreviation}`); amount -= n * v; } }
  return parts.join(" ") || `0${tight ? "" : " "}${C[coins().at(-1)[0]].abbreviation}`;
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
  // Shown in the main settings list: Choose features, Health check, Remove toolkit data, Run setup, Party size, Coin system, Campaign name
  // and one "… settings" button per feature group. Everything else is registered with config: false (same keys as before, so nothing
  // stored is lost) and shown in its group's submenu (settings.mjs). Settings of a turned-off feature stay registered but aren't shown.
  const s = (key, name, hint, type, extra = {}, config = false) => game.settings.register(ID, key, { name, hint, scope: "world", config, type, default: DEFAULTS[key], ...extra });
  s("partySize", "Party size", "How many characters the party has (1 to 8). Boss loot coin scales with it (× party size / 4) and, above 4, bosses with 3 or more draws get one more (see Boss loot settings).", Number, { range: { min: 1, max: 8, step: 1 } }, true);
  s("coinSystem", "Coin system", "Three coins replaces dnd5e's five with copper, silver and gold at 100 to 1, as in classic MMOs. Reloads Foundry. Item prices are not changed. See the README before switching.", String, { choices: { standard: "Standard 5e (cp, sp, ep, gp, pp)", threeCoin: "Three coins: copper, silver, gold (100 to 1)" }, requiresReload: true }, true);
  s("campaignName", "Campaign name", "Used in the Session Start recap (\"Previously, in …\"). Leave blank to use the world title.", String, {}, true);
  // General
  s("trackerJournal", "General: Tracker journal", "Journal holding the Travel Log, Flight Routes and Session Recap pages.", String);
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
  s("fareUnit", "Flight Master: Fare unit", "Coin used for fares written as plain numbers in the Flight Routes table. Fares can also be written with coins, like 1g 20s or 50c.", String, { choices: { gp: "Gold", sp: "Silver", cp: "Copper" } });
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
  s("trashPacks", "Vendor Trash: Compendiums", "Item compendium IDs to draw vendor trash from, separated by commas. Leave blank to use the wow-classic-items module's compendium (wow-classic-items.items) when it's installed. Grey items are trash; in other compendiums, loot items with no rarity are.", String, { onChange: () => Trash.resetPool() });
  game.settings.register(ID, "flightCache", { scope: "world", config: false, type: Object, default: { pts: [], routes: [] } });
  game.settings.register(ID, "setupReminded", { scope: "world", config: false, type: String, default: "" });
  game.settings.registerMenu(ID, "health", { name: "Health check", label: "Health check", hint: "Checks features, dependencies, setup, boss loot links, the Vendor Trash Rules page, dungeon scenes, flight routes, encounter zones and connected GMs. Changes nothing.", icon: "fas fa-stethoscope", type: Health.HealthApp, restricted: true });
  game.settings.registerMenu(ID, "setup", { name: "Set up this world", label: "Run setup", hint: "Creates the tracker journal, party actor and macros (in the Wayfarer's Toolkit macro folder) if they don't exist yet. Never touches anyone's hotbar. Safe to run again.", icon: "fas fa-hammer", type: SetupApp, restricted: true });
  game.settings.registerMenu(ID, "cleanup", { name: "Remove toolkit data", label: "Remove toolkit data", hint: "Counts, then removes the toolkit's flags, its vendor trash and boss loot items, setup macros or settings from this world (you pick). Asks before changing anything.", icon: "fas fa-broom", type: Cleanup.CleanupApp, restricted: true });
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

class SetupApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { id: `${ID}-setup`, window: { title: "Wayfarer's Toolkit · Setup" }, position: { width: 420 } };
  async _renderHTML() {
    const div = document.createElement("div");
    div.innerHTML = `<p>This creates anything that's missing for the features turned on:</p><ul><li>the tracker journal (<em>${esc(setting("trackerJournal"))}</em>)</li><li>the party actor (<em>${esc(setting("partyActor"))}</em>)</li><li>a <em>Wayfarer's Toolkit</em> macro folder with the macros (nothing is put on any hotbar: drag them from the folder or the <em>Wayfarer's Toolkit Macros</em> compendium)</li>${F.on("riderFeat") ? `<li>the ${esc(riderName())} feat</li>` : ""}</ul><p>Nothing existing is overwritten or deleted.</p><button type="button" data-action="run"><i class="fas fa-hammer"></i> Run setup</button>`;
    div.querySelector("[data-action=run]").addEventListener("click", async () => { const r = await WCT.setup(); ui.notifications.info(`Wayfarer's Toolkit: ${r.length ? "created " + r.join(", ") : "everything already exists"}. ${MACRO_HINT}`); this.close(); });
    return div;
  }
  _replaceHTML(result, content) { content.replaceChildren(result); }
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
  "Travel Log": `<h2>Travel Rules</h2><ul><li><strong>1 hex = 1 mile.</strong> Roads are safe: no encounter rolls on road hexes.</li><li>Off-road hexes take longer and each rolls for an encounter on the zone's table.</li><li>Tick <em>Mounted</em> in Hex Travel when the party rides.</li></ul><p>The Hex Travel and Flight Master tools write each trip below.</p><h2>Log</h2>`,
  "Flight Routes": `<h2>Flight Points</h2><p>Only points marked <strong>yes</strong> appear in Flight Master. <em>Scene</em> is opened on arrival (optional).</p><table><thead><tr><th>Flight point</th><th>Scene</th><th>Unlocked</th></tr></thead><tbody><tr><td>Example Town</td><td></td><td>yes</td></tr><tr><td>Example Outpost</td><td></td><td>no</td></tr></tbody></table><h2>Routes</h2><p>Direct flights, both directions. Fare per passenger, written like <em>2s</em> or <em>1g 20s</em> (a plain number uses the Fare unit setting); hours of flight.</p><table><thead><tr><th>From</th><th>To</th><th>Fare</th><th>Hours</th></tr></thead><tbody><tr><td>Example Town</td><td>Example Outpost</td><td>2</td><td>1</td></tr></tbody></table>`,
  "Session Recap": `<h2>Last Session Recap</h2><p><em>Write a short recap here after each session. The Session Start macro offers it as the opening recap.</em></p>`
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
  tracker() { const j = game.journal.getName(this.JOURNAL); if (!j) throw new Error(`Wayfarer's Toolkit: journal "${this.JOURNAL}" not found. Run setup from the module settings.`); return j; },
  state() { return foundry.utils.duplicate(this.tracker().getFlag("world", "trackers") ?? {}); },
  async setState(patch) { const s = { ...this.state(), ...patch }; await this.tracker().setFlag("world", "trackers", s); return s; },
  stamp(t = game.time.worldTime) { const d = Math.floor(t / 86400) + 1, h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60); return `Day ${d}, ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; },
  page(name) { const p = this.tracker().pages.getName(name); if (!p) throw new Error(`Wayfarer's Toolkit: page "${name}" missing from "${this.JOURNAL}".`); return p; },
  async appendPage(name, html) { const p = this.page(name); await p.update({ "text.content": (p.text.content || "") + html }); },
  parseTable(html, i) { const t = new DOMParser().parseFromString(html, "text/html").querySelectorAll("table")[i]; return t ? [...t.querySelectorAll("tbody tr")].map(tr => [...tr.children].map(td => td.textContent.trim())) : []; },
  gmWhisper(content) { return ChatMessage.create({ content, whisper: game.users.filter(u => u.isGM).map(u => u.id), speaker: { alias: "Wayfarer's Toolkit" } }); },
  say(content, alias = "Narrator") { return ChatMessage.create({ content, speaker: { alias } }); },
  /** An information or refusal window with a single OK button. */
  info(title, content, label = "OK") { return foundry.applications.api.DialogV2.prompt({ window: { title }, content, ok: { label, icon: "fa-solid fa-check" }, rejectClose: false }); },
  form(title, content, label = "OK") { return foundry.applications.api.DialogV2.prompt({ window: { title }, content, position: { width: 460 }, ok: { label, callback: (ev, btn) => new foundry.applications.ux.FormDataExtended(btn.form).object }, rejectClose: false }); },
  confirm(title, content) { return foundry.applications.api.DialogV2.confirm({ window: { title }, content, rejectClose: false }); },
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
    for (const m of MACROS.filter(m => F.on(m.feature))) out.push({ key: `macro:${m.fn}`, label: `macro "${m.name}"`, ok: !!game.macros.getName(m.name) });
    if (F.on("riderFeat")) out.push({ key: "feat", label: `${riderName()} feat`, ok: !!game.items.find(i => i.getFlag(ID, "feat") === "trained-rider") });
    return out;
  },
  /** GM: checks the world and whispers the report (also the Health check button in the settings and the Toolkit Health Check macro). */
  health(opts = {}) { if (!this.gmOnly()) return; return Health.post(this, opts); },
  /** For the health check: coin settings, Item Piles' currencies and the active GM helpers. */
  internals: { ipCoinsMatch, riderName, activeGM, isActiveGM, checkZones, flightProblems: () => WCT.flightProblems() },
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
    const want = MACROS.filter(m => F.on(m.feature) && !game.macros.getName(m.name));
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
      <div class="form-group"><label>Pace</label><select name="pace">${this.opt("slow", `Slow · ${this.PACE.slow} mph · can travel stealthily`)}${this.opt("normal", `Normal · ${this.PACE.normal} mph`, true)}${this.opt("fast", `Fast · ${this.PACE.fast} mph · −5 passive Perception`)}</select></div>
      <p class="hint">1 hex = 1 mile. Roads are safe; each off-road hex takes ×${this.OFFROAD_MULT} time and rolls 1d${this.ENC_DIE} (1 = encounter). </p>
      <div class="form-group"><label>Mounted (speed ×${this.MOUNT_MULT})</label><input type="checkbox" name="mounted" ${mountedDefault ? "checked" : ""}></div>
      ${riders.members ? `<p class="hint">${riders.untrained.length ? `Long Road: not trained to ride yet: ${riders.untrained.map(esc).join(", ")}.` : `Long Road: every party member has ${esc(riderName())}.`}</p>` : ""}`;
    const f = await this.form("Hex Travel", content, "Travel"); if (!f) return;
    const road = Math.max(0, Math.floor(+f.road || 0)), off = Math.max(0, Math.floor(+f.off || 0));
    if (!road && !off) return ui.notifications.warn("No hexes entered.");
    const mph = this.PACE[f.pace] * (f.mounted ? this.MOUNT_MULT : 1);
    const hours = (road + off * this.OFFROAD_MULT) / mph;
    const table = game.tables.getName(Z[f.zone] ?? "");
    const enc = [];
    for (let i = 1; i <= off; i++) {
      const r = await new Roll(`1d${this.ENC_DIE}`).evaluate();
      if (r.total === 1) { if (table) { const d = await table.roll(); const res = d.results[0]; enc.push(`Off-road hex ${i} (rolled ${d.roll.total}): ${res.description || res.name}`); } else enc.push(`Off-road hex ${i}: encounter (no table for this zone)`); }
    }
    const before = this.stamp(); await game.time.advance(Math.round(hours * 3600)); const after = this.stamp();
    const trips = (s.trips || 0) + 1; await this.setState({ trips });
    const summary = `<strong>${esc(f.zone)}</strong>: ${road} road + ${off} off-road hexes, ${f.pace} pace${f.mounted ? ", mounted" : ""}. ${hours.toFixed(1)} h (${before} → ${after}).`;
    const encHtml = enc.length ? `<ul>${enc.map(e => `<li>${e}</li>`).join("")}</ul>` : `<p>No encounters${off ? "" : ". Roads are safe"}.</p>`;
    await this.appendPage("Travel Log", `<p><strong>Trip ${trips}.</strong> ${summary}</p>${encHtml}`);
    await this.gmWhisper(`<h3>Hex Travel</h3><p>${summary}</p>${encHtml}`);
    await this.say(`<p><em>The party travels ${road + off} miles through ${esc(f.zone)} (${hours.toFixed(1)} hours).</em></p>`, "Travel");
    return { hours, enc };
  },
  /** Flight points and routes. The GM reads the tracker journal; players read a copy the GM keeps in a world setting, since they can't open the GM journal. */
  flightData() {
    if (!game.user.isGM) return game.settings.get(ID, "flightCache") ?? { pts: [], routes: [] };
    const html = this.page("Flight Routes").text.content;
    // sm: the point names a scene that doesn't exist (players can't look scenes up themselves, so the GM's copy says).
    const pts = this.parseTable(html, 0).map(([n, sc, u]) => ({ n, sc, u: /^y/i.test(u || ""), sm: !!sc && !game.scenes.getName(sc) }));
    const routes = this.parseTable(html, 1).map(([a, b, f, h]) => ({ a, b, f: parseMoney(f), h: +h || 0 }));
    return { pts, routes };
  },
  /** Malformed rows in the Flight Routes tables (GM): [{ table, row, column, text }]. */
  flightProblems() {
    if (!game.user.isGM) return [];
    const html = this.page("Flight Routes").text.content;
    return Flight.flightRowProblems(this.parseTable(html, 0), this.parseTable(html, 1));
  },
  /** Active GM: warns once per change about malformed Flight Routes rows. */
  warnFlightRows() {
    if (!isActiveGM()) return;
    let probs; try { probs = this.flightProblems(); } catch { return; }
    const key = JSON.stringify(probs); if (key === this._flightWarned) return; this._flightWarned = key;
    if (probs.length) ui.notifications.warn(`Flight Master: ${probs.length} problem${probs.length === 1 ? "" : "s"} in ${this.JOURNAL} › Flight Routes: ${probs.slice(0, 3).map(Flight.rowProblemText).join("; ")}${probs.length > 3 ? "; …(see the health check)" : ""}.`);
  },
  async syncFlightCache() {
    if (!isActiveGM()) return;
    let data; try { data = this.flightData(); } catch { return; }
    const old = game.settings.get(ID, "flightCache");
    if (JSON.stringify(old) !== JSON.stringify(data)) await game.settings.set(ID, "flightCache", data);
    this.warnFlightRows();
  },
  route(from, to, open, routes) { return Flight.route(from, to, open, routes); },
  partyActor() { return game.actors.find(a => a.type === "group" && a.name === this.PARTY); },
  playFlightSound() {
    const src = setting("flightSound"); if (!src) return;
    foundry.audio.AudioHelper.play({ src, volume: setting("flightVolume") ?? 0.8, autoplay: true, loop: false }, true);
  },
  /**
   * Opens Flight Master. The GM flies the party directly; a player's booking is sent to the active GM's client, which checks it again
   * and carries it out. Before confirming, both see the route, fare per passenger × passengers = total, the party purse and the hours.
   * A flight the party can't afford, to a scene that doesn't exist or over an unknown flight point is refused and nothing is charged.
   */
  async flight() {
    if (!F.need("flightMaster")) return;
    const gm = game.user.isGM;
    if (!gm && !setting("playerFlights")) return ui.notifications.warn("Flight Master is GM only in this world.");
    if (!gm && !activeGM()) return ui.notifications.warn("A GM needs to be connected to fly.");
    let data; try { data = this.flightData(); } catch (e) { return ui.notifications.error(e.message); }
    const { pts, routes } = data; const open = pts.filter(p => p.u).map(p => p.n);
    if (open.length < 2) return ui.notifications.warn(gm ? `Fewer than two flight points are unlocked. Mark them yes in ${this.JOURNAL} › Flight Routes.` : "There are no flight paths open yet.");
    let party = this.partyActor();
    const members = party?.system.members?.length || 0;
    const here = pts.find(p => p.u && p.sc && p.sc === canvas.scene?.name)?.n ?? open[0];
    const content = `<div class="form-group"><label>From</label><select name="from">${open.map(n => this.opt(n, n, n === here)).join("")}</select></div>
      <div class="form-group"><label>To</label><select name="to">${open.map(n => this.opt(n, n, n !== here && n === open.find(x => x !== here))).join("")}</select></div>
      <div class="form-group"><label>Passengers</label><input type="number" name="pax" min="1" max="20" value="${members || 4}"></div>
      ${gm ? `<div class="form-group"><label>Open destination scene for players</label><input type="checkbox" name="scene" checked></div>` : ""}
      <p class="hint">${gm ? `Fares and routes come from ${esc(this.JOURNAL)} › Flight Routes. ` : "Fares are paid from the party purse. "}${party ? `Party purse: ${this.purse(party)}.` : gm ? `No group actor named ${esc(this.PARTY)}; fares won't be deducted.` : ""}</p>`;
    const f = await this.form("Flight Master", content, "Check route"); if (!f) return;
    party = this.partyActor(); const pax = Flight.clampPax(f.pax);
    const c = Flight.check({ pts, routes, from: f.from, to: f.to, pax, purse: party ? this.totalMoney(party) : null, fmt: fmtMoney });
    const path = r => `<p><strong>${r.path.map(esc).join(" → ")}</strong></p>`;
    if (!c.ok) {
      if (!c.r) return ui.notifications.warn(c.error);
      return this.info("Flight Master", `${path(c.r)}<p><strong>${esc(c.error)}</strong></p>`);
    }
    const { r, q } = c;
    const summary = `${path(r)}<p>Fare: ${fmtMoney(r.f)} per passenger × ${pax} passenger${pax === 1 ? "" : "s"} = <strong>${fmtMoney(q.total)}</strong></p>
      <p>${party ? `Party purse: ${this.purse(party)} (${fmtMoney(q.have)}; ${fmtMoney(q.have - q.total)} left after the flight)` : `No group actor named ${esc(this.PARTY)}: no fare is charged`}.</p>
      <p>Flight time: ${r.h} hour${r.h === 1 ? "" : "s"}.</p>`;
    const go = await this.confirm("Flight Master", `${summary}<p>${gm ? "Fly now?" : "Book this flight?"}</p>`);
    if (!go) return;
    if (!gm) {
      if (!activeGM()) return ui.notifications.warn("A GM needs to be connected to fly.");
      game.socket.emit(SOCKET, { action: "flight", from: f.from, to: f.to, pax, userId: game.user.id });
      ui.notifications.info("Booking sent to the flight master…");
      return r;
    }
    return this.doFlight({ from: f.from, to: f.to, pax, scene: !!f.scene });
  },
  /** Tells a player how their booking went (the player's client shows it). */
  tellFlight(userId, ok, text) { if (userId && userId !== game.user.id) game.socket.emit(SOCKET, { action: "flightResult", userId, ok, text }); },
  /**
   * Carries out a flight on the GM's client: checks everything again (a player's request can't set its own price), charges the fare,
   * opens the destination scene (refunding the fare if that fails), then sound, time, log and chat.
   */
  async doFlight({ from, to, pax, scene = true, userId = null }) {
    const by = userId ? game.users.get(userId) : null;
    const fail = async error => {
      if (by) { await this.gmWhisper(`<p>${esc(by.name)}'s flight ${esc(from)} → ${esc(to)} didn't go: ${esc(error)}</p>`); this.tellFlight(userId, false, error); }
      else ui.notifications.warn(`Flight Master: ${error}`);
      return null;
    };
    let data; try { data = this.flightData(); } catch (e) { return fail(e.message); }
    pax = Flight.clampPax(pax);
    const party = this.partyActor();
    const c = Flight.check({ pts: data.pts, routes: data.routes, from, to, pax, purse: party ? this.totalMoney(party) : null, fmt: fmtMoney });
    if (!c.ok) return fail(c.error);
    const { r, q } = c; const sc = c.dest?.sc ? game.scenes.getName(c.dest.sc) : null;
    const before = party ? foundry.utils.deepClone(party.system.currency ?? {}) : null;
    if (party && q.total) await this.pay(party, q.total);
    if (scene && sc) {
      try { await sc.activate(); }
      catch (e) {
        let refunded = false; if (party && q.total) { try { await party.update({ "system.currency": before }); refunded = true; } catch (e2) { console.error(`${ID} | flight refund failed`, e2); } }
        return fail(`the scene "${sc.name}" couldn't be opened (${e.message}). ${refunded ? "The fare was refunded." : party && q.total ? `Refund failed: give the party ${fmtMoney(q.total)} back by hand.` : ""}`.trim());
      }
    }
    this.playFlightSound();
    await game.time.advance(Math.round(r.h * 3600));
    // The flight has happened by now; a missing Travel Log page only costs the log line.
    try { await this.appendPage("Travel Log", `<p><strong>Flight.</strong> ${r.path.map(esc).join(" → ")}, ${r.h} h, ${fmtMoney(q.total)}${party ? "" : " (not charged)"}${by ? `, booked by ${esc(by.name)}` : ""}. Arrived ${this.stamp()}.</p>`); }
    catch (e) { console.warn(`${ID} | flight not logged`, e); }
    await this.say(`<p><em>The party flies from ${esc(from)} to ${esc(to)}${r.path.length > 2 ? ` by way of ${r.path.slice(1, -1).map(esc).join(", ")}` : ""}. ${r.h} hours in the air.</em></p><p>Fare: ${fmtMoney(q.total)}.</p>`, "Flight Master");
    if (by) this.tellFlight(userId, true, `Flight booked: ${from} → ${to}. Mount up!`);
    return r;
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

  // ------------------------------------------------------------ features
  features: F,
  /** Remove toolkit data: plan() counts what would go, remove({ actors, tokens, scenes, items, deleteItems, journals, macros, settings }) removes it (GM). Opens the window with no arguments. */
  cleanup: { plan: Cleanup.plan, remove: pick => Cleanup.remove(pick), open: () => new Cleanup.CleanupApp().render(true) },
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
    const recapPage = this.page("Session Recap");
    const recapText = new DOMParser().parseFromString(recapPage.text.content || "", "text/html").body.textContent.replace(/^\s*Last Session Recap\s*/, "").replace(/Write a short recap here[^.]*\.[^.]*\./, "").trim();
    let hide; try { hide = new RegExp(setting("hiddenScenes") || "(?!)"); } catch { hide = /(?!)/; }
    const scenes = game.scenes.filter(s => !hide.test(s.name)).sort((a, b) => a.name.localeCompare(b.name));
    const content = `<div class="form-group"><label>Scene</label><select name="scene">${scenes.map(s => this.opt(s.id, s.name, s.id === canvas.scene?.id)).join("")}</select></div>
      <div class="form-group"><label>Activate it for players</label><input type="checkbox" name="activate" checked></div>
      <div class="form-group stacked"><label>Recap ("Previously…")</label><textarea name="recap" rows="6">${esc(recapText)}</textarea></div>
      <div class="form-group"><label>Post recap to chat</label><input type="checkbox" name="post" checked></div>
      <div class="form-group"><label>Unpause the game</label><input type="checkbox" name="unpause" checked></div>`;
    const f = await this.form("Session Start", content, "Start session"); if (!f) return;
    const recap = (f.recap || "").trim();
    if (recap && recap !== recapText) await recapPage.update({ "text.content": `<h2>Last Session Recap</h2>${recap.split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join("")}` });
    const s = game.scenes.get(f.scene); if (f.activate && s) await s.activate();
    if (f.post && recap) await this.say(`<h3>Previously, in ${esc(this.campaign())}…</h3>${recap.split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join("")}`, "Narrator");
    if (f.unpause && game.paused) game.togglePause(false, { broadcast: true });
    await this.appendPage("Travel Log", `<p><strong>Session started</strong> at ${this.stamp()}${s ? ` on ${esc(s.name)}` : ""}.</p>`);
  }
};

Hooks.once("init", () => {
  registerSettings(); applyCoinSystem();
  Health.init(WCT);
  if (F.on("characterPane")) { Pane.registerHooks(); Pane.patchArmorClass(); }
  if (F.on("questLog")) Quests.init(WCT, { tracker: F.on("questTracker") });
  if (F.on("flightMaster")) registerFlightHooks();
  if (F.on("vendorTrash")) registerTrashHooks();
  if (F.on("bossFrames")) Bosses.init();
  if (F.on("lootRolls")) Loot.init();
  // After Vendor Trash's hooks, so a body gets its trash before its boss loot joins it in the same pile.
  if (F.on("bossLoot")) BossLoot.init(WCT, { vendorTrash: F.on("vendorTrash") });
  // Feature settings submenus last, once every setting they list is registered.
  Menus.registerMenus();
});
Hooks.once("ready", () => {
  const mod = game.modules.get(ID); mod.api = WCT;
  globalThis.WCT = WCT; // lets world macros written for the library version keep working
  if (F.on("flightMaster")) {
    game.socket.on(SOCKET, async (msg, senderId) => {
      if (msg?.action === "flightResult") {
        if (msg.userId === game.user.id && typeof msg.text === "string") ui.notifications[msg.ok ? "info" : "warn"](`Flight Master: ${msg.text.slice(0, 300)}`);
        return;
      }
      if (msg?.action !== "flight" || !isActiveGM()) return;
      const uid = typeof senderId === "string" && game.users.has(senderId) ? senderId : msg.userId;
      if (!setting("playerFlights")) return WCT.tellFlight(uid, false, "players can't book flights in this world.");
      try { await WCT.doFlight({ from: msg.from, to: msg.to, pax: msg.pax, userId: uid, scene: true }); }
      catch (e) { console.error(`${ID} | player flight failed`, e); ui.notifications.error(`Wayfarer's Toolkit: a player's flight failed (${e.message}).`); WCT.tellFlight(uid, false, `the flight failed (${e.message}).`); }
    });
    WCT.syncFlightCache();
  }
  if (F.on("questLog")) Quests.ready();
  if (F.on("lootRolls")) Loot.ready();
  if (F.on("hexTravel") && isActiveGM()) checkZones(setting("zones"), { notify: true });
  convertOldCoins();
  Health.remindSetup(WCT).catch(e => console.warn(`${ID} | setup reminder`, e));
  console.log(`${ID} | ready (v${mod.version}; features off: ${F.FEATURES.filter(f => !F.on(f.id)).map(f => f.id).join(", ") || "none"})`);
});

// Item Piles applies its system defaults shortly after its own ready hook; set the three-coin currencies after that.
Hooks.once("item-piles-ready", () => setTimeout(() => syncItemPilesCoins(), 2000));

function registerFlightHooks() {
  // Keep the players' copy of the flight routes current whenever the GM edits the Flight Routes page.
  const routesPage = p => p?.name === "Flight Routes" && p.parent?.name === WCT.JOURNAL;
  Hooks.on("updateJournalEntryPage", p => { if (routesPage(p)) WCT.syncFlightCache(); });
  Hooks.on("createJournalEntryPage", p => { if (routesPage(p)) WCT.syncFlightCache(); });
  // Flight points name scenes; keep the players' copy right about which ones exist.
  Hooks.on("createScene", () => WCT.syncFlightCache());
  Hooks.on("deleteScene", () => WCT.syncFlightCache());
  Hooks.on("updateScene", (s, changes) => { if ("name" in (changes ?? {})) WCT.syncFlightCache(); });
  // Flight Master button in the token controls, for the GM and (when allowed) players.
  Hooks.on("getSceneControlButtons", controls => {
    const tokens = controls.tokens ?? controls.token; if (!tokens?.tools) return;
    if (!game.user.isGM && !game.settings.get(ID, "playerFlights")) return;
    tokens.tools.wctFlight = { name: "wctFlight", title: "Flight Master", icon: "fa-solid fa-feather-pointed", order: 99, button: true, visible: true, onChange: () => WCT.flight() };
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
