import { test } from "node:test";
import assert from "node:assert/strict";
import * as N from "../scripts/update-notes.mjs";

test("version compare", () => {
  assert.equal(N.compareVersions("1.16.0", "1.15.9"), 1);
  assert.equal(N.compareVersions("1.9.0", "1.10.0"), -1, "numeric, not text");
  assert.equal(N.compareVersions("1.16", "1.16.0"), 0);
  assert.equal(N.compareVersions("v1.17.0", "1.17.0"), 0);
  assert.equal(N.compareVersions("1.17.0-beta", "1.16.2"), 1);
  assert.equal(N.compareVersions("", "1.0.0"), -1);
  assert.equal(N.compareVersions("junk", ""), 0);
  assert.equal(N.parseVersion("x"), null);
});

test("ready: fresh worlds, upgrades, legacy worlds, downgrades", () => {
  assert.deepEqual(N.decide({ current: "1.17.0" }), { kind: "fresh", from: null }, "new world: wizard covers it");
  assert.deepEqual(N.decide({ stored: "1.16.0", current: "1.17.0" }), { kind: "upgrade", from: "1.16.0" });
  assert.deepEqual(N.decide({ stored: "1.17.0", current: "1.17.0" }).kind, "same");
  assert.deepEqual(N.decide({ stored: "1.18.0", current: "1.17.0" }).kind, "downgrade");
  assert.deepEqual(N.decide({ current: "1.17.0", setupReminded: "1.14.4", wizardDone: true }), { kind: "upgrade", from: "1.14.4" }, "the old reminder's stamp says where it came from");
  assert.deepEqual(N.decide({ current: "1.17.0", wizardDone: true }), { kind: "upgrade", from: null }, "used before, version unknown");
  assert.deepEqual(N.decide({ current: "1.17.0", setupReminded: "1.17.0" }).kind, "same");
  assert.deepEqual(N.decide({ stored: "1.16.0", current: "" }).kind, "same", "no running version: do nothing");
});

const act = (id, need = true, feature) => ({ id, label: id, feature, check: () => need, run: () => {} });
const notes = [
  { version: "1.12.0", changes: ["old"] },
  { version: "1.14.0", changes: ["a"], actions: [act("x"), act("y", true, "flights")] },
  { version: "1.15.0", changes: [{ text: "flight line", feature: "flights" }, "b"], actions: [act("x")] },
  { version: "1.15.1", changes: [] },
  { version: "1.16.0", changes: ["c"], actions: [act("done", false)] }
];

test("aggregation across versions, newest first, exclusive of from", async () => {
  assert.deepEqual(N.entriesBetween(notes, "1.14.0", "1.16.0").map(n => n.version), ["1.16.0", "1.15.1", "1.15.0"]);
  assert.deepEqual(N.entriesBetween(notes, null, "1.14.0").map(n => n.version), ["1.14.0", "1.12.0"]);
  const r = await N.build({ notes, always: [], from: "1.13.0", to: "1.16.0" });
  assert.deepEqual(r.entries.map(e => e.version), ["1.16.0", "1.15.0", "1.14.0"], "empty entries left out");
  assert.deepEqual(r.entries[1].changes, ["flight line", "b"]);
  assert.equal(r.post, true);
});

test("actions are deduped, done ones skipped, off features dropped", async () => {
  let calls = 0; const always = [{ id: "x", label: "dup", check: () => { calls++; return true; } }, act("setup")];
  const r = await N.build({ notes, always, from: "1.13.0", to: "1.16.0" });
  assert.deepEqual(r.actions.map(a => a.id), ["x", "y", "setup"]);
  assert.equal(calls, 0, "the duplicate's check isn't run");
  const off = await N.build({ notes, always: [], from: "1.13.0", to: "1.16.0", on: f => f !== "flights" });
  assert.deepEqual(off.actions.map(a => a.id), ["x"]);
  assert.deepEqual(off.entries.find(e => e.version === "1.15.0").changes, ["b"]);
  const throws = await N.build({ notes: [{ version: "2.0.0", changes: [], actions: [{ id: "t", check: () => { throw new Error("no"); } }] }], always: [], to: "2.0.0" });
  assert.equal(throws.post, false, "a failing check counts as not needed");
});

test("skip rules: a patch with no notes and nothing to do posts nothing", async () => {
  assert.equal((await N.build({ notes, always: [act("setup", false)], from: "1.15.0", to: "1.15.1" })).post, false);
  assert.equal((await N.build({ notes, always: [act("setup", true)], from: "1.15.0", to: "1.15.1" })).post, true, "an outstanding action is worth a card");
  assert.equal((await N.build({ notes, always: [], from: "1.16.0", to: "1.16.0" })).post, false, "same version");
});

test("manual re-show: previous version and card HTML", async () => {
  assert.equal(N.previousVersion(notes, "1.16.0"), "1.15.1");
  assert.equal(N.previousVersion(notes, "1.0.0"), null);
  const r = await N.build({ notes, always: [act("setup")], from: "1.14.0", to: "1.16.0" });
  const html = N.cardHTML(r);
  assert.match(html, /1\.14\.0 → 1\.16\.0/);
  assert.match(html, /What's new in 1\.16\.0/);
  assert.match(html, /<details><summary>1\.15\.0<\/summary>/, "older versions collapsed");
  assert.match(html, /data-wct-update="setup"/); assert.match(html, /data-wct-update="panel"/);
  assert.match(N.cardHTML({ ...r, from: null, actions: [] }), /from an earlier version/);
});

test("bundled notes: real versions, newest first, actions well formed, plain wording", () => {
  const vs = N.NOTES.map(n => n.version);
  assert.deepEqual([...vs].sort((a, b) => N.compareVersions(b, a)), vs);
  for (const n of N.NOTES) assert.ok(N.parseVersion(n.version), n.version);
  for (const a of [...N.NOTES.flatMap(n => n.actions ?? []), ...N.ALWAYS_ACTIONS]) {
    assert.ok(a.id && a.label && typeof a.check === "function" && typeof a.run === "function", a.id);
  }
  assert.ok(N.NOTES.find(n => n.version === "1.16.0").actions.some(a => a.id === "flightImport" && a.feature === "flightMaster"));
  const text = JSON.stringify(N.NOTES.map(n => n.changes));
  assert.doesNotMatch(text, /warcraft|blizzard|wow\b/i);
});

test("flight import action: needed only while the network is empty and the old page has rows", async () => {
  const a = N.NOTES.find(n => n.version === "1.16.0").actions[0];
  assert.equal(a.check({ api: { canImportLegacyFlights: () => true } }), true);
  assert.equal(a.check({ api: { canImportLegacyFlights: () => false } }), false);
  const off = await N.build({ always: [], from: "1.15.0", to: "1.16.0", on: f => f !== "flightMaster", ctx: { api: { canImportLegacyFlights: () => true } } });
  assert.equal(off.actions.length, 0);
});
