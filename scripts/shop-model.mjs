/**
 * Open shop for players (feature merchantShop, 1.31): the pure rules (no Foundry calls; tested in Node). shop.mjs gathers the
 * facts about each user, these functions decide who the shop can be opened for and what goes to Item Piles.
 *
 * A user's facts: { id, name, isGM, active, character: { uuid, name, owned } | null, onScene }. `character` is the user's assigned
 * character, or the one character they own when none is assigned (shop.mjs); `owned` = the user has Owner on it; `onScene` = a token
 * of that character is on the scene being viewed.
 */

/** Document ids are 16 letters and digits. */
export const ID_RE = /^[A-Za-z0-9]{16}$/;
/** A document UUID as Foundry writes it ("Actor.abc", "Scene.abc.Token.def.Actor.ghi"; compendium UUIDs aren't shop actors). */
export const UUID_RE = /^(Actor|Scene)\.[A-Za-z0-9]{16}(\.[A-Za-z]+\.[A-Za-z0-9]{16})*$/;
/** At most this many players per call (a sanity cap; worlds rarely have more). */
export const MAX_USERS = 50;

/** Why a user can't be included, in plain words for the GM. */
export const REASONS = {
  noCharacter: "has no character",
  notOwned: "doesn't own their character",
  offline: "isn't connected",
  gm: "is a GM",
  unknown: "isn't a user in this world",
  offScene: "has no token on this scene"
};

/**
 * Splits users into the ones the shop can open for and the ones it can't.
 * @param {any[]} users user facts (see the file comment)
 * @returns {{ ok: any[], skipped: { id: string, name: string, reason: string }[] }} `ok` rows: { id, name, character, uuid, onScene }.
 * GMs and offline players aren't reported (the dialog never lists them); players with no character or one they don't own are.
 */
export function eligible(users) {
  const ok = []; const skipped = [];
  for (const u of users ?? []) {
    if (!u || typeof u.id !== "string" || u.isGM || !u.active) continue;
    const name = String(u.name ?? u.id);
    const c = u.character;
    if (!c || typeof c.uuid !== "string" || !UUID_RE.test(c.uuid)) { skipped.push({ id: u.id, name, reason: REASONS.noCharacter }); continue; }
    if (!c.owned) { skipped.push({ id: u.id, name, reason: REASONS.notOwned }); continue; }
    ok.push({ id: u.id, name, character: String(c.name ?? ""), uuid: c.uuid, onScene: !!u.onScene });
  }
  return { ok, skipped };
}

/**
 * The final pick: the rows ticked in the dialog (or named in the API call), less those off the scene when `onlyOnScene`.
 * `requested` null = everyone eligible. Requested ids that aren't eligible come back in `skipped` with a reason.
 * @param {any[]} users user facts
 * @param {{ requested?: string[] | null, onlyOnScene?: boolean }} [opts]
 */
export function pick(users, { requested = null, onlyOnScene = false } = {}) {
  const { ok, skipped } = eligible(users);
  const byId = new Map((users ?? []).filter(u => u && typeof u.id === "string").map(u => [u.id, u]));
  const out = []; const why = [];
  const wanted = requested === null ? ok.map(r => r.id) : [...new Set((requested ?? []).filter(x => typeof x === "string"))];
  for (const id of wanted.slice(0, MAX_USERS)) {
    const row = ok.find(r => r.id === id);
    if (row) {
      if (onlyOnScene && !row.onScene) why.push({ id, name: row.name, reason: REASONS.offScene });
      else out.push(row);
      continue;
    }
    if (requested === null) continue;
    const s = skipped.find(r => r.id === id); if (s) { why.push(s); continue; }
    const u = byId.get(id);
    why.push({ id, name: String(u?.name ?? id), reason: !u ? REASONS.unknown : u.isGM ? REASONS.gm : !u.active ? REASONS.offline : REASONS.noCharacter });
  }
  // When everyone was meant, players left out for a missing or unowned character are still worth telling the GM about.
  if (requested === null) for (const s of skipped) if (!why.some(w => w.id === s.id)) why.push(s);
  return { users: out, skipped: why };
}

/**
 * One Item Piles call per player: `game.itempiles.API.renderItemPileInterface(merchant, { userIds: [id], inspectingTarget: uuid })`.
 * Item Piles takes one inspecting target per call, so each player gets their own call with their own character as the buyer.
 * Rows with a malformed id or UUID are dropped (never sent).
 * @param {string} merchantUuid
 * @param {{ id: string, uuid: string }[]} rows
 * @returns {{ userIds: string[], inspectingTarget: string }[]}
 */
export function openCalls(merchantUuid, rows) {
  if (typeof merchantUuid !== "string" || !UUID_RE.test(merchantUuid)) return [];
  const seen = new Set();
  return (rows ?? []).filter(r => r && ID_RE.test(String(r.id)) && UUID_RE.test(String(r.uuid)) && !seen.has(r.id) && seen.add(r.id))
    .slice(0, MAX_USERS).map(r => ({ userIds: [r.id], inspectingTarget: r.uuid }));
}

/**
 * Who a "Close for everyone" goes to: the players it was opened for (still connected), else every connected player. Never a GM
 * (closing on the GM's own client would shut the GM's window too).
 * @param {string[] | null | undefined} openedFor
 * @param {any[]} users user facts (only id, isGM, active are read)
 */
export function closeTargets(openedFor, users) {
  const live = (users ?? []).filter(u => u && !u.isGM && u.active && ID_RE.test(String(u.id))).map(u => u.id);
  if (!Array.isArray(openedFor) || !openedFor.length) return live;
  return openedFor.filter(id => live.includes(id));
}

/**
 * The API's `users` option read into ids: undefined/null = everyone; a user, an id, a name or a list of them.
 * @param {any} users
 * @param {any[]} all user facts (id and name)
 * @returns {string[] | null}
 */
export function requestedIds(users, all) {
  if (users === undefined || users === null) return null;
  const list = Array.isArray(users) ? users : [users];
  return list.map(x => {
    if (x && typeof x === "object") return typeof x.id === "string" ? x.id : null;
    if (typeof x !== "string") return null;
    if ((all ?? []).some(u => u.id === x)) return x;
    return (all ?? []).find(u => String(u.name).toLowerCase() === x.toLowerCase())?.id ?? x;
  }).filter(x => typeof x === "string");
}

/** "Ann (no character), Bo (no token on this scene)" or "". */
export const skippedText = skipped => (skipped ?? []).map(s => `${s.name} (${s.reason})`).join(", ");
