import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./_globals.mjs";
const CL = await import("../scripts/coinlog-model.mjs");
const UX = await import("../scripts/quest-ux-model.mjs");
const VM = await import("../scripts/vault-model.mjs");
const { FEATURES } = await import("../scripts/features.mjs");
const PM = await import("../scripts/panel-model.mjs");
const { NOTES } = await import("../scripts/update-notes.mjs");
const src = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const THREE = [["gp", 10000], ["sp", 100], ["cp", 1]];
const STD = [["pp", 1000], ["gp", 100], ["ep", 50], ["sp", 10], ["cp", 1]];

// ---------------------------------------------------------------- coin log
test("breakdown: amounts as gold, silver, copper in either coin system", () => {
  assert.deepEqual(CL.breakdown(12345, THREE), { gp: 1, sp: 23, cp: 45 });
  assert.deepEqual(CL.breakdown(-12345, THREE), { gp: 1, sp: 23, cp: 45 }, "no sign");
  assert.deepEqual(CL.breakdown(1234, STD), { gp: 12, sp: 3, cp: 4 }, "platinum and electrum fold into gold and silver");
  assert.deepEqual(CL.breakdown(0, STD), { gp: 0, sp: 0, cp: 0 });
  assert.deepEqual(CL.breakdown(257), { gp: 2, sp: 5, cp: 7 }, "standard values by default");
  assert.equal(CL.coinText({ gp: 1, sp: 0, cp: 5 }), "1g 5c"); assert.equal(CL.coinText({}), "0c");
});

test("coin log: entries, cap, FIFO and a versioned normalizer", () => {
  let log = CL.normalizeCoinLog(null);
  assert.deepEqual(log, { v: 1, entries: [] });
  for (let i = 0; i < CL.COINLOG_MAX + 15; i++) log = CL.addEntry(log, CL.makeEntry({ id: `e${i}`, at: i, actor: "Actor.a", actorName: "A", delta: 10 + i, reason: "Test", coins: STD }));
  assert.equal(log.entries.length, CL.COINLOG_MAX);
  assert.equal(log.entries[0].id, `e${CL.COINLOG_MAX + 14}`, "newest first");
  assert.ok(!log.entries.some(e => e.id === "e0"), "oldest dropped");
  assert.equal(CL.makeEntry({ id: "z", actor: "Actor.a", delta: 0 }), null, "zero amounts aren't logged");
  const e = CL.makeEntry({ id: "x", actor: "Actor.a", actorName: "A", delta: -250, reason: "  Flight:\n A → B ", coins: STD });
  assert.deepEqual(e.coins, { gp: 2, sp: 5, cp: 0 }); assert.equal(e.reason, "Flight: A → B");
  assert.deepEqual(CL.normalizeCoinLog({ v: 1, entries: [null, { id: "q" }, 5, e] }).entries.map(x => x.id), ["x"], "bad entries dropped");
  assert.deepEqual(CL.normalizeCoinLog({ v: 9, entries: [e] }).entries, [], "a newer shape isn't trusted");
  assert.ok(VM.BUCKETS.includes("coinLog"), "vault bucket");
  assert.deepEqual(VM.bucket(VM.withBucket(null, "coinLog", log), "coinLog").entries.length, CL.COINLOG_MAX);
});

test("coin log undo: gives back what was paid, takes back only coin the actor still has", () => {
  const credit = CL.makeEntry({ id: "c", actor: "Actor.a", actorName: "Ann", delta: 500, reason: "Quest reward" });
  const debit = CL.makeEntry({ id: "d", actor: "Actor.a", actorName: "Ann", delta: -300, reason: "Rooms" });
  assert.deepEqual(CL.undoPlan(credit, { exists: true, have: 800 }), { ok: true, op: "take", amount: 500 });
  const short = CL.undoPlan(credit, { exists: true, have: 499 });
  assert.equal(short.ok, false); assert.match(short.reason, /no longer has that much/);
  assert.deepEqual(CL.undoPlan(debit, { exists: true, have: 0 }), { ok: true, op: "give", amount: 300 });
  assert.equal(CL.undoPlan(debit, { exists: false, have: 0 }).ok, false);
  let log = CL.addEntry(CL.addEntry(null, credit), debit);
  assert.ok(CL.undoable(log, "c")); assert.ok(CL.undoable(log, "d"));
  log = CL.markUndone(log, "c", 99);
  assert.equal(CL.undoable(log, "c"), false, "only once");
  assert.equal(CL.undoPlan(log.entries.find(e => e.id === "c"), { exists: true, have: 9999 }).ok, false);
  const undoEntry = CL.makeEntry({ id: "u", actor: "Actor.a", delta: -500, reason: "Undo", undoOf: "c" });
  log = CL.addEntry(log, undoEntry);
  assert.equal(CL.undoable(log, "u"), false, "an undo can't be undone");
  for (let i = 0; i < CL.UNDO_WINDOW; i++) log = CL.addEntry(log, CL.makeEntry({ id: `n${i}`, actor: "Actor.b", delta: 1 }));
  assert.equal(CL.undoable(log, "d"), false, "past the undo window");
});

test("split coin: even shares, the remainder stays, nothing for no members or too little coin", () => {
  const p = CL.splitPlan({ total: 1003, members: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }, { id: "a", name: "A again" }] });
  assert.equal(p.ok, true); assert.equal(p.per, 334); assert.equal(p.take, 1002); assert.equal(p.remainder, 1);
  assert.deepEqual(p.give.map(g => g.id), ["a", "b", "c"], "each member once");
  assert.equal(CL.splitPlan({ total: 1000, members: [] }).ok, false);
  assert.equal(CL.splitPlan({ total: 2, members: [{ id: "a" }, { id: "b" }, { id: "c" }] }).ok, false);
  assert.equal(CL.splitPlan({ total: -5, members: [{ id: "a" }] }).ok, false);
});

test("every coin movement the toolkit makes carries a coin log reason", () => {
  assert.match(src("scripts/quests.mjs"), /addMoney\(party, amount, \{ reason: `Quest reward/);
  assert.match(src("scripts/main.mjs"), /this\.pay\(party, charge, \{ reason: `Flight/);
  assert.match(src("scripts/main.mjs"), /CoinLog\.record\(party, [^;]+Flight refund/);
  assert.match(src("scripts/inn.mjs"), /CoinLog\.record\(a, [^;]+Rooms at/);
  const t = src("scripts/trash.mjs"); const b = src("scripts/bossloot.mjs");
  for (const s of [t, b]) assert.doesNotMatch(s, /addMoney\([^)]*\{ consolidate: true \}\)/, "an addMoney without a reason");
  assert.match(t, /Sold vendor trash/);
  // Logging only when the feature is on and on a GM client.
  assert.match(src("scripts/coinlog.mjs"), /if \(!F\.on\("coinLog"\) \|\| !game\.user\?\.isGM/);
});

test("migration coinLog1 creates the bucket once, only with the coin log on", () => {
  const m = src("scripts/migrate.mjs");
  assert.match(m, /export const MOVES = \[[^\]]*"coinLog1"[,\]]/);
  assert.match(m, /coinLog1: F\.on\("coinLog"\)/);
  assert.match(m, /async function coinLog1\(\) \{\s*if \(Vault\.get\("coinLog", null\)\) return null;/);
});

// ---------------------------------------------------------------- quest map pins
test("pinTarget: this scene first, then a stable pick on another scene, none without a pin", () => {
  const pins = [{ id: "p2", sceneId: "S2", x: 1, y: 2, quest: "Q" }, { id: "p1", sceneId: "S1", x: 3, y: 4, quest: "Q" }, { id: "p3", sceneId: "S3", x: 5, y: 6, quest: "R" }];
  assert.deepEqual(UX.pinTarget({ questId: "Q", sceneId: "S2", pins }), { kind: "here", pin: pins[0] });
  assert.equal(UX.pinTarget({ questId: "Q", sceneId: "S9", pins }).pin.id, "p1");
  assert.equal(UX.pinTarget({ questId: "Q", sceneId: "S9", pins }).kind, "other");
  assert.equal(UX.pinTarget({ questId: "Z", sceneId: "S1", pins }).kind, "none");
  assert.equal(UX.pinTarget({ questId: "Q", pins: [{ id: "x", sceneId: "S1", quest: "Q" }] }).kind, "none", "no position");
  assert.equal(UX.mayPing({ hidden: true }), false, "hidden GM pins are never pinged (pings broadcast)");
  assert.equal(UX.mayPing({ hidden: false }), true);
});

test("objective clicks: gated by the feature, uses canvas.animatePan and canvas.ping", () => {
  const p = src("scripts/pins.mjs");
  assert.match(p, /canvas\.animatePan\(\{ x: pin\.x, y: pin\.y/); assert.match(p, /canvas\.ping\(\{ x: pin\.x, y: pin\.y \}\)/);
  assert.match(src("scripts/main.mjs"), /goToPin: F\.on\("questMapPins"\) && F\.on\("mapPins"\) \? Pins\.goToQuest : null/);
});

// ---------------------------------------------------------------- Updated glow
test("glow: baseline on first load, glows on a changed view until seen", () => {
  const q = { status: "active", objectives: [{ id: "a", text: "Go", done: false }], sort: 1 };
  const s1 = UX.questStamp("Quest", q);
  assert.equal(UX.questStamp("Quest", { ...q, sort: 99, pub: true }), s1, "sort and pub don't count");
  const s2 = UX.questStamp("Quest", { ...q, objectives: [{ id: "a", text: "Go", done: true }] });
  assert.notEqual(s1, s2);
  assert.equal(UX.glowing({}, "Q", s1), false, "no baseline yet: nothing glows");
  let seen = UX.baseline({}, [{ id: "Q", stamp: s1 }]);
  assert.equal(seen.init, true); assert.equal(UX.glowing(seen, "Q", s1), false);
  assert.equal(UX.glowing(seen, "Q", s2), true, "changed");
  assert.equal(UX.glowing(seen, "N", s1), true, "a quest newly given glows");
  seen = UX.markSeen(seen, "Q", s2); assert.equal(UX.glowing(seen, "Q", s2), false);
  seen = UX.baseline(seen, []); assert.deepEqual(seen.seen, {}, "gone quests are forgotten");
  assert.deepEqual(UX.readSeen("junk"), { v: 1, init: false, seen: {} });
  let big = UX.baseline({}, []); for (let i = 0; i < UX.SEEN_MAX + 10; i++) big = UX.markSeen(big, `q${i}`, "s");
  assert.equal(Object.keys(big.seen).length, UX.SEEN_MAX, "capped");
});

test("glow: players only, client setting, kept out of the wizard and settings files", () => {
  const q = src("scripts/quests.mjs");
  assert.match(q, /export const isUpdated = j => GLOW && !game\.user\?\.isGM && !!j && canSee\(j\)/);
  assert.match(q, /register\(ID, "questSeen", \{ scope: "client", config: false, type: Object, default: \{\} \}\)/);
  assert.ok(PM.RECORD_SETTINGS.has("questSeen")); assert.ok(PM.WIZARD_IGNORE.has("questSeen"));
});

// ---------------------------------------------------------------- hooks for other modules
test("hook payloads: ids only for quests, decimal hours and whole coins for journeys", () => {
  assert.equal(UX.QUEST_HOOK, "wayfarersToolkit.questUpdated"); assert.equal(UX.JOURNEY_HOOK, "wayfarersToolkit.journey");
  assert.deepEqual(UX.questPayload("abcdefghijklmnop", "objective"), { questId: "abcdefghijklmnop", change: "objective" });
  assert.equal(UX.questPayload("x", "deleted"), null); assert.equal(UX.questPayload("", "started"), null);
  assert.equal(UX.statusChange("active"), "started"); assert.equal(UX.statusChange("completed"), "completed");
  assert.equal(UX.statusChange("failed"), "failed"); assert.equal(UX.statusChange("available"), "updated");
  const j = UX.journeyPayload({ kind: "flight", fromId: "a", toId: "b", fromName: "A", toName: "B", hours: 2.5, cost: { gp: 1.4, sp: -2, cp: 3 }, partyId: "P" });
  assert.deepEqual(j, { kind: "flight", fromId: "a", toId: "b", fromName: "A", toName: "B", hours: 2.5, cost: { gp: 1, sp: 0, cp: 3 }, partyId: "P" });
  assert.equal(UX.journeyPayload({ kind: "boat" }), null);
  assert.deepEqual(UX.journeyPayload({ kind: "hex", hours: 1 / 3 }).cost, { gp: 0, sp: 0, cp: 0 });
  assert.equal(UX.journeyPayload({ kind: "hex", hours: 1 / 3 }).hours, 0.33);
});

test("questUpdated fires after the save, journey after the trip; both gated by the feature", () => {
  const q = src("scripts/quests.mjs");
  for (const [before, change] of [["o.done = !!done; await save(j, q);", "objective"], ["o.hidden = !reveal; await save(j, q);", "objective"], ["q.hidden = !!hidden; await save(j, q);", "updated"]])
    assert.ok(q.includes(`${before}\n    emit(j, "${change}");`), before);
  assert.match(q, /await save\(j, q\);\n {4}emit\(j, UX\.statusChange\(status\)\);/);
  assert.match(q, /if \(!HOOKS\) return;/);
  assert.match(q, /Hooks\.callAll\(UX\.QUEST_HOOK, p\)/);
  const m = src("scripts/main.mjs");
  assert.match(m, /if \(!F\.on\("moduleHooks"\)\) return;/);
  assert.match(m, /journeyHook\(\{ kind: "flight"/); assert.match(m, /journeyHook\(\{ kind: "hex"/);
});

// ---------------------------------------------------------------- travel confirm, inn rest, keybindings
test("trip lines: cost, time, who pays", () => {
  assert.deepEqual(UX.tripLines({ cost: { gp: 1, sp: 20, cp: 0 }, hours: 2.5, payer: "The Party" }), [
    { label: "Cost", value: "1 gold, 20 silver" }, { label: "Time", value: "2.5 hours" }, { label: "Who pays", value: "The Party" }]);
  assert.equal(UX.tripLines({ cost: { gp: 0, sp: 0, cp: 0 }, hours: 1 })[2].value, "Nobody");
  assert.equal(UX.tripLines({ cost: { gp: 3 }, hours: 1, free: true })[0].value, "Free");
  assert.equal(UX.hoursText(72), "about 3 days (72 hours)"); assert.equal(UX.hoursText(1), "1 hour");
});

test("flights never advance time from the inn offer; the offer uses dnd5e's long rest without its own time advance", () => {
  const inn = src("scripts/inn.mjs");
  assert.match(inn, /a\.longRest\(\{ dialog: false, chat: true, advanceTime: false \}\)/);
  assert.match(inn, /if \(res\?\.ok && F\.on\("innRestOffer"\)\)/);
  // The flight's only time advance is still behind flightAdvanceTime.
  const m = src("scripts/main.mjs");
  assert.equal((m.match(/await game\.time\.advance/g) ?? []).length, 2, "hex travel and the flight setting only");
  assert.match(m, /setting\("flightAdvanceTime"\) === true && r\.h > 0\) await game\.time\.advance/);
});

test("key bindings: registered in init with no default keys, gated by the feature", () => {
  const m = src("scripts/main.mjs");
  assert.match(m, /if \(F\.on\("keybindings"\)\) registerKeybindings\(\);/);
  assert.match(m, /game\.keybindings\.register\(ID, key, \{ name, hint, editable: \[\]/);
  for (const k of ["characterPane", "controlPanel"]) assert.match(m, new RegExp(`reg\\("${k}"`));
  // The quest log keeps its own binding (and its L default) in quests.mjs.
  assert.match(src("scripts/quests.mjs"), /keybindings\.register\(ID, "questLog"/);
});

// ---------------------------------------------------------------- registry, panel, docs, version
test("1.28 features: toggles, cards, panel rows with labels, needs", () => {
  const ids = ["questMapPins", "questGlow", "keybindings", "coinLog", "splitCoin", "innRestOffer", "travelConfirm", "moduleHooks"];
  for (const id of ids) {
    assert.ok(FEATURES.some(f => f.id === id && f.key === `feature-${id}`), id);
    assert.ok(PM.FEATURE_IDS.includes(id), id); assert.ok(PM.FEATURE_CARDS.some(c => c.id === id), id);
  }
  const keys = PM.TABS.flatMap(PM.tabKeys);
  for (const k of ["travelConfirmSkip", "innRestHours"]) { assert.ok(keys.includes(k), k); assert.ok(PM.LABELS[k]?.[0], k); assert.ok(!PM.RECORD_SETTINGS.has(k), k); }
  assert.match(src("scripts/features.mjs"), /questMapPins: \["questLog", "mapPins"\]/);
  const n = NOTES.find(x => x.version === "1.28.0"); assert.ok(n, "1.28.0 update note");
  const text = JSON.stringify([n, FEATURES.filter(f => ids.includes(f.id)), PM.FEATURE_CARDS, PM.LABELS]) + src("scripts/coinlog.mjs") + src("scripts/quest-ux-model.mjs") + src("scripts/coinlog-model.mjs");
  assert.doesNotMatch(text, /warcraft|blizzard|azeroth|\bwow\b/i);
});

test("README documents both hooks", () => {
  const r = src("README.md");
  assert.match(r, /wayfarersToolkit\.questUpdated/); assert.match(r, /wayfarersToolkit\.journey/);
});

test("quest tracker: Escape cancels a mouse drag from anywhere, and pointer capture is guarded", () => {
  const q = src("scripts/quests.mjs");
  assert.match(q, /document\.addEventListener\("keydown", hudDragKey, true\)/, "page-wide Escape listener while dragging");
  assert.match(q, /document\.removeEventListener\("keydown", hudDragKey, true\)/, "removed when the drag ends");
  assert.match(q, /try \{ hudDrag\.header\.setPointerCapture/, "setPointerCapture guarded");
  assert.match(q, /hasPointerCapture/, "release only when captured");
  const esc = q.slice(q.indexOf("function hudDragKey"), q.indexOf("function hudMove"));
  assert.ok(esc.includes("setAt(hudDrag.from)") && !esc.includes("saveTrackerPos"), "back to the start, nothing saved");
});
