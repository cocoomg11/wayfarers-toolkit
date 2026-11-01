/**
 * Pure helpers for "exactly one client acts" (no Foundry calls; tested in Node).
 *
 * Foundry's active GM is a user, but one GM user can be logged in on several clients (two tabs, a laptop and a desktop). Each client
 * of that user would think it is the active GM, so every automatic write would happen once per tab. Each GM client therefore gets a
 * random session id at load and announces it over the module socket; among the live sessions of the active GM user, the one that
 * started first (ties: the lowest id) is the leader, and only the leader acts.
 *
 * Safe by construction: a client always counts itself, so a lone client (or one whose socket never hears anyone) leads at once; a
 * session that says goodbye (tab closed) drops out at once, and one that stops answering pings drops out after two missed pings.
 */

/** How often a GM client pings the others, in milliseconds. */
export const HEARTBEAT_MS = 2000;
/** Slack for a reply to arrive after a ping, in milliseconds. */
export const GRACE_MS = 1000;
/** How long ready-time work waits for other sessions to answer the first ping. */
export const SETTLE_MS = 800;
/** How many request ids a client remembers. */
export const SEEN_MAX = 200;

const ID_RE = /^[A-Za-z0-9_-]{4,64}$/;

/** A random session or request id (letters and digits). `rand` is for tests. */
export function newId(rand = Math.random, length = 16) {
  const abc = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = ""; for (let i = 0; i < length; i++) s += abc[Math.floor(rand() * abc.length) % abc.length];
  return s;
}

/** Ordering of sessions: earliest start first, then lowest id. */
export function compareSessions(a, b) {
  if (a.since !== b.since) return a.since < b.since ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The cut-off for "still alive": a peer must have answered the ping before this client's latest one. Measured against this
 * client's own pings rather than the wall clock, so a background tab whose timers the browser slows down (to once a minute) doesn't
 * declare a peer dead just because it pinged late. `prevPing`: when this client sent the ping before its latest (null: not yet).
 */
export function aliveCutoff(prevPing, grace = GRACE_MS) {
  return typeof prevPing === "number" && Number.isFinite(prevPing) ? prevPing - grace : -Infinity;
}

/**
 * The leader's session id among `sessions` (array of { id, userId, since, seen }) for the GM user `gmUserId`, or null. Sessions last
 * seen before `cutoff` are ignored; `self` (this client's own session) always counts while it is that user's, so a lone client
 * leads at once.
 */
export function leaderOf(sessions = [], { gmUserId, cutoff = -Infinity, self = null } = {}) {
  if (!gmUserId) return null;
  const live = sessions.filter(s => s && s.userId === gmUserId && s.id !== self?.id && (s.seen ?? -Infinity) >= cutoff);
  if (self && self.userId === gmUserId) live.push(self);
  return live.sort(compareSessions)[0]?.id ?? null;
}

/** True when `self` is the leader for `gmUserId`. */
export function isLeader(sessions, { gmUserId, cutoff, self }) {
  return !!self && self.userId === gmUserId && leaderOf(sessions, { gmUserId, cutoff, self }) === self.id;
}

/** Drops sessions last seen before `cutoff` (keeps the table small). Returns a new array. */
export function prune(sessions = [], cutoff = -Infinity) {
  return sessions.filter(s => (s.seen ?? -Infinity) >= cutoff);
}

/**
 * A session socket message: { op: "ping" | "here" | "bye", sid, since } or null ("ping" asks every other GM client to answer with
 * "here"). The user comes from Foundry's sender id, never from the message.
 */
export function readSessionMessage(msg) {
  if (!msg || msg.action !== "gmSession" || !["ping", "here", "bye"].includes(msg.op)) return null;
  if (typeof msg.sid !== "string" || !ID_RE.test(msg.sid)) return null;
  const since = Number(msg.since);
  return { op: msg.op, sid: msg.sid, since: Number.isFinite(since) ? since : 0 };
}

/** Applies a session message from `userId` to the table at `now`. Returns the new table. */
export function applySessionMessage(sessions = [], m, userId, now = 0) {
  if (!m || !userId) return sessions;
  const rest = sessions.filter(s => s.id !== m.sid);
  if (m.op === "bye") return rest;
  return [...rest, { id: m.sid, userId, since: m.since, seen: now }];
}

/**
 * A bounded "seen before" cache for request ids. `firstTime(id)` is true the first time an id is passed (and remembers it), false
 * after; ids that aren't strings always pass (requests from older clients carry none). The oldest ids drop off past `max`.
 */
export function seenCache(max = SEEN_MAX) {
  const ids = new Set();
  return {
    firstTime(id) {
      if (typeof id !== "string" || !id) return true;
      if (ids.has(id)) return false;
      ids.add(id);
      while (ids.size > max) ids.delete(ids.values().next().value);
      return true;
    },
    has: id => ids.has(id),
    get size() { return ids.size; }
  };
}

/** A request id from a socket message, or null. */
export function requestId(msg) {
  return typeof msg?.rid === "string" && ID_RE.test(msg.rid) ? msg.rid : null;
}

/** True when one of `messages` (plain chat message data) already carries request id `rid` under `flags[ns][key].rid`. */
export function cardExists(messages = [], ns, key, rid) {
  if (!rid) return false;
  for (const m of messages) if (m?.flags?.[ns]?.[key]?.rid === rid) return true;
  return false;
}
