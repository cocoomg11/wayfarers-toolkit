import { test } from "node:test";
import assert from "node:assert/strict";
import "./_globals.mjs";
import { FEATURES } from "../scripts/features.mjs";
import { FEATURE_IDS, FEATURE_CARDS, TABS, tabKeys, LABELS, PRESETS, condOn } from "../scripts/panel-model.mjs";
import { NOTES } from "../scripts/update-notes.mjs";
import { SKIP } from "../scripts/settings-io-model.mjs";
const Flight = await import("../scripts/flight.mjs");

const BOX = { x: 60, y: 60, width: 880, height: 520 };

test("map background: off or blank draws nothing", () => {
  assert.equal(Flight.mapBackground({ on: false, src: "worlds/w/map.webp" }, BOX), null);
  assert.equal(Flight.mapBackground({ src: "" }, BOX), null);
  assert.equal(Flight.mapBackground({ src: "   " }, BOX), null);
  assert.equal(Flight.mapBackground(undefined, BOX), null);
});

test("map background: defaults fill the points' box, fit picks preserveAspectRatio", () => {
  const b = Flight.mapBackground({ src: " worlds/w/map.webp " }, BOX);
  assert.deepEqual(b, { src: "worlds/w/map.webp", preserve: "xMidYMid meet", opacity: 1, x: 60, y: 60, width: 880, height: 520 });
  assert.equal(Flight.mapBackground({ src: "a.png", fit: "cover" }, BOX).preserve, "xMidYMid slice");
  assert.equal(Flight.mapBackground({ src: "a.png", fit: "stretch" }, BOX).preserve, "none");
  assert.equal(Flight.mapBackground({ src: "a.png", fit: "nonsense" }, BOX).preserve, "xMidYMid meet");
  for (const k of ["contain", "cover", "stretch"]) assert.ok(Flight.MAP_FITS[k]);
});

test("map background: scale grows around the centre, offsets move by a share of the box", () => {
  const b = Flight.mapBackground({ src: "a.png", scale: 2 }, BOX);
  assert.deepEqual([b.x, b.y, b.width, b.height], [-380, -200, 1760, 1040]);
  assert.equal(b.x + b.width / 2, BOX.x + BOX.width / 2, "centre stays put");
  const o = Flight.mapBackground({ src: "a.png", offsetX: 0.5, offsetY: -0.25 }, BOX);
  assert.deepEqual([o.x, o.y], [60 + 440, 60 - 130]);
});

test("map background: bad or out-of-range numbers are clamped or fall back", () => {
  const b = Flight.mapBackground({ src: "a.png", opacity: 7, scale: 99, offsetX: -5, offsetY: "x" }, BOX);
  assert.equal(b.opacity, 1); assert.equal(b.width, 880 * 4); assert.equal(b.y, 60 - (520 * 4 - 520) / 2);
  assert.equal(b.x, 60 + (880 - 880 * 4) / 2 - 880);
  assert.equal(Flight.mapBackground({ src: "a.png", opacity: -1, scale: 0 }, BOX).opacity, 0);
  assert.equal(Flight.mapBackground({ src: "a.png", scale: 0 }, BOX).width, 880 * 0.25);
  assert.equal(Flight.mapBackground({ src: "a.png", scale: "abc" }, BOX).width, 880);
});

test("map background: a point at (0,0)/(1,1) sits on the picture's corners at default settings", () => {
  // The map draws a point at PAD + pos * (size − 2·PAD): the same box the picture fills, so positions line up with the picture.
  const b = Flight.mapBackground({ src: "a.png", fit: "stretch" }, BOX);
  const px = p => ({ x: BOX.x + p.x * BOX.width, y: BOX.y + p.y * BOX.height });
  assert.deepEqual(px({ x: 0, y: 0 }), { x: b.x, y: b.y });
  assert.deepEqual(px({ x: 1, y: 1 }), { x: b.x + b.width, y: b.y + b.height });
});

test("1.23 feature, settings rows, labels and notes", () => {
  const f = FEATURES.find(x => x.id === "flightMapBackground");
  assert.ok(f && f.key === "feature-flightMapBackground" && f.default === true);
  assert.ok(FEATURE_IDS.includes("flightMapBackground")); assert.ok(FEATURE_CARDS.some(c => c.id === "flightMapBackground"));
  assert.ok(PRESETS.everything.on.includes("flightMapBackground"));
  const travel = TABS.find(t => t.id === "travel");
  const keys = ["flightMapImage", "flightMapFit", "flightMapOpacity", "flightMapScale", "flightMapOffsetX", "flightMapOffsetY"];
  for (const k of keys) {
    assert.ok(tabKeys(travel).includes(k), k); assert.ok(LABELS[k]?.[0], k); assert.ok(!SKIP.has(k), `${k} is exported`);
    const row = travel.advanced.find(r => r[0] === k);
    assert.ok(row, `${k} under Advanced`);
    assert.equal(condOn(row[1], id => id !== "flightMapBackground"), false, `${k} hidden when the background is off`);
    assert.equal(condOn(row[1], id => id !== "flightMap"), false, `${k} needs the route map`);
  }
  assert.equal(NOTES[0].version, "1.23.0");
  assert.deepEqual(NOTES[0].changes.map(c => c.feature), ["flightMapBackground"]);
});

test("no publisher names in 1.23 strings", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("../scripts/flight-map.mjs", import.meta.url), "utf8");
  const all = JSON.stringify([NOTES[0], FEATURES.find(x => x.id === "flightMapBackground"), FEATURE_CARDS, LABELS, Flight.MAP_FITS]) + src;
  assert.doesNotMatch(all, /warcraft|blizzard|azeroth|\bwow\b/i);
});
