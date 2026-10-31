import { test } from "node:test";
import assert from "node:assert/strict";
import * as J from "../scripts/junk-rules.mjs";

// Item Piles prices come back in the primary currency (gold) as floats; copper is 0.01 of... here 1/100 with a gold/silver/copper economy.
const RATE = 0.01;

test("sell all junk: the total is the sum of each item's whole-coin price", () => {
  // Three items worth 0.004 each (0.4 copper): each rounds to 0, but the old total rounded the float sum (0.012 -> 1 copper).
  const prices = [0.004, 0.004, 0.004];
  const lines = prices.map(p => J.toSmallest(p, RATE));
  assert.deepEqual(lines, [0, 0, 0]);
  assert.equal(J.totalSmallest(prices, RATE), 0, "shown total equals the sum of the lines");
  // Items worth 0.006 (0.6 copper) each round up: lines 1+1+1 = 3, while the float sum 0.018 would give 2.
  assert.equal(J.totalSmallest([0.006, 0.006, 0.006], RATE), 3);
});

test("sell all junk: total is an integer and matches the lines for mixed prices", () => {
  const prices = [0.0149, 0.0251, 1.2349, 0.005, 0.0051];
  const sum = prices.map(p => J.toSmallest(p, RATE)).reduce((a, b) => a + b, 0);
  const t = J.totalSmallest(prices, RATE);
  assert.ok(Number.isInteger(t));
  assert.equal(t, sum);
  assert.equal(J.totalSmallest([], RATE), 0);
  assert.equal(J.totalSmallest([1, 2], 0), 0, "no usable rate: nothing");
});

test("sell all junk: smallest rate comes from the currencies", () => {
  assert.equal(J.smallestRate([{ exchangeRate: 1 }, { exchangeRate: 0.1 }, { exchangeRate: 0.01 }]), 0.01);
  assert.equal(J.smallestRate([]), 0);
  assert.equal(J.smallestRate(undefined), 0);
});
