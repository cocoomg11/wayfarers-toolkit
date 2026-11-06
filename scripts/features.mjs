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
  { id: "restedInn", label: "Rested at the inn", hint: "Scenes marked as an Inn with a room price. Rent rooms (GM; players can ask) and the characters are Rested: their next long rest grants Heroic Inspiration (or an extra Hit Die, or temporary hit points), then Rested clears." },
  { id: "mapPins", label: "Map pins", hint: "The party's own marks on any scene, in an inked, hand-drawn style: a label, a short note, a mark (pin, flag, camp, cave, …), an ink colour and an optional quest link. Players place and change party pins through the GM's client; GM pins can stay hidden until revealed." },
  // 1.28.0
  { id: "questMapPins", label: "Quest objectives find their map pin", hint: "Clicking a tracked quest's objective (or its title) in the tracker, or an objective in the quest log, moves the map to the quest's map pin and pings it. Needs the quest log and map pins." },
  { id: "questGlow", label: "Updated quests glow", hint: "When the GM changes a quest a player can see, it glows in that player's tracker and quest log until they open it. Each player's own computer remembers what they've seen. Needs the quest log." },
  { id: "keybindings", label: "Keyboard shortcuts", hint: "Shortcuts in Configure Controls: (GM) the control panel, default Shift+K; the toolkit character sheet, default C, when the character sheet replacement is on; the character pane, no key until you choose one." },
  { id: "coinLog", label: "Coin log", hint: "GM only: every coin movement the toolkit makes (quest rewards, rooms, flight fares, vendor trash sales, loot coin, Split coin) is listed with who, how much, why and when, and the latest ones can be undone." },
  { id: "splitCoin", label: "Split coin", hint: "GM: share the party actor's coin evenly among its members, with a preview first. What doesn't divide evenly stays with the party." },
  { id: "innRestOffer", label: "Rest after renting rooms", hint: "After you rent rooms, the toolkit offers to long-rest everyone who rented and to move world time on (8 hours unless you change it). Needs Rested at the inn." },
  { id: "travelConfirm", label: "Cost and time before travel", hint: "Hex Travel and flights show what the trip costs (gold, silver, copper), how long it takes and who pays, and ask before going." },
  { id: "moduleHooks", label: "Hooks for other modules", hint: "Tells other modules (for example a session log) when quests change and when the party travels, through Foundry hooks. Nothing shows at the table." },
  // 1.31.0
  { id: "merchantShop", label: "Open shop for players", hint: "GM: open an Item Piles merchant on players' screens, each with their own character as the buyer, from the merchant window's header or the merchant token's HUD, and close it for everyone again. Needs Item Piles." },
  // 1.33.0 (slice 1; off by default)
  { id: "characterSheet", default: false, label: "Character sheet replacement", hint: "Wanderer's Toolkit sheet for player characters (dnd5e character actors), made the default sheet while this is on: a classic dark sheet with the level, XP, rests, inspiration, AC, hit points, hit dice, initiative, speed, exhaustion and death saves, all read from and handled by dnd5e itself. Character (paper doll shared with the character pane), Details, Inventory, Features and Spells pages are built; the other pages link to the system sheet for now. GMs get a System sheet button. With Keyboard shortcuts on, C opens it. Off: dnd5e's own sheet, nothing else changes." }
].map(f => ({ default: true, key: `feature-${f.id}`, ...f }));

/**
 * Hard needs, checked by core: a feature whose needs are off counts as off. Kept to the pairs whose hints say "Needs …" and where
 * the dependent tool does nothing alone; call sites still check both (F.need twice) as before.
 */
const NEEDS = { questTracker: ["questLog"], questMapPins: ["questLog", "mapPins"], questGlow: ["questLog"], innRestOffer: ["restedInn"] };

/** Core's feature registry bound to this module (wanderers-core createFeatures): same keys, same rules. */
const CORE = createFeatures(ID, FEATURES.map(f => ({ ...f, needs: NEEDS[f.id] ?? [] })), { title: "Wanderer's Toolkit" });

/** Whether a feature is turned on in this world. Unknown ids count as on. Before settings are registered, the default. */
export const on = id => CORE.on(id);

/** For API entry points: warns and returns false when the feature is off. */
export const need = id => CORE.need(id);

export function registerSettings() { CORE.register(); }
