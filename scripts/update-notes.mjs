/**
 * Update notes: what changed in each version, in plain words, and what a GM may need to do after updating. The active GM gets these
 * as one whispered chat card the first time the world loads a newer version (updates.mjs posts it). This file has no Foundry calls
 * at import time and is tested in Node.
 *
 * An entry: { version, changes: [text | { text, feature }], actions: [action] }. An action: { id, label, icon, feature?, hint?,
 * check(ctx) → true while it still needs doing, run(ctx) }. `ctx` is { api, on, importFlights } (the module API, the feature check and
 * the flight import flow), so
 * check and run only touch Foundry when they're called. Actions and lines with a `feature` are left out while that feature is off.
 * To add a version: add an entry at the top. A version with nothing worth saying needs no entry (patch updates without one post nothing).
 */

/** Offered after any update while it's still needed. */
export const ALWAYS_ACTIONS = [
  {
    id: "setup", label: "Run setup", icon: "fa-solid fa-hammer",
    hint: "Adds what the tools turned on still need (tracker journal, party actor, macros in the Wayfarer's Toolkit macro folder). Never overwrites anything and never touches a hotbar.",
    check: ({ api }) => api.setupPlan().some(p => !p.ok),
    run: ({ api }) => api.setup()
  }
];

export const NOTES = [
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

// ---------------------------------------------------------------- versions
/** "1.16.0" → [1, 16, 0]; null when it isn't a version. A "v" prefix and a "-beta"-style suffix are ignored. */
export function parseVersion(v) {
  const m = /^v?(\d+(?:\.\d+)*)/.exec(String(v ?? "").trim());
  return m ? m[1].split(".").map(Number) : null;
}
/** -1, 0 or 1. Missing parts count as 0 (1.16 = 1.16.0). Unreadable versions sort before every real one. */
export function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return !x && !y ? 0 : !x ? -1 : 1;
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] ?? 0) - (y[i] ?? 0); if (d) return d < 0 ? -1 : 1; }
  return 0;
}

// ---------------------------------------------------------------- what to do on ready
/**
 * Decides what the ready hook does: { kind, from }. kinds: "fresh" (a new world: store the version, say nothing; the welcome wizard
 * covers it), "upgrade" (post notes from `from`, exclusive; null = an unknown older version), "same" (nothing), "downgrade" (store
 * the running version silently, so updating again shows the notes again).
 * `stored` is lastSeenVersion; `setupReminded` the version the pre-1.17 setup reminder last ran for; `wizardDone` the wizard flag.
 */
export function decide({ stored = "", current = "", wizardDone = false, setupReminded = "" } = {}) {
  if (!parseVersion(current)) return { kind: "same", from: null };
  if (parseVersion(stored)) {
    const c = compareVersions(current, stored);
    return c > 0 ? { kind: "upgrade", from: stored } : c < 0 ? { kind: "downgrade", from: stored } : { kind: "same", from: stored };
  }
  // No stored version: an earlier version that kept no record (before 1.17), or a new world.
  if (parseVersion(setupReminded)) {
    return compareVersions(current, setupReminded) > 0 ? { kind: "upgrade", from: setupReminded } : { kind: "same", from: setupReminded };
  }
  if (wizardDone) return { kind: "upgrade", from: null };
  return { kind: "fresh", from: null };
}

/** The entries newer than `from` (exclusive; null = all) up to `to` (inclusive), newest first. */
export function entriesBetween(notes = NOTES, from = null, to = null) {
  return notes.filter(n => (from == null || compareVersions(n.version, from) > 0) && (to == null || compareVersions(n.version, to) <= 0))
    .sort((a, b) => compareVersions(b.version, a.version));
}

const lineText = l => typeof l === "string" ? l : l?.text ?? "";
const allowed = (x, on) => !x?.feature || on(x.feature);

/**
 * Builds the notice: { from, to, entries: [{ version, changes: [text] }], actions: [action], post }. Lines and actions for features
 * that are off are dropped, actions are deduped by id (the newest entry's wins, then ALWAYS_ACTIONS), and an action whose check says
 * it's done (or throws) is left out. `post` is false when there's nothing to say. `check` is called with `ctx`.
 */
export async function build({ notes = NOTES, always = ALWAYS_ACTIONS, from = null, to, on = () => true, ctx = {} } = {}) {
  const ctxOn = { on, ...ctx };
  const entries = entriesBetween(notes, from, to).map(n => ({ version: n.version, changes: (n.changes ?? []).filter(l => allowed(l, on)).map(lineText).filter(Boolean), actions: (n.actions ?? []).filter(a => allowed(a, on)) }));
  const seen = new Set(); const candidates = [];
  for (const a of [...entries.flatMap(e => e.actions), ...always.filter(a => allowed(a, on))]) { if (!seen.has(a.id)) { seen.add(a.id); candidates.push(a); } }
  const actions = [];
  for (const a of candidates) { let need = false; try { need = !!(await a.check?.(ctxOn)); } catch { need = false; } if (need) actions.push(a); }
  const shown = entries.filter(e => e.changes.length).map(({ version, changes }) => ({ version, changes }));
  return { from, to, entries: shown, actions, post: shown.length > 0 || actions.length > 0 };
}

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
  return `<div class="wct-update"><h3>Wayfarer's Toolkit updated: ${range}</h3>${body}${todo}<p><a data-wct-update="panel"><i class="fa-solid fa-toolbox"></i> Open the control panel</a></p></div>`;
}
