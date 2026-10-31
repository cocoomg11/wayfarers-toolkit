/**
 * Features: one world setting per tool, so each world picks what it uses. A turned-off feature registers nothing (no buttons,
 * hooks, key bindings, socket handlers, chat buttons or wrappers) and Run setup skips its macros and items.
 * To add a feature, add an entry to FEATURES and gate its registration with on("<id>").
 */
const ID = "wayfarers-toolkit";

/** id, label, hint, default. `key` overrides the setting key (kept for settings that existed before the registry). */
export const FEATURES = [
  { id: "hexTravel", label: "Hex Travel", hint: "Overland travel by hexes with off-road encounter rolls; advances time and logs the trip." },
  { id: "flightMaster", label: "Flight Master", hint: "Flight routes with fares from the party purse, the feather button in the token controls and player bookings." },
  { id: "sessionStart", label: "Session Start", hint: "Pick a scene, post a \"Previously…\" recap and unpause." },
  { id: "vendorTrash", label: "Vendor Trash", hint: "Grey loot pre-rolled on NPC tokens and lootable when they die (bodies with Item Piles, or a Give to Party card), matched to the creature and scaled by CR, richer in scenes marked as dungeons, Sell Vendor Trash, and a Sell all junk button on Item Piles merchants." },
  { id: "riderFeat", label: "Riding Training", hint: "Setup adds the Riding Training feat; Hex Travel rides mounted by default when every party member has it (Long Road)." },
  { id: "characterPane", key: "characterPane", label: "Character pane", hint: "A classic-MMO-style equipment frame opened from the character sheet header, with weapon sets, a relic slot and item comparison tooltips, and its AC handling for slotted armour pieces." },
  { id: "questLog", label: "Quest log", hint: "Narrative quests with objectives the GM ticks off, kept as journal entries, with a quest log window (key L)." },
  { id: "questTracker", label: "Quest tracker", hint: "An on-screen list of tracked quests and their open objectives. Needs the quest log; each player can still hide it." },
  { id: "bossFrames", label: "Boss frames", hint: "Health frames at the top of every screen for tokens the GM marks as bosses (crown button in the token HUD) while they're in combat, with optional phase marks." },
  { id: "lootRolls", label: "Loot rolls", hint: "Need / Greed / Pass rolls for an item in an Item Piles pile: a dice button on the item's row starts one; the winner's character gets the item, and a GM-only loot history. Needs Item Piles." },
  { id: "bossLoot", label: "Boss loot", hint: "Link a roll table of hand-picked drops to a creature (gem button in the token HUD). When it dies, the table is drawn and the items go on its body (an Item Piles pile, or a Give to Party card), with a Start loot roll button per item." }
].map(f => ({ default: true, key: `feature-${f.id}`, ...f }));

const byId = id => FEATURES.find(f => f.id === id);

/** Whether a feature is turned on in this world. Unknown ids count as on. */
export function on(id) {
  const f = byId(id); if (!f) return true;
  try { return !!game.settings.get(ID, f.key); } catch { return f.default; }
}

/** For API entry points: warns and returns false when the feature is off. */
export function need(id) {
  if (on(id)) return true;
  ui.notifications.warn(`${byId(id)?.label ?? id} is turned off in Wayfarer's Toolkit › Features.`);
  return false;
}

export function registerSettings() {
  for (const f of FEATURES) game.settings.register(ID, f.key, { name: `Feature: ${f.label}`, hint: f.hint, scope: "world", config: false, type: Boolean, default: f.default, requiresReload: true });
}
