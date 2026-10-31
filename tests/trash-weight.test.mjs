import { test } from "node:test";
import assert from "node:assert/strict";
import * as R from "../scripts/trash-rules.mjs";

const lb = (name, type = "loot", subtype = "") => R.weightFor({ name, type, subtype });

test("weight table: body parts, cloth, trinkets, hides, meat, stone, flasks", () => {
  for (const n of ["Wolf Fang", "Bear Claw", "Owl Talon", "Boar Tusk", "Sharp Tooth"]) assert.equal(lb(n), 0.25, n);
  assert.equal(lb("Brittle Bone"), 0.3);
  assert.equal(lb("Torn Feather"), 0.1);
  assert.equal(lb("Tattered Cloth Scrap"), 0.1);
  assert.equal(lb("Old Letter"), 0.1);
  assert.equal(lb("Copper Ring"), 0.1);
  assert.equal(lb("Bone Ring"), 0.1, "made object beats material");
  assert.equal(lb("Thick Wolf Hide"), 3);
  assert.equal(lb("Tough Pelt"), 3);
  assert.equal(lb("Stringy Meat"), 1);
  assert.equal(lb("Meat Chunk"), 1, "meat beats chunk");
  assert.equal(lb("Rotting Flesh"), 1);
  assert.equal(lb("Cracked Skull"), 1);
  assert.equal(lb("Iron Ore Chunk"), 1.5);
  assert.equal(lb("Smooth Stone"), 1.5);
  assert.equal(lb("Empty Vial"), 0.5);
  assert.equal(lb("Chipped Mug"), 0.5);
  assert.equal(lb("Leather Pouch"), 0.5, "pouch beats leather");
  assert.equal(lb("Withered Leaves"), 0.1);
});
test("weight table: gear and the default", () => {
  assert.equal(lb("Worn Shortsword", "weapon"), 3);
  assert.equal(lb("Frayed Robe", "equipment", "clothing"), 1);
  assert.equal(lb("Dented Helm", "equipment", "light"), 2);
  assert.equal(lb("Dented Breastplate", "equipment", "medium"), 3);
  assert.equal(lb("Cracked Plate", "equipment", "heavy"), 5);
  assert.equal(lb("Tarnished Ring", "equipment", "trinket"), 0.1);
  assert.equal(lb("Odd Thing"), 0.5);
  assert.equal(lb(""), 0.5);
});
test("hasWeight reads numbers and { value, units }", () => {
  assert.equal(R.hasWeight({ weight: { value: 2, units: "lb" } }), true);
  assert.equal(R.hasWeight({ weight: 2 }), true);
  assert.equal(R.hasWeight({ weight: { value: 0, units: "lb" } }), false);
  assert.equal(R.hasWeight({ weight: null }), false);
  assert.equal(R.hasWeight({}), false);
  assert.equal(R.hasWeight(undefined), false);
});
test("weightData: shape, never overwrites, multiplier, units", () => {
  const wolf = { name: "Wolf Hide", type: "loot", system: { weight: { value: 0, units: "lb" } } };
  assert.deepEqual(R.weightData(wolf), { value: 3, units: "lb" });
  assert.deepEqual(R.weightData({ name: "Wolf Hide", type: "loot", system: {} }), { value: 3, units: "lb" });
  assert.equal(R.weightData({ name: "Wolf Hide", system: { weight: { value: 7, units: "lb" } } }), null, "already weighs something");
  assert.equal(R.weightData({ name: "Wolf Hide", system: { weight: { value: 0.01, units: "lb" } } }), null);
  assert.deepEqual(R.weightData(wolf, { multiplier: 2 }), { value: 6, units: "lb" });
  assert.deepEqual(R.weightData(wolf, { multiplier: 0.5 }), { value: 1.5, units: "lb" });
  assert.equal(R.weightData(wolf, { multiplier: 0 }), null);
  assert.equal(R.weightData(wolf, { multiplier: "x" }), null);
  // Metric world: item default units kg (2.5 lb each in dnd5e).
  assert.deepEqual(R.weightData({ name: "Wolf Hide", system: {} }, { defaultUnits: "kg" }), { value: 1.2, units: "kg" });
  // The item's own unit wins over the world default.
  assert.deepEqual(R.weightData({ name: "Wolf Hide", system: { weight: { value: 0, units: "kg" } } }), { value: 1.2, units: "kg" });
  assert.equal(R.weightData({ name: "Wolf Hide", system: { weight: { value: 0, units: "stone" } } }), null, "unknown unit");
  assert.deepEqual(R.weightData({ name: "Wolf Hide", system: {} }, { defaultUnits: "st", conversion: { st: 14 } }), { value: 0.214, units: "st" });
});
test("weightData uses the item's type and subtype", () => {
  assert.deepEqual(R.weightData({ name: "Dented Helm", type: "equipment", system: { type: { value: "heavy" } } }), { value: 5, units: "lb" });
  assert.deepEqual(R.weightData({ name: "Rusty Dagger", type: "weapon", system: {} }), { value: 3, units: "lb" });
});
test("every weight rule word is lower-case and has a positive weight", () => {
  for (const r of R.WEIGHT_RULES) { assert.ok(r.lb > 0); for (const w of r.words) assert.equal(w, w.toLowerCase()); }
});
