import { test } from "node:test";
import assert from "node:assert/strict";
import "./_globals.mjs";
import * as Pace from "../scripts/travel-pace.mjs";
import * as G from "../scripts/gold-model.mjs";
import * as IO from "../scripts/settings-io-model.mjs";
import * as Perm from "../scripts/permissions.mjs";
import { FEATURES } from "../scripts/features.mjs";
import { FEATURE_IDS, FEATURE_CARDS, TABS, tabKeys, LABELS, presetSettings } from "../scripts/panel-model.mjs";
import { MACROS, macroOn } from "../scripts/macros.mjs";
import { NOTES } from "../scripts/update-notes.mjs";
const Flight = await import("../scripts/flight.mjs");

// ---------------------------------------------------------------- travel pace
test("travel pace: SRD 5.2 figures and effects", () => {
  assert.deepEqual(Pace.PACE_IDS.map(p => [Pace.PACES[p].perHour, Pace.PACES[p].perDay]), [[4, 30], [3, 24], [2, 18]]);
  assert.equal(Pace.effectText("fast"), "Disadvantage on Perception, Survival and Stealth checks.");
  assert.equal(Pace.effectText("normal"), "Disadvantage on Stealth checks.");
  assert.equal(Pace.effectText("slow"), "Advantage on Perception and Survival checks.");
  assert.equal(Pace.normPace("Careful"), "slow"); assert.equal(Pace.normPace("cautious"), "slow");
  assert.equal(Pace.normPace("FAST"), "fast"); assert.equal(Pace.normPace("sprint"), "normal"); assert.equal(Pace.normPace(null), "normal");
  assert.match(Pace.optionLabel("fast", 5), /^Fast · 5 mph · disadvantage on Perception/);
  assert.match(Pace.optionLabel("slow"), /^Slow \(careful\) · 2 mph · advantage/);
});

test("travel pace: trip hours and days", () => {
  assert.equal(Pace.tripHours({ road: 6, off: 0, mph: 3 }), 2);
  assert.equal(Pace.tripHours({ road: 2, off: 2, mph: 2, offroadMult: 2 }), 3, "off-road hexes count double");
  assert.equal(Pace.tripHours({ road: 6, mph: 2, mounted: true, mountMult: 1.5 }), 2);
  assert.equal(Pace.tripHours({ road: 6, mph: 2, mounted: false, mountMult: 1.5 }), 3, "the multiplier only applies mounted");
  assert.equal(Pace.tripHours({ road: 0, off: 0 }), 0);
  assert.equal(Pace.tripHours({ road: 3, mph: 0 }), Infinity);
  assert.equal(Pace.tripHours({ road: -5, off: "x", mph: 3 }), 0, "bad input reads as no hexes");
  assert.equal(Pace.tripDays({ road: 24, pace: "normal" }), 1);
  assert.equal(Pace.tripDays({ road: 30, pace: "fast" }), 1);
  assert.equal(Pace.tripDays({ road: 9, off: 0, pace: "slow" }), 0.5);
  assert.equal(Pace.tripDays({ road: 48, pace: "normal", mph: 6 }), 1, "a faster world setting scales the day");
  assert.equal(Pace.tripDays({ road: 36, pace: "normal", mounted: true, mountMult: 1.5 }), 1);
});

test("travel pace: requests", () => {
  assert.equal(Pace.canRequest({ isGM: false, requestsOn: true }), true);
  assert.equal(Pace.canRequest({ isGM: true, requestsOn: true }), false);
  assert.equal(Pace.canRequest({ isGM: false, requestsOn: false }), false);
  assert.deepEqual(Pace.readRequest({ action: "paceRequest", pace: "fast", userId: "u1" }), { pace: "fast", userId: "u1" });
  assert.deepEqual(Pace.readRequest({ action: "paceRequest", pace: "careful" }), { pace: "slow", userId: null });
  assert.equal(Pace.readRequest({ action: "paceRequest", pace: "warp" }), null);
  assert.equal(Pace.readRequest({ action: "flight", pace: "fast" }), null);
  assert.equal(Pace.readRequest(null), null);
});

// ---------------------------------------------------------------- party gold
const STD = { pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 };
const THREE = { gp: 10000, sp: 100, cp: 1 };

test("gold: curve parsing", () => {
  assert.deepEqual(G.DEFAULT_CURVE, [1, 3, 15, 30, 75, 200, 400, 600, 1200]);
  assert.deepEqual(G.parseCurve("").curve, G.DEFAULT_CURVE);
  assert.deepEqual(G.parseCurve(G.curveText()).curve, G.DEFAULT_CURVE, "round trip");
  assert.deepEqual(G.parseCurve("1g, 2.5gp; 10\n20").curve, [1, 2.5, 10, 20]);
  assert.match(G.parseCurve("1, two, 3").error, /"two"/);
  assert.equal(G.parseCurve("1, two").curve, null);
  assert.match(G.parseCurve(Array(21).fill(1).join(",")).error, /20/);
});

test("gold: coin, prices and mundane gear in either coin system", () => {
  assert.equal(G.coinBase({ gp: 2, sp: 3, cp: 4, pp: 1, ep: 2 }, STD), 1000 + 200 + 100 + 30 + 4);
  assert.equal(G.coinBase({ gp: 1, sp: 2, cp: 3, pp: 9 }, THREE), 10203, "coins not in use are ignored");
  assert.equal(G.coinBase(null, STD), 0);
  assert.equal(G.priceBase({ value: 5, denomination: "sp" }, STD), 50);
  assert.equal(G.priceBase({ value: 5, denomination: "sp" }, THREE), 500);
  assert.equal(G.priceBase({ value: 1, denomination: "pp" }, THREE), 100000, "platinum prices with three coins read as 10 gold");
  assert.equal(G.priceBase({ value: 0.5 }, STD), 50, "no denomination is gold");
  const items = [
    { type: "weapon", rarity: "", quantity: 1, price: { value: 10, denomination: "gp" } },
    { type: "loot", rarity: "", quantity: 3, price: { value: 2, denomination: "sp" } },
    { type: "weapon", rarity: "rare", quantity: 1, price: { value: 500, denomination: "gp" } },
    { type: "equipment", rarity: "", magical: true, quantity: 1, price: { value: 100, denomination: "gp" } },
    { type: "spell", rarity: "", quantity: 1, price: { value: 99, denomination: "gp" } },
    { type: "consumable", rarity: "", quantity: 0, price: { value: 99, denomination: "gp" } }
  ];
  assert.equal(G.gearBase(items, STD), 1000 + 60);
  assert.equal(G.isMundane({ type: "tool" }), true); assert.equal(G.isMundane({ type: "feat" }), false);
});

test("gold: status bands and the per-act table", () => {
  assert.equal(G.status(100, 100), "green"); assert.equal(G.status(75, 100), "green"); assert.equal(G.status(150, 100), "green");
  assert.equal(G.status(74, 100), "amber"); assert.equal(G.status(50, 100), "amber"); assert.equal(G.status(200, 100), "amber");
  assert.equal(G.status(49, 100), "red"); assert.equal(G.status(201, 100), "red");
  assert.equal(G.status(0, 0), "green"); assert.equal(G.status(5, 0), "red");
  assert.equal(G.direction(10, 100), "below"); assert.equal(G.direction(300, 100), "above"); assert.equal(G.direction(100, 100), "on track");
  const rows = G.actRows({ size: 4, wealth: 6000, gpVal: 100, current: 2 });
  assert.equal(rows.length, 9);
  assert.deepEqual(rows.slice(0, 3).map(r => [r.act, r.target, r.status, r.current]), [[1, 400, "red", false], [2, 1200, "red", true], [3, 6000, "green", false]]);
  assert.equal(rows[8].target, 1200 * 100 * 4);
  assert.equal(G.actRows({ size: 0, wealth: 0, gpVal: 10000 })[0].target, 10000, "party size at least 1; three-coin gold");
  assert.equal(G.clampAct(0), 1); assert.equal(G.clampAct(99), 9); assert.equal(G.clampAct("3"), 3);
  const snaps = G.addSnapshot([{ a: 1 }, null, "x"], { a: 2 }, 2);
  assert.deepEqual(snaps, [{ a: 2 }, { a: 1 }]);
});

// ---------------------------------------------------------------- settings export / import
const DEFS = new Map([
  ["partySize", { scope: "world", type: Number, range: { min: 1, max: 8 }, name: "Party size" }],
  ["coinSystem", { scope: "world", type: String, choices: { standard: "s", threeCoin: "t" }, name: "Coin system" }],
  ["feature-hexTravel", { scope: "world", type: Boolean, name: "Feature: Hex Travel" }],
  ["flightNetwork", { scope: "world", type: Object }],
  ["bossLayout", { scope: "client", type: Object }],
  ["trackedQuests", { scope: "client", type: String }]
]);

test("settings io: export separates world and client and skips records", () => {
  const out = IO.buildExport([
    { key: "partySize", scope: "world", value: 5 }, { key: "bossLayout", scope: "client", value: { a: 1 } },
    { key: "lootHistoryData", scope: "world", value: { entries: [1] } }, { key: "questTracker", scope: "user", value: true },
    { key: "campaignName", scope: "world", value: undefined }
  ], { version: "1.20.0", exported: "t" });
  assert.equal(out.module, "wayfarers-toolkit"); assert.equal(out.format, 1); assert.equal(out.version, "1.20.0");
  assert.deepEqual(out.world, { campaignName: null, partySize: 5 });
  assert.deepEqual(out.client, { bossLayout: { a: 1 }, questTracker: true });
  assert.match(IO.fileName("My World!", new Date(2026, 9, 31)), /^wayfarers-toolkit-settings-my-world-2026-10-31\.json$/);
});

test("settings io: value checks", () => {
  assert.deepEqual(IO.checkValue({ type: Boolean }, true), { ok: true, value: true });
  assert.equal(IO.checkValue({ type: Boolean }, "yes").ok, false);
  assert.deepEqual(IO.checkValue({ type: Number, range: { min: 1, max: 8 } }, 12), { ok: true, value: 8, reason: "kept within 1 to 8" });
  assert.equal(IO.checkValue({ type: Number }, NaN).ok, false);
  assert.equal(IO.checkValue({ type: String, choices: { a: 1 } }, "b").ok, false);
  assert.equal(IO.checkValue({ type: String }, 3).ok, false);
  assert.equal(IO.checkValue({ type: Object }, []).ok, false);
  assert.equal(IO.checkValue({ type: Array }, []).ok, true);
  assert.equal(IO.checkValue({ type: "SomeModel" }, { x: 1 }).ok, true, "unknown types accept JSON values");
});

test("settings io: import validation, preview rows and unknown keys", () => {
  const file = { module: "wayfarers-toolkit", format: 1, version: "1.19.0",
    world: { partySize: 6, coinSystem: "fivecoin", "feature-hexTravel": true, removedInFuture: 1, lootHistoryData: {}, bossLayout: { b: 2 } },
    client: { trackedQuests: "[]" } };
  const r = IO.readImport(JSON.stringify(file), DEFS, { partySize: 4, "feature-hexTravel": true, trackedQuests: "[\"q\"]" });
  assert.equal(r.ok, true); assert.equal(r.version, "1.19.0");
  assert.deepEqual(r.unknown, ["removedInFuture"]);
  assert.deepEqual(r.skipped, ["lootHistoryData"]);
  assert.deepEqual(r.invalid.map(i => i.key), ["coinSystem"]);
  const by = Object.fromEntries(r.rows.map(x => [x.key, x]));
  assert.equal(by.partySize.changed, true); assert.equal(by.partySize.to, 6); assert.equal(by.partySize.label, "Party size");
  assert.equal(by["feature-hexTravel"].changed, false);
  assert.equal(by.bossLayout.scope, "client"); assert.match(by.bossLayout.note, /filed under world/);
  assert.equal(by.trackedQuests.changed, true);
  // Whole-file failures.
  assert.match(IO.readImport("{nope", DEFS).error, /valid JSON/);
  assert.match(IO.readImport("[]", DEFS).error, /isn't a settings export/);
  assert.match(IO.readImport({ module: "other", format: 1 }, DEFS).error, /"other"/);
  assert.match(IO.readImport({ module: "wayfarers-toolkit", format: 9 }, DEFS).error, /format 9/);
  assert.match(IO.readImport({ module: "wayfarers-toolkit", format: 1, world: [1] }, DEFS).error, /"world"/);
  assert.equal(IO.readImport({ module: "wayfarers-toolkit", format: 1 }, DEFS).rows.length, 0, "an empty export is fine");
  assert.equal(IO.preview("x".repeat(100)).length, 60); assert.equal(IO.preview({ a: 1 }), "{\"a\":1}");
});

// ---------------------------------------------------------------- permission checks
const player = (name, o = {}) => ({ name, active: true, character: `${name}'s PC`, characterOwned: true, ownsAnyCharacter: true, can: { MACRO_SCRIPT: true }, ...o });
const facts = (o = {}) => ({
  on: id => !["travelPace"].includes(id), socket: true, itemPiles: true,
  settings: { playerFlights: true, paceRequests: true, trashItemPiles: true, junkSellButton: true },
  players: [player("Ann"), player("Bob")], party: { name: "The Party", playerLevel: 2 },
  macros: { "Flight Master": 2, "Quest Log": 2 }, quests: { visible: 2, unreadable: [] }, ...o
});
const by = (lines, f) => lines.filter(l => l.feature === f);

test("permissions: all good", () => {
  const lines = Perm.featureChecks(facts());
  assert.ok(lines.length >= 5);
  assert.ok(lines.every(l => l.level === "ok"), JSON.stringify(lines.filter(l => l.level !== "ok")));
  assert.deepEqual(Perm.summary(lines), { ok: lines.length, warn: 0, bad: 0 });
});

test("permissions: failures and warnings with fix hints", () => {
  const lines = Perm.featureChecks(facts({
    socket: false,
    players: [player("Ann", { characterOwned: false }), player("Bob", { character: null, ownsAnyCharacter: false, can: { MACRO_SCRIPT: false } })],
    party: { name: "The Party", playerLevel: 0 }, macros: { "Flight Master": 0 }, quests: { visible: 1, unreadable: ["The Lost Ring"] }
  }));
  const lvl = f => by(lines, f).map(l => l.level);
  assert.deepEqual(lvl("socket"), ["bad"]);
  assert.deepEqual(lvl("characters"), ["bad", "warn"]);
  assert.match(by(lines, "characters")[0].text, /Ann \(Ann's PC\)/);
  assert.deepEqual(lvl("macros"), ["warn", "warn"]);
  assert.match(by(lines, "macros")[0].text, /Bob/);
  assert.deepEqual(lvl("party"), ["warn"]); assert.deepEqual(lvl("quests"), ["warn"]);
  for (const l of lines.filter(l => l.level !== "ok")) assert.ok(l.hint.length > 10, `${l.feature} has a fix hint`);
});

test("permissions: only what the tools turned on need", () => {
  const none = Perm.featureChecks(facts({ on: () => false }));
  assert.deepEqual(none, []);
  const noPlayers = Perm.featureChecks(facts({ players: [] }));
  assert.ok(noPlayers.some(l => l.feature === "players" && l.level === "warn"));
  const flightsGmOnly = Perm.featureChecks(facts({ on: id => id === "flightMaster", settings: { playerFlights: false } }));
  assert.deepEqual(flightsGmOnly, [], "GM-only flights need nothing from players");
  const pace = Perm.featureChecks(facts({ on: id => ["hexTravel", "travelPace"].includes(id) }));
  assert.ok(pace.some(l => l.feature === "socket" && /pace/.test(l.text)));
  assert.ok(pace.some(l => l.feature === "macros" && /Travel Pace/.test(l.text)));
  const noPiles = Perm.featureChecks(facts({ itemPiles: false, on: id => id === "vendorTrash" }));
  assert.ok(noPiles.some(l => l.feature === "itemPiles" && l.level === "warn"));
});

// ---------------------------------------------------------------- flight map and discoveries
const net = () => Flight.normalizeNetwork({
  points: [{ id: "a", name: "A", unlocked: true, pos: { x: 0.2, y: 2 } }, { id: "b", name: "B", unlocked: true }, { id: "c", name: "C", unlocked: false }],
  routes: [{ id: "r1", from: "a", to: "b", fareCp: 5, hours: 2 }, { id: "r2", from: "b", to: "c", fareCp: 7, hours: 3, twoWay: false }]
});

test("flight map: positions, layout and what each viewer sees", () => {
  const n = net();
  assert.deepEqual(n.points[0].pos, { x: 0.2, y: 1 }, "positions are clamped");
  assert.equal("pos" in n.points[1], false);
  assert.equal(Flight.cleanPos({ x: "a", y: 1 }), null);
  assert.deepEqual(Flight.autoLayout(1), [{ x: 0.5, y: 0.5 }]);
  assert.deepEqual(Flight.autoLayout(4)[0], { x: 0.5, y: 0.1 });
  const gm = Flight.mapModel(n, { isGM: true, here: "a" });
  assert.deepEqual(gm.nodes.map(x => [x.id, x.unlocked, x.here]), [["a", true, true], ["b", true, false], ["c", false, false]]);
  assert.deepEqual(gm.edges.map(e => [e.id, e.open, e.fareCp]), [["r1", true, 5], ["r2", false, 7]]);
  const hidden = Flight.mapModel(n, { isGM: false });
  assert.deepEqual(hidden.nodes.map(x => x.id), ["a", "b"]); assert.deepEqual(hidden.edges.map(e => e.id), ["r1"]);
  const grey = Flight.mapModel(n, { isGM: false, lockedForPlayers: "grey" });
  assert.equal(grey.nodes[2].name, "Unknown");
  assert.deepEqual(grey.edges.find(e => e.id === "r2"), { id: "r2", from: "b", to: "c", twoWay: false, free: false, hours: null, fareCp: null, open: false }, "players don't see a locked route's fare");
  assert.deepEqual(grey.nodes[1], hidden.nodes[1], "positions don't move when locked points show");
  const moved = Flight.withPositions(n, { b: { x: 0.5, y: 0.5 }, zz: { x: 1, y: 1 } });
  assert.deepEqual(moved.points[1].pos, { x: 0.5, y: 0.5 });
  assert.deepEqual(Flight.normalizeNetwork(structuredClone(moved)), moved, "positions survive normalising");
});

test("flight discoveries: newly unlocked points only", () => {
  const before = net(); const after = structuredClone(before);
  after.points[2].unlocked = true; after.points.push({ id: "d", name: "D", unlocked: true });
  assert.deepEqual(Flight.newlyUnlocked(before, after), [{ id: "c", name: "C" }, { id: "d", name: "D" }]);
  assert.deepEqual(Flight.newlyUnlocked(after, after), []);
  assert.deepEqual(Flight.newlyUnlocked(Flight.emptyNetwork(), after), [], "a first save or an import announces nothing");
});

// ---------------------------------------------------------------- registry, panel, macros, notes
test("1.20 tools are features with cards, settings rows and gated macros", () => {
  for (const id of ["flightMap", "travelPace", "partyGold", "settingsIO", "permissionChecks"]) {
    assert.ok(FEATURES.some(f => f.id === id && f.key === `feature-${id}`), id);
    assert.ok(FEATURE_IDS.includes(id), id); assert.ok(FEATURE_CARDS.some(c => c.id === id), id);
  }
  const keys = TABS.flatMap(tabKeys);
  for (const k of ["paceRequests", "flightDiscovered", "flightMapLocked", "flightAdvanceTime", "goldAct", "goldCurve", "goldIncludeGear"]) { assert.ok(keys.includes(k), k); assert.ok(LABELS[k]?.[0], k); }
  assert.equal(presetSettings("classic")["feature-travelPace"], false);
  const map = MACROS.find(m => m.fn === "flightMap"); const pace = MACROS.find(m => m.fn === "travelPace");
  assert.equal(macroOn(map, id => id === "flightMap"), false, "needs Flight Master too");
  assert.equal(macroOn(map, () => true), true);
  assert.equal(macroOn(pace, id => id === "hexTravel"), false);
  assert.equal(macroOn({}, () => false), true, "no feature = always");
  assert.equal(NOTES[0].version, "1.20.0");
});

test("public repo: no publisher names in the 1.20 user-facing text", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const f of ["travel-pace", "gold-model", "gold", "settings-io-model", "settings-io", "permissions", "flight-map"]) {
    const src = await readFile(new URL(`../scripts/${f}.mjs`, import.meta.url), "utf8");
    assert.doesNotMatch(src, /warcraft|blizzard|\bwow\b|azeroth/i, f);
  }
});
