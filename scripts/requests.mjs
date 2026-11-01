/**
 * Every socket request the toolkit accepts, as wanderers-core request schemas (pure; tested in Node). Players (and GM tabs that
 * aren't the leader) send these with `leader.request(kind, data)`; the leader reads each one through the schema before its handler
 * runs: unknown kinds, unknown fields, wrong types, oversized payloads and malformed request ids are refused, and the sender is
 * always Foundry's sender user (never a field in the payload; there is no `userId` field any more).
 *
 * Notices back to one player ("your flight was booked", "the pin wasn't saved") and objective notices to everyone are not requests:
 * they go out as broadcast hooks from the leader (NOTICE_HOOK), which other clients accept only from the leader's session of a GM.
 */
import { defineRequests } from "../vendor/wanderers-core/index.mjs";
import { LABEL_MAX, TEXT_MAX, OPS as PIN_OPS } from "./pins-model.mjs";

const ID = "wayfarers-toolkit";
/** The one broadcast hook for notices: payload { to: userId | null (everyone), level: "info" | "warn", text }. */
export const NOTICE_HOOK = `${ID}.notice`;
/** The id field Foundry gives documents. */
const id = { type: "id" };
const optId = { type: "id", optional: true };
const pinFields = {
  type: "object", extra: "drop",
  fields: {
    label: { type: "string", max: LABEL_MAX * 2 }, text: { type: "string", max: TEXT_MAX * 2, optional: true },
    icon: { type: "string", max: 20, optional: true }, ink: { type: "string", max: 20, optional: true },
    quest: { type: "string", max: 40, optional: true }
  }
};

export const REQUESTS = defineRequests({
  /** A player's flight booking. Always charged, always changes the scene when the point has one. */
  flight: { fields: { from: { type: "string", max: 64 }, to: { type: "string", max: 64 }, pax: { type: "number", int: true, min: 1, max: 20 } }, maxBytes: 1024 },
  /** A player's travel pace request (becomes a whisper with an Accept button). */
  paceRequest: { fields: { pace: { type: "string", oneOf: ["fast", "normal", "slow", "careful", "cautious"] } }, maxBytes: 256 },
  /** Loot roll: a player's Need / Greed / Pass. */
  lootChoice: { fields: { messageId: id, choice: { type: "string", oneOf: ["need", "greed", "pass"] } }, maxBytes: 256 },
  /** Loot roll: a GM tab that isn't the leader closes a roll, or assigns its item. GM senders only. */
  lootClose: { fields: { messageId: id }, from: "gm", maxBytes: 256 },
  lootAssign: { fields: { messageId: id, actorId: id }, from: "gm", maxBytes: 256 },
  /** Inn: a player asks the GM for rooms at an inn (scene + inn record id). */
  roomRequest: { fields: { sceneId: id, innId: { type: "string", max: 40, optional: true } }, maxBytes: 256 },
  /** Inn: a character finished a long rest while Rested (owner or GM only; checked in the handler). */
  restedRest: { fields: { actorId: id, sceneId: optId }, maxBytes: 256 },
  /** A GM tab that isn't the leader asks the leader to broadcast a notice to everyone (quest objective lines). GM senders only. */
  notifyAll: { fields: { text: { type: "string", max: 300 } }, from: "gm", maxBytes: 1024 },
  /** Map pins: create, update, move or delete (pins-model.mjs decides). */
  mapPin: {
    fields: {
      op: { type: "string", oneOf: PIN_OPS }, sceneId: id, noteId: optId,
      x: { type: "number", optional: true }, y: { type: "number", optional: true }, level: optId, pin: { ...pinFields, optional: true }
    },
    maxBytes: 4096
  }
});

/** A core request's data shaped like the old socket message the toolkit's pure readers expect ({ action, ...data }). */
export const asMessage = (kind, data) => ({ action: kind, ...(data ?? {}) });

/**
 * A notice payload as accepted on the receiving client: { level, text } for this user, or null (not for us, malformed). `me` is this
 * client's user id. Text is cut to 300 characters; it is shown with ui.notifications, which escapes it.
 */
export function readNotice(payload, me) {
  if (!payload || typeof payload !== "object") return null;
  const to = payload.to ?? null;
  if (to !== null && to !== me) return null;
  if (typeof payload.text !== "string" || !payload.text.trim()) return null;
  return { level: payload.level === "warn" ? "warn" : "info", text: payload.text.slice(0, 300) };
}
