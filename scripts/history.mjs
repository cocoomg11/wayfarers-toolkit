/**
 * Loot roll history (part of Loot rolls; switch: "Keep a loot roll history"). The active GM's client records each finished loot roll in
 * a hidden world setting (newest first, the last 500 kept). A world setting is used rather than a journal: it can't be deleted or
 * edited by accident, and only GMs can write it. The GM-only "Loot history" window lists the rolls (sortable, filtered by player or
 * day) with a per-player tally, exports CSV and clears the history. The pure parts are in history-model.mjs.
 */
import * as H from "./history-model.mjs";
import { isActiveGM } from "./gm.mjs";
import { log } from "./log.mjs";

const ID = "wayfarers-toolkit";
const KEY = "lootHistoryData";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const get = (k, d) => { try { return game.settings.get(ID, k); } catch { return d; } };

export const enabled = () => !!get("lootHistory", true);
/** The stored entries, newest first. */
export function entries() { const v = get(KEY, null); return Array.isArray(v?.entries) ? v.entries.filter(e => e && typeof e === "object") : []; }

export function registerSettings() {
  game.settings.register(ID, "lootHistory", {
    name: "Loot rolls: keep a loot roll history", hint: "Records each finished loot roll (item, who chose what, who got it) for the Loot history window. Only GMs see it.",
    scope: "world", config: false, type: Boolean, default: true
  });
  game.settings.register(ID, KEY, { scope: "world", config: false, type: Object, default: { v: 1, entries: [] }, onChange: () => refresh() });
}

let chain = Promise.resolve();
/** Active GM: adds an entry (writes one at a time, so rolls ending together don't overwrite each other). */
export function record(entry) {
  if (!enabled() || !isActiveGM() || !entry) return chain;
  chain = chain.then(() => game.settings.set(ID, KEY, { v: 1, entries: H.addEntry(entries(), entry) }))
    .then(() => log("Loot history: recorded", entry.item?.name, entry.outcome))
    .catch(e => console.warn(`${ID} | loot history`, e));
  return chain;
}

/** GM: empties the history (asks first unless `confirm: false`). */
export async function clear({ confirm = true } = {}) {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  if (confirm) {
    const n = entries().length;
    const ok = await foundry.applications.api.DialogV2.confirm({ classes: ["wct-window"], window: { title: "Clear loot history" }, content: `<p>Delete all ${n} loot roll${n === 1 ? "" : "s"} from the history? This can't be undone. Export a CSV first if you want a copy.</p>`, rejectClose: false });
    if (!ok) return false;
  }
  await game.settings.set(ID, KEY, { v: 1, entries: [] });
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

// ---------------------------------------------------------------- the window
const HEADS = [["date", "Date"], ["scene", "Scene"], ["item", "Item"], ["outcome", "How it ended"], ["winner", "Received by"]];
const fmtWhen = at => { const d = new Date(at); return Number.isNaN(d.getTime()) ? "" : `${H.dayKey(at)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export class LootHistoryApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${ID}-loot-history`, classes: ["wct-history", "wct-window"],
    window: { title: "Loot history", icon: "fa-solid fa-clock-rotate-left", resizable: true },
    position: { width: 760, height: 620 }
  };
  sort = { key: "date", dir: "desc" };
  filter = { player: "", day: "" };

  async _renderHTML() {
    const div = document.createElement("div"); div.className = "wct-history-body";
    if (!game.user.isGM) { div.innerHTML = `<p class="wct-pad">The loot history is for GMs.</p>`; return div; }
    const all = entries(); const people = H.players(all); const dayList = H.days(all);
    if (this.filter.player && !people.some(p => p.key === this.filter.player)) this.filter.player = "";
    if (this.filter.day && !dayList.includes(this.filter.day)) this.filter.day = "";
    const list = H.sortEntries(H.filterEntries(all, this.filter), this.sort.key, this.sort.dir);
    const tally = H.tally(H.filterEntries(all, { day: this.filter.day }));
    const head = HEADS.map(([k, l]) => `<th><button type="button" data-sort="${k}" class="${this.sort.key === k ? `on ${this.sort.dir}` : ""}">${l}${this.sort.key === k ? ` <i class="fa-solid fa-caret-${this.sort.dir === "asc" ? "up" : "down"}"></i>` : ""}</button></th>`).join("");
    const rows = list.map(e => `<tr data-id="${esc(e.id)}"><td class="when">${esc(fmtWhen(e.at))}</td><td>${esc(e.scene)}</td>
      <td class="item" style="--q:${esc(e.item?.color || "#ffffff")}">${e.item?.img ? `<img src="${esc(e.item.img)}" alt="">` : ""}<span>${esc(e.item?.name)}</span>${e.quantity > 1 ? ` <small>×${e.quantity}</small>` : ""}</td>
      <td class="outcome ${esc(e.outcome)}">${esc(H.OUTCOMES[e.outcome] ?? e.outcome)}</td>
      <td>${esc(H.winnerText(e))}${e.outcome === "won" && e.winner?.tier ? ` <small>(${H.CHOICE_LABELS[e.winner.tier]} ${esc(e.winner.roll ?? "")})</small>` : ""}</td></tr>
      ${e.choices?.length || e.note ? `<tr class="detail"><td></td><td colspan="4">${esc(H.choicesText(e))}${e.note ? `<span class="note">${esc(e.note)}</span>` : ""}</td></tr>` : ""}`).join("");
    const off = enabled() ? "" : `<p class="wct-note warn"><i class="fa-solid fa-power-off"></i> Keep a loot roll history is off (control panel › Loot): new rolls aren't recorded.</p>`;
    div.innerHTML = `${off}<div class="wct-history-filters">
        <label>Player <select data-filter="player"><option value="">Everyone</option>${people.map(p => `<option value="${esc(p.key)}" ${p.key === this.filter.player ? "selected" : ""}>${esc(p.label)}</option>`).join("")}</select></label>
        <label>Session date <select data-filter="day"><option value="">All dates</option>${dayList.map(d => `<option value="${d}" ${d === this.filter.day ? "selected" : ""}>${d}</option>`).join("")}</select></label>
        <span class="spacer"></span>
        <button type="button" data-act="csv" ${list.length ? "" : "disabled"}><i class="fa-solid fa-file-csv"></i> Export CSV</button>
        <button type="button" data-act="clear" class="wct-danger" ${all.length ? "" : "disabled"}><i class="fa-solid fa-trash"></i> Clear history…</button>
      </div>
      <details class="wct-history-tally" open><summary>Per player${this.filter.day ? ` on ${this.filter.day}` : ""}</summary>
        ${tally.length ? `<table><thead><tr><th>Player</th><th>Rolls</th><th>Items received</th><th>Need wins</th><th>Greed wins</th><th>GM assigned</th></tr></thead><tbody>${tally.map(t => `<tr><td>${esc(t.label)}</td><td>${t.rolls}</td><td>${t.won}</td><td>${t.need}</td><td>${t.greed}</td><td>${t.assigned}</td></tr>`).join("")}</tbody></table>` : `<p class="hint">Nobody yet.</p>`}
      </details>
      <div class="wct-history-list">${list.length ? `<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>` : `<p class="hint">${all.length ? "No loot rolls match these filters." : "No loot rolls recorded yet. Finished loot rolls appear here."}</p>`}</div>
      <p class="hint">${list.length} of ${all.length} roll${all.length === 1 ? "" : "s"} shown. The last ${H.HISTORY_MAX} are kept.</p>`;
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
    result.querySelector("[data-act=csv]")?.addEventListener("click", () => exportCSV(H.sortEntries(H.filterEntries(entries(), this.filter), this.sort.key, this.sort.dir)));
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
