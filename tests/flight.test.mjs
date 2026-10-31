import { test } from "node:test";
import assert from "node:assert/strict";
import "./_globals.mjs";
const Flight = await import("../scripts/flight.mjs");

let n = 0; const ids = () => `x${++n}`;
const fmt = x => `${x}c`;
// Standard dnd5e coins in copper, most valuable first, and a coin-name reader like main.mjs's.
const COINS = [["pp", 1000], ["gp", 100], ["ep", 50], ["sp", 10], ["cp", 1]];
const VAL = Object.fromEntries(COINS); const ABBR = { pp: "pp", gp: "gp", ep: "ep", sp: "sp", cp: "cp" };
const ALIAS = { g: "gp", gold: "gp", s: "sp", silver: "sp", c: "cp", copper: "cp", p: "pp", platinum: "pp" };
const keyOf = s => { s = s.toLowerCase(); return VAL[s] ? s : ALIAS[s] ?? ALIAS[s.replace(/s$/, "")] ?? null; };
const parse = (t, unit = "gp") => Flight.parseCoins(t, VAL, unit, keyOf);

const net = () => Flight.normalizeNetwork({
  points: [
    { id: "a", name: "Harbor Town", sceneUuid: "Scene.h", unlocked: true },
    { id: "b", name: "Hill Fort", sceneUuid: null, unlocked: true },
    { id: "c", name: "River Camp", sceneUuid: "Scene.gone", unlocked: true },
    { id: "d", name: "Far Keep", unlocked: false }
  ],
  routes: [
    { id: "r1", from: "a", to: "b", fareCp: 100, hours: 1, twoWay: true },
    { id: "r2", from: "b", to: "c", fareCp: 50, hours: 2, twoWay: false },
    { id: "r3", from: "a", to: "d", fareCp: 10, hours: 1 }
  ]
}, ids);
const exists = u => u === "Scene.h";

test("flight network: normalise fills defaults and never throws", () => {
  assert.deepEqual(Flight.normalizeNetwork(null), { version: 1, points: [], routes: [] });
  assert.deepEqual(Flight.normalizeNetwork("junk"), { version: 1, points: [], routes: [] });
  const x = Flight.normalizeNetwork({ points: [{ name: " Harbor Town ", unlocked: "yes" }, { id: "p", name: "B" }, { id: "p", name: "C" }, null],
    routes: [{ from: "harbor town", to: "B", fareCp: "12.6", hours: -3 }, { from: "B", to: "Nowhere", twoWay: false, free: true }] }, ids);
  assert.equal(x.points.length, 3);
  assert.equal(x.points[0].name, "Harbor Town"); assert.equal(x.points[0].unlocked, true); assert.equal(x.points[0].sceneUuid, null);
  assert.notEqual(x.points[1].id, x.points[2].id, "a repeated id gets a new one");
  assert.equal(x.routes[0].from, x.points[0].id, "routes may name points by name");
  assert.equal(x.routes[0].fareCp, 13); assert.equal(x.routes[0].hours, 0); assert.equal(x.routes[0].twoWay, true); assert.equal(x.routes[0].free, false);
  assert.equal(x.routes[1].to, "Nowhere"); assert.equal(x.routes[1].twoWay, false); assert.equal(x.routes[1].free, true);
  // A normalised network normalises to itself.
  assert.deepEqual(Flight.normalizeNetwork(structuredClone(x)), x);
});

test("flight network: validation (names, self routes, unknown points)", () => {
  const x = Flight.normalizeNetwork({ points: [{ id: "a", name: "A" }, { id: "b", name: "a " }, { id: "c", name: "" }],
    routes: [{ from: "a", to: "a" }, { from: "a", to: "zz" }, { from: "a", to: "c" }, { from: "c", to: "a" }] }, ids);
  const t = Flight.validateNetwork(x).map(p => `${p.level} ${Flight.problemText(p)}`);
  assert.ok(t.some(s => s.startsWith("error Flight point 2") && s.includes("already flight point 1")), t.join("\n"));
  assert.ok(t.some(s => s.startsWith("error Flight point 3") && s.includes("needs a name")));
  assert.ok(t.some(s => s.startsWith("error Route 1") && s.includes("can't go to the point it starts from")));
  assert.ok(t.some(s => s.startsWith("error Route 2") && s.includes(`"zz" isn't a flight point`)));
  assert.ok(t.some(s => s.startsWith("warn Route 4") && s.includes("same flight as route 3")), "a two-way duplicate is a warning");
  assert.deepEqual(Flight.validateNetwork(net()), []);
});

test("fares: coin text parses and round-trips through the formatter", () => {
  assert.equal(parse("2s"), 20); assert.equal(parse("1g 20s"), 300); assert.equal(parse("75c"), 75); assert.equal(parse("2 gp"), 200);
  assert.equal(parse("2"), 200); assert.equal(parse("2", "sp"), 20); assert.equal(parse("1.5", "sp"), 15); assert.equal(parse(""), 0);
  for (const cp of [0, 1, 75, 300, 1234, 99999]) assert.equal(parse(Flight.formatCoins(cp, COINS, ABBR, true)), cp, `round trip ${cp}`);
  assert.equal(Flight.formatCoins(320, COINS, ABBR, true), "3gp 2sp");
  assert.equal(Flight.formatCoins(0, COINS, ABBR), "0 cp");
  assert.ok(Flight.fareOk("1g 20s") && Flight.fareOk("75 c") && Flight.fareOk("2") && Flight.fareOk("") && !Flight.fareOk("lots"));
});

test("flight checks: route, locked points, affordability with shortfall", () => {
  const x = net();
  assert.equal(Flight.route(x, "a", "c").f, 150, "a → b → c");
  assert.equal(Flight.route(x, "c", "b"), null, "one-way route only flies from its start");
  assert.equal(Flight.route(x, "b", "a").f, 100, "two-way route flies back");
  const c = Flight.check({ net: x, from: "Harbor Town", to: "hill fort", pax: 2, purse: 500, fmt });
  assert.equal(c.ok, true); assert.equal(c.q.total, 200); assert.deepEqual(c.r.names, ["Harbor Town", "Hill Fort"]);
  assert.equal(Flight.check({ net: x, from: "a", to: "b", pax: 4, purse: 300, fmt }).error, "The party can't afford this: needs 400c, has 300c (short 100c).");
  assert.match(Flight.check({ net: x, from: "a", to: "d", fmt }).error, /Far Keep isn't unlocked/);
  assert.match(Flight.check({ net: x, from: "a", to: "Nowhere", fmt }).error, /"Nowhere" isn't a flight point/);
  assert.equal(Flight.check({ net: x, from: "a", to: "a", fmt }).ok, false);
  assert.match(Flight.check({ net: x, from: "c", to: "b", fmt }).error, /No route from River Camp to Hill Fort/);
  const broken = Flight.normalizeNetwork({ points: [{ id: "a", name: "A", unlocked: true }, { id: "b", name: "B", unlocked: true }], routes: [{ from: "a", to: "q", fareCp: 1, hours: 1 }] }, ids);
  assert.match(Flight.check({ net: broken, from: "a", to: "b", fmt }).error, /no longer exists \(q\)/);
});

test("no-scene flights still fly: charged, no scene change, GM told", () => {
  const x = net();
  const none = Flight.decide({ net: x, from: "a", to: "b", pax: 1, purse: 1000, fmt, sceneExists: exists });
  assert.equal(none.ok, true); assert.equal(none.charge, 100); assert.equal(none.changeScene, false); assert.equal(none.tellNoScene, true); assert.equal(none.land.reason, "none");
  const gone = Flight.decide({ net: x, from: "a", to: "c", pax: 1, purse: 1000, fmt, sceneExists: exists });
  assert.equal(gone.ok, true); assert.equal(gone.land.reason, "missing"); assert.equal(gone.changeScene, false); assert.equal(gone.charge, 150);
  const withScene = Flight.decide({ net: x, from: "b", to: "a", pax: 1, purse: 1000, fmt, sceneExists: exists });
  assert.equal(withScene.changeScene, true); assert.equal(withScene.tellNoScene, false); assert.equal(withScene.land.sceneUuid, "Scene.h");
  assert.equal(Flight.decide({ net: x, from: "b", to: "a", pax: 1, purse: 1000, fmt, wantScene: false, sceneExists: exists }).changeScene, false);
  assert.deepEqual(Flight.landing({ sceneUuid: null }), { sceneUuid: null, change: false, reason: "none" });
});

test("free flights: GM pays nothing; a player's free:true is still charged", () => {
  const x = net(); const purse = 50; // less than the 100c fare
  const gm = Flight.decide({ net: x, from: "a", to: "b", pax: 3, purse, fmt, free: true });
  assert.equal(gm.ok, true, "a free flight skips the purse check"); assert.equal(gm.free, true); assert.equal(gm.charge, 0);
  const player = Flight.decide({ net: x, from: "a", to: "b", pax: 3, purse, fmt, free: true, byPlayer: true });
  assert.equal(player.ok, false); assert.match(player.error, /can't afford/);
  const rich = Flight.decide({ net: x, from: "a", to: "b", pax: 3, purse: 1000, fmt, free: true, byPlayer: true });
  assert.equal(rich.free, false); assert.equal(rich.charge, 300);
  assert.deepEqual(Flight.socketBooking({ from: "a", to: "b", pax: 99, free: true, scene: false }), { from: "a", to: "b", pax: 20, free: false, scene: true });
  // A route marked Free costs everyone nothing, players included.
  const y = net(); y.routes[0].free = true;
  const p2 = Flight.decide({ net: y, from: "a", to: "b", pax: 3, purse: 0, fmt, byPlayer: true });
  assert.equal(p2.ok, true); assert.equal(p2.charge, 0);
  // No party actor: nothing is charged.
  assert.equal(Flight.decide({ net: x, from: "a", to: "b", pax: 2, purse: null, fmt }).charge, 0);
});

test("legacy import: scene names to uuids, missing scenes, two-way routes, fares as before", () => {
  const scenes = [{ name: "Harbor Town", uuid: "Scene.h" }, { name: "Twin", uuid: "Scene.t1" }, { name: "Twin", uuid: "Scene.t2" }];
  const res = Flight.importLegacy({
    pointRows: [["Harbor Town", "Harbor Town", "yes"], ["Hill Fort", "Hill Fort Map", "no"], ["Twin Peaks", "Twin", "y"], ["Plain", "", "No"], ["", "", ""], ["Harbor Town", "", "yes"]],
    routeRows: [["Harbor Town", "Hill Fort", "1g 20s", "2"], ["Hill Fort", "Plain", "2", "1.5"], ["Plain", "Nowhere", "1", "1"], ["Plain", "Plain", "1", "1"], ["Twin Peaks", "Plain", "lots", "x"]],
    scenes, parse: f => parse(f), idFn: ids
  });
  const { points, routes } = res.network;
  assert.deepEqual(points.map(p => [p.name, p.sceneUuid, p.unlocked]), [["Harbor Town", "Scene.h", true], ["Hill Fort", null, false], ["Twin Peaks", null, true], ["Plain", null, false]]);
  assert.ok(res.report.some(r => r.includes('no scene named "Hill Fort Map"')));
  assert.ok(res.report.some(r => r.includes('2 scenes are named "Twin"')));
  assert.ok(res.report.some(r => r.includes("listed twice")));
  assert.ok(res.report.some(r => r.includes('"Nowhere" isn\'t in the Flight Points table')));
  assert.ok(res.report.some(r => r.includes("goes nowhere")));
  assert.ok(res.report.some(r => r.includes('fare "lots"')));
  assert.equal(routes.length, 3);
  assert.ok(routes.every(r => r.twoWay), "the old reader flew every route both ways");
  assert.equal(routes[0].fareCp, 300); assert.equal(routes[1].fareCp, 200); assert.equal(routes[1].hours, 1.5); assert.equal(routes[2].hours, 0);
  assert.deepEqual(res.counts, { points: 4, routes: 3, noScene: 3 });
  // Direction: an old row "Harbor Town, Hill Fort" can be flown back.
  const n2 = structuredClone(res.network); n2.points.forEach(p => { p.unlocked = true; });
  assert.ok(Flight.route(n2, routes[0].to, routes[0].from));
  assert.deepEqual(Flight.validateNetwork(res.network).filter(p => p.level === "error"), []);
  assert.equal(Flight.legacyHasRows([["", ""]]), false); assert.equal(Flight.legacyHasRows([["A"]]), true);
});

test("health facts: no scene, deleted scene, routes into locked points, unknown points", () => {
  const x = net(); x.routes.push({ id: "r9", from: "a", to: "ghost", fareCp: 0, hours: 0, twoWay: true, free: false });
  const f = Flight.networkFacts(x, exists);
  assert.deepEqual(f.noScene, ["Hill Fort", "Far Keep"]);
  assert.deepEqual(f.missingScene, ["River Camp"]);
  assert.deepEqual(f.toLocked, ["Harbor Town ↔ Far Keep"]);
  assert.deepEqual(f.unknown, ["Harbor Town → ghost"]);
});
