/**
 * The one place that binds wanderers-core (vendor/wanderers-core, pinned in wanderers-core.lock.json) to this module: the logger and
 * the one-writer leader with the toolkit's request schemas. The feature registry is bound in features.mjs. Importing this file calls
 * nothing in Foundry; `leader.start()` runs from the ready hook.
 *
 * The leader replaces the toolkit's own GM-session election (1.25.1): one client acts even when one GM user has several tabs open,
 * requests are schema-checked and rate-limited, repeats are dropped by request id, and broadcast hooks are accepted only from the
 * leader's session of a GM user. See gm.mjs for the names the rest of the toolkit calls.
 */
import { createLeader, createLogger } from "../vendor/wanderers-core/foundry/index.mjs";
import { REQUESTS, NOTICE_HOOK } from "./requests.mjs";

export const ID = "wayfarers-toolkit";
export const logger = createLogger(ID);
export const leader = createLeader({ id: ID, log: logger.log, requests: REQUESTS, hooks: [NOTICE_HOOK] });
