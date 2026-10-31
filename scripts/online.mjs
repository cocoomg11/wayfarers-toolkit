/**
 * Who's online (feature whosOnline). A board of the connected users with their assigned character's portrait and name (or the user's
 * name and colour), updated live. Shown as a small HUD panel on scenes flagged Hub (flags.wayfarers-toolkit.hub) and in a window
 * (api.whosOnline()). When every user who counts is online the board says "Everyone's here" and the hook
 * `wayfarers-toolkit.allPlayersOnline` fires; `wayfarers-toolkit.playerCountChanged` fires whenever the count changes. The hooks run on
 * every client (a world script that writes documents in them should check `game.users.activeGM?.isSelf`). Writes nothing.
 */
import * as M from "./online-model.mjs";

const ID = "wayfarers-toolkit";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const get = (k, d) => { try { return game.settings.get(ID, k); } catch { return d; } };
let last = null; let app = null;

export function registerSettings() {
  const s = (key, name, hint, type, def, extra = {}) => game.settings.register(ID, key, { name, hint, scope: "world", config: false, type, default: def, ...extra });
  s("onlineCount", "Who's online: who counts", "Who has to be online for \"Everyone's here\".", String, "characters", { choices: M.COUNTS, onChange: () => refresh() });
  s("onlineList", "Who's online: users who count", "User names separated by commas (with Only the users listed).", String, "", { onChange: () => refresh() });
  s("onlinePosition", "Who's online: panel position", "", String, "top-left", { choices: M.POSITIONS, onChange: () => refresh() });
}

/** The world's users as plain objects for the model. */
function users() {
  return game.users.map(u => { const c = u.character; return { id: u.id, name: u.name, color: u.color?.css ?? String(u.color ?? ""), active: !!u.active, isGM: !!u.isGM, character: c ? { name: c.name, img: c.img } : null }; });
}
/** The board now: { entries, expected, present, all, missing, unknown }. */
export function read() { return M.roster(users(), { count: get("onlineCount", "characters"), list: get("onlineList", "") }); }

function boardHTML(r, { compact = false } = {}) {
  const row = e => `<li class="${e.active ? "on" : "off"}${e.counts ? "" : " extra"}" title="${esc(e.name)}${e.character ? ` (${esc(e.character.name)})` : ""}${e.active ? "" : ": not connected"}">
    ${e.character?.img ? `<img src="${esc(e.character.img)}" alt="">` : `<span class="dot" style="background:${esc(e.color || "#888")}"></span>`}
    <span class="nm">${esc(e.label)}${e.character && !compact ? ` <small>${esc(e.name)}</small>` : ""}${e.isGM ? " <small>GM</small>" : ""}</span></li>`;
  const head = r.all ? `<p class="wct-online-all"><i class="fa-solid fa-circle-check"></i> Everyone's here</p>` : r.expected ? `<p class="wct-online-count">${r.present} of ${r.expected} here</p>` : `<p class="wct-online-count">No players count yet</p>`;
  return `${head}<ul class="wct-online-list">${r.entries.filter(e => e.active || e.counts).map(row).join("")}</ul>`;
}

function hubScene() { const s = canvas?.scene; return !!s?.getFlag?.(ID, "hub"); }

function renderHud(r) {
  let el = document.getElementById("wct-online-hud");
  if (!hubScene()) { el?.remove(); return; }
  if (!el) { el = document.createElement("aside"); el.id = "wct-online-hud"; el.setAttribute("aria-label", "Who's online"); document.body.append(el); }
  el.className = `wct-online-hud pos-${get("onlinePosition", "top-left")}${r.all ? " all" : ""}`;
  el.innerHTML = `<h3>Who's online</h3>${boardHTML(r, { compact: true })}`;
}

/** Re-reads the board, redraws the HUD and window, and fires the hooks when something changed. */
export function refresh() {
  const r = read();
  const ch = M.changes(last, r); last = r;
  try { renderHud(r); } catch (e) { console.warn(`${ID} | who's online HUD`, e); }
  if (app?.rendered) app.render();
  if (ch.countChanged) Hooks.callAll(`${ID}.playerCountChanged`, M.hookPayload(r));
  if (ch.becameAll) Hooks.callAll(`${ID}.allPlayersOnline`, M.hookPayload(r));
  return r;
}

export class OnlineApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { id: `${ID}-online`, classes: ["wct-window", "wct-online-window"], window: { title: "Who's online", icon: "fa-solid fa-users", resizable: true }, position: { width: 300, height: "auto" } };
  async _renderHTML() { const div = document.createElement("div"); div.className = "wct-online-board"; div.innerHTML = boardHTML(read()); return div; }
  _replaceHTML(result, content) { content.replaceChildren(result); }
}
export function open() { app ??= new OnlineApp(); return app.render({ force: true }); }

/** Adds the "Hub scene" checkbox to the scene configuration (GM). */
function addSceneField(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0]; const scene = app?.document; if (!root || !scene || !game.user.isGM) return;
  if (root.querySelector(`input[name="flags.${ID}.hub"]`)) return;
  const tab = root.querySelector('.tab[data-tab="basics"]') ?? root.querySelector(".tab"); if (!tab) return;
  const g = document.createElement("div"); g.className = "form-group";
  g.innerHTML = `<label>Hub scene (show who's online)</label><div class="form-fields"><input type="checkbox" name="flags.${ID}.hub" ${scene.getFlag(ID, "hub") ? "checked" : ""}></div><p class="hint">Wayfarer's Toolkit: everyone on this scene sees a small Who's online panel.</p>`;
  tab.append(g);
}

export function init() {
  Hooks.on("renderSceneConfig", addSceneField);
  // userConnected(user, connected) fires for other users joining or leaving; read the users on the next tick.
  Hooks.on("userConnected", () => setTimeout(() => refresh(), 0));
  Hooks.on("updateUser", (u, changes) => { if ("character" in (changes ?? {}) || "role" in (changes ?? {}) || "name" in (changes ?? {}) || "color" in (changes ?? {})) refresh(); });
  Hooks.on("createUser", () => refresh()); Hooks.on("deleteUser", () => refresh());
  Hooks.on("updateActor", (a, changes) => { if (("name" in (changes ?? {}) || "img" in (changes ?? {})) && game.users.some(u => u.character?.id === a.id)) refresh(); });
  Hooks.on("canvasReady", () => refresh());
  Hooks.on("updateScene", (s, changes) => { if (s.id === canvas?.scene?.id && foundry.utils.hasProperty(changes ?? {}, `flags.${ID}`)) refresh(); });
}
