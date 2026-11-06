import "./_globals.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as R from "../scripts/rounding-model.mjs";
import * as M from "../scripts/panel-model.mjs";
import * as N from "../scripts/update-notes.mjs";

const src = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

test("2.1.1: Item Piles coins are listed largest first (gold, silver, copper)", () => {
  const coins = R.ipCoins();
  assert.deepEqual(coins.map(c => c.data.path), ["system.currency.gp", "system.currency.sp", "system.currency.cp"]);
  assert.ok(R.descending(coins), "exchange rates fall");
  assert.equal(coins.filter(c => c.primary).length, 1); assert.equal(coins[0].primary, true);
  assert.equal(R.ipCoinsMatchList(coins), true);
  const cpFirst = [...coins].reverse();
  assert.equal(R.descending(cpFirst), false);
  assert.equal(R.ipCoinsMatchList(cpFirst), false, "a 2.1.0 copper-first list is corrected once");
  assert.equal(R.ipCoinsMatchList(null), false); assert.equal(R.ipCoinsMatchList(coins.slice(0, 2)), false);
  const m = src("scripts/main.mjs");
  assert.match(m, /const IP_COINS = RoundingModel\.ipCoins\(\);/); assert.match(m, /return RoundingModel\.ipCoinsMatchList\(cur, IP_COINS\);/);
  assert.match(m, /currencies set to gold, silver and copper at 100 to 1/); assert.doesNotMatch(m, /set to copper, silver and gold/);
});

test("2.1.1: the other currency helpers don't depend on the order", () => {
  const gpFirst = R.ipCoins(); const cpFirst = [...gpFirst].reverse();
  assert.equal(R.inSmallest(R.ipPrice(150, 1, 1, gpFirst, 0.0001), gpFirst), R.inSmallest(R.ipPrice(150, 1, 1, cpFirst, 0.0001), cpFirst));
  assert.deepEqual(R.ipPrice(3, 0.5, 1, gpFirst, 0.0001), R.ipPrice(3, 0.5, 1, cpFirst, 0.0001));
});

test("2.1.1: tick-lists compare without order and Save writes the saved order back", () => {
  assert.equal(M.sameList("classes", "paladin, druid, cleric", "cleric, druid, paladin"), true);
  assert.equal(M.sameList("classes", "paladin, druid", "paladin"), false);
  assert.equal(M.listValue("classes", "paladin, druid, cleric", ["cleric", "druid", "paladin"]), "paladin, druid, cleric", "untick + re-tick = saved value");
  assert.equal(M.listValue("classes", "paladin, druid", ["Druid", "ranger"]), "druid, ranger");
  assert.equal(M.sameList("packs", "a.b, c.d", "c.d a.b"), true);
  assert.equal(M.listValue("packs", "a.b, c.d", ["c.d", "a.b"]), "a.b, c.d");
  assert.equal(M.sameList("parties", ["x", "y"], ["y", "x"]), true); assert.deepEqual(M.listValue("users", ["u1", "u2"], ["u2", "u1"]), ["u1", "u2"]);
  const re = M.scenesToRegex(["Inn", "Keep"]);
  assert.equal(M.sameList("scenes", re, M.scenesToRegex(["Keep", "Inn"])), true);
  assert.equal(M.listValue("scenes", re, ["Keep", "Inn"]), re);
  assert.equal(M.sameList("scenes", "^Inn.*", "^Inn.*"), true, "hand-written patterns compared as text");
  assert.equal(M.sameList("scenes", "^Inn.*", re), false);
  const p = src("scripts/panel.mjs");
  for (const k of ["pack", "class", "party", "user", "scene"]) assert.match(p, new RegExp(`listChanged\\("\\[data-${k}\\]"\\)`), k);
});

test("2.1.1: update note", () => {
  const n = N.NOTES.find(x => x.version === "2.1.1");
  assert.ok(n && JSON.stringify(n.changes).includes("Item Piles shows silver again"));
});
