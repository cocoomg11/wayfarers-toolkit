/**
 * The flight network editor (GM): flight points (name, scene, unlocked, note) and routes (from, to, fare, hours, two-way, free), with
 * problems shown inline and Save / Cancel. Opened from the control panel's Travel tab, the Overview fix-its, Flight Master when fewer
 * than two points are open, or api.flight.editor(). Saves the flightNetwork world setting; nothing is written until Save.
 */
import * as Flight from "./flight.mjs";

const ID = "wayfarers-toolkit";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
let API = null;

export function open(api) {
  API = api;
  const app = foundry.applications.instances?.get?.(`${ID}-flight-editor`) ?? new FlightEditor();
  return app.render({ force: true });
}
/** The setting changed (another GM, the API, an import): an open editor with no unsaved edits shows the new network. */
export function refresh() {
  const app = foundry.applications.instances?.get?.(`${ID}-flight-editor`);
  if (app?.rendered && !app.dirty) { app.net = null; app.render(); }
}

const sw = (attr, on, label) => `<label class="wct-switch" data-tooltip="${esc(label)}"><input type="checkbox" ${attr} ${on ? "checked" : ""} aria-label="${esc(label)}"><span class="wct-track" aria-hidden="true"></span></label>`;

export class FlightEditor extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${ID}-flight-editor`, classes: ["wct-panel", "wct-window", "wct-flight-editor"],
    window: { title: "Flight network", icon: "fa-solid fa-feather-pointed", resizable: true },
    position: { width: 880, height: 640 }
  };
  net = null; dirty = false;

  scenes() { return game.scenes.map(s => ({ uuid: s.uuid, name: s.name })).sort((a, b) => a.name.localeCompare(b.name)); }

  pointRow(p, i, scenes) {
    const opts = [`<option value="">No scene</option>`, ...scenes.map(s => `<option value="${esc(s.uuid)}" ${s.uuid === p.sceneUuid ? "selected" : ""}>${esc(s.name)}</option>`)];
    if (p.sceneUuid && !scenes.some(s => s.uuid === p.sceneUuid)) opts.push(`<option value="${esc(p.sceneUuid)}" selected>(deleted scene)</option>`);
    return `<tr data-i="${i}"><td><input type="text" data-f="name" value="${esc(p.name)}" placeholder="e.g. Harbor Town"></td>
      <td><select data-f="sceneUuid">${opts.join("")}</select></td><td class="c">${sw('data-f="unlocked"', p.unlocked, "Unlocked")}</td>
      <td><input type="text" data-f="note" value="${esc(p.note)}" placeholder="GM note (optional)"></td>
      <td><button type="button" class="wct-icon-btn" data-do="rm-point" data-tooltip="Remove flight point" aria-label="Remove flight point"><i class="fa-solid fa-trash"></i></button></td></tr>`;
  }
  routeRow(r, i) {
    const pts = this.net.points;
    const sel = f => `<select data-f="${f}"><option value="">Choose…</option>${pts.map(p => `<option value="${esc(p.id)}" ${p.id === r[f] ? "selected" : ""}>${esc(p.name || "(unnamed)")}</option>`).join("")}${r[f] && !pts.some(p => p.id === r[f]) ? `<option value="${esc(r[f])}" selected>(unknown point)</option>` : ""}</select>`;
    return `<tr data-i="${i}"><td>${sel("from")}</td><td>${sel("to")}</td>
      <td><input type="text" data-f="fare" value="${esc(r.free ? "" : API.fmtMoney(r.fareCp))}" placeholder="${r.free ? "free" : "e.g. 2s or 1g 20s"}" ${r.free ? "disabled" : ""}></td>
      <td><input type="number" data-f="hours" value="${esc(r.hours)}" min="0" step="any"></td>
      <td class="c">${sw('data-f="twoWay"', r.twoWay, "Two-way")}</td><td class="c">${sw('data-f="free"', r.free, "Free route (no fare)")}</td>
      <td><button type="button" class="wct-icon-btn" data-do="rm-route" data-tooltip="Remove route" aria-label="Remove route"><i class="fa-solid fa-trash"></i></button></td></tr>`;
  }

  async _renderHTML() {
    const div = document.createElement("div"); div.className = "wct-fe";
    if (!game.user.isGM) { div.innerHTML = `<p class="wct-pad">The flight network editor is for GMs.</p>`; return div; }
    this.net ??= API.flightNetwork();
    const scenes = this.scenes(); const canImport = !this.net.points.length && !!API.legacyFlightRows();
    const unit = { gp: "gold", sp: "silver", cp: "copper" }[game.settings.get(ID, "fareUnit")] ?? "gold";
    div.innerHTML = `<div class="wct-main">
      ${canImport ? `<div class="wct-banner warn"><i class="fa-solid fa-file-import"></i><div><strong>Flight Routes journal page found</strong><p>Your flight points and routes are on the old journal page. Import them here; the page isn't changed (delete it yourself afterwards if you like).</p><p><button type="button" data-do="import"><i class="fa-solid fa-file-import"></i> Import from the Flight Routes journal page</button></p></div></div>` : ""}
      <h2><i class="fa-solid fa-location-dot"></i> Flight points</h2>
      <p class="hint">Only unlocked points can be flown from or to. A point with no scene still works: the party lands there and the scene stays where it is.</p>
      <table class="wct-grid"><thead><tr><th>Name</th><th>Scene on arrival</th><th class="c">Unlocked</th><th>Note</th><th></th></tr></thead>
        <tbody data-t="points">${this.net.points.map((p, i) => this.pointRow(p, i, scenes)).join("")}</tbody></table>
      <p><button type="button" data-do="add-point"><i class="fa-solid fa-plus"></i> Add flight point</button></p>
      <h2><i class="fa-solid fa-route"></i> Routes</h2>
      <p class="hint">Fare per passenger: type <em>2s</em>, <em>1g 20s</em> or <em>75c</em>; a plain number is in ${unit} (Fares without a coin are in, Travel tab). Flight Master takes the cheapest way through unlocked points. One-way routes fly only from <em>From</em> to <em>To</em>.</p>
      <table class="wct-grid"><thead><tr><th>From</th><th>To</th><th>Fare</th><th>Hours</th><th class="c">Two-way</th><th class="c">Free</th><th></th></tr></thead>
        <tbody data-t="routes">${this.net.routes.map((r, i) => this.routeRow(r, i)).join("")}</tbody></table>
      <p><button type="button" data-do="add-route" ${this.net.points.length < 2 ? "disabled" : ""}><i class="fa-solid fa-plus"></i> Add route</button></p>
      <ul class="wct-problems" data-problems></ul></div>
      <footer class="wct-footer"><span class="hint" data-note></span><button type="button" data-do="cancel"><i class="fa-solid fa-xmark"></i> Cancel</button><button type="button" class="wct-primary" data-do="save"><i class="fa-solid fa-floppy-disk"></i> Save</button></footer>`;
    return div;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
    if (!game.user.isGM) return;
    result.addEventListener("click", ev => { const b = ev.target.closest("[data-do]"); if (b) { ev.preventDefault(); this.act(b.dataset.do, b); } });
    result.addEventListener("input", ev => this.edit(ev.target, false));
    result.addEventListener("change", ev => this.edit(ev.target, true));
    this.check();
  }

  /** Reads one edited control into the model. On change, a fare is parsed and shown formatted; names refresh the route dropdowns. */
  edit(el, committed) {
    const f = el.dataset?.f; const tr = el.closest("tr[data-i]"); if (!f || !tr) return;
    const i = +tr.dataset.i; const kind = tr.parentElement.dataset.t;
    if (kind === "points") {
      const p = this.net.points[i]; if (!p) return;
      if (f === "unlocked") p.unlocked = el.checked; else if (f === "sceneUuid") p.sceneUuid = el.value || null; else p[f] = el.value;
      if (f === "name" && committed) this.redrawRoutes();
    } else {
      const r = this.net.routes[i]; if (!r) return;
      if (f === "fare") { r.fareCp = Math.max(0, API.parseMoney(el.value)); if (committed) el.value = API.fmtMoney(r.fareCp); }
      else if (f === "hours") r.hours = Math.max(0, +el.value || 0);
      else if (f === "twoWay" || f === "free") { r[f] = el.checked; if (f === "free") { const fare = tr.querySelector('[data-f="fare"]'); fare.disabled = r.free; fare.value = r.free ? "" : API.fmtMoney(r.fareCp); } }
      else r[f] = el.value;
    }
    this.dirty = true; this.check();
  }
  redrawRoutes() { const tb = this.element?.querySelector('[data-t="routes"]'); if (tb) tb.innerHTML = this.net.routes.map((r, i) => this.routeRow(r, i)).join(""); }

  check() {
    const root = this.element; if (!root) return [];
    const probs = Flight.validateNetwork(this.net);
    root.querySelectorAll("tr.error, tr.warn").forEach(tr => tr.classList.remove("error", "warn"));
    for (const p of probs) root.querySelector(`[data-t="${p.where === "point" ? "points" : "routes"}"] tr[data-i="${p.index}"]`)?.classList.add(p.level);
    root.querySelector("[data-problems]").innerHTML = probs.map(p => `<li class="${p.level}"><i class="fa-solid ${p.level === "error" ? "fa-circle-xmark" : "fa-triangle-exclamation"}"></i> ${esc(Flight.problemText(p))}.</li>`).join("");
    root.querySelector("[data-note]").textContent = this.dirty ? "Unsaved changes." : "";
    return probs;
  }

  async act(what, btn) {
    try {
      if (what === "add-point") { this.net.points.push({ id: Flight.newId(), name: "", sceneUuid: null, unlocked: false, note: "" }); this.dirty = true; await this.render(); this.element.querySelector('[data-t="points"] tr:last-child input')?.focus(); return; }
      if (what === "add-route") { const [a, b] = this.net.points; this.net.routes.push({ id: Flight.newId(), from: a?.id ?? "", to: b?.id ?? "", fareCp: 0, hours: 1, twoWay: true, free: false }); this.dirty = true; return this.render(); }
      if (what === "rm-point") {
        const i = +btn.closest("tr").dataset.i; const p = this.net.points[i]; const used = this.net.routes.filter(r => r.from === p.id || r.to === p.id).length;
        if (used && !await foundry.applications.api.DialogV2.confirm({ classes: ["wct-window"], window: { title: "Remove flight point" }, content: `<p>Remove <strong>${esc(p.name || "this point")}</strong> and its ${used} route${used === 1 ? "" : "s"}?</p>`, rejectClose: false })) return;
        this.net.points.splice(i, 1); this.net.routes = this.net.routes.filter(r => r.from !== p.id && r.to !== p.id); this.dirty = true; return this.render();
      }
      if (what === "rm-route") { this.net.routes.splice(+btn.closest("tr").dataset.i, 1); this.dirty = true; return this.render(); }
      if (what === "cancel") { this.dirty = false; this.net = null; return this.close(); }
      if (what === "import") {
        const dry = await API.importLegacyFlights({ dryRun: true });
        const ok = await foundry.applications.api.DialogV2.confirm({ classes: ["wct-window"], window: { title: "Import flight routes" }, rejectClose: false,
          content: `<p>Import ${dry.counts.points} flight point${dry.counts.points === 1 ? "" : "s"} (${dry.counts.noScene} without a scene) and ${dry.counts.routes} route${dry.counts.routes === 1 ? "" : "s"}? Routes come in two-way, as before. The journal page isn't changed.</p>${dry.report.length ? `<ul>${dry.report.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}` });
        if (!ok) return;
        await API.importLegacyFlights(); this.dirty = false; this.net = null; ui.notifications.info("Flight Master: flight routes imported.");
        return this.render();
      }
      if (what === "save") {
        const errors = this.check().filter(p => p.level === "error");
        if (errors.length) return ui.notifications.warn("Flight network: fix the rows marked in red first.");
        await API.setFlightNetwork(this.net); this.dirty = false; this.net = null;
        ui.notifications.info("Flight Master: flight network saved.");
        return this.close();
      }
    } catch (e) { console.error(`${ID} | flight editor`, e); ui.notifications.error(`Flight network: ${e.message}`); }
  }
}
