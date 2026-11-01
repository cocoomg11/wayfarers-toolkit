import { test } from "node:test";
import assert from "node:assert/strict";
import "./_globals.mjs";
const OM = await import("../scripts/online-model.mjs");
const Flight = await import("../scripts/flight.mjs");
const { TABS, LABELS, tabKeys, WIZARD_IGNORE } = await import("../scripts/panel-model.mjs");
const { RECORD_SETTINGS: SKIP } = await import("../scripts/panel-model.mjs");
const { NOTES } = await import("../scripts/update-notes.mjs");

// Measured in a v14 world: controls 16–88, scene navigation column 104–304, players list from y 1108.
const VIEW = { width: 1129, height: 1267 };
const SIZE = { width: 180, height: 120 };
const UI = { controls: { left: 16, top: 16, right: 88, bottom: 1038 }, nav: { left: 104, top: 16, right: 304, bottom: 1251 }, players: { left: 16, top: 1108, right: 88, bottom: 1251 } };
const overlaps = (p, s, r) => p.left < r.right && p.left + s.width > r.left && p.top < r.bottom && p.top + s.height > r.top;

test("who's online: default spots clear the v14 scene navigation", () => {
  const tl = OM.anchorPos("top-left", VIEW, SIZE, UI);
  assert.deepEqual(tl, { left: 312, top: 12 });
  for (const a of Object.keys(OM.POSITIONS)) {
    const p = OM.anchorPos(a, VIEW, SIZE, UI);
    assert.ok(!overlaps(p, SIZE, UI.nav), `${a} clears the nav`);
    assert.ok(p.left >= OM.EDGE && p.top >= OM.EDGE && p.left + SIZE.width <= VIEW.width && p.top + SIZE.height <= VIEW.height, `${a} on screen`);
  }
  const bl = OM.anchorPos("bottom-left", { width: 1129, height: 900 }, SIZE, { controls: UI.controls, players: { left: 16, top: 760, right: 88, bottom: 890 } });
  assert.equal(bl.top + SIZE.height, 760 - OM.EDGE, "level with the top of the players list"); assert.equal(bl.left, 96);
  assert.equal(OM.anchorPos("top-left", VIEW, SIZE, { controls: UI.controls }).left, 96, "no nav: right of the controls");
  assert.equal(OM.anchorPos("top-left", VIEW, SIZE, {}).left, 320, "nothing measured: a safe fixed spot");
  assert.equal(OM.anchorPos("nonsense", VIEW, SIZE, UI).left, 312, "unknown choice = top left");
});

test("who's online: positions are clamped to the window", () => {
  assert.deepEqual(OM.clampPos({ left: 5000, top: -40 }, VIEW, SIZE), { left: VIEW.width - SIZE.width - OM.EDGE, top: OM.EDGE });
  assert.deepEqual(OM.clampPos({ left: "x", top: NaN }, VIEW, SIZE), { left: OM.EDGE, top: OM.EDGE });
  // A spot saved on a big screen, then the window shrinks.
  assert.deepEqual(OM.clampPos({ left: 1700, top: 1000 }, { width: 800, height: 600 }, SIZE), { left: 612, top: 472 });
  // Panel bigger than the window: its corner stays visible.
  assert.deepEqual(OM.clampPos({ left: 300, top: 300 }, { width: 100, height: 100 }, SIZE), { left: OM.EDGE, top: OM.EDGE });
});

test("who's online: saved spot, drag toggle and reset", () => {
  assert.equal(OM.savedPos({}), null); assert.equal(OM.savedPos(null), null); assert.equal(OM.savedPos({ left: "a", top: 1 }), null);
  assert.deepEqual(OM.savedPos({ left: "40", top: 50 }), { left: 40, top: 50 });
  assert.deepEqual(OM.placePanel({ saved: { left: 500, top: 300 } }, VIEW, SIZE, UI), { left: 500, top: 300 });
  assert.deepEqual(OM.placePanel({ saved: { left: 500, top: 300 }, drag: false }, VIEW, SIZE, UI), { left: 312, top: 12 }, "dragging off ignores saved spots");
  assert.deepEqual(OM.placePanel({ saved: {} }, VIEW, SIZE, UI), { left: 312, top: 12 }, "reset ({}) = default");
  assert.deepEqual(OM.placePanel({ saved: { left: 9999, top: 9999 } }, VIEW, SIZE, UI), { left: 941, top: 1139 });
});

// ---------------------------------------------------------------- flight map view
const MAP = { width: 1000, height: 640 };
const close = (a, b, msg) => { assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9, `${msg}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`); };

test("map zoom: around the cursor, within 0.5x to 4x", () => {
  const at = { x: 300, y: 200 };
  const before = Flight.viewToMap(Flight.VIEW_IDENTITY, at);
  const v = Flight.zoomAt(Flight.VIEW_IDENTITY, 2, at, MAP);
  assert.equal(v.k, 2);
  close(Flight.viewToMap(v, at), before, "the map point under the cursor stays under it");
  let z = Flight.VIEW_IDENTITY; for (let i = 0; i < 20; i++) z = Flight.zoomAt(z, 1.5, { x: 500, y: 320 }, MAP);
  assert.equal(z.k, Flight.MAP_ZOOM.max);
  for (let i = 0; i < 40; i++) z = Flight.zoomAt(z, 0.5, { x: 500, y: 320 }, MAP);
  assert.equal(z.k, Flight.MAP_ZOOM.min);
  assert.deepEqual(Flight.zoomAt({ k: 1, tx: 0, ty: 0 }, 0, at, MAP), { k: 1, tx: 0, ty: 0 }, "bad factor changes nothing");
  assert.deepEqual(Flight.MAP_ZOOM, { min: 0.5, max: 4 });
});

test("map pan: moves, and always keeps part of the map in view", () => {
  const v = Flight.panBy({ k: 2, tx: 0, ty: 0 }, -100, 50, MAP);
  assert.deepEqual(v, { k: 2, tx: -100, ty: 50 });
  const far = Flight.panBy({ k: 1, tx: 0, ty: 0 }, 99999, -99999, MAP);
  assert.equal(far.tx, MAP.width * 0.75); assert.equal(far.ty, MAP.height * 0.25 - MAP.height);
  assert.deepEqual(Flight.clampView({ k: "x", tx: "y" }, MAP), { k: 1, tx: 0, ty: 0 });
});

test("map view: conversions round-trip; a dragged point's pos is the same at any zoom", () => {
  const v = { k: 2.5, tx: -340, ty: 120 };
  const p = { x: 412.5, y: 77 };
  close(Flight.viewToMap(v, Flight.mapToView(v, p)), p, "round trip");
  // The GM drops a point under the cursor; the map converts screen → viewBox → map → 0–1 pos.
  const PAD = 60, W = 1000, H = 640;
  const toPos = m => ({ x: (m.x - PAD) / (W - 2 * PAD), y: (m.y - PAD) / (H - 2 * PAD) });
  const target = { x: 0.25, y: 0.6 }; const mapPt = { x: PAD + target.x * (W - 2 * PAD), y: PAD + target.y * (H - 2 * PAD) };
  for (const view of [Flight.VIEW_IDENTITY, v, { k: 0.5, tx: 200, ty: 100 }, { k: 4, tx: -1500, ty: -900 }]) {
    const cursor = Flight.mapToView(view, mapPt);
    close(toPos(Flight.viewToMap(view, cursor)), target, `pos at zoom ${view.k}`);
  }
});

test("map view: wheel factor, zoomed flag and transform", () => {
  assert.ok(Flight.wheelFactor(-100) > 1, "wheel up zooms in"); assert.ok(Flight.wheelFactor(100) < 1);
  assert.equal(Flight.wheelFactor(0), 1);
  assert.equal(Flight.wheelFactor(-100000), 2); assert.equal(Flight.wheelFactor(100000), 0.5);
  assert.ok(Math.abs(Flight.wheelFactor(3, 1) - Flight.wheelFactor(99, 0)) < 1e-12, "line mode");
  assert.equal(Flight.isZoomed(Flight.VIEW_IDENTITY), false); assert.equal(Flight.isZoomed({ k: 1, tx: 5, ty: 0 }), true);
  assert.equal(Flight.viewTransform({ k: 2, tx: -10.12345, ty: 3 }), "translate(-10.123 3) scale(2)");
});

test("1.25 settings rows, labels, storage and notes", () => {
  const travel = TABS.find(t => t.id === "travel"), places = TABS.find(t => t.id === "places");
  assert.ok(travel.advanced.some(r => r[0] === "flightMapZoom" && r[1] === "flightMaster:flightMap"));
  assert.ok(places.advanced.some(r => r[0] === "onlineDrag" && r[1] === "whosOnline"));
  for (const k of ["flightMapZoom", "onlineDrag"]) { assert.ok(LABELS[k]?.[0], k); assert.ok(!SKIP.has(k), `${k} exported`); }
  assert.ok(!tabKeys(places).includes("onlineHudPos"), "the drag spot isn't a panel row");
  assert.ok(WIZARD_IGNORE.has("onlineHudPos"));
  const n = NOTES.find(x => x.version === "1.25.0"); assert.ok(n);
  assert.deepEqual(n.changes.map(c => c.feature), ["whosOnline", "flightMap"]);
  assert.doesNotMatch(JSON.stringify([n, LABELS.flightMapZoom, LABELS.onlineDrag]), /warcraft|blizzard|azeroth|\bwow\b/i);
});
