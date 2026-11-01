import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./_globals.mjs";
const TM = await import("../scripts/tracker-model.mjs");
const { RECORD_SETTINGS, WIZARD_IGNORE } = await import("../scripts/panel-model.mjs");
const src = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

const VIEW = { vw: 1920, vh: 1080 }, SIZE = { w: 250, h: 200 };

test("clampPos keeps the box inside the window, and at 0 when it is bigger than the window", () => {
  assert.deepEqual(TM.clampPos({ x: -40, y: -5 }, SIZE, VIEW), { x: 0, y: 0 });
  assert.deepEqual(TM.clampPos({ x: 5000, y: 5000 }, SIZE, VIEW), { x: 1670, y: 880 });
  assert.deepEqual(TM.clampPos({ x: 300.4, y: 99.6 }, SIZE, VIEW), { x: 300, y: 100 });
  assert.deepEqual(TM.clampPos({ x: 50, y: 50 }, { w: 3000, h: 3000 }, VIEW), { x: 0, y: 0 });
  assert.deepEqual(TM.clampPos({ x: NaN, y: undefined }, SIZE, VIEW), { x: 0, y: 0 });
});

test("parsePos: objects, JSON text, junk and other versions", () => {
  assert.deepEqual(TM.parsePos({ v: 1, fx: 0.5, y: 120 }), { fx: 0.5, y: 120 });
  assert.deepEqual(TM.parsePos('{"v":1,"fx":1,"y":40}'), { fx: 1, y: 40 });
  assert.deepEqual(TM.parsePos({ fx: "0.25", y: "30" }), { fx: 0.25, y: 30 }, "numeric strings and a missing version read");
  assert.deepEqual(TM.parsePos({ v: 1, fx: 7, y: -20 }), { fx: 1, y: 0 }, "pulled into range");
  for (const bad of [{}, null, undefined, "", "not json", [], 3, { v: 1, fx: 0.5 }, { v: 1, y: 4 }, { v: 2, fx: 0.5, y: 4 }, { v: 1, fx: "", y: 4 }, { v: 1, fx: null, y: 4 }, { v: 1, fx: Infinity, y: 0 }])
    assert.equal(TM.parsePos(bad), null, JSON.stringify(bad));
});

test("toSaved / fromSaved round-trip, and a box against the right edge stays there when the window changes", () => {
  const s = TM.toSaved({ x: 1670, y: 300 }, SIZE, VIEW);
  assert.deepEqual(s, { v: 1, fx: 1, y: 300 });
  assert.deepEqual(TM.fromSaved(TM.parsePos(s), SIZE, VIEW), { x: 1670, y: 300 });
  assert.deepEqual(TM.fromSaved(TM.parsePos(s), SIZE, { vw: 1280, vh: 720 }), { x: 1030, y: 300 });
  assert.deepEqual(TM.fromSaved({ fx: 0.5, y: 900 }, SIZE, { vw: 1280, vh: 720 }), { x: 515, y: 520 }, "a top below a smaller window is pulled up");
  const mid = TM.toSaved({ x: 835, y: 10 }, SIZE, VIEW);
  assert.equal(mid.fx, 0.5);
  assert.deepEqual(TM.toSaved({ x: 9999, y: -3 }, SIZE, VIEW), { v: 1, fx: 1, y: 0 }, "saved clamped");
  assert.deepEqual(TM.toSaved({ x: 10, y: 10 }, { w: 2000, h: 50 }, VIEW).fx, 0, "no free width: 0, not NaN");
});

test("defaultPos keeps clear of the sidebar, scene navigation, players list and hotbar", () => {
  // v14 at 1920×1080: sidebar on the right, controls column and scene navigation on the left, players bottom left, hotbar bottom middle.
  const core = [
    { x: 1620, y: 0, w: 300, h: 1080 },   // sidebar
    { x: 8, y: 8, w: 88, h: 600 },        // scene controls
    { x: 104, y: 8, w: 200, h: 500 },     // scene navigation (~x 104–304)
    { x: 8, y: 880, w: 220, h: 190 },     // players
    { x: 600, y: 1000, w: 720, h: 70 }    // hotbar
  ];
  const p = TM.defaultPos(SIZE, VIEW, core);
  const box = { ...p, ...SIZE };
  for (const o of core) assert.ok(!TM.overlaps(box, o), `overlaps ${JSON.stringify(o)}`);
  assert.deepEqual(p, { x: 1620 - 16 - 250, y: 16 }, "top right, just left of the sidebar");
  // A collapsed sidebar frees the right edge.
  assert.equal(TM.defaultPos(SIZE, VIEW, [{ x: 1880, y: 0, w: 40, h: 300 }]).x, 1880 - 16 - 250);
  // Something in the top-right corner pushes it down, not across the screen.
  const q = TM.defaultPos(SIZE, VIEW, [core[0], { x: 1300, y: 0, w: 320, h: 120 }]);
  assert.deepEqual(q, { x: 1354, y: 136 });
  // Nothing free: top right, still inside the window.
  const r = TM.defaultPos(SIZE, { vw: 400, vh: 300 }, [{ x: 0, y: 0, w: 400, h: 300 }]);
  assert.deepEqual(r, TM.clampPos(r, SIZE, { vw: 400, vh: 300 }));
  assert.deepEqual(TM.defaultPos(SIZE, VIEW), { x: 1920 - 16 - 250, y: 16 }, "no obstacles");
});

test("nudge: arrow keys move by STEP (Shift: BIG), other keys do nothing", () => {
  assert.deepEqual(TM.nudge({ x: 100, y: 100 }, "ArrowLeft"), { x: 90, y: 100 });
  assert.deepEqual(TM.nudge({ x: 100, y: 100 }, "ArrowDown", true), { x: 100, y: 150 });
  assert.equal(TM.nudge({ x: 0, y: 0 }, "Enter"), null);
});

test("tracker-model has no Foundry calls", () => {
  assert.doesNotMatch(src("scripts/tracker-model.mjs"), /\b(game|ui|Hooks|foundry|canvas|document|window)\./);
});

test("trackerPos is a hidden client setting, kept out of the wizard and settings exports; cleanup's settings reset covers it", () => {
  const q = src("scripts/quests.mjs");
  assert.match(q, /register\(ID, "trackerPos", \{ scope: "client", config: false, type: Object, default: \{\} \}\)/);
  assert.ok(RECORD_SETTINGS.has("trackerPos")); assert.ok(WIZARD_IGNORE.has("trackerPos"));
  // Cleanup resets every registered setting of ours, client ones included.
  assert.match(src("scripts/cleanup.mjs"), /c\.namespace === ID && \(c\.scope === "world" \? game\.user\.isGM : true\)/);
});

test("tracker: draggable header, grip keyboard, close X, Show tracker switch in the log, never re-shown by tracking", () => {
  const q = src("scripts/quests.mjs");
  for (const ev of ["pointerdown", "pointermove", "pointerup", "pointercancel", "keydown", "dblclick"]) assert.match(q, new RegExp(`hud\\.addEventListener\\("${ev}"`), ev);
  assert.match(q, /setPointerCapture/);
  assert.match(q, /class="grip" tabindex="0"/);
  assert.match(q, /data-action="close"/);
  assert.match(q, /data-tracker="toggle"[^>]*aria-pressed/);
  assert.match(q, /window\.addEventListener\("resize"/);
  assert.match(q, /clientSettingChanged/);
  assert.match(q, /showTracker, resetTrackerPosition/);
  // Only the user's own buttons turn the tracker back on (track() and autoTrack() never write questTracker).
  const trackFns = q.slice(q.indexOf("export async function track("), q.indexOf("// ---------------------------------------------------------------- tracker HUD"));
  assert.doesNotMatch(trackFns, /questTracker/);
  // Still gated by the feature: nothing drawn or listened to when the tracker feature is off.
  assert.match(q, /if \(!TRACKER \|\| !S\("questTracker"\)\)/);
  assert.match(q, /if \(TRACKER\) \{\s*\/\*\* @type \{any\} \*\/\s*let t = null;/);
  assert.match(src("scripts/panel.mjs"), /tab\.id === "quests" && F\.on\("questLog"\) && F\.on\("questTracker"\)/);
});

test("1.27.2 version and download URL", () => {
  const m = JSON.parse(src("module.json"));
  assert.equal(m.version, "1.27.2");
  assert.match(m.download, /releases\/download\/v1\.27\.2\/module\.zip$/);
});
