import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import "./_globals.mjs";
const P = await import("../scripts/pins-model.mjs");
const Perm = await import("../scripts/permissions.mjs");
const { FEATURES } = await import("../scripts/features.mjs");
const { TABS, LABELS, FEATURE_CARDS, FEATURE_IDS, WIZARD_IGNORE, tabKeys } = await import("../scripts/panel-model.mjs");
const { RECORD_SETTINGS: SKIP } = await import("../scripts/panel-model.mjs");
const { NOTES } = await import("../scripts/update-notes.mjs");
const { CATEGORIES } = await import("../scripts/cleanup.mjs");

const ID = "wayfarers-toolkit";
const S1 = "Scene00000000001", N1 = "Note000000000001", Q1 = "Quest00000000001", L1 = "Level00000000001";
const gm = { id: "GM00000000000001", isGM: true };
const alice = { id: "User000000000001", isGM: false }, bob = { id: "User000000000002", isGM: false };
const noteWith = pin => ({ flags: { [ID]: { pin } } });

// ---------------------------------------------------------------- flag shape and normalizer
test("pin flag: normalizer fills defaults, versions, clamps and never lets a party pin be hidden", () => {
  const n = P.normalize({});
  assert.deepEqual(n, { v: P.PIN_VERSION, kind: "party", hidden: false, label: "", text: "", icon: "pin", ink: "iron", quest: "", by: "" });
  // v missing (0) reads like 1
  assert.equal(P.normalize({ label: "Old mill" }).v, 1);
  // hidden pins are always GM pins
  assert.deepEqual([P.normalize({ hidden: true }).kind, P.normalize({ hidden: true }).hidden], ["gm", true]);
  assert.equal(P.normalize({ kind: "gm" }).hidden, false);
  // bad values fall back, long text cut, labels on one line
  const odd = P.normalize({ kind: "boss", icon: "../evil", ink: "#ff0000", quest: "not an id", label: "  A\n  b  ".repeat(30), text: "x".repeat(900), by: 5 });
  assert.equal(odd.kind, "party"); assert.equal(odd.icon, "pin"); assert.equal(odd.ink, "iron"); assert.equal(odd.quest, ""); assert.equal(odd.by, "");
  assert.ok(odd.label.length <= P.LABEL_MAX && !odd.label.includes("\n"));
  assert.equal(odd.text.length, P.TEXT_MAX);
  assert.equal(P.pinOf({ flags: {} }), null);
  assert.equal(P.pinOf(noteWith({ label: "x" })).label, "x");
  assert.equal(P.isPin(noteWith("junk")), false);
});

test("pin note data: hidden GM pins carry no readable label; texture from bundled icons; levels only when given", () => {
  const d = P.noteData({ kind: "gm", hidden: true, label: "Ambush", icon: "skull", ink: "red" }, { x: 10.4, y: 20.6, level: L1, size: 10 });
  assert.equal(d.text, ""); assert.equal(d.x, 10); assert.equal(d.y, 21);
  assert.equal(d.texture.src, `modules/${ID}/styles/pins/skull.svg`); assert.equal(d.texture.tint, P.INKS.red.hex);
  assert.deepEqual(d.levels, [L1]); assert.equal(d.iconSize, P.SIZE.min, "core needs iconSize ≥ 32");
  assert.equal(d.flags[ID].pin.label, "Ambush");
  assert.equal(P.noteData({ label: "a" }, { x: 0, y: 0 }).levels, undefined);
  assert.equal(P.noteUpdate({ label: "Shown", kind: "gm" }).text, "Shown");
  for (const id of Object.keys(P.ICONS)) assert.ok(existsSync(new URL(`../styles/pins/${id}.svg`, import.meta.url)), id);
});

// ---------------------------------------------------------------- permissions
test("permissions: players change party pins only; GM pins and reveal are GM-only; hidden GM pins invisible to players", () => {
  const party = P.normalize({ kind: "party", by: alice.id, label: "a" });
  const gmPin = P.normalize({ kind: "gm", label: "b" });
  const hidden = P.normalize({ kind: "gm", hidden: true, label: "c" });
  for (const a of ["create", "edit", "move", "delete"]) assert.ok(P.can(a, alice, a === "create" ? null : party), a);
  for (const a of ["edit", "move", "delete", "reveal"]) assert.equal(P.can(a, alice, gmPin), false, a);
  assert.ok(P.can("view", alice, gmPin)); assert.equal(P.can("view", alice, hidden), false);
  assert.ok(P.can("view", gm, hidden)); assert.ok(P.can("reveal", gm, hidden)); assert.equal(P.can("reveal", gm, party), false);
  // sub-toggles
  assert.equal(P.can("create", alice, null, { players: false }), false);
  assert.equal(P.can("edit", bob, party, { editAll: false }), false);
  assert.ok(P.can("edit", alice, party, { editAll: false }));
  assert.ok(P.can("view", alice, party, { players: false }), "viewing doesn't need the placing toggle");
  assert.equal(P.can("edit", null, party), false);
});

// ---------------------------------------------------------------- relay payloads
test("relay: requests are read strictly and drop what a player may not set", () => {
  const base = { action: "mapPin", sceneId: S1 };
  const c = P.readRequest({ ...base, op: "create", x: 5, y: 6, level: L1, pin: { label: "Camp", kind: "gm", hidden: true, by: gm.id, icon: "camp", extra: 1 }, junk: true });
  assert.deepEqual(c, { op: "create", sceneId: S1, x: 5, y: 6, level: L1, pin: { label: "Camp", text: "", icon: "camp", ink: "iron", quest: "" } });
  assert.equal(P.readRequest({ ...base, op: "create", x: 5, y: 6, pin: { label: "  " } }), null, "label needed");
  assert.equal(P.readRequest({ ...base, op: "create", x: "5", y: 6, pin: { label: "a" } }), null, "numbers only");
  assert.equal(P.readRequest({ ...base, op: "create", x: NaN, y: 6, pin: { label: "a" } }), null);
  assert.equal(P.readRequest({ ...base, op: "update", pin: { label: "a" } }), null, "note id needed");
  assert.equal(P.readRequest({ ...base, op: "drop", noteId: N1 }), null);
  assert.equal(P.readRequest({ action: "other", op: "delete", sceneId: S1, noteId: N1 }), null);
  assert.equal(P.readRequest({ ...base, sceneId: "../x", op: "delete", noteId: N1 }), null);
  assert.deepEqual(P.readRequest({ ...base, op: "delete", noteId: N1, pin: { label: "x" } }), { op: "delete", sceneId: S1, noteId: N1 });
  assert.deepEqual(P.readRequest({ ...base, op: "move", noteId: N1, x: 1, y: 2 }), { op: "move", sceneId: S1, noteId: N1, x: 1, y: 2 });
  assert.equal(P.readRequest(null), null);
});

test("relay: the GM's decision sets kind, hidden and author itself, clamps, caps and guards quests", () => {
  const facts = (extra = {}) => ({ user: alice, sceneOk: true, dims: { width: 100, height: 100 }, levelOk: id => id === L1, count: 0, note: null, questOk: id => id === Q1, size: 40, ...extra });
  const req = P.readRequest({ action: "mapPin", op: "create", sceneId: S1, x: 500, y: -4, level: L1, pin: { label: "Camp", quest: Q1 } });
  const d = P.decide(req, facts());
  assert.ok(d.ok);
  assert.deepEqual([d.pin.kind, d.pin.hidden, d.pin.by, d.pin.quest], ["party", false, alice.id, Q1]);
  assert.deepEqual([d.data.x, d.data.y, d.data.levels], [100, 0, [L1]]);
  // a quest the player can't see is dropped, not linked
  assert.equal(P.decide({ ...req, pin: { ...req.pin, quest: "Quest00000000002" } }, facts()).pin.quest, "");
  assert.equal(P.decide(req, facts({ levelOk: () => false })).data.levels, undefined);
  assert.equal(P.decide(req, facts({ sceneOk: false })).ok, false);
  assert.equal(P.decide(req, facts({ players: false })).ok, false);
  assert.equal(P.decide(req, facts({ count: P.PINS_MAX })).ok, false);
  assert.equal(P.decide(null, facts()).ok, false);
  // updates: a GM pin is refused; a party pin keeps its author and kind; an existing hidden quest link is kept as is
  const upd = P.readRequest({ action: "mapPin", op: "update", sceneId: S1, noteId: N1, pin: { label: "New", quest: "Quest00000000009" } });
  assert.equal(P.decide(upd, facts({ note: noteWith({ kind: "gm", label: "x" }) })).ok, false);
  const kept = P.decide(upd, facts({ user: bob, note: noteWith({ kind: "party", by: alice.id, label: "Old", quest: "Quest00000000009" }) }));
  assert.ok(kept.ok); assert.equal(kept.pin.by, alice.id); assert.equal(kept.pin.quest, "Quest00000000009"); assert.equal(kept.data.text, "New");
  assert.equal(P.decide(upd, facts({ user: bob, editAll: false, note: noteWith({ kind: "party", by: alice.id, label: "Old" }) })).ok, false);
  assert.equal(P.decide(upd, facts()).ok, false, "pin gone");
  const mv = P.decide(P.readRequest({ action: "mapPin", op: "move", sceneId: S1, noteId: N1, x: -9, y: 50.6 }), facts({ note: noteWith({ kind: "party", label: "a" }) }));
  assert.deepEqual(mv.data, { x: 0, y: 51 });
  const del = P.decide(P.readRequest({ action: "mapPin", op: "delete", sceneId: S1, noteId: N1 }), facts({ note: noteWith({ kind: "party", label: "a" }) }));
  assert.ok(del.ok); assert.equal(del.data, null);
});

test("forms and GM writes: players can't make GM or hidden pins; GM reveal only for GM pins", () => {
  assert.deepEqual(P.readForm({ label: "x", kind: "gm", hidden: "on" }), { label: "x", text: "", icon: "pin", ink: "iron", quest: "", kind: "party", hidden: false });
  assert.equal(P.readForm({ label: "x", kind: "gm", hidden: "on" }, { isGM: true }).hidden, true);
  assert.equal(P.readForm({ label: "x", kind: "party", hidden: "on" }, { isGM: true }).hidden, false);
  assert.equal(P.gmNote({ label: "x" }, alice).error, "GM only");
  assert.ok(P.gmNote({ label: "" }, gm).error);
  const g = P.gmNote({ label: "x", kind: "gm", hidden: true }, gm, { x: 1, y: 2 });
  assert.equal(g.pin.by, gm.id); assert.equal(g.data.text, "");
  assert.equal(P.gmUpdate({ kind: "party", by: alice.id, label: "a" }, { label: "b", by: gm.id }).by, alice.id);
  assert.equal(P.revealUpdate({ kind: "party", label: "a" }, true), null);
  assert.equal(P.revealUpdate({ kind: "gm", hidden: true, label: "a" }, false).text, "a");
});

// ---------------------------------------------------------------- quest guard
test("quest guard: nothing about a quest the user can't see; dimming only for finished ones", () => {
  const j = { id: Q1, name: "Secret" };
  const tools = see => ({ find: id => (id === Q1 ? j : null), canSee: () => see, info: () => ({ name: "Secret", status: "completed" }) });
  assert.equal(P.questFor({ quest: Q1 }, tools(false)), null);
  assert.deepEqual(P.questFor({ quest: Q1 }, tools(true)), { id: Q1, name: "Secret", status: "completed" });
  assert.equal(P.questFor({ quest: "" }, tools(true)), null);
  assert.equal(P.questFor({ quest: "Quest00000000002" }, tools(true)), null);
  assert.equal(P.dimmed({ status: "completed" }), true); assert.equal(P.dimmed({ status: "failed" }), true);
  assert.equal(P.dimmed({ status: "active" }), false); assert.equal(P.dimmed({ status: "completed" }, false), false);
  assert.equal(P.dimmed(null), false, "an invisible quest never dims, so dimming leaks nothing");
  assert.equal(P.alphaFor({ pin: { hidden: true }, isGM: true }), 0.5);
  assert.equal(P.alphaFor({ pin: {}, dim: true }), 0.45);
  assert.equal(P.drawn({ hidden: true }, false), false); assert.equal(P.drawn({ hidden: true }, true), true);
  const ch = P.questChoices([{ id: Q1, name: "B" }, { id: "Quest00000000002", name: "A" }, { id: "bad", name: "C" }], { canSee: q => q.id !== Q1 });
  assert.deepEqual(ch, [{ id: "Quest00000000002", name: "A" }]);
});

// ---------------------------------------------------------------- canvas helpers, cleanup
test("hit test, notes display rule, cleanup plan and tally", () => {
  const pins = [{ id: "a", x: 0, y: 0, size: 40 }, { id: "b", x: 30, y: 0, size: 40 }];
  assert.equal(P.hitPin(pins, { x: 18, y: 0 }), "b"); assert.equal(P.hitPin(pins, { x: 0, y: 50 }), null);
  assert.equal(P.showNotesNow({ hasPins: true }), true);
  assert.equal(P.showNotesNow({ hasPins: true, done: true }), false, "turned off again by the user: left off");
  assert.equal(P.showNotesNow({ hasPins: true, toggle: true }), false);
  assert.equal(P.showNotesNow({ hasPins: false }), false); assert.equal(P.showNotesNow({ hasPins: true, setting: false }), false);
  const scenes = [
    { notes: [{ id: "n1", flags: { [ID]: { pin: { label: "a" } } } }, { id: "n2", flags: {} }, { id: "n3", flags: { [ID]: { pin: { kind: "gm", hidden: true } } } }] },
    { notes: [{ id: "n4", flags: { other: { pin: {} } } }] }
  ];
  const g = P.pinsByScene(scenes);
  assert.equal(g.length, 1); assert.deepEqual(g[0].ids, ["n1", "n3"]);
  assert.deepEqual(P.tally(scenes), { pins: 2, scenes: 1, hidden: 1 });
  assert.ok(CATEGORIES.some(([k]) => k === "pins"));
  const cleanup = readFileSync(new URL("../scripts/cleanup.mjs", import.meta.url), "utf8");
  assert.match(cleanup, /deleteEmbeddedDocuments\("Note"/);
});

test("permission checks: players' map pins use the socket", () => {
  const facts = s => ({ on: id => id === "mapPins", socket: false, settings: { pinsPlayers: s }, players: [] });
  assert.ok(Perm.featureChecks(facts(true)).some(l => l.feature === "socket" && /map pins/.test(l.text)));
  assert.ok(!Perm.featureChecks(facts(false)).some(l => l.feature === "socket"));
});

// ---------------------------------------------------------------- wiring, docs, release
test("1.26 wiring: feature, panel rows, labels, settings lists, notes, version, styles", () => {
  assert.ok(FEATURES.some(f => f.id === "mapPins" && f.default === true));
  assert.ok(FEATURE_IDS.includes("mapPins")); assert.ok(FEATURE_CARDS.some(c => c.id === "mapPins"));
  const places = TABS.find(t => t.id === "places"); const keys = tabKeys(places);
  for (const k of ["pinsPlayers", "pinsEditAll", "pinsDimDone", "pinsSize", "pinsPaper", "pinsShowNotes"]) { assert.ok(keys.includes(k), k); assert.ok(LABELS[k]?.[0], k); }
  assert.ok(WIZARD_IGNORE.has("pinsNotesShown")); assert.ok(SKIP.has("pinsNotesShown"));
  assert.ok(NOTES.find(n => n.version === "1.26.0").changes.some(c => c.feature === "mapPins"));
  const mod = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
  assert.match(mod.download, new RegExp(`/v${mod.version.replace(/\./g, "\\.")}/module\\.zip$`));
  assert.ok(mod.styles.includes("styles/pins.css"));
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /`pins`/); assert.match(readme, /## Map pins/);
  // Public repo wording.
  const text = [readme.slice(readme.indexOf("## Map pins")), ...Object.keys(P.ICONS).map(id => readFileSync(new URL(`../styles/pins/${id}.svg`, import.meta.url), "utf8"))].join("\n");
  assert.doesNotMatch(text, /warcraft|blizzard|\bwow\b/i);
});
