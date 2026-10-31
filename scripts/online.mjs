/**
 * Who's online (feature whosOnline). A board of the connected users with their assigned character's portrait and name (or the user's
 * name and colour), updated live. Shown as a small HUD panel on scenes flagged Hub (flags.wayfarers-toolkit.hub) and in a window
 * (api.whosOnline()). When every user who counts is online the board says "Everyone's here" and the hook
 * `wayfarers-toolkit.allPlayersOnline` fires; `wayfarers-toolkit.playerCountChanged` fires whenever the count changes. The hooks run on
 * every client (a world script that writes documents in them should check `game.users.activeGM?.isSelf`). Writes no documents.
 * 1.25: the HUD can be dragged by its title (world setting onlineDrag); each user's spot is their own client setting onlineHudPos,
 * kept on screen on load and resize (M.placePanel); double-click the title to go back to the position choice.
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
  // 1.25: the panel can be dragged by its title; where each user put it is their own (client scope), never the world's.
  s("onlineDrag", "Who's online: players can move the panel", "Drag the panel by its title to move it; double-click the title to put it back.", Boolean, true, { onChange: () => refresh() });
  game.settings.register(ID, "onlineHudPos", { scope: "client", config: false, type: Object, default: {} });
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

/** Foundry's own UI the panel keeps clear of (v14: scene navigation is a column right of the scene controls). */
function uiRects() {
  const r = sel => { const e = document.querySelector(sel); if (!e || e.offsetParent === null && getComputedStyle(e).position !== "fixed") return null; return e.getBoundingClientRect(); };
  return { nav: r("#scene-navigation"), controls: r("#scene-controls"), players: r("#players") };
}
const view = () => ({ width: window.innerWidth, height: window.innerHeight });
let dragging = false;

/** Puts the HUD where it belongs: this user's dragged spot (kept on screen) or the world's position choice. */
function place(el = document.getElementById("wct-online-hud")) {
  if (!el || dragging) return;
  const b = el.getBoundingClientRect();
  const p = M.placePanel({ anchor: get("onlinePosition", "top-left"), saved: get("onlineHudPos", {}), drag: get("onlineDrag", true) }, view(), { width: b.width, height: b.height }, uiRects());
  el.style.left = `${p.left}px`; el.style.top = `${p.top}px`;
}

/** Drag by the title (pointer events); double-click the title to go back to the default spot. */
function wireDrag(el) {
  const h = el.querySelector("h3"); if (!h || !get("onlineDrag", true)) return;
  h.title = "Drag to move · double-click to put back";
  let start = null;
  h.addEventListener("pointerdown", ev => {
    if (ev.button !== 0) return;
    const b = el.getBoundingClientRect(); start = { x: ev.clientX - b.left, y: ev.clientY - b.top, w: b.width, h: b.height };
    dragging = true; el.classList.add("dragging"); h.setPointerCapture?.(ev.pointerId); ev.preventDefault();
  });
  h.addEventListener("pointermove", ev => {
    if (!start) return;
    const p = M.clampPos({ left: ev.clientX - start.x, top: ev.clientY - start.y }, view(), { width: start.w, height: start.h });
    el.style.left = `${p.left}px`; el.style.top = `${p.top}px`;
  });
  const end = () => {
    if (!start) return; start = null; dragging = false; el.classList.remove("dragging");
    const pos = { left: parseFloat(el.style.left), top: parseFloat(el.style.top) };
    game.settings.set(ID, "onlineHudPos", pos).catch(e => console.warn(`${ID} | who's online position`, e));
  };
  h.addEventListener("pointerup", end); h.addEventListener("pointercancel", end);
  h.addEventListener("dblclick", ev => { ev.preventDefault(); game.settings.set(ID, "onlineHudPos", {}).then(() => place()).catch(() => { }); });
}

function renderHud(r) {
  let el = document.getElementById("wct-online-hud");
  if (!hubScene()) { el?.remove(); return; }
  if (!el) { el = document.createElement("aside"); el.id = "wct-online-hud"; el.setAttribute("aria-label", "Who's online"); document.body.append(el); }
  if (dragging) return;
  const drag = get("onlineDrag", true);
  el.className = `wct-online-hud${drag ? " movable" : ""}${r.all ? " all" : ""}`;
  el.innerHTML = `<h3>Who's online</h3>${boardHTML(r, { compact: true })}`;
  wireDrag(el); place(el);
}

/** Resets this user's dragged position (the panel goes back to the world's position choice). */
export function resetPosition() { return game.settings.set(ID, "onlineHudPos", {}).then(() => place()); }

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
  // Keep the panel on screen when the window changes size (bails at once with no panel showing).
  let t = null; window.addEventListener("resize", () => { if (!document.getElementById("wct-online-hud")) return; clearTimeout(t); t = setTimeout(() => place(), 100); });
  Hooks.on("updateScene", (s, changes) => { if (s.id === canvas?.scene?.id && foundry.utils.hasProperty(changes ?? {}, `flags.${ID}`)) refresh(); });
}
