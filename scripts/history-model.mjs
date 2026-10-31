/**
 * Loot roll history: the pure part (no Foundry calls; tested in Node). Each finished loot roll becomes one plain entry; the list is
 * kept newest first and capped (the oldest entries drop off). Also the per-player tally, the filters, sorting and the CSV export.
 *
 * An entry: { id, at (ms), scene, item: { name, uuid, img, color, rarity }, quantity, pile, outcome, winner, choices, note }.
 * outcome: "won" (a roll won), "passed" (everyone who chose passed), "assigned" (the GM gave it with Assign to…), "expired" (time ran
 * out with nobody choosing), "unclaimed" (a winner was picked but nobody could receive it, or it had left the pile).
 * winner: { uid (null when assigned), user, actor, tier ("need" | "greed" | null), roll } or null.
 * choices: [{ uid, user, actor, choice ("need" | "greed" | "pass"), roll, rolls: [all rolls, rerolls included] }].
 */

export const HISTORY_MAX = 500;
export const OUTCOMES = { won: "Won", passed: "All passed", assigned: "GM assigned", expired: "Expired", unclaimed: "Not handed out" };
export const CHOICE_LABELS = { need: "Need", greed: "Greed", pass: "Pass" };

/** "Ann (Mira)" → { user: "Ann", actor: "Mira" }. Names saved on older cards are only in that form. */
export function splitName(label = "") {
  const m = String(label).match(/^(.*) \(([^()]*)\)$/);
  return m ? { user: m[1], actor: m[2] } : { user: String(label), actor: "" };
}

/**
 * Builds an entry from a finished roll's card state `st` (loot.mjs). `who`: { uid, actor, tier, roll } for the winner, or for an
 * assigned item { actor } only. `at`: when it ended; `id`: a unique id.
 */
export function makeEntry(st = {}, { outcome = "won", who = null, at = Date.now(), id = null, note = "" } = {}) {
  const people = uid => st.people?.[uid] ?? splitName(st.names?.[uid] ?? "?");
  const choices = Object.entries(st.choices ?? {}).map(([uid, c]) => {
    const rolls = [c.roll, ...(c.rerolls ?? [])].filter(n => n != null);
    const p = people(uid);
    return { uid, user: p.user, actor: p.actor, choice: c.choice, roll: rolls.length ? rolls.at(-1) : null, rolls };
  });
  let winner = null;
  if (who) {
    if (who.uid) { const p = people(who.uid); winner = { uid: who.uid, user: p.user, actor: who.actor ?? p.actor, tier: who.tier ?? null, roll: who.roll ?? null }; }
    else winner = { uid: null, user: "", actor: who.actor ?? "", tier: null, roll: null };
  }
  return {
    id: id ?? `${at.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    at, scene: st.sceneName ?? "", pile: st.pileName ?? "",
    item: { name: st.name ?? "", uuid: st.itemUuid ?? "", img: st.img ?? "", color: st.color ?? "", rarity: st.rarity ?? "" },
    quantity: Number(st.quantity) || 1, outcome: OUTCOMES[outcome] ? outcome : "won", winner, choices, note: String(note ?? "")
  };
}

/** A new list with `entry` first and at most `max` entries (the oldest drop off). Bad stored values count as empty. */
export function addEntry(list, entry, max = HISTORY_MAX) {
  const old = Array.isArray(list) ? list.filter(e => e && typeof e === "object") : [];
  return [entry, ...old.filter(e => e.id !== entry.id)].slice(0, Math.max(1, max));
}

/** The key a player is counted under: their user id, or for an item the GM assigned, the character's name. */
export const playerKey = p => p?.uid ? p.uid : p?.actor ? `actor:${p.actor}` : null;
const playerLabel = p => p.user && p.actor ? `${p.user} (${p.actor})` : p.user || p.actor || "?";

/** Everyone in the entries: [{ key, label }], by label. The newest label wins (a character may be renamed). */
export function players(entries = []) {
  const out = new Map();
  for (const e of entries) for (const p of [...(e.choices ?? []), ...(e.winner ? [e.winner] : [])]) {
    const k = playerKey(p); if (k && !out.has(k)) out.set(k, playerLabel(p));
  }
  return [...out].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
}

/** Local calendar day of a time: "2026-10-31". */
export function dayKey(at) {
  const d = new Date(at); if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** The days with entries, newest first: ["2026-10-31", …]. */
export const days = (entries = []) => [...new Set(entries.map(e => dayKey(e.at)).filter(Boolean))].sort().reverse();

/** Entries a player took part in (chose, or received the item) and/or from one day. Empty filters keep everything. */
export function filterEntries(entries = [], { player = "", day = "" } = {}) {
  return entries.filter(e => {
    if (day && dayKey(e.at) !== day) return false;
    if (player && !(e.choices ?? []).some(c => playerKey(c) === player) && playerKey(e.winner) !== player) return false;
    return true;
  });
}

/** Per-player tally: [{ key, label, rolls, won, need, greed, assigned }], most items first, then by name. */
export function tally(entries = []) {
  const names = new Map(players(entries).map(p => [p.key, p.label]));
  const rows = new Map();
  const row = k => { if (!rows.has(k)) rows.set(k, { key: k, label: names.get(k) ?? k, rolls: 0, won: 0, need: 0, greed: 0, assigned: 0 }); return rows.get(k); };
  for (const e of entries) {
    for (const c of e.choices ?? []) { const k = playerKey(c); if (k) row(k).rolls++; }
    const w = e.winner; const k = playerKey(w);
    if (!k || !["won", "assigned"].includes(e.outcome)) continue;
    const r = row(k); r.won++;
    if (e.outcome === "assigned") r.assigned++;
    else if (w.tier === "need") r.need++;
    else if (w.tier === "greed") r.greed++;
  }
  return [...rows.values()].sort((a, b) => b.won - a.won || a.label.localeCompare(b.label));
}

/** Text of who received the item ("" when nobody). */
export const winnerText = e => e?.winner && ["won", "assigned"].includes(e.outcome) ? playerLabel(e.winner) : "";
/** "Ann (Mira): Need 54; Bob (Kel): Pass". */
export const choicesText = e => (e?.choices ?? []).map(c => `${playerLabel(c)}: ${CHOICE_LABELS[c.choice] ?? c.choice}${c.rolls?.length ? ` ${c.rolls.join(" → ")}` : ""}`).join("; ");

/** Sort keys for the history window's columns. */
const SORTS = {
  date: e => e.at ?? 0,
  scene: e => String(e.scene ?? "").toLowerCase(),
  item: e => String(e.item?.name ?? "").toLowerCase(),
  outcome: e => OUTCOMES[e.outcome] ?? "",
  winner: e => winnerText(e).toLowerCase()
};
export const SORT_KEYS = Object.keys(SORTS);
/** A sorted copy. Ties keep the newest first. */
export function sortEntries(entries = [], key = "date", dir = "desc") {
  const f = SORTS[key] ?? SORTS.date; const m = dir === "asc" ? 1 : -1;
  return entries.map((e, i) => [e, i]).sort(([a, ia], [b, ib]) => { const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * m || ia - ib; }).map(([e]) => e);
}

/** One CSV cell: quoted when needed, and a leading = + - @ made harmless for spreadsheets. */
export function csvCell(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const pad = n => String(n).padStart(2, "0");
const timeOf = at => { const d = new Date(at); return Number.isNaN(d.getTime()) ? "" : `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const CSV_HEADER = ["Date", "Time", "Scene", "Item", "Quantity", "Rarity", "Outcome", "Received by", "Winning choice", "Winning roll", "Choices", "Note", "Item UUID"];
/** The entries as CSV text (header first, CRLF line ends). */
export function toCSV(entries = []) {
  const rows = entries.map(e => {
    const w = e.outcome === "won" ? e.winner : null;
    return [dayKey(e.at), timeOf(e.at), e.scene, e.item?.name, e.quantity, e.item?.rarity, OUTCOMES[e.outcome] ?? e.outcome, winnerText(e),
      w?.tier ? CHOICE_LABELS[w.tier] : "", w?.roll ?? "", choicesText(e), e.note, e.item?.uuid];
  });
  return [CSV_HEADER, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
