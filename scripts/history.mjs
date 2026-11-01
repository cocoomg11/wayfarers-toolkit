/**
 * Loot roll history (part of Loot rolls; switch: "Keep a loot roll history"). The active GM's client records each finished loot roll in
 * a hidden world setting (newest first, the last 500 kept). A world setting is used rather than a journal: it can't be deleted or
 * edited by accident, and only GMs can write it. The GM-only "Loot history" window lists the rolls (sortable, filtered by player or
 * day) with a per-player tally, exports CSV and clears the history. The pure parts are in history-model.mjs.
 */
import * as H from "./history-model.mjs";
import * as Vault from "./vault.mjs";
import { isActiveGM } from "./gm.mjs";
import { log } from "./log.mjs";
import { UI_CLASSES, itemSlot } from "../vendor/wanderers-core/index.mjs";
import * as PM from "./pane-model.mjs";
import { remembered } from "./windows.mjs";

const ID = "wayfarers-toolkit";
const KEY = "lootHistoryData";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const get = (k, d) => { try { return game.settings.get(ID, k); } catch { return d; } };

export const enabled = () => !!get("lootHistory", true);
/** The stored entries, newest first. */
/** GM: the stored rolls, newest first (GM-only store since 1.27.0; the old world setting until the one-time move). Players: []. */
export function entries() {
  if (!game.user?.isGM) return [];
  const v = Vault.get("lootHistory", null) ?? get(KEY, null);
  return Array.isArray(v?.entries) ? v.entries.filter(e => e && typeof e === "object") : [];
}
const save = list => Vault.update(v => ({ ...v, buckets: { ...v.buckets, lootHistory: { v: 1, entries: list } } })).then(() => refresh());

export function registerSettings() {
  game.settings.register(ID, "lootHistory", {
    name: "Loot rolls: keep a loot roll history", hint: "Records each finished loot roll (item, who chose what, who got it) for the Loot history window. Only GMs see it.",
    scope: "world", config: false, type: Boolean, default: true
  });
  // Before 1.27.0 the history lived here, where every client could read it. Kept registered (empty after the one-time move to the
  // GM-only store) so the move can read it and Remove toolkit data resets it.
  game.settings.register(ID, KEY, { scope: "world", config: false, type: Object, default: { v: 1, entries: [] } });
}

let chain = Promise.resolve();
/** Active GM: adds an entry (writes one at a time, so rolls ending together don't overwrite each other). */
export function record(entry) {
  if (!enabled() || !isActiveGM() || !entry) return chain;
  chain = chain.then(() => save(H.addEntry(entries(), entry)))
    .then(() => log("Loot history: recorded", entry.item?.name, entry.outcome))
    .catch(e => console.warn(`${ID} | loot history`, e));
  return chain;
}

/** GM: empties the history (asks first unless `confirm: false`). */
export async function clear({ confirm = true } = {}) {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  if (confirm) {
    const n = entries().length;
    const ok = await foundry.applications.api.DialogV2.confirm({ classes: ["wct-window", "wct-dialog", ...UI_CLASSES], window: { title: "Clear loot history" }, content: `<p>Delete all ${n} loot roll${n === 1 ? "" : "s"} from the history? This can't be undone. Export a CSV first if you want a copy.</p>`, rejectClose: false });
    if (!ok) return false;
  }
  await save([]);
  ui.notifications.info("Loot history cleared.");
  return true;
}

/** Saves CSV text as a file (Foundry's helper when there is one). */
function download(text, name) {
  const save = foundry.utils?.saveDataToFile ?? globalThis.saveDataToFile;
  if (save) return save(text, "text/csv", name);
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
/** GM: downloads the history (or the given entries) as CSV. */
export function exportCSV(list = entries()) {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  download(H.toCSV(list), `loot-history-${H.dayKey(Date.now())}.csv`);
}

/**
 * Sessions from the Red Book (optional; `game.modules.get("red-book").api.session`, GM only: `list()` → [{ id, name, n, open }] and
 * `get(id)` → { startedAt, endedAt, … } in ms). Anything missing or unexpected means no sessions: the window groups by date instead.
 */
export function redBookSessions() {
  try {
    if (!game.modules.get("red-book")?.active) return [];
    const api = /** @type {any} */ (game.modules.get("red-book"))?.api?.session;
    if (typeof api?.list !== "function" || typeof api?.get !== "function") return [];
    const list = api.list(); if (!Array.isArray(list)) return [];
    return H.normalizeSessions(list.slice(0, 500).map(s => {
      /** @type {any} */
      let d = null; try { d = api.get(s?.id); } catch { d = null; }
      return { id: s?.id, name: s?.name, n: s?.n, open: s?.open, startedAt: d?.startedAt, endedAt: d?.endedAt };
    }));
  } catch (e) { console.warn(`${ID} | loot history: Red Book sessions`, e); return []; }
}

// ---------------------------------------------------------------- the window
const HEADS = [["date", "Date"], ["scene", "Scene"], ["item", "Item"], ["outcome", "How it ended"], ["winner", "Received by"]];
const fmtWhen = at => { const d = new Date(at); return Number.isNaN(d.getTime()) ? "" : `${H.dayKey(at)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export class LootHistoryApp extends remembered(foundry.applications.api.ApplicationV2, "lootHistory") {
  static DEFAULT_OPTIONS = {
    id: `${ID}-loot-history`, classes: ["wct-history", "wct-window", ...UI_CLASSES],
    window: { title: "Loot history", icon: "fa-solid fa-clock-rotate-left", resizable: true },
    position: { width: 760, height: 620 }
  };
  sort = { key: "date", dir: "desc" };
  filter = { player: "", day: "", group: "" };
  byGroup = false;
  /** @type {any[]} */
  _sessions = [];

  async _renderHTML() {
    const div = document.createElement("div"); div.className = "wct-history-body";
    if (!game.user.isGM) { div.innerHTML = `<p class="wct-pad">The loot history is for GMs.</p>`; return div; }
    const all = entries(); const people = H.players(all);
    const sessions = redBookSessions(); this._sessions = sessions;
    const groups = H.sessionGroups(all, sessions); const named = groups.some(g => g.session);
    if (this.filter.player && !people.some(p => p.key === this.filter.player)) this.filter.player = "";
    if (this.filter.group && !groups.some(g => g.key === this.filter.group)) this.filter.group = "";
    const groupLabel = this.filter.group ? groups.find(g => g.key === this.filter.group)?.label ?? "" : "";
    const list = H.sortEntries(H.inGroup(H.filterEntries(all, { player: this.filter.player }), this.filter.group, sessions), this.sort.key, this.sort.dir);
    const tally = H.tally(H.inGroup(all, this.filter.group, sessions));
    const cols = HEADS.length;
    const head = HEADS.map(([k, l]) => `<th><button type="button" data-sort="${k}" class="${this.sort.key === k ? `on ${this.sort.dir}` : ""}">${l}${this.sort.key === k ? ` <i class="fa-solid fa-caret-${this.sort.dir === "asc" ? "up" : "down"}"></i>` : ""}</button></th>`).join("");
    const row = e => `<tr data-id="${esc(e.id)}"><td class="when">${esc(fmtWhen(e.at))}</td><td>${esc(e.scene)}</td>
      <td class="item" data-quality="${esc(PM.qualityKey({ color: e.item?.color, rarity: e.item?.rarity || "common" }))}">${e.item?.img ? itemSlot({ img: e.item.img, quality: PM.qualityKey({ color: e.item?.color, rarity: e.item?.rarity || "common" }), name: e.item?.name, size: "sm" }) : ""}<span class="wc-q-text">${esc(e.item?.name)}</span>${e.quantity > 1 ? ` <small>×${e.quantity}</small>` : ""}</td>
      <td class="outcome ${esc(e.outcome)}">${esc(H.OUTCOMES[e.outcome] ?? e.outcome)}</td>
      <td>${esc(H.winnerText(e))}${e.outcome === "won" && e.winner?.tier ? ` <small>(${H.CHOICE_LABELS[e.winner.tier]} ${esc(e.winner.roll ?? "")})</small>` : ""}</td></tr>
      ${e.choices?.length || e.note ? `<tr class="detail"><td></td><td colspan="4">${esc(H.choicesText(e))}${e.note ? `<span class="note">${esc(e.note)}</span>` : ""}</td></tr>` : ""}`;
    // By session: a heading row before each session's (or date's) rolls, in the current sort.
    let rows = "";
    if (this.byGroup) {
      const label = new Map(groups.map(g => [g.key, g.label]));
      const keyOf = e => H.groupKey(e, sessions);
      const order = groups.map(g => g.key).filter(k => list.some(e => keyOf(e) === k));
      for (const k of order) rows += `<tr class="group"><th colspan="${cols}">${esc(label.get(k) ?? k)}</th></tr>${list.filter(e => keyOf(e) === k).map(row).join("")}`;
    } else rows = list.map(row).join("");
    const off = enabled() ? "" : `<p class="wct-note warn"><i class="fa-solid fa-power-off"></i> Keep a loot roll history is off (control panel › Loot): new rolls aren't recorded.</p>`;
    div.innerHTML = `${off}<div class="wct-history-filters">
        <label>Player <select data-filter="player"><option value="">Everyone</option>${people.map(p => `<option value="${esc(p.key)}" ${p.key === this.filter.player ? "selected" : ""}>${esc(p.label)}</option>`).join("")}</select></label>
        <label>${named ? "Session" : "Session date"} <select data-filter="group"><option value="">${named ? "All sessions" : "All dates"}</option>${groups.map(g => `<option value="${esc(g.key)}" ${g.key === this.filter.group ? "selected" : ""}>${esc(g.label)} · ${g.count}</option>`).join("")}</select></label>
        <label class="wct-history-bygroup"><input type="checkbox" data-act="by-group" ${this.byGroup ? "checked" : ""}> By session</label>
        <span class="spacer"></span>
        <button type="button" data-act="csv" ${list.length ? "" : "disabled"}><i class="fa-solid fa-file-csv"></i> Export CSV</button>
        <button type="button" data-act="clear" class="wc-btn wc-btn-danger wct-danger" ${all.length ? "" : "disabled"}><i class="fa-solid fa-trash"></i> Clear history…</button>
      </div>
      <details class="wct-history-tally" open><summary>Per player${groupLabel ? `: ${esc(groupLabel)}` : ""}</summary>
        ${tally.length ? `<table class="wc-table"><thead><tr><th>Player</th><th>Rolls</th><th>Items received</th><th>Need wins</th><th>Greed wins</th><th>GM assigned</th></tr></thead><tbody>${tally.map(t => `<tr><td>${esc(t.label)}</td><td>${t.rolls}</td><td>${t.won}</td><td>${t.need}</td><td>${t.greed}</td><td>${t.assigned}</td></tr>`).join("")}</tbody></table>` : `<p class="hint">Nobody yet.</p>`}
      </details>
      <div class="wct-history-list">${list.length ? `<table class="wc-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>` : `<p class="hint">${all.length ? "No loot rolls match these filters." : "No loot rolls recorded yet. Finished loot rolls appear here."}</p>`}</div>
      <p class="hint">${list.length} of ${all.length} roll${all.length === 1 ? "" : "s"} shown. The last ${H.HISTORY_MAX} are kept. ${named ? "Sessions come from the Red Book; rolls outside every session are grouped by date." : "Grouped by date (the Red Book's sessions are used when it's active)."}</p>`;
    return div;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
    result.querySelectorAll("[data-sort]").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.sort;
      this.sort = this.sort.key === k ? { key: k, dir: this.sort.dir === "asc" ? "desc" : "asc" } : { key: k, dir: k === "date" ? "desc" : "asc" };
      this.render();
    }));
    result.querySelectorAll("[data-filter]").forEach(s => s.addEventListener("change", () => { this.filter[s.dataset.filter] = s.value; this.render(); }));
    result.querySelector("[data-act=by-group]")?.addEventListener("change", ev => { this.byGroup = !!(/** @type {HTMLInputElement} */ (ev.currentTarget).checked); this.render(); });
    result.querySelector("[data-act=csv]")?.addEventListener("click", () => exportCSV(H.sortEntries(H.inGroup(H.filterEntries(entries(), { player: this.filter.player }), this.filter.group, this._sessions ?? []), this.sort.key, this.sort.dir)));
    result.querySelector("[data-act=clear]")?.addEventListener("click", () => clear());
  }
}

/** GM: opens the Loot history window. */
export function open() {
  if (!game.user.isGM) return ui.notifications.warn("The loot history is for GMs.");
  const app = foundry.applications.instances?.get?.(`${ID}-loot-history`) ?? new LootHistoryApp();
  return app.render({ force: true });
}
function refresh() { const app = foundry.applications.instances?.get?.(`${ID}-loot-history`); if (app?.rendered) app.render(); }
