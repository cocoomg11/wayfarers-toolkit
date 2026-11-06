import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./_globals.mjs";
import * as RM from "../scripts/rounding-model.mjs";
import { FEATURES } from "../scripts/features.mjs";
import { FEATURE_CARDS, FEATURE_IDS, TABS, tabKeys, LABELS, RECORD_SETTINGS, WIZARD_IGNORE } from "../scripts/panel-model.mjs";
import { NOTES } from "../scripts/update-notes.mjs";

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
/** Three-coin economy as the toolkit sets Item Piles up: gold primary, silver 0.01, copper 0.0001. */
const THREE = [{ exchangeRate: 0.0001 }, { exchangeRate: 0.01 }, { exchangeRate: 1, primary: true }];
const CP = 0.0001, SP = 0.01;
const price = (cost, mod, qty, setting) => RM.inSmallest(RM.ipPrice(cost, mod, qty, THREE, setting), THREE);

test("Item Piles 3.3.4's maths at its default precision shows the bug", () => {
  assert.equal(price(CP, 0.5, 1, 0.00001), 0, "1 cp at 50% is 0c (free)");
  assert.equal(price(3 * CP, 0.5, 1, 0.00001), 1, "3 cp at 50% floors to 1c");
});

test("at the smallest-coin precision: 1 cp → 1c, 3 cp → 2c, 1 sp → 50c, free stays free, quantity after rounding", () => {
  const step = RM.coinStep([THREE]).step;
  assert.equal(step, 0.0001);
  assert.equal(RM.ipDecimals(step), 4);
  assert.equal(price(CP, 0.5, 1, step), 1);
  assert.equal(price(3 * CP, 0.5, 1, step), 2);
  assert.equal(price(SP, 0.5, 1, step), 50);
  assert.deepEqual(RM.ipPrice(0, 0.5, 1, THREE, step), { free: true });
  assert.equal(price(3 * CP, 0.5, 3, step), 6, "3 × (3 cp at 50% = 2c)");
  assert.equal(price(CP, 0.5, 7, step), 7);
  assert.equal(price(1 + 2 * SP + 3 * CP, 1, 1, step), 10203, "full price unchanged: 1g 2s 3c");
  assert.equal(price(1.5, 0.8, 2, step), 24000, "gold amounts unchanged");
  assert.deepEqual(RM.ipPrice(CP, 0.25, 1, THREE, step), { none: true }, "under half a coin: no price (known limit)");
});

test("coinStep: finest rate across lists; single coin, shared rates and too-fine coins do nothing", () => {
  assert.deepEqual(RM.coinStep([THREE]), { step: 0.0001, digits: 4 });
  const std = [{ exchangeRate: 10 }, { exchangeRate: 1, primary: true }, { exchangeRate: 0.5 }, { exchangeRate: 0.1 }, { exchangeRate: 0.01 }];
  assert.equal(RM.coinStep([std]).step, 0.01);
  assert.equal(RM.coinStep([THREE, [{ exchangeRate: 1, primary: true }, { exchangeRate: 0.00001 }]]).step, 0.00001, "a merchant's finer list wins");
  assert.equal(RM.coinStep([[{ exchangeRate: 1, primary: true }]]).why, "oneCoin");
  assert.equal(RM.coinStep([[{ exchangeRate: 1 }, { exchangeRate: 1 }]]).why, "sharedRates");
  assert.equal(RM.coinStep([[{ exchangeRate: 1 }, { exchangeRate: 1e-7 }]]).why, "tooFine");
  assert.equal(RM.coinStep([[]]).why, "none");
  assert.equal(RM.coinStep([[{ exchangeRate: 1 }, { exchangeRate: 0.0001, secondary: true }]]).why, "oneCoin", "secondary coins ignored");
  for (const d of [0, 1, 2, 3, 4, 5, 6]) { const s = Number((10 ** -d).toFixed(d)); assert.equal(RM.ipDecimals(s), d, `Item Piles reads ${s} as ${d} decimals`); }
});

test("plan: set (remembering), already, restore, forget", () => {
  assert.deepEqual(RM.plan({ on: true, mode: "coin", step: 0.0001, current: 0.00001, saved: null }), { do: "set", value: 0.0001, save: 0.00001 });
  assert.deepEqual(RM.plan({ on: true, mode: "coin", step: 0.0001, current: 0.001, saved: 0.00001 }), { do: "set", value: 0.0001, save: 0.00001 }, "keeps the first value");
  assert.equal(RM.plan({ on: true, mode: "coin", step: 0.0001, current: 0.0001, saved: 0.00001 }).do, "none");
  assert.equal(RM.plan({ on: true, mode: "coin", step: null, current: 0.00001, saved: null }).do, "none");
  assert.deepEqual(RM.plan({ on: false, mode: "coin", step: 0.0001, current: 0.0001, saved: 0.00001 }), { do: "restore", value: 0.00001 });
  assert.deepEqual(RM.plan({ on: true, mode: "itemPiles", step: 0.0001, current: 0.0001, saved: 0.00001 }), { do: "restore", value: 0.00001 });
  assert.deepEqual(RM.plan({ on: false, mode: "coin", step: 0.0001, current: 0.01, saved: 0.00001 }), { do: "forget" }, "someone changed it since: keep theirs");
  assert.equal(RM.plan({ on: false, mode: "coin", step: 0.0001, current: 0.0001, saved: null }).do, "none");
  assert.equal(RM.readSaved(""), null); assert.equal(RM.readSaved("0.00001"), 0.00001); assert.equal(RM.readSaved("x"), null); assert.equal(RM.readSaved("5"), null);
});

test("under-half merchants and health lines", () => {
  assert.deepEqual(RM.underHalf([{ name: "A", buy: 1, sell: 0.5 }, { name: "B", buy: 0.25, sell: 0.5 }, { name: "C", buy: 1, sell: 0 }, { name: "D", buy: 1, sell: 0.3 }]), ["B", "D"]);
  assert.equal(RM.healthLines({ on: false })[0].level, "off");
  assert.equal(RM.healthLines({ on: true, ipActive: false })[0].level, "warn");
  assert.equal(RM.healthLines({ on: true, ipActive: true, hasApi: false })[0].level, "bad");
  assert.equal(RM.healthLines({ on: true, ipActive: true, hasApi: true, mode: "itemPiles", step: 0.0001 })[0].level, "off");
  assert.equal(RM.healthLines({ on: true, ipActive: true, hasApi: true, mode: "coin", step: null, why: "oneCoin" })[0].level, "info");
  assert.equal(RM.healthLines({ on: true, ipActive: true, hasApi: true, mode: "coin", step: 0.0001, current: 0.00001 })[0].level, "warn");
  const good = RM.healthLines({ on: true, ipActive: true, hasApi: true, mode: "coin", step: 0.0001, current: 0.0001, sample: 1, low: ["B"], newer: true, ipVersion: "3.4.0" });
  assert.deepEqual(good.map(l => l.level), ["ok", "warn", "info"]);
  assert.match(good[0].text, /costs 1/);
});

test("wiring: feature off by default, panel row, labels, record setting, notes, docs, cleanup, no patching", () => {
  const f = FEATURES.find(x => x.id === "merchantRounding");
  assert.ok(f); assert.equal(f.default, false); assert.equal(f.key, "feature-merchantRounding");
  assert.ok(FEATURE_CARDS.some(c => c.id === "merchantRounding")); assert.ok(FEATURE_IDS.includes("merchantRounding"));
  assert.ok(TABS.flatMap(tabKeys).includes("merchantRoundingMode")); assert.ok(LABELS.merchantRoundingMode?.[0]);
  assert.ok(RECORD_SETTINGS.has("merchantRoundingPrev") && WIZARD_IGNORE.has("merchantRoundingPrev"));
  assert.ok(NOTES.some(n => n.version === "2.1.0" && JSON.stringify(n.changes).includes("Merchant coin rounding")));
  const text = JSON.stringify([f, FEATURE_CARDS.find(c => c.id === "merchantRounding"), LABELS.merchantRoundingMode, NOTES[0]]);
  assert.doesNotMatch(text, /warcraft|blizzard|wow\b/i);
  const main = read("scripts/main.mjs");
  assert.match(main, /Rounding\.registerSettings\(\)/); assert.match(main, /Rounding\.init\(\)/);
  assert.match(read("scripts/cleanup.mjs"), /rounding\.mjs"\)\)\.restore\(\)/);
  assert.match(read("scripts/health.mjs"), /RM\.healthLines\(Rounding\.facts\(\)\)/);
  assert.match(read("docs/loot-and-coins.md"), /### Merchant coin rounding/);
  const glue = read("scripts/rounding.mjs");
  assert.match(glue, /setCurrencyDecimalDigits/);
  assert.doesNotMatch(glue, /libWrapper|\.prototype\.|game\.settings\.set\("item-piles"/, "Item Piles is only changed through its API");
  assert.match(glue, /if \(!F\.on\("merchantRounding"\)\) return;/, "the currencies listener is only registered when on");
});
