import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import "./_globals.mjs";
import { readRequest, makeRequest } from "../vendor/wanderers-core/index.mjs";
const R = await import("../scripts/requests.mjs");
const { FEATURES } = await import("../scripts/features.mjs");
const N = await import("../scripts/update-notes.mjs");
const { RECORD_SETTINGS } = await import("../scripts/panel-model.mjs");

const src = f => readFileSync(new URL(`../scripts/${f}`, import.meta.url), "utf8");
const RID = "abcd1234-1-kz0a1b";
const req = (kind, data) => readRequest(R.REQUESTS, { action: "request", kind, rid: RID, data });

// ---------------------------------------------------------------- 1: onto wanderers-core
test("core: every socket request goes through core's schemas; no module socket code of our own", () => {
  for (const f of readdirSync(new URL("../scripts/", import.meta.url))) {
    if (!f.endsWith(".mjs")) continue;
    const s = src(f);
    assert.doesNotMatch(s, /game\.socket\.(on|emit)/, `${f} uses the socket directly`);
    assert.doesNotMatch(s, /msg\.userId|r\.userId|\.userId\s*:\s*game\.user\.id/, `${f} reads or sends a payload user id`);
  }
  assert.match(src("core.mjs"), /createLeader\(\{ id: ID, log: logger\.log, requests: REQUESTS, hooks: \[NOTICE_HOOK\] \}\)/);
});

test("core: request schemas accept what the toolkit sends and refuse the rest", () => {
  assert.ok(req("flight", { from: "a", to: "b", pax: 3 }).ok);
  assert.ok(!req("flight", { from: "a", to: "b", pax: 3, free: true }).ok, "a player can't ask for a free flight");
  assert.ok(!req("flight", { from: "a", to: "b", pax: 3, userId: "someone" }).ok, "no payload user id");
  assert.ok(!req("flight", { from: "a", to: "b", pax: 99 }).ok);
  assert.ok(req("paceRequest", { pace: "slow" }).ok);
  assert.ok(!req("paceRequest", { pace: "sprint" }).ok);
  assert.ok(req("lootChoice", { messageId: "abcdefghijklmnop", choice: "need" }).ok);
  assert.ok(!req("lootChoice", { messageId: "x", choice: "need" }).ok, "document ids only");
  assert.equal(R.REQUESTS.lootClose.from, "gm"); assert.equal(R.REQUESTS.lootAssign.from, "gm"); assert.equal(R.REQUESTS.notifyAll.from, "gm");
  assert.ok(req("mapPin", { op: "create", sceneId: "abcdefghijklmnop", x: 1, y: 2, pin: { label: "Mill", kind: "gm", hidden: true } }).ok, "extra pin fields are dropped");
  assert.deepEqual(req("mapPin", { op: "create", sceneId: "abcdefghijklmnop", x: 1, y: 2, pin: { label: "Mill", kind: "gm", hidden: true } }).data.pin, { label: "Mill" });
  assert.ok(!req("mapPin", { op: "reveal", sceneId: "abcdefghijklmnop" }).ok);
  assert.ok(req("roomRequest", { sceneId: "abcdefghijklmnop", innId: "inn1" }).ok);
  assert.ok(req("restedRest", { actorId: "abcdefghijklmnop" }).ok);
  assert.ok(!req("nope", {}).ok, "unknown kinds refused");
  assert.throws(() => makeRequest(R.REQUESTS, "flight", RID, { from: "a" }));
});

test("core: notices are read for this user only, with a level and a length cap", () => {
  assert.deepEqual(R.readNotice({ to: "u1", text: "hi" }, "u1"), { level: "info", text: "hi" });
  assert.equal(R.readNotice({ to: "u2", text: "hi" }, "u1"), null);
  assert.deepEqual(R.readNotice({ to: null, level: "warn", text: "all" }, "u1"), { level: "warn", text: "all" });
  assert.equal(R.readNotice({ to: null, level: "evil", text: "x" }, "u1").level, "info");
  assert.equal(R.readNotice({ text: "" }, "u1"), null);
  assert.equal(R.readNotice({ text: "x".repeat(900) }, "u1").text.length, 300);
  assert.equal(R.NOTICE_HOOK, "wayfarers-toolkit.notice");
});

test("core: update notes use core's ordering and still read the pre-1.17 record", async () => {
  assert.deepEqual(N.decide({ current: "1.27.0" }), { kind: "fresh", from: null });
  assert.deepEqual(N.decide({ current: "1.27.0", wizardDone: true }), { kind: "upgrade", from: null });
  assert.deepEqual(N.decide({ stored: "1.26.0", current: "1.27.0" }), { kind: "upgrade", from: "1.26.0" });
  assert.deepEqual(N.decide({ current: "1.27.0", setupReminded: "1.14.4" }), { kind: "upgrade", from: "1.14.4" });
  const r = await N.build({ from: "1.26.0", to: "1.27.0", always: [] });
  assert.equal(r.entries[0].version, "1.27.0");
});

// ---------------------------------------------------------------- 2: settings IO gone, permissions part of health, healthReport
test("settings export/import and the permission-checks switch are gone; records are still listed for the hub", () => {
  assert.ok(!FEATURES.some(f => f.id === "settingsIO" || f.id === "permissionChecks"));
  assert.doesNotMatch(src("main.mjs"), /settingsIO/);
  assert.doesNotMatch(src("health.mjs"), /F\.on\("permissionChecks"\)/);
  for (const k of ["lootHistoryData", "goldSnapshots", "lastSeenVersion", "pinsNotesShown"]) assert.ok(RECORD_SETTINGS.has(k), k);
  assert.match(src("main.mjs"), /settingsRecords: \(\) => \[\.\.\.RECORD_SETTINGS\]/);
});

test("healthReport: core's format, plain text, GM only", async () => {
  const H = src("health.mjs");
  assert.match(H, /export async function report\(api/);
  assert.match(H, /if \(!game\.user\?\.isGM\) return \[\];/);
  assert.match(H, /healthCollector\(\{ timeoutMs \}\)/);
  const { toPlain } = await import("../scripts/health.mjs").catch(() => ({}));
  if (toPlain) {
    assert.equal(toPlain(`3 creatures: <em>A</em> &amp; B. <button type="button" data-x>Link</button>`), "3 creatures: A & B.");
  }
  assert.match(src("main.mjs"), /healthReport\(opts = \{\}\) \{ return Health\.report\(this, opts\); \}/);
});
