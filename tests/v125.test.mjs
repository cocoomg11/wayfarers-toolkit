import { test } from "node:test";
import assert from "node:assert/strict";
import "./_globals.mjs";
const Flight = await import("../scripts/flight.mjs");
const { TABS, LABELS, tabKeys, WIZARD_IGNORE } = await import("../scripts/panel-model.mjs");
const { RECORD_SETTINGS: SKIP } = await import("../scripts/panel-model.mjs");
const { NOTES } = await import("../scripts/update-notes.mjs");

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
  assert.ok(!tabKeys(places).includes("onlineDrag"), "Who's online moved to Red Book (1.27)");
  for (const k of ["flightMapZoom"]) { assert.ok(LABELS[k]?.[0], k); assert.ok(!SKIP.has(k), `${k} exported`); }
  assert.ok(!tabKeys(places).includes("onlineHudPos"), "the drag spot isn't a panel row");
  assert.ok(WIZARD_IGNORE.has("onlineHudPos"));
  const n = NOTES.find(x => x.version === "1.25.0"); assert.ok(n);
  assert.deepEqual(n.changes.map(c => c.feature), ["whosOnline", "flightMap"]);
  assert.doesNotMatch(JSON.stringify([n, LABELS.flightMapZoom]), /warcraft|blizzard|azeroth|\bwow\b/i);
});
