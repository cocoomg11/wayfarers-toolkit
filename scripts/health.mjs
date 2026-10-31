/**
 * Health check. The health check reads the world and reports; it never changes anything and never throws
 * (each check is wrapped, and a check that fails shows as its own ✗ line). The GM sees it summed up in the control panel's Overview tab, or posts it from there (Full health report),
 * the Toolkit Health Check macro or api.health(). (The once-per-version setup reminder is now part of the update notes, updates.mjs.)
 */
import * as F from "./features.mjs";
import * as Trash from "./trash.mjs";
import * as BossLoot from "./bossloot.mjs";
import { activeGM, onlineGMs } from "./gm.mjs";
import { MACROS } from "./macros.mjs";
import * as Updates from "./updates.mjs";
import * as Flight from "./flight.mjs";

const ID = "wayfarers-toolkit";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ICON = { ok: "✓", warn: "⚠", bad: "✗", off: "·" };
const COLOR = { ok: "#3a8a3a", warn: "#b07a00", bad: "#b02a2a", off: "#888" };
const line = (level, text) => ({ level, text });
const ok = t => line("ok", t), warn = t => line("warn", t), bad = t => line("bad", t), off = t => line("off", t);
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
  return plan.map(p => p.ok ? ok(`${esc(p.label)}`) : bad(`${esc(p.label)}: missing`));
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
  const linkLine = unlinked.length ? [warn(`${plural(unlinked.length, "creature")} with a table named for it but not linked (${listNames(unlinked, 6)}). <button type="button" data-wct-action="autolink-boss" style="width:auto;line-height:1.4;padding:0 0.4em;"><i class="fa-solid fa-link"></i> Link boss tables by name</button>`)] : [];
  out.push(ok(`Party size ${pr.size}: boss coin ×${(pr.size / 4).toFixed(2).replace(/\.?0+$/, "")}${pr.size > 4 ? (pr.extra ? ", +1 draw for bosses with 3 or more" : ", no extra draw (setting off)") : ""}.`));
  if (!targets.length) return [...out, off("No creature has a boss loot table linked."), ...linkLine];
  for (const x of targets) {
    try {
      const r = await BossLoot.inspect(x.ref); if (!r) continue;
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
  if (facts.toLocked.length) out.push(warn(`Route${facts.toLocked.length === 1 ? "" : "s"} into a locked flight point (not flown until it's unlocked): ${listNames(facts.toLocked)}.`));
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
  return out;
}

function updateNotes() {
  const u = Updates.status();
  return [u.on ? ok(`Update notes: on (last version seen in this world: ${esc(u.lastSeen || "none yet")}).`) : off("Update notes: off (control panel › Overview).")];
}

const SECTIONS = [
  ["Features", features], ["Dependencies", dependencies], ["Setup", setupState], ["Boss loot", bossLoot], ["No loot", noLoot], ["Your own loot", ownLoot],
  ["Vendor Trash Rules page", rulesPage], ["Dungeon scenes", dungeons], ["Flight Master", flights], ["Encounter zones", zones], ["Update notes", updateNotes], ["GMs", gms]
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

/** The report as HTML (for the chat card and the window). */
export function html(api, sections) {
  const missing = (() => { try { return api.setupPlan().some(p => !p.ok); } catch { return false; } })();
  const counts = { ok: 0, warn: 0, bad: 0 }; for (const s of sections) for (const l of s.lines) if (l.level in counts) counts[l.level]++;
  const body = sections.map(s => `<h4 style="margin:0.6em 0 0.2em;border-bottom:1px solid currentColor;">${esc(s.title)}</h4><ul style="list-style:none;margin:0;padding:0;">${s.lines.map(l => `<li style="margin:0.1em 0;"><span style="color:${COLOR[l.level]};font-weight:bold;display:inline-block;width:1.2em;">${ICON[l.level]}</span>${l.text}</li>`).join("")}</ul>`).join("");
  return `<div class="wct-health"><h3>Wayfarer's Toolkit ${esc(api.version ?? "")}: health check</h3><p>${counts.ok} ✓ · ${counts.warn} ⚠ · ${counts.bad} ✗</p>${body}${missing ? `<p><button type="button" data-wct-action="run-setup"><i class="fas fa-hammer"></i> Run setup</button></p>` : ""}</div>`;
}

/** GM: runs the checks and whispers the card to the GMs. With `{ window: true }` it opens the window instead. */
export async function post(api, { window = false } = {}) {
  if (window) return new HealthApp().render(true);
  const sections = await run(api);
  await ChatMessage.create({ content: html(api, sections), whisper: gmIds(), speaker: { alias: "Wayfarer's Toolkit" }, flags: { [ID]: { health: true } } });
  return sections;
}

let API = null;
/** The report in a window (api.health({ window: true })), with Post to chat and Run setup. */
export class HealthApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { id: `${ID}-health`, classes: ["wct-window"], window: { title: "Wayfarer's Toolkit · Health check", icon: "fa-solid fa-stethoscope", resizable: true }, position: { width: 560, height: 640 } };
  async _renderHTML() {
    const div = document.createElement("div"); div.style.overflowY = "auto";
    if (!game.user.isGM) { div.textContent = "GM only."; return div; }
    const sections = await run(API);
    div.innerHTML = `${html(API, sections)}<p><button type="button" data-action="post"><i class="fas fa-comment"></i> Post to chat</button> <button type="button" data-action="again"><i class="fas fa-rotate"></i> Check again</button></p>`;
    div.querySelector("[data-action=post]").addEventListener("click", () => post(API));
    div.querySelector("[data-action=again]").addEventListener("click", () => this.render());
    div.querySelector("[data-wct-action=run-setup]")?.addEventListener("click", () => runSetup(() => this.render()));
    div.querySelector("[data-wct-action=autolink-boss]")?.addEventListener("click", async ev => { ev.currentTarget.disabled = true; await API.bossLoot?.autoLink(); this.render(); });
    return div;
  }
  _replaceHTML(result, content) { content.replaceChildren(result); }
}

async function runSetup(after) {
  try {
    const r = await API.setup();
    ui.notifications.info(`Wayfarer's Toolkit: ${r?.length ? "created " + r.join(", ") : "everything already exists"}.`);
  } catch (e) { ui.notifications.error(`Wayfarer's Toolkit setup: ${e.message}`); }
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
    const btn = root?.querySelector?.("[data-wct-action=run-setup]"); if (!btn) return;
    if (!game.user.isGM) return btn.remove();
    btn.addEventListener("click", async ev => { ev.preventDefault(); btn.disabled = true; await runSetup(); btn.disabled = false; });
  });
}

/** For tests and macros: the macro names Run setup would make for the features on. */
export const setupMacroNames = () => MACROS.filter(m => F.on(m.feature)).map(m => m.name);
