/**
 * Features: one world setting per tool, so each world picks what it uses. A turned-off feature registers nothing (no buttons,
 * hooks, key bindings, socket handlers, chat buttons or wrappers) and Run setup skips its macros and items.
 * To add a feature, add an entry to FEATURES and gate its registration with on("<id>").
 */
import { createFeatures } from "../vendor/wanderers-core/foundry/index.mjs";
const ID = "wayfarers-toolkit";

/** id, label, hint, default. `key` overrides the setting key (kept for settings that existed before the registry). */
export const FEATURES = [
  { id: "hexTravel", label: "Hex Travel", hint: "Overland travel by hexes with off-road encounter rolls; advances time and logs the trip." },
  { id: "flightMaster", label: "Flight Master", hint: "Flight routes with fares from the party purse, the feather button in the token controls and player bookings." },
  { id: "sessionStart", label: "Session Start", hint: "Pick a scene, activate it for players and unpause; logs the start in the Travel Log." },
  { id: "vendorTrash", label: "Vendor Trash", hint: "Grey loot pre-rolled on NPC tokens and lootable when they die (bodies with Item Piles, or a Give to Party card), matched to the creature and scaled by CR, richer in scenes marked as dungeons, Sell Vendor Trash, and a Sell all junk button on Item Piles merchants." },
  { id: "riderFeat", label: "Riding Training", hint: "Setup adds the Riding Training feat; Hex Travel rides mounted by default when every party member has it (Long Road)." },
  { id: "characterPane", key: "characterPane", label: "Character pane", hint: "A classic-MMO-style equipment frame opened from the character sheet header, with weapon sets, a relic slot and item comparison tooltips, and its AC handling for slotted armour pieces." },
  { id: "questLog", label: "Quest log", hint: "Narrative quests with objectives the GM ticks off, kept as journal entries, with a quest log window (key L)." },
  { id: "questTracker", label: "Quest tracker", hint: "An on-screen list of tracked quests and their open objectives. Needs the quest log; each player can still hide it." },
  { id: "bossFrames", label: "Boss frames", hint: "Health frames at the top of every screen for tokens the GM marks as bosses (crown button in the token HUD) while they're in combat, with optional phase marks." },
  { id: "lootRolls", label: "Loot rolls", hint: "Need / Greed / Pass rolls for an item in an Item Piles pile: a dice button on the item's row starts one; the winner's character gets the item, and a GM-only loot history. Needs Item Piles." },
  { id: "bossLoot", label: "Boss loot", hint: "Link a roll table of hand-picked drops to a creature (gem button in the token HUD). When it dies, the table is drawn and the items go on its body (an Item Piles pile, or a Give to Party card), with a Start loot roll button per item." },
  { id: "flightMap", label: "Flight route map", hint: "A map of the flight network: flight points and the routes between them. The GM sees and arranges every point; players see the unlocked ones (locked ones hidden or greyed). Needs Flight Master." },
  { id: "flightMapBackground", label: "Flight map background", hint: "A picture of your own (a continent or region map from your world's files) behind the flight route map, with fit, scale, offset and opacity so the flight points line up with it. Everyone who opens the map sees it. Needs the flight route map." },
  { id: "travelPace", label: "Travel pace", hint: "Fast, normal or slow (careful) pace for Hex Travel, with each pace's effect on Perception, Survival and Stealth checks. The GM sets the party's pace; players can ask for one. Needs Hex Travel." },
  { id: "partyGold", label: "Party gold tracker", hint: "GM only, read-only: the coin the player characters and the party actor carry (optionally their mundane gear too), compared with a wealth curve per act × party size." },
  { id: "zoneTitles", label: "Zone title cards", hint: "A title card (the scene's title, an optional subtitle and sound) fades in over the map when a scene is activated, or each time one is viewed. Per-scene title, subtitle and sound in the scene configuration." },
  { id: "whosOnline", label: "Who's online", hint: "A board of who's connected, with their character's portrait and name: a small panel on scenes marked Hub, and a window. Says \"Everyone's here\" and fires a hook world tiles and macros can listen to." },
  { id: "restedInn", label: "Rested at the inn", hint: "Scenes marked as an Inn with a room price. Rent rooms (GM; players can ask) and the characters are Rested: their next long rest grants Heroic Inspiration (or an extra Hit Die, or temporary hit points), then Rested clears." },
  { id: "mapPins", label: "Map pins", hint: "The party's own marks on any scene, in an inked, hand-drawn style: a label, a short note, a mark (pin, flag, camp, cave, …), an ink colour and an optional quest link. Players place and change party pins through the GM's client; GM pins can stay hidden until revealed." }
].map(f => ({ default: true, key: `feature-${f.id}`, ...f }));

/**
 * Hard needs, checked by core: a feature whose needs are off counts as off. Kept to the pairs whose hints say "Needs …" and where
 * the dependent tool does nothing alone; call sites still check both (F.need twice) as before.
 */
const NEEDS = { questTracker: ["questLog"] };

/** Core's feature registry bound to this module (wanderers-core createFeatures): same keys, same rules. */
const CORE = createFeatures(ID, FEATURES.map(f => ({ ...f, needs: NEEDS[f.id] ?? [] })), { title: "Wayfarer's Toolkit" });

/** Whether a feature is turned on in this world. Unknown ids count as on. Before settings are registered, the default. */
export const on = id => CORE.on(id);

/** For API entry points: warns and returns false when the feature is off. */
export const need = id => CORE.need(id);

export function registerSettings() { CORE.register(); }
