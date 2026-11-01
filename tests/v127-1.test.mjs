import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./_globals.mjs";
const BL = await import("../scripts/bossloot.mjs");
const H = await import("../scripts/health.mjs");
const src = f => readFileSync(new URL(`../scripts/${f}`, import.meta.url), "utf8");

// ---------------------------------------------------------------- 1.27.1: first boss loot check reads pack indexes, not documents
test("splitItemUuid: compendium and world items, nothing else", () => {
  assert.deepEqual(BL.splitItemUuid("Compendium.mod.items.Item.abc"), { pack: "mod.items", id: "abc" });
  assert.deepEqual(BL.splitItemUuid("Item.xyz"), { world: true, id: "xyz" });
  assert.equal(BL.splitItemUuid("Actor.a.Item.b"), null);
  assert.equal(BL.splitItemUuid("Compendium.mod.items.Actor.abc"), null);
  assert.equal(BL.splitItemUuid(null), null);
});

function fakePack(ids, { indexed = true, delay = 0 } = {}) {
  const pack = { documentName: "Item", indexed, calls: 0, index: new Map(indexed ? ids.map(i => [i, { _id: i }]) : []),
    async getIndex() { pack.calls++; await new Promise(r => setTimeout(r, delay)); pack.index = new Map(ids.map(i => [i, { _id: i }])); pack.indexed = true; return pack.index; } };
  return pack;
}

test("itemChecker: index answers, one index request per pack even when called at once, no document loads", async () => {
  const cold = fakePack(["a", "b", "c"], { indexed: false, delay: 20 }); const warm = fakePack(["w"]);
  let loads = 0;
  const exists = BL.itemChecker({ getPack: id => ({ "p.cold": cold, "p.warm": warm })[id] ?? null, worldHas: id => id === "wi", resolve: async () => { loads++; return { item: true }; }, isItem: d => !!d?.item });
  const uuids = [..."abcz"].map(i => `Compendium.p.cold.Item.${i}`);
  const r = await BL.mapLimit([...uuids, ...uuids, "Compendium.p.warm.Item.w", "Item.wi", "Item.nope", "Compendium.p.gone.Item.a"], 8, exists);
  assert.deepEqual(r, [true, true, true, false, true, true, true, false, true, true, false, false]);
  assert.equal(cold.calls, 1, "a cold pack's index is fetched once, shared by concurrent lookups");
  assert.equal(warm.calls, 0, "an index that is already loaded is used as it is");
  assert.equal(loads, 0, "no item is loaded for an existence check");
  assert.equal(await exists("Actor.x.Item.y"), true); assert.equal(loads, 1, "other UUIDs fall back to resolve");
});

test("itemChecker: 100 results across 15 bosses take one index fetch, not 100 round trips", async () => {
  const ids = Array.from({ length: 100 }, (_, i) => `i${i}`); const pack = fakePack(ids, { indexed: false, delay: 30 });
  let loads = 0;
  const exists = BL.itemChecker({ getPack: () => pack, worldHas: () => false, resolve: async () => { loads++; await new Promise(r => setTimeout(r, 250)); return null; }, isItem: () => false });
  const t = Date.now();
  const bosses = Array.from({ length: 15 }, (_, b) => ids.filter((_, i) => i % 15 === b).map(i => `Compendium.x.items.Item.${i}`));
  const out = await BL.mapLimit(bosses, BL.INSPECT_CONCURRENCY, list => BL.mapLimit(list, BL.INSPECT_CONCURRENCY, exists));
  assert.ok(out.flat().every(Boolean)); assert.equal(pack.calls, 1); assert.equal(loads, 0);
  assert.ok(Date.now() - t < 500, `took ${Date.now() - t} ms`);
});

test("inspect uses the checker (no fromUuid per result) and the health section checks bosses in parallel with one checker", () => {
  const ins = src("bossloot.mjs").match(/export async function inspect[\s\S]*?\n}\n/)[0];
  assert.match(ins, /checker \?\? liveChecker\(\)/);
  assert.doesNotMatch(ins, /fromUuid|resolveCached/);
  const h = src("health.mjs").match(/async function bossLoot[\s\S]*?\n}\n/)[0];
  assert.match(h, /const checker = BossLoot\.liveChecker\(\)/);
  assert.match(h, /BossLoot\.mapLimit\(targets, BossLoot\.INSPECT_CONCURRENCY/);
});

// ---------------------------------------------------------------- 1.27.1: healthReport honours the caller's time limit
test("reportTimeout: caller's budget wins (clamped), default 20 s", () => {
  assert.equal(H.REPORT_TIMEOUT_MS, 20000);
  assert.equal(H.reportTimeout(undefined), 20000);
  assert.equal(H.reportTimeout(90000), 90000);
  assert.equal(H.reportTimeout(10), 1000);
  assert.equal(H.reportTimeout(1e9), 300000);
  assert.equal(H.reportTimeout("90000"), 20000);
  assert.equal(H.reportTimeout(NaN), 20000);
  assert.match(src("health.mjs"), /healthCollector\(\{ timeoutMs: reportTimeout\(timeoutMs\) \}\)/);
});
