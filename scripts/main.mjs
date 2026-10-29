/**
 * Wayfarer's Toolkit
 * Hex travel, flight routes, a session-start helper, vendor trash, a character pane and a quest log.
 * Each tool is a feature that can be turned off (features.mjs); turned-off tools register nothing.
 * for Foundry VTT (dnd5e). Campaign content (tables, journals, routes) lives in each world; this module is the logic.
 */
import * as Trash from "./trash.mjs";
import * as Pane from "./pane.mjs";
import * as Quests from "./quests.mjs";
import * as F from "./features.mjs";

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
  riderFeat: "Trained Rider"
};
const SOCKET = `module.${ID}`;
/** The preferred hotbar slot if it's free, else the first free slot from 1 to 50. */
const freeSlot = (bar = {}, pref = null) => (pref && !bar[pref]) ? pref : Array.from({ length: 50 }, (_, i) => i + 1).find(i => !bar[i]) ?? null;

// ---------------------------------------------------------------- coins
/** Three-coin economy: copper, silver and gold only, 100 copper to the silver and 100 silver to the gold. Applied at init, before any sheet renders. */
function applyCoinSystem() {
  if (setting("coinSystem") !== "threeCoin") return;
  const C = CONFIG.DND5E?.currencies; if (!C?.gp || !C?.sp || !C?.cp) return console.warn(`${ID} | dnd5e currencies not found; three-coin economy not applied`);
  C.gp.conversion = 1; C.sp.conversion = 100; C.cp.conversion = 10000;
  C.gp.abbreviation = "g"; C.sp.abbreviation = "s"; C.cp.abbreviation = "c";
  delete C.pp; delete C.ep;
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

/** Item Piles' currency list for the three-coin economy: gold is primary, silver and copper are worth 1/100 and 1/10000 of it. */
const IP_COINS = [
  ["gp", "DND5E.CurrencyGP", "{#}g", 1, true, "icons/commodities/currency/coin-embossed-crown-gold.webp"],
  ["sp", "DND5E.CurrencySP", "{#}s", 0.01, false, "icons/commodities/currency/coin-engraved-moon-silver.webp"],
  ["cp", "DND5E.CurrencyCP", "{#}c", 0.0001, false, "icons/commodities/currency/coin-engraved-waves-copper.webp"]
].map(([k, name, abbreviation, exchangeRate, primary, img]) => ({ type: "attribute", name, img, abbreviation, data: { path: `system.currency.${k}` }, primary, exchangeRate }));
/** Keeps Item Piles' currencies in step with the three-coin economy (GM side, only once Item Piles is set up for the system). */
async function syncItemPilesCoins() {
  if (!game.users.activeGM?.isSelf || setting("coinSystem") !== "threeCoin" || !setting("itemPilesCoins")) return;
  const IP = game.modules.get("item-piles")?.active ? game.itempiles?.API : null;
  if (!IP?.setCurrencies || !IP.ITEM_QUANTITY_ATTRIBUTE) return;
  const cur = IP.CURRENCIES ?? [];
  const same = cur.length === IP_COINS.length && IP_COINS.every(w => cur.some(c => c.data?.path === w.data.path && Math.abs((c.exchangeRate ?? 0) - w.exchangeRate) < 1e-9 && !!c.primary === w.primary));
  if (same) return;
  try { await IP.setCurrencies(foundry.utils.deepClone(IP_COINS)); WCT.gmWhisper("<p><strong>Three-coin economy:</strong> Item Piles' currencies set to gold, silver and copper at 100 to 1.</p>"); }
  catch (e) { console.warn(`${ID} | couldn't set Item Piles currencies`, e); }
}

function registerSettings() {
  F.registerSettings();
  // Settings that belong to a turned-off feature stay registered (so nothing breaks) but are left out of the settings list.
  const s = (key, name, hint, type, extra = {}, feature = null) => game.settings.register(ID, key, { name, hint, scope: "world", config: feature ? F.on(feature) : true, type, default: DEFAULTS[key], ...extra });
  s("campaignName", "Campaign name", "Used in the Session Start recap (\"Previously, in …\"). Leave blank to use the world title.", String);
  s("trackerJournal", "Tracker journal", "Journal holding the Travel Log, Flight Routes and Session Recap pages.", String);
  s("partyActor", "Party actor", "Group actor whose purse pays flight fares and whose members count as passengers.", String);
  s("zones", "Encounter zones", "JSON object mapping zone name to encounter roll table name.", String, {}, "hexTravel");
  s("encounterDie", "Encounter die", "Each off-road hex rolls this die; a 1 is an encounter.", Number, {}, "hexTravel");
  s("offroadMult", "Off-road time multiplier", "Off-road hexes take this many times as long as road hexes.", Number, {}, "hexTravel");
  s("mountMult", "Mounted speed multiplier", "Overland speed multiplier when the party travels mounted.", Number, {}, "hexTravel");
  s("paceSlow", "Slow pace (mph)", "", Number, {}, "hexTravel");
  s("paceNormal", "Normal pace (mph)", "", Number, {}, "hexTravel");
  s("paceFast", "Fast pace (mph)", "", Number, {}, "hexTravel");
  s("hiddenScenes", "Scenes hidden from Session Start", "Regular expression; matching scene names are left out of the list.", String, {}, "sessionStart");
  s("playerFlights", "Players can use Flight Master", "Players get a Flight Master button in the token controls and can book flights themselves. A GM must be logged in; the fare comes out of the party purse.", Boolean, { onChange: () => ui.controls?.render?.({ reset: true }) }, "flightMaster");
  s("flightSound", "Flight sound", "Audio file played for everyone when a flight departs. Defaults to the bundled departure clip; clear it for no sound.", String, { filePicker: "audio" }, "flightMaster");
  s("flightVolume", "Flight sound volume", "", Number, { range: { min: 0, max: 1, step: 0.05 } }, "flightMaster");
  s("coinSystem", "Coin system", "Three coins replaces dnd5e's five with copper, silver and gold at 100 to 1, as in classic MMOs. Reloads Foundry. Item prices are not changed. See the README before switching.", String, { choices: { standard: "Standard 5e (cp, sp, ep, gp, pp)", threeCoin: "Three coins: copper, silver, gold (100 to 1)" }, requiresReload: true });
  s("fareUnit", "Fare unit", "Coin used for fares written as plain numbers in the Flight Routes table. Fares can also be written with coins, like 1g 20s or 50c.", String, { choices: { gp: "Gold", sp: "Silver", cp: "Copper" } });
  s("riderFeat", "Riding feat name", "Hex Travel ticks Mounted automatically when every party member has this feat (Long Road). Setup creates a feat with this name.", String, {}, "riderFeat");
  s("trashItemPiles", "Vendor Trash uses Item Piles", "When Item Piles is active and set up for your system, Vendor Trash puts the loot on each defeated creature and turns its token into a lootable pile. Off, or without Item Piles, the GM gets a loot card with a Give to Party button.", Boolean, {}, "vendorTrash");
  s("itemPilesCoins", "Set Item Piles coins for three coins", "With the three-coin economy on, sets Item Piles' currencies to gold, silver and copper at 100 to 1 (no platinum or electrum) each time the world loads. Turn off to manage Item Piles' currencies yourself.", Boolean);
  s("trashPacks", "Vendor trash compendiums", "Item compendium IDs to draw vendor trash from, separated by commas. Leave blank to use the wow-classic-items module's compendium (wow-classic-items.items) when it's installed. Grey items are trash; in other compendiums, loot items with no rarity are.", String, { onChange: () => Trash.resetPool() }, "vendorTrash");
  game.settings.register(ID, "flightCache", { scope: "world", config: false, type: Object, default: { pts: [], routes: [] } });
  game.settings.registerMenu(ID, "setup", { name: "Set up this world", label: "Run setup", hint: "Creates the tracker journal, party actor and hotbar macros if they don't exist yet. Safe to run again.", icon: "fas fa-hammer", type: SetupApp, restricted: true });
}

class SetupApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { id: `${ID}-setup`, window: { title: "Wayfarer's Toolkit · Setup" }, position: { width: 420 } };
  async _renderHTML() {
    const div = document.createElement("div");
    div.innerHTML = `<p>This creates anything that's missing for the features turned on:</p><ul><li>the tracker journal (<em>${esc(setting("trackerJournal"))}</em>)</li><li>the party actor (<em>${esc(setting("partyActor"))}</em>)</li><li>a <em>Wayfarer's Toolkit</em> macro folder, with the macros on empty hotbar slots</li>${F.on("riderFeat") ? "<li>the Trained Rider feat</li>" : ""}</ul><p>Nothing existing is overwritten or deleted.</p><button type="button" data-action="run"><i class="fas fa-hammer"></i> Run setup</button>`;
    div.querySelector("[data-action=run]").addEventListener("click", async () => { const r = await WCT.setup(); ui.notifications.info(`Wayfarer's Toolkit: ${r.length ? "created " + r.join(", ") : "everything already exists"}.`); this.close(); });
    return div;
  }
  _replaceHTML(result, content) { content.replaceChildren(result); }
}

/** [name, API method, icon, preferred hotbar slot, feature, shared with players] */
const MACROS = [
  ["Hex Travel", "hexTravel", "icons/environment/wilderness/terrain-forest-gray.webp", 2, "hexTravel"],
  ["Flight Master", "flight", "icons/creatures/birds/raptor-hawk-flying.webp", 3, "flightMaster"],
  ["Session Start", "sessionStart", "icons/sundries/books/book-open-turquoise.webp", 5, "sessionStart"],
  ["Vendor Trash", "vendorTrash", "icons/containers/bags/sack-simple-leather-brown.webp", null, "vendorTrash"],
  ["Sell Vendor Trash", "sellTrash", "icons/commodities/currency/coins-assorted-mix-copper-silver-gold.webp", null, "vendorTrash"],
  ["Quest Log", "questLog", "icons/sundries/scrolls/scroll-bound-sealed-red-tan.webp", null, "questLog", true]
];

const RIDER_FEAT = name => ({
  name, type: "feat", img: "icons/environment/creatures/horse-brown.webp",
  flags: { [ID]: { feat: "trained-rider" } },
  system: {
    type: { value: "feat", subtype: "general" },
    requirements: "",
    source: { book: "Wayfarer's Toolkit", custom: "Wayfarer's Toolkit" },
    description: { value: `<p><em>General Feat</em></p><p>You've learned to ride properly, not just to stay on.</p><p><strong>Swift Mount.</strong> Mounting or dismounting a creature costs you only 5 feet of movement, rather than half your Speed.</p><p><strong>Long Road.</strong> When every member of your party has this feat and all of you are mounted, the party travels overland at mounted speed.</p>` }
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
  get ZONES() { try { return JSON.parse(setting("zones") || "{}"); } catch (e) { ui.notifications.error("Wayfarer's Toolkit: the Encounter zones setting isn't valid JSON."); return {}; } },
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
  form(title, content, label = "OK") { return foundry.applications.api.DialogV2.prompt({ window: { title }, content, position: { width: 460 }, ok: { label, callback: (ev, btn) => new foundry.applications.ux.FormDataExtended(btn.form).object }, rejectClose: false }); },
  confirm(title, content) { return foundry.applications.api.DialogV2.confirm({ window: { title }, content, rejectClose: false }); },
  gmOnly() { if (!game.user.isGM) { ui.notifications.warn("GM only."); return false; } return true; },
  opt(v, label, sel) { return `<option value="${esc(v)}" ${sel ? "selected" : ""}>${esc(label ?? v)}</option>`; },
  campaign() { return setting("campaignName") || game.world.title; },
  trackerPages() { return { ...TRACKER_PAGES }; },

  // ------------------------------------------------------------ setup
  async setup() {
    if (!this.gmOnly()) return [];
    const made = [];
    const needJournal = ["hexTravel", "flightMaster", "sessionStart"].some(F.on);
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
    // All missing macros in one create, then one hotbar update.
    const want = MACROS.filter(([name, , , , feature]) => F.on(feature) && !game.macros.getName(name));
    if (want.length) {
      const folder = game.folders.find(f => f.type === "Macro" && f.name === "Wayfarer's Toolkit") ?? await Folder.create({ name: "Wayfarer's Toolkit", type: "Macro", sorting: "m" });
      const created = await Macro.implementation.createDocuments(want.map(([name, fn, img, , , shared]) => ({ name, type: "script", img, folder: folder.id, command: `// ${name}: Wayfarer's Toolkit\nreturn game.modules.get("${ID}")?.api?.${fn}() ?? ui.notifications.error("Wayfarer's Toolkit module is not active.");`, ...(shared ? { ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER } } : {}) })));
      const bar = { ...game.user.hotbar }; const patch = {};
      created.forEach((m, i) => { const free = freeSlot(bar, want[i][3]); if (free) { bar[free] = patch[`hotbar.${free}`] = m.id; } made.push(`macro "${m.name}"`); });
      if (Object.keys(patch).length) await game.user.update(patch);
    }
    if (F.on("riderFeat") && !game.items.find(i => i.getFlag(ID, "feat") === "trained-rider")) {
      let ifolder = game.folders.find(f => f.type === "Item" && f.name === "Wayfarer's Toolkit");
      ifolder ??= await Folder.create({ name: "Wayfarer's Toolkit", type: "Item" });
      await Item.create({ ...RIDER_FEAT(setting("riderFeat") || "Trained Rider"), folder: ifolder.id, ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER } });
      made.push(`feat "${setting("riderFeat") || "Trained Rider"}"`);
    }
    if (F.on("flightMaster") && setting("playerFlights")) made.push(...await this.shareFlightMacro());
    return made;
  },
  /** Lets players see the Flight Master macro and puts it on their hotbars (slot 3, or the first free slot). */
  async shareFlightMacro() {
    if (!this.gmOnly()) return [];
    const m = game.macros.getName("Flight Master"); if (!m) return [];
    const done = []; const OBS = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
    if ((m.ownership.default ?? 0) < OBS) { await m.update({ "ownership.default": OBS }); done.push("Flight Master shared with players"); }
    const updates = [];
    for (const u of game.users.filter(u => !u.isGM)) {
      if (Object.values(u.hotbar ?? {}).includes(m.id)) continue;
      const slot = freeSlot(u.hotbar, 3);
      if (slot) { updates.push({ _id: u.id, [`hotbar.${slot}`]: m.id }); done.push(`Flight Master on ${u.name}'s hotbar`); }
    }
    if (updates.length) await User.implementation.updateDocuments(updates);
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
      ${riders.members ? `<p class="hint">${riders.untrained.length ? `Long Road: not trained to ride yet: ${riders.untrained.map(esc).join(", ")}.` : `Long Road: every party member has ${esc(setting("riderFeat"))}.`}</p>` : ""}`;
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
    const pts = this.parseTable(html, 0).map(([n, sc, u]) => ({ n, sc, u: /^y/i.test(u || "") }));
    const routes = this.parseTable(html, 1).map(([a, b, f, h]) => ({ a, b, f: parseMoney(f), h: +h || 0 }));
    return { pts, routes };
  },
  async syncFlightCache() {
    if (!game.users.activeGM?.isSelf) return;
    let data; try { data = this.flightData(); } catch { return; }
    const old = game.settings.get(ID, "flightCache");
    if (JSON.stringify(old) !== JSON.stringify(data)) await game.settings.set(ID, "flightCache", data);
  },
  route(from, to, open, routes) {
    const ok = new Set(open); const dist = { [from]: { f: 0, h: 0, path: [from] } }; const done = new Set();
    while (true) {
      const cur = Object.keys(dist).filter(k => !done.has(k)).sort((x, y) => dist[x].f - dist[y].f)[0];
      if (!cur) return null; if (cur === to) return dist[cur]; done.add(cur);
      for (const r of routes) {
        const nb = r.a === cur ? r.b : r.b === cur ? r.a : null; if (!nb || !ok.has(nb) || done.has(nb)) continue;
        const nf = dist[cur].f + r.f; if (!dist[nb] || nf < dist[nb].f) dist[nb] = { f: nf, h: dist[cur].h + r.h, path: [...dist[cur].path, nb] };
      }
    }
  },
  partyActor() { return game.actors.find(a => a.type === "group" && a.name === this.PARTY); },
  playFlightSound() {
    const src = setting("flightSound"); if (!src) return;
    foundry.audio.AudioHelper.play({ src, volume: setting("flightVolume") ?? 0.8, autoplay: true, loop: false }, true);
  },
  /** Opens Flight Master. The GM flies the party directly; a player's booking is sent to the GM's client, which carries it out. */
  async flight() {
    if (!F.need("flightMaster")) return;
    const gm = game.user.isGM;
    if (!gm && !setting("playerFlights")) return ui.notifications.warn("Flight Master is GM only in this world.");
    if (!gm && !game.users.activeGM) return ui.notifications.warn("The flight master is waiting for a GM: one needs to be logged in to book a flight.");
    const { pts, routes } = this.flightData(); const open = pts.filter(p => p.u).map(p => p.n);
    if (open.length < 2) return ui.notifications.warn(gm ? `Fewer than two flight points are unlocked. Mark them yes in ${this.JOURNAL} › Flight Routes.` : "There are no flight paths open yet.");
    const party = this.partyActor();
    const members = party?.system.members?.length || 0;
    const here = pts.find(p => p.u && p.sc && p.sc === canvas.scene?.name)?.n ?? open[0];
    const content = `<div class="form-group"><label>From</label><select name="from">${open.map(n => this.opt(n, n, n === here)).join("")}</select></div>
      <div class="form-group"><label>To</label><select name="to">${open.map(n => this.opt(n, n, n !== here && n === open.find(x => x !== here))).join("")}</select></div>
      <div class="form-group"><label>Passengers</label><input type="number" name="pax" min="1" max="20" value="${members || 4}"></div>
      ${gm ? `<div class="form-group"><label>Open destination scene for players</label><input type="checkbox" name="scene" checked></div>` : ""}
      <p class="hint">${gm ? `Fares and routes come from ${esc(this.JOURNAL)} › Flight Routes. ` : "Fares are paid from the party purse. "}${party ? `Party purse: ${this.purse(party)}.` : gm ? `No group actor named ${esc(this.PARTY)}; fares won't be deducted.` : ""}</p>`;
    const f = await this.form("Flight Master", content, "Check route"); if (!f) return;
    if (f.from === f.to) return ui.notifications.warn("Pick two different flight points.");
    const r = this.route(f.from, f.to, open, routes);
    if (!r) return ui.notifications.warn(`No route between ${f.from} and ${f.to} through open flight points.`);
    const pax = Math.min(20, Math.max(1, Math.floor(+f.pax || 1))); const fare = r.f * pax;
    const canPay = party ? this.totalMoney(party) >= fare : false;
    const path = `<p><strong>${r.path.map(esc).join(" → ")}</strong></p><p>${r.h} hours · ${fmtMoney(r.f)} each × ${pax} = <strong>${fmtMoney(fare)}</strong></p>`;
    if (!gm) {
      if (party && !canPay) return foundry.applications.api.DialogV2.prompt({ window: { title: "Flight Master" }, content: `${path}<p><strong>The party can't afford this flight</strong> (purse: ${this.purse(party)}).</p>`, rejectClose: false });
      const go = await this.confirm("Flight Master", `${path}${party ? `<p>Paid from the party purse (${this.purse(party)}).</p>` : ""}<p>Book this flight?</p>`);
      if (!go) return;
      game.socket.emit(SOCKET, { action: "flight", from: f.from, to: f.to, pax, userId: game.user.id });
      ui.notifications.info("Flight booked. Mount up!");
      return r;
    }
    const go = await this.confirm("Flight Master", `${path}${party ? (canPay ? `<p>Party purse: ${this.purse(party)}.</p>` : `<p><strong>The party can't afford this</strong> (${this.purse(party)}). Fly anyway without charging?</p>`) : ""}`);
    if (!go) return;
    return this.doFlight({ from: f.from, to: f.to, pax, scene: !!f.scene });
  },
  /** Carries out a flight on the GM's client: fare, sound, time, log, chat, scene. Re-checks the route so a player's request can't set its own price. */
  async doFlight({ from, to, pax, scene = true, userId = null }) {
    const { pts, routes } = this.flightData(); const open = pts.filter(p => p.u).map(p => p.n);
    const by = userId ? game.users.get(userId) : null;
    const r = (open.includes(from) && open.includes(to) && from !== to) ? this.route(from, to, open, routes) : null;
    if (!r) { if (by) await this.gmWhisper(`<p>${esc(by.name)} tried to book a flight from ${esc(from)} to ${esc(to)}, but there's no open route.</p>`); return null; }
    pax = Math.min(20, Math.max(1, Math.floor(+pax || 1))); const fare = r.f * pax;
    const party = this.partyActor(); const canPay = party ? this.totalMoney(party) >= fare : false;
    if (by && party && !canPay) { await this.gmWhisper(`<p>${esc(by.name)} tried to book ${esc(from)} → ${esc(to)} (${fmtMoney(fare)}), but the party can't afford it.</p>`); return null; }
    if (party && canPay) await this.pay(party, fare);
    this.playFlightSound();
    await game.time.advance(Math.round(r.h * 3600));
    await this.appendPage("Travel Log", `<p><strong>Flight.</strong> ${r.path.map(esc).join(" → ")}, ${r.h} h, ${fmtMoney(fare)}${party && !canPay ? " (not charged)" : ""}${by ? `, booked by ${esc(by.name)}` : ""}. Arrived ${this.stamp()}.</p>`);
    await this.say(`<p><em>The party flies from ${esc(from)} to ${esc(to)}${r.path.length > 2 ? ` by way of ${r.path.slice(1, -1).map(esc).join(", ")}` : ""}. ${r.h} hours in the air.</em></p><p>Fare: ${fmtMoney(fare)}${party && !canPay ? " (owed)" : ""}.</p>`, "Flight Master");
    const dest = pts.find(p => p.n === to); const sc = dest?.sc ? game.scenes.getName(dest.sc) : null;
    if (scene && sc) await sc.activate();
    return r;
  },
  /** Long Road: which party members lack the riding feat (matched by the feat's flag or its name). */
  riders() {
    if (!F.on("riderFeat")) return { members: 0, untrained: [] };
    const party = this.partyActor(); const featName = (setting("riderFeat") || "").toLowerCase();
    const members = (party?.system.members ?? []).map(m => m.actor ?? m).filter(a => a?.items);
    const has = a => a.items.some(i => i.type === "feat" && (i.getFlag(ID, "feat") === "trained-rider" || i.name.toLowerCase() === featName));
    return { members: members.length, untrained: members.filter(a => !has(a)).map(a => a.name) };
  },

  // ------------------------------------------------------------ vendor trash
  vendorTrash(tokens) { return F.need("vendorTrash") ? Trash.vendorTrash(this, tokens) : undefined; },
  sellTrash(actor) { return F.need("vendorTrash") ? Trash.sellTrash(this, actor) : undefined; },
  syncItemPilesCoins,
  trash: Trash,

  // ------------------------------------------------------------ character pane
  characterPane(actor) { return F.need("characterPane") ? Pane.characterPane(actor) : undefined; },
  pane: Pane,

  // ------------------------------------------------------------ quest log
  /** Opens the quest log, optionally on one quest. */
  questLog(quest) { return F.need("questLog") ? Quests.open(quest) : undefined; },
  /** Quest API (create, activate, complete, fail, tickObjective, open…); undefined when the quest log is off. */
  get quests() { return F.on("questLog") ? Quests.api : undefined; },

  // ------------------------------------------------------------ features
  features: F,

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
  if (F.on("characterPane")) { Pane.registerHooks(); Pane.patchArmorClass(); }
  if (F.on("questLog")) Quests.init(WCT, { tracker: F.on("questTracker") });
  if (F.on("flightMaster")) registerFlightHooks();
  if (F.on("vendorTrash")) registerTrashHooks();
});
Hooks.once("ready", () => {
  const mod = game.modules.get(ID); mod.api = WCT;
  globalThis.WCT = WCT; // lets world macros written for the library version keep working
  if (F.on("flightMaster")) {
    game.socket.on(SOCKET, async msg => {
      if (msg?.action !== "flight" || !game.users.activeGM?.isSelf) return;
      if (!setting("playerFlights")) return;
      try { await WCT.doFlight({ from: msg.from, to: msg.to, pax: msg.pax, userId: msg.userId, scene: true }); }
      catch (e) { console.error(`${ID} | player flight failed`, e); ui.notifications.error(`Wayfarer's Toolkit: a player's flight failed (${e.message}).`); }
    });
    WCT.syncFlightCache();
  }
  if (F.on("questLog")) Quests.ready();
  if (game.user.isGM && setting("coinSystem") === "threeCoin") {
    const stray = game.actors.filter(a => a.system.currency && (a.system.currency.pp || a.system.currency.ep)).map(a => a.name);
    if (stray.length) WCT.gmWhisper(`<p><strong>Three-coin economy:</strong> these actors still hold platinum or electrum, which no longer counts: ${stray.map(esc).join(", ")}. Switch back to Standard, convert or clear those coins, then switch again.</p>`);
  }
  console.log(`${ID} | ready (v${mod.version}; features off: ${F.FEATURES.filter(f => !F.on(f.id)).map(f => f.id).join(", ") || "none"})`);
});

// Item Piles applies its system defaults shortly after its own ready hook; set the three-coin currencies after that.
Hooks.once("item-piles-ready", () => setTimeout(() => syncItemPilesCoins(), 2000));

function registerFlightHooks() {
  // Keep the players' copy of the flight routes current whenever the GM edits the Flight Routes page.
  const routesPage = p => p?.name === "Flight Routes" && p.parent?.name === WCT.JOURNAL;
  Hooks.on("updateJournalEntryPage", p => { if (routesPage(p)) WCT.syncFlightCache(); });
  Hooks.on("createJournalEntryPage", p => { if (routesPage(p)) WCT.syncFlightCache(); });
  // Flight Master button in the token controls, for the GM and (when allowed) players.
  Hooks.on("getSceneControlButtons", controls => {
    const tokens = controls.tokens ?? controls.token; if (!tokens?.tools) return;
    if (!game.user.isGM && !game.settings.get(ID, "playerFlights")) return;
    tokens.tools.wctFlight = { name: "wctFlight", title: "Flight Master", icon: "fa-solid fa-feather-pointed", order: 99, button: true, visible: true, onChange: () => WCT.flight() };
  });
}

function registerTrashHooks() {
  // Vendor Trash loot cards: the Give to Party button (GM only).
  Hooks.on("renderChatMessageHTML", (message, html) => {
    if (!message.flags?.[ID]?.trash) return;
    const btn = html.querySelector?.("[data-wct-action=give-trash]"); if (!btn) return;
    if (!game.user.isGM) return btn.remove();
    if (message.getFlag(ID, "trash")?.given) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-check"></i> Given to party'; return; }
    btn.addEventListener("click", async ev => { ev.preventDefault(); btn.disabled = true; try { await Trash.giveTrash(message, WCT); } catch (e) { btn.disabled = false; ui.notifications.error(`Vendor Trash: ${e.message}`); } });
  });
}
