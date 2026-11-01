/**
 * Coin log and Split coin, the pure part (no Foundry calls; tested in Node). The coin log lives in the GM-only store (vault bucket
 * "coinLog", `{ v: 1, entries }`, newest first, at most COINLOG_MAX). Each entry is one coin movement the toolkit made on one actor:
 * quest rewards, room rent, flight fares (and refunds), vendor trash sales, loot coin, Split coin and undos.
 *
 * Amounts are in the smallest coin in use (the same unit as api.parseMoney / api.pay). `coins` is the same amount shown as gold,
 * silver and copper (platinum and electrum are folded into gold / silver by value), always non-negative; `delta`'s sign says which way.
 */
import { versioned, capList } from "../vendor/wanderers-core/index.mjs";

export const COINLOG_VERSION = 1;
export const COINLOG_MAX = 200;
/** How many of the newest entries offer Undo. */
export const UNDO_WINDOW = 20;
export const REASON_MAX = 200;

const str = (v, max = REASON_MAX) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const int = v => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);

/**
 * An amount in the smallest coin → { gp, sp, cp } integers (no sign). `coins`: [[key, value in the smallest coin], …] as api.coins()
 * returns; gold, silver and copper values default to the standard 100 / 10 / 1 when missing.
 * @param {number} amount
 * @param {Array<[string, number]>} [coins]
 */
export function breakdown(amount, coins = []) {
  const v = Object.fromEntries(coins ?? []);
  const gpV = v.gp > 0 ? v.gp : 100, spV = v.sp > 0 ? v.sp : 10, cpV = v.cp > 0 ? v.cp : 1;
  let a = Math.abs(int(amount));
  const gp = Math.floor(a / gpV); a -= gp * gpV;
  const sp = Math.floor(a / spV); a -= sp * spV;
  const cp = Math.round(a / cpV);
  return { gp, sp, cp };
}

/** One stored entry, cleaned; null when it can't be read (no id, no actor or a zero amount). */
export function readEntry(e) {
  if (!e || typeof e !== "object") return null;
  const id = str(e.id, 40); const actor = str(e.actor, 200); const delta = int(e.delta);
  if (!id || !actor || !delta) return null;
  const c = e.coins && typeof e.coins === "object" ? e.coins : {};
  return {
    id, at: int(e.at), world: Number.isFinite(Number(e.world)) ? Number(e.world) : null,
    actor, actorName: str(e.actorName, 100) || "Unknown", delta,
    coins: { gp: Math.max(0, int(c.gp)), sp: Math.max(0, int(c.sp)), cp: Math.max(0, int(c.cp)) },
    reason: str(e.reason) || "Coin", by: str(e.by, 40) || null,
    undoneAt: e.undoneAt ? int(e.undoneAt) : null, undoOf: e.undoOf ? str(e.undoOf, 40) : null
  };
}

/** The one normalizer for the stored coin log. */
export const normalizeCoinLog = versioned({
  version: COINLOG_VERSION,
  empty: () => ({ entries: [] }),
  clean: v => ({ v: COINLOG_VERSION, entries: capList((Array.isArray(v.entries) ? v.entries : []).map(readEntry).filter(Boolean), COINLOG_MAX) })
});

/**
 * A new entry from a movement: { id, at, world, actor (uuid), actorName, delta, coins, reason, by }. Null for a zero amount.
 * @param {{ id: string, at?: number, world?: number | null, actor: string, actorName?: string, delta: number, reason?: string, by?: string | null, undoOf?: string | null, coins?: Array<[string, number]> }} m
 */
export function makeEntry(m) {
  const delta = int(m.delta); if (!delta) return null;
  return readEntry({ ...m, delta, coins: breakdown(delta, m.coins), at: m.at ?? Date.now() });
}

/** The log with `entry` first (oldest dropped past COINLOG_MAX). */
export function addEntry(log, entry) {
  const cur = normalizeCoinLog(log); const e = readEntry(entry);
  if (!e) return cur;
  return normalizeCoinLog({ v: COINLOG_VERSION, entries: [e, ...cur.entries.filter(x => x.id !== e.id)] });
}

/** Whether the entry with `id` may be undone: among the newest `window` entries, not undone yet, and not an undo itself. */
export function undoable(log, id, window = UNDO_WINDOW) {
  const list = normalizeCoinLog(log).entries.slice(0, window);
  const e = list.find(x => x.id === id);
  return !!e && !e.undoneAt && !e.undoOf;
}

/**
 * What undoing an entry does, given the actor now: { ok, op: "take" | "give", amount, reason? }. A credit (coin the actor got) is
 * taken back only if the actor still has at least that much; a debit (coin the actor paid) is given back.
 * @param {any} entry
 * @param {{ exists: boolean, have: number }} facts
 */
export function undoPlan(entry, { exists, have }) {
  const e = readEntry(entry);
  if (!e) return { ok: false, op: null, amount: 0, reason: "that entry can't be read" };
  if (e.undoneAt) return { ok: false, op: null, amount: 0, reason: "it was already undone" };
  if (e.undoOf) return { ok: false, op: null, amount: 0, reason: "an undo can't be undone" };
  if (!exists) return { ok: false, op: null, amount: 0, reason: `${e.actorName} no longer exists` };
  const amount = Math.abs(e.delta);
  if (e.delta > 0) {
    if (!(int(have) >= amount)) return { ok: false, op: "take", amount, reason: `${e.actorName} no longer has that much coin` };
    return { ok: true, op: "take", amount };
  }
  return { ok: true, op: "give", amount };
}

/** The log with the entry marked undone at `at`. */
export function markUndone(log, id, at = Date.now()) {
  const cur = normalizeCoinLog(log);
  return normalizeCoinLog({ ...cur, entries: cur.entries.map(e => (e.id === id ? { ...e, undoneAt: at } : e)) });
}

/** Coin as "1g 2s 3c" from a breakdown (leaves out zero coins; "0c" for nothing). */
export const coinText = ({ gp = 0, sp = 0, cp = 0 } = {}) => [gp && `${gp}g`, sp && `${sp}s`, cp && `${cp}c`].filter(Boolean).join(" ") || "0c";

// ---------------------------------------------------------------- Split coin
/**
 * Splits the party purse evenly: { ok, error?, per, take, remainder, give: [{ id, name, amount }] }. `total` in the smallest coin;
 * `members`: [{ id, name }] (each distinct id once). Each member gets the same whole amount; what doesn't divide stays in the party.
 * @param {{ total: number, members: Array<{ id: string, name?: string }> }} opts
 */
export function splitPlan({ total, members }) {
  const seen = new Set(); const list = (members ?? []).filter(m => m?.id && !seen.has(m.id) && seen.add(m.id));
  const t = Math.max(0, int(total));
  if (!list.length) return { ok: false, error: "The party has no members to share with.", per: 0, take: 0, remainder: t, give: [] };
  const per = Math.floor(t / list.length);
  if (per <= 0) return { ok: false, error: "There isn't enough coin to give everyone something.", per: 0, take: 0, remainder: t, give: [] };
  const take = per * list.length;
  return { ok: true, per, take, remainder: t - take, give: list.map(m => ({ id: m.id, name: String(m.name ?? ""), amount: per })) };
}
