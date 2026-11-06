/**
 * Health check. The health check reads the world and reports; it never changes anything and never throws
 * (each check is wrapped, and a check that fails shows as its own ✗ line). The GM sees it summed up in the control panel's Overview tab, or posts it from there (Full health report),
 * the Toolkit Health Check macro or api.health(). (The once-per-version setup reminder is now part of the update notes, updates.mjs.)
 */
import * as F from "./features.mjs";
import * as Trash from "./trash.mjs";
import * as BossLoot from "./bossloot.mjs";
import { activeGM, onlineGMs, sessionInfo } from "./gm.mjs";
import { MACROS, macroOn } from "./macros.mjs";
import * as Updates from "./updates.mjs";
import * as Flight from "./flight.mjs";
import * as History from "./history.mjs";
import { phasesOf } from "./bosses.mjs";
import * as Perm from "./permissions.mjs";
import * as Quests from "./quests.mjs";
import * as Pins from "./pins.mjs";
import * as Vault from "./vault.mjs";
import * as Migrate from "./migrate.mjs";
import * as Card from "./health-card-model.mjs";
import { CORE_VERSION, UI_CLASSES, healthCollector, plain } from "../vendor/wanderers-core/index.mjs";
import { sceneTab, fileInDataFolder } from "../vendor/wanderers-core/foundry/index.mjs";
import { remembered } from "./windows.mjs";
import * as Cards from "./chat-cards.mjs";
import * as Sheet from "./sheet.mjs";
import * as SM from "./sheet-model.mjs";
import * as Rounding from "./rounding.mjs";
import * as RM from "./rounding-model.mjs";
import * as Renown from "./renown.mjs";
import * as RN from "./renown-model.mjs";

const ID = "wayfarers-toolkit";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/**
 * One line. `fix` (1.30, core 0.5.0's contract, read by the Wanderer's Satchel): `{ label, run, confirm? }`, a safe one-click repair
 * offered as a Fix button in the Satchel and in the control panel's Overview. Anything that changes data has a `confirm` text.
 * The HTML card and window ignore it; healthReport() passes it through (core's healthLine/readFix).
 * @param {string} level @param {string} text @param {{ label: string, run: () => any, confirm?: string }} [fix]
 */
const line = (level, text, fix) => (fix ? { level, text, fix } : { level, text });
const ok = t => line("ok", t), warn = (t, fix) => line("warn", t, fix), bad = (t, fix) => line("bad", t, fix), off = t => line("off", t);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const modActive = id => !!game.modules.get(id)?.active;
const gmIds = () => game.users.filter(u => u.isGM).map(u => u.id);
const listNames = (arr, n = 8) => arr.slice(0, n).map(esc).join(", ") + (arr.length > n ? `, and ${arr.length - n} more` : "");

/** Every token on every scene, with its scene. */
function* allTokens() { for (const s of game.scenes) for (const t of s.tokens) yield t; }

// ---------------------------------------------------------------- checks (each returns lines; HTML-safe text)
function features() {
  return F.FEATURES.map(f => F.on(f.id) ? ok(`${esc(f.label)}: on`) : off(`${esc(f.label)}: off`));
}

function dependencies(api) {
  const out = [];
  const wantPiles = ["vendorTrash", "bossLoot", "lootRolls"].some(F.on);
  const ip = modActive("item-piles");
  if (wantPiles) {
    if (ip) out.push(ok("Item Piles is active."));
    else out.push(F.on("lootRolls") ? warn("Item Piles isn't active: Loot rolls do nothing, and loot goes on Give to Party cards instead of bodies.") : warn("Item Piles isn't active: loot goes on Give to Party cards instead of lootable bodies."));
    if (ip) out.push(modActive("itempilesdnd5e") ? ok("Item Piles: D&D 5e is active.") : bad("Item Piles is active but Item Piles: D&D 5e isn't: piles can't read dnd5e items or coins."));
    if (ip && !Trash.itemPiles()) out.push(warn("Item Piles isn't set up for this system yet (no quantity attribute)."));
  } else out.push(off("Item Piles: not needed by the features turned on."));
  if (F.on("vendorTrash")) {
    const ids = Trash.packIds(); const found = ids.filter(id => game.packs.get(id)?.documentName === "Item"); const lost = ids.filter(id => !found.includes(id));
    if (modActive("wow-classic-items")) out.push(ok("wow-classic-items is active."));
    if (!ids.length) out.push(bad("Vendor Trash has no item compendium: install the wow-classic-items module or pick compendiums in the control panel (Loot › Advanced)."));
    else if (!found.length) out.push(bad(`Vendor trash compendiums not found: ${listNames(lost)}.`));
    else out.push(lost.length ? warn(`Vendor trash compendiums: ${listNames(found)} found; missing ${listNames(lost)}.`) : ok(`Vendor trash compendiums: ${listNames(found)}.`));
  } else out.push(off("Vendor trash compendiums: Vendor Trash is off."));
  out.push(...coins(api));
  return out;
}

function coins(api) {
  const out = []; const mode = game.settings.get(ID, "coinSystem");
  const keys = Object.keys(CONFIG.DND5E?.currencies ?? {});
  if (mode === "threeCoin") {
    const three = keys.length === 3 && ["cp", "sp", "gp"].every(k => keys.includes(k));
    out.push(three ? ok("Three-coin economy: dnd5e shows copper, silver and gold.") : bad(`Three-coin economy is set, but dnd5e's coins are ${keys.join(", ")}. Reload Foundry.`));
    const stray = game.actors.filter(a => { const c = a._source?.system?.currency; return c && (c.pp > 0 || c.ep > 0); }).map(a => a.name);
    if (stray.length) out.push(warn(`Platinum or electrum still stored on ${listNames(stray)} (converted on the next load or Run setup).`));
    const m = api.internals.ipCoinsMatch();
    if (m === null) { if (modActive("item-piles")) out.push(warn("Item Piles' currencies can't be checked (Item Piles isn't set up for this system).")); }
    else if (m) out.push(ok("Item Piles' currencies match the three coins."));
    else out.push(game.settings.get(ID, "itemPilesCoins") ? warn("Item Piles' currencies don't match the three coins yet (set on the next load).") : warn("Item Piles' currencies don't match the three coins (Set Item Piles coins for three coins is off)."));
  } else {
    const five = ["cp", "sp", "gp"].every(k => keys.includes(k));
    out.push(five ? ok(`Standard 5e coins (${keys.join(", ")}).`) : warn(`Standard coins set, but dnd5e's coins are ${keys.join(", ")}.`));
  }
  return out;
}

function setupState(api) {
  const plan = api.setupPlan();
  if (!plan.length) return [off("Nothing to set up for the features turned on.")];
  return plan.map(p => p.ok ? ok(`${esc(p.label)}`) : bad(`${esc(p.label)}: missing`, FIXES.setup(api)));
}

async function bossLoot(api) {
  if (!F.on("bossLoot")) return [off("Boss loot is off.")];
  const out = []; const targets = []; const cpVal = Object.fromEntries(api.coins()).cp ?? 1;
  for (const a of game.actors) if (a.getFlag(ID, "bossLoot")) targets.push({ label: a.name, ref: a, noLoot: Trash.isNoLoot(a) });
  for (const t of allTokens()) {
    try { if (!t.actorLink && t.delta?._source?.flags?.[ID]?.bossLoot && t.actor) targets.push({ label: `${t.name} (token on ${t.parent.name})`, ref: t, noLoot: Trash.isNoLoot(t) }); } catch { }
  }
  const pr = BossLoot.partyRules();
  const unlinked = game.actors.filter(a => a.type === "npc" && !a.getFlag(ID, "bossLoot") && game.tables.some(t => BossLoot.tableOwnerName(t.name) === a.name.trim())).map(a => a.name);
  const linkLine = unlinked.length ? [warn(`${plural(unlinked.length, "creature")} with a table named for it but not linked (${listNames(unlinked, 6)}). <button type="button" data-wct-action="autolink-boss" style="width:auto;line-height:1.4;padding:0 0.4em;"><i class="fa-solid fa-link"></i> Link boss tables by name</button>`, FIXES.autolink(api))] : [];
  out.push(ok(`Party size ${pr.size}: boss coin ×${(pr.size / 4).toFixed(2).replace(/\.?0+$/, "")}${pr.size > 4 ? (pr.extra ? ", +1 draw for bosses with 3 or more" : ", no extra draw (setting off)") : ""}.`));
  if (!targets.length) return [...out, off("No creature has a boss loot table linked."), ...linkLine];
  const checker = BossLoot.liveChecker();
  // Every boss at once (they share the pack indexes); lines stay in the bosses' order.
  const inspected = await BossLoot.mapLimit(targets, BossLoot.INSPECT_CONCURRENCY, x => BossLoot.inspect(x.ref, { checker }).catch(e => ({ error: e })));
  for (const [i, x] of targets.entries()) {
    try {
      const r = inspected[i];
      if (r?.error) throw r.error;
      if (!r) continue;
      const name = esc(x.label);
      if (x.noLoot) { out.push(off(`${name}: No loot is set, so nothing drops.`)); continue; }
      if (!r.table) { out.push(bad(`${name}: table not found (${esc(r.flag.table)}). On death it drops vendor trash instead.`)); continue; }
      const t = esc(r.table.name);
      if (r.fallback === "empty") { out.push(bad(`${name}: ${t} has no results that can drop. On death it drops vendor trash instead.`)); continue; }
      if (r.fallback === "items") { out.push(bad(`${name}: none of ${t}'s items resolve (${listNames(r.unresolved, 5)}). On death it drops vendor trash instead.`)); continue; }
      const notes = [];
      if (r.unresolved.length) notes.push(`${plural(r.unresolved.length, "result")} point at missing items (${listNames(r.unresolved, 5)})`);
      if (r.tooManyDraws) notes.push(`${plural(r.draws, "draw")} but only ${plural(r.usable, "usable result")}`);
      const adj = [r.scaledDraws !== r.draws ? `${plural(r.scaledDraws, "draw")} (set ${r.draws})` : plural(r.draws, "draw")];
      if (r.coinCp) adj.push(`${api.fmtMoney(r.scaledCoinCp * cpVal)} coin${r.scaledCoinCp !== r.coinCp ? ` (set ${api.fmtMoney(r.coinCp * cpVal)})` : ""}`);
      out.push(notes.length ? warn(`${name}: ${t}, ${plural(r.resolved, "item")}, ${adj.join(", ")} · ${notes.join("; ")}.`) : ok(`${name}: ${t}, ${plural(r.resolved, "item")}, ${adj.join(", ")}.`));
    } catch (e) { out.push(bad(`${esc(x.label)}: couldn't check (${esc(e.message)}).`)); }
  }
  return [...out, ...linkLine];
}

function noLoot() {
  if (!F.on("vendorTrash") && !F.on("bossLoot")) return [off("Vendor Trash and Boss loot are off.")];
  const actors = game.actors.filter(a => a.getFlag(ID, "noLoot") === true);
  let tokensOn = 0, tokensOptIn = 0, covered = 0;
  for (const t of allTokens()) {
    const f = t.getFlag(ID, "noLoot");
    if (f === true) tokensOn++; else if (f === false) tokensOptIn++;
    else if (t.actorId && actors.some(a => a.id === t.actorId)) covered++;
  }
  if (!actors.length && !tokensOn && !tokensOptIn) return [off("No actor or token is marked No loot.")];
  const out = [ok(`No loot: ${plural(actors.length, "actor")}${actors.length ? ` (${listNames(actors.map(a => a.name), 6)}; ${plural(covered, "token")} placed)` : ""}, ${plural(tokensOn, "token")} marked on their own.`)];
  if (tokensOptIn) out.push(off(`${plural(tokensOptIn, "token")} opted back in while their actor is marked.`));
  return out;
}

function ownLoot() {
  if (!F.on("vendorTrash")) return [off("Vendor Trash is off.")];
  const all = new Set(); let items = 0;
  const scan = a => { if (a.getFlag(ID, "allLootable")) all.add(a.isToken ? a.token?.uuid : a.uuid); for (const i of a.items) if (i.getFlag(ID, "lootable") === true) items++; };
  for (const a of game.actors) if (a.type === "npc") scan(a);
  for (const t of allTokens()) { try { if (!t.actorLink && t.actor?.type === "npc" && t.delta?._source) { const own = new Set((t.delta._source.items ?? []).map(i => i._id)); if (t.delta._source.flags?.[ID]?.allLootable) all.add(t.uuid); for (const i of t.actor.items) if (own.has(i.id) && i.getFlag(ID, "lootable") === true) items++; } } catch { } }
  return [(all.size || items) ? ok(`Your own loot: ${plural(all.size, "NPC")} with Everything is lootable, ${plural(items, "item")} marked Lootable.`) : off("Your own loot: no NPC has Everything is lootable and no item is marked Lootable.")];
}

function rulesPage() {
  if (!F.on("vendorTrash")) return [off("Vendor Trash is off.")];
  const { page, rules, errors } = Trash.readRules();
  if (!page) return [warn(`No ${Trash.RULES_PAGE} page (Run setup adds it).`)];
  const out = [errors.length ? warn(`${Trash.RULES_PAGE}: ${plural(rules.length, "rule")} read, ${plural(errors.length, "problem")}.`) : ok(`${Trash.RULES_PAGE}: ${plural(rules.length, "rule")}, no problems.`)];
  for (const e of errors) out.push(warn(esc(e)));
  return out;
}

function dungeons() {
  if (!F.on("vendorTrash")) return [off("Vendor Trash is off.")];
  const names = game.scenes.filter(s => s.getFlag(ID, "dungeon")).map(s => s.name).sort();
  return [names.length ? ok(`${plural(names.length, "scene")} marked Dungeon: ${names.map(esc).join(", ")}.`) : off("No scene is marked Dungeon.")];
}

function flights(api) {
  if (!F.on("flightMaster")) return [off("Flight Master is off.")];
  const net = api.flightNetwork(); const out = [];
  let legacy = false; try { legacy = api.canImportLegacyFlights(); } catch { }
  if (legacy) out.push(warn("The flight network is empty but the old Flight Routes journal page has flight points: import them from the Flight Routes journal page (control panel › Travel › Flight network…)."));
  if (!net.points.length) { if (!legacy) out.push(warn("No flight points yet: set them up in the flight network (control panel › Travel › Flight network…).")); return out; }
  const open = net.points.filter(p => p.unlocked);
  out.push(open.length >= 2 ? ok(`${plural(net.points.length, "flight point")} (${open.length} unlocked), ${plural(net.routes.length, "route")}.`) : warn(`Only ${open.length} unlocked flight point${open.length === 1 ? "" : "s"}: Flight Master needs two.`));
  const facts = Flight.networkFacts(net, u => api.sceneExists(u));
  if (facts.noScene.length) out.push(warn(`No scene (info): flying to ${listNames(facts.noScene)} lands the party without changing the scene.`));
  for (const n of facts.missingScene) out.push(warn(`Flight point ${esc(n)}: its scene was deleted, so flying there won't change the scene. Pick one in the flight network.`));
  // 1.32: several routes collapse to one line with the list behind a Show toggle.
  const lk = Flight.lockedRoutesLine(facts.toLocked);
  if (lk) out.push(warn(lk.items.length ? `${esc(lk.text)} <details class="wct-hc-more"><summary>Show the routes</summary>${lk.items.map(esc).join("<br>")}</details>` : esc(lk.text)));
  for (const r of facts.unknown) out.push(bad(`Route ${esc(r)}: names a flight point that doesn't exist. Fix or remove it in the flight network.`));
  for (const p of Flight.validateNetwork(net).filter(p => p.level === "error" && p.where === "point")) out.push(bad(`${esc(Flight.problemText(p))}.`));
  if (!api.partyActor()) out.push(warn(`No group actor named ${esc(api.PARTY)}: fares aren't charged.`));
  return out;
}

function zones(api) {
  if (!F.on("hexTravel")) return [off("Hex Travel is off.")];
  const r = api.internals.checkZones();
  if (r.error) return [bad(`Hex Travel: Encounter zones setting: ${esc(r.error)}.`)];
  const n = Object.keys(r.zones).length;
  const out = [n ? ok(`${plural(n, "encounter zone")}: ${listNames(Object.keys(r.zones))}.`) : warn("No encounter zones set (control panel › Travel › Encounter zones).")];
  for (const u of r.unknown) out.push(warn(`Zone ${esc(u.zone)}: no roll table named "${esc(u.table)}" (encounters there are rolled without a table).`));
  return out;
}

function gms() {
  const gm = activeGM(); const online = onlineGMs();
  const out = [gm ? ok(`Active GM: ${esc(gm.name)}${gm.isSelf ? " (you)" : ""}.`) : bad("No GM is connected.")];
  out.push(online.length > 1 ? ok(`${online.length} GMs online (${listNames(online.map(u => u.name))}); automatic actions run on ${esc(gm?.name ?? "?")}'s client only.`) : ok(`${plural(online.length, "GM")} online.`));
  const si = sessionInfo();
  if (si && si.sessions > 1) out.push(ok(`You're logged in on ${si.sessions} clients; automatic actions run on ${si.leader ? "this one" : "another one"} only.`));
  return out;
}

function characterPane() {
  if (!F.on("characterPane")) return [off("Character pane: off.")];
  const get = k => { try { return game.settings.get(ID, k); } catch { return undefined; } };
  if (!get("weaponSets")) return [off("Weapon sets: off (the pane shows one Main Hand, Off Hand and Ranged slot).")];
  const cost = { free: "free", attack: "part of an attack", object: "an object interaction", bonus: "a bonus action", action: "an action" }[get("weaponSwapCost")] ?? "part of an attack";
  const classes = String(get("relicClasses") ?? "").split(/[,\s]+/).filter(Boolean);
  const pcs = game.actors.filter(a => a.type === "character");
  const set = pcs.filter(a => a.getFlag(ID, "weaponSets")).length;
  return [
    ok(`Weapon sets: on; a swap in combat costs ${esc(cost)} (shown in chat, not enforced).`),
    classes.length ? ok(`Relic slot for: ${listNames(classes)}.`) : off("Relic slot: no classes ticked (control panel › Character)."),
    off(`${plural(set, "character")} of ${pcs.length} ${set === 1 ? "has" : "have"} weapon sets stored (the rest get them the first time their pane opens).`),
    get("itemCompare") ? ok("Item comparison tooltips: on.") : off("Item comparison tooltips: off (control panel › Character).")
  ];
}

/** Loot roll history, Sell all junk and boss phase marks. */
/** Character sheet replacement (1.33): whether our sheet is the default for characters, read-only. */
function characterSheet() {
  if (!F.on("characterSheet")) return [off("Character sheet replacement: off (dnd5e's sheet).")];
  const reg = CONFIG.Actor?.sheetClasses?.character ?? {};
  const ours = reg[`${ID}.WctCharacterSheet`];
  if (!ours) return [warn("Character sheet replacement is on but the sheet isn't registered (see the browser console).")];
  let stored = ""; try { stored = game.settings.get("core", "sheetClasses")?.Actor?.character ?? ""; } catch { stored = ""; }
  if (stored && stored !== `${ID}.WctCharacterSheet`) return [line("info", `Character sheet replacement: on, but Configure Default Sheets picks another sheet for characters (${esc(stored)}).`)];
  const out = [ok("Character sheet replacement: on, the default sheet for player characters. Pages are still placeholders.")];
  return [...out, ...coreKeyLines()];
}

/** Renown (2.2): factions, tiers, where players see it, merchant discounts through Item Piles, quest rewards naming a lost faction. */
function renown() {
  if (!F.on("renown")) return [off("Renown: off.")];
  const facs = Renown.factions(); const c = Renown.config(); const out = [];
  if (!facs.length) return [line("info", "Renown: no factions yet (control panel › Character › Factions and renown…).")];
  const hid = facs.filter(f => f.hidden).length;
  const withRenown = game.actors.filter(a => a.type === "character" && facs.some(f => { const e = Renown.entryFor(a, f); return e.score > 0 || e.ribbons.length > 0; })).length;
  out.push(ok(`Renown: ${plural(facs.length, "faction")}${hid ? ` (${hid} hidden from players, kept in the GM-only records)` : ""}; ${plural(withRenown, "character")} with renown.`));
  out.push(line("info", `Shared tiers: ${c.tiers.map(t => `${esc(t.name)} ${t.from}${t.discount ? ` (${t.discount}% off)` : ""}`).join(", ")}.`));
  out.push(F.on("characterSheet") ? ok("Players see renown on the toolkit sheet's Reputation page.") : line("info", "Players see renown through the Reputation button in dnd5e's character sheet header (the toolkit sheet is off)."));
  const linked = facs.filter(f => f.merchants.length);
  if (!linked.length) out.push(off("No merchants linked to a faction: tier discounts are shown on the sheet only."));
  else if (!Renown.itemPiles()) out.push(line("info", `Item Piles isn't active: ${plural(linked.reduce((n, f) => n + f.merchants.length, 0), "merchant link")} kept; tier discounts are shown on the sheet only.`));
  else {
    let applied = 0; let pending = 0;
    for (const p of Renown.discountPlans()) {
      const fname = esc(p.faction?.name ?? "a deleted faction");
      if (p.problem === "missing") out.push(warn(`A merchant linked to ${fname} no longer exists (save the faction to drop the link).`));
      else if (p.problem === "notMerchant") out.push(warn(`${esc(p.merchant?.name ?? "?")} is linked to ${fname} but isn't an Item Piles merchant: no discount there.`));
      else if (p.plan) {
        applied += Object.keys(p.plan.applied).length; pending += p.plan.writes.length;
        for (const uuid of p.plan.skipped) { let n = uuid; try { n = foundry.utils.fromUuidSync(uuid)?.name ?? uuid; } catch { /* keep the uuid */ } out.push(warn(`${esc(p.merchant?.name ?? "?")} has its own Item Piles price for ${esc(n)}, so the ${fname} discount isn't applied there (remove that price in the merchant's Item Piles settings to let renown set it).`)); }
      }
    }
    out.push(pending ? line("info", `Merchant discounts: ${plural(pending, "price")} to update at the next change (or api.renown.sync()).`) : ok(`Merchant discounts: ${plural(applied, "character price")} set through Item Piles at ${plural(linked.reduce((n, f) => n + f.merchants.length, 0), "linked merchant")}.`));
    const st = Renown.syncStatus(); if (st?.error) out.push(warn(`The last discount update failed: ${esc(st.error)}.`));
  }
  // Quest rewards naming a faction that no longer exists.
  const ids = new Set(facs.map(f => f.id)); let lost = 0;
  try { for (const q of Object.values(Vault.get("quests", {}) ?? {})) lost += RN.normalizeQuestRenown(/** @type {any} */ (q)?.rewards?.renown).filter(r => !ids.has(r.faction)).length; } catch { lost = 0; }
  if (lost) out.push(warn(`${plural(lost, "quest renown reward")} name a deleted faction and won't be given (edit the quests).`));
  out.push(F.on("moduleHooks") ? line("info", "Hook wayfarers-toolkit.renownChanged fires after each change (Hooks for other modules).") : off("Hooks for other modules is off: no renownChanged hook."));
  return out;
}

/** Where core's own Toggle Character Sheet key is on this client (the sheet moves it to Alt+C). */
function coreKeyLines() {
  if (!F.on("keybindings")) return [off("Key C for the sheet: off (Keyboard shortcuts is off), so Foundry's own C is untouched.")];
  const { plan, moved } = Sheet.coreKeyStatus();
  if (moved) return [ok(`Foundry's Toggle Character Sheet (${esc(moved)}) is on ${SM.MOVED_LABEL} on this computer; C opens the toolkit sheet.`)];
  if (plan?.why === "notFound") return [line("info", "Foundry's own Toggle Character Sheet key wasn't found on this computer, so it wasn't moved; C opens the toolkit sheet.")];
  if (plan?.why === "rebound") return [line("info", "Foundry's Toggle Character Sheet has your own key on this computer, so it was left as it is.")];
  if (plan?.why === "clash") return [warn(`Foundry's Toggle Character Sheet wasn't moved to ${SM.MOVED_LABEL}: ${SM.MOVED_LABEL} is already used by ${esc((plan.clashes ?? []).join(", "))}. C still opens the toolkit sheet; change one of them in Configure Controls.`)];
  return [];
}

function lootExtras() {
  const get = k => { try { return game.settings.get(ID, k); } catch { return undefined; } };
  const out = [];
  if (F.on("lootRolls")) {
    const n = History.entries().length;
    out.push(get("lootHistory") ? ok(`Loot roll history: on, ${plural(n, "roll")} recorded (control panel › Loot › Loot history…).`) : off(`Loot roll history: off${n ? ` (${plural(n, "older roll")} still stored)` : ""}.`));
  } else out.push(off("Loot roll history: Loot rolls is off."));
  if (F.on("vendorTrash")) {
    if (!get("junkSellButton")) out.push(off("Sell all junk button: off (control panel › Loot)."));
    else if (!modActive("item-piles")) out.push(warn("Sell all junk button: on, but Item Piles isn't active, so there are no merchant windows to put it on."));
    else out.push(ok("Sell all junk button: on (Item Piles merchant windows; a GM must be connected for the sale)."));
  }
  if (F.on("merchantShop")) {
    const IP = /** @type {any} */ (game).itempiles?.API;
    if (!modActive("item-piles")) out.push(warn("Open shop for players: on, but Item Piles isn't active, so there are no merchants to open."));
    else if (!IP?.renderItemPileInterface || !IP?.unrenderItemPileInterface) out.push(bad("Open shop for players: this Item Piles version has no renderItemPileInterface / unrenderItemPileInterface."));
    else out.push(ok(`Open shop for players: on (merchant window header and merchant token HUD; chat line ${get("shopChatLine") ? "on" : "off"}).`));
  } else out.push(off("Open shop for players: off."));
  // Merchant coin rounding (2.1): read-only facts → the model's lines.
  for (const l of RM.healthLines(Rounding.facts())) out.push(line(l.level, esc(l.text)));
  if (F.on("bossFrames")) {
    const marked = [];
    for (const t of allTokens()) { try { if (phasesOf(t).length) marked.push(t.name); } catch { } }
    out.push(off(`Boss phase marks: ${marked.length ? `${plural(marked.length, "token")} (${listNames([...new Set(marked)])})` : "none set (right-click a boss's crown button or frame)"}; players ${get("bossPhasePlayers") ? "see them" : "don't see them"}.`));
  }
  return out;
}

/** The world's facts for the permission checks (permissions.mjs decides what passes). Read-only. */
function permissionFacts(api) {
  const get = k => { try { return game.settings.get(ID, k); } catch { return undefined; } };
  const PERMS = ["MACRO_SCRIPT", "ITEM_CREATE", "ACTOR_CREATE", "FILES_BROWSE"];
  const OWN = CONST.DOCUMENT_OWNERSHIP_LEVELS;
  const users = game.users.filter(u => !u.isGM);
  const ignored = new Set(Perm.normalizeIgnored(get("permIgnoreUsers")));
  const players = users.map(u => {
    const ch = u.character ? (u.character.id ? u.character : game.actors.get(u.character)) : null;
    const can = {}; for (const k of PERMS) { try { can[k] = !!u.hasPermission(k); } catch { } }
    return { id: u.id, name: u.name, ignored: ignored.has(u.id), active: !!u.active, character: ch?.name ?? null, characterOwned: !!ch?.testUserPermission?.(u, "OWNER"), ownsAnyCharacter: game.actors.some(a => a.type === "character" && a.testUserPermission(u, "OWNER")), can };
  });
  const party = api.partyActor?.();
  const lvl = d => users.length ? Math.min(...users.map(u => { try { return d.getUserLevel?.(u) ?? (d.ownership?.[u.id] ?? d.ownership?.default ?? 0); } catch { return 0; } })) : OWN.OWNER;
  const macros = {}; for (const m of MACROS) { if (!m.shared) continue; const w = game.macros.getName(m.name); if (w) macros[m.name] = w.ownership?.default ?? 0; }
  /** @type {any} */
  let quests = null;
  if (F.on("questLog")) {
    try {
      const shown = Quests.all().filter(j => { const q = Quests.data(j); return !q.hidden && q.status !== "available"; });
      // 1.29: a quest is for its party's players only; check those (older records without a party: every player).
      const meant = (j, u) => { const q = Quests.data(j); return !q.party || Quests.isMember(u, q.party); };
      quests = { visible: shown.length, noParty: shown.filter(j => !Quests.data(j).party).map(j => j.name), unreadable: users.length ? shown.filter(j => users.some(u => meant(j, u) && !j.testUserPermission(u, "OBSERVER"))).map(j => j.name) : [] };
    } catch { quests = null; }
  }
  return {
    on: F.on, socket: game.modules.get(ID)?.socket !== false, itemPiles: modActive("item-piles"),
    settings: { playerFlights: !!get("playerFlights"), paceRequests: !!get("paceRequests"), trashItemPiles: !!get("trashItemPiles"), junkSellButton: !!get("junkSellButton"), innRequests: !!get("innRequests"), pinsPlayers: !!get("pinsPlayers") },
    players, party: party ? { name: party.name, playerLevel: lvl(party) } : null, macros, quests
  };
}

/** Permission checks are part of the health check (always on since 1.27.0; they were a switch before). */
function permissions(api) {
  const lines = Perm.featureChecks(permissionFacts(api));
  if (!lines.length) return [off("No tool turned on needs player permissions.")];
  return lines.map(l => line(l.level, `${esc(l.text)}${l.hint && l.level !== "ok" ? ` <em>Fix: ${esc(l.hint)}</em>` : ""}`, l.ignore?.length ? FIXES.ignoreUsers(l.ignore) : undefined));
}

/** Flight route map, travel pace and party gold (1.20). */
function bundle2(api) {
  const get = k => { try { return game.settings.get(ID, k); } catch { return undefined; } };
  const out = [];
  if (F.on("flightMap")) out.push(F.on("flightMaster") ? ok(`Flight route map: on; locked points ${get("flightMapLocked") === "grey" ? "greyed" : "hidden"} for players.`) : warn("Flight route map is on but Flight Master is off, so there's no map to show (control panel › Features)."));
  if (F.on("flightMapBackground")) {
    const img = String(get("flightMapImage") ?? "").trim();
    out.push(!F.on("flightMap") || !F.on("flightMaster") ? warn("Flight map background is on but the flight route map (or Flight Master) is off, so it isn't shown (control panel › Features).")
      : img ? ok(`Flight map background: ${esc(img)} (fit ${esc(get("flightMapFit") ?? "contain")}, opacity ${esc(get("flightMapOpacity") ?? 1)}).`)
      : off("Flight map background is on but no image is picked (control panel › Travel › Advanced); the map has no picture."));
  }
  if (F.on("flightMaster")) out.push(off(`Flights ${get("flightAdvanceTime") ? "advance" : "don't advance"} world time; new flight points ${get("flightDiscovered") ? "are" : "aren't"} announced.`));
  if (F.on("travelPace")) out.push(F.on("hexTravel") ? ok(`Travel pace: the party travels at ${esc(api.travelPaceNow())} pace; players ${get("paceRequests") ? "can" : "can't"} ask for another.`) : warn("Travel pace is on but Hex Travel is off, so it does nothing (control panel › Features)."));
  if (F.on("partyGold")) {
    try { const r = api.gold.read(); const cur = r.rows.find(x => x.current); out.push(r.curveError ? warn(`Party gold: the wealth curve can't be read (${esc(r.curveError)}); the default curve is used.`) : ok(`Party gold: ${esc(api.fmtMoney(r.wealth))} against ${esc(api.fmtMoney(cur?.target ?? 0))} for act/tier ${r.act} (${esc(cur?.direction ?? "")}).`)); }
    catch (e) { out.push(warn(`Party gold: couldn't read (${esc(e.message)}).`)); }
  }
  return out.length ? out : [off("None of the 1.20 tools is on.")];
}

/** Zone title cards and inns (1.22). */
function places(api) {
  const get = k => { try { return game.settings.get(ID, k); } catch { return undefined; } };
  const out = [];
  if (F.on("zoneTitles")) {
    const off = game.scenes.filter(s => s.getFlag(ID, "zoneTitle")?.show === false).length;
    const set = game.scenes.filter(s => s.getFlag(ID, "zoneTitle")?.show === true).length;
    out.push(ok(`Zone title cards: ${get("zoneTitleTrigger") === "view" ? "every view" : "on activation"}, ${get("zoneTitleAudience") === "players" ? "players only" : "everyone"}; ${get("zoneTitleAll") !== false ? `every scene${off ? ` except ${plural(off, "scene")} switched off` : ""}` : `${plural(set, "scene")} ticked`}.`));
    if (get("zoneTitleAll") === false && !set) out.push(warn("Zone title cards: no scene is ticked and Every scene gets a title card is off, so no card ever shows (Scene configuration › Title card)."));
  }
  if (F.on("restedInn")) {
    const all = api.inn.all();
    if (!all.length) out.push(off("Inns: none yet (Scene configuration › Table Tools › Inns, or Make innkeeper here… on a token's HUD)."));
    else {
      const label = x => `${x.inn.name} (${x.scene.name})`;
      const noPrice = all.filter(x => !String(x.inn.price ?? "").trim()).map(label);
      const badPrice = all.filter(x => !x.inn.priceOk).map(label);
      const lostKeeper = all.filter(x => x.inn.innkeeper?.token && !x.scene.tokens.get(x.inn.innkeeper.token)).map(label);
      out.push(ok(`${plural(all.length, "inn")}: ${listNames(all.map(label))}.`));
      if (noPrice.length) out.push(warn(`Inn${noPrice.length === 1 ? "" : "s"} with no room price of ${noPrice.length === 1 ? "its" : "their"} own (the default ${esc(get("innDefaultPrice") || "5s")} is used): ${listNames(noPrice)}.`));
      if (badPrice.length) out.push(bad(`Inn room price can't be read (try 5s or 1g 20s): ${listNames(badPrice)}.`));
      if (lostKeeper.length) out.push(warn(`Innkeeper token no longer on the scene: ${listNames(lostKeeper)} (rent from the Places tab, or set a new innkeeper).`));
    }
    const unrented = game.actors.filter(a => a.getFlag(ID, "rested") && !api.inn.rental(a)).map(a => a.name);
    if (unrented.length) out.push(warn(`Rested without a room the GM rented (no benefit; cleared on their next long rest): ${listNames(unrented)}.`));
    if (get("innPayFrom") !== "each" && !api.partyActor()) out.push(warn(`Inns: rooms are paid from the party actor, but there's no group actor named ${esc(api.PARTY)} (Run setup adds it).`));
    const restedNames = game.actors.filter(a => a.getFlag(ID, "rested")).map(a => a.name);
    out.push(off(`Rested now: ${restedNames.length ? listNames(restedNames) : "nobody"}; benefit: ${esc({ inspiration: "Heroic Inspiration", hitDie: "one extra Hit Die", tempHp: "temporary hit points" }[get("innBenefit")] ?? "Heroic Inspiration")}.`));
  }
  return out.length ? out : [off("None of the 1.22 tools is on.")];
}

/** Map pins (1.26). */
function mapPins() {
  if (!F.on("mapPins")) return [off("Map pins: off.")];
  const get = k => { try { return game.settings.get(ID, k); } catch { return undefined; } };
  const out = [];
  const s = Pins.status();
  out.push(ok(`Map pins: ${plural(s.pins, "pin")} on ${plural(s.scenes, "scene")}${s.hidden ? `, ${s.hidden} hidden from players` : ""}; players ${s.players ? "can" : "can't"} place pins.`));
  if (!s.classOk) out.push(warn("Map pins: another module replaced the map note drawing after the toolkit, so hidden GM pins may show to players as plain notes, and a pin's card may not open on double-click. Check the module order, or keep GM pins unhidden."));
  if (s.players && !activeGM()) out.push(off("Map pins: no GM is online right now, so players' pin changes wait for one (they're told nothing was saved)."));
  try { const key = canvas?.notes?.constructor?.TOGGLE_SETTING ?? "notesDisplayToggle"; if (game.settings.get("core", key) === false && !get("pinsShowNotes")) out.push(off("Map pins: map notes are turned off in this browser (Journal Notes controls › Toggle notes), so pins only show while that layer is open.")); } catch { }
  return out;
}

/** The vendored wanderers-core, the one-writer leader and the shared Table Tools scene tab. */
function shared() {
  const out = [ok(`wanderers-core ${esc(CORE_VERSION)} (bundled).`)];
  const si = sessionInfo();
  out.push(si ? ok(`One-writer election running: ${si.leader ? "this client acts" : "another client acts"}.`) : warn("One-writer election not started on this client (reload Foundry)."));
  const mine = sceneTab.sections().filter(x => x.moduleId === ID);
  const want = F.on("zoneTitles") || F.on("vendorTrash") || F.on("restedInn");
  if (want) out.push(mine.length ? ok("Table Tools tab in Scene Configuration: the toolkit's section is registered.") : warn("Table Tools tab: the toolkit's section isn't registered, so scene title cards, Dungeon and inns can't be set (reload Foundry)."));
  const v = Vault.status();
  if (!v.exists) out.push(off("GM-only records: none yet (made the first time something GM-only is saved)."));
  else if (v.playersCanSee.length) out.push(bad(`GM-only records: the journal entry "${v.name || "Wanderer's Toolkit (GM only)"}" is shared with ${listNames(v.playersCanSee)}. Set its ownership back to None for players: it holds hidden pins, quest GM text and the full flight network.`, FIXES.vaultPrivate()));
  else out.push(ok(`GM-only records: kept in "${v.name || "Wanderer's Toolkit (GM only)"}", players can't open it (${plural(v.buckets.length, "kind")} of record).`));
  if (v.exists && !v.filed && !v.inFolder) out.push(line("info", `GM-only records: the journal sits at the top of the Journal sidebar; the acting GM files it into the shared "Module data" folder once on their next load.`, FIXES.fileVault()));
  if (v.count > 1) out.push(warn(`GM-only records: ${v.count} journals are marked as the toolkit's store (two GMs created one at once); only the first is used. Delete the empty one by hand after checking it.`));
  const pending = Migrate.status().filter(m => !m.done).map(m => m.id);
  if (pending.length) out.push(off(`1.27 data moves not run yet: ${pending.join(", ")} (they run on the acting GM's next load, or with a tool turned on).`));
  return out;
}

function updateNotes() {
  const u = Updates.status();
  return [u.on ? ok(`Update notes: on (last version seen in this world: ${esc(u.lastSeen || "none yet")}).`) : off("Update notes: off (control panel › Overview).")];
}

/**
 * The safe fixes health lines offer (1.30). Each runs on the GM client that clicks it and changes only what its confirm text says.
 * Exported for tests.
 */
export const FIXES = {
  /** Run setup: creates what's missing (journal, party actor, macros); never overwrites anything. */
  setup: api => ({ label: "Run setup", confirm: "Run setup creates what the tools need and is missing (tracker journal, party actor, macros in the toolkit's macro folder). Nothing that exists is changed or overwritten.", run: () => api.setup() }),
  /** Link boss tables by name: links each creature to the roll table named "<name> · Loot"; existing links are kept. */
  autolink: api => ({ label: "Link boss tables", confirm: "Link each creature to the roll table named after it (\"<creature name> · Loot\")? Creatures that already have a boss loot table keep it.", run: () => api.bossLoot?.autoLink() }),
  /** File the GM-only records journal into the shared "Module data" folder now (otherwise the acting GM does it on load). */
  fileVault: () => ({ label: "File it now", confirm: "Move the GM-only records journal into the shared \"Module data\" journal folder (hidden from the Journal sidebar unless Show module data folder is on)? Its name, ownership and records stay as they are; you can move it again afterwards.", run: () => fileVault() }),
  /** 1.32: stop the no-character warning for these players (adds them to permIgnoreUsers; undo in control panel › Loot › Advanced). */
  ignoreUsers: ids => ({ label: "Ignore these users", confirm: "Stop warning that these players have no character? They're added to the ignore list (control panel › Loot › Advanced), where you can take them off again.", run: () => ignoreUsers(ids) }),
  /** The GM-only records journal back to ownership None for every player. */
  vaultPrivate: () => ({ label: "Make GM only", confirm: "Set the GM-only records journal's ownership to None for every player (default None too)? Players lose access to it; GMs keep full access.", run: () => vaultPrivate() })
};
/** A GM click: adds players to the ignore list of the no-character check. @param {string[]} ids */
async function ignoreUsers(ids) {
  if (!game.user?.isGM) return false;
  let cur; try { cur = game.settings.get(ID, "permIgnoreUsers"); } catch { return false; }
  await game.settings.set(ID, "permIgnoreUsers", Perm.withIgnored(cur, ids));
  return true;
}
/** A GM click: files the store journal like core's file() does on the acting GM (moved only from the root, then marked filed). */
async function fileVault() {
  const j = Vault.entry(); if (!j || !game.user?.isGM) return false;
  await fileInDataFolder(ID, j);
  if (j.folder) await j.setFlag(ID, "dataFolderFiled", true);
  return true;
}
/** Ownership None for the default and for every player who has a level of their own on the store journal. */
async function vaultPrivate() {
  const j = Vault.entry(); if (!j || !game.user?.isGM) return false;
  const NONE = CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;
  await j.update({ ownership: vaultOwnership(j.ownership, game.users.filter(u => !u.isGM).map(u => u.id), NONE) });
  return true;
}
/** Pure: the ownership update that leaves GMs as they are and puts the default and every listed player at `none`. */
export function vaultOwnership(current, playerIds, none = 0) {
  /** @type {Record<string, number>} */
  const out = { default: none };
  for (const id of playerIds) if (current && id in current) out[id] = none;
  return out;
}

/** @type {[string, (api: any) => any][]} */
const SECTIONS = [
  ["Features", features], ["Dependencies", dependencies], ["Setup", setupState], ["Boss loot", bossLoot], ["No loot", noLoot], ["Your own loot", ownLoot],
  ["Vendor Trash Rules page", rulesPage], ["Dungeon scenes", dungeons], ["Flight Master", flights], ["Encounter zones", zones], ["Character pane", characterPane], ["Character sheet", characterSheet], ["Renown", renown], ["Loot, junk and phases", lootExtras], ["Map, pace, gold and settings", bundle2], ["Title cards and inns", places], ["Map pins", mapPins], ["Permissions", permissions], ["Update notes", updateNotes], ["GMs", gms], ["Shared core", shared]
];

/** Runs every check: [{ title, lines: [{ level, text }] }]. Never throws. */
export async function run(api) {
  const out = [];
  for (const [title, fn] of SECTIONS) {
    let lines;
    try { lines = await fn(api); } catch (e) { console.warn(`${ID} | health check "${title}"`, e); lines = [bad(`Check failed: ${esc(e?.message ?? e)}`)]; }
    out.push({ title, lines: lines ?? [] });
  }
  return out;
}

/**
 * The report in wanderers-core's health format, for the hub module and other readers (api.healthReport()):
 *   [{ title, lines: [{ level: "ok" | "warn" | "bad" | "off" | "info", text }] }]
 * Text is plain (no HTML: buttons and markup are dropped), empty sections are left out, each section is wrapped and time-limited by
 * core's collector (a section that throws or takes longer than `timeoutMs` becomes one "warn" line; see reportTimeout()). Read-only;
 * never throws.
 * GM only: other users get [] (the report names hidden things such as boss tables and inns).
 * @param {any} api
 * @param {{ timeoutMs?: number }} [opts]
 */
export async function report(api, { timeoutMs } = {}) {
  if (!game.user?.isGM) return [];
  const c = healthCollector({ timeoutMs: reportTimeout(timeoutMs) });
  for (const [title, fn] of SECTIONS) {
    await c.checkAsync(title, async add => {
      // A line's fix (FIXES) goes through as well: core's collector keeps it for the Satchel's Fix button.
      for (const l of (await fn(api)) ?? []) add(l.level, toPlain(l.text), l.fix);
    });
  }
  return c.report();
}
/** Default per-section limit of healthReport() when the caller gives none. */
export const REPORT_TIMEOUT_MS = 20000;
/**
 * The per-section limit healthReport() uses: the caller's `timeoutMs` (a hub passes its own budget so the two agree), clamped to
 * 1 s – 5 min, or REPORT_TIMEOUT_MS. Pure.
 * @param {unknown} ms
 */
export function reportTimeout(ms) {
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? Math.min(300000, Math.max(1000, Math.round(ms))) : REPORT_TIMEOUT_MS;
}
/** A line's HTML as plain text: buttons dropped, tags removed, entities read. */
export const toPlain = html => plain(String(html ?? "").replace(/<button[^>]*>[\s\S]*?<\/button>/g, " ")
  // 1.32: a Show toggle's list reads as "…: a, b, c" in plain text (the label is dropped).
  .replace(/\.?\s*<details[^>]*>\s*<summary>[\s\S]*?<\/summary>/g, ": ").replace(/<br\s*\/?>/g, ", ").replace(/<\/details>/g, "."));

/** Whether Run setup should be offered (macros missing). */
const setupMissing = api => { try { return api.setupPlan().some(p => !p.ok); } catch { return false; } };
/** Whether the Wanderer's Satchel hub is active and can open its health page (GM). */
export const satchelOn = () => { const m = game.modules.get("wanderers-satchel"); return !!(m?.active && typeof m.api?.health === "function"); };

/** The full report as HTML (the health window, and the chat card when the Satchel isn't active). */
export function html(api, sections) {
  return Card.fullCard({ version: api.version ?? "", sections, setup: setupMissing(api) });
}

/**
 * GM: runs the checks and whispers a card to the GMs. 1.30: with the Wanderer's Satchel active the card is one summary line with
 * an "Open in Wanderer's Satchel" button; without it the full card. With `{ window: true }` it opens the window instead.
 */
export async function post(api, { window = false } = {}) {
  if (window) return new HealthApp().render(true);
  const sections = await run(api);
  const satchel = satchelOn();
  const content = satchel ? Card.shortCard({ version: api.version ?? "", counts: Card.counts(sections), satchel, setup: setupMissing(api) }) : html(api, sections);
  // 1.32: toolkitCard marks the toolkit's housekeeping cards; older health cards then go (setting pruneToolkitCards).
  await ChatMessage.create({ content, whisper: gmIds(), speaker: { alias: "Wanderer's Toolkit" }, flags: { [ID]: { health: true, toolkitCard: "health" } } });
  await Cards.afterPost("health");
  return sections;
}

/** @type {any} */
let API = null;
/** The report in a window (api.health({ window: true })), with Post to chat and Run setup. */
export class HealthApp extends remembered(foundry.applications.api.ApplicationV2, "health") {
  static DEFAULT_OPTIONS = { id: `${ID}-health`, classes: ["wct-window", "wct-health-window", ...UI_CLASSES], window: { title: "Wanderer's Toolkit · Health check", icon: "fa-solid fa-stethoscope", resizable: true }, position: { width: 560, height: 640 } };
  async _renderHTML() {
    const div = document.createElement("div"); div.style.overflowY = "auto";
    if (!game.user.isGM) { div.textContent = "GM only."; return div; }
    const sections = await run(API);
    div.innerHTML = `${html(API, sections)}<p class="wc-row"><button type="button" class="wc-btn" data-action="post"><i class="fa-solid fa-comment"></i> Post to chat</button> <button type="button" class="wc-btn" data-action="again"><i class="fa-solid fa-rotate"></i> Check again</button></p>`;
    /** @type {HTMLElement} */ (div.querySelector("[data-action=post]")).addEventListener("click", () => post(API));
    /** @type {HTMLElement} */ (div.querySelector("[data-action=again]")).addEventListener("click", () => this.render());
    div.querySelector("[data-wct-action=run-setup]")?.addEventListener("click", () => runSetup(() => this.render()));
    div.querySelector("[data-wct-action=autolink-boss]")?.addEventListener("click", async ev => { /** @type {HTMLButtonElement} */ (ev.currentTarget).disabled = true; await API.bossLoot?.autoLink(); this.render(); });
    return div;
  }
  _replaceHTML(result, content) { content.replaceChildren(result); }
}

/** Opens the Satchel's health window for this module (its api.health({ window, ids })), else its hub, else our own window. */
function openSatchel() {
  const api = game.modules.get("wanderers-satchel")?.api;
  try {
    if (typeof api?.health === "function") { const r = api.health({ window: true, ids: [ID] }); if (r) return r; }
    if (typeof api?.open === "function") return api.open();
  } catch (e) { console.warn(`${ID} | Wanderer's Satchel`, e); }
  return new HealthApp().render(true);
}

async function runSetup(after) {
  try {
    const r = await API.setup();
    ui.notifications.info(`Wanderer's Toolkit: ${r?.length ? "created " + r.join(", ") : "everything already exists"}.`);
  } catch (e) { ui.notifications.error(`Wanderer's Toolkit setup: ${e.message}`); }
  after?.();
}

/** Called from the module's init hook: the Run setup button on health cards (and on setup reminder cards posted before 1.17). */
export function init(api) {
  API = api;
  Hooks.on("renderChatMessageHTML", (message, el) => {
    const f = message.flags?.[ID]; if (!f?.health && !f?.setupReminder) return;
    const root = el instanceof HTMLElement ? el : el?.[0];
    const link = root?.querySelector?.("[data-wct-action=autolink-boss]");
    if (link) { if (!game.user.isGM) link.remove(); else link.addEventListener("click", async ev => { ev.preventDefault(); link.disabled = true; await API.bossLoot?.autoLink(); }); }
    const sat = root?.querySelector?.("[data-wct-action=open-satchel]");
    if (sat) { if (!game.user.isGM) sat.remove(); else sat.addEventListener("click", ev => { ev.preventDefault(); openSatchel(); }); }
    const btn = root?.querySelector?.("[data-wct-action=run-setup]"); if (!btn) return;
    if (!game.user.isGM) return btn.remove();
    btn.addEventListener("click", async ev => { ev.preventDefault(); btn.disabled = true; await runSetup(); btn.disabled = false; });
  });
}

/** For tests and macros: the macro names Run setup would make for the features on. */
export const setupMacroNames = () => MACROS.filter(m => macroOn(m, F.on)).map(m => m.name);
