/**
 * The quest tracker's placement, with no Foundry calls (tested in Node): clamping to the viewport, the saved spot (per client,
 * setting `trackerPos`), keyboard nudges and the default spot that keeps clear of Foundry's own interface.
 *
 * The saved spot is `{ v: 1, fx, y }`: across, a fraction (0–1) of the free width (0 = flush left, 1 = flush right), so a tracker
 * pushed against the right edge stays there when the window or the UI scale changes; down, its top in px (the list grows
 * downwards, so the top is what should stay put). Anything else reads as "not moved" (null) and the default spot is used.
 */

export const POS_VERSION = 1;
/** Gap from the screen edges and from core interface elements, in px. */
export const GAP = 16;
/** Keyboard nudge, in px (Shift: BIG). */
export const STEP = 10;
export const BIG = 50;

/** @param {number} v @param {number} lo @param {number} hi */
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
const num = v => (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) && Number.isFinite(+v) ? +v : NaN;
const round4 = v => Math.round(v * 1e4) / 1e4;

/**
 * Keeps a box of `size` inside the viewport (top-left corner `pos`, all px). A box bigger than the viewport sits at 0.
 * @param {{ x: number, y: number }} pos @param {{ w: number, h: number }} size @param {{ vw: number, vh: number }} view
 */
export function clampPos(pos, size, view) {
  const x = Number.isFinite(pos?.x) ? pos.x : 0, y = Number.isFinite(pos?.y) ? pos.y : 0;
  return { x: Math.round(clamp(x, 0, view.vw - size.w)), y: Math.round(clamp(y, 0, view.vh - size.h)) };
}

/**
 * Reads the saved spot (an object, or JSON text from older or hand-edited data). Null when nothing usable is saved.
 * The fraction is pulled into 0–1 and the top to 0 or more; a newer version than this code knows is ignored.
 * @param {any} raw @returns {{ fx: number, y: number } | null}
 */
export function parsePos(raw) {
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { return null; } }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (raw.v !== undefined && raw.v !== POS_VERSION) return null;
  const fx = num(raw.fx), y = num(raw.y);
  if (!Number.isFinite(fx) || !Number.isFinite(y)) return null;
  return { fx: clamp(fx, 0, 1), y: Math.round(Math.max(0, y)) };
}

/** The spot to save for a box at `pos` (px). @param {{ x: number, y: number }} pos @param {{ w: number, h: number }} size @param {{ vw: number, vh: number }} view */
export function toSaved(pos, size, view) {
  const p = clampPos(pos, size, view);
  const fw = view.vw - size.w;
  return { v: POS_VERSION, fx: fw > 0 ? round4(p.x / fw) : 0, y: p.y };
}

/** Where a saved spot puts the box now (px, clamped). @param {{ fx: number, y: number }} saved @param {{ w: number, h: number }} size @param {{ vw: number, vh: number }} view */
export function fromSaved(saved, size, view) {
  return clampPos({ x: saved.fx * Math.max(0, view.vw - size.w), y: saved.y }, size, view);
}

/** Whether two boxes ({ x, y, w, h }) overlap (touching edges don't count). */
export const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * The default spot: the first place, preferring the right-hand side and the top, where the box overlaps none of `obstacles`
 * (core interface boxes { x, y, w, h }: sidebar, scene controls, scene navigation, players list, hotbar, camera dock…).
 * Candidates: just left of whatever runs along the right edge (the sidebar) and just right of / below each obstacle, at the top
 * or just below each obstacle. Falls back to the top right next to the sidebar when nothing is free.
 * @param {{ w: number, h: number }} size @param {{ vw: number, vh: number }} view @param {{ x: number, y: number, w: number, h: number }[]} [obstacles]
 */
export function defaultPos(size, view, obstacles = [], gap = GAP) {
  const obs = obstacles.filter(o => o && o.w > 0 && o.h > 0);
  const rightEdge = Math.min(view.vw, ...obs.filter(o => o.x + o.w >= view.vw - 2).map(o => o.x));
  const xs = [rightEdge - gap - size.w, ...obs.map(o => o.x - gap - size.w), ...obs.map(o => o.x + o.w + gap), gap];
  const ys = [gap, ...obs.map(o => o.y + o.h + gap)];
  const fits = p => p.x >= 0 && p.y >= 0 && p.x + size.w <= view.vw && p.y + size.h <= view.vh;
  const cands = [];
  for (const x of [...new Set(xs)].sort((a, b) => b - a)) for (const y of [...new Set(ys)].sort((a, b) => a - b)) cands.push({ x, y });
  // Right first, then top: a spot near the top on the right beats one higher up but far left.
  const free = cands.find(p => fits(p) && !obs.some(o => overlaps({ ...p, ...size }, o)));
  return clampPos(free ?? { x: rightEdge - gap - size.w, y: gap }, size, view);
}

/**
 * A keyboard nudge: the new spot for an arrow key (Shift: further), or null for any other key.
 * @param {{ x: number, y: number }} pos @param {string} key @param {boolean} [shift]
 */
export function nudge(pos, key, shift = false) {
  const d = shift ? BIG : STEP;
  const m = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[key];
  return m ? { x: pos.x + m[0], y: pos.y + m[1] } : null;
}
