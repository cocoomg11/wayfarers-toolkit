/**
 * Update notes: what changed in each version, in plain words, and what a GM may need to do after updating. The active GM gets these
 * as one whispered chat card the first time the world loads a newer version (updates.mjs posts it). This file has no Foundry calls
 * at import time and is tested in Node.
 *
 * An entry: { version, changes: [text | { text, feature }], actions: [action] }. An action: { id, label, icon, feature?, hint?,
 * check(ctx) → true while it still needs doing, run(ctx) }. `ctx` is { api, on, importFlights } (the module API, the feature check and
 * the flight import flow), so
 * check and run only touch Foundry when they're called. Actions and lines with a `feature` are left out while that feature is off.
 * Ordering, filtering and the decision are wanderers-core's notes-model (pure); this file keeps the notes and the card.
 * To add a version: add an entry at the top. A version with nothing worth saying needs no entry (patch updates without one post nothing).
 */

/** Offered after any update while it's still needed. */
import * as C from "../vendor/wanderers-core/index.mjs";

export const ALWAYS_ACTIONS = [
  {
    id: "setup", label: "Run setup", icon: "fa-solid fa-hammer",
    hint: "Adds what the tools turned on still need (tracker journal, party actor, macros in the Wanderer's Toolkit macro folder). Never overwrites anything and never touches a hotbar.",
    check: ({ api }) => api.setupPlan().some(p => !p.ok),
    run: ({ api }) => api.setup()
  }
];

export const NOTES = [
  {
    version: "2.1.0",
    changes: [
      "New, off by default: Merchant coin rounding. Item Piles merchant prices round to a whole smallest coin (half a coin or more rounds up), so a 1-copper item at half price costs 1 copper instead of nothing. Turn it on on the control panel's Features tab; it sets Item Piles' Currency decimal digits when the world loads and puts the old value back when you turn it off."
    ],
    actions: []
  },
  {
    version: "2.0.1",
    changes: [
      { feature: "characterSheet", text: "Character sheet fixes: Delete and Create item on the Inventory page work again, and dropping an item on a Finger slot no longer logs an error." }
    ],
    actions: []
  },
  {
    version: "2.0.0",
    changes: [
      { feature: "characterSheet", text: "Wanderer's Toolkit 2.0: the character sheet replacement gets its first real pages. Character is the paper doll with weapon sets, Details has the abilities, skills, tools and traits, and Inventory lists your items with prices, weight, quantity and uses." },
      { feature: "characterSheet", text: "Equipping an item from the Inventory page now puts it in the matching paper-doll slot (and unequipping frees the slot), the same as on the character pane." },
      { feature: "characterSheet", text: "The other pages (Features, Spells, Effects, Biography, Bastion, Special traits) still open the system sheet for now." }
    ],
    actions: []
  },
  {
    version: "1.33.2",
    changes: [
      { feature: "characterSheet", text: "Key C: a player without an assigned character now opens the character they own (with several, the one whose token is selected)." }
    ],
    actions: []
  },
  {
    version: "1.33.1",
    changes: [
      { feature: "characterSheet", text: "Foundry's own Toggle Character Sheet key now moves to Alt+C while the toolkit sheet uses C (Shift+C was already Foundry's Focus Chat, so it never moved there). As before, only if you haven't changed that key yourself, and it goes back to C when you turn the sheet off." },
      { feature: "characterSheet", text: "Character sheet: the page bookmarks are now on the right edge of the sheet." }
    ],
    actions: []
  },
  {
    version: "1.33.0",
    changes: [
      "New, optional: a Character sheet replacement. It is off by default; turn it on in the control panel (then reload). It shows the essentials of a character (level, XP, AC, HP, hit dice, initiative, speed, exhaustion, death saves, conditions) with page tabs; the pages themselves come in later releases, and each has an Open in system sheet button for now.",
      "With it on, the C key opens your character's sheet. Foundry's own Toggle Character Sheet moves to another key when one is free (it is put back if you turn the sheet off)."
    ],
    actions: []
  },
  {
    version: "1.32.0",
    changes: [
      "Less clutter in chat: posting a health check or update notes card now removes the toolkit's older cards of that kind, so one of each is left. Switch it off on the control panel's Overview tab, or use Clear old toolkit cards there to tidy up now.",
      "Health check: players without a character (spare or test accounts) can be ignored with the Ignore these users fix, or under Loot › Advanced.",
      { text: "Health check: several routes into locked flight points are one line, with the list behind Show the routes.", feature: "flightMaster" },
      { text: "Character pane: fits short screens (the sheet scrolls inside the window).", feature: "characterPane" },
      "Control panel: unsaved changes are marked on the Save button and on the tabs that have them.",
      { text: "Shortcut: Shift+K opens the control panel (change it under Configure Controls).", feature: "keybindings" }
    ],
    actions: []
  },
  {
    version: "1.31.1",
    changes: [
      "Fixed: the comparison on the loot roll card now shows for players.",
      "Fixed: the loot history's session heading no longer repeats the date."
    ],
    actions: []
  },
  {
    version: "1.31.0",
    changes: [
      { text: "New: Open shop for players. Open an Item Piles merchant on your players' screens, each shopping with their own character, from the merchant window's title bar or the merchant token's HUD, and close it for everyone again. Switch it off on the control panel's Features tab.", feature: "merchantShop" },
      { text: "Loot history: a Session filter and a By session view. With the Red Book module, rolls are grouped by its sessions; without it, by date.", feature: "lootRolls" },
      { text: "Loot roll cards: each player sees the item compared with what their own character has in that slot (follows Item comparison tooltips).", feature: "lootRolls" }
    ],
    actions: []
  },
  {
    version: "1.30.2",
    changes: [
      "Fixed: the loot roll card no longer says \"A GM needs to be connected.\" when a GM is online."
    ],
    actions: []
  },
  {
    version: "1.30.1",
    changes: [
      "Fixed: in Foundry's light theme the character pane's numbers (armour class, hit points, speed and the rest) and other text on the dark panels (quest list and page, quest tracker, boss frames, item tooltips) could turn dark and hard to read. They now keep their own colours in both themes."
    ],
    actions: []
  },
  {
    version: "1.30.0",
    changes: [
      "A new look across the toolkit: every window, dialog and chat card now follows Foundry's own theme (dark or light), sharing one look with the Wanderer's Satchel and Red Book. The control panel has a sidebar you can move through with the arrow keys. Coins show as gold, silver and copper with little coin marks; item borders use one set of quality colours.",
      { feature: "characterPane", text: "The character pane is now a full character sheet: level, class, species and party under the name, a Rested badge, Attuned n / 3, a health bar with temporary hit points, your coins, empty slots drawn as outlines, and boxes for Attributes, Defence (AC, hit points, hit dice, initiative, speed, saves) and Attack. The Attack box follows the weapon set in your hands (melee, ranged or spell); pick one by hand from its menu. Everything else works as before." },
      "The health check's chat card is now one line (how many checks are fine, warnings and problems) with an Open in Wanderer's Satchel button when that module is on; without it you get the full card as before.",
      { feature: "questLog", text: "Fixed: quest levels written like \"Act 4 · Lv 8\" now give the quest its difficulty colour (the text stays as you wrote it). Reward items added by a macro now show their rarity colour." },
      "Windows remember where you left them: the control panel, quest log, character pane, flight map and editor, coin log, loot history, party gold and health check reopen at the same place and size. Control panel › Loot › Advanced › Reset window positions puts them back.",
      "The GM-only records journal moves once into a \"Module data\" journal folder that stays out of the Journal sidebar. Nothing in it changes. To see it, turn on Show module data folder (control panel › Loot › Advanced).",
      "Health check lines with a quick repair (Run setup, Link boss tables, make the records journal GM only, file it) now offer a Fix button in the Wanderer's Satchel and the control panel's Overview. Each asks first. Your shortcuts in Configure Controls carry over unchanged."
    ]
  },
  {
    version: "1.29.0",
    changes: [
      { feature: "questLog", text: "The quest log has a new look: a native Foundry window (dark or light theme) with a stone-framed quest list and a parchment page. Zones fold with + and −, names are coloured by difficulty, and finished quests say (Ready)." },
      { feature: "questLog", text: "Each quest now belongs to one party (a group actor). Players only see their own party's quests: in the log, the tracker, journals, chat and on map pins. Your quests were given your party actor; add more parties under control panel › Quests › Parties, and filter the log by party." },
      { feature: "questLog", text: "Quest levels set a difficulty against the party's level (Trivial, Easy, Even, Hard, Deadly). Objectives can have counters (3/8) you move with + and −. Rewards can include \"Choose one of these rewards\": a player in the party picks. Complete and pay sends coin and items to the quest's party." },
      { feature: "questLog", text: "Quest cap (control panel › Quests › Advanced, default 25): you're warned when a party has more active quests than that. Shown as Quest Log (n / cap)." }
    ]
  },
  {
    version: "1.28.0",
    changes: [
      { feature: "questMapPins", text: "Click an objective (or a quest's title) in the tracker, or an objective in the quest log, and the map moves to the quest's map pin and pings it. A pin on another scene: you're offered to view it; players are told which scene." },
      { feature: "questGlow", text: "When you change a quest, it glows for players in their tracker and quest log (marked Updated) until they open it." },
      { feature: "keybindings", text: "New shortcuts in Configure Controls: open the character pane, and (GM) the control panel. No keys are set; pick your own." },
      { feature: "coinLog", text: "Coin log (control panel › Loot): every coin movement the toolkit makes, with who, how much, why and when. Undo the latest ones: paid coin is given back; given coin is taken back only if the character still has it." },
      { feature: "splitCoin", text: "Split coin: share the party actor's coin evenly among its members, with a preview. In the party sheet's header menu and control panel › Loot." },
      { feature: "innRestOffer", text: "After renting rooms you're offered a long rest for everyone who rented, and to move time on (8 hours; change it under Places › Advanced)." },
      { feature: "travelConfirm", text: "Hex Travel and flights now show the cost, the time and who pays before going. Skip it under Travel › Advanced." },
      { feature: "moduleHooks", text: "Other modules (such as a session log) can now hear when quests change and when the party travels." },
      "Each of these is its own switch on the Features tab."
    ]
  },
  {
    version: "1.27.2",
    changes: [
      "The module is now called Wanderer's Toolkit (it was Wayfarer's Toolkit), to match the Wanderer's Satchel hub. Only the name you see changed: nothing to do, and your world's data, settings and macros are untouched.",
      { feature: "questTracker", text: "The on-screen quest tracker can be moved: drag it by its title (or focus the grip and use the arrow keys). Each person's spot is kept on their own computer. It now starts clear of Foundry's own buttons; double-click its title, or use the button in the quest log, to put it back. It can also be closed with its X and shown again with Show tracker at the top of the quest log." }
    ]
  },
  {
    version: "1.27.0",
    changes: [
      { feature: "restedInn", text: "Inns are now their own records, several per scene if you like: a name, a room price, an innkeeper token (its HUD gets a Rent rooms button) and, on v14, an optional region. Add them in the scene's Table Tools tab or with Make innkeeper here… on a token's HUD. Your Inn scenes became one inn each." },
      "Per-scene options (title card, Dungeon, inns) moved to the new Table Tools tab of Scene Configuration, shared with the other modules.",
      "GM secrets no longer reach players' computers: hidden quest objectives and GM text, hidden map pins, locked flight points, gold snapshots and the loot history now live in a GM-only journal, \"Wayfarer's Toolkit (GM only)\". Don't share it with players. Your data was moved once (see the whisper).",
      { feature: "restedInn", text: "Rested is now checked against the rooms you rented, so players can't make their own characters Rested." },
      { feature: "mapPins", text: "Players can see map pins again on Foundry v14. Hidden pins aren't on the map until you reveal them; you see them as faint ringed marks." },
      "Session Start and Who's online moved to the Red Book module. Install it to keep them; it picks up your settings and Hub scenes.",
      "Settings export / import moved to the hub module (one file for every module). Permission checks are now always part of the health check.",
      { feature: "bossLoot", text: "The health check is much faster with boss loot tables." }
    ]
  },
  {
    version: "1.26.0",
    changes: [
      { feature: "mapPins", text: "New: Map pins. Click the Map pin button in the token controls, then the map, to leave an inked mark with a label and a short note (pin, flag, camp, cave, question, cross, skull or star, in six inks), optionally linked to a quest. Players can place and change the party's pins too; your client saves them, so they need no extra permission, but a GM has to be logged in. Your own pins can stay hidden from players until you reveal them. Settings under control panel › Places › Advanced; switch the whole tool off under Features." }
    ]
  },
  {
    version: "1.25.0",
    changes: [
      { feature: "whosOnline", text: "Who's online: the panel now starts just right of the scene navigation instead of on top of it. Anyone can drag it by its title to a spot of their own (remembered in their browser, always kept on screen); double-click the title to put it back. Switch moving off under control panel › Places › Advanced." },
      { feature: "flightMap", text: "Flight route map: scroll the mouse wheel to zoom in and out around the cursor, and drag the empty map to move around; Reset view goes back to the whole map. Works for players too, and the background picture zooms with the points. GMs can still drag points and Save layout at any zoom. Switch it off under control panel › Travel › Advanced." }
    ]
  },
  {
    version: "1.24.0",
    changes: [
      "Remove toolkit data now also clears the Rested status icon, Hex Travel's trip counter on the tracker journal, and (a new box, unticked by default) the toolkit's flags on chat messages. The cards stay; their buttons stop working.",
      "Boss frames and boss loot do less work in the background when nothing relevant changed. Nothing looks different."
    ]
  },
  {
    version: "1.23.0",
    changes: [
      { feature: "flightMapBackground", text: "Flight map background: put a picture of your own (a map of your continent or region, from your world's files) behind the flight route map. Pick it under control panel › Travel › Advanced (or Background… on the map), with fit, scale, offset and opacity, then drag the flight points onto it and Save layout. Players see the same picture. No picture picked: the map looks as before." }
    ]
  },
  {
    version: "1.22.0",
    changes: [
      { feature: "zoneTitles", text: "Zone title cards: when you activate a scene, its name fades in over the map for everyone, classic-MMO style. Give a scene its own title, a subtitle (like \"Levels 1–3\") and a sound, or switch its card off, in the scene's configuration (Title card). When and for whom: control panel › Places." },
      { feature: "whosOnline", text: "Who's online: tick Hub scene in a scene's configuration and everyone there sees who's connected, with their character's portrait. It says \"Everyone's here\" when the party is complete, and fires a hook your own tiles or macros can listen to (see the README). Also a Who's Online macro." },
      { feature: "restedInn", text: "Rested at the inn: mark a scene as an Inn with a room price (scene configuration › Inn). Rent rooms from control panel › Places or the Rent Rooms macro; the chosen characters are Rested, and their next long rest gives Heroic Inspiration (or an extra Hit Die, or temporary hit points; Places › Rested gives). Players on an Inn scene can ask you for rooms." },
      { feature: "vendorTrash", text: "Vendor trash now has weight: junk loot that came with none gets a sensible one (bones and teeth a fraction of a pound, hides a few pounds), so it counts against carrying capacity. Switch it off or scale it under control panel › Loot › Advanced. Trash already on characters or bodies is fixed with api.trash.applyWeights(actor) in the console." },
      "The three new tools are switches on the Features tab, on by default. Run setup adds the Rent Rooms and Who's Online macros to the macro folder; nothing goes on a hotbar."
    ]
  },
  {
    version: "1.21.0",
    changes: [
      { feature: "sessionStart", text: "Session Start no longer has a recap: its window now picks the scene, activates it for players and unpauses, and writes the start to the Travel Log as before. It no longer posts a \"Previously, in …\" message or edits a recap page, and the Campaign name setting is gone from the control panel and the welcome wizard." },
      { feature: "sessionStart", text: "Your tracker journal's Session Recap page is left as it is, and Run setup no longer creates one. If you don't need it any more, you can delete that page yourself." }
    ]
  },
  {
    version: "1.20.0",
    changes: [
      { feature: "flightMap", text: "Flight route map: the flight network drawn as a map (map button in the token controls, the Flight Route Map macro, or control panel › Travel). Players see the flight points they've unlocked and the routes between them; drag points to arrange it and Save layout." },
      { feature: "flightMaster", text: "Unlocking a flight point now posts \"Discovered! New flight point: …\" in chat (Announce new flight points, Travel › Advanced)." },
      { feature: "flightMaster", text: "Flights no longer move world time on by default. Turn on Flights advance world time (Travel › Advanced) to have the clock, and any calendar module, jump ahead by the flight's hours on arrival." },
      { feature: "travelPace", text: "Travel pace for Hex Travel: fast, normal or slow (careful), each with its effect on Perception, Survival and Stealth checks shown in Hex Travel and chat. Set the party's pace in the Travel Pace window; players can ask for one and you accept from a whisper." },
      { feature: "partyGold", text: "Party gold tracker (GM only, read-only): the coin your player characters and the party actor carry, optionally with their mundane gear, against a wealth curve per act × party size, in green, amber or red. Edit the curve and the current act in Loot › Advanced; open it from Loot › Party gold… or the Party Gold macro." },
      { feature: "settingsIO", text: "Settings export / import: control panel › Overview › Export settings saves every toolkit setting to a file; Import settings… shows what would change and writes only what you tick." },
      { feature: "permissionChecks", text: "The health check now has a Permissions section: for each tool that's on, whether players have what it needs (characters they own, script macros, the party actor, quest journals, the module socket), with a fix for each." },
      "The new tools are switches on the Features tab. Run setup adds the new macros (Flight Route Map, Travel Pace, Party Gold) to the macro folder; nothing goes on a hotbar."
    ],
    actions: [
      {
        id: "flightTime", feature: "flightMaster", label: "Keep flights advancing world time", icon: "fa-solid fa-clock",
        hint: "Before 1.20 every flight moved world time on by its hours. Click to keep doing that (Flights advance world time, Travel › Advanced).",
        check: ({ api }) => { try { return game.settings.get("wayfarers-toolkit", "flightAdvanceTime") !== true; } catch { return false; } },
        run: () => game.settings.set("wayfarers-toolkit", "flightAdvanceTime", true)
      }
    ]
  },
  {
    version: "1.19.0",
    changes: [
      { feature: "lootRolls", text: "Loot history: every finished loot roll is recorded (item, each player's Need, Greed or Pass and roll, who got it, and how it ended). Open it from control panel › Loot › Loot history…, or the Loot History macro. Sort it, filter by player or session date, see a tally per player, export a CSV or clear it. Only GMs see it." },
      { feature: "vendorTrash", text: "Sell all junk: Item Piles merchant windows get a Sell all junk button that sells every grey item a character carries at the merchant's prices, after showing the list and the total. Equipped items, favourites and weapon-set items are never sold." },
      { feature: "bossFrames", text: "Boss phase marks: right-click a boss's crown button (token HUD) or its frame to set phase marks, like 66, 33. The health bar shows a mark at each, and you get a whisper when the boss drops below one. Players see the marks only if you turn on Show phase marks to players (control panel › Boss & Combat)." },
      { feature: "characterPane", text: "Item comparison: hovering an item in the character pane, a loot pile or a merchant shows how it compares with what's in its slot or weapon-set hand (armour class, damage, bonuses, properties, attunement, value, weight), in green when better and red when worse, with a note when it would need both hands." },
      "Each new part can be switched off on its own in the control panel: Keep a loot roll history and Sell all junk button (Loot › Advanced), Show phase marks to players (Boss & Combat) and Item comparison tooltips (Character)."
    ]
  },
  {
    version: "1.18.0",
    changes: [
      { feature: "characterPane", text: "Weapon sets in the character pane: Melee, Ranged and Utility. Only the set in hand is equipped on the character sheet, so only its weapons count for attacks, AC and bonuses. The others stay visible, dimmed and marked Stowed." },
      { feature: "characterPane", text: "Click a set's tab to swap. A two-handed weapon can't be used while a shield is on: the pane says why and offers a Stow shield button. Bucklers (shields with Buckler ticked, or with buckler in the name) leave the hand free." },
      { feature: "characterPane", text: "During combat, a swap posts a short chat line with its cost (control panel › Character › Weapon swap cost; Part of an attack by default). Nothing is enforced; outside combat swaps are free and silent." },
      { feature: "characterPane", text: "A relic slot for a spellcasting focus or a relic, for the classes you tick (Paladin, Druid and Cleric to start with)." },
      { feature: "characterPane", text: "Existing characters keep their gear: what was in the main and off hand becomes the Melee set, the ranged slot the Ranged set, and Melee is in hand. Switch weapon sets off on the control panel's new Character tab to go back to the old slots." }
    ]
  },
  {
    version: "1.17.0",
    changes: [
      "Update notes in chat: after an update, the GM gets one whispered card saying what changed since the version this world last ran, with a button for anything that needs doing. Buttons that are already done show as done.",
      "The card replaces the old once-per-version Run setup reminder.",
      "Switch it off with Show update notes after updating on the control panel's Overview tab; Show update notes there brings it back any time."
    ]
  },
  {
    version: "1.16.0",
    changes: [
      { feature: "flightMaster", text: "Flight network editor: flight points and routes are set up in a window (control panel › Travel › Flight network…), with fares, hours, two-way and free routes, and problems shown before you save." },
      { feature: "flightMaster", text: "Flight points don't need a scene: the party still flies, pays and lands there; the GM is told to move the party." },
      { feature: "flightMaster", text: "Free flights: the GM can fly the party without charging a fare, and a route can be marked free for everyone." },
      { feature: "flightMaster", text: "The old Flight Routes journal page is no longer read. Import it once into the new flight network." }
    ],
    actions: [
      {
        id: "flightImport", feature: "flightMaster", label: "Import flight network from the old Flight Routes page", icon: "fa-solid fa-feather-pointed",
        hint: "Copies the old page's flight points and routes into the flight network (asks first). The page isn't changed.",
        check: ({ api }) => !!api.canImportLegacyFlights(),
        run: ({ importFlights }) => importFlights()
      }
    ]
  },
  {
    version: "1.15.0",
    changes: [
      "Control panel: every setting in one window with tabs (Overview, Features, Travel, Loot, Boss & Combat, Quests). Open it from the module settings.",
      "The Overview tab says what needs attention, with a fix-it button for each problem.",
      "Pickers and tables in place of typed values (encounter zones, hidden scenes, compendiums). Nothing you set before was lost.",
      "A welcome wizard for new worlds."
    ]
  },
  {
    version: "1.14.4",
    changes: ["Toolkit windows no longer slow the game down while they're open."]
  },
  {
    version: "1.14.3",
    changes: ["Run setup no longer puts macros on any hotbar. Drag them from the Wayfarer's Toolkit macro folder or compendium."]
  },
  {
    version: "1.14.1",
    changes: [{ feature: "vendorTrash", text: "Add your own loot: items you give an NPC show in its body's loot, and an NPC can be marked Everything is lootable." }]
  },
  {
    version: "1.14.0",
    changes: [
      "Party size setting: boss loot coin and draws scale with it.",
      { feature: "lootRolls", text: "Loot rolls: the GM can assign an item, and the winner gets a whisper." },
      "Remove toolkit data, for cleaning the toolkit out of a world.",
      "Clearer error messages and a debug logging setting."
    ]
  },
  {
    version: "1.13.0",
    changes: [
      "With several GMs online, only one runs the automatic steps.",
      "Health check: a report of anything missing or misconfigured.",
      "No loot switch for creatures that shouldn't drop anything.",
      { feature: "flightMaster", text: "Flight Master shows the fare for everyone, the purse and the hours before you confirm." }
    ]
  }
];

// ---------------------------------------------------------------- versions (wanderers-core version.mjs and notes-model.mjs)
/** "1.16.0" → [1, 16, 0]; null when it isn't a version. A "v" prefix is ignored; a "-beta"-style suffix is read by core. */
export function parseVersion(v) {
  const m = /^v?(\d+(?:\.\d+)*)/.exec(String(v ?? "").trim());
  return m ? m[1].split(".").map(Number) : null;
}
/** -1, 0 or 1 (core's semver compare). Unreadable versions sort before every real one. */
export function compareVersions(a, b) {
  const x = !!parseVersion(a), y = !!parseVersion(b);
  if (!x || !y) return !x && !y ? 0 : !x ? -1 : 1;
  return C.compareVersions(String(a).trim(), String(b).trim()) ?? 0;
}

// ---------------------------------------------------------------- what to do on ready
/**
 * Decides what the ready hook does: { kind, from } (core's decide, plus the toolkit's pre-1.17 record). kinds: "fresh" (a new world:
 * store the version, say nothing; the welcome wizard covers it), "upgrade" (post notes from `from`, exclusive; null = an unknown older
 * version), "same" (nothing), "downgrade" (store the running version silently, so updating again shows the notes again).
 * `stored` is lastSeenVersion; `setupReminded` the version the pre-1.17 setup reminder last ran for; `wizardDone` the wizard flag.
 */
export function decide({ stored = "", current = "", wizardDone = false, setupReminded = "" } = {}) {
  if (!parseVersion(current)) return { kind: "same", from: null };
  // No stored version but the pre-1.17 reminder's stamp: it says where the world came from.
  if (!parseVersion(stored) && parseVersion(setupReminded)) {
    return compareVersions(current, setupReminded) > 0 ? { kind: "upgrade", from: setupReminded } : { kind: "same", from: setupReminded };
  }
  return C.decide({ stored, current, knownWorld: !!wizardDone });
}

/** The entries newer than `from` (exclusive; null = all) up to `to` (inclusive), newest first. */
export const entriesBetween = (notes = NOTES, from = null, to = null) => C.entriesBetween(notes, from, to);

/**
 * Builds the notice (core's buildNotice): { from, to, entries: [{ version, changes: [text] }], actions: [action], post }. Lines and
 * actions for features that are off are dropped, actions are deduped by id (the newest entry's wins, then ALWAYS_ACTIONS), and an
 * action whose check says it's done (or throws) is left out. `post` is false when there's nothing to say. `check` gets { on, ...ctx }.
 * @param {{ notes?: any, always?: any, from?: string | null, to?: string, on?: (id: string) => boolean, ctx?: any }} [opts]
 */
export const build = ({ notes = NOTES, always = ALWAYS_ACTIONS, from = null, to, on = () => true, ctx = {} } = {}) => C.buildNotice({ notes, always, from, to: /** @type {string} */ (to), on, ctx });

/** For a manual re-show without a version: the newest entry older than `to`, so only `to`'s own notes show. */
export function previousVersion(notes = NOTES, to) {
  return notes.map(n => n.version).filter(v => compareVersions(v, to) < 0).sort((a, b) => compareVersions(b, a))[0] ?? null;
}

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The chat card's HTML. The newest version is open; older ones are collapsed. Buttons carry data-wct-update="<action id>". */
export function cardHTML(notice) {
  const { from, to, entries, actions } = notice;
  const range = from ? `${esc(from)} → ${esc(to)}` : `${esc(to)} (from an earlier version)`;
  const list = e => `<ul>${e.changes.map(c => `<li>${esc(c)}</li>`).join("")}</ul>`;
  const body = entries.map((e, i) => i === 0 ? `<h4>What's new in ${esc(e.version)}</h4>${list(e)}` : `<details><summary>${esc(e.version)}</summary>${list(e)}</details>`).join("");
  const todo = actions.length ? `<h4>To do</h4><ul class="wct-update-actions">${actions.map(a => `<li><button type="button" data-wct-update="${esc(a.id)}"><i class="${esc(a.icon ?? "fa-solid fa-check")}"></i> ${esc(a.label)}</button>${a.hint ? `<p class="hint">${esc(a.hint)}</p>` : ""}</li>`).join("")}</ul>` : `<p>Nothing needs doing.</p>`;
  return `<div class="wct-update"><h3>Wanderer's Toolkit updated: ${range}</h3>${body}${todo}<p><a data-wct-update="panel"><i class="fa-solid fa-toolbox"></i> Open the control panel</a></p></div>`;
}
