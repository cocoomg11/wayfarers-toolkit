import { test } from "node:test";
import assert from "node:assert/strict";
import "./_globals.mjs";
const R = await import("../scripts/renown-model.mjs");

test("renown tiers: generic defaults 3 / 10 / 25 / 50 with 0 / 10 / 15 / 25 % discounts, neutral names", () => {
  assert.deepEqual(R.DEFAULT_TIERS.map(t => t.from), [3, 10, 25, 50]);
  assert.deepEqual(R.DEFAULT_TIERS.map(t => t.discount), [0, 10, 15, 25]);
  for (const t of R.DEFAULT_TIERS) assert.doesNotMatch(t.name, /friendly|honou?red|revered|exalted/i, "no MMO-specific tier names");
  assert.deepEqual(R.DEFAULT_GAINS, [1, 2, 3]);
  assert.deepEqual(R.DEFAULT_LOSSES, ["1d8", "2d6", "2d12"]);
});

test("renown tiers: normalized, sorted, one per threshold, capped, never empty", () => {
  const t = R.normalizeTiers([{ name: "B", from: 10, discount: 150 }, { name: "A", from: 3, color: "nope" }, { name: "dup", from: 10 }, { from: "x" }]);
  assert.deepEqual(t.map(x => [x.name, x.from]), [["A", 3], ["B", 10], ["Tier 4", 50]], "sorted; the second tier at 10 dropped; a bad threshold takes its place's default");
  assert.equal(t[1].discount, 100, "discount clamped");
  assert.match(t[0].color, /^#[0-9a-f]{6}$/);
  assert.equal(R.normalizeTiers([]).length, 4, "empty → defaults");
  assert.equal(R.normalizeTiers(Array.from({ length: 20 }, (_, i) => ({ from: i + 1 }))).length, R.TIERS_MAX);
  assert.equal(R.normalizeTier({ from: 0 }).from, 1, "a tier starts at 1 or more");
});

test("renown: tier index, standing bar text, discount", () => {
  const tiers = R.normalizeTiers(null);
  assert.equal(R.tierIndex(2, tiers), -1);
  assert.equal(R.tierIndex(3, tiers), 0);
  assert.equal(R.tierIndex(12, tiers), 1);
  const s = R.standing({ score: 10, ribbons: [{ text: "Base", amount: 2 }] }, tiers);
  assert.equal(s.total, 12); assert.equal(s.name, "Trusted"); assert.equal(s.bar, "12 / 25 to Esteemed"); assert.equal(s.discount, 10);
  assert.equal(s.pct, Math.round(2 / 15 * 100));
  const none = R.standing({ score: 1 }, tiers);
  assert.equal(none.name, "No tier"); assert.equal(none.bar, "1 / 3 to Known"); assert.equal(none.discount, 0);
  const top = R.standing({ score: 60 }, tiers);
  assert.equal(top.bar, "60 · top tier"); assert.equal(top.pct, 100);
  assert.equal(R.totalOf({ score: 1, ribbons: [{ amount: -5 }] }), 0, "never below 0");
  assert.equal(R.discountText({ discount: 15, rarity: "up to Rare" }), "15% off, up to Rare");
  assert.equal(R.discountText(null), "no discount");
});

test("renown: amounts, losses and dice formulas", () => {
  assert.deepEqual(R.parseAmount("+2"), { kind: "flat", value: 2 });
  assert.deepEqual(R.parseAmount("−3"), { kind: "flat", value: -3 });
  assert.deepEqual(R.parseAmount(-4), { kind: "flat", value: -4 });
  assert.equal(R.parseAmount("0"), null);
  assert.deepEqual(R.parseAmount("-2d6"), { kind: "dice", formula: "2d6", sign: -1 });
  assert.deepEqual(R.parseAmount("d8 + 1"), { kind: "dice", formula: "1d8+1", sign: 1 });
  assert.equal(R.parseAmount("2d6*10"), null, "only dice and numbers with + and −");
  assert.equal(R.parseAmount("@abilities.str.mod"), null);
  assert.equal(R.cleanFormula("1d4+1d4+1d4+1d4+1d4+1d4+1"), "", "at most 6 terms");
  assert.equal(R.cleanFormula("5"), "", "a formula needs a die");
  assert.equal(R.applyDelta(3, -10), 0, "never below 0");
  assert.equal(R.applyDelta(3, 2), 5);
  assert.deepEqual(R.normalizeGains("1, +2, 2, x, 5"), [1, 2, 5]);
  assert.deepEqual(R.normalizeGains(""), [1, 2, 3]);
  assert.deepEqual(R.normalizeLosses("-1d8; 2d6, nope"), ["1d8", "2d6"]);
});

test("renown: factions and config are cleaned and capped", () => {
  let n = 0; const makeId = () => `f${++n}`;
  const f = R.normalizeFaction({ name: "  Watch  ", parent: "Kingdom", merchants: ["abc", "abc", "bad id!"], tiers: [{ from: 5 }], hidden: true }, { makeId });
  assert.equal(f.id, "f1"); assert.equal(f.name, "Watch"); assert.deepEqual(f.merchants, ["abc"]); assert.equal(f.tiers.length, 1);
  assert.equal("hidden" in f, false, "hidden is where it is stored, not a field");
  assert.equal(R.groupOf(f), "Kingdom · subfactions");
  assert.equal(R.groupOf({ group: "" }), "Factions");
  const c = R.normalizeConfig({ factions: Array.from({ length: 150 }, (_, i) => ({ id: `id${i}`, name: `F${i}` })).concat([{ id: "id1" }]) });
  assert.equal(c.factions.length, R.FACTIONS_MAX);
  assert.equal(c.v, R.RENOWN_VERSION);
  assert.deepEqual(R.merchantFactions([{ id: "a", merchants: ["m1"] }, { id: "b", merchants: ["m1", "m2"] }]), { m1: "a", m2: "b" });
});

test("renown: actor flag, entries, ribbons", () => {
  const a = R.normalizeActor({ scores: { f1: 4, f2: 0, "bad!": 3 }, ribbons: { f1: [{ text: "Base", amount: 1 }, { text: "" }] }, tracked: "f1" });
  assert.deepEqual(Object.keys(a.scores), ["f1"]);
  assert.equal(a.ribbons.f1.length, 1);
  assert.equal(R.totalOf(R.entryOf(a, "f1")), 5);
  const b = R.withEntry(a, "f1", { score: 0, ribbons: [] });
  assert.deepEqual(b.scores, {}); assert.deepEqual(b.ribbons, {});
  assert.equal(R.withoutFaction(a, "f1").tracked, "");
  assert.equal(R.normalizeActor({ ribbons: { f: Array.from({ length: 30 }, (_, i) => ({ text: `r${i}`, amount: 1 })) } }).ribbons.f.length, R.RIBBONS_MAX);
});

test("renown: hidden factions live in the GM-only bucket and move both ways", () => {
  const config = R.normalizeConfig({ factions: [{ id: "vis", name: "Visible" }, { id: "sec", name: "Secret" }] });
  const actors = [{ id: "a1", data: { scores: { sec: 7, vis: 2 }, tracked: "sec" } }, { id: "a2", data: { scores: { vis: 1 } } }];
  const hid = R.moveFaction({ config, hidden: null, actors, factionId: "sec", hide: true });
  assert.deepEqual(hid.config.factions.map(f => f.id), ["vis"]);
  assert.deepEqual(hid.hidden.factions.map(f => f.id), ["sec"]);
  assert.equal(hid.hidden.scores.a1.sec.score, 7);
  assert.equal(hid.actors.length, 1, "only actors with renown there change");
  assert.deepEqual(hid.actors[0].data.scores, { vis: 2 }); assert.equal(hid.actors[0].data.tracked, "");
  const all = R.allFactions(hid.config, hid.hidden);
  assert.deepEqual(all.map(f => [f.id, f.hidden]), [["vis", false], ["sec", true]]);
  assert.equal(R.readEntry({ actorId: "a1", actorData: hid.actors[0].data, hidden: hid.hidden, faction: all[1] }).score, 7);
  const back = R.moveFaction({ config: hid.config, hidden: hid.hidden, actors: [{ id: "a1", data: hid.actors[0].data }], factionId: "sec", hide: false });
  assert.deepEqual(back.config.factions.map(f => f.id), ["vis", "sec"]);
  assert.deepEqual(back.hidden.factions, []); assert.deepEqual(back.hidden.scores, {});
  assert.equal(back.actors[0].data.scores.sec, 7);
  assert.deepEqual(R.moveFaction({ config, hidden: null, actors, factionId: "nope", hide: true }).actors, []);
});

test("renown: GM-only bucket caps and cleans the Item Piles record", () => {
  const h = R.normalizeHidden({ applied: { m1: { "Actor.a": 0.9, "Actor.b": 3, "Actor.c": "x" }, "bad!": { "Actor.d": 0.5 } }, scores: { a1: { f: { score: 0 } } } });
  assert.deepEqual(h.applied, { m1: { "Actor.a": 0.9 } });
  assert.deepEqual(h.scores, {}, "empty entries dropped");
});

test("renown: quest rewards, public view and lines", () => {
  const list = R.normalizeQuestRenown([{ faction: "f1", amount: "+2" }, { faction: "f1", amount: 3 }, { faction: "f2", amount: "−1" }, { faction: "f3", amount: 0 }, { faction: "bad id", amount: 1 }]);
  assert.deepEqual(list, [{ faction: "f1", amount: 2 }, { faction: "f2", amount: -1 }]);
  assert.deepEqual(R.publicRenown(list, id => id !== "f2"), [{ faction: "f1", amount: 2 }]);
  assert.deepEqual(R.renownRewardLines(list, [{ id: "f1", name: "Watch" }]), ["Renown: Watch +2"]);
});

test("renown: hook payload carries ids and numbers only", () => {
  const p = R.hookPayload({ actorId: "a1", factionId: "f1", before: 8, after: 10, delta: 2, tierBefore: 0, tierAfter: 1, name: "Maren" });
  assert.deepEqual(p, { actorId: "a1", factionId: "f1", before: 8, after: 10, delta: 2, tierBefore: 0, tierAfter: 1 });
  assert.equal(R.hookPayload({ actorId: "", factionId: "f1" }), null);
  assert.equal(R.RENOWN_HOOK, "wayfarers-toolkit.renownChanged");
});

test("renown: Item Piles discount plan changes only the toolkit's own entries", () => {
  assert.equal(R.buyModifier(10), 0.9); assert.equal(R.buyModifier(0), null);
  // New discount: entry made with sell 1 (Item Piles would otherwise copy the merchant's sell modifier into it).
  let p = R.merchantPlan({ entries: [], applied: {}, wants: { "Actor.a": 10 } });
  assert.deepEqual(p.writes, [{ actorUuid: "Actor.a", buyPriceModifier: 0.9, sellPriceModifier: 1, override: false }]);
  assert.deepEqual(p.applied, { "Actor.a": 0.9 });
  // Already right: nothing to write.
  p = R.merchantPlan({ entries: [{ actorUuid: "Actor.a", buyPriceModifier: 0.9, sellPriceModifier: 1 }], applied: { "Actor.a": 0.9 }, wants: { "Actor.a": 10 } });
  assert.deepEqual(p.writes, []);
  // Tier up: ours, rewritten.
  p = R.merchantPlan({ entries: [{ actorUuid: "Actor.a", buyPriceModifier: 0.9, sellPriceModifier: 1 }], applied: { "Actor.a": 0.9 }, wants: { "Actor.a": 25 } });
  assert.equal(p.writes[0].buyPriceModifier, 0.75);
  // Discount gone: back to neutral, record dropped.
  p = R.merchantPlan({ entries: [{ actorUuid: "Actor.a", buyPriceModifier: 0.9, sellPriceModifier: 1 }], applied: { "Actor.a": 0.9 }, wants: {} });
  assert.deepEqual(p.writes, [{ actorUuid: "Actor.a", buyPriceModifier: 1, sellPriceModifier: 1, override: false }]);
  assert.deepEqual(p.applied, {});
  // The GM's own entry (or one changed since): left alone and reported.
  p = R.merchantPlan({ entries: [{ actorUuid: "Actor.a", buyPriceModifier: 0.5, sellPriceModifier: 1 }], applied: {}, wants: { "Actor.a": 10 } });
  assert.deepEqual(p.writes, []); assert.deepEqual(p.skipped, ["Actor.a"]);
  p = R.merchantPlan({ entries: [{ actorUuid: "Actor.a", buyPriceModifier: 0.8, sellPriceModifier: 1 }], applied: { "Actor.a": 0.9 }, wants: { "Actor.a": 10 } });
  assert.deepEqual(p.writes, []); assert.deepEqual(p.applied, {});
  // An override entry is never ours.
  p = R.merchantPlan({ entries: [{ actorUuid: "Actor.a", buyPriceModifier: 0.9, override: true }], applied: { "Actor.a": 0.9 }, wants: { "Actor.a": 10 } });
  assert.deepEqual(p.writes, []);
  // A neutral entry (left by an earlier reset) is free to use; its sell is kept.
  p = R.merchantPlan({ entries: [{ actorUuid: "Actor.a", buyPriceModifier: 1, sellPriceModifier: 1 }], applied: {}, wants: { "Actor.a": 15 } });
  assert.equal(p.writes[0].buyPriceModifier, 0.85);
});
