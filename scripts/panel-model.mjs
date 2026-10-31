/**
 * The control panel's data, with no Foundry calls at import time (tested in Node): which settings each tab shows (basics first,
 * the rest under Advanced), the plain-language labels and hints, the value converters behind the pickers (encounter zones table,
 * hidden-scene checklist, compendium list), the welcome wizard's presets and the check that keeps the wizard away from worlds
 * that are already set up. Setting keys are the same as in every earlier version; only how they're shown changed.
 */

export const README = "https://github.com/cocoomg11/wayfarers-toolkit";

/** Feature cards: feature id (or "coins" for the Coin system setting), icon and one plain line. Order is the order shown. */
export const FEATURE_CARDS = [
  { id: "hexTravel", icon: "fa-solid fa-map", text: "Travel overland hex by hex. Off-road hexes can turn up random encounters; time passes and the trip is logged." },
  { id: "flightMaster", icon: "fa-solid fa-feather-pointed", text: "Fly the party between flight points you unlock, paying fares from the party purse. Players can book flights too." },
  { id: "sessionStart", icon: "fa-solid fa-flag-checkered", text: "Start a session in one step: pick the scene, post a \"Previously…\" recap and unpause." },
  { id: "vendorTrash", icon: "fa-solid fa-sack-dollar", text: "Defeated creatures carry grey junk loot and coin to match what they are, ready for the party to loot." },
  { id: "riderFeat", icon: "fa-solid fa-horse", text: "A riding feat for your world. When everyone in the party has it, Hex Travel goes at mounted speed." },
  { id: "characterPane", icon: "fa-solid fa-shirt", text: "An equipment frame around the character portrait. Drop gear in a slot to equip it." },
  { id: "questLog", icon: "fa-solid fa-scroll", text: "A quest log with story objectives you tick off. Players open it with the L key." },
  { id: "questTracker", icon: "fa-solid fa-location-crosshairs", text: "Shows tracked quests and their open objectives on screen. Needs the quest log." },
  { id: "bossFrames", icon: "fa-solid fa-crown", text: "Big health bars at the top of the screen for creatures you mark as bosses, while they're in combat." },
  { id: "bossLoot", icon: "fa-solid fa-gem", text: "Hand-picked drops for named creatures, drawn from a roll table you link to them." },
  { id: "lootRolls", icon: "fa-solid fa-dice", text: "Need / Greed / Pass rolls for items on a defeated creature. Needs the Item Piles module." },
  { id: "tokenRing", icon: "fa-solid fa-circle-notch", text: "Your own ring image around NPC tokens (or every token), drawn by Foundry's dynamic token rings. Off by default; token art isn't changed." },
  { id: "coins", icon: "fa-solid fa-coins", label: "Three-coin economy", text: "Copper, silver and gold only, 100 to 1, in place of the five 5e coins. Item prices aren't changed." }
];

/**
 * Tabs. Each setting row: key, the feature(s) it needs ("a", or "a:b" for both; null for always) and an optional picker kind.
 * `basic` is what most GMs touch; `advanced` goes under a collapsed Advanced section.
 */
export const TABS = [
  { id: "overview", label: "Overview", icon: "fa-solid fa-house", anchor: "overview-tab" },
  { id: "features", label: "Features", icon: "fa-solid fa-toggle-on", anchor: "features-tab" },
  {
    id: "travel", label: "Travel", icon: "fa-solid fa-route", anchor: "travel-tab",
    basic: [["zones", "hexTravel", "zones"], ["playerFlights", "flightMaster"], ["fareUnit", "flightMaster"], ["hiddenScenes", "sessionStart", "scenes"], ["campaignName", "sessionStart"]],
    advanced: [["encounterDie", "hexTravel"], ["offroadMult", "hexTravel"], ["mountMult", "hexTravel"], ["paceSlow", "hexTravel"], ["paceNormal", "hexTravel"], ["paceFast", "hexTravel"],
      ["flightSound", "flightMaster"], ["flightVolume", "flightMaster"], ["riderFeat", "riderFeat"], ["trackerJournal", null, "journal"], ["partyActor", null, "groupActor"]]
  },
  {
    id: "loot", label: "Loot", icon: "fa-solid fa-sack-dollar", anchor: "loot-tab",
    basic: [["trashAutoRoll", "vendorTrash"], ["trashAutoLoot", "vendorTrash"], ["trashGmAddedLoot", "vendorTrash"], ["partySize", null], ["lootRollSeconds", "lootRolls"]],
    advanced: [["trashUnconscious", "vendorTrash"], ["trashItemPiles", "vendorTrash"], ["dungeonCoinMult", "vendorTrash"], ["dungeonDropBonus", "vendorTrash"], ["dungeonExtraRoll", "vendorTrash"],
      ["trashPacks", "vendorTrash", "packs"], ["itemPilesCoins", "coins"], ["debugLog", null]]
  },
  {
    id: "boss", label: "Boss & Combat", icon: "fa-solid fa-crown", anchor: "boss--combat-tab",
    basic: [["bossHpDisplay", "bossFrames"], ["bossLootAuto", "bossLoot"], ["bossAutoFromLoot", "bossFrames:bossLoot"]],
    advanced: [["bossLootExtraDraw", "bossLoot"]]
  },
  {
    id: "quests", label: "Quests", icon: "fa-solid fa-scroll", anchor: "quests-tab",
    basic: [["questTracker", "questLog:questTracker"], ["questObjectiveChat", "questLog"], ["questSoundAccept", "questLog"], ["questSoundComplete", "questLog"]],
    advanced: [["questVolume", "questLog"], ["questFolder", "questLog", "journalFolder"]]
  },
  {
    id: "tokens", label: "Tokens", icon: "fa-solid fa-circle-notch", anchor: "tokens-tab",
    basic: [["ringImage", "tokenRing"], ["ringTargets", "tokenRing"], ["ringNewTokens", "tokenRing"], ["ringSubjectScale", "tokenRing"]],
    advanced: [["ringExisting", "tokenRing"]]
  }
];

/** Plain-language label and hint per setting (what it does at the table). */
export const LABELS = {
  updateNotes: ["Show update notes after updating", "After the module is updated, you get one whispered chat card saying what changed and what needs doing, with a button for each. Saved as soon as you switch it."],
  zones: ["Encounter zones", "Each zone the party can travel through, and the roll table its random encounters come from. Hex Travel offers these zones."],
  playerFlights: ["Players can book flights", "Players get a Flight Master button and can fly the party themselves. A GM has to be logged in; the fare comes out of the party purse."],
  fareUnit: ["Fares without a coin are in", "In the flight network editor, a fare typed as a plain number (like 2) is read in this coin. Fares like 1g 20s always work."],
  hiddenScenes: ["Scenes left out of Session Start", "Tick the scenes you never start a session on (test maps, galleries). They won't be offered in the Session Start list."],
  campaignName: ["Campaign name", "Shown in the session recap: \"Previously, in …\". Leave blank to use the world's title."],
  encounterDie: ["Encounter die", "Each off-road hex rolls this die; a 1 means an encounter. Bigger die, fewer encounters."],
  offroadMult: ["Off-road hexes take", "How many times longer an off-road hex takes than a road hex."],
  mountMult: ["Riding speeds travel up by", "Travel speed is multiplied by this when the party is mounted."],
  paceSlow: ["Slow pace (miles per hour)", ""],
  paceNormal: ["Normal pace (miles per hour)", ""],
  paceFast: ["Fast pace (miles per hour)", ""],
  flightSound: ["Departure sound", "Played for everyone when a flight takes off. Clear it for no sound."],
  flightVolume: ["Departure sound volume", ""],
  riderFeat: ["Riding feat name", "The name of the riding feat. Run setup creates a feat with this name; Hex Travel looks for it on each party member."],
  trackerJournal: ["Tracker journal", "The GM journal that holds the travel log and session recap. Run setup creates it if it's missing."],
  partyActor: ["Party actor", "The group actor whose purse pays for flights and whose members are the party. Run setup creates it if it's missing."],
  trashAutoRoll: ["Roll loot when creatures are placed", "When you place a creature on a scene, what it drops is decided straight away and waits hidden on it. Reroll from the dice button on its token."],
  trashAutoLoot: ["Bodies can be looted when they die", "At 0 HP (or marked defeated) a creature's body becomes something players can loot. Off: use the Vendor Trash macro yourself."],
  trashGmAddedLoot: ["Items you give a creature count as loot", "Gear you drag onto a creature's sheet shows up in its loot when it dies. Its own stat-block gear never does."],
  partySize: ["Party size", "How many characters are in the party. Boss coin grows with it, and bigger parties get an extra boss drop."],
  lootRollSeconds: ["Seconds to choose Need / Greed / Pass", "How long players get to pick on a loot roll. You can always close a roll early."],
  trashUnconscious: ["Unconscious creatures can be looted", "A creature knocked unconscious can be looted as if it had died."],
  trashItemPiles: ["Loot stays on the body (Item Piles)", "With the Item Piles module, players open the body and take the loot themselves. Off, or without Item Piles, you get a chat card with a Give to Party button."],
  dungeonCoinMult: ["Dungeon coin multiplier", "Creatures in scenes you mark as dungeons (Scene settings) drop this many times more coin."],
  dungeonDropBonus: ["Dungeon drop bonus (%)", "Extra chance for each item to drop in dungeon scenes (70% becomes 95% at +25)."],
  dungeonExtraRoll: ["Dungeons roll items twice", "Creatures in dungeon scenes roll their item drops a second time."],
  trashPacks: ["Where junk loot comes from", "The item compendiums junk loot is drawn from. Tick none to use the default item compendium when its module is installed (see the README)."],
  itemPilesCoins: ["Keep Item Piles' coins in step", "With the three-coin economy, Item Piles is set to copper, silver and gold each time the world loads. Turn off to manage Item Piles' coins yourself."],
  debugLog: ["Debug logging", "Writes why the toolkit did what it did (loot chosen, which GM ran it) to the browser console (F12). For troubleshooting."],
  bossHpDisplay: ["Boss health players see", "How much of a boss's health shows on its frame for players. You always see exact hit points."],
  bossLootAuto: ["Boss loot drops on death", "When a creature with boss loot dies, its drops are drawn and put on its body. Off: drop it yourself from a macro."],
  bossAutoFromLoot: ["Creatures with boss loot get a boss frame", "No need to mark them with the crown: in combat they get a frame anyway. Turning the crown off on one hides it."],
  bossLootExtraDraw: ["Extra boss drop for parties over 4", "With more than four players, bosses that drop three or more items drop one more."],
  questTracker: ["Show the quest tracker on my screen", "Just for you, on this computer: show your tracked quests on screen. Each player chooses for themselves."],
  questObjectiveChat: ["Announce objectives in chat", "Post a line in chat when you tick off or reveal an objective. Off: a pop-up notice instead."],
  questSoundAccept: ["Sound when a quest is given", "Played for everyone. Leave blank for none."],
  questSoundComplete: ["Sound when a quest is completed", "Played for everyone. Leave blank for none."],
  questVolume: ["Quest sound volume", ""],
  questFolder: ["Quest folder", "The journal folder your quests are kept in. Created with the first quest."],
  ringImage: ["Ring image", "A square image of the ring with a transparent middle (256 × 256 or bigger). Every token with Foundry's dynamic ring on uses it. Changing it reloads Foundry."],
  ringTargets: ["Which tokens get the ring", "NPCs only leaves player characters' tokens alone. Every token rings them too."],
  ringNewTokens: ["New tokens get the ring", "Tokens you place from now on get the ring straight away. Existing tokens: use Apply ring to existing tokens below."],
  ringSubjectScale: ["Token art size inside the ring", "How big the token art is next to the ring (Foundry's ring subject scale). The token art sits on top of the ring, so below 1 keeps the ring outside the art; 0.85 suits a ring drawn near the image's edge. Applies to tokens as they're ringed."],
  ringExisting: ["Keep existing tokens ringed", "Each time the world loads, the active GM rings any token or actor that should have the ring and doesn't. Off: only new tokens and the Apply button."]
};

/** Every setting key a tab shows. */
export const tabKeys = tab => [...(tab.basic ?? []), ...(tab.advanced ?? [])].map(([k]) => k);
/** Whether a row's feature condition holds, given which features are on ("coins" = three-coin economy). */
export const condOn = (cond, isOn) => !cond || cond.split(":").every(isOn);

// ---------------------------------------------------------------- encounter zones: table rows ↔ JSON setting
/** Stored zones JSON → editor rows [{ zone, table }] and the read error, if any (rows keep what could be read). */
export function zonesToRows(text) {
  const src = String(text ?? "").trim(); if (!src) return { rows: [], error: null };
  let z; try { z = JSON.parse(src); } catch (e) { return { rows: [], error: `the stored value isn't valid JSON (${String(e?.message ?? e)})` }; }
  if (!z || typeof z !== "object" || Array.isArray(z)) return { rows: [], error: "the stored value isn't a list of zones" };
  const rows = Object.entries(z).filter(([, t]) => typeof t === "string").map(([zone, table]) => ({ zone, table }));
  const bad = Object.keys(z).filter(k => typeof z[k] !== "string");
  return { rows, error: bad.length ? `zone ${bad.map(k => `"${k}"`).join(", ")} had no table name and was dropped` : null };
}
/** Editor rows → the JSON setting value. Rows with neither a name nor a table are left out; names are trimmed. */
export function rowsToZones(rows) {
  const out = {};
  for (const r of rows ?? []) { const zone = String(r.zone ?? "").trim(); if (!zone && !r.table) continue; out[zone] = String(r.table ?? ""); }
  return JSON.stringify(out);
}
/** Problems in the editor rows: [{ row (0-based), level: error (blocks saving) | warn, message }]. `tables`: world roll table names. */
export function zoneRowProblems(rows, tables = []) {
  const have = new Set(tables); const seen = new Map(); const out = [];
  (rows ?? []).forEach((r, i) => {
    const zone = String(r.zone ?? "").trim(); const table = String(r.table ?? "");
    if (!zone && !table) return;
    if (!zone) out.push({ row: i, level: "error", message: "give the zone a name" });
    else if (seen.has(zone.toLowerCase())) out.push({ row: i, level: "error", message: `"${zone}" is listed twice` });
    if (zone) seen.set(zone.toLowerCase(), i);
    if (!table) out.push({ row: i, level: "warn", message: "choose a roll table (until then, encounters there have no table)" });
    else if (!have.has(table)) out.push({ row: i, level: "warn", message: `there's no roll table called "${table}"` });
  });
  return out;
}

// ---------------------------------------------------------------- hidden scenes: checklist ↔ exact-name regex
const RE_SPECIAL = /[.*+?^${}()|[\]\\/]/g;
export const escapeRegex = s => String(s).replace(RE_SPECIAL, "\\$&");
/** Scene names → the setting value: "^(a|b)$" matching exactly those names, or "" for none. */
export function scenesToRegex(names) {
  const list = [...new Set((names ?? []).map(String).filter(n => n.length))];
  return list.length ? `^(${list.map(escapeRegex).join("|")})$` : "";
}
/** The setting value → the scene names, when it's one scenesToRegex made (or blank); null for a hand-written pattern. */
export function regexToScenes(re) {
  const src = String(re ?? "");
  if (!src) return [];
  const m = src.match(/^\^\(([\s\S]*)\)\$$/); if (!m) return null;
  const names = []; let cur = ""; const body = m[1];
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "\\") { if (i + 1 >= body.length) return null; cur += body[++i]; continue; }
    if (c === "|") { names.push(cur); cur = ""; continue; }
    if (/[.*+?^${}()[\]/]/.test(c)) return null;
    cur += c;
  }
  names.push(cur);
  return scenesToRegex(names) === src ? names : null;
}

// ---------------------------------------------------------------- compendium list
/** Stored compendium IDs (comma or space separated) → list. */
export const packsToList = s => String(s ?? "").split(/[,\s]+/).filter(Boolean);
/** List → stored value. */
export const listToPacks = ids => [...new Set(ids ?? [])].join(", ");

// ---------------------------------------------------------------- welcome wizard
export const FEATURE_IDS = ["hexTravel", "flightMaster", "sessionStart", "vendorTrash", "riderFeat", "characterPane", "questLog", "questTracker", "bossFrames", "lootRolls", "bossLoot", "tokenRing"];
/**
 * Style presets. Classic MMO is everything except the two overland-travel tools (Hex Travel and the riding feat, whose main use is
 * mounted hex travel); Everything turns every tool on. `suggestCoins` is only shown as a suggestion: the wizard starts on standard coins.
 */
export const PRESETS = {
  minimal: { label: "Minimal", icon: "fa-solid fa-feather", text: "Just the quest log, the on-screen quest tracker and the character pane. Add more any time.", on: ["questLog", "questTracker", "characterPane"] },
  classic: { label: "Classic MMO", icon: "fa-solid fa-dragon", text: "Flights, junk loot on every creature, boss frames and boss loot, loot rolls, quests and the character pane. No hex-by-hex overland travel.", on: FEATURE_IDS.filter(id => !["hexTravel", "riderFeat", "tokenRing"].includes(id)), suggestCoins: "threeCoin" },
  everything: { label: "Everything", icon: "fa-solid fa-layer-group", text: "Every tool on, including hex travel and the riding feat (the custom token ring stays off until you pick a ring image).", on: FEATURE_IDS.filter(id => id !== "tokenRing") }
};
/** A preset → the feature settings it writes: { "feature-<id>": boolean }. */
export function presetSettings(preset) {
  const p = PRESETS[preset]; if (!p) throw new Error(`unknown preset ${preset}`);
  return Object.fromEntries(FEATURE_IDS.map(id => [`feature-${id}`, p.on.includes(id)]));
}
/** Settings the wizard and the feature switches don't count when deciding whether a world is already configured. */
export const WIZARD_IGNORE = new Set(["wizardDone", "flightCache", "bossLayout", "bossFramePos", "trackedQuests", "trackerCollapsed", "paneWindow", "questTracker", "setupReminded", "lastSeenVersion"]);
/**
 * Whether the welcome wizard should stay away: the world already uses the toolkit when any world setting differs from its default
 * (`settings`: [{ key, scope, value, default }]), anything Run setup makes already exists (`setupFound`), or an earlier version of the
 * toolkit already loaded in this world (`remindedVersion`: the pre-1.17 setupReminded setting or lastSeenVersion, differs from `version`).
 */
export function worldConfigured({ settings = [], setupFound = false, remindedVersion = "", version = "" } = {}) {
  if (setupFound) return true;
  // A stored version (setupReminded before 1.17, lastSeenVersion after) from an earlier version means the toolkit ran here before.
  if (remindedVersion && remindedVersion !== version) return true;
  return settings.some(s => s.scope === "world" && !WIZARD_IGNORE.has(s.key) && JSON.stringify(s.value ?? null) !== JSON.stringify(s.default ?? null));
}

// ---------------------------------------------------------------- overview: health lines → plain issues with fixes
/**
 * A health line's fix: { action, label, tab? } or null. Actions: setup, tab, autolink, flights, flightImport, rules, reload, ringApply.
 * `section` is the health check's section title; `text` the line as plain text.
 */
export function issueFix(section, text, { hasAutolink = false } = {}) {
  const t = String(text ?? "");
  if (hasAutolink) return { action: "autolink", label: "Link boss tables by name" };
  if (section === "Setup") return { action: "setup", label: "Run setup" };
  if (/Run setup adds it|No group actor named/.test(t)) return { action: "setup", label: "Run setup" };
  if (section === "Encounter zones") return { action: "tab", tab: "travel", label: "Edit encounter zones" };
  if (/Vendor (trash compendiums|Trash has no item compendium)/i.test(t)) return { action: "tab", tab: "loot", label: "Choose compendiums" };
  if (/Item Piles' currencies/.test(t)) return { action: "tab", tab: "loot", label: "Open Loot settings" };
  if (/Reload Foundry/.test(t)) return { action: "reload", label: "Reload" };
  if (section === "Flight Master" && /Flight Routes journal page/.test(t)) return { action: "flightImport", label: "Import from the Flight Routes journal page" };
  if (section === "Flight Master") return { action: "flights", label: "Open the flight network" };
  if (section === "Vendor Trash Rules page") return { action: "rules", label: "Open the rules page" };
  if (section === "Custom token ring" && /Apply ring/.test(t)) return { action: "ringApply", label: "Apply ring to existing tokens" };
  if (section === "Custom token ring") return { action: "tab", tab: "tokens", label: "Open Tokens settings" };
  return null;
}

/** The pre-1.15 default for Scenes hidden from Session Start: two names, read as that checklist (saving makes it exact-name). */
export const LEGACY_HIDDEN = "Hex Test|NPC Gallery";
/** The hidden-scenes setting → ticked names, or null when it's a hand-written pattern the checklist can't show. */
export const hiddenToScenes = re => String(re ?? "") === LEGACY_HIDDEN ? LEGACY_HIDDEN.split("|") : regexToScenes(re);
