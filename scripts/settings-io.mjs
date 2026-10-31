/**
 * Settings export / import (feature "settingsIO"), GM only. Export downloads every toolkit setting as JSON, world settings and this
 * browser's own (client) settings in separate sections. Import reads a file, checks it against the settings this version has
 * (settings-io-model.mjs), shows a preview of what would change with a tick per setting, and writes only after the GM confirms.
 * Unknown keys and values that don't fit are left out with a warning. Opened from control panel › Overview.
 */
import * as M from "./settings-io-model.mjs";

const ID = "wayfarers-toolkit";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const get = k => { try { return game.settings.get(ID, k); } catch { return undefined; } };
let API = null;

/** This module's registered settings: Map key → { scope, type, choices, range, name, requiresReload, default }. */
function defs() {
  const out = new Map();
  for (const [, c] of game.settings.settings) if (c.namespace === ID) out.set(c.key, { scope: c.scope, type: c.type, choices: c.choices, range: c.range, name: c.name, requiresReload: !!c.requiresReload, default: c.default });
  return out;
}

/** GM: downloads the settings file. */
export function exportFile(api) {
  API = api;
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const list = [...defs()].map(([key, d]) => ({ key, scope: d.scope, value: get(key) }));
  const data = M.buildExport(list, { version: api.version ?? "", exported: new Date().toISOString() });
  const text = JSON.stringify(data, null, 2); const name = M.fileName(game.world?.id ?? "");
  const save = foundry.utils?.saveDataToFile ?? globalThis.saveDataToFile;
  if (save) save(text, "application/json", name);
  else { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  ui.notifications.info(`Wayfarer's Toolkit: exported ${Object.keys(data.world).length} world and ${Object.keys(data.client).length} client settings.`);
  return data;
}

/** Reads a file's text against this world's settings (no changes). */
export function readText(text) {
  const d = defs(); const current = Object.fromEntries([...d.keys()].map(k => [k, get(k)]));
  return M.readImport(text, d, current);
}

/** GM: writes the given rows (from readText). Returns { written, reload }. */
export async function apply(rows) {
  if (!game.user.isGM) throw new Error("GM only.");
  const d = defs(); let written = 0, reload = false;
  for (const r of rows ?? []) {
    if (!d.has(r.key)) continue;
    await game.settings.set(ID, r.key, r.to); written++;
    if (d.get(r.key).requiresReload) reload = true;
  }
  return { written, reload };
}

/** Lets the GM pick a .json file: resolves its text, or null. */
function pickFile() {
  return new Promise(resolve => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json,application/json";
    input.addEventListener("change", async () => { const f = input.files?.[0]; resolve(f ? await f.text() : null); });
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

/** GM: pick a file, preview it and import after confirming. */
export async function openImport(api) {
  API = api;
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const text = await pickFile(); if (text == null) return null;
  const r = readText(text);
  if (!r.ok) { ui.notifications.error(`Settings import: ${r.error}.`); return null; }
  await foundry.applications.instances?.get?.(`${ID}-settings-import`)?.close();
  return new ImportPreview(r).render({ force: true });
}

const section = (title, rows) => rows.length ? `<h3>${esc(title)}</h3><table class="wct-grid"><thead><tr><th class="c"></th><th>Setting</th><th>Now</th><th>From the file</th></tr></thead><tbody>${rows.map(x => `<tr class="${x.changed ? "" : "wct-dim"}"><td class="c"><input type="checkbox" data-key="${esc(x.key)}" ${x.changed ? "checked" : ""}></td><td><strong>${esc(x.label)}</strong><br><span class="hint">${esc(x.key)}${x.note ? ` · ${esc(x.note)}` : ""}</span></td><td><code>${esc(M.preview(x.from))}</code></td><td><code>${esc(M.preview(x.to))}</code></td></tr>`).join("")}</tbody></table>` : "";

export class ImportPreview extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${ID}-settings-import`, classes: ["wct-panel", "wct-window", "wct-settings-io"],
    window: { title: "Import toolkit settings", icon: "fa-solid fa-file-import", resizable: true },
    position: { width: 760, height: 620 }
  };
  constructor(result, options) { super(options); this.result = result; }

  async _renderHTML() {
    const r = this.result; const div = document.createElement("div"); div.className = "wct-sio";
    const changed = r.rows.filter(x => x.changed).length;
    const warns = [
      r.version && API?.version && r.version !== API.version ? `The file was exported from version ${esc(r.version)}; this is ${esc(API.version)}.` : "",
      r.unknown.length ? `Ignored, not settings in this version: ${r.unknown.map(esc).join(", ")}.` : "",
      r.invalid.length ? `Ignored, values that don't fit: ${r.invalid.map(i => `${esc(i.key)} (${esc(i.reason)})`).join("; ")}.` : "",
      r.skipped.length ? `Not imported (records, not settings): ${r.skipped.map(esc).join(", ")}.` : ""
    ].filter(Boolean);
    div.innerHTML = `<div class="wct-main">
      <p>${r.rows.length} setting${r.rows.length === 1 ? "" : "s"} read; <strong>${changed}</strong> differ from this world. Ticked ones are written when you click Import. Client settings apply to this browser only.</p>
      ${warns.map(w => `<p class="wct-note warn"><i class="fa-solid fa-triangle-exclamation"></i> ${w}</p>`).join("")}
      ${section("World settings", r.rows.filter(x => x.scope === "world"))}${section("Client settings (this browser)", r.rows.filter(x => x.scope !== "world"))}</div>
      <footer class="wct-footer"><span class="hint" data-note></span><button type="button" data-do="cancel"><i class="fa-solid fa-xmark"></i> Cancel</button><button type="button" class="wct-primary" data-do="import"><i class="fa-solid fa-file-import"></i> Import ticked settings</button></footer>`;
    return div;
  }
  _replaceHTML(result, content) {
    content.replaceChildren(result);
    const note = () => { const n = result.querySelectorAll("[data-key]:checked").length; result.querySelector("[data-note]").textContent = `${n} ticked.`; result.querySelector('[data-do="import"]').disabled = !n; };
    result.addEventListener("change", note); note();
    result.querySelector('[data-do="cancel"]').addEventListener("click", () => this.close());
    result.querySelector('[data-do="import"]').addEventListener("click", async ev => {
      const btn = ev.currentTarget; // currentTarget is null once the handler has awaited, so keep the button
      const keys = new Set([...result.querySelectorAll("[data-key]:checked")].map(i => i.dataset.key));
      const rows = this.result.rows.filter(x => keys.has(x.key));
      const ok = await foundry.applications.api.DialogV2.confirm({ classes: ["wct-window"], window: { title: "Import toolkit settings" }, rejectClose: false,
        content: `<p>Write ${rows.length} setting${rows.length === 1 ? "" : "s"} from the file? Settings you didn't tick stay as they are. Export your current settings first if you want a copy.</p>` });
      if (!ok) return;
      btn.disabled = true;
      try {
        const res = await apply(rows);
        ui.notifications.info(`Wayfarer's Toolkit: imported ${res.written} setting${res.written === 1 ? "" : "s"}.`);
        await this.close();
        if (res.reload) { const SC = foundry.applications?.settings?.SettingsConfig; if (SC?.reloadConfirm) SC.reloadConfirm({ world: true }); else foundry.utils.debouncedReload?.() ?? location.reload(); }
      } catch (e) { ui.notifications.error(`Settings import: ${e.message}`); btn.disabled = false; }
    });
  }
}
