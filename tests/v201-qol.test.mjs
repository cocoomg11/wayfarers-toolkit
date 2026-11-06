import "./_globals.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as M from "../scripts/panel-model.mjs";

const src = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

test("unsaved mark: a value equal to the saved one is not a change", () => {
  assert.equal(M.sameValue(true, true), true); assert.equal(M.sameValue(8, 8), true); assert.equal(M.sameValue("a", "a"), true);
  assert.equal(M.sameValue(["x", "y"], ["x", "y"]), true);
  assert.equal(M.sameValue(8, 9), false); assert.equal(M.sameValue(["x"], ["x", "y"]), false); assert.equal(M.sameValue("8", 8), false);
});

test("unsaved mark: the row listener clears the mark when the row matches the saved value, and Save uses the same comparison", () => {
  const p = src("scripts/panel.mjs");
  assert.match(p, /rowChange\(row, true\)[\s\S]*?delete row\.dataset\.dirty;[\s\S]*?this\.markDirty\(\)/);
  assert.match(p, /M\.sameValue\(v, get\(k\)\)/, "one comparison for the mark and for Save");
  assert.match(p, /collect\(\) \{[\s\S]*?this\.rowChange\(row\)/, "collect() reads each row through rowChange");
});

test("api.open() for a player: the notice names the module", () => {
  const m = src("scripts/main.mjs");
  assert.match(m, /gmOnly\(\) \{ if \(!game\.user\.isGM\) \{ ui\.notifications\.warn\("Wanderer's Toolkit: GM only\."\)/);
  assert.match(m, /panel\(tab\) \{ return this\.gmOnly\(\)/); assert.match(m, /open\(tab\) \{ return this\.panel\(tab\)/);
});
