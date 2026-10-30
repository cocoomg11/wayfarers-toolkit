/**
 * Health check and the Run setup reminder. The health check reads the world and reports; it never changes anything and never throws
 * (each check is wrapped, and a check that fails shows as its own ✗ line). The GM opens it from the module settings (Health check),
 * the Toolkit Health Check macro or api.health(). The setup reminder runs once per module version on the active GM's client.
 */
import * as F from "./features.mjs";
import * as Trash from "./trash.mjs";
import * as BossLoot from "./bossloot.mjs";
import { activeGM, isActiveGM, onlineGMs } from "./gm.mjs";
import { MACROS } from "./macros.mjs";

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
    if (!ids.length) out.push(bad("Vendor Trash has no item compendium: install the wow-classic-items module or set Vendor trash compendiums."));
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
  const out = []; const targets = [];
  for (const a of game.actors) if (a.getFlag(ID, "bossLoot")) targets.push({ label: a.name, ref: a, noLoot: Trash.isNoLoot(a) });
  for (const t of allTokens()) {
    try { if (!t.actorLink && t.delta?._source?.flags?.[ID]?.bossLoot && t.actor) targets.push({ label: `${t.name} (token on ${t.parent.name})`, ref: t, noLoot: Trash.isNoLoot(t) }); } catch { }
  }
  if (!targets.length) return [off("No creature has a boss loot table linked.")];
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
      out.push(notes.length ? warn(`${name}: ${t}, ${plural(r.resolved, "item")} · ${notes.join("; ")}.`) : ok(`${name}: ${t}, ${plural(r.resolved, "item")}, ${plural(r.draws, "draw")}.`));
    } catch (e) { out.push(bad(`${esc(x.label)}: couldn't check (${esc(e.message)}).`)); }
  }
  return out;
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
  let data; try { data = api.flightData(); } catch (e) { return [warn(esc(e.message))]; }
  const out = []; const open = data.pts.filter(p => p.u);
  out.push(open.length >= 2 ? ok(`${plural(data.pts.length, "flight point")} (${open.length} unlocked), ${plural(data.routes.length, "route")}.`) : warn(`Only ${open.length} unlocked flight point${open.length === 1 ? "" : "s"}: Flight Master needs two.`));
  for (const p of data.pts.filter(p => p.sm)) out.push(bad(`Flight point ${esc(p.n)}: scene "${esc(p.sc)}" doesn't exist (flights there are refused).`));
  const names = new Set(data.pts.map(p => p.n));
  for (const r of data.routes) { const u = [r.a, r.b].filter(n => !names.has(n)); if (u.length) out.push(bad(`Route ${esc(r.a)} → ${esc(r.b)}: unknown flight point ${u.map(esc).join(", ")}.`)); }
  if (!api.partyActor()) out.push(warn(`No group actor named ${esc(api.PARTY)}: fares aren't charged.`));
  return out;
}

function gms() {
  const gm = activeGM(); const online = onlineGMs();
  const out = [gm ? ok(`Active GM: ${esc(gm.name)}${gm.isSelf ? " (you)" : ""}.`) : bad("No GM is connected.")];
  out.push(online.length > 1 ? ok(`${online.length} GMs online (${listNames(online.map(u => u.name))}); automatic actions run on ${esc(gm?.name ?? "?")}'s client only.`) : ok(`${plural(online.length, "GM")} online.`));
  return out;
}

const SECTIONS = [
  ["Features", features], ["Dependencies", dependencies], ["Setup", setupState], ["Boss loot", bossLoot], ["No loot", noLoot],
  ["Vendor Trash Rules page", rulesPage], ["Dungeon scenes", dungeons], ["Flight Master", flights], ["GMs", gms]
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
/** The settings menu's window: the same report, with Post to chat and Run setup. */
export class HealthApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { id: `${ID}-health`, window: { title: "Wayfarer's Toolkit · Health check", icon: "fa-solid fa-stethoscope", resizable: true }, position: { width: 560, height: 640 } };
  async _renderHTML() {
    const div = document.createElement("div"); div.style.overflowY = "auto";
    if (!game.user.isGM) { div.textContent = "GM only."; return div; }
    const sections = await run(API);
    div.innerHTML = `${html(API, sections)}<p><button type="button" data-action="post"><i class="fas fa-comment"></i> Post to chat</button> <button type="button" data-action="again"><i class="fas fa-rotate"></i> Check again</button></p>`;
    div.querySelector("[data-action=post]").addEventListener("click", () => post(API));
    div.querySelector("[data-action=again]").addEventListener("click", () => this.render());
    div.querySelector("[data-wct-action=run-setup]")?.addEventListener("click", () => runSetup(() => this.render()));
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

/**
 * Ready, active GM only: once per module version, compares what Run setup would create with the world and, when something is
 * missing, whispers the GMs a card with a Run setup button. The version is stored in a world setting, so it doesn't repeat each load.
 */
export async function remindSetup(api) {
  if (!isActiveGM()) return;
  const ver = api.version ?? ""; if (game.settings.get(ID, "setupReminded") === ver) return;
  const missing = api.setupPlan().filter(p => !p.ok).map(p => p.label);
  await game.settings.set(ID, "setupReminded", ver);
  if (!missing.length) return;
  await ChatMessage.create({
    whisper: gmIds(), speaker: { alias: "Wayfarer's Toolkit" }, flags: { [ID]: { setupReminder: ver } },
    content: `<p><strong>Wayfarer's Toolkit ${esc(ver)}:</strong> Run setup to add: ${missing.map(esc).join(", ")}.</p><p><button type="button" data-wct-action="run-setup"><i class="fas fa-hammer"></i> Run setup</button></p>`
  });
}

/** Called from the module's init hook: the Run setup button on health and reminder cards. */
export function init(api) {
  API = api;
  Hooks.on("renderChatMessageHTML", (message, el) => {
    const f = message.flags?.[ID]; if (!f?.health && !f?.setupReminder) return;
    const root = el instanceof HTMLElement ? el : el?.[0];
    const btn = root?.querySelector?.("[data-wct-action=run-setup]"); if (!btn) return;
    if (!game.user.isGM) return btn.remove();
    btn.addEventListener("click", async ev => { ev.preventDefault(); btn.disabled = true; await runSetup(); btn.disabled = false; });
  });
}

/** For tests and macros: the macro names Run setup would make for the features on. */
export const setupMacroNames = () => MACROS.filter(m => F.on(m.feature)).map(m => m.name);
