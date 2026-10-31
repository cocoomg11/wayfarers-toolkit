import { test } from "node:test";
import assert from "node:assert/strict";
import "./_globals.mjs";
const { pickActiveGM } = await import("../scripts/gm.mjs");
const Flight = await import("../scripts/flight.mjs");
const { resolveBoss, computeLayout, findSnap, detach, prune, defaultTop, TOP } = await import("../scripts/bosses.mjs");
const { rankChoices, gmOnline, winnerRecipients } = await import("../scripts/loot.mjs");
const { mergeParts } = await import("../scripts/summary.mjs");
const { TABS, tabKeys, condOn } = await import("../scripts/panel-model.mjs");
const { MACROS } = await import("../scripts/macros.mjs");

const u = (id, isGM, active) => ({ id, isGM, active });
test("active GM selection", () => {
  assert.equal(pickActiveGM([u("b", true, true), u("a", true, true)], u("b", true, true)).id, "b");
  assert.equal(pickActiveGM([u("z", true, true), u("c", true, true), u("a", true, false), u("b", false, true)]).id, "c");
  assert.equal(pickActiveGM([u("x", true, true)], u("a", true, false)).id, "x");
  assert.equal(pickActiveGM([u("a", true, false), u("b", false, true)]), null);
  assert.equal(gmOnline([u("a", true, false), u("b", false, true)]), false);
  assert.equal(gmOnline([u("a", true, true)]), true);
});

test("boss frames: crown and boss-loot rule", () => {
  assert.equal(resolveBoss({ crown: true }), true);
  assert.equal(resolveBoss({ hasBossLoot: true, auto: true }), true);
  assert.equal(resolveBoss({ hasBossLoot: true, auto: false }), false);
  assert.equal(resolveBoss({ crown: false, hasBossLoot: true, auto: true }), false);
});

test("fares and affordability", () => {
  assert.deepEqual(Flight.quote(150, 4, 1000), { total: 600, canPay: true, short: 0, have: 1000, charge: true });
  const q = Flight.quote(150, 4, 500); assert.equal(q.canPay, false); assert.equal(q.short, 100);
  assert.equal(Flight.quote(100, 2, 200).canPay, true);
  assert.deepEqual(Flight.quote(100, 3, null), { total: 300, canPay: true, short: 0, charge: false });
  assert.equal(Flight.clampPax(0), 1); assert.equal(Flight.clampPax(99), 20); assert.equal(Flight.clampPax("3.7"), 3);
  const pts = [{ n: "A", sc: "Town", u: true }, { n: "B", sc: "", u: true }, { n: "C", sc: "Gone", u: true, sm: true }, { n: "D", u: false }];
  const routes = [{ a: "A", b: "B", f: 100, h: 1 }, { a: "B", b: "C", f: 50, h: 2 }, { a: "A", b: "Z", f: 10, h: 1 }];
  const fmt = x => `${x}c`;
  const c = Flight.check({ pts, routes, from: "A", to: "B", pax: 2, purse: 500, fmt }); assert.equal(c.ok, true); assert.equal(c.q.total, 200);
  assert.deepEqual(Flight.route("A", "C", ["A", "B", "C"], routes), { f: 150, h: 3, path: ["A", "B", "C"] });
  assert.match(Flight.check({ pts, routes, from: "A", to: "C", pax: 1, purse: 500, fmt }).error, /scene "Gone" doesn't exist/);
  assert.equal(Flight.check({ pts, routes, from: "A", to: "B", pax: 4, purse: 300, fmt }).error, "The party can't afford this: needs 400c, has 300c (short 100c).");
  assert.match(Flight.check({ pts, routes, from: "A", to: "D", fmt }).error, /isn't unlocked/);
  assert.match(Flight.check({ pts, routes, from: "A", to: "Z", fmt }).error, /isn't in the Flight Points table/);
  assert.deepEqual(Flight.unknownRoutes(pts, routes), [{ a: "A", b: "Z", unknown: ["Z"] }]);
  assert.equal(Flight.check({ pts, routes, from: "A", to: "A", fmt }).ok, false);
  const c2 = Flight.check({ pts: [{ n: "A", u: true }, { n: "B", u: true }], routes: [{ a: "A", b: "Q", f: 1, h: 1 }], from: "A", to: "B", fmt });
  assert.match(c2.error, /names an unknown flight point \(Q\)/);
});

test("encounter zones setting errors name the position", () => {
  assert.deepEqual(Flight.parseZones('{"Forest": "Encounters · Forest"}'), { zones: { Forest: "Encounters · Forest" }, error: null });
  assert.deepEqual(Flight.parseZones(""), { zones: {}, error: null });
  assert.match(Flight.parseZones('{"a": "b",}').error, /^invalid JSON/);
  assert.match(Flight.parseZones("[1]").error, /must be a JSON object/);
  assert.match(Flight.parseZones('{"a": 3}').error, /value for "a"/);
  assert.deepEqual(Flight.unknownZoneTables({ Forest: "T1", Hills: "T2" }, ["T1"]), [{ zone: "Hills", table: "T2" }]);
});

test("flight routes: malformed rows named by row and column", () => {
  const p = Flight.flightRowProblems([["A", "", "yes"], ["", "", "no"], ["B", "", "maybe"], ["A", "", "yes"], ["C"]], [["A", "B", "2s", "1"], ["A", "", "x2", "two"], ["B"]]);
  const t = p.map(Flight.rowProblemText);
  assert.ok(t.includes("Flight Points row 2, Flight point: is empty"));
  assert.ok(t.some(x => x.startsWith("Flight Points row 3, Unlocked")));
  assert.ok(t.some(x => x.startsWith("Flight Points row 4, Flight point") && x.includes("twice")));
  assert.ok(t.some(x => x.startsWith("Flight Points row 5") && x.includes("needs 3")));
  assert.ok(t.includes("Routes row 2, To: is empty"));
  assert.ok(t.some(x => x.startsWith("Routes row 2, Fare")));
  assert.ok(t.some(x => x.startsWith("Routes row 2, Hours")));
  assert.ok(t.some(x => x.startsWith("Routes row 3") && x.includes("needs 4")));
  assert.ok(!t.some(x => x.includes("row 1,")), "good rows give nothing");
  assert.ok(Flight.fareOk("1g 20s") && Flight.fareOk("75 c") && Flight.fareOk("2") && !Flight.fareOk("lots"));
});

test("boss layout: stack, move, detach, snap, prune", () => {
  const VW = 1000, VH = 800, sz = { a: { w: 360, h: 60 }, b: { w: 360, h: 60 }, c: { w: 360, h: 60 } };
  let L = computeLayout(["a", "b", "c"], sz, {}, VW, VH);
  assert.deepEqual([L.pos.a.x, L.pos.a.y, L.pos.b.y, L.pos.c.y], [320, 12, 78, 144]);
  assert.equal(L.mainRoot, "a"); assert.deepEqual(L.groups.a, ["a", "b", "c"]);
  L = computeLayout(["a", "b"], sz, { main: { x: 0.1, y: 0.5 } }, VW, VH);
  assert.deepEqual([L.pos.a.x, L.pos.a.y, L.pos.b.x, L.pos.b.y], [100, 400, 100, 466]);
  let lay = detach({}, "b", computeLayout(["a", "b", "c"], sz, {}, VW, VH), 50, 300, VW, VH);
  L = computeLayout(["a", "b", "c"], sz, lay, VW, VH);
  assert.deepEqual([L.pos.b.x, L.pos.b.y, L.pos.c.y], [50, 300, 78]);
  const s = findSnap({ x: 690, y: 20, w: 360, h: 60 }, [{ id: "a", ...L.pos.a }]);
  assert.equal(s.side, "right"); assert.equal(s.x, 686); assert.equal(s.y, 12);
  assert.equal(findSnap({ x: 720, y: 20, w: 360, h: 60 }, [{ id: "a", ...L.pos.a }]), null);
  lay.frames.b = { to: "a", side: "right", x: 0.686, y: 0.015 };
  L = computeLayout(["a", "b", "c"], sz, lay, VW, VH);
  assert.ok(L.pos.b.x + 360 <= VW && L.pos.a.x === L.pos.b.x - 366);
  L = computeLayout(["a", "b"], sz, { frames: { a: { to: "b", side: "below" }, b: { to: "a", side: "below" } } }, VW, VH);
  assert.ok(L.pos.a && L.pos.b);
  const p = prune({ main: { x: 0, y: 0 }, frames: { a: { x: 0.1, y: 0.1 }, b: { to: "gone", side: "below", x: 0.3, y: 0.3 }, gone: { x: 0, y: 0 } } }, new Set(["a", "b"]));
  assert.deepEqual(p.frames, { a: { x: 0.1, y: 0.1 }, b: { x: 0.3, y: 0.3 } });
});

test("boss layout: default stack below a combat dock, moved stacks unaffected", () => {
  const sz = { a: { w: 360, h: 60 }, b: { w: 360, h: 60 } };
  assert.equal(defaultTop(null), TOP);
  assert.equal(defaultTop({ top: 0, bottom: 110, height: 110, width: 600 }, 800), 116);
  assert.equal(defaultTop({ top: 0, bottom: 0, height: 0, width: 0 }, 800), TOP, "hidden dock");
  assert.equal(defaultTop({ top: 600, bottom: 700, height: 100, width: 600 }, 800), TOP, "not along the top");
  let L = computeLayout(["a", "b"], sz, {}, 1000, 800, 6, 116);
  assert.deepEqual([L.pos.a.y, L.pos.b.y], [116, 182]);
  L = computeLayout(["a", "b"], sz, { main: { x: 0.1, y: 0.5 } }, 1000, 800, 6, 116);
  assert.equal(L.pos.a.y, 400);
});

test("loot rolls: Need beats Greed, next-best order for fallbacks", () => {
  const r = rankChoices({ u1: { choice: "greed", roll: 99 }, u2: { choice: "need", roll: 10 }, u3: { choice: "pass", roll: null }, u4: { choice: "need", roll: 50, rerolls: [5] }, u5: { choice: "greed", roll: 40 } });
  assert.deepEqual(r.map(x => x.uid), ["u2", "u4", "u1", "u5"]);
  assert.equal(r[1].roll, 5, "the last reroll counts");
  assert.deepEqual(rankChoices({ a: { choice: "pass" } }), []);
});

test("mass deaths: one merged summary", () => {
  const m = mergeParts([
    { kind: "trash", rows: ["<li>A</li>"], coin: 100, value: 20, flag: { piles: true, coin: 100, value: 20, dungeon: false } },
    { kind: "trash", rows: ["<li>B</li>"], coin: 50, value: 5, flag: { coin: 50, value: 5, dungeon: true, drops: [{ uuid: "x", value: 5 }] } },
    { kind: "boss", rows: ["<li>Boss</li>"], coin: 300, flag: { token: "Scene.s.Token.t", piles: true, drops: [], coin: 0 } }
  ]);
  assert.equal(m.trash.rows.length, 2); assert.equal(m.trash.coin, 150); assert.equal(m.trash.value, 25);
  assert.equal(m.trash.flag.coin, 50, "pile coin isn't handed out twice"); assert.equal(m.trash.flag.dungeon, true); assert.equal(m.trash.flag.drops.length, 1); assert.equal(m.trash.flag.piles, true);
  assert.equal(m.boss.coin, 300); assert.deepEqual(m.boss.flag.tokens, ["Scene.s.Token.t"]);
  assert.equal(mergeParts([]).trash, null);
});

test("control panel tabs list every setting once and follow the feature toggles", () => {
  const keys = TABS.flatMap(tabKeys);
  assert.equal(new Set(keys).size, keys.length, "each setting on one tab");
  // The pre-1.15 setting keys are all still shown (no data loss).
  for (const k of ["zones", "encounterDie", "offroadMult", "mountMult", "paceSlow", "paceNormal", "paceFast", "hiddenScenes", "playerFlights", "flightSound", "flightVolume", "fareUnit", "riderFeat", "trashItemPiles", "itemPilesCoins", "dungeonCoinMult", "dungeonDropBonus", "dungeonExtraRoll", "trashAutoRoll", "trashAutoLoot", "trashGmAddedLoot", "trashUnconscious", "trashPacks", "bossLootAuto", "bossLootExtraDraw", "bossHpDisplay", "bossAutoFromLoot", "lootRollSeconds", "trackerJournal", "partyActor", "questFolder", "questObjectiveChat", "questSoundAccept", "questSoundComplete", "questVolume", "partySize", "campaignName", "debugLog", "questTracker"]) assert.ok(keys.includes(k), k);
  const boss = TABS.find(t => t.id === "boss");
  const row = boss.basic.find(([k]) => k === "bossAutoFromLoot");
  assert.equal(condOn(row[1], id => id === "bossFrames"), false, "bossAutoFromLoot needs both features");
  assert.equal(condOn(row[1], () => true), true);
  assert.equal(condOn(null, () => false), true);
  for (const t of TABS.filter(t => t.basic)) assert.ok(t.basic.length >= 3 && t.basic.length <= 5, `${t.id} has 3–5 basics`);
});

test("macro list ids are stable 16-character ids", () => {
  for (const m of MACROS) assert.match(m.id, /^[A-Za-z0-9]{16}$/);
});

test("Run setup plans no hotbar writes", async () => {
  for (const m of MACROS) assert.ok(!("slot" in m), `${m.name} has no hotbar slot`);
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("../scripts/main.mjs", import.meta.url), "utf8");
  const setup = src.slice(src.indexOf("async setup()"), src.indexOf("// ------------------------------------------------------------ travel"));
  assert.ok(setup.length > 100, "setup source found");
  assert.doesNotMatch(setup, /hotbar\s*[.\[]|["'`]hotbar\.|assignHotbarMacro/, "setup never writes a hotbar");
});

test("winnerRecipients: owners and assigned players of the receiving actor, never GMs", () => {
  const owners = new Set(["p1", "p2", "gm"]);
  const actor = { id: "A", testUserPermission: (u, lvl) => lvl === "OWNER" && owners.has(u.id) };
  const users = [{ id: "gm", isGM: true }, { id: "p1" }, { id: "p2" }, { id: "p3", character: { id: "A" } }, { id: "p4", character: { id: "B" } }];
  assert.deepEqual(winnerRecipients(actor, users).sort(), ["p1", "p2", "p3"]);
  const party = { id: "P", testUserPermission: () => false };
  assert.deepEqual(winnerRecipients(party, users), [], "party with no player owners: nobody");
  assert.deepEqual(winnerRecipients(actor, users, { id: "p4" }).sort(), ["p1", "p2", "p3", "p4"]);
  assert.deepEqual(winnerRecipients(null, users), []);
});
