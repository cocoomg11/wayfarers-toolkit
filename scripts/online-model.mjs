/**
 * Who's online (feature whosOnline): who counts as "the players", who of them is connected and whether everyone's here. Pure, no
 * Foundry calls (tested in Node). Users come in as plain objects: { id, name, color, active, isGM, character: { name, img } | null }.
 */

export const COUNTS = { players: "Every player user", characters: "Players with an assigned character", list: "Only the users listed below" };
export const POSITIONS = { "top-left": "Top left", "top-centre": "Top centre", "bottom-left": "Bottom left, above the players list", "bottom-centre": "Bottom centre" };

/** "Ann, Bob; Cy" → lower-case names. */
export const listNames = text => [...new Set(String(text ?? "").split(/[,;\n]+/).map(s => s.trim().toLowerCase()).filter(Boolean))];

/** Whether a user counts towards "everyone's here". */
export function counts(user, { count = "players", list = [] } = {}) {
  if (!user) return false;
  if (count === "list") return list.includes(String(user.name ?? "").trim().toLowerCase());
  if (user.isGM) return false;
  if (count === "characters") return !!user.character;
  return true;
}

/**
 * The board: { entries, expected, present, all, missing, unknown }. `entries`: users who count (online first, then by name) followed
 * by anyone else online (GMs, players who don't count), each with `counts` and a display `label` (character name, or user name).
 * `all` is true only when at least one user counts and every one of them is online. `unknown`: listed names with no such user.
 */
export function roster(users = [], { count = "players", list = "" } = {}) {
  const names = listNames(list);
  const opts = { count, list: names };
  const row = u => ({ id: u.id, name: u.name, color: u.color ?? null, active: !!u.active, isGM: !!u.isGM, counts: counts(u, opts), character: u.character ?? null, label: u.character?.name || u.name });
  const all = users.map(row);
  const by = (a, b) => (b.active - a.active) || String(a.label).localeCompare(String(b.label));
  const expectedRows = all.filter(r => r.counts).sort(by);
  const others = all.filter(r => !r.counts && r.active).sort(by);
  const present = expectedRows.filter(r => r.active).length;
  const unknown = count === "list" ? names.filter(n => !users.some(u => String(u.name ?? "").trim().toLowerCase() === n)) : [];
  return {
    entries: [...expectedRows, ...others], expected: expectedRows.length, present,
    all: expectedRows.length > 0 && present === expectedRows.length,
    missing: expectedRows.filter(r => !r.active).map(r => r.name), unknown
  };
}

/** What changed between two rosters (`prev` may be null): { countChanged, becameAll, leftAll }. */
export function changes(prev, next) {
  if (!prev) return { countChanged: true, becameAll: !!next?.all, leftAll: false };
  return {
    countChanged: prev.present !== next.present || prev.expected !== next.expected,
    becameAll: !prev.all && !!next.all,
    leftAll: !!prev.all && !next.all
  };
}

/** The data the hooks pass: { online, expected, all, missing, users: [{ id, name, label, active, counts }] }. */
export function hookPayload(r, extra = {}) {
  return { online: r.present, expected: r.expected, all: r.all, missing: [...r.missing], users: r.entries.map(e => ({ id: e.id, name: e.name, label: e.label, active: e.active, counts: e.counts })), ...extra };
}
