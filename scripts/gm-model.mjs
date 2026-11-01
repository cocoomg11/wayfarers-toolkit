/**
 * Pure helpers for "exactly one client acts" that core doesn't cover (no Foundry calls; tested in Node). The election itself (sessions,
 * pings, leader choice, request ids, the seen-before cache) moved to wanderers-core's leader-model in 1.27.0.
 */

/** True when one of `messages` (plain chat message data) already carries request id `rid` under `flags[ns][key].rid`. */
export function cardExists(messages = [], ns, key, rid) {
  if (!rid) return false;
  for (const m of messages) if (m?.flags?.[ns]?.[key]?.rid === rid) return true;
  return false;
}
