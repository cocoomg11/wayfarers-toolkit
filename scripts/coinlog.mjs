/**
 * Coin log (feature coinLog) and Split coin (feature splitCoin), the Foundry half; pure rules in coinlog-model.mjs.
 *
 * Every coin movement the toolkit makes goes through api.pay / api.addMoney (or, for rooms and refunds, is recorded where it
 * happens) with a `reason`; the GM client that made it records one entry per actor in the GM-only store (vault bucket "coinLog").
 * Players never write it and never read it. The Coin log window (control panel › Loot) lists the entries; Undo on one of the newest
 * gives back what was paid, or takes back what was given only if the actor still has that much (otherwise it refuses and changes
 * nothing). An undo is logged too.
 *
 * Split coin shares the party actor's purse evenly among its members (a preview first; the remainder stays with the party).
 */
import * as M from "./coinlog-model.mjs";
import * as F from "./features.mjs";
import * as Vault from "./vault.mjs";
import { log } from "./log.mjs";
import { esc } from "../vendor/wanderers-core/index.mjs";

const ID = "wayfarers-toolkit";
const APP_ID = `${ID}-coin-log`;
/** @type {any} */
let API = null;

/** Called from init with the module API (money helpers). */
export function init(api) { API = api; }

/** GM: the stored entries, newest first. Players: []. */
export function entries() {
  if (!game.user?.isGM) return [];
  return M.normalizeCoinLog(Vault.get("coinLog", null)).entries;
}

let chain = Promise.resolve();
/**
 * GM client: records a movement of `delta` (smallest coin; + gained, − paid) on `actor` with a reason. Does nothing when the
 * feature is off, on a player's client, or for a zero amount. Never throws (a failed write only costs the log line).
 * @param {any} actor
 * @param {number} delta
 * @param {string} reason
 * @param {{ undoOf?: string | null }} [opts]
 */
export function record(actor, delta, reason, { undoOf = null } = {}) {
  if (!F.on("coinLog") || !game.user?.isGM || !actor || !Math.round(delta || 0)) return chain;
  const entry = M.makeEntry({
    id: foundry.utils.randomID(16), at: Date.now(), world: game.time?.worldTime ?? null,
    actor: actor.uuid, actorName: actor.name, delta, reason, by: game.user.id, undoOf, coins: API?.coins?.() ?? []
  });
  if (!entry) return chain;
  chain = chain.then(() => Vault.update(v => ({ ...v, buckets: { ...v.buckets, coinLog: M.addEntry(v.buckets.coinLog, entry) } })))
    .then(() => { log(`Coin log: ${actor.name} ${delta > 0 ? "+" : "−"}${M.coinText(entry.coins)} (${reason})`); refresh(); })
    .catch(e => console.warn(`${ID} | coin log`, e));
  return chain;
}

/** GM: undoes an entry by id. Returns { ok, reason? }; tells the GM either way. */
export async function undo(id) {
  if (!game.user?.isGM) { ui.notifications.warn("GM only."); return { ok: false, reason: "GM only" }; }
  if (!F.on("coinLog")) return { ok: false, reason: "the coin log is off" };
  const log0 = Vault.get("coinLog", null);
  const e = M.normalizeCoinLog(log0).entries.find(x => x.id === id);
  if (!e || !M.undoable(log0, id)) { ui.notifications.warn("Coin log: only one of the latest entries that isn't undone yet can be undone."); return { ok: false, reason: "not undoable" }; }
  const actor = fromUuidSync(e.actor, { strict: false });
  const plan = M.undoPlan(e, { exists: !!actor?.system?.currency, have: actor?.system?.currency ? API.totalMoney(actor) : 0 });
  if (!plan.ok) { ui.notifications.warn(`Coin log: can't undo: ${plan.reason}. Nothing was changed.`); return { ok: false, reason: plan.reason }; }
  const reason = `Undo: ${e.reason}`;
  if (plan.op === "take") await API.pay(actor, plan.amount, { reason, undoOf: e.id });
  else await API.addMoney(actor, plan.amount, { reason, undoOf: e.id });
  await Vault.update(v => ({ ...v, buckets: { ...v.buckets, coinLog: M.markUndone(v.buckets.coinLog, e.id) } }));
  refresh();
  ui.notifications.info(`Coin log: undone (${plan.op === "take" ? "took back" : "gave back"} ${API.fmtMoney(plan.amount)} ${plan.op === "take" ? "from" : "to"} ${e.actorName}).`);
  return { ok: true };
}

/** GM: empties the log after asking. */
export async function clear() {
  if (!game.user?.isGM) return false;
  const ok = await API.confirm("Clear coin log", `<p>Delete all ${entries().length} coin log entries? Coin already moved stays where it is.</p>`);
  if (!ok) return false;
  await Vault.set("coinLog", M.normalizeCoinLog(null)); refresh();
  return true;
}

// ---------------------------------------------------------------- the window
const when = e => { const d = new Date(e.at); return Number.isNaN(d.getTime()) ? "" : `${d.toLocaleDateString()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
export class CoinLogApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: APP_ID, classes: ["wct-history", "wct-coinlog", "wct-window"],
    window: { title: "Coin log", icon: "fa-solid fa-receipt", resizable: true },
    position: { width: 720, height: 560 }
  };
  async _renderHTML() {
    const div = document.createElement("div"); div.className = "wct-history-body";
    if (!game.user.isGM) { div.innerHTML = `<p class="wct-pad">The coin log is for GMs.</p>`; return div; }
    const all = entries(); const raw = Vault.get("coinLog", null);
    const rows = all.map(e => {
      const can = M.undoable(raw, e.id);
      const amt = `${e.delta > 0 ? "+" : "−"}${esc(API.fmtMoney(Math.abs(e.delta)))}`;
      return `<tr data-id="${esc(e.id)}" class="${e.undoneAt ? "undone" : ""}"><td class="when">${esc(when(e))}</td><td>${esc(e.actorName)}</td>
        <td class="amt ${e.delta > 0 ? "in" : "out"}">${amt} <small>(${esc(M.coinText(e.coins))})</small></td><td>${esc(e.reason)}</td>
        <td>${e.undoneAt ? "<em>undone</em>" : can ? `<button type="button" data-undo="${esc(e.id)}"><i class="fa-solid fa-rotate-left"></i> Undo</button>` : ""}</td></tr>`;
    }).join("");
    div.innerHTML = `<div class="wct-history-filters"><span class="hint">Coin the toolkit moved, newest first. Undo is offered on the latest ${M.UNDO_WINDOW}: it gives back what was paid, or takes back what was given if the character still has it.</span><span class="spacer"></span>
      <button type="button" data-act="clear" class="wct-danger" ${all.length ? "" : "disabled"}><i class="fa-solid fa-trash"></i> Clear…</button></div>
      <div class="wct-history-list">${all.length ? `<table><thead><tr><th>When</th><th>Who</th><th>Coin</th><th>Why</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : `<p class="hint">Nothing yet. Quest rewards, rooms, flight fares, vendor trash sales, loot coin and Split coin show up here.</p>`}</div>
      <p class="hint">${all.length} entr${all.length === 1 ? "y" : "ies"}. The last ${M.COINLOG_MAX} are kept.</p>`;
    return div;
  }
  _replaceHTML(result, content) {
    content.replaceChildren(result);
    result.querySelectorAll("[data-undo]").forEach(b => b.addEventListener("click", async () => { b.disabled = true; const r = await undo(b.dataset.undo); if (!r.ok) b.disabled = false; }));
    result.querySelector("[data-act=clear]")?.addEventListener("click", () => clear());
  }
}
/** GM: opens the Coin log window. */
export function open() {
  if (!game.user?.isGM) return ui.notifications.warn("The coin log is for GMs.");
  if (!F.need("coinLog")) return undefined;
  const app = foundry.applications.instances?.get?.(APP_ID) ?? new CoinLogApp();
  return app.render({ force: true });
}
function refresh() { const app = foundry.applications.instances?.get?.(APP_ID); if (app?.rendered) app.render(); }

// ---------------------------------------------------------------- Split coin
/** The party actor's members as actors (each once). */
function members(party) {
  const out = []; const seen = new Set();
  for (const m of party?.system?.members ?? []) { const a = m?.actor ?? m; if (a?.id && a.system?.currency && !seen.has(a.id)) { seen.add(a.id); out.push(a); } }
  return out;
}

/** GM: splits the party actor's coin evenly among its members, after a preview. Returns the plan carried out, or null. */
export async function split(party = API?.partyActor?.()) {
  if (!game.user?.isGM) { ui.notifications.warn("GM only."); return null; }
  if (!F.need("splitCoin")) return null;
  if (!party) { ui.notifications.warn(`Split coin: no group actor named ${API.PARTY}.`); return null; }
  const list = members(party);
  const plan = M.splitPlan({ total: API.totalMoney(party), members: list.map(a => ({ id: a.id, name: a.name })) });
  if (!plan.ok) { await API.info("Split coin", `<p><strong>${esc(party.name)}</strong> holds ${esc(API.purse(party))}.</p><p>${esc(plan.error)}</p>`); return null; }
  const go = await API.confirm("Split coin", `<p><strong>${esc(party.name)}</strong> holds ${esc(API.fmtMoney(API.totalMoney(party)))}.</p>
    <ul>${plan.give.map(g => `<li>${esc(g.name)}: <strong>${esc(API.fmtMoney(g.amount))}</strong></li>`).join("")}</ul>
    <p>${plan.remainder ? `${esc(API.fmtMoney(plan.remainder))} doesn't divide evenly and stays with the party.` : "Nothing is left over."}</p><p>Share it out?</p>`);
  if (!go) return null;
  // Check again: the purse may have changed while the preview was open.
  const now = M.splitPlan({ total: API.totalMoney(party), members: list.map(a => ({ id: a.id, name: a.name })) });
  if (!now.ok || now.per !== plan.per) { ui.notifications.warn("Split coin: the party's coin changed while you were deciding. Nothing was moved; try again."); return null; }
  await API.pay(party, now.take, { reason: "Split coin" });
  for (const g of now.give) await API.addMoney(game.actors.get(g.id), g.amount, { reason: "Split coin" });
  await API.say(`<p><i class="fa-solid fa-coins"></i> <strong>${esc(party.name)}</strong> shares out its coin: ${esc(API.fmtMoney(now.per))} each to ${now.give.map(g => esc(g.name)).join(", ")}.${now.remainder ? ` ${esc(API.fmtMoney(now.remainder))} stays with the party.` : ""}</p>`, "Party");
  return now;
}

/** A Split coin button in the party (group) actor sheet's header (GM). */
export function addSplitControl(app, controls) {
  const actor = app?.document ?? app?.actor;
  if (!game.user?.isGM || !(actor instanceof Actor) || actor.type !== "group" || !Array.isArray(controls)) return;
  if (app.options?.actions && !app.options.actions.wctSplitCoin) app.options.actions.wctSplitCoin = async function () { const a = this.document ?? this.actor; if (a) await split(a); };
  controls.push({ icon: "fa-solid fa-divide", label: "Split coin among members", action: "wctSplitCoin", visible: true });
}
