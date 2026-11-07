/**
 * One GM client does the automatic work, through wanderers-core's leader (core.mjs). A world can have several GM users logged in at
 * once, and one GM user can be logged in on several clients; every hook or socket handler that writes documents on its own runs only
 * on the leader: the active GM user's first live session. Buttons and macros a GM clicks still run on that GM's client.
 *
 * Players and GM tabs that aren't the leader send requests with `request(kind, data)` (schemas in requests.mjs); the leader's handler
 * (`handle(kind, fn)`) gets the checked data and Foundry's sender user. Notices back go out with `notify()` as a broadcast hook.
 */
import { pickActiveGM as pick } from "../vendor/wanderers-core/index.mjs";
import { cardExists, cardCooldown } from "./gm-model.mjs";
import { leader } from "./core.mjs";
import { NOTICE_HOOK, readNotice } from "./requests.mjs";

const ID = "wayfarers-toolkit";

/** The active GM: Foundry's own pick when it is an active GM, else the active GM with the lowest user id, else null. */
export const pickActiveGM = (users = [], declared = null) => pick(users, declared);
/** The active GM user of this world, or null when no GM is connected. */
export const activeGM = () => leader.activeGM();
/** True on the one client that acts (the leader). Before start (or in Node): "this user is the active GM". */
export const isActiveGM = () => { try { return leader.isLeader(); } catch { return false; } };
/** Resolves once this client has heard the other GM clients (at once on players and before start). */
export const settled = () => leader.settled();
/** Runs `fn` on the client that becomes the leader (after load settles, or when the previous leader goes away). */
export const onLeader = fn => leader.onLeader(fn);
/** Registers the leader's handler for a request kind (requests.mjs). The handler gets (data, sender user, { rid }). */
export const handle = (kind, fn) => leader.handle(kind, fn);
/** Has the leader run `kind`; false when no GM is connected or the data doesn't fit the schema. */
export const request = (kind, data = {}) => leader.request(kind, data);

let noticeHooked = false;
/** Ready hook, every client: starts the leader and shows notices sent to this user. */
export function start() {
  if (!noticeHooked) {
    noticeHooked = true;
    Hooks.on(NOTICE_HOOK, payload => { const n = readNotice(payload, game.user?.id); if (n) ui.notifications[n.level](n.text); });
  }
  leader.start();
}

/**
 * Leader (or a GM writing directly): shows a notice on one user's client (`to` = user id) or everyone's (`to` = null). Only the
 * leader can broadcast; a GM tab that isn't the leader asks the leader (request notifyAll) for everyone-notices.
 */
export function notify(to, text, level = "info") {
  const payload = { to: to ?? null, level, text: String(text ?? "").slice(0, 300) };
  if (leader.isLeader()) { leader.broadcastHook(NOTICE_HOOK, payload); return true; }
  if (to === null && game.user?.isGM) return leader.request("notifyAll", { text: payload.text });
  if (to === game.user?.id) { const n = readNotice(payload, to); if (n) ui.notifications[n.level](n.text); }
  return false;
}

/** This client's sessions view, for the health check: { self, sessions (same user, live), leader } or null before start. */
export function sessionInfo() {
  const i = leader.info();
  return i.started ? { self: i.self, sessions: i.sessions, leader: i.leader } : null;
}

/** GMs connected right now. */
export function onlineGMs() {
  try { return game.users.filter(u => u.isGM && u.active); } catch { return []; }
}

/** True when a chat card stamped with request id `rid` under `flags.wayfarers-toolkit.<key>.rid` already exists. */
export function cardPosted(key, rid) {
  if (!rid) return false;
  try { return cardExists(game.messages?.contents ?? [...(game.messages ?? [])], ID, key, rid); } catch { return false; }
}

const COOLDOWN = cardCooldown();
/**
 * Leader, before posting a GM card for a player's request (2.3.2): true when `user` may have one now; otherwise tells them to wait
 * and returns false (the request is dropped). GMs are never held back.
 * @param {string} kind @param {any} user @param {string} what the notice's subject ("Travel pace")
 */
export function cardAllowed(kind, user, what) {
  if (!user || user.isGM) return true;
  if (COOLDOWN.take(kind, user.id)) return true;
  notify(user.id, `${what}: your last request is still with the GM. Wait ${COOLDOWN.seconds} seconds before asking again.`, "warn");
  return false;
}
