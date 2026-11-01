import "./_globals.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { showOnLootCard } from "../scripts/compare.mjs";

const base = { status: "open", isGM: false, userId: "u1", eligible: ["u1", "u2"], hasCharacter: true, compareOn: true, paneOn: true };

test("loot card comparison: only an eligible player with a character, while open, with the setting and the pane on", () => {
  assert.equal(showOnLootCard(base), true);
  assert.equal(showOnLootCard({ ...base, isGM: true }), false, "GMs never");
  assert.equal(showOnLootCard({ ...base, status: "closed" }), false);
  assert.equal(showOnLootCard({ ...base, userId: "u3" }), false, "not one of the roll's players");
  assert.equal(showOnLootCard({ ...base, hasCharacter: false }), false);
  assert.equal(showOnLootCard({ ...base, compareOn: false }), false, "Item comparison tooltips off");
  assert.equal(showOnLootCard({ ...base, paneOn: false }), false, "character pane off");
  assert.equal(showOnLootCard({ ...base, eligible: null }), false);
  assert.equal(showOnLootCard(), false);
});

test("loot card comparison is built on the viewer's client and never stored in the message", () => {
  const loot = readFileSync(new URL("../scripts/loot.mjs", import.meta.url), "utf8");
  const fn = loot.slice(loot.indexOf("async function addCompare"), loot.indexOf("/** Open cards on this client"));
  assert.ok(fn.length > 100);
  assert.match(fn, /comparisonHTML\(actor, item\)/);
  assert.match(fn, /showOnLootCard\(/);
  assert.doesNotMatch(fn, /\.update\(|setFlag|ChatMessage|request\(/);
  assert.doesNotMatch(loot.slice(loot.indexOf("function cardHTML"), loot.indexOf("// ---------------------------------------------------------------- GM side")), /compare/i, "the stored card HTML has no comparison");
  assert.match(loot, /addCompare\(root, st\)/);
});

test("loot card comparison does not need the card element to be connected (detached in the v14 render hook)", () => {
  const loot = readFileSync(new URL("../scripts/loot.mjs", import.meta.url), "utf8");
  const fn = loot.slice(loot.indexOf("async function addCompare"), loot.indexOf("/** Open cards on this client"));
  assert.doesNotMatch(fn, /isConnected/);
  assert.match(fn, /compareSeq\.get\(root\) !== seq/, "stale renders are skipped");
  assert.match(fn, /querySelector\("\.wct-loot-compare"\)\?\.remove\(\)/, "a re-render replaces, never duplicates");
});
