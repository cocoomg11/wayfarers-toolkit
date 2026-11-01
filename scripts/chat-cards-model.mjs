/**
 * The toolkit's own housekeeping chat cards (1.32), pure (no Foundry calls; tested in Node): which messages are the toolkit's health
 * cards or update-notes cards, and which of them to delete so at most one of each kind is left.
 *
 * A message counts only when it carries the toolkit's flag for that kind AND its content has that card's root class:
 * - "health": `flags.wayfarers-toolkit.health === true` (every health card since 1.13) and a `wct-health` class.
 * - "updates": `flags.wayfarers-toolkit.updateNotes` an object (every update card since 1.17) and a `wct-update` class.
 * Since 1.32 new cards also carry `flags.wayfarers-toolkit.toolkitCard = "health" | "updates"`; it is checked the same way (flag and
 * class), so a message is never picked on one sign alone. A message written by a player is never picked. Nothing else (loot, quest,
 * room or pace cards, players' messages) can match.
 */
export const KINDS = /** @type {const} */ (["health", "updates"]);
const ID = "wayfarers-toolkit";
const CLASS = { health: /class="[^"]*\bwct-health\b/, updates: /class="[^"]*\bwct-update\b/ };

/**
 * The card kind of one message, or null.
 * @param {{ flags?: any, content?: string, authorIsGM?: boolean } | null | undefined} m plain message data
 * @returns {"health" | "updates" | null}
 */
export function cardKind(m) {
  if (!m || typeof m !== "object") return null;
  if (m.authorIsGM === false) return null;
  const f = m.flags?.[ID]; if (!f || typeof f !== "object") return null;
  const content = String(m.content ?? "");
  /** @type {"health" | "updates" | null} */
  let kind = null;
  if (f.toolkitCard === "health" || f.health === true) kind = "health";
  else if (f.toolkitCard === "updates" || (f.updateNotes && typeof f.updateNotes === "object")) kind = "updates";
  if (!kind) return null;
  return CLASS[kind].test(content) ? kind : null;
}

/**
 * Ids to delete so only the newest card of each kind in `kinds` is left (newest = highest timestamp; ties: later in the list).
 * @param {Array<{ id: string, timestamp?: number, flags?: any, content?: string, authorIsGM?: boolean }>} messages
 * @param {{ kinds?: readonly string[], keep?: number }} [opts] keep: how many of each kind to leave (default 1, at least 1)
 * @returns {string[]}
 */
export function pruneIds(messages = [], { kinds = KINDS, keep = 1 } = {}) {
  const n = Math.max(1, Math.floor(Number(keep) || 1));
  /** @type {Record<string, Array<{ id: string, t: number, i: number }>>} */
  const by = {};
  (messages ?? []).forEach((m, i) => {
    const k = cardKind(m); if (!k || !kinds.includes(k) || !m.id) return;
    (by[k] ??= []).push({ id: m.id, t: Number.isFinite(m.timestamp) ? /** @type {number} */ (m.timestamp) : 0, i });
  });
  const out = [];
  for (const list of Object.values(by)) {
    list.sort((a, b) => (b.t - a.t) || (b.i - a.i));
    out.push(...list.slice(n).map(x => x.id));
  }
  return out;
}

/** Counts per kind of the cards `pruneIds` would delete: { health, updates, total }. @param {Parameters<typeof pruneIds>[0]} messages */
export function pruneCounts(messages = []) {
  const ids = new Set(pruneIds(messages));
  const c = { health: 0, updates: 0, total: ids.size };
  for (const m of messages ?? []) if (ids.has(m.id)) { const k = cardKind(m); if (k) c[k]++; }
  return c;
}
