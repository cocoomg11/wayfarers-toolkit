/**
 * Fewer toolkit cards in chat (1.32): after the toolkit posts a health card or an update-notes card, the GM who posted it deletes the
 * toolkit's older cards of that kind, so at most one of each is left (world setting pruneToolkitCards, default on). The control
 * panel's "Clear old toolkit cards" does the same for both kinds at once. Which messages count is chat-cards-model.mjs (pure): our
 * flag and our card's root class together, never a player's message, never loot, quest, room or pace cards.
 */
import * as CC from "./chat-cards-model.mjs";

const ID = "wayfarers-toolkit";
const get = key => { try { return game.settings.get(ID, key); } catch { return undefined; } };

export function registerSettings() {
  game.settings.register(ID, "pruneToolkitCards", { name: "Keep only the newest health and update card", hint: "When the toolkit posts a health check or update notes card, it deletes its own older cards of that kind from chat.", scope: "world", config: false, type: Boolean, default: true });
}

/** Plain data for the pure model. @param {any} m */
const plainOf = m => ({ id: m.id, timestamp: m.timestamp, flags: m.flags, content: m.content, authorIsGM: m.author ? !!m.author.isGM : undefined });

/** Ids of the older toolkit cards (of `kinds`) in this world's chat. @param {readonly string[]} [kinds] */
export function oldIds(kinds = CC.KINDS) {
  return CC.pruneIds([...(game.messages ?? [])].map(plainOf), { kinds });
}
/** What Clear old toolkit cards would delete: { health, updates, total }. */
export const counts = () => CC.pruneCounts([...(game.messages ?? [])].map(plainOf));

/** Deletes the given messages (GM only). Returns how many went. @param {string[]} ids */
async function remove(ids) {
  if (!game.user?.isGM || !ids.length) return 0;
  const there = ids.filter(id => game.messages.get(id));
  if (!there.length) return 0;
  try { await ChatMessage.deleteDocuments(there); return there.length; }
  catch (e) { console.warn(`${ID} | removing old toolkit cards`, e); return 0; }
}

/** After posting a card of `kind`: older ones go, when the setting is on (GM only). @param {"health" | "updates"} kind */
export function afterPost(kind) {
  if (!game.user?.isGM || get("pruneToolkitCards") === false) return Promise.resolve(0);
  return remove(oldIds([kind]));
}

/** Clear old toolkit cards (GM, with its own confirm in the panel): both kinds, newest of each kept. */
export const clearOld = () => remove(oldIds());
