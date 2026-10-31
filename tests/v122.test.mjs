import { test } from "node:test";
import assert from "node:assert/strict";
import "./_globals.mjs";
const ZT = await import("../scripts/zone-titles-model.mjs");
const OM = await import("../scripts/online-model.mjs");
const Inn = await import("../scripts/inn-model.mjs");
const Perm = await import("../scripts/permissions.mjs");
const { MACROS, macroOn } = await import("../scripts/macros.mjs");
const { FEATURES } = await import("../scripts/features.mjs");
const { TABS, LABELS, FEATURE_CARDS, FEATURE_IDS, PRESETS } = await import("../scripts/panel-model.mjs");
const { NOTES } = await import("../scripts/update-notes.mjs");
const Flight = await import("../scripts/flight.mjs");

const ID = "wayfarers-toolkit";
const scene = (name, zoneTitle) => ({ name, flags: zoneTitle ? { [ID]: { zoneTitle } } : {} });

// ---------------------------------------------------------------- zone title cards
test("zone titles: title config resolution", () => {
  assert.deepEqual(ZT.titleConfig(scene("Meadow Crossing")), { enabled: true, title: "Meadow Crossing", subtitle: "", sound: "" });
  assert.equal(ZT.titleConfig(scene("A"), { all: false }).enabled, false, "world default off, scene not set");
  assert.equal(ZT.titleConfig(scene("A", { show: true }), { all: false }).enabled, true, "ticked scene");
  assert.equal(ZT.titleConfig(scene("A", { show: false })).enabled, false, "switched off scene");
  const c = ZT.titleConfig(scene("Map 3", { show: true, title: "  The Hollow Vale ", subtitle: "Levels 1–3", sound: "" }), { defaultSound: "sounds/chime.ogg" });
  assert.deepEqual(c, { enabled: true, title: "The Hollow Vale", subtitle: "Levels 1–3", sound: "sounds/chime.ogg" });
  assert.equal(ZT.titleConfig(scene("A", { sound: "own.ogg" }), { defaultSound: "d.ogg" }).sound, "own.ogg", "scene sound wins");
  assert.equal(ZT.titleConfig(scene("A", { title: "   " })).title, "A", "blank title falls back to the name");
  assert.equal(ZT.titleConfig({ name: "", flags: {} }).enabled, false, "no title, no card");
  assert.equal(ZT.titleConfig(null).enabled, false);
});

test("zone titles: when to show", () => {
  const s = o => ZT.shouldShow(o);
  assert.equal(s({ reason: "activate" }), true);
  assert.equal(s({ reason: "load" }), false, "never at world load by default");
  assert.equal(s({ reason: "load", onLoad: true }), true);
  assert.equal(s({ reason: "view", trigger: "activate" }), false);
  assert.equal(s({ reason: "view", trigger: "view" }), true);
  assert.equal(s({ reason: "activate", audience: "players", isGM: true }), false);
  assert.equal(s({ reason: "activate", audience: "everyone", isGM: true }), true);
  assert.equal(s({ reason: "other" }), false);
  assert.deepEqual(ZT.timeline(4, true), { fadeIn: 0, hold: 4000, fadeOut: 0 }, "reduced motion: instant");
  assert.equal(ZT.timeline(99).hold, 15000); assert.equal(ZT.timeline("x").hold, 4000); assert.ok(ZT.timeline(4).fadeIn > 0);
});

// ---------------------------------------------------------------- who's online
const user = (id, name, o = {}) => ({ id, name, active: false, isGM: false, character: null, color: "#f00", ...o });
const users = [
  user("g", "Gamemaster", { isGM: true, active: true }),
  user("a", "Ann", { active: true, character: { name: "Thalia", img: "t.webp" } }),
  user("b", "Bob", { character: { name: "Brom", img: "b.webp" } }),
  user("c", "Cy", { active: true })
];

test("who's online: who counts and all present", () => {
  const r = OM.roster(users, { count: "characters" });
  assert.equal(r.expected, 2); assert.equal(r.present, 1); assert.equal(r.all, false); assert.deepEqual(r.missing, ["Bob"]);
  assert.equal(r.entries[0].label, "Thalia", "character name shown"); assert.equal(r.entries[0].active, true);
  assert.ok(r.entries.some(e => e.id === "g" && !e.counts), "online GM shown, not counted");
  assert.ok(r.entries.some(e => e.id === "c" && !e.counts && e.label === "Cy"), "online player without a character shown by user name");
  const p = OM.roster(users, { count: "players" });
  assert.equal(p.expected, 3); assert.equal(p.present, 2);
  const allIn = OM.roster(users.map(u => ({ ...u, active: true })), { count: "characters" });
  assert.equal(allIn.all, true);
  const l = OM.roster(users, { count: "list", list: "ann, cy; Nobody" });
  assert.equal(l.expected, 2); assert.equal(l.all, true); assert.deepEqual(l.unknown, ["nobody"]);
  assert.equal(OM.roster([user("g", "GM", { isGM: true, active: true })]).all, false, "nobody counts: never everyone's here");
  assert.deepEqual(OM.listNames(" A ,b;\nA"), ["a", "b"]);
});

test("who's online: change detection and hook payload", () => {
  const a = OM.roster(users, { count: "characters" });
  const b = OM.roster(users.map(u => ({ ...u, active: true })), { count: "characters" });
  assert.deepEqual(OM.changes(null, a), { countChanged: true, becameAll: false, leftAll: false });
  assert.deepEqual(OM.changes(a, b), { countChanged: true, becameAll: true, leftAll: false });
  assert.deepEqual(OM.changes(b, b), { countChanged: false, becameAll: false, leftAll: false });
  assert.deepEqual(OM.changes(b, a), { countChanged: true, becameAll: false, leftAll: true });
  const h = OM.hookPayload(b);
  assert.equal(h.online, 2); assert.equal(h.expected, 2); assert.equal(h.all, true); assert.ok(h.users.every(u => "label" in u && "counts" in u));
});

// ---------------------------------------------------------------- rested at the inn
const STD = [["pp", 1000], ["gp", 100], ["ep", 50], ["sp", 10], ["cp", 1]];
const THREE = [["gp", 10000], ["sp", 100], ["cp", 1]];
const coinKey = s => ({ g: "gp", s: "sp", c: "cp", gp: "gp", sp: "sp", cp: "cp" })[s.toLowerCase()] ?? null;
const parseWith = (coins, unit = "gp") => t => Flight.parseCoins(t, Object.fromEntries(coins), unit, coinKey);

test("inn: scene flag, price and room cost", () => {
  const sc = (inn, name = "Lantern Rest") => ({ name, flags: { [ID]: { inn } } });
  assert.deepEqual(Inn.innOf(sc({ on: true, name: "The Sleepy Boar", price: "8s" })), { on: true, name: "The Sleepy Boar", priceText: "8s" });
  assert.deepEqual(Inn.innOf(sc({ on: true })), { on: true, name: "Lantern Rest", priceText: "5s" }, "defaults: scene name, 5 silver");
  assert.equal(Inn.innOf(sc({ on: "yes" })).on, false);
  assert.equal(Inn.innOf(sc({ on: true }), { defaultPrice: "1g" }).priceText, "1g");
  assert.deepEqual(Inn.readPrice("5s", parseWith(STD)), { ok: true, amount: 50 });
  assert.deepEqual(Inn.readPrice("5s", parseWith(THREE)), { ok: true, amount: 500 }, "three-coin: 100 copper to the silver");
  assert.deepEqual(Inn.readPrice("2", parseWith(STD, "sp")), { ok: true, amount: 20 }, "plain number in the fare unit");
  assert.equal(Inn.readPrice("free", parseWith(STD)).ok, false); assert.equal(Inn.readPrice("", parseWith(STD)).ok, false);
  assert.equal(Inn.roomCost(50, 4), 200); assert.equal(Inn.roomCost(50, 0), 0); assert.equal(Inn.roomCost(-5, 3), 0);
});

test("inn: coin deduction", () => {
  assert.deepEqual(Inn.spend({ pp: 0, gp: 1, ep: 0, sp: 0, cp: 0 }, 50, STD), { pp: 0, gp: 0, ep: 0, sp: 5, cp: 0 }, "breaks a gold piece, change in silver");
  assert.deepEqual(Inn.spend({ gp: 2, sp: 3, cp: 5 }, 35, STD), { pp: 0, gp: 2, ep: 0, sp: 0, cp: 0 }, "smallest coins first");
  assert.equal(Inn.spend({ gp: 0, sp: 4 }, 50, STD), null, "not enough");
  const before = { gp: 1 }; Inn.spend(before, 50, STD); assert.deepEqual(before, { gp: 1 }, "input untouched");
  assert.deepEqual(Inn.spend({ gp: 1, sp: 0, cp: 0 }, 2000, THREE), { gp: 0, sp: 80, cp: 0 }, "three-coin change");
  const after = Inn.spend({ pp: 1, gp: 0, ep: 0, sp: 0, cp: 0 }, 50, STD);
  assert.equal(after.ep, 0, "no electrum as change"); assert.equal(Inn.total(after, STD), 950);
  assert.equal(Inn.total({ gp: 1, sp: 2, cp: 3 }, STD), 123);
});

test("inn: payment plans", () => {
  const fmt = n => `${n}c`;
  const chosen = [{ id: "a", name: "Thalia", currency: { gp: 1 } }, { id: "b", name: "Brom", currency: { sp: 2 } }];
  const party = { id: "p", name: "The Party", currency: { gp: 1 } };
  const ok = Inn.payPlan({ from: "party", price: 50, chosen, party, coins: STD, fmt });
  assert.equal(ok.ok, true); assert.equal(ok.total, 100); assert.deepEqual(ok.payers, [{ id: "p", currency: { gp: 0, sp: 0, cp: 0, pp: 0, ep: 0 } }]);
  const poor = Inn.payPlan({ from: "party", price: 60, chosen, party, coins: STD, fmt });
  assert.equal(poor.ok, false); assert.match(poor.error, /has 100c; rooms cost 120c/); assert.deepEqual(poor.payers, []);
  const each = Inn.payPlan({ from: "each", price: 50, chosen, party, coins: STD, fmt });
  assert.equal(each.ok, false); assert.deepEqual(each.short, ["Brom"]); assert.deepEqual(each.payers, [], "nobody pays unless everyone can");
  const each2 = Inn.payPlan({ from: "each", price: 20, chosen, coins: STD, fmt });
  assert.equal(each2.ok, true); assert.equal(each2.payers.length, 2); assert.equal(each2.total, 40);
  assert.equal(Inn.payPlan({ from: "party", price: 50, chosen, party: null, coins: STD }).ok, false);
  assert.match(Inn.payPlan({ price: 50, chosen: [], coins: STD }).error, /No characters/);
  assert.match(Inn.payPlan({ price: 0, chosen, party, coins: STD }).error, /no room price/);
});

test("inn: rested benefit selection and clearing", () => {
  assert.equal(Inn.restOutcome({ rested: null, onInn: true }), "none");
  assert.equal(Inn.restOutcome({ rested: {}, onInn: true, lastsAnywhere: false }), "grant");
  assert.equal(Inn.restOutcome({ rested: {}, onInn: false, lastsAnywhere: true }), "grant");
  assert.equal(Inn.restOutcome({ rested: {}, onInn: false, lastsAnywhere: false }), "lose");
  assert.deepEqual(Inn.benefitPlan("inspiration", {}).actor, { "system.attributes.inspiration": true });
  assert.equal(Inn.benefitPlan("inspiration", { inspiration: true }).granted, false);
  assert.equal(Inn.benefitPlan("nonsense", {}).actor["system.attributes.inspiration"], true, "unknown benefit → inspiration");
  const hd = Inn.benefitPlan("hitDie", { classes: [{ id: "f", name: "Fighter", denomination: "d10", spent: 2 }, { id: "w", name: "Wizard", denomination: "d6", spent: 1 }, { id: "b", name: "Barbarian", denomination: "d12", spent: 0 }] });
  assert.deepEqual(hd.items, [{ _id: "f", "system.hd.spent": 1 }], "largest spent die");
  assert.equal(Inn.benefitPlan("hitDie", { classes: [{ id: "f", denomination: "d10", spent: 0 }] }).granted, false);
  assert.deepEqual(Inn.benefitPlan("tempHp", { level: 5, temp: 0 }).actor, { "system.attributes.hp.temp": 5 });
  assert.equal(Inn.benefitPlan("tempHp", { level: 5, temp: 7 }).granted, false, "temp HP don't stack");
  assert.equal(Inn.benefitPlan("tempHp", { level: 0 }).granted, false);
  assert.deepEqual(Inn.restedFlag({ sceneId: "s1", inn: " The Boar ", at: 3600 }), { scene: "s1", inn: "The Boar", at: 3600 });
  assert.equal(Inn.restedFlag({}).inn, "the inn");
});

test("inn: socket messages", () => {
  assert.deepEqual(Inn.readRoomRequest({ action: "roomRequest", sceneId: "s", userId: "u" }), { sceneId: "s", userId: "u" });
  assert.equal(Inn.readRoomRequest({ action: "roomRequest" }), null); assert.equal(Inn.readRoomRequest({ action: "x", sceneId: "s" }), null);
  assert.deepEqual(Inn.readRestReport({ action: "restedRest", actorId: "a", sceneId: 3 }), { actorId: "a", sceneId: null });
  assert.equal(Inn.readRestReport({ action: "restedRest" }), null);
});

// ---------------------------------------------------------------- wiring
test("1.22 features, macros, panel and notes", () => {
  for (const id of ["zoneTitles", "whosOnline", "restedInn"]) {
    assert.ok(FEATURES.some(f => f.id === id), id); assert.ok(FEATURE_IDS.includes(id), id); assert.ok(FEATURE_CARDS.some(c => c.id === id), id);
    assert.ok(PRESETS.everything.on.includes(id));
  }
  const rent = MACROS.find(m => m.fn === "rentRooms"); const who = MACROS.find(m => m.fn === "whosOnline");
  assert.ok(rent && who);
  assert.equal(macroOn(rent, id => id !== "restedInn"), false, "Rent Rooms skipped when the inn is off");
  assert.equal(macroOn(who, () => true), true);
  const places = TABS.find(t => t.id === "places");
  assert.ok(places.basic.length <= 5);
  for (const [k] of [...places.basic, ...places.advanced]) assert.ok(LABELS[k]?.[0], k);
  assert.equal(NOTES[0].version, "1.22.0");
  assert.deepEqual(NOTES[0].changes.filter(c => c.feature).map(c => c.feature), ["zoneTitles", "whosOnline", "restedInn", "vendorTrash"]);
});

test("permission checks know the 1.22 tools", () => {
  const facts = { on: id => id === "restedInn" || id === "whosOnline", socket: true, settings: { innRequests: true }, players: [{ name: "Ann", character: "Thalia", characterOwned: true, ownsAnyCharacter: true, can: { MACRO_SCRIPT: true } }], macros: {} };
  const lines = Perm.featureChecks(facts);
  assert.ok(lines.some(l => l.feature === "socket" && /room requests/.test(l.text)));
  assert.ok(lines.some(l => l.feature === "macros" && /Rent Rooms/.test(l.text) && /Who's Online/.test(l.text)));
  assert.ok(lines.some(l => l.feature === "characters" && /Rested/.test(l.text)));
});

test("no publisher names in 1.22 strings", () => {
  const all = JSON.stringify([ZT, OM, Inn, NOTES[0], FEATURES.slice(-3), FEATURE_CARDS, LABELS].map(x => typeof x === "object" ? Object.entries(x).map(([k, v]) => [k, typeof v === "function" ? String(v) : v]) : x));
  assert.doesNotMatch(all, /warcraft|blizzard|azeroth|\bwow\b/i);
});
