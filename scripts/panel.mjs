/**
 * The control panel (one button in the module settings: "Wayfarer's Toolkit") and the welcome wizard.
 * Tabs: Overview (health in plain words, with fix-it buttons), Features (one switch per tool), Travel, Loot, Boss & Combat, Character,
 * Quests.
 * Every setting keeps its key from earlier versions; the panel only shows them in a friendlier way. What goes where, the labels and
 * the value converters are in panel-model.mjs (tested in Node).
 */
import * as F from "./features.mjs";
import * as Health from "./health.mjs";
import * as Trash from "./trash.mjs";
import * as Cleanup from "./cleanup.mjs";
import { isActiveGM } from "./gm.mjs";
import { MACRO_HINT } from "./macros.mjs";
import * as M from "./panel-model.mjs";
import * as FlightEditor from "./flight-editor.mjs";

const ID = "wayfarers-toolkit";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
let API = null;

const cfgOf = key => game.settings.settings.get(`${ID}.${key}`);
const get = key => { try { return game.settings.get(ID, key); } catch { return undefined; } };
/** Feature condition check: feature ids, plus "coins" for the three-coin economy. */
const isOn = id => id === "coins" ? get("coinSystem") === "threeCoin" : F.on(id);
const featureLabel = id => id === "coins" ? "Three-coin economy" : F.FEATURES.find(f => f.id === id)?.label ?? id;
const help = anchor => `<a class="wct-help" href="${M.README}#${anchor}" target="_blank" rel="noopener" data-tooltip="Help for this tab (README)" aria-label="Help"><i class="fa-solid fa-circle-question"></i></a>`;
const reload = () => { const SC = foundry.applications?.settings?.SettingsConfig; if (SC?.reloadConfirm) return SC.reloadConfirm({ world: true }); foundry.utils.debouncedReload?.() ?? location.reload(); };
const confirm = (title, content) => foundry.applications.api.DialogV2.confirm({ classes: ["wct-window"], window: { title }, content, rejectClose: false });

export function init(api) { API = api; }

/** Opens the control panel, optionally on a tab. */
export function open(tab) {
  const app = foundry.applications.instances?.get?.(`${ID}-panel`) ?? new ControlPanel();
  if (tab) app.tab = tab;
  return app.render({ force: true });
}

// ---------------------------------------------------------------- setting rows
function switchHTML(name, checked, disabled, extra = "") {
  return `<label class="wct-switch"><input type="checkbox" name="${esc(name)}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} ${extra}><span class="wct-track" aria-hidden="true"></span></label>`;
}

function rowHTML([key, cond, kind]) {
  const c = cfgOf(key); const [label, hint] = M.LABELS[key] ?? [c?.name ?? key, c?.hint ?? ""];
  const offIds = (cond ?? "").split(":").filter(Boolean).filter(id => !isOn(id));
  const off = offIds.length > 0 || !c;
  const offNote = offIds.length ? `<p class="wct-offnote"><i class="fa-solid fa-power-off"></i> ${offIds.map(featureLabel).map(esc).join(" and ")} ${offIds.length === 1 ? "is" : "are"} turned off (Features tab).</p>` : !c ? `<p class="wct-offnote">Not available with the tools turned on.</p>` : "";
  const v = c ? get(key) : undefined; const name = esc(key); const dis = off ? "disabled" : "";
  let control = ""; let wide = false;
  if (!c) control = "";
  else if (kind === "zones") { wide = true; control = zonesEditor(v, off); }
  else if (kind === "scenes") { wide = true; control = scenesPicker(v, off); }
  else if (kind === "packs") { wide = true; control = packsPicker(v, off); }
  else if (kind === "classes") { wide = true; control = classesPicker(v, off); }
  else if (kind === "journal" || kind === "groupActor" || kind === "journalFolder") {
    const names = kind === "journal" ? game.journal.map(j => j.name) : kind === "groupActor" ? game.actors.filter(a => a.type === "group").map(a => a.name) : game.folders.filter(f => f.type === "JournalEntry").map(f => f.name);
    const lid = `wct-dl-${key}`;
    control = `<input type="text" name="${name}" value="${esc(v)}" list="${lid}" ${dis}><datalist id="${lid}">${[...new Set(names)].sort().map(n => `<option value="${esc(n)}"></option>`).join("")}</datalist>`;
  }
  else if (c.type === Boolean) control = switchHTML(key, v, off);
  else if (c.choices) control = `<select name="${name}" ${dis}>${Object.entries(c.choices).map(([k, l]) => `<option value="${esc(k)}" ${String(v) === k ? "selected" : ""}>${esc(game.i18n?.localize?.(l) ?? l)}</option>`).join("")}</select>`;
  else if (c.type === Number && c.range) control = `<div class="wct-range"><input type="range" name="${name}" min="${c.range.min}" max="${c.range.max}" step="${c.range.step ?? 1}" value="${esc(v)}" ${dis}><output>${esc(v)}</output></div>`;
  else if (c.type === Number) control = `<input type="number" name="${name}" value="${esc(v)}" step="any" ${dis}>`;
  else if (c.filePicker) control = off ? `<input type="text" value="${esc(v)}" disabled>` : `<file-picker name="${name}" type="${esc(c.filePicker === true ? "any" : c.filePicker)}" value="${esc(v)}"></file-picker>`;
  else control = `<input type="text" name="${name}" value="${esc(v)}" ${dis}>`;
  return `<div class="wct-row ${wide ? "wide" : ""} ${off ? "wct-off" : ""}" data-key="${name}" data-kind="${esc(kind ?? "")}">
    <div class="wct-row-text"><label>${esc(label)}</label>${hint ? `<p class="hint">${esc(hint)}</p>` : ""}${offNote}</div>
    <div class="wct-row-control">${control}</div></div>`;
}

function tableNames() { return game.tables.map(t => t.name).sort((a, b) => a.localeCompare(b)); }
function zoneRowHTML(r, tables, off) {
  const opts = [`<option value="">Choose a roll table…</option>`, ...tables.map(t => `<option value="${esc(t)}" ${t === r.table ? "selected" : ""}>${esc(t)}</option>`)];
  if (r.table && !tables.includes(r.table)) opts.push(`<option value="${esc(r.table)}" selected>${esc(r.table)} (missing)</option>`);
  return `<tr><td><input type="text" data-zone-name value="${esc(r.zone)}" placeholder="Zone name, e.g. Forest" ${off ? "disabled" : ""}></td><td><select data-zone-table ${off ? "disabled" : ""}>${opts.join("")}</select></td>
    <td><button type="button" class="wct-icon-btn" data-zone-remove data-tooltip="Remove zone" aria-label="Remove zone" ${off ? "disabled" : ""}><i class="fa-solid fa-trash"></i></button></td></tr>`;
}
function zonesEditor(v, off) {
  const { rows, error } = M.zonesToRows(v); const tables = tableNames();
  return `<div class="wct-zones">${error ? `<p class="wct-note warn"><i class="fa-solid fa-triangle-exclamation"></i> The saved zones couldn't all be read (${esc(error)}). Saving this tab replaces them with the rows below.</p>` : ""}
    <table><thead><tr><th>Zone</th><th>Encounter roll table</th><th></th></tr></thead><tbody>${rows.map(r => zoneRowHTML(r, tables, off)).join("")}</tbody></table>
    ${tables.length ? "" : `<p class="hint">This world has no roll tables yet. Make one per zone in the Roll Tables sidebar, then pick it here.</p>`}
    <p><button type="button" data-zone-add ${off ? "disabled" : ""}><i class="fa-solid fa-plus"></i> Add zone</button></p><ul class="wct-problems"></ul></div>`;
}
function scenesPicker(v, off) {
  const ticked = M.hiddenToScenes(v); const custom = ticked === null; const set = new Set(ticked ?? []);
  const names = [...new Set(game.scenes.map(s => s.name))].sort((a, b) => a.localeCompare(b));
  // The pre-1.15 default names two example scenes; only show them when they exist.
  const gone = String(v ?? "") === M.LEGACY_HIDDEN ? [] : [...set].filter(n => !names.includes(n));
  const box = (n, missing) => `<label class="wct-check"><input type="checkbox" data-scene value="${esc(n)}" ${set.has(n) ? "checked" : ""} ${off ? "disabled" : ""}> ${esc(n)}${missing ? ` <span class="hint">(no such scene)</span>` : ""}</label>`;
  return `<div class="wct-checklist">${custom ? `<p class="wct-note"><i class="fa-solid fa-circle-info"></i> You're using a custom pattern (see Advanced). Ticking scenes here replaces it.</p>` : ""}
    ${names.length || gone.length ? `<div class="wct-checks">${names.map(n => box(n, false)).join("")}${gone.map(n => box(n, true)).join("")}</div>` : `<p class="hint">No scenes in this world yet.</p>`}</div>`;
}
function packsPicker(v, off) {
  const set = new Set(M.packsToList(v));
  const packs = [...game.packs].filter(p => p.documentName === "Item").map(p => ({ id: p.collection, label: p.metadata?.label ?? p.title ?? p.collection, src: game.modules.get(p.metadata?.packageName)?.title ?? (p.metadata?.packageType === "world" ? "This world" : p.metadata?.packageName ?? "") }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const gone = [...set].filter(id => !packs.some(p => p.id === id));
  const box = (id, label, src) => `<label class="wct-check"><input type="checkbox" data-pack value="${esc(id)}" ${set.has(id) ? "checked" : ""} ${off ? "disabled" : ""}> ${esc(label)} <span class="hint">${esc(src)}</span></label>`;
  let fallback = ""; try { fallback = !set.size ? Trash.packIds().map(id => game.packs.get(id)?.metadata?.label ?? id).join(", ") : ""; } catch { }
  return `<div class="wct-checklist">${!set.size ? `<p class="wct-note"><i class="fa-solid fa-circle-info"></i> None ticked: ${fallback ? `using ${esc(fallback)}.` : "no default compendium is installed, so nothing drops until you tick one."}</p>` : ""}
    <div class="wct-checks">${packs.map(p => box(p.id, p.label, p.src)).join("")}${gone.map(id => box(id, id, "not found")).join("")}</div></div>`;
}
/** The classes in this world (class items in the sidebar, on actors and in class compendiums) and the core ones: [{ id, label }]. */
function worldClasses() {
  const out = new Map(); const add = (id, label) => { id = String(id ?? "").toLowerCase(); if (id && !out.has(id)) out.set(id, label || id[0].toUpperCase() + id.slice(1)); };
  const ofItem = i => { if (i?.type === "class") add(i.system?.identifier || i.name?.slugify?.() || i.name, i.name); };
  for (const i of game.items ?? []) ofItem(i);
  for (const a of game.actors ?? []) for (const i of a.items ?? []) ofItem(i);
  for (const p of game.packs ?? []) if (p.documentName === "Item") for (const e of p.index ?? []) if (e.type === "class") add(e.system?.identifier || e.name?.slugify?.() || e.name, e.name);
  for (const id of ["artificer", "barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"]) add(id);
  return [...out].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
}
function classesPicker(v, off) {
  const set = new Set(M.classesToList(v)); const list = worldClasses();
  const gone = [...set].filter(id => !list.some(c => c.id === id));
  const box = (id, label, note) => `<label class="wct-check"><input type="checkbox" data-class value="${esc(id)}" ${set.has(id) ? "checked" : ""} ${off ? "disabled" : ""}> ${esc(label)} <span class="hint">${esc(note)}</span></label>`;
  return `<div class="wct-checklist"><div class="wct-checks">${list.map(c => box(c.id, c.label, c.label.toLowerCase() === c.id ? "" : c.id)).join("")}${gone.map(id => box(id, id, "not in this world")).join("")}</div></div>`;
}
/** Advanced raw field for a hand-written hidden-scenes pattern. */
function rawScenesRow(off) {
  const v = get("hiddenScenes"); if (M.hiddenToScenes(v) !== null) return "";
  return `<div class="wct-row ${off ? "wct-off" : ""}" data-key="hiddenScenes__raw"><div class="wct-row-text"><label>Scenes left out of Session Start (custom pattern)</label>
    <p class="hint">A pattern written by hand in an earlier version. Scene names it matches are left out. Leave it, edit it, or tick scenes in the checklist above to replace it.</p></div>
    <div class="wct-row-control"><input type="text" name="hiddenScenes__raw" value="${esc(v)}" ${off ? "disabled" : ""}></div></div>`;
}

function settingsTab(tab) {
  const advanced = [...(tab.advanced ?? []).map(rowHTML), tab.id === "travel" ? rawScenesRow(!isOn("sessionStart")) : ""].join("");
  const flights = tab.id === "travel" ? `<div class="wct-actions"><button type="button" data-act="flight-editor" ${F.on("flightMaster") ? "" : "disabled"}><i class="fa-solid fa-feather-pointed"></i> Flight network…</button><span class="hint">Flight points, the scene each opens (or none), what's unlocked, and the routes with their fares and hours.</span></div>` : "";
  const actions = tab.id === "boss" ? `<div class="wct-actions"><button type="button" data-act="autolink" ${F.on("bossLoot") ? "" : "disabled"}><i class="fa-solid fa-link"></i> Link boss tables by name</button><span class="hint">Links each creature to the roll table named "<em>creature name</em> · Loot". Existing links are kept.</span></div>` : "";
  return `<header class="wct-tab-head"><h2><i class="${tab.icon}"></i> ${esc(tab.label)}</h2>${help(tab.anchor)}</header>
    <div class="wct-rows">${tab.basic.map(rowHTML).join("")}</div>${flights}${actions}
    ${advanced ? `<details class="wct-advanced"><summary>Advanced</summary><div class="wct-rows">${advanced}</div></details>` : ""}
    <p class="wct-reset"><button type="button" data-act="reset-tab" data-tab="${tab.id}"><i class="fa-solid fa-rotate-left"></i> Reset this tab to defaults</button></p>`;
}

function featuresTab() {
  const tab = M.TABS.find(t => t.id === "features");
  const card = c => {
    const f = F.FEATURES.find(x => x.id === c.id);
    const checked = c.id === "coins" ? get("coinSystem") === "threeCoin" : F.on(c.id);
    const label = c.label ?? f?.label ?? c.id;
    return `<div class="wct-card ${checked ? "on" : ""}" data-feature="${c.id}"><i class="wct-card-icon ${c.icon}"></i><div class="wct-card-text"><strong>${esc(label)}</strong><p>${esc(c.text)}</p></div>${switchHTML(`feature:${c.id}`, checked, false, `aria-label="${esc(label)}"`)}</div>`;
  };
  return `<header class="wct-tab-head"><h2><i class="${tab.icon}"></i> Features</h2>${help(tab.anchor)}</header>
    <p class="hint">Switch off what this world doesn't use: it then adds no buttons, macros or chat cards. Nothing in your world is deleted, and its settings stay (greyed out) in the other tabs.</p>
    <div class="wct-cards">${M.FEATURE_CARDS.map(card).join("")}</div>
    <div class="wct-actions sticky"><button type="button" class="wct-primary" data-act="save-features"><i class="fa-solid fa-rotate"></i> Save features (reloads Foundry for everyone)</button></div>`;
}

function overviewTab() {
  const tab = M.TABS.find(t => t.id === "overview");
  return `<header class="wct-tab-head"><h2><i class="${tab.icon}"></i> Overview</h2>${help(tab.anchor)}</header>
    <div class="wct-status" data-status><p class="hint"><i class="fa-solid fa-spinner fa-spin"></i> Checking your world…</p></div>
    <div class="wct-actions wrap">
      <button type="button" data-act="setup"><i class="fa-solid fa-hammer"></i> Run setup</button>
      <button type="button" data-act="health"><i class="fa-solid fa-stethoscope"></i> Full health report (to chat)</button>
      <button type="button" data-act="recheck"><i class="fa-solid fa-rotate"></i> Check again</button>
      <button type="button" data-act="wizard"><i class="fa-solid fa-wand-magic-sparkles"></i> Run the welcome wizard</button>
      <button type="button" data-act="update-notes"><i class="fa-solid fa-bullhorn"></i> Show update notes</button>
      <button type="button" data-act="cleanup" class="wct-danger"><i class="fa-solid fa-broom"></i> Remove toolkit data…</button>
    </div>
    <div class="wct-rows"><div class="wct-row wct-instant" data-key="updateNotes"><div class="wct-row-text"><label>${esc(M.LABELS.updateNotes[0])}</label><p class="hint">${esc(M.LABELS.updateNotes[1])}</p></div>
      <div class="wct-row-control">${switchHTML("updateNotes", get("updateNotes") !== false, false, 'data-instant')}</div></div></div>
    <p class="hint"><strong>Run setup</strong> creates what the tools need (tracker journal, party actor, macros in a <em>Wayfarer's Toolkit</em> macro folder) and never overwrites anything. Drag macros to your hotbar from that folder or the <em>Wayfarer's Toolkit Macros</em> compendium.</p>`;
}

/** Health check sections → plain issues: [{ text (HTML), fix }]. */
function issuesFrom(sections) {
  const out = []; const missing = [];
  for (const s of sections) {
    if (s.title === "Features") continue;
    for (const l of s.lines) {
      if (l.level !== "warn" && l.level !== "bad") continue;
      const tmp = document.createElement("div"); tmp.innerHTML = l.text;
      const hasAutolink = !!tmp.querySelector("[data-wct-action=autolink-boss]"); tmp.querySelectorAll("button").forEach(b => b.remove());
      if (s.title === "Setup") { missing.push(tmp.textContent.replace(/: missing$/, "").trim()); continue; }
      out.push({ level: l.level, text: tmp.innerHTML.trim(), fix: M.issueFix(s.title, tmp.textContent, { hasAutolink }) });
    }
  }
  if (missing.length) out.unshift({ level: "bad", text: `Setup hasn't made everything the tools need yet: ${missing.map(esc).join(", ")}.`, fix: { action: "setup", label: "Run setup" } });
  return out;
}

// ---------------------------------------------------------------- the window
export class ControlPanel extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${ID}-panel`, classes: ["wct-panel", "wct-window"],
    window: { title: "Wayfarer's Toolkit", icon: "fa-solid fa-toolbox", resizable: true },
    position: { width: 820, height: 640 }
  };
  tab = "overview";

  async _renderHTML() {
    const div = document.createElement("div"); div.className = "wct-panel-body";
    if (!game.user.isGM) { div.innerHTML = `<p class="wct-pad">The control panel is for GMs.</p>`; return div; }
    const tabs = M.TABS;
    const body = t => t.id === "overview" ? overviewTab() : t.id === "features" ? featuresTab() : settingsTab(t);
    div.innerHTML = `<nav class="wct-tabs" role="tablist">${tabs.map(t => `<button type="button" role="tab" data-tab="${t.id}"><i class="${t.icon}"></i><span>${esc(t.label)}</span></button>`).join("")}</nav>
      <div class="wct-main">${tabs.map(t => `<section class="wct-tab" data-tab="${t.id}" role="tabpanel">${body(t)}</section>`).join("")}</div>
      <footer class="wct-footer"><span class="hint" data-dirty-note></span><button type="button" class="wct-primary" data-act="save"><i class="fa-solid fa-floppy-disk"></i> Save changes</button></footer>`;
    return div;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
    if (!game.user.isGM) return;
    const root = result;
    root.querySelectorAll(".wct-tabs [data-tab]").forEach(b => b.addEventListener("click", () => this.show(b.dataset.tab)));
    this.show(this.tab);
    root.addEventListener("click", ev => { const b = ev.target.closest("[data-act]"); if (b) { ev.preventDefault(); this.act(b.dataset.act, b); } });
    // Live bits: range values, dirty markers, the zones editor and the features page.
    root.querySelectorAll(".wct-range input").forEach(r => r.addEventListener("input", () => { r.nextElementSibling.value = r.value; }));
    root.querySelectorAll(".wct-tab:not([data-tab=features]) .wct-row:not(.wct-instant)").forEach(row => {
      const mark = () => { row.dataset.dirty = "1"; this.markDirty(); };
      row.addEventListener("input", mark); row.addEventListener("change", mark);
    });
    // Overview switches save at once (that tab has no Save button).
    root.querySelectorAll("input[data-instant]").forEach(i => i.addEventListener("change", async () => {
      try { await game.settings.set(ID, i.name, i.checked); ui.notifications.info(`Wayfarer's Toolkit: ${M.LABELS[i.name]?.[0] ?? i.name}: ${i.checked ? "on" : "off"}.`); }
      catch (e) { i.checked = !i.checked; ui.notifications.error(`Wayfarer's Toolkit: ${e.message}`); }
    }));
    this.wireZones(root);
    root.querySelectorAll(".wct-card input").forEach(i => i.addEventListener("change", () => { i.closest(".wct-card").classList.toggle("on", i.checked); this.featureDeps(); }));
    this.featureDeps();
    this.loadOverview();
  }

  show(tab) {
    if (!M.TABS.some(t => t.id === tab)) tab = "overview";
    this.tab = tab; const root = this.element; if (!root) return;
    root.querySelectorAll(".wct-tabs [data-tab]").forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle("active", on); b.setAttribute("aria-selected", on); });
    root.querySelectorAll(".wct-tab").forEach(s => { s.hidden = s.dataset.tab !== tab; });
    root.querySelector(".wct-footer").hidden = tab === "overview" || tab === "features";
  }

  markDirty() {
    const n = this.element?.querySelectorAll(".wct-row[data-dirty]").length ?? 0;
    const el = this.element?.querySelector("[data-dirty-note]"); if (el) el.textContent = n ? `Unsaved changes in ${n} setting${n === 1 ? "" : "s"} (all tabs).` : "";
  }

  /** Quest tracker needs the quest log: shown as not available while the quest log switch is off. */
  featureDeps() {
    const root = this.element; if (!root) return;
    const log = root.querySelector('[name="feature:questLog"]'); const tr = root.querySelector('[data-feature="questTracker"]');
    if (log && tr) tr.classList.toggle("wct-needs", !log.checked);
  }

  wireZones(root) {
    const box = root.querySelector(".wct-zones"); if (!box) return;
    const tables = tableNames(); const tbody = box.querySelector("tbody");
    const check = () => {
      const rows = this.zoneRows(); const probs = M.zoneRowProblems(rows, tables);
      const trs = [...tbody.querySelectorAll("tr")]; trs.forEach(tr => tr.classList.remove("error", "warn"));
      for (const p of probs) trs[p.row]?.classList.add(p.level === "error" ? "error" : "warn");
      box.querySelector(".wct-problems").innerHTML = probs.map(p => `<li class="${p.level}"><i class="fa-solid ${p.level === "error" ? "fa-circle-xmark" : "fa-triangle-exclamation"}"></i> Row ${p.row + 1}: ${esc(p.message)}.</li>`).join("");
      return probs;
    };
    box.addEventListener("input", check); box.addEventListener("change", check);
    box.addEventListener("click", ev => {
      if (ev.target.closest("[data-zone-add]")) { tbody.insertAdjacentHTML("beforeend", zoneRowHTML({ zone: "", table: "" }, tables, false)); tbody.lastElementChild.querySelector("input")?.focus(); }
      else if (ev.target.closest("[data-zone-remove]")) ev.target.closest("tr").remove();
      else return;
      box.closest(".wct-row").dataset.dirty = "1"; this.markDirty(); check();
    });
    this.checkZones = check; check();
  }
  zoneRows() { return [...(this.element?.querySelectorAll(".wct-zones tbody tr") ?? [])].map(tr => ({ zone: tr.querySelector("[data-zone-name]").value, table: tr.querySelector("[data-zone-table]").value })); }

  async loadOverview() {
    const box = this.element?.querySelector("[data-status]"); if (!box || !API) return;
    let sections; try { sections = await Health.run(API); } catch (e) { box.innerHTML = `<p class="wct-note warn">The health check couldn't run: ${esc(e.message)}</p>`; return; }
    const issues = issuesFrom(sections);
    const on = F.FEATURES.filter(f => F.on(f.id)).map(f => f.label);
    const head = issues.length
      ? `<div class="wct-banner warn"><i class="fa-solid fa-triangle-exclamation"></i><div><strong>${issues.length} thing${issues.length === 1 ? " needs" : "s need"} attention</strong><p>Each has a button to fix it where there's a quick fix.</p></div></div>`
      : `<div class="wct-banner ok"><i class="fa-solid fa-circle-check"></i><div><strong>Everything looks good</strong><p>Setup is complete and nothing needs fixing for the tools turned on.</p></div></div>`;
    this.issues = issues;
    box.innerHTML = `${head}${issues.length ? `<ul class="wct-issues">${issues.map((i, n) => `<li class="${i.level}"><span class="wct-issue-text">${i.text}</span>${i.fix ? `<button type="button" data-act="fix" data-issue="${n}">${esc(i.fix.label)}</button>` : ""}</li>`).join("")}</ul>` : ""}
      <p class="hint">Tools on: ${on.length ? on.map(esc).join(", ") : "none"}. Coins: ${get("coinSystem") === "threeCoin" ? "three coins" : "standard 5e"}. Party size: ${esc(get("partySize"))}. Version ${esc(API.version ?? "")}.</p>`;
  }

  async act(act, btn) {
    try {
      if (act === "save") return await this.save();
      if (act === "save-features") return await this.saveFeatures();
      if (act === "reset-tab") return await this.resetTab(btn.dataset.tab);
      if (act === "setup") return await runSetup(() => this.loadOverview());
      if (act === "health") return API.health();
      if (act === "recheck") return this.loadOverview();
      if (act === "wizard") return new WelcomeWizard().render({ force: true });
      if (act === "update-notes") return API.updateNotes.show();
      if (act === "cleanup") return new Cleanup.CleanupApp().render({ force: true });
      if (act === "flight-editor") return API.flightEditor();
      if (act === "autolink") { btn.disabled = true; await API.bossLoot?.autoLink(); btn.disabled = false; return this.loadOverview(); }
      if (act === "fix") return await this.fix(this.issues?.[+btn.dataset.issue]?.fix, btn);
    } catch (e) { console.error(`${ID} | control panel`, e); ui.notifications.error(`Wayfarer's Toolkit: ${e.message}`); }
  }

  async fix(fix, btn) {
    if (!fix) return;
    if (fix.action === "setup") return runSetup(() => this.loadOverview());
    if (fix.action === "tab") return this.show(fix.tab);
    if (fix.action === "reload") return foundry.utils.debouncedReload?.() ?? location.reload();
    if (fix.action === "autolink") { btn.disabled = true; await API.bossLoot?.autoLink(); return this.loadOverview(); }
    if (fix.action === "flights") return API.flightEditor();
    if (fix.action === "flightImport") { if (await FlightEditor.importFlow(API)) this.loadOverview(); return; }
    if (fix.action === "rules") {
      const j = game.journal.getName(API.JOURNAL); if (!j) return runSetup(() => this.loadOverview());
      const page = j.pages.getName(Trash.RULES_PAGE);
      return j.sheet.render({ force: true, ...(page ? { pageId: page.id } : {}) });
    }
  }

  /** Values to write from the setting tabs: [[key, value]] (only rows that changed; turned-off rows are skipped). */
  collect() {
    const root = this.element; const out = []; const changed = (k, v) => { if (JSON.stringify(v) !== JSON.stringify(get(k))) out.push([k, v]); };
    for (const row of root.querySelectorAll(".wct-tab .wct-row:not(.wct-off):not(.wct-instant)")) {
      const key = row.dataset.key; const kind = row.dataset.kind; const c = cfgOf(key); const dirty = !!row.dataset.dirty;
      if (key === "hiddenScenes__raw") continue;
      if (!c) continue;
      if (kind === "zones") { if (dirty) changed(key, M.rowsToZones(this.zoneRows())); continue; }
      if (kind === "scenes") {
        const raw = root.querySelector('[name="hiddenScenes__raw"]:not(:disabled)');
        if (dirty) changed(key, M.scenesToRegex([...row.querySelectorAll("[data-scene]:checked")].map(i => i.value)));
        else if (raw && raw.value !== get(key)) changed(key, raw.value);
        continue;
      }
      if (kind === "packs") { if (dirty) changed(key, M.listToPacks([...row.querySelectorAll("[data-pack]:checked")].map(i => i.value))); continue; }
      if (kind === "classes") { if (dirty) changed(key, M.listToClasses([...row.querySelectorAll("[data-class]:checked")].map(i => i.value))); continue; }
      const el = row.querySelector(`[name="${CSS.escape(key)}"]`); if (!el) continue;
      if (c.type === Boolean) changed(key, !!el.checked);
      else if (c.type === Number) { const n = Number(el.value); if (Number.isFinite(n) && String(el.value).trim() !== "") changed(key, c.range ? Math.min(c.range.max, Math.max(c.range.min, n)) : n); }
      else changed(key, String(el.value ?? ""));
    }
    return out;
  }

  async save() {
    if (this.element.querySelector('.wct-row[data-key="zones"]:not(.wct-off)')) {
      const errors = (this.checkZones?.() ?? []).filter(p => p.level === "error");
      if (errors.length) { this.show("travel"); return ui.notifications.warn("Encounter zones: fix the rows marked in red first."); }
    }
    const list = this.collect(); let needReload = false;
    for (const [k, v] of list) { await game.settings.set(ID, k, v); if (cfgOf(k)?.requiresReload) needReload = true; }
    ui.notifications.info(list.length ? `Wayfarer's Toolkit: saved ${list.length} setting${list.length === 1 ? "" : "s"}.` : "Wayfarer's Toolkit: nothing changed.");
    await this.render();
    if (needReload) reload();
  }

  async saveFeatures() {
    const root = this.element; const writes = [];
    for (const f of F.FEATURES) { const el = root.querySelector(`[name="feature:${f.id}"]`); if (el && el.checked !== F.on(f.id)) writes.push([f.key, el.checked]); }
    const coin = root.querySelector('[name="feature:coins"]');
    if (coin) { const v = coin.checked ? "threeCoin" : "standard"; if (v !== get("coinSystem")) writes.push(["coinSystem", v]); }
    if (!writes.length) return ui.notifications.info("Wayfarer's Toolkit: no feature changed.");
    for (const [k, v] of writes) await game.settings.set(ID, k, v);
    await this.close();
    reload();
  }

  async resetTab(id) {
    const tab = M.TABS.find(t => t.id === id); if (!tab?.basic) return;
    const ok = await confirm("Reset to defaults", `<p>Put every setting on the <strong>${esc(tab.label)}</strong> tab (Advanced included) back to its default?</p><p class="hint">Your journals, tables, scenes and other tabs aren't touched.</p>`);
    if (!ok) return;
    let n = 0;
    for (const key of M.tabKeys(tab)) {
      const c = cfgOf(key); if (!c) continue;
      const def = foundry.utils.deepClone(c.default);
      if (JSON.stringify(get(key)) !== JSON.stringify(def)) { await game.settings.set(ID, key, def); n++; }
    }
    ui.notifications.info(`Wayfarer's Toolkit: ${tab.label} reset (${n} setting${n === 1 ? "" : "s"} changed).`);
    await this.render();
  }
}

async function runSetup(after) {
  try {
    const r = await API.setup();
    ui.notifications.info(`Wayfarer's Toolkit: ${r?.length ? "created " + r.join(", ") : "everything already exists"}. ${MACRO_HINT}`);
  } catch (e) { ui.notifications.error(`Wayfarer's Toolkit setup: ${e.message}`); }
  await after?.();
}

// ---------------------------------------------------------------- welcome wizard
export class WelcomeWizard extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${ID}-wizard`, classes: ["wct-wizard", "wct-window"],
    window: { title: "Welcome to Wayfarer's Toolkit", icon: "fa-solid fa-wand-magic-sparkles", resizable: true },
    position: { width: 620, height: "auto" }
  };
  step = 0;
  data = { preset: "classic", partySize: null, coinSystem: null, campaignName: null };

  async _renderHTML() {
    const d = this.data;
    d.partySize ??= get("partySize") ?? 4; d.coinSystem ??= get("coinSystem") ?? "standard"; d.campaignName ??= get("campaignName") ?? "";
    const div = document.createElement("div"); div.className = "wct-wizard-body";
    const dots = [0, 1, 2].map(i => `<span class="${i === this.step ? "on" : i < this.step ? "done" : ""}"></span>`).join("");
    let body = "";
    if (this.step === 0) body = `<h2>Pick a style</h2><p class="hint">Which tools to switch on. You can change every one later in the control panel's Features tab.</p>
      <div class="wct-presets">${Object.entries(M.PRESETS).map(([k, p]) => `<label class="wct-preset ${d.preset === k ? "on" : ""}"><input type="radio" name="preset" value="${k}" ${d.preset === k ? "checked" : ""}><i class="${p.icon}"></i><strong>${esc(p.label)}</strong><span>${esc(p.text)}</span></label>`).join("")}</div>`;
    else if (this.step === 1) body = `<h2>How big is the party?</h2><p class="hint">How many player characters. Boss loot coin grows with the party, and parties over four get an extra boss drop.</p>
      <div class="wct-range big"><input type="range" name="partySize" min="1" max="8" step="1" value="${esc(d.partySize)}"><output>${esc(d.partySize)}</output></div>`;
    else body = `<h2>Coins and campaign</h2>
      <div class="wct-presets two">${[["standard", "Standard 5e coins", "Copper, silver, electrum, gold and platinum, as in the rules."], ["threeCoin", "Three coins", "Copper, silver and gold only, 100 to 1. Item prices aren't changed; see the README."]].map(([k, l, t]) => `<label class="wct-preset ${d.coinSystem === k ? "on" : ""}"><input type="radio" name="coinSystem" value="${k}" ${d.coinSystem === k ? "checked" : ""}><i class="fa-solid fa-coins"></i><strong>${l}</strong><span>${t}</span></label>`).join("")}</div>
      ${M.PRESETS[d.preset]?.suggestCoins === "threeCoin" && d.coinSystem !== "threeCoin" ? `<p class="hint">Tip: the Classic MMO style pairs well with three coins.</p>` : ""}
      <div class="wct-row"><div class="wct-row-text"><label>Campaign name</label><p class="hint">Shown in the session recap: "Previously, in …". Leave blank to use the world's title.</p></div><div class="wct-row-control"><input type="text" name="campaignName" value="${esc(d.campaignName)}" placeholder="${esc(game.world?.title ?? "")}"></div></div>`;
    div.innerHTML = `<div class="wct-steps">${dots}<span class="hint">Step ${this.step + 1} of 3</span></div>${body}
      <footer class="wct-footer"><button type="button" data-w="skip">Skip, I'll set it up myself</button><span class="spacer"></span>
      ${this.step ? `<button type="button" data-w="back"><i class="fa-solid fa-arrow-left"></i> Back</button>` : ""}
      ${this.step < 2 ? `<button type="button" class="wct-primary" data-w="next">Next <i class="fa-solid fa-arrow-right"></i></button>` : `<button type="button" class="wct-primary" data-w="finish"><i class="fa-solid fa-check"></i> Finish (reloads Foundry)</button>`}</footer>`;
    return div;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
    const read = () => {
      const q = n => result.querySelector(`[name="${n}"]:checked`)?.value ?? result.querySelector(`[name="${n}"]`)?.value;
      if (this.step === 0) this.data.preset = q("preset") ?? this.data.preset;
      if (this.step === 1) this.data.partySize = Math.min(8, Math.max(1, Math.round(+q("partySize") || 4)));
      if (this.step === 2) { this.data.coinSystem = q("coinSystem") ?? this.data.coinSystem; this.data.campaignName = String(q("campaignName") ?? ""); }
    };
    result.querySelectorAll(".wct-range input").forEach(r => r.addEventListener("input", () => { r.nextElementSibling.value = r.value; }));
    result.querySelectorAll(".wct-preset input").forEach(i => i.addEventListener("change", () => { read(); this.render(); }));
    result.addEventListener("click", async ev => {
      const b = ev.target.closest("[data-w]"); if (!b) return; ev.preventDefault(); read();
      const w = b.dataset.w;
      if (w === "next") { this.step++; return this.render(); }
      if (w === "back") { this.step--; return this.render(); }
      if (w === "skip") return this.close();
      if (w === "finish") { b.disabled = true; return this.finish(); }
    });
  }

  /** Closing the wizard any way (Skip, the window's close button, Finish) means it isn't shown automatically again. */
  _onClose(options) {
    super._onClose?.(options);
    if (game.user.isGM && !get("wizardDone")) game.settings.set(ID, "wizardDone", true).catch(() => { });
  }

  async finish() {
    const d = this.data; const writes = Object.entries(M.presetSettings(d.preset));
    writes.push(["partySize", d.partySize], ["coinSystem", d.coinSystem], ["campaignName", d.campaignName], ["wizardDone", true]);
    let reloadNeeded = false;
    for (const [k, v] of writes) if (JSON.stringify(get(k)) !== JSON.stringify(v)) { await game.settings.set(ID, k, v); if (cfgOf(k)?.requiresReload) reloadNeeded = true; }
    await this.close();
    const go = await confirm("Run setup now?", `<p>Settings saved. <strong>Run setup</strong> now creates what the tools you picked need: the tracker journal, the party actor and the macros (in a <em>Wayfarer's Toolkit</em> macro folder; nothing goes on any hotbar). It never overwrites anything.</p>${reloadNeeded ? "<p>Foundry then reloads to switch the tools on.</p>" : ""}`);
    if (go) await runSetup();
    if (reloadNeeded) reload();
  }
}

/**
 * Ready, active GM only: shows the welcome wizard once on a fresh world. A world that already uses the toolkit (a setting changed,
 * anything setup makes, or an earlier version loaded here) is marked done without showing it. Call before the update notes run.
 */
export async function maybeWelcome(api) {
  if (!isActiveGM() || get("wizardDone")) return false;
  const settings = [];
  for (const [, c] of game.settings.settings) if (c.namespace === ID && c.scope === "world") settings.push({ key: c.key, scope: c.scope, value: get(c.key), default: c.default });
  let setupFound = false;
  try { setupFound = api.setupPlan().some(p => p.ok) || !!game.folders.find(f => f.name === "Wayfarer's Toolkit") || !!game.journal.getName(api.JOURNAL) || !!api.partyActor(); } catch { }
  if (M.worldConfigured({ settings, setupFound, remindedVersion: get("setupReminded") || get("lastSeenVersion") || "", version: api.version ?? "" })) { await game.settings.set(ID, "wizardDone", true); return false; }
  new WelcomeWizard().render({ force: true });
  return true;
}
