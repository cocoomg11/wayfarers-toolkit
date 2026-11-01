/**
 * Quest quality-of-life rules, pure (no Foundry calls; tested in Node): which map pin a quest's objective click goes to
 * (feature questMapPins), the per-client "seen" record behind the Updated glow (feature questGlow), and the payloads of the hooks
 * other modules listen to (feature moduleHooks).
 */

// ---------------------------------------------------------------- objective click → map pin
/**
 * Where a quest's pin is: { kind: "here", pin } (on the scene being viewed), { kind: "other", pin } (on another scene), or
 * { kind: "none" }. `pins`: [{ id, sceneId, x, y, quest, hidden }] this user may know about. Pins on this scene come first, then
 * the rest by scene and id, so the same click always goes to the same pin.
 * @param {{ questId: string, sceneId?: string | null, pins?: any[] }} opts
 */
export function pinTarget({ questId, sceneId = null, pins = [] }) {
  const mine = (pins ?? []).filter(p => p && p.quest === questId && Number.isFinite(p.x) && Number.isFinite(p.y) && p.sceneId)
    .sort((a, b) => String(a.sceneId).localeCompare(String(b.sceneId)) || String(a.id).localeCompare(String(b.id)));
  if (!questId || !mine.length) return { kind: "none", pin: null };
  const here = mine.find(p => p.sceneId === sceneId);
  return here ? { kind: "here", pin: here } : { kind: "other", pin: mine[0] };
}

/** Whether a ping may be shown: a ping is broadcast to everyone on the scene, so never for a hidden (GM-only) pin. */
export const mayPing = pin => !!pin && !pin.hidden;

// ---------------------------------------------------------------- Updated glow
export const SEEN_VERSION = 1;
export const SEEN_MAX = 500;

/** A short text fingerprint of what a user sees of a quest (name and its view; `sort` and `pub` left out). Same view, same stamp. */
export function questStamp(name, q) {
  const view = q && typeof q === "object" ? { ...q } : {};
  delete view.sort; delete view.pub;
  const text = JSON.stringify([String(name ?? ""), view]);
  let h = 2166136261; // FNV-1a, 32 bit
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36) + text.length.toString(36);
}

/** The stored record, cleaned: { v, init, seen: { [questId]: stamp } }. */
export function readSeen(raw) {
  let r = raw;
  if (typeof r === "string") { try { r = JSON.parse(r); } catch { r = null; } }
  if (!r || typeof r !== "object" || (r.v !== undefined && r.v !== SEEN_VERSION)) return { v: SEEN_VERSION, init: false, seen: {} };
  const seen = {};
  for (const [k, v] of Object.entries(r.seen ?? {})) if (typeof k === "string" && k && typeof v === "string") seen[k] = v;
  return { v: SEEN_VERSION, init: !!r.init, seen };
}

/** Whether the quest glows: the record has a baseline and this view isn't the one last seen. */
export const glowing = (stored, questId, stamp) => { const s = readSeen(stored); return s.init && !!questId && s.seen[questId] !== stamp; };

/** The record with this quest's view marked seen. */
export function markSeen(stored, questId, stamp) {
  const s = readSeen(stored); if (!questId) return s;
  return cap({ ...s, seen: { ...s.seen, [questId]: String(stamp) } });
}

/**
 * The first time on a client (no baseline yet): everything visible now counts as seen, so nothing glows on the first load. Later
 * calls only drop quests that are gone (`live`: [{ id, stamp }] of every quest this user can see).
 */
export function baseline(stored, live = []) {
  const s = readSeen(stored);
  if (s.init) return cap({ ...s, seen: Object.fromEntries(Object.entries(s.seen).filter(([id]) => live.some(q => q.id === id))) }, live);
  return cap({ v: SEEN_VERSION, init: true, seen: Object.fromEntries(live.map(q => [q.id, String(q.stamp)])) });
}
/** @param {{ v: number, init: boolean, seen: Record<string, string> }} s @param {Array<{ id: string }> | null} [live] */
function cap(s, live = null) {
  const e = Object.entries(s.seen); if (e.length <= SEEN_MAX) return s;
  const keep = live ? e.filter(([id]) => live.some(q => q.id === id)) : e;
  return { ...s, seen: Object.fromEntries(keep.slice(-SEEN_MAX)) };
}

// ---------------------------------------------------------------- hooks for other modules
export const QUEST_HOOK = "wayfarersToolkit.questUpdated";
export const JOURNEY_HOOK = "wayfarersToolkit.journey";
export const QUEST_CHANGES = ["started", "completed", "failed", "objective", "updated", "assigned"];

/** The questUpdated payload, or null for something that isn't a change. Ids only: never quest text (players' clients get it too). */
export function questPayload(questId, change) {
  if (typeof questId !== "string" || !questId || !QUEST_CHANGES.includes(change)) return null;
  return { questId, change };
}

/** What a status change is called in the hook: active → started (given or reopened), completed, failed; anything else → updated. */
export const statusChange = status => (status === "active" ? "started" : status === "completed" || status === "failed" ? status : "updated");

/**
 * The journey payload: { kind, fromId, toId, fromName, toName, hours, cost: { gp, sp, cp }, partyId }. `hours` decimal (2.5);
 * `cost` whole coins of each kind (from coinlog-model breakdown). Null for an unknown kind.
 * @param {{ kind: string, fromId?: string | null, toId?: string | null, fromName?: string, toName?: string, hours?: number, cost?: { gp?: number, sp?: number, cp?: number }, partyId?: string | null }} j
 */
export function journeyPayload(j) {
  if (!j || !["hex", "flight"].includes(j.kind)) return null;
  const n = v => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
  const h = Number(j.hours);
  return {
    kind: j.kind, fromId: j.fromId ? String(j.fromId) : null, toId: j.toId ? String(j.toId) : null,
    fromName: String(j.fromName ?? ""), toName: String(j.toName ?? ""),
    hours: Number.isFinite(h) && h > 0 ? Math.round(h * 100) / 100 : 0,
    cost: { gp: n(j.cost?.gp), sp: n(j.cost?.sp), cp: n(j.cost?.cp) },
    partyId: j.partyId ? String(j.partyId) : null
  };
}

// ---------------------------------------------------------------- cost and time before travel
/** Hours as words: "2.5 hours", "1 hour", "about 3 days (72 hours)" for long trips. */
export function hoursText(hours) {
  const h = Math.round((Number(hours) || 0) * 10) / 10;
  if (h >= 48) return `about ${Math.round(h / 24)} days (${h} hours)`;
  return `${h} hour${h === 1 ? "" : "s"}`;
}

/** The confirm's lines: [{ label, value }] for cost, time and who pays. `cost` { gp, sp, cp }; `payer` a name or "". */
export function tripLines({ cost = { gp: 0, sp: 0, cp: 0 }, hours = 0, payer = "", free = false }) {
  const coin = [cost.gp && `${cost.gp} gold`, cost.sp && `${cost.sp} silver`, cost.cp && `${cost.cp} copper`].filter(Boolean).join(", ");
  return [
    { label: "Cost", value: free ? "Free" : coin || "Nothing" },
    { label: "Time", value: hoursText(hours) },
    { label: "Who pays", value: free || !coin ? "Nobody" : payer || "Nobody (no party actor)" }
  ];
}
