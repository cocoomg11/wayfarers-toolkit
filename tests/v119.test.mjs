import { test } from "node:test";
import assert from "node:assert/strict";
import * as H from "../scripts/history-model.mjs";
import * as J from "../scripts/junk-rules.mjs";
import * as P from "../scripts/phases.mjs";
import * as C from "../scripts/compare.mjs";
import * as WS from "../scripts/weapon-sets.mjs";

// ---------------------------------------------------------------- loot roll history
const card = (choices, extra = {}) => ({
  itemUuid: "Actor.p.Item.i1", name: "Ring of Dust", img: "r.webp", color: "#1eff00", rarity: "uncommon", quantity: 1, pileName: "Bandit",
  sceneName: "Old Mill", names: { u1: "Ann (Mira)", u2: "Bob (Kel)", u3: "Cy (Tor)" }, choices, ...extra
});
const at = (d, h = 20) => new Date(2026, 9, d, h, 5).getTime();

test("history: an entry from a finished card", () => {
  const st = card({ u1: { choice: "need", roll: 40, rerolls: [77] }, u2: { choice: "greed", roll: 90 }, u3: { choice: "pass", roll: null } });
  const e = H.makeEntry(st, { outcome: "won", who: { uid: "u1", actor: "Mira", tier: "need", roll: 77 }, at: at(30), id: "x1" });
  assert.equal(e.id, "x1"); assert.equal(e.scene, "Old Mill"); assert.equal(e.item.name, "Ring of Dust"); assert.equal(e.item.rarity, "uncommon");
  assert.deepEqual(e.winner, { uid: "u1", user: "Ann", actor: "Mira", tier: "need", roll: 77 });
  assert.deepEqual(e.choices.map(c => [c.user, c.choice, c.roll, c.rolls]), [["Ann", "need", 77, [40, 77]], ["Bob", "greed", 90, [90]], ["Cy", "pass", null, []]]);
  const assigned = H.makeEntry(card({}), { outcome: "assigned", who: { actor: "The Party" }, at: at(30), id: "x2" });
  assert.deepEqual(assigned.winner, { uid: null, user: "", actor: "The Party", tier: null, roll: null });
  assert.equal(H.makeEntry(card({}), { outcome: "bogus" }).outcome, "won", "unknown outcomes fall back");
  assert.deepEqual(H.splitName("Ann (Mira)"), { user: "Ann", actor: "Mira" });
  assert.deepEqual(H.splitName("Ann (the) (Mira)"), { user: "Ann (the)", actor: "Mira" });
  assert.deepEqual(H.splitName("Solo"), { user: "Solo", actor: "" });
  const people = H.makeEntry(card({ u1: { choice: "pass" } }, { people: { u1: { user: "Ann (x)", actor: "M" } } }));
  assert.equal(people.choices[0].user, "Ann (x)", "saved people beat parsing the label");
});

test("history: newest first, capped, duplicates replaced, bad stored values ignored", () => {
  let list = [];
  for (let i = 0; i < 7; i++) list = H.addEntry(list, { id: `e${i}`, at: i }, 5);
  assert.deepEqual(list.map(e => e.id), ["e6", "e5", "e4", "e3", "e2"]);
  assert.deepEqual(H.addEntry(list, { id: "e4", at: 99 }, 5).map(e => e.id), ["e4", "e6", "e5", "e3", "e2"]);
  assert.deepEqual(H.addEntry("junk", { id: "a" }).map(e => e.id), ["a"]);
  assert.deepEqual(H.addEntry([null, 3, { id: "b" }], { id: "a" }).map(e => e.id), ["a", "b"]);
  assert.equal(H.HISTORY_MAX, 500);
});

const E = [
  H.makeEntry(card({ u1: { choice: "need", roll: 80 }, u2: { choice: "greed", roll: 99 } }), { who: { uid: "u1", actor: "Mira", tier: "need", roll: 80 }, at: at(29), id: "a" }),
  H.makeEntry(card({ u1: { choice: "greed", roll: 10 }, u2: { choice: "greed", roll: 60 } }, { name: "Axe" }), { who: { uid: "u2", actor: "Kel", tier: "greed", roll: 60 }, at: at(30), id: "b" }),
  H.makeEntry(card({ u1: { choice: "pass" }, u2: { choice: "pass" } }, { name: "Boots" }), { outcome: "passed", at: at(30, 21), id: "c" }),
  H.makeEntry(card({}, { name: "Cloak" }), { outcome: "assigned", who: { actor: "Mira" }, at: at(31), id: "d" }),
  H.makeEntry(card({}, { name: "Dagger" }), { outcome: "expired", at: at(31, 22), id: "e" })
].reverse();

test("history: players, days and filters", () => {
  assert.deepEqual(H.players(E).map(p => p.label), ["Ann (Mira)", "Bob (Kel)", "Mira"]);
  assert.deepEqual(H.days(E), ["2026-10-31", "2026-10-30", "2026-10-29"]);
  assert.deepEqual(H.filterEntries(E, { day: "2026-10-30" }).map(e => e.id), ["c", "b"]);
  assert.deepEqual(H.filterEntries(E, { player: "u2" }).map(e => e.id), ["c", "b", "a"]);
  assert.deepEqual(H.filterEntries(E, { player: "actor:Mira" }).map(e => e.id), ["d"], "an assigned item counts for the character");
  assert.deepEqual(H.filterEntries(E, { player: "u1", day: "2026-10-29" }).map(e => e.id), ["a"]);
  assert.deepEqual(H.filterEntries(E).length, 5);
});

test("history: per-player tally", () => {
  const t = Object.fromEntries(H.tally(E).map(r => [r.label, r]));
  assert.deepEqual([t["Ann (Mira)"].won, t["Ann (Mira)"].need, t["Ann (Mira)"].greed, t["Ann (Mira)"].rolls], [1, 1, 0, 3]);
  assert.deepEqual([t["Bob (Kel)"].won, t["Bob (Kel)"].need, t["Bob (Kel)"].greed, t["Bob (Kel)"].rolls], [1, 0, 1, 3]);
  assert.deepEqual([t.Mira.won, t.Mira.assigned, t.Mira.rolls], [1, 1, 0]);
  assert.deepEqual(H.tally([]), []);
  const unclaimed = H.makeEntry(card({ u1: { choice: "need", roll: 5 } }), { outcome: "unclaimed", who: { uid: "u1", tier: "need", roll: 5 } });
  assert.equal(H.tally([unclaimed])[0].won, 0, "an item nobody received isn't a win");
});

test("history: sorting", () => {
  assert.deepEqual(H.sortEntries(E).map(e => e.id), ["e", "d", "c", "b", "a"]);
  assert.deepEqual(H.sortEntries(E, "date", "asc").map(e => e.id), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(H.sortEntries(E, "item", "asc").map(e => e.item.name), ["Axe", "Boots", "Cloak", "Dagger", "Ring of Dust"]);
  assert.deepEqual(H.sortEntries(E, "winner", "asc").map(e => e.id).slice(0, 2), ["e", "c"], "nobody received sorts first");
  assert.deepEqual(H.sortEntries(E, "nonsense").map(e => e.id), ["e", "d", "c", "b", "a"], "unknown key: by date");
});

test("history: CSV", () => {
  const csv = H.toCSV(H.sortEntries(E, "date", "asc"));
  const lines = csv.trimEnd().split("\r\n");
  assert.equal(lines.length, 6);
  assert.equal(lines[0], H.CSV_HEADER.join(","));
  assert.equal(lines[1], "2026-10-29,20:05,Old Mill,Ring of Dust,1,uncommon,Won,Ann (Mira),Need,80,Ann (Mira): Need 80; Bob (Kel): Greed 99,,Actor.p.Item.i1");
  assert.match(lines[3], /,All passed,,,,Ann \(Mira\): Pass; Bob \(Kel\): Pass,/);
  assert.match(lines[4], /,GM assigned,Mira,,,,,/);
  assert.equal(H.csvCell('say "hi", ok'), '"say ""hi"", ok"');
  assert.equal(H.csvCell("=1+1"), "'=1+1", "formula injection defused");
  assert.equal(H.csvCell("-5"), "'-5");
  assert.equal(H.csvCell("a\nb"), '"a\nb"');
  assert.equal(H.csvCell(null), "");
  assert.ok(csv.endsWith("\r\n"));
});

// ---------------------------------------------------------------- sell all junk
const it = (o = {}) => ({ id: o.id ?? o.name, name: "Thing", type: "loot", trash: false, color: null, rarity: "", equipped: false, favourite: false, inSet: false, quantity: 1, price: 5, ...o });

test("junk: what counts as grey", () => {
  assert.ok(J.isJunk(it({ trash: true })), "Vendor Trash drop");
  assert.ok(J.isJunk(it({ color: "#9D9D9D", type: "weapon" })), "grey tooltip colour, any case");
  assert.ok(J.isJunk(it({ rarity: "poor" })), "poor rarity");
  assert.ok(!J.isJunk(it({ rarity: "" })), "plain loot with no rarity isn't junk");
  assert.ok(!J.isJunk(it({ rarity: "common", color: "#ffffff" })));
  assert.ok(!J.isJunk(it({ trash: true, type: "feat" })), "not inventory");
  assert.ok(!J.isJunk(it({ trash: true, type: "container" })), "containers are never sold");
  assert.ok(!J.isJunk(null));
});

test("junk: equipped, favourites and weapon-set items are kept", () => {
  const items = [
    it({ name: "Torn Pelt", trash: true }), it({ name: "Broken Fang", trash: true, quantity: 3 }),
    it({ name: "Rusty Sword", type: "weapon", color: J.GREY, equipped: true }), it({ name: "Lucky Rock", trash: true, favourite: true }),
    it({ name: "Old Dagger", type: "weapon", rarity: "poor", inSet: true }), it({ name: "Dust", trash: true, price: 0 }),
    it({ name: "Ghost", trash: true, quantity: 0 }), it({ name: "Fine Ring", type: "equipment", rarity: "rare" }), it({ name: "Unknown", trash: true, price: null })
  ];
  const r = J.selectJunk(items);
  assert.deepEqual(r.sell.map(d => d.name), ["Broken Fang", "Torn Pelt", "Unknown"]);
  assert.deepEqual(r.kept.map(d => [d.name, d.reason]), [["Dust", "noValue"], ["Ghost", "empty"], ["Lucky Rock", "favourite"], ["Old Dagger", "weaponSet"], ["Rusty Sword", "equipped"]]);
  assert.equal(r.kept.find(d => d.name === "Old Dagger").reasonText, "in a weapon set");
});

test("junk: favourites and coin conversion", () => {
  const favs = [{ type: "item", id: ".Item.abc" }, { type: "skill", id: "ath" }, { type: "item", id: "Actor.x.Item.def" }];
  assert.ok(J.isFavourite(favs, "abc")); assert.ok(J.isFavourite(favs, "def"));
  assert.ok(!J.isFavourite(favs, "ath"), "only item favourites"); assert.ok(!J.isFavourite(favs, "zzz"));
  assert.ok(!J.isFavourite(null, "abc")); assert.ok(!J.isFavourite(favs, ""));
  assert.equal(J.toSmallest(1.2345, 0.0001), 12345, "gold primary, copper at 1/10000");
  assert.equal(J.toSmallest(0.5, 0.01), 50);
  assert.equal(J.toSmallest(3, 0), 0);
});

test("junk: weapon-set ids from the stored state", () => {
  const st = WS.normalize({ active: "melee", sets: { melee: { main: "a", off: "b" }, ranged: { main: "c", off: null }, utility: { main: null, off: "d" } } });
  assert.deepEqual(WS.assignedIds(st).sort(), ["a", "b", "c", "d"]);
  assert.deepEqual(WS.assignedIds(WS.normalize(null)), [], "no sets stored: nothing held back for that reason");
});

// ---------------------------------------------------------------- boss phases
test("phases: parsing", () => {
  assert.deepEqual(P.parsePhases([33, 66]), [66, 33]);
  assert.deepEqual(P.parsePhases("66, 33"), [66, 33]);
  assert.deepEqual(P.parsePhases("66% 33%;10"), [66, 33, 10]);
  assert.deepEqual(P.parsePhases("0, 100, 150, -5, abc, 50, 50, 49.6"), [50]);
  assert.deepEqual(P.parsePhases(""), []); assert.deepEqual(P.parsePhases(null), []);
  assert.equal(P.phasesText([33, 66]), "66, 33");
});

test("phases: percentages and phase numbers", () => {
  assert.equal(P.hpPercent({ value: 50, max: 200 }), 25);
  assert.equal(P.hpPercent({ value: 50, max: 200, effectiveMax: 100 }), 50);
  assert.equal(P.hpPercent({ value: 300, max: 200 }), 100);
  assert.equal(P.hpPercent({ value: 5, max: 0 }), null);
  assert.equal(P.phaseAt(80, [66, 33]), 1); assert.equal(P.phaseAt(66, [66, 33]), 1, "exactly on the mark is still above");
  assert.equal(P.phaseAt(65.9, [66, 33]), 2); assert.equal(P.phaseAt(10, [66, 33]), 3);
});

test("phases: one notice per crossing, reset when healed", () => {
  const T = [66, 33];
  let r = P.checkPhases(90, T, []); assert.deepEqual(r.crossed, []); assert.equal(r.changed, false);
  r = P.checkPhases(60, T, []); assert.deepEqual(r.crossed, [{ threshold: 66, phase: 2 }]); assert.deepEqual(r.passed, [66]); assert.ok(r.changed);
  r = P.checkPhases(50, T, [66]); assert.deepEqual(r.crossed, [], "no repeat"); assert.equal(r.changed, false);
  r = P.checkPhases(70, T, [66]); assert.deepEqual(r.crossed, []); assert.deepEqual(r.passed, []); assert.ok(r.changed, "healed back above: reset");
  r = P.checkPhases(60, T, []); assert.deepEqual(r.crossed.map(c => c.phase), [2], "told again after the reset");
  r = P.checkPhases(20, T, []); assert.deepEqual(r.crossed, [{ threshold: 66, phase: 2 }, { threshold: 33, phase: 3 }], "a big hit crosses both");
  r = P.checkPhases(40, T, [66, 33]); assert.deepEqual(r.passed, [66]); assert.deepEqual(r.crossed, []);
  r = P.checkPhases(null, T, [66]); assert.deepEqual(r.crossed, []); assert.equal(r.changed, false);
  r = P.checkPhases(10, [], [66]); assert.deepEqual(r.passed, [], "marks removed: nothing to report");
  r = P.checkPhases(10, [50], [66, 50]); assert.deepEqual(r.passed, [50]); assert.equal(r.changed, false, "old marks no longer set are ignored");
  assert.equal(P.phaseLine("The Ogre", { threshold: 66, phase: 2 }), "The Ogre reached phase 2 (below 66%).");
});

// ---------------------------------------------------------------- item comparison
const W = (o = {}) => ({ id: o.id, name: o.name ?? "w", type: "weapon", system: { equipped: false, type: { value: o.t ?? "martialM" }, properties: new Set(o.p ?? []) } });
const SH = (name, buckler = false) => ({ id: name, name, type: "equipment", system: { equipped: true, type: { value: "shield" } }, flags: buckler ? { "wayfarers-toolkit": { buckler: true } } : {} });
const G = (name, t = "trinket") => ({ id: name, name, type: "equipment", system: { equipped: false, type: { value: t }, properties: new Set() } });
const d = x => WS.describe(x);

test("compare: average damage", () => {
  assert.equal(C.averageOf("1d8"), 4.5); assert.equal(C.averageOf("2d6 + 3"), 10); assert.equal(C.averageOf("1d4-1"), 1.5);
  assert.equal(C.averageOf("d12"), 6.5); assert.equal(C.averageOf("1d6+1d4"), 6); assert.equal(C.averageOf(""), null); assert.equal(C.averageOf("@mod"), null);
});

test("compare: which hand a weapon is compared with", () => {
  assert.deepEqual(C.compareHand(d(W({ name: "Longsword" })), "melee"), { set: "melee", hand: "main" });
  assert.deepEqual(C.compareHand(d(W({ name: "Longsword" })), "ranged"), { set: "melee", hand: "main" }, "melee weapon: the Melee set even with Ranged in hand");
  assert.deepEqual(C.compareHand(d(W({ name: "Mace" })), "utility"), { set: "utility", hand: "main" });
  assert.deepEqual(C.compareHand(d(W({ name: "Longbow", t: "martialR", p: ["amm", "two"] })), "melee"), { set: "ranged", hand: "main" });
  assert.deepEqual(C.compareHand(d(SH("Kite Shield")), "melee"), { set: "melee", hand: "off" });
  assert.deepEqual(C.compareHand(d(SH("Kite Shield")), "ranged"), { set: "ranged", hand: "off" });
  assert.deepEqual(C.compareHand(d(G("Torch")), "melee"), { set: "utility", hand: "off" });
  assert.equal(C.compareHand(d(G("Amulet", "trinket")), "melee"), null, "not a hand item");
});

test("compare: hand notes follow the weapon-set rules", () => {
  const great = d(W({ name: "Greatsword", p: ["two"] })); const bow = d(W({ name: "Longbow", t: "martialR", p: ["amm", "two"] }));
  const xbow = d(W({ name: "Hand Crossbow", t: "martialR", p: ["amm", "lgt"] })); const sword = d(W({ name: "Longsword" }));
  assert.equal(C.handNote(great, { off: d(SH("Kite Shield")) }), "Needs both hands: Kite Shield would have to be stowed.");
  assert.equal(C.handNote(great, { worn: [d(SH("Iron Buckler", true))] }), "Needs both hands: Iron Buckler would have to be stowed.", "bucklers still block two-handers");
  assert.equal(C.handNote(great, { off: d(W({ name: "Dagger" })) }), "Needs both hands: Dagger would come out of the off hand.");
  assert.equal(C.handNote(bow, {}), "");
  assert.equal(C.handNote(xbow, { worn: [d(SH("Kite Shield"))] }), "Needs a free hand to load: Kite Shield would have to be stowed.");
  assert.equal(C.handNote(xbow, { worn: [d(SH("Iron Buckler", true))] }), "", "a buckler leaves the hand free");
  assert.equal(C.handNote(sword, { off: d(SH("Kite Shield")) }), "");
  assert.equal(C.handNote(great, { off: d(SH("Kite Shield")), hand: "off" }), "");
});

const S = (o = {}) => ({ name: "x", kind: "weapon", ac: null, damage: [], attack: 0, magic: 0, properties: [], attune: false, value: null, weight: null, ...o });
const rowsOf = (a, b) => Object.fromEntries(C.diffItems(a, b).rows.map(r => [r.key, r]));

test("compare: weapons", () => {
  const a = S({ damage: [{ formula: "1d10", types: ["Slashing"] }], magic: 1, properties: ["Heavy", "Two-Handed"], attune: true, value: 5000, weight: 6 });
  const b = S({ damage: [{ formula: "1d8", types: ["Piercing"] }], magic: 0, properties: ["Finesse"], value: 1500, weight: 3 });
  const r = rowsOf(a, b);
  assert.equal(r.damage.tone, "better"); assert.equal(r.damage.a, "1d10 Slashing (avg 5.5)"); assert.equal(r.damage.b, "1d8 Piercing (avg 4.5)");
  assert.equal(r.damageType.tone, "different");
  assert.equal(r.magic.tone, "better"); assert.equal(r.magic.a, "+1"); assert.equal(r.magic.b, "0");
  assert.equal(r.properties.a, "+ Heavy, Two-Handed"); assert.equal(r.properties.b, "− Finesse"); assert.equal(r.properties.tone, "different");
  assert.equal(r.attune.tone, "worse"); assert.equal(r.attune.a, "Required");
  assert.equal(r.value.tone, "better"); assert.equal(r.weight.tone, "worse", "heavier is worse");
  assert.equal(r.attack, undefined, "no attack bonus on either: no row");
  const same = rowsOf(S({ damage: [{ formula: "1d8", types: ["Slashing"] }] }), S({ damage: [{ formula: "1d8", types: ["Slashing"] }] }));
  assert.equal(same.damage.tone, "same"); assert.equal(same.damageType, undefined);
  const worse = rowsOf(S({ damage: [{ formula: "1d6", types: [] }], attack: 1 }), S({ damage: [{ formula: "2d6", types: [] }], attack: 2 }));
  assert.equal(worse.damage.tone, "worse"); assert.equal(worse.attack.tone, "worse"); assert.equal(worse.attack.a, "+1");
});

test("compare: armour, an empty slot and unknown values", () => {
  const r = rowsOf(S({ kind: "armor", ac: 16, weight: 40, value: 7500 }), S({ kind: "armor", ac: 14, weight: 20, value: 1000 }));
  assert.equal(r.ac.tone, "better"); assert.equal(r.ac.a, "16"); assert.equal(r.weight.tone, "worse");
  const empty = rowsOf(S({ kind: "shield", ac: 2, properties: ["Magical"], value: 1000, weight: 6 }), null);
  assert.equal(empty.ac.tone, "better"); assert.equal(empty.ac.b, "0");
  assert.equal(empty.value.tone, "different"); assert.equal(empty.value.b, "–"); assert.equal(empty.properties.a, "Magical");
  const unknown = rowsOf(S({ value: null }), S({ value: 500 }));
  assert.equal(unknown.value.tone, "different"); assert.equal(unknown.value.a, "–");
  assert.deepEqual(C.diffItems(null, S()), { rows: [], empty: true });
  const att = rowsOf(S({ attune: false }), S({ attune: true }));
  assert.equal(att.attune.tone, "better", "dropping an attunement item frees a slot");
  const fmt = C.diffItems(S({ value: 150 }), S({ value: 100 }), { fmtMoney: n => `${n}c` }).rows.find(x => x.key === "value");
  assert.equal(fmt.a, "150c");
});
