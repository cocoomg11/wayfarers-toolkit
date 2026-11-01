/**
 * One GM client does the automatic work. A world can have several GM users logged in at once, and one GM user can be logged in on
 * several clients (two tabs, a laptop and a desktop). Every hook or socket handler that writes documents on its own (pre-rolled loot,
 * bodies made lootable, boss loot draws, loot roll results, flights booked by players, rested rests, room and pace requests, warnings
 * about the world's setup) runs only on one client: the active GM user's leader session (see gm-model.mjs). Buttons and macros a GM
 * clicks still run on that GM's client. The pure helpers take plain objects and are tested in Node.
 */
import * as M from "./gm-model.mjs";
import { log } from "./log.mjs";

const ID = "wayfarers-toolkit";
const SOCKET = `module.${ID}`;

/** The active GM: Foundry's own pick when it is an active GM, else the active GM with the lowest user id, else null. */
export function pickActiveGM(users = [], declared = null) {
  if (declared && declared.isGM && declared.active) return declared;
  return [...users].filter(u => u?.isGM && u.active).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0] ?? null;
}

/** The active GM user of this world, or null when no GM is connected. */
export function activeGM() {
  try { return pickActiveGM(game.users?.contents ?? [...(game.users ?? [])], game.users?.activeGM ?? null); } catch { return null; }
}

// ---------------------------------------------------------------- sessions (GM clients only, started from the ready hook)
const S = { self: null, peers: [], lastPing: null, prevPing: null, started: false, settled: false, leader: null, leaderFor: null, settle: null, timer: null };
const leaderFns = [];
function fireLeader() { for (const fn of leaderFns) { try { fn(); } catch (e) { console.warn(`${ID} | leader change`, e); } } }

function cutoff() { return M.aliveCutoff(S.prevPing); }
function emit(op) { try { game.socket.emit(SOCKET, { action: "gmSession", op, sid: S.self.id, since: S.self.since }); } catch { } }

/** Recomputes the leader; runs the leader-change callbacks on the client that just became leader. */
function recompute() {
  if (!S.started) return;
  S.peers = M.prune(S.peers, cutoff());
  const was = S.leader; const gm = activeGM();
  S.leaderFor = gm?.id ?? null;
  S.leader = gm ? M.leaderOf(S.peers, { gmUserId: gm.id, cutoff: cutoff(), self: S.self }) : null;
  if (was === S.leader) return;
  log(`GM session leader: ${S.leader ?? "none"}${S.leader === S.self.id ? " (this client)" : ""}`);
  if (S.settled && S.leader === S.self.id) fireLeader();
}

function ping() {
  S.prevPing = S.lastPing; S.lastPing = Date.now();
  emit("ping"); recompute();
}

function onSessionMessage(msg, senderId) {
  const m = M.readSessionMessage(msg); if (!m || m.sid === S.self?.id) return;
  const sender = game.users.get(senderId); if (!sender?.isGM) return;
  S.peers = M.applySessionMessage(S.peers, m, sender.id, Date.now());
  if (m.op === "ping") emit("here");
  recompute();
}

/**
 * Ready hook, every client: GM clients take a random session id, say hello, answer other GM clients and ping every couple of
 * seconds. Players do nothing here (they never act as the GM).
 */
export function start() {
  if (S.started || !game.user?.isGM) return;
  S.self = { id: M.newId(), userId: game.user.id, since: Date.now() };
  S.started = true;
  game.socket.on(SOCKET, (msg, senderId) => { if (msg?.action === "gmSession") onSessionMessage(msg, senderId); });
  // Hear the other GM clients for a moment before acting; a lone client then leads (it always counts itself), so nothing waits forever.
  S.settle = new Promise(res => setTimeout(() => {
    S.settled = true; const before = S.leader; recompute();
    if (S.leader === S.self.id && before === S.leader) fireLeader(); // recompute() already fired when the leader changed
    res();
  }, M.SETTLE_MS));
  ping();
  S.timer = setInterval(ping, M.HEARTBEAT_MS);
  // Closing the tab hands over at once; a crash or a lost connection hands over after two missed pings.
  globalThis.addEventListener?.("pagehide", () => emit("bye"));
  // A GM user joining or leaving changes who the active GM is.
  Hooks.on("userConnected", user => { if (user?.isGM) setTimeout(recompute, 0); });
}

/** Resolves once this client has had time to hear the other GM clients (at once on players and before start). */
export function settled() { return S.started && !S.settled ? S.settle : Promise.resolve(); }

/** Runs `fn` on the client that becomes the leader (after load settles, or when the previous leader goes away). */
export function onLeader(fn) { if (typeof fn === "function") leaderFns.push(fn); }

/**
 * True on the one client that acts: the active GM user's leader session. Before the sessions start (or in Node) this is the plain
 * "this user is the active GM" check; for the first moment after load it is false until this client has heard the others.
 */
export function isActiveGM() {
  const gm = activeGM(); if (!gm || gm.id !== game.user?.id) return false;
  if (!S.started) return true;
  if (!S.settled) return false;
  if (S.leader === null || S.leaderFor !== gm.id) recompute();
  return S.leader === S.self.id;
}

/** This client's sessions view, for the health check: { self, sessions (same user, live), leader }. */
export function sessionInfo() {
  if (!S.started) return null;
  const mine = M.prune(S.peers, cutoff()).filter(p => p.userId === S.self.userId);
  return { self: S.self.id, sessions: mine.length + 1, leader: S.leader === S.self.id };
}

/** GMs connected right now. */
export function onlineGMs() {
  try { return game.users.filter(u => u.isGM && u.active); } catch { return []; }
}

// ---------------------------------------------------------------- request ids
const seen = M.seenCache();
/** A new request id for a socket request. */
export const newRequestId = () => M.newId();
/** False when this client already handled the request id in `msg` (requests without one always pass). */
export function firstTime(msg) { return seen.firstTime(M.requestId(msg)); }
/** True when a chat card stamped with request id `rid` under `flags.wayfarers-toolkit.<key>.rid` already exists. */
export function cardPosted(key, rid) {
  if (!rid) return false;
  try { return M.cardExists(game.messages?.contents ?? [...(game.messages ?? [])], ID, key, rid); } catch { return false; }
}
