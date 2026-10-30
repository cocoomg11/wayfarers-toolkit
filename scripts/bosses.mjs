/**
 * Boss frames: classic-MMO-style unit frames at the top centre of every screen for creatures the GM marks as bosses, while
 * they are in a running combat. The mark is a token flag (flags.wayfarers-toolkit.boss), toggled from the token HUD.
 * Frames are redrawn from document hooks only (no polling). Turned off with the "Boss frames" feature, nothing here is registered.
 */
const ID = "wayfarers-toolkit";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const S = key => game.settings.get(ID, key);

export const HP_MODES = { bar: "Bar only", percent: "Bar and percentage", exact: "Exact HP" };

import { on as featureOn } from "./features.mjs";
const tokenDoc = t => t?.document ?? t;

/**
 * Boss or not, from plain values (tested in Node): an explicit crown flag (true or false) wins; with no flag, a token with boss loot
 * counts as a boss when `auto` (the "Treat tokens with boss loot as bosses" setting) is on.
 */
export function resolveBoss({ crown, hasBossLoot = false, auto = true } = {}) {
  if (crown === true || crown === false) return crown;
  return !!(auto && hasBossLoot);
}
const autoOn = () => { try { return !!game.settings.get(ID, "bossAutoFromLoot"); } catch { return false; } };
/** Whether a token has a boss loot table linked (its own actor, or its world actor). Only counts while Boss loot is on. */
function hasBossLoot(doc) {
  if (!featureOn("bossLoot")) return false;
  const has = a => { const f = a?.getFlag?.(ID, "bossLoot"); return !!(f && String(f.table ?? "").trim()); };
  try { return has(doc?.actor) || has(doc?.actorId ? game.actors.get(doc.actorId) : null); } catch { return false; }
}
/** Whether a token (Token or TokenDocument) is a boss: crowned, or (setting on) carrying boss loot and not explicitly uncrowned. */
export const isBoss = t => { const d = tokenDoc(t); if (!d?.getFlag) return false; return resolveBoss({ crown: d.getFlag(ID, "boss"), hasBossLoot: hasBossLoot(d), auto: autoOn() }); };

/** Marks or unmarks tokens as bosses (GM only). `on` null toggles each. Defaults to the controlled tokens. */
export async function toggle(tokens = null, on = null) {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  tokens = (tokens ?? canvas.tokens?.controlled ?? []).map(tokenDoc).filter(Boolean);
  if (!tokens.length) return ui.notifications.warn("Boss frames: select a token first.");
  for (const t of tokens) {
    const want = on ?? !isBoss(t);
    // Off for a token that would be a boss anyway (boss loot) is stored as an explicit false.
    if (want) await t.setFlag(ID, "boss", true);
    else if (resolveBoss({ hasBossLoot: hasBossLoot(t), auto: autoOn() })) await t.setFlag(ID, "boss", false);
    else await t.unsetFlag(ID, "boss");
  }
}

/**
 * Boss combatants in the viewed combat, once it has started, whose tokens stand on the scene this user is viewing. Combatants whose
 * token or actor has been deleted are skipped. Hidden ones are left out for players.
 */
function bosses() {
  const c = game.combat; if (!c?.started) return [];
  const viewed = canvas?.scene?.id ?? null;
  return c.combatants.filter(cb => {
    try {
      const t = cb.token; if (!t || !cb.actor || !t.parent) return false;
      if (viewed && t.parent.id !== viewed) return false;
      if (!game.scenes.get(t.parent.id)?.tokens?.has?.(t.id)) return false;
      return isBoss(t) && (game.user.isGM || !(cb.hidden || t.hidden));
    } catch { return false; }
  });
}

/** A frame's inner markup and whether it is greyed out. */
function frame(cb) {
  const hp = cb.actor.system?.attributes?.hp ?? {};
  const max = Math.max(0, Number(hp.effectiveMax ?? hp.max) || 0);
  const value = Math.max(0, Math.min(Number(hp.value) || 0, max || Infinity));
  const temp = Math.max(0, Number(hp.temp) || 0);
  const pct = max ? value / max : 0;
  const dead = cb.isDefeated || (max > 0 && value <= 0);
  const mode = game.user.isGM ? "exact" : (HP_MODES[S("bossHpDisplay")] ? S("bossHpDisplay") : "bar");
  let text = "";
  if (dead) text = "Dead";
  else if (mode === "exact") text = `${value} / ${max}${temp ? ` <span class="tmp">+${temp}</span>` : ""}`;
  else if (mode === "percent") text = `${Math.round(pct * 100)}%`;
  const tone = pct > 0.5 ? "high" : pct > 0.2 ? "mid" : "low";
  const img = cb.token.texture?.src || cb.actor.img || "icons/svg/mystery-man.svg";
  const tempW = max && temp && !dead ? Math.min(1, temp / max) : 0;
  const html = `<div class="portrait"><img src="${esc(img)}" alt=""></div>
    <div class="info"><div class="name">${esc(cb.token.name || cb.name)}</div>
      <div class="bar ${tone}" role="meter" aria-label="${esc(cb.token.name)} health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${dead ? 0 : Math.round(pct * 100)}">
        <div class="fill" style="width:${dead ? 0 : (pct * 100).toFixed(1)}%"></div>
        ${tempW ? `<div class="temp" style="width:${(tempW * 100).toFixed(1)}%"></div>` : ""}
        ${text ? `<span class="txt">${text}</span>` : ""}
      </div></div>`;
  return { html, dead };
}

/* ---------- Layout (pure; no Foundry globals) ----------
 * Saved per client as { main: {x, y} | null, frames: { [tokenId]: entry } }, coordinates as viewport fractions of a top-left corner.
 * A frame with no entry is in the main group: stacked in combat order under the main group's position (default top centre).
 * An entry is either a free group anchor { x, y } or a frame snapped to another { to, side, x, y } (side: below/above/left/right;
 * x, y are where it was dropped, used if the frame it is snapped to isn't on screen). Frames snapped together form a group; its
 * anchor is the frame everything hangs off (the top of the main stack, or a free frame). */
export const GAP = 6, SNAP = 16, TOP = 12;
const SIDES = ["below", "above", "right", "left"];
const offset = (r, side, w, h, gap) => side === "below" ? { x: r.x, y: r.y + r.h + gap } : side === "above" ? { x: r.x, y: r.y - gap - h }
  : side === "right" ? { x: r.x + r.w + gap, y: r.y } : { x: r.x - gap - w, y: r.y };

/** Positions for the frames `ids` (in combat order), with `sizes[id] = {w, h}`, on a vw x vh viewport.
 * Returns { pos: {id: {x, y, w, h}}, root: {id: anchorId}, parent: {id: {to, side}}, groups: {anchorId: [ids]}, mainRoot }. */
export function computeLayout(ids, sizes, layout, vw, vh, gap = GAP) {
  const present = new Set(ids), frames = layout?.frames ?? {};
  const implicit = ids.filter(id => !frames[id]);
  const parent = {};
  implicit.forEach((id, i) => { if (i) parent[id] = { to: implicit[i - 1], side: "below", implicit: true }; });
  for (const id of ids) {
    const e = frames[id];
    if (e?.to && present.has(e.to) && e.to !== id && SIDES.includes(e.side)) parent[id] = { to: e.to, side: e.side };
  }
  // Break any cycle by turning the frame where it closes into a free anchor.
  for (const id of ids) {
    const seen = new Set([id]); let cur = id;
    while (parent[cur]) { cur = parent[cur].to; if (seen.has(cur)) { delete parent[cur]; break; } seen.add(cur); }
  }
  // Children per slot, snapped-on frames first, then the main stack; several in one slot chain along that side.
  const slots = {};
  for (const exp of [true, false]) for (const id of ids) {
    const p = parent[id]; if (!p || !!p.implicit === exp) continue;
    ((slots[p.to] ??= {})[p.side] ??= []).push(id);
  }
  const pos = {}, root = {}, groups = {};
  const size = id => ({ w: sizes[id]?.w ?? 0, h: sizes[id]?.h ?? 0 });
  const placeKids = (id, r) => {
    for (const side of SIDES) {
      let tail = id;
      for (const c of slots[id]?.[side] ?? []) {
        const { w, h } = size(c), t = pos[tail];
        pos[c] = { ...offset(t, side, w, h, gap), w, h }; root[c] = r; groups[r].push(c);
        placeKids(c, r);
        // The next frame in this slot goes past the furthest one already chained along this side.
        tail = c; while (slots[tail]?.[side]?.length) tail = slots[tail][side].at(-1);
      }
    }
  };
  const mainRoot = implicit[0] ?? null;
  for (const id of ids) {
    if (parent[id]) continue;
    const { w, h } = size(id);
    const e = id === mainRoot ? layout?.main : frames[id];
    const x = Number.isFinite(e?.x) ? e.x * vw : (vw - w) / 2, y = Number.isFinite(e?.y) ? e.y * vh : TOP;
    pos[id] = { x, y, w, h }; root[id] = id; groups[id] = [id];
    placeKids(id, id);
  }
  // Keep each group on-screen as a whole.
  for (const members of Object.values(groups)) {
    const b = bbox(members.map(m => pos[m]));
    const dx = clamp(b.x, 0, vw - b.w) - b.x, dy = clamp(b.y, 0, vh - b.h) - b.y;
    if (dx || dy) for (const m of members) { pos[m].x += dx; pos[m].y += dy; }
  }
  return { pos, root, parent, groups, mainRoot };
}
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
export function bbox(rs) {
  const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y));
  return { x, y, w: Math.max(...rs.map(r => r.x + r.w)) - x, h: Math.max(...rs.map(r => r.y + r.h)) - y };
}

/** The nearest edge of `targets` ({id, x, y, w, h}) that rect `r` is within `th` px of, and where `r` would sit flush against it. */
export function findSnap(r, targets, th = SNAP, gap = GAP) {
  let best = null;
  const overlapX = t => r.x < t.x + t.w && r.x + r.w > t.x, overlapY = t => r.y < t.y + t.h && r.y + r.h > t.y;
  for (const t of targets) for (const side of SIDES) {
    const p = offset(t, side, r.w, r.h, gap);
    const vert = side === "below" || side === "above";
    const ok = vert ? overlapX(t) : overlapY(t); // only edges the frame actually lines up against
    const d = vert ? Math.abs(r.y - p.y) : Math.abs(r.x - p.x);
    if (ok && d <= th && (!best || d < best.d)) best = { to: t.id, side, x: p.x, y: p.y, d };
  }
  return best;
}

/** A copy of `layout` with frame `id` taken out of its group as a free anchor at (x, y) px; frames snapped to it take its place. */
export function detach(layout, id, comp, x, y, vw, vh) {
  const out = { main: layout?.main ?? null, frames: { ...(layout?.frames ?? {}) } };
  const p = comp.parent[id];
  for (const [k, e] of Object.entries(out.frames)) if (e?.to === id) out.frames[k] = p ? { ...e, to: p.to, side: p.side } : { x: e.x, y: e.y };
  out.frames[id] = { x: x / vw, y: y / vh };
  return out;
}

/** A copy of `layout` without entries for tokens not in `live`; frames snapped to a removed one become free at their drop point. */
export function prune(layout, live) {
  const frames = {}; let changed = false;
  for (const [k, e] of Object.entries(layout?.frames ?? {})) {
    if (!live.has(k)) { changed = true; continue; }
    if (e?.to && !live.has(e.to)) { frames[k] = { x: e.x, y: e.y }; changed = true; } else frames[k] = e;
  }
  return changed ? { main: layout?.main ?? null, frames } : null;
}

/* ---------- DOM ---------- */
const TIP = "Drag to move. Dragging a group's top frame moves the whole group; dragging any other frame pulls it out. Drop it next to another frame to snap them together. Double-click to reset.";
let el = null; let ghost = null; let timer = null; const nodes = new Map(); let drag = null;
const keyOf = cb => cb.tokenId ?? cb.token?.id ?? cb.id;
const getLayout = () => { const l = S("bossLayout"); return l && typeof l === "object" ? l : {}; };

function render() {
  const list = bosses();
  if (!list.length) { if (drag) endDrag(null); el?.remove(); el = null; nodes.clear(); return; }
  if (!el) {
    el = document.createElement("section"); el.id = "wct-boss-frames"; el.setAttribute("aria-label", "Boss health");
    el.addEventListener("pointerdown", dragStart); el.addEventListener("dblclick", resetPos);
    document.body.append(el);
  }
  const keep = new Set();
  for (const cb of list) {
    const k = keyOf(cb); if (keep.has(k)) continue; keep.add(k);
    let n = nodes.get(k);
    if (!n) {
      n = document.createElement("div"); n.className = "wct-boss"; n.dataset.tokenId = k;
      n.dataset.tooltip = TIP; n.dataset.tooltipDirection = "DOWN"; nodes.set(k, n);
    }
    n.dataset.combatantId = cb.id;
    let f; try { f = frame(cb); } catch (e) { keep.delete(k); continue; }
    const { html, dead } = f;
    if (n._html !== html) { n.innerHTML = html; n._html = html; }
    n.classList.toggle("dead", dead);
    if (n.parentNode !== el) el.append(n); // never re-insert a live node: that would drop its pointer capture mid-drag
  }
  for (const [k, n] of nodes) if (!keep.has(k)) { if (drag?.ids.has(k)) endDrag(null); n.remove(); nodes.delete(k); }
  applyLayout();
}

/** Places every frame from the layout (the drag's working copy while dragging, with the dragged frames following the pointer). */
function applyLayout() {
  if (!el) return null;
  const ids = [...nodes.keys()], sizes = {};
  for (const id of ids) { const n = nodes.get(id); sizes[id] = { w: n.offsetWidth, h: n.offsetHeight }; }
  const comp = computeLayout(ids, sizes, drag?.layout ?? getLayout(), innerWidth, innerHeight);
  if (drag) {
    const rs = [...drag.ids].filter(id => comp.pos[id]).map(id => comp.pos[id]);
    if (rs.length) {
      const b = bbox(rs);
      const dx = clamp(drag.x - drag.ox, -b.x, innerWidth - b.w - b.x), dy = clamp(drag.y - drag.oy, -b.y, innerHeight - b.h - b.y);
      for (const id of drag.ids) if (comp.pos[id]) { comp.pos[id].x += dx; comp.pos[id].y += dy; }
    }
  }
  for (const [id, p] of Object.entries(comp.pos)) { const s = nodes.get(id).style; s.left = `${p.x}px`; s.top = `${p.y}px`; }
  return comp;
}

function dragStart(ev) {
  const n = ev.target.closest(".wct-boss");
  if (!n || ev.button !== 0 || ev.target.closest("button, a, input, select, textarea")) return;
  const id = n.dataset.tokenId;
  drag = { pointer: ev.pointerId, id, node: n, sx: ev.clientX, sy: ev.clientY, x: 0, y: 0, ox: 0, oy: 0, moved: false, ids: new Set([id]), layout: null };
  n.setPointerCapture(ev.pointerId); n.classList.add("dragging");
  n.addEventListener("pointermove", dragMove); n.addEventListener("pointerup", dragEnd); n.addEventListener("pointercancel", dragEnd);
  ev.preventDefault();
}
function dragMove(ev) {
  if (!drag || ev.pointerId !== drag.pointer) return;
  if (!drag.moved) {
    if (Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) < 3) return;
    // Decide what moves on the first real move, so a double-click never changes the layout.
    drag.moved = true; drag.layout = getLayout();
    const comp = applyLayout(), id = drag.id, p = comp.pos[id];
    if (comp.root[id] === id) { drag.ids = new Set(comp.groups[id]); drag.group = true; drag.main = id === comp.mainRoot; }
    else drag.layout = detach(drag.layout, id, comp, p.x, p.y, innerWidth, innerHeight);
    for (const m of drag.ids) nodes.get(m)?.classList.add("dragging");
    drag.ox = drag.sx; drag.oy = drag.sy;
  }
  drag.x = ev.clientX; drag.y = ev.clientY;
  const comp = applyLayout();
  drag.snap = snapFor(comp);
  showGhost(drag.snap, comp.pos[drag.id]);
}
/** Where the dragged anchor would snap, against frames outside the dragged group. */
function snapFor(comp) {
  const r = comp?.pos[drag.id]; if (!r) return null;
  const targets = Object.entries(comp.pos).filter(([id]) => !drag.ids.has(id)).map(([id, p]) => ({ id, ...p }));
  return findSnap(r, targets);
}
function showGhost(s, r) {
  if (!s || !r) { ghost?.remove(); ghost = null; return; }
  if (!ghost) { ghost = document.createElement("div"); ghost.className = "wct-boss-ghost"; el.append(ghost); }
  Object.assign(ghost.style, { left: `${s.x}px`, top: `${s.y}px`, width: `${r.w}px`, height: `${r.h}px` });
}
function dragEnd(ev) {
  if (!drag || ev.pointerId !== drag.pointer) return;
  endDrag(ev);
}
function endDrag(ev) {
  const d = drag; drag = null; showGhost(null);
  d.node.removeEventListener("pointermove", dragMove); d.node.removeEventListener("pointerup", dragEnd); d.node.removeEventListener("pointercancel", dragEnd);
  for (const n of nodes.values()) n.classList.remove("dragging");
  if (ev && d.node.hasPointerCapture?.(ev.pointerId)) d.node.releasePointerCapture(ev.pointerId);
  if (!d.moved || !ev || ev.type === "pointercancel") return applyLayout();
  // Final position of the dragged anchor, as drawn.
  const n = nodes.get(d.id); if (!n) return applyLayout();
  const vw = innerWidth, vh = innerHeight, s = d.snap;
  const x = s ? s.x : parseFloat(n.style.left), y = s ? s.y : parseFloat(n.style.top);
  const out = { main: d.layout.main ?? null, frames: { ...(d.layout.frames ?? {}) } };
  if (d.main) out.main = { x: x / vw, y: y / vh };                              // the main stack: lines up against the other, stays its own group
  else if (s) out.frames[d.id] = { to: s.to, side: s.side, x: x / vw, y: y / vh }; // a frame or group joins the one it snapped to
  else out.frames[d.id] = { x: x / vw, y: y / vh };
  game.settings.set(ID, "bossLayout", out);
  drag = { ...d, layout: out, ids: new Set() }; applyLayout(); drag = null;     // draw it now, before the setting round-trips
}
function resetPos(ev) { if (ev.target.closest(".wct-boss")) game.settings.set(ID, "bossLayout", {}); }
/** Forgets frames whose tokens are in no combat any more. */
function pruneLayout() {
  const live = new Set();
  for (const c of game.combats ?? []) for (const cb of c.combatants) live.add(keyOf(cb));
  const out = prune(getLayout(), live);
  if (out) game.settings.set(ID, "bossLayout", out);
}

/** Batches bursts of document updates into one redraw. */
const refresh = () => { clearTimeout(timer); timer = setTimeout(render, 50); };

function addHudButton(hud, html) {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html?.[0]; const doc = hud.object?.document ?? hud.document;
  const col = root?.querySelector(".col.right") ?? root?.querySelector(".col.left"); if (!col || !doc) return;
  col.querySelector(".wct-boss-toggle")?.remove();
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = `control-icon wct-boss-toggle${isBoss(doc) ? " active" : ""}`;
  const crown = doc.getFlag(ID, "boss");
  btn.dataset.tooltip = crown === false ? "Boss frame (off for this token; it has boss loot)" : crown ? "Boss frame" : isBoss(doc) ? "Boss frame (automatic: it has boss loot)" : "Boss frame"; btn.setAttribute("aria-label", "Toggle boss frame");
  btn.innerHTML = '<i class="fa-solid fa-crown"></i>';
  btn.addEventListener("click", async ev => { ev.preventDefault(); ev.stopPropagation(); await toggle([doc]); btn.classList.toggle("active", isBoss(doc)); });
  col.append(btn);
}

/** Called from the module's init hook when the feature is on: its setting, the token HUD button and the document hooks. */
export function init() {
  game.settings.register(ID, "bossHpDisplay", {
    name: "Boss frames: what players see", hint: "How much of a boss's health players see on its frame. The GM always sees exact hit points.",
    scope: "world", config: true, type: String, default: "bar", choices: HP_MODES, onChange: refresh
  });
  // Each user's own frame layout on this browser. Replaces the older single-stack "bossFramePos", read once to carry it over.
  game.settings.register(ID, "bossLayout", { scope: "client", config: false, type: Object, default: {}, onChange: () => { if (!drag) applyLayout(); } });
  game.settings.register(ID, "bossFramePos", { scope: "client", config: false, type: Object, default: {} });
  window.addEventListener("resize", () => { if (!drag) applyLayout(); });
  game.settings.register(ID, "bossAutoFromLoot", {
    name: "Boss frames: treat tokens with boss loot as bosses", hint: "A token whose creature has a boss loot table shows a boss frame in combat without the crown. Turning the crown off on such a token hides its frame. Only with Boss loot turned on.",
    scope: "world", config: featureOn("bossLoot"), type: Boolean, default: true, onChange: refresh
  });
  Hooks.on("renderTokenHUD", addHudButton);
  for (const h of ["combatStart", "updateCombat", "deleteCombat", "createCombat", "createCombatant", "updateCombatant", "deleteCombatant", "canvasReady"]) Hooks.on(h, refresh);
  // Only redraw for documents that can change what a frame shows.
  Hooks.on("updateToken", (t, changes) => { if (isBoss(t) || foundry.utils.hasProperty(changes, `flags.${ID}`)) refresh(); });
  // Linked bosses change through their actor; unlinked ones also fire updateToken (their actor delta) above.
  Hooks.on("updateActor", (a, changes) => { if (foundry.utils.hasProperty(changes ?? {}, `flags.${ID}`) || (el && bosses().some(cb => cb.actor === a || cb.actor?.uuid === a.uuid || cb.actorId === a.id))) refresh(); });
  // A token, actor or scene deleted mid-combat takes its frame with it.
  for (const h of ["deleteToken", "deleteActor", "deleteScene", "createToken"]) Hooks.on(h, refresh);
  Hooks.on("deleteCombat", pruneLayout);
  Hooks.once("ready", async () => {
    const old = S("bossFramePos");
    if (Number.isFinite(old?.x) && Number.isFinite(old?.y)) {
      if (!getLayout().main) await game.settings.set(ID, "bossLayout", { ...getLayout(), main: { x: old.x, y: old.y } });
      await game.settings.set(ID, "bossFramePos", {});
    }
    pruneLayout(); render();
  });
}

export const api = { toggle, isBoss, refresh };
