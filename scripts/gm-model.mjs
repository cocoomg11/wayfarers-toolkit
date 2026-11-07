/**
 * Pure helpers for "exactly one client acts" that core doesn't cover (no Foundry calls; tested in Node). The election itself (sessions,
 * pings, leader choice, request ids, the seen-before cache) moved to wanderers-core's leader-model in 1.27.0.
 */

import { rateLimiter } from "../vendor/wanderers-core/index.mjs";

/** 2.3.2: one GM card per user per request kind in this many seconds (pace and room requests); extras are dropped with a notice. */
export const CARD_COOLDOWN_S = 30;

/**
 * A per-user, per-kind cooldown for request cards on the leader: `take(kind, userId, now?)` → true when a card may be posted (and
 * starts the wait), false while the user's last card of that kind is younger than `seconds`. Core's token bucket with burst 1.
 * @param {{ seconds?: number }} [opts]
 */
export function cardCooldown({ seconds = CARD_COOLDOWN_S } = {}) {
  const lim = rateLimiter({ burst: 1, perSecond: 1 / seconds, maxKeys: 500 });
  return { take: (/** @type {string} */ kind, /** @type {string} */ userId, now = Date.now()) => lim.take(`${kind}:${userId}`, now), clear: () => lim.clear(), seconds };
}

/** True when one of `messages` (plain chat message data) already carries request id `rid` under `flags[ns][key].rid`. */
export function cardExists(messages = [], ns, key, rid) {
  if (!rid) return false;
  for (const m of messages) if (m?.flags?.[ns]?.[key]?.rid === rid) return true;
  return false;
}
